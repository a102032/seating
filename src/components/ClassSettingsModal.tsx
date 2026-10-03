import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Armchair,
  ChevronDown,
  ClipboardCheck,
  Dices,
  FilePlus2,
  FileUp,
  GraduationCap,
  Pencil,
  Plus,
  School,
  Smile,
  Star,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  UserX,
} from 'lucide-react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Popover } from 'radix-ui'
import type { ComponentType, ReactNode } from 'react'
import { parseRosterCsv, rosterFromRows } from '../lib/csv'
import { makeRosterSheet, readSheet, rosterSheets, type DriveFile } from '../lib/drive'
import type { useCloudSync } from '../hooks/useCloudSync'
import { useDrive } from '../hooks/useDrive'
import { MAX_CLASSES, type AvatarScope } from '../hooks/useClasses'
import { resolveAvatarSrc } from '../lib/stickers'
import type { Theme } from '../lib/theme'
import { MAX_DESKS, type ClassData, type Gender, type Student } from '../types'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { GoogleG } from './Account'
import { AvatarPickerModal } from './AvatarPickerModal'
import { GoogleTab } from './GoogleTab'
import { RosterSheetsModal } from './RosterSheetsModal'
import { AttendanceHistoryModal } from './AttendanceHistoryModal'
import { ClassAvatarsModal } from './ClassAvatarsModal'
import { ConfirmModal } from './ConfirmModal'
import { DangerCover } from './DangerCover'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { ThemePicker } from './ThemePicker'
import { LayoutPicker } from './LayoutPicker'
import type { RoomLayout } from '../lib/layouts'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface ClassSettingsModalProps {
  open: boolean
  onClose: () => void
  activeClass: ClassData
  classes: ClassData[]
  classesCount: number
  unseatedCount: number
  onRename: (name: string) => void
  onAddStudents: (students: Omit<Student, 'id'>[]) => void
  onUpdateStudent: (studentId: string, patch: Partial<Omit<Student, 'id'>>) => void
  onAssignAvatars: (themeId: string, options: { scope: AvatarScope; poses: 'mixed' | 'same' }) => void
  onDeleteStudent: (studentId: string) => void
  onUnseatStudent: (studentId: string) => void
  onCreateClass: () => void
  onDeleteClass: () => void
  onUnseatAll: () => void
  onSeatClass: () => void
  onMixUpSeats: () => void
  onSetLayout: (layout: RoomLayout) => void
  onSetShowAllHomerooms: (show: boolean) => void
  onToggleAbsentInRecord: (studentId: string, day: string) => void
  theme: Theme
  onSetTheme: (theme: Theme) => void
  /** Which tab it opens on. A class just made from the splash needs its name first, so the Class tab. */
  initialTab?: SettingsTab
  /** Signing in, for the Google tab and the Google Sheets import. */
  cloud: ReturnType<typeof useCloudSync>
  onSwitchTeacher: () => void
}

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
]

/**
 * Not chosen yet reads "Boy or Girl", in the placeholder's grey, rather than "Unspecified":
 * the box has no label of its own, so it has to say what it is for. There is no way back to
 * not chosen - a teacher always knows, and a CSV without a gender column still arrives unset.
 */
function GenderSelect({ value, onChange, className }: { value: Gender; onChange: (g: Gender) => void; className?: string }) {
  return (
    <Select value={value === 'unspecified' ? '' : value} onValueChange={(v) => onChange(v as Gender)}>
      <SelectTrigger className={clsx('w-full', className)}>
        <SelectValue placeholder="Boy or Girl" />
      </SelectTrigger>
      <SelectContent>
        {genderOptions.map((g) => (
          <SelectItem key={g.value} value={g.value}>
            {g.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type SettingsTab = 'students' | 'class' | 'google'

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'students', label: 'Students', icon: Users },
  { id: 'class', label: 'Class', icon: School },
  { id: 'google', label: 'Google', icon: GoogleG },
]

/**
 * Each tab is about one thing: the students (the roster, their seats, today's attendance), the
 * class as a whole (its look, and making or deleting it), or Google (the account, the seating
 * chart as a picture, the Drive folder). It was one page, and the roster - the part used most -
 * got a row and a half of it.
 */
function SettingsTabs({ tab, onChange }: { tab: SettingsTab; onChange: (tab: SettingsTab) => void }) {
  return (
    <div role="tablist" className="flex shrink-0 rounded-2xl bg-secondary p-1">
      {SETTINGS_TABS.map(({ id, label, icon: Icon }) => {
        const on = tab === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(id)}
            className={clsx(
              'relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 font-bold transition-colors active:scale-[0.98]',
              on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId="settings-tab-pill"
                className="absolute inset-0 rounded-xl bg-card shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Icon size={18} className="relative" />
            <span className="relative">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ClassSettingsModal({
  open,
  onClose,
  activeClass,
  classes,
  classesCount,
  unseatedCount,
  onRename,
  onAddStudents,
  onUpdateStudent,
  onAssignAvatars,
  onDeleteStudent,
  onUnseatStudent,
  onCreateClass,
  onDeleteClass,
  onUnseatAll,
  onSeatClass,
  onMixUpSeats,
  onSetLayout,
  onSetShowAllHomerooms,
  onToggleAbsentInRecord,
  theme,
  onSetTheme,
  initialTab = 'students',
  cloud,
  onSwitchTeacher,
}: ClassSettingsModalProps) {
  const [name, setName] = useState(activeClass.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualHomeroom, setManualHomeroom] = useState('')
  const [manualGender, setManualGender] = useState<Gender>('unspecified')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingUnseatAll, setConfirmingUnseatAll] = useState(false)
  const [confirmingMixUp, setConfirmingMixUp] = useState(false)
  const [confirmingDeleteStudent, setConfirmingDeleteStudent] = useState<Student | null>(null)
  const [pickingAvatarFor, setPickingAvatarFor] = useState<Student | null>(null)
  const [assigningAvatars, setAssigningAvatars] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [guardOpen, setGuardOpen] = useState(false)
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [sheetsOpen, setSheetsOpen] = useState(false)
  const [sheets, setSheets] = useState<DriveFile[] | null>(null)
  const [imported, setImported] = useState<string | null>(null)
  const drive = useDrive(cloud.account?.uid)

  const seatedIds = useMemo(() => new Set(activeClass.seating.filter((s): s is string => s !== null)), [activeClass.seating])

  useEffect(() => {
    setName(activeClass.name)
    setNameError(null)
  }, [activeClass.id, activeClass.name])

  function commitRename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === activeClass.name) {
      // A cleared box goes back to the name the class still has, rather than sitting empty.
      setName(activeClass.name)
      setNameError(null)
      return
    }
    const isDuplicate = classes.some((c) => c.id !== activeClass.id && c.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (isDuplicate) {
      setNameError(`You already have a class named "${trimmed}"`)
      return
    }
    setNameError(null)
    onRename(trimmed)
  }

  /**
   * Anyone already on the roster (same name and homeroom) is skipped, so importing a file a
   * second time - after fixing a line in it, say - adds only who is new rather than doubling
   * the class.
   */
  function addNew(students: Omit<Student, 'id'>[]): number {
    const key = (s: { name: string; homeroom: string }) => `${s.name.trim().toLowerCase()}|${s.homeroom.trim()}`
    const known = new Set(activeClass.students.map(key))
    const fresh = students.filter((s) => !known.has(key(s)) && known.add(key(s)))
    if (fresh.length > 0) onAddStudents(fresh)
    return fresh.length
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    addNew(parseRosterCsv(await file.text()))
  }

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
        const added = addNew(students)
        setImported(
          students.length === 0
            ? 'This sheet has no students yet. Fill it in first.'
            : added === 0
              ? 'Everyone on this sheet is already in the class.'
              : `Added ${added} ${added === 1 ? 'student' : 'students'}.${
                  students.length > added
                    ? ` ${students.length - added} ${students.length - added === 1 ? 'was' : 'were'} already in the class.`
                    : ''
                }`,
        )
      })
  }

  function submitManualAdd() {
    if (!manualName.trim()) return
    onAddStudents([{ name: manualName.trim(), homeroom: manualHomeroom.trim(), gender: manualGender }])
    setManualName('')
    setManualHomeroom('')
    setManualGender('unspecified')
  }

  // Settings opens on the roster, the part a teacher comes here for most, unless it was opened
  // for a class that was just made. Reset as it opens, during render, so the wrong tab never
  // shows for a frame first.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTab(initialTab)
  }

  function closeAndReset() {
    setConfirmingDelete(false)
    setConfirmingUnseatAll(false)
    setConfirmingMixUp(false)
    setConfirmingDeleteStudent(null)
    setPickingAvatarFor(null)
    setEditingId(null)
    setGuardOpen(false)
    onClose()
  }

  // Nothing to build while closed - see useLingerWhileClosing. This one built the roster and
  // a month of attendance on every desk tap.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <>
      <Modal
        open={
          open &&
          !confirmingDelete &&
          !confirmingUnseatAll &&
          !confirmingMixUp &&
          !confirmingDeleteStudent &&
          !pickingAvatarFor &&
          !assigningAvatars &&
          !attendanceOpen &&
          !sheetsOpen
        }
        onClose={closeAndReset}
        title="Class Settings"
        wide
        fixedHeight
        // New Class makes another class rather than setting this one, so it sits by the title,
        // on every tab, where it costs the Class tab no row. A new class needs its name first,
        // so it lands on the Class tab, as from the splash. Pulled in top and bottom so the
        // header is no taller than the title.
        headerAction={
          <TactileButton
            onClick={() => {
              onCreateClass()
              setTab('class')
            }}
            disabled={classesCount >= MAX_CLASSES}
            className={clsx('-my-1.5 !py-1.5', classesCount >= MAX_CLASSES && 'opacity-40')}
            title={classesCount >= MAX_CLASSES ? `You can save up to ${MAX_CLASSES} classes` : undefined}
          >
            <Plus size={16} /> New Class
          </TactileButton>
        }
      >
        {/* Closer on a short screen, so the Class tab's room layouts fit on the teacher's own
            board (1280x559) without scrolling inside the window. */}
        <div className="flex min-h-full flex-col gap-3.5 [@media(max-height:600px)]:gap-2.5">
          <SettingsTabs tab={tab} onChange={setTab} />

          {tab === 'students' ? (
            <>
              {/* Manual add - always one row, side by side */}
              <section className="shrink-0">
                <Label className="mb-1.5">Add a Student</Label>
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2">
                  <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Name" className="min-w-0" />
                  <Input
                    value={manualHomeroom}
                    onChange={(e) => setManualHomeroom(e.target.value)}
                    placeholder="Homeroom #"
                    className="min-w-0"
                  />
                  <GenderSelect value={manualGender} onChange={setManualGender} className="min-w-0" />
                  <TactileButton variant="primary" onClick={submitManualAdd} className="whitespace-nowrap">
                    <Plus size={18} /> Add
                  </TactileButton>
                </div>
              </section>

              {/* The roster is what this tab is for, so it takes all the height that's left. A CSV
                  can still be dropped anywhere on it; the Import button is the way on a board. */}
              <section
                className={clsx('flex min-h-[6rem] flex-1 flex-col rounded-2xl transition-shadow', dragOver && 'ring-2 ring-primary')}
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
                <div className="mb-1.5 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <Label className="mb-0">
                    Roster ({activeClass.students.length} {activeClass.students.length === 1 ? 'student' : 'students'})
                  </Label>
                  {activeClass.students.length > MAX_DESKS && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <TriangleAlert size={13} />
                      {activeClass.students.length - MAX_DESKS} more than the {MAX_DESKS} available desks
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    {/* Signed in, Import is a short menu with Google Sheets in it; signed out it
                        is the CSV import it always was. */}
                    {cloud.account ? (
                      <Popover.Root open={importOpen} onOpenChange={setImportOpen}>
                        <Popover.Trigger asChild>
                          <TactileButton className="!py-1.5">
                            <Upload size={16} /> Import <ChevronDown size={14} />
                          </TactileButton>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            align="end"
                            sideOffset={6}
                            className="z-50 flex w-80 flex-col gap-0.5 rounded-2xl border border-black/5 bg-card p-1.5 text-card-foreground shadow-xl dark:border-white/10"
                          >
                            <ImportChoice
                              icon={<GoogleG size={20} />}
                              title="From a Google Sheet"
                              note="A roster sheet in your Drive"
                              onClick={() => openRosterSheets(false)}
                            />
                            <ImportChoice
                              icon={<FileUp size={20} className="text-muted-foreground" />}
                              title="From a CSV file"
                              note="From this computer"
                              onClick={() => {
                                setImportOpen(false)
                                fileInputRef.current?.click()
                              }}
                            />
                            <div className="mx-2 my-1 h-px bg-black/10 dark:bg-white/10" />
                            <ImportChoice
                              icon={<FilePlus2 size={20} className="text-emerald-600" />}
                              title="Make a roster sheet"
                              note="A ready-made Sheet to fill in, then import"
                              onClick={() => openRosterSheets(true)}
                            />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    ) : (
                      <TactileButton
                        onClick={() => fileInputRef.current?.click()}
                        className="!py-1.5"
                        title="Add students from a CSV file with Name, Homeroom Number and Gender columns"
                      >
                        <Upload size={16} /> Import CSV
                      </TactileButton>
                    )}
                    {/* The record, not the register: attendance is taken on the seating chart,
                        with the side panel's button. This is for looking back, fixing a day, or
                        marking someone away ahead of time. */}
                    <TactileButton onClick={() => setAttendanceOpen(true)} className="!py-1.5" title="Who was away, day by day">
                      <ClipboardCheck size={16} /> View / Edit Attendance
                    </TactileButton>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      void handleFiles(e.target.files)
                      // Otherwise choosing the same file again (fixed and saved) does nothing at all.
                      e.target.value = ''
                    }}
                  />
                </div>
                <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-black/10 dark:border-white/10">
                  {activeClass.students.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground">
                      No students yet. Add them above, or tap {cloud.account ? 'Import' : 'Import CSV'}
                      <br />
                      (a file with Name, Homeroom Number and Gender columns).
                    </p>
                  ) : (
                    activeClass.students.map((s) => (
                      <RosterRow
                        key={s.id}
                        student={s}
                        seated={seatedIds.has(s.id)}
                        editing={editingId === s.id}
                        onEdit={() => setEditingId(s.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onSave={(patch) => {
                          onUpdateStudent(s.id, patch)
                          setEditingId(null)
                        }}
                        onDelete={() => setConfirmingDeleteStudent(s)}
                        onUnseat={() => onUnseatStudent(s.id)}
                        onPickAvatar={() => setPickingAvatarFor(s)}
                      />
                    ))
                  )}
                </ScrollArea>
              </section>

              {/* The foot, in the order a new class is set up: the roster above, then everyone's
                  avatars, then seats. Seating, both ways, side by side: they are opposites, and
                  used to sit at opposite ends of this window. Seat Students seats everyone still
                  unseated, then closes. */}
              <section className="flex shrink-0 items-center gap-2">
                <TactileButton
                  onClick={() => setAssigningAvatars(true)}
                  disabled={activeClass.students.length === 0}
                  className={clsx('shrink-0', activeClass.students.length === 0 && 'opacity-40')}
                  title="Choose avatars for the whole class at once"
                >
                  <Smile size={16} /> Student Avatars
                </TactileButton>
                <p className="min-w-0 flex-1 text-sm leading-tight text-muted-foreground">Change every avatar at once</p>
                {/* A new seating plan in one tap, behind a confirm: the plan it replaces can't be
                    brought back. */}
                <TactileButton
                  onClick={() => setConfirmingMixUp(true)}
                  disabled={activeClass.students.length < 2}
                  className={clsx('shrink-0', activeClass.students.length < 2 && 'opacity-40')}
                  title="Give everyone a new, random seat"
                >
                  <Dices size={16} /> Mix Up Seats
                </TactileButton>
                <TactileButton
                  onClick={() => setConfirmingUnseatAll(true)}
                  disabled={seatedIds.size === 0}
                  className={clsx('shrink-0', seatedIds.size === 0 && 'opacity-40')}
                  title="Take every student out of their seat"
                >
                  <UserX size={16} /> Unseat All
                </TactileButton>
                <TactileButton
                  variant="primary"
                  disabled={unseatedCount === 0}
                  className={clsx('shrink-0', unseatedCount === 0 && 'opacity-40')}
                  title="Put every student without a desk into an empty one"
                  onClick={() => {
                    onSeatClass()
                    closeAndReset()
                  }}
                >
                  <GraduationCap size={18} />
                  {unseatedCount === 0 ? 'Seat Students' : `Seat Students (${unseatedCount})`}
                </TactileButton>
              </section>
            </>
          ) : tab === 'class' ? (
            <>
              {/* This class's name and Delete Class share the top row: both are about this class.
                  (New Class, which makes another, is by the window's title.) The name box is
                  narrowed to leave room for the delete cover's note, and the cover sits level
                  with the box's foot, beside the label rather than below it, so the row is no
                  taller than the name. Delete stays behind its cover. */}
              <section className="grid shrink-0 grid-cols-[minmax(0,20rem)_auto] justify-between gap-x-2">
                <Label htmlFor="class-name" className="mb-1.5">
                  Class Name
                </Label>
                <DangerCover
                  open={guardOpen}
                  onOpen={() => setGuardOpen(true)}
                  onAutoClose={() => setGuardOpen(false)}
                  className="col-start-2 row-span-2 row-start-1 self-end"
                  note={['Delete Class…', 'Be careful!']}
                >
                  <TactileButton variant="danger" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 size={16} /> Delete Class
                  </TactileButton>
                </DangerCover>
                <Input
                  id="class-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setNameError(null)
                  }}
                  onBlur={commitRename}
                  className={clsx('col-start-1 font-semibold', nameError && 'border-destructive focus-visible:ring-destructive')}
                />
                {nameError && <p className="col-start-1 mt-1 text-xs font-semibold text-destructive">{nameError}</p>}
              </section>

              <section className="shrink-0">
                <Label className="mb-1.5">
                  Theme <span className="font-normal">(changes every class)</span>
                </Label>
                <ThemePicker theme={theme} onSetTheme={onSetTheme} />
              </section>

              {/* Per class, unlike the theme: classes can meet in different rooms. The homeroom
                  switch shares the heading row, so it costs the tab no height: at 1024x640 a row
                  of its own fell below the window's edge. Off, a number shows only after a name
                  two students share - the app finds them (lib/sameNames). */}
              <section className="shrink-0">
                <div className="mb-1.5 flex items-center gap-3">
                  <Label>
                    Room Layout <span className="font-normal">(this class)</span>
                  </Label>
                  <Label htmlFor="all-homerooms" className="ml-auto cursor-pointer">
                    Homeroom on all desks
                  </Label>
                  <Switch
                    id="all-homerooms"
                    checked={activeClass.showAllHomerooms === true}
                    onCheckedChange={onSetShowAllHomerooms}
                    title={
                      activeClass.showAllHomerooms
                        ? 'Every desk shows its homeroom number.'
                        : 'Only students with the same name show their homeroom number.'
                    }
                  />
                </div>
                <LayoutPicker layout={activeClass.layout ?? 'rows'} onSetLayout={onSetLayout} />
              </section>
            </>
          ) : (
            <GoogleTab activeClass={activeClass} cloud={cloud} onSwitchTeacher={onSwitchTeacher} />
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmingUnseatAll}
        title="Unseat All Students?"
        message={`This will clear every desk in "${activeClass.name}" and move all students back to the unseated list. This can't be undone.`}
        confirmLabel="Yes, Unseat All"
        cancelLabel="No"
        onCancel={() => setConfirmingUnseatAll(false)}
        onConfirm={() => {
          onUnseatAll()
          setConfirmingUnseatAll(false)
        }}
      />

      <ConfirmModal
        open={confirmingMixUp}
        title="Mix Up Seats?"
        message={`Everyone in "${activeClass.name}" gets a new, random seat. The seating plan you have now can't be brought back.`}
        confirmLabel="Yes, Mix Up"
        cancelLabel="No"
        onCancel={() => setConfirmingMixUp(false)}
        onConfirm={() => {
          onMixUpSeats()
          // Closed, so the new plan is the first thing the teacher sees - as Seat Students does.
          closeAndReset()
        }}
      />

      <ConfirmModal
        open={confirmingDeleteStudent !== null}
        title="Remove Student?"
        message={`This will permanently remove "${confirmingDeleteStudent?.name}" from "${activeClass.name}"'s roster${
          confirmingDeleteStudent && seatedIds.has(confirmingDeleteStudent.id) ? ' and their seat' : ''
        }. This can't be undone.`}
        confirmLabel="Remove Student"
        cancelLabel="No"
        onCancel={() => setConfirmingDeleteStudent(null)}
        onConfirm={() => {
          if (confirmingDeleteStudent) onDeleteStudent(confirmingDeleteStudent.id)
          setConfirmingDeleteStudent(null)
        }}
      />

      <ConfirmModal
        open={confirmingDelete}
        title="Delete Class?"
        message={`This will permanently delete "${activeClass.name}" and its entire roster and seating chart. This can't be undone.`}
        confirmLabel="Delete Class"
        requireTypedText={activeClass.name}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          onDeleteClass()
          setConfirmingDelete(false)
          onClose()
        }}
      />

      <AttendanceHistoryModal
        open={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        activeClass={activeClass}
        onToggleAbsent={onToggleAbsentInRecord}
        uid={cloud.account?.uid}
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

      <ClassAvatarsModal
        open={assigningAvatars}
        students={activeClass.students}
        onClose={() => setAssigningAvatars(false)}
        onAssign={onAssignAvatars}
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

/** One line of the Import menu: a big target, with what it does under the title. */
function ImportChoice({ icon, title, note, onClick }: { icon: ReactNode; title: string; note: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl p-2.5 text-left hover:bg-accent active:scale-[0.99]"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="block font-bold text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">{note}</span>
      </span>
    </button>
  )
}

interface RosterRowProps {
  student: Student
  seated: boolean
  editing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (patch: Partial<Omit<Student, 'id'>>) => void
  onDelete: () => void
  onUnseat: () => void
  onPickAvatar: () => void
}

function RosterRow({ student, seated, editing, onEdit, onCancelEdit, onSave, onDelete, onUnseat, onPickAvatar }: RosterRowProps) {
  const [name, setName] = useState(student.name)
  const [homeroom, setHomeroom] = useState(student.homeroom)
  const [gender, setGender] = useState<Gender>(student.gender)
  const [points, setPoints] = useState(String(student.points ?? 0))

  // Cancel throws the edit away, so opening the row again shows the student as they are.
  function cancel() {
    setName(student.name)
    setHomeroom(student.homeroom)
    setGender(student.gender)
    setPoints(String(student.points ?? 0))
    onCancelEdit()
  }

  function save() {
    // A name wiped out by mistake keeps the old one: a desk with no name on it can't be read.
    const kept = name.trim() || student.name
    setName(kept)
    onSave({ name: kept, homeroom: homeroom.trim(), gender, points: Math.max(0, Number(points) || 0) })
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-black/5 p-2 last:border-b-0 dark:border-white/5">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 min-w-[8rem] flex-1" />
        <Input value={homeroom} onChange={(e) => setHomeroom(e.target.value)} className="h-8 w-24" />
        <GenderSelect value={gender} onChange={setGender} className="h-8 w-auto" />
        {/* Editable rather than a reset button: correcting a miscount ("that should be 1,
            not 3") is the case that actually comes up, and typing 0 covers the reset. */}
        <div className="flex items-center gap-1">
          <Star size={14} className="shrink-0 fill-amber-500 text-amber-500" strokeWidth={0} />
          <Input
            value={points}
            onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            title="Stars"
            className="h-8 w-16"
          />
        </div>
        <TactileButton variant="primary" onClick={save}>
          Save
        </TactileButton>
        <TactileButton onClick={cancel}>Cancel</TactileButton>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 border-b border-black/5 p-2 last:border-b-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.04]">
      <button
        type="button"
        onClick={onPickAvatar}
        title="Choose an avatar"
        className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10"
      >
        <img src={resolveAvatarSrc(student)} alt="" draggable={false} className="h-full w-full object-contain select-none" />
      </button>
      <span className="flex-1 truncate font-semibold text-foreground">{student.name}</span>
      {(student.points ?? 0) > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Star size={11} className="shrink-0 fill-amber-500 text-amber-500" strokeWidth={0} />
          {student.points}
        </Badge>
      )}
      <Badge variant="secondary">Room {student.homeroom || '-'}</Badge>
      {seated && (
        <button
          onClick={onUnseat}
          title="Remove from seat"
          className="rounded-full p-1.5 text-neutral-400 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-500/15"
        >
          <Armchair size={16} />
        </button>
      )}
      <button onClick={onEdit} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
        <Pencil size={16} />
      </button>
      <button
        onClick={onDelete}
        className="rounded-full p-1.5 text-neutral-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
