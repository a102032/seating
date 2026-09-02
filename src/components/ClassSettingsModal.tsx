import { useEffect, useMemo, useRef, useState } from 'react'
import { Armchair, GraduationCap, Pencil, Plus, Trash2, Upload, UserX } from 'lucide-react'
import clsx from 'clsx'
import { parseRosterCsv } from '../lib/csv'
import { MAX_CLASSES } from '../hooks/useClasses'
import type { Theme } from '../lib/theme'
import type { ClassData, Gender, Student } from '../types'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ConfirmModal } from './ConfirmModal'
import { DangerCover } from './DangerCover'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { ThemePicker } from './ThemePicker'

interface ClassSettingsModalProps {
  open: boolean
  onClose: () => void
  activeClass: ClassData
  classesCount: number
  unseatedCount: number
  onRename: (name: string) => void
  onAddStudents: (students: Omit<Student, 'id'>[]) => void
  onUpdateStudent: (studentId: string, patch: Partial<Omit<Student, 'id'>>) => void
  onDeleteStudent: (studentId: string) => void
  onUnseatStudent: (studentId: string) => void
  onCreateClass: () => void
  onDeleteClass: () => void
  onUnseatAll: () => void
  onSeatClass: () => void
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

export function ClassSettingsModal({
  open,
  onClose,
  activeClass,
  classesCount,
  unseatedCount,
  onRename,
  onAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onUnseatStudent,
  onCreateClass,
  onDeleteClass,
  onUnseatAll,
  onSeatClass,
  theme,
  onSetTheme,
}: ClassSettingsModalProps) {
  const [name, setName] = useState(activeClass.name)
  const [dragOver, setDragOver] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualHomeroom, setManualHomeroom] = useState('')
  const [manualGender, setManualGender] = useState<Gender>('unspecified')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingUnseatAll, setConfirmingUnseatAll] = useState(false)
  const [guardOpen, setGuardOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const seatedIds = useMemo(() => new Set(activeClass.seating.filter((s): s is string => s !== null)), [activeClass.seating])

  useEffect(() => {
    setName(activeClass.name)
  }, [activeClass.id, activeClass.name])

  function commitRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== activeClass.name) onRename(trimmed)
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseRosterCsv(text)
    if (parsed.length > 0) onAddStudents(parsed)
  }

  function submitManualAdd() {
    if (!manualName.trim()) return
    onAddStudents([{ name: manualName.trim(), homeroom: manualHomeroom.trim(), gender: manualGender }])
    setManualName('')
    setManualHomeroom('')
    setManualGender('unspecified')
  }

  function closeAndReset() {
    setConfirmingDelete(false)
    setConfirmingUnseatAll(false)
    setEditingId(null)
    setGuardOpen(false)
    onClose()
  }

  return (
    <>
      <Modal open={open && !confirmingDelete && !confirmingUnseatAll} onClose={closeAndReset} title="Class Settings" wide>
        <div className="flex h-full min-h-0 flex-col gap-3.5">
          {/* Class-level actions - up top, away from the roster, so they can't be hit by accident */}
          <section className="flex shrink-0 flex-wrap items-center gap-2">
            <TactileButton onClick={() => setConfirmingUnseatAll(true)}>
              <UserX size={16} /> Unseat All
            </TactileButton>
            <TactileButton
              onClick={onCreateClass}
              disabled={classesCount >= MAX_CLASSES}
              className={classesCount >= MAX_CLASSES ? 'opacity-40' : ''}
              title={classesCount >= MAX_CLASSES ? `You can save up to ${MAX_CLASSES} classes` : undefined}
            >
              <Plus size={16} /> New Class
            </TactileButton>
            <DangerCover open={guardOpen} onOpen={() => setGuardOpen(true)} className="ml-auto">
              <TactileButton variant="danger" onClick={() => setConfirmingDelete(true)}>
                <Trash2 size={16} /> Delete Class
              </TactileButton>
            </DangerCover>
          </section>

          <Separator />

          {/* Class Name + Appearance */}
          <section className="flex shrink-0 flex-wrap items-start gap-3">
            <div className="min-w-[10rem] flex-1">
              <Label htmlFor="class-name" className="mb-1.5">
                Class Name
              </Label>
              <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={commitRename} className="font-semibold" />
            </div>
            <div className="w-full min-w-[18rem] sm:w-auto sm:flex-1">
              <Label className="mb-1.5">Appearance</Label>
              <ThemePicker theme={theme} onSetTheme={onSetTheme} />
            </div>
          </section>

          {/* CSV Upload */}
          <section className="shrink-0">
            <div
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
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-2.5 text-left transition-colors',
                dragOver ? 'border-primary bg-primary/10' : 'border-black/15 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]',
              )}
            >
              <Upload className="shrink-0 text-muted-foreground" size={20} />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Import a CSV roster</span> - drag a file here or
                click to choose one (Name, Homeroom Number, Gender)
              </p>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
            </div>
          </section>

          {/* Manual add - always one row, side by side */}
          <section className="shrink-0">
            <Label className="mb-1.5">Add a Student</Label>
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2">
              <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Name" className="min-w-0" />
              <Input value={manualHomeroom} onChange={(e) => setManualHomeroom(e.target.value)} placeholder="Homeroom #" className="min-w-0" />
              <GenderSelect value={manualGender} onChange={setManualGender} className="min-w-0" />
              <TactileButton variant="primary" onClick={submitManualAdd} className="whitespace-nowrap">
                <Plus size={18} /> Add
              </TactileButton>
            </div>
          </section>

          {/* Roster list - the only part of this modal that scrolls */}
          <section className="flex min-h-[11rem] flex-1 flex-col">
            <Label className="mb-1.5 shrink-0">Roster ({activeClass.students.length} students)</Label>
            <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-black/10 dark:border-white/10">
              {activeClass.students.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground">No students yet. Add some above!</p>
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
                    onDelete={() => onDeleteStudent(s.id)}
                    onUnseat={() => onUnseatStudent(s.id)}
                  />
                ))
              )}
            </ScrollArea>
          </section>

          <Separator />

          {/* Primary action - seats everyone still unseated, then closes */}
          <section className="shrink-0">
            <TactileButton
              variant="primary"
              disabled={unseatedCount === 0}
              className={clsx('w-full', unseatedCount === 0 && 'opacity-40')}
              onClick={() => {
                onSeatClass()
                closeAndReset()
              }}
            >
              <GraduationCap size={18} />
              {unseatedCount === 0 ? 'Seat Students' : `Seat Students (${unseatedCount})`}
            </TactileButton>
          </section>
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
}

function RosterRow({ student, seated, editing, onEdit, onCancelEdit, onSave, onDelete, onUnseat }: RosterRowProps) {
  const [name, setName] = useState(student.name)
  const [homeroom, setHomeroom] = useState(student.homeroom)
  const [gender, setGender] = useState<Gender>(student.gender)

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-black/5 p-2 last:border-b-0 dark:border-white/5">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 min-w-[8rem] flex-1" />
        <Input value={homeroom} onChange={(e) => setHomeroom(e.target.value)} className="h-8 w-24" />
        <GenderSelect value={gender} onChange={setGender} className="h-8 w-auto" />
        <TactileButton variant="primary" onClick={() => onSave({ name, homeroom, gender })}>
          Save
        </TactileButton>
        <TactileButton onClick={onCancelEdit}>Cancel</TactileButton>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 border-b border-black/5 p-2 last:border-b-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.04]">
      <span
        className={clsx(
          'h-2.5 w-2.5 shrink-0 rounded-full',
          student.gender === 'boy' ? 'bg-sky-400' : student.gender === 'girl' ? 'bg-rose-400' : 'bg-slate-400',
        )}
      />
      <span className="flex-1 truncate font-semibold text-foreground">{student.name}</span>
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
      <button onClick={onDelete} className="rounded-full p-1.5 text-neutral-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15">
        <Trash2 size={16} />
      </button>
    </div>
  )
}
