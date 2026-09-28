import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Armchair,
  ClipboardCheck,
  Download,
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
import { parseRosterCsv, studentsToCsv } from '../lib/csv'
import { MAX_CLASSES, type AvatarScope } from '../hooks/useClasses'
import { resolveAvatarSrc } from '../lib/stickers'
import type { Theme } from '../lib/theme'
import { MAX_DESKS, type ClassData, type Gender, type Student } from '../types'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { AvatarPickerModal } from './AvatarPickerModal'
import { AttendanceHistoryModal } from './AttendanceHistoryModal'
import { ClassAvatarsModal } from './ClassAvatarsModal'
import { ConfirmModal } from './ConfirmModal'
import { DangerCover } from './DangerCover'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { ThemePicker } from './ThemePicker'

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
  onToggleAbsentInRecord: (studentId: string, day: string) => void
  theme: Theme
  onSetTheme: (theme: Theme) => void
}

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
  { value: 'unspecified', label: 'Unspecified' },
]

function GenderSelect({ value, onChange, className }: { value: Gender; onChange: (g: Gender) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Gender)}>
      <SelectTrigger className={clsx('w-full', className)}>
        <SelectValue />
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

type SettingsTab = 'students' | 'class'

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: typeof Users }[] = [
  { id: 'students', label: 'Students', icon: Users },
  { id: 'class', label: 'Class', icon: School },
]

/**
 * Two tabs, so each half of this window is about one thing: the students (the roster, their
 * seats, today's attendance) or the class as a whole (its look, and making or deleting it).
 * It was one page, and the roster - the part used most - got a row and a half of it.
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
  onToggleAbsentInRecord,
  theme,
  onSetTheme,
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
  const [confirmingDeleteStudent, setConfirmingDeleteStudent] = useState<Student | null>(null)
  const [pickingAvatarFor, setPickingAvatarFor] = useState<Student | null>(null)
  const [assigningAvatars, setAssigningAvatars] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [guardOpen, setGuardOpen] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('students')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const seatedIds = useMemo(() => new Set(activeClass.seating.filter((s): s is string => s !== null)), [activeClass.seating])

  useEffect(() => {
    setName(activeClass.name)
    setNameError(null)
  }, [activeClass.id, activeClass.name])

  function commitRename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === activeClass.name) {
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

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseRosterCsv(text)
    if (parsed.length > 0) onAddStudents(parsed)
  }

  function downloadRosterCsv() {
    const csv = studentsToCsv(activeClass.students)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeClass.name.trim() || 'roster'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function submitManualAdd() {
    if (!manualName.trim()) return
    onAddStudents([{ name: manualName.trim(), homeroom: manualHomeroom.trim(), gender: manualGender }])
    setManualName('')
    setManualHomeroom('')
    setManualGender('unspecified')
  }

  // Settings always opens on the roster, the part a teacher comes here for most. Reset as it
  // opens, during render, so the Class tab never shows for a frame first.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTab('students')
  }

  function closeAndReset() {
    setConfirmingDelete(false)
    setConfirmingUnseatAll(false)
    setConfirmingDeleteStudent(null)
    setPickingAvatarFor(null)
    setEditingId(null)
    setGuardOpen(false)
    onClose()
  }

  return (
    <>
      <Modal
        open={
          open &&
          !confirmingDelete &&
          !confirmingUnseatAll &&
          !confirmingDeleteStudent &&
          !pickingAvatarFor &&
          !assigningAvatars &&
          !attendanceOpen
        }
        onClose={closeAndReset}
        title="Class Settings"
        wide
        fixedHeight
      >
        <div className="flex min-h-full flex-col gap-3.5">
          <SettingsTabs tab={tab} onChange={setTab} />

          {tab === 'students' ? (
            <>
              {/* The class's name and its attendance sit together, the way they do at the top
                  of the side panel: both are about this class, today. */}
              <section className="flex shrink-0 items-end gap-2">
                <div className="min-w-0 max-w-sm flex-1">
                  <Label htmlFor="class-name" className="mb-1.5">
                    Class Name
                  </Label>
                  <Input
                    id="class-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameError(null)
                    }}
                    onBlur={commitRename}
                    className={clsx('font-semibold', nameError && 'border-destructive focus-visible:ring-destructive')}
                  />
                </div>
                <TactileButton onClick={() => setAttendanceOpen(true)} className="shrink-0" title="Who was away, day by day">
                  <ClipboardCheck size={16} /> Attendance
                </TactileButton>
              </section>
              {nameError && <p className="-mt-2 shrink-0 text-xs font-semibold text-destructive">{nameError}</p>}

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
                  <Label className="mb-0">Roster ({activeClass.students.length} students)</Label>
                  {activeClass.students.length > MAX_DESKS && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <TriangleAlert size={13} />
                      {activeClass.students.length - MAX_DESKS} more than the {MAX_DESKS} available desks
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <TactileButton
                      onClick={() => fileInputRef.current?.click()}
                      className="!py-1.5"
                      title="Add students from a CSV file with Name, Homeroom Number and Gender columns"
                    >
                      <Upload size={16} /> Import CSV
                    </TactileButton>
                    <TactileButton
                      onClick={downloadRosterCsv}
                      disabled={activeClass.students.length === 0}
                      className={clsx('!py-1.5', activeClass.students.length === 0 && 'opacity-40')}
                      title="Download this class's roster as a CSV file - keep a backup, since this app only saves on this device"
                    >
                      <Download size={16} /> Export CSV
                    </TactileButton>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => void handleFiles(e.target.files)}
                  />
                </div>
                <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-black/10 dark:border-white/10">
                  {activeClass.students.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground">
                      No students yet. Add them above, or tap Import CSV
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

              {/* Seating, both ways, side by side: they are opposites, and used to sit at opposite
                  ends of this window. Seat Students seats everyone still unseated, then closes. */}
              <section className="flex shrink-0 gap-2">
                <TactileButton
                  onClick={() => setConfirmingUnseatAll(true)}
                  disabled={seatedIds.size === 0}
                  className={clsx('shrink-0', seatedIds.size === 0 && 'opacity-40')}
                >
                  <UserX size={16} /> Unseat All
                </TactileButton>
                <TactileButton
                  variant="primary"
                  disabled={unseatedCount === 0}
                  className={clsx('flex-1', unseatedCount === 0 && 'opacity-40')}
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
          ) : (
            <>
              <section className="shrink-0">
                <Label className="mb-1.5">
                  Theme <span className="font-normal">(changes every class)</span>
                </Label>
                <div className="max-w-xl">
                  <ThemePicker theme={theme} onSetTheme={onSetTheme} />
                </div>
              </section>

              <section className="shrink-0">
                <Label className="mb-1.5">Avatars</Label>
                <TactileButton onClick={() => setAssigningAvatars(true)} disabled={activeClass.students.length === 0}>
                  <Smile size={16} /> Class Avatars
                </TactileButton>
              </section>

              {/* Making and deleting classes, at the foot of the tab and apart from everything
                  else, so the delete cover has room for its note. */}
              <section className="mt-auto flex shrink-0 flex-col gap-3.5">
                <Separator />
                <div className="flex items-center gap-2">
                  <TactileButton
                    onClick={onCreateClass}
                    disabled={classesCount >= MAX_CLASSES}
                    className={classesCount >= MAX_CLASSES ? 'opacity-40' : ''}
                    title={classesCount >= MAX_CLASSES ? `You can save up to ${MAX_CLASSES} classes` : undefined}
                  >
                    <Plus size={16} /> New Class
                  </TactileButton>
                  <DangerCover
                    open={guardOpen}
                    onOpen={() => setGuardOpen(true)}
                    onAutoClose={() => setGuardOpen(false)}
                    className="ml-auto"
                    note={['Delete Class…', 'Be careful!']}
                  >
                    <TactileButton variant="danger" onClick={() => setConfirmingDelete(true)}>
                      <Trash2 size={16} /> Delete Class
                    </TactileButton>
                  </DangerCover>
                </div>
              </section>
            </>
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
        <TactileButton variant="primary" onClick={() => onSave({ name, homeroom, gender, points: Math.max(0, Number(points) || 0) })}>
          Save
        </TactileButton>
        <TactileButton onClick={onCancelEdit}>Cancel</TactileButton>
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
