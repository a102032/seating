import {
  Armchair,
  ChevronDown,
  CircleCheck,
  ClipboardPaste,
  Dices,
  FilePlus2,
  FileUp,
  GraduationCap,
  Pencil,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  UserX,
} from 'lucide-react'
import clsx from 'clsx'
import { Popover } from 'radix-ui'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { useCloudSync } from '../../hooks/useCloudSync'
import { useDrive } from '../../hooks/useDrive'
import { starsWaitOnDesks } from '../../lib/points'
import { parseRosterCsv, rosterFromRows } from '../../lib/csv'
import { makeRosterSheet, readSheet, rosterSheets, type DriveFile } from '../../lib/drive'
import { hasNoAvatar, resolveAvatarSrc } from '../../lib/stickers'
import { MAX_DESKS, type ClassData, type Gender, type Student } from '../../types'
import { GoogleG } from '../Account'
import { AvatarPickerModal } from '../AvatarPickerModal'
import { ConfirmModal } from '../ConfirmModal'
import { NoAvatarPicture } from '../NoAvatarPicture'
import { PasteRosterModal } from '../PasteRosterModal'
import { RosterSheetsModal } from '../RosterSheetsModal'
import { TactileButton } from '../TactileButton'
import { Btn, NextButton } from './parts'

interface StudentsSectionProps {
  activeClass: ClassData
  cloud: ReturnType<typeof useCloudSync>
  /** Returns the new students' ids. */
  onAddStudents: (students: Omit<Student, 'id'>[]) => string[]
  /** An import taken back out: exactly the students it added. */
  onRemoveStudents: (studentIds: string[]) => void
  /** A new list in place of the class's students. */
  onReplaceStudents: (students: Omit<Student, 'id'>[]) => string[]
  onUpdateStudent: (studentId: string, patch: Partial<Omit<Student, 'id'>>) => void
  onDeleteStudent: (studentId: string) => void
  onUnseatStudent: (studentId: string) => void
  onUnseatAll: () => void
  onSeatClass: () => void
  onMixUpSeats: () => void
  onNext: () => void
}

/**
 * Not chosen yet reads "Boy or Girl", in the placeholder's grey, rather than "Unspecified": the box
 * has no label of its own, so it has to say what it is for. There is no way back to not chosen - a
 * teacher always knows, and a CSV without a gender column still arrives unset.
 */
function GenderSelect({ value, onChange, className }: { value: Gender; onChange: (g: Gender) => void; className?: string }) {
  return (
    <Select value={value === 'unspecified' ? '' : value} onValueChange={(v) => onChange(v as Gender)}>
      <SelectTrigger className={clsx('w-auto', className)} aria-label="Boy or Girl">
        <SelectValue placeholder="Boy or Girl" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="boy">Boy</SelectItem>
        <SelectItem value="girl">Girl</SelectItem>
      </SelectContent>
    </Select>
  )
}

/**
 * The class list, and everything that fills it or seats it. The list is the one part that may
 * scroll - it is more of the same kind of thing - so it takes all the height there is; above it
 * the two ways in (a whole list at once, or one student), below it the seats.
 */
export function StudentsSection({
  activeClass,
  cloud,
  onAddStudents,
  onRemoveStudents,
  onReplaceStudents,
  onUpdateStudent,
  onDeleteStudent,
  onUnseatStudent,
  onUnseatAll,
  onSeatClass,
  onMixUpSeats,
  onNext,
}: StudentsSectionProps) {
  const drive = useDrive(cloud.account?.uid)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sheetsOpen, setSheetsOpen] = useState(false)
  const [sheets, setSheets] = useState<DriveFile[] | null>(null)
  const [imported, setImported] = useState<string | null>(null)
  // A list pasted in: what was pasted, and whether its window is up.
  const [pasteText, setPasteText] = useState<string | null>(null)
  // What the last import, add or seating did ("Added 28 students."), over the list, with the
  // students an import added, so it can be taken back out.
  const [note, setNote] = useState<{ text: string; added?: string[]; problem?: boolean } | null>(null)
  // A list waiting on Replace them / Add to them, because the class already has students.
  const [pending, setPending] = useState<{ students: Omit<Student, 'id'>[]; report: (text: string) => void } | null>(null)
  const [confirming, setConfirming] = useState<'mixup' | 'unseat' | Student | null>(null)
  const [pickingAvatarFor, setPickingAvatarFor] = useState<Student | null>(null)

  const seatedIds = useMemo(() => new Set(activeClass.seating.filter((s): s is string => s !== null)), [activeClass.seating])
  const count = activeClass.students.length
  const unseated = activeClass.students.filter((s) => !seatedIds.has(s.id)).length
  const showStars = starsWaitOnDesks(activeClass)

  /**
   * Who in a list isn't on the roster yet (same name and homeroom), so importing a file a second
   * time - after fixing a line in it, say - adds only who is new rather than doubling the class.
   */
  function newcomers(students: Omit<Student, 'id'>[]) {
    const key = (s: { name: string; homeroom: string }) => `${s.name.trim().toLowerCase()}|${s.homeroom.trim()}`
    const known = new Set(activeClass.students.map(key))
    return students.filter((s) => !known.has(key(s)) && known.add(key(s)))
  }

  function describeAdded(found: number, added: number): string {
    const already = found - added
    return `Added ${added} ${added === 1 ? 'student' : 'students'}.${already > 0 ? ` ${already} ${already === 1 ? 'was' : 'were'} already in the class.` : ''}`
  }

  /**
   * Every import comes in here: a paste, a file or a sheet. Into a class that already has
   * students it asks first, Replace them or Add to them (2026-10-06, the teacher: a second roster
   * only ever added, so a wrong one could only be fixed a student at a time). `report` says what
   * happened where the import was made (the sheets window has its own line).
   */
  function bringIn(students: Omit<Student, 'id'>[], report: (text: string) => void = () => {}) {
    const fresh = newcomers(students)
    const say = (text: string, added?: string[], problem = false) => {
      setNote({ text, added, problem })
      report(text)
    }
    if (students.length === 0) return say('No names found in that list.', undefined, true)
    if (fresh.length === 0) return say('Everyone in that list is already in the class.', undefined, true)
    if (count > 0) {
      setPending({ students, report })
      return
    }
    say(describeAdded(students.length, fresh.length), onAddStudents(fresh))
  }

  function answerPending(choice: 'replace' | 'add' | 'cancel') {
    if (!pending) return
    const { students, report } = pending
    setPending(null)
    if (choice === 'cancel') return
    const say = (text: string, added?: string[]) => {
      setNote({ text, added })
      report(text)
    }
    if (choice === 'replace') {
      onReplaceStudents(students)
      // Replacing isn't taken back with a tap: the question before it is the safeguard.
      say(`The class list is now these ${students.length} ${students.length === 1 ? 'student' : 'students'}.`)
      return
    }
    const fresh = newcomers(students)
    say(describeAdded(students.length, fresh.length), onAddStudents(fresh))
  }

  /** The last import taken back out: exactly who it added, nobody who was here before. */
  function takeOut() {
    const added = note?.added
    if (!added?.length) return
    onRemoveStudents(added)
    setNote({ text: `Took out the ${added.length} ${added.length === 1 ? 'student' : 'students'} just added.` })
  }

  /**
   * An Excel file as it is, or a CSV. Teachers keep rosters in Excel and few know what a CSV is:
   * the file window used to show only CSV files, so an Excel roster couldn't even be chosen
   * (lesson one). The Excel reader is loaded only when one is chosen.
   */
  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const lower = file.name.toLowerCase()
    try {
      let students: Omit<Student, 'id'>[]
      if (lower.endsWith('.xlsx')) {
        const { readXlsxRows } = await import('../../lib/xlsx')
        students = rosterFromRows(await readXlsxRows(await file.arrayBuffer()))
      } else if (lower.endsWith('.xls')) {
        setNote({ text: 'That is an old Excel file. Save it as .xlsx and try again, or copy the names and paste them.', problem: true })
        return
      } else {
        students = parseRosterCsv(await file.text())
      }
      bringIn(students)
    } catch {
      setNote({ text: "That file couldn't be read. Copy the names in it and paste them instead.", problem: true })
    }
  }

  // Ctrl+V anywhere in the section (but not in a box being typed in) opens the pasted list, so
  // "copy it in Excel, paste it here" needs nothing found first.
  useEffect(() => {
    if (pasteText !== null) return
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim()) return
      e.preventDefault()
      setPasteText(text)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [pasteText])

  // Each of these starts Drive straight from the tap: the first time in an hour it opens
  // Google's window, which a browser only allows right after one.
  function openRosterSheets(make: boolean) {
    setImportOpen(false)
    setImported(null)
    setSheetsOpen(true)
    if (make) makeSheet()
    else {
      setSheets(null)
      void drive.run('list', rosterSheets).then((found) => found && setSheets(found))
    }
  }

  function makeSheet() {
    void drive
      .run('make', (token) => makeRosterSheet(token, activeClass.name))
      .then((made) => made && setSheets((list) => [made, ...(list ?? []).filter((s) => s.id !== made.id)]))
  }

  function importSheet(sheet: DriveFile) {
    setImported(null)
    void drive
      .run('read', (token) => readSheet(token, sheet.id))
      .then((rows) => {
        if (!rows) return
        const students = rosterFromRows(rows)
        if (students.length === 0) {
          setImported('This sheet has no students yet. Fill it in first.')
          return
        }
        bringIn(students, setImported)
      })
  }

  const chooseFile = () => {
    setImportOpen(false)
    fileInputRef.current?.click()
  }
  const paste = () => {
    setImportOpen(false)
    setPasteText('')
  }

  return (
    <>
      <div className="cs-page-head">
        <p>{count ? `${count} ${count === 1 ? 'student' : 'students'} in this class.` : 'Nobody here yet.'}</p>
        {count > MAX_DESKS && (
          <span className="cs-pill cs-warn">
            <TriangleAlert size={13} /> {count - MAX_DESKS} more than the {MAX_DESKS} desks
          </span>
        )}
        <div className="cs-right">
          <Btn
            small
            data-guide="add"
            onClick={() => {
              setAdding(true)
              setEditingId(null)
            }}
          >
            <Plus /> Add a Student
          </Btn>
          {/* A short menu: a pasted list first (the quickest, with no file to save), then a file -
              Excel or CSV - and, signed in, Google Sheets. */}
          <Popover.Root open={importOpen} onOpenChange={setImportOpen}>
            <Popover.Trigger asChild>
              <Btn small data-guide="import" aria-expanded={importOpen}>
                <Upload /> Import Student List <ChevronDown />
              </Btn>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} className="cs-menu" data-guide="import-menu">
                <MenuChoice
                  icon={<ClipboardPaste className="text-primary" />}
                  title="Paste a list"
                  note="Copied from Excel or Google Sheets"
                  onClick={paste}
                />
                <MenuChoice icon={<FileUp />} title="From an Excel or CSV file" note="From this computer" onClick={chooseFile} />
                {cloud.account && (
                  <>
                    <MenuChoice
                      icon={<GoogleG size={20} />}
                      title="From a Google Sheet"
                      note="A roster sheet in your Drive"
                      onClick={() => openRosterSheets(false)}
                    />
                    <MenuChoice
                      icon={<FilePlus2 className="text-emerald-600" />}
                      title="Make a roster sheet"
                      note="A ready-made Sheet to fill in, then import"
                      onClick={() => openRosterSheets(true)}
                    />
                  </>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              // Otherwise choosing the same file again (fixed and saved) does nothing at all.
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {note && (
        <div className={note.problem ? 'cs-note text-amber-700 dark:text-amber-400' : 'cs-note text-emerald-700 dark:text-emerald-400'}>
          {note.problem ? <TriangleAlert size={16} /> : <CircleCheck size={16} />} {note.text}
          {/* The wrong list? One tap takes back exactly what it added. It stays until the window
              closes or the next import - nothing on a timer. */}
          {note.added && note.added.length > 0 && (
            <Btn small onClick={takeOut} data-take-out="">
              <Undo2 /> Take them out
            </Btn>
          )}
        </div>
      )}

      {/* A file can still be dropped on the list; the Import button is the way on a board. */}
      <div
        className={clsx('cs-list', dragOver && 'ring-2 ring-primary')}
        data-guide="roster"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
      >
        {adding && (
          <AddRow
            onAdd={(student) => {
              onAddStudents([student])
              setNote({ text: `Added ${student.name}.` })
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {count === 0 && !adding ? (
          // An empty class says how to fill it, where the list will be.
          <div className="cs-empty" data-guide="students-empty">
            <div className="cs-big">Copy your student list from Excel and paste it here.</div>
            <div className="flex flex-wrap justify-center gap-2">
              <Btn kind="primary" onClick={paste}>
                <ClipboardPaste /> Paste a List
              </Btn>
              <Btn onClick={() => fileInputRef.current?.click()}>
                <FileUp /> Choose a File
              </Btn>
            </div>
            <span className="cs-hint">Names and homeroom numbers. Boy or Girl can wait.</span>
          </div>
        ) : (
          activeClass.students.map((s) => (
            <RosterRow
              key={s.id}
              student={s}
              seated={seatedIds.has(s.id)}
              editing={editingId === s.id}
              showStars={showStars}
              onEdit={() => {
                setEditingId(s.id)
                setAdding(false)
              }}
              onCancelEdit={() => setEditingId(null)}
              onSave={(patch) => {
                onUpdateStudent(s.id, patch)
                setEditingId(null)
              }}
              onUnseat={() => {
                onUnseatStudent(s.id)
                setEditingId(null)
              }}
              onRemove={() => setConfirming(s)}
              onPickAvatar={() => setPickingAvatarFor(s)}
            />
          ))
        )}
      </div>

      <div className="cs-foot">
        <Btn kind="quiet" small onClick={() => setConfirming('mixup')} disabled={count < 2} data-guide="mixup">
          <Dices /> Mix Up Seats
        </Btn>
        <Btn kind="quiet" small onClick={() => setConfirming('unseat')} disabled={seatedIds.size === 0} data-guide="unseat">
          <UserX /> Unseat All
        </Btn>
        <div className="cs-right">
          {/* Always here, greyed when everyone has a desk, so it is never hidden. */}
          <Btn
            kind="primary"
            data-guide="seat"
            disabled={unseated === 0}
            title={count && !unseated ? 'Everyone has a desk' : undefined}
            onClick={() => {
              onSeatClass()
              setNote({ text: 'Everyone has a desk.' })
            }}
          >
            <GraduationCap /> {unseated === 0 ? 'Seat Students' : `Seat Students (${unseated})`}
          </Btn>
          <NextButton label="Avatars" onClick={onNext} />
        </div>
      </div>

      <ReplaceOrAdd
        pending={pending}
        current={count}
        newcomers={pending ? newcomers(pending.students).length : 0}
        onAnswer={answerPending}
      />

      <ConfirmModal
        open={confirming === 'mixup'}
        title="Mix Up Seats?"
        message={`Everyone in "${activeClass.name}" gets a new, random seat. The seating plan you have now can't be brought back.`}
        confirmLabel="Yes, Mix Up"
        cancelLabel="No"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          onMixUpSeats()
          setConfirming(null)
          setNote({ text: 'New seats for everyone.' })
        }}
      />
      <ConfirmModal
        open={confirming === 'unseat'}
        title="Unseat All Students?"
        message={`Every desk in "${activeClass.name}" is cleared, and everyone goes back to the list without a desk.`}
        confirmLabel="Yes, Unseat All"
        cancelLabel="No"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          onUnseatAll()
          setConfirming(null)
        }}
      />
      <ConfirmModal
        open={typeof confirming === 'object' && confirming !== null}
        title="Remove Student?"
        message={
          typeof confirming === 'object' && confirming
            ? `This takes ${confirming.name} out of "${activeClass.name}"${seatedIds.has(confirming.id) ? ' and their seat' : ''}. This can't be undone.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="No"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (typeof confirming === 'object' && confirming) onDeleteStudent(confirming.id)
          setConfirming(null)
          setEditingId(null)
        }}
      />

      <PasteRosterModal
        open={pasteText !== null}
        initialText={pasteText ?? ''}
        onClose={() => setPasteText(null)}
        onAdd={(students) => {
          setPasteText(null)
          bringIn(students)
        }}
      />
      <RosterSheetsModal
        open={sheetsOpen}
        onClose={() => setSheetsOpen(false)}
        drive={drive}
        sheets={sheets}
        onMakeSheet={makeSheet}
        onImportSheet={importSheet}
        imported={imported}
      />
      <AvatarPickerModal
        open={pickingAvatarFor !== null}
        student={pickingAvatarFor}
        onClose={() => setPickingAvatarFor(null)}
        onSelect={(avatarId) => {
          if (pickingAvatarFor) onUpdateStudent(pickingAvatarFor.id, { avatarId })
          setPickingAvatarFor(null)
        }}
      />
    </>
  )
}

function MenuChoice({ icon, title, note, onClick }: { icon: ReactNode; title: string; note: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}>
      {icon}
      <span>
        <b>{title}</b>
        <small>{note}</small>
      </span>
    </button>
  )
}

/** One student at a time, like a new student who joins later: their name, homeroom and Boy or Girl. */
function AddRow({ onAdd, onCancel }: { onAdd: (student: Omit<Student, 'id'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [homeroom, setHomeroom] = useState('')
  const [gender, setGender] = useState<Gender>('unspecified')
  const add = () => name.trim() && onAdd({ name: name.trim(), homeroom: homeroom.trim(), gender })
  return (
    <div className="cs-srow cs-edit" data-guide="add-row">
      <input
        className="cs-box"
        data-slot="input"
        autoFocus
        placeholder="Name"
        aria-label="Name"
        style={{ flex: 2, minWidth: '8rem' }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <input
        className="cs-box"
        data-slot="input"
        placeholder="Homeroom #"
        aria-label="Homeroom"
        style={{ width: '7.5rem' }}
        value={homeroom}
        onChange={(e) => setHomeroom(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <GenderSelect value={gender} onChange={setGender} className="h-9" />
      <Btn kind="primary" small onClick={add} disabled={!name.trim()}>
        <Plus /> Add
      </Btn>
      <Btn small onClick={onCancel}>
        Cancel
      </Btn>
    </div>
  )
}

interface RosterRowProps {
  student: Student
  seated: boolean
  editing: boolean
  /**
   * Stars wait on the desks (student points, or a class goal's on the desks first), so the list
   * shows each desk's and lets a miscount be fixed. Straight to the goal, a student has none.
   */
  showStars: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (patch: Partial<Omit<Student, 'id'>>) => void
  onUnseat: () => void
  onRemove: () => void
  onPickAvatar: () => void
}

/** One pencil per student; Out of seat and Remove are inside it, not three icons on every line. */
function RosterRow({
  student,
  seated,
  editing,
  showStars,
  onEdit,
  onCancelEdit,
  onSave,
  onUnseat,
  onRemove,
  onPickAvatar,
}: RosterRowProps) {
  if (editing) return <EditRow {...{ student, seated, showStars, onCancelEdit, onSave, onUnseat, onRemove }} />
  return (
    <div className="cs-srow">
      <button
        type="button"
        className="cs-ava"
        onClick={onPickAvatar}
        title="Choose an avatar"
        aria-label={`Choose an avatar for ${student.name}`}
      >
        {hasNoAvatar(student) ? (
          <NoAvatarPicture className="h-full w-full" />
        ) : (
          <img src={resolveAvatarSrc(student) ?? undefined} alt="" draggable={false} className="h-full w-full object-contain select-none" />
        )}
      </button>
      <span className="cs-who">{student.name}</span>
      {!seated && <span className="cs-pill cs-warn">No desk yet</span>}
      {showStars && (student.points ?? 0) > 0 && (
        <span className="cs-pill">
          <Star size={11} className="fill-amber-500 text-amber-500" strokeWidth={0} /> {student.points}
        </span>
      )}
      <span className="cs-pill">Room {student.homeroom || '-'}</span>
      <button type="button" className="cs-icon-btn" onClick={onEdit} aria-label={`Change ${student.name}`} title="Change">
        <Pencil />
      </button>
    </div>
  )
}

/** The student as they are when the pencil was tapped; Cancel throws the changes away. */
function EditRow({
  student,
  seated,
  showStars,
  onCancelEdit,
  onSave,
  onUnseat,
  onRemove,
}: Pick<RosterRowProps, 'student' | 'seated' | 'showStars' | 'onCancelEdit' | 'onSave' | 'onUnseat' | 'onRemove'>) {
  const [name, setName] = useState(student.name)
  const [homeroom, setHomeroom] = useState(student.homeroom)
  const [gender, setGender] = useState<Gender>(student.gender)
  const [points, setPoints] = useState(String(student.points ?? 0))

  function save() {
    // A name wiped out by mistake keeps the old one: a desk with no name on it can't be read.
    onSave({
      name: name.trim() || student.name,
      homeroom: homeroom.trim(),
      gender,
      ...(showStars ? { points: Math.max(0, Number(points) || 0) } : {}),
    })
  }

  return (
    <div className="cs-srow cs-edit">
      <input
        className="cs-box"
        data-slot="input"
        aria-label="Name"
        style={{ flex: 2, minWidth: '8rem' }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <input
        className="cs-box"
        data-slot="input"
        aria-label="Homeroom"
        style={{ width: '6.5rem' }}
        value={homeroom}
        onChange={(e) => setHomeroom(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <GenderSelect value={gender} onChange={setGender} className="h-9" />
      {/* Editable rather than a reset button: correcting a miscount ("that should be 1, not 3") is
            the case that actually comes up, and typing 0 covers the reset. */}
      {showStars && (
        <span className="flex items-center gap-1">
          <Star size={14} className="shrink-0 fill-amber-500 text-amber-500" strokeWidth={0} />
          <input
            className="cs-box"
            data-slot="input"
            aria-label="Stars"
            inputMode="numeric"
            style={{ width: '4rem' }}
            value={points}
            onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </span>
      )}
      <Btn kind="primary" small onClick={save}>
        Save
      </Btn>
      <Btn small onClick={onCancelEdit}>
        Cancel
      </Btn>
      {seated && (
        <Btn kind="quiet" small onClick={onUnseat}>
          <Armchair /> Out of seat
        </Btn>
      )}
      <Btn kind="quiet-red" small onClick={onRemove}>
        <Trash2 /> Remove
      </Btn>
    </div>
  )
}

/**
 * A list brought into a class that already has students: replace them with it, or add the new
 * names to them. Replace is what a teacher means after importing the wrong roster; Add is what
 * they mean after fixing a line in the right one. Tapping outside, or Cancel, changes nothing.
 */
function ReplaceOrAdd({
  pending,
  current,
  newcomers,
  onAnswer,
}: {
  pending: { students: Omit<Student, 'id'>[] } | null
  current: number
  newcomers: number
  onAnswer: (choice: 'replace' | 'add' | 'cancel') => void
}) {
  const listed = pending?.students.length ?? 0
  return (
    <AlertDialog open={pending !== null} onOpenChange={(next) => !next && onAnswer('cancel')}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            This class has {current} {current === 1 ? 'student' : 'students'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Replace them with the {listed} in your list, or add the {newcomers} new {newcomers === 1 ? 'one' : 'ones'} to them?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap gap-2">
          <AlertDialogCancel onClick={() => onAnswer('cancel')}>Cancel</AlertDialogCancel>
          <TactileButton onClick={() => onAnswer('add')} data-import-add="">
            <Plus size={16} /> Add to them
          </TactileButton>
          <TactileButton variant="primary" onClick={() => onAnswer('replace')} data-import-replace="">
            <Upload size={16} /> Replace them
          </TactileButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
