import { useEffect, useRef, useState } from 'react'
import { Moon, Pencil, Plus, Sun, Trash2, Upload, UserX } from 'lucide-react'
import clsx from 'clsx'
import { parseRosterCsv } from '../lib/csv'
import type { ClassData, Gender, Student } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface ClassSettingsModalProps {
  open: boolean
  onClose: () => void
  activeClass: ClassData
  onRename: (name: string) => void
  onAddStudents: (students: Omit<Student, 'id'>[]) => void
  onUpdateStudent: (studentId: string, patch: Partial<Omit<Student, 'id'>>) => void
  onDeleteStudent: (studentId: string) => void
  onCreateClass: () => void
  onDeleteClass: () => void
  onUnseatAll: () => void
  theme: 'light' | 'dark'
  onSetTheme: (theme: 'light' | 'dark') => void
}

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
  { value: 'unspecified', label: 'Unspecified' },
]

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100'

export function ClassSettingsModal({
  open,
  onClose,
  activeClass,
  onRename,
  onAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onCreateClass,
  onDeleteClass,
  onUnseatAll,
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    onClose()
  }

  return (
    <>
      <Modal open={open && !confirmingDelete && !confirmingUnseatAll} onClose={closeAndReset} title="Class Settings" wide>
        <div className="flex h-full min-h-0 flex-col gap-3.5">
          {/* Appearance + Class Name, sharing a row to save vertical space */}
          <section className="flex shrink-0 flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1">
              <label className="mb-1 block text-sm font-bold text-neutral-500 dark:text-neutral-400">Class Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commitRename} className={clsx(inputClass, 'font-semibold')} />
            </div>
            <div className="flex gap-1 rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.06]">
              <button
                type="button"
                onClick={() => onSetTheme('light')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  theme === 'light' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 dark:text-neutral-400',
                )}
              >
                <Sun size={14} /> Light
              </button>
              <button
                type="button"
                onClick={() => onSetTheme('dark')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  theme === 'dark' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400',
                )}
              >
                <Moon size={14} /> Dark
              </button>
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
                dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-black/15 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]',
              )}
            >
              <Upload className="shrink-0 text-neutral-400" size={20} />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">Import a CSV roster</span> - drag a file here or
                click to choose one (Name, Homeroom Number, Gender)
              </p>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
            </div>
          </section>

          {/* Manual add */}
          <section className="shrink-0">
            <label className="mb-1 block text-sm font-bold text-neutral-500 dark:text-neutral-400">Add a Student</label>
            <div className="flex flex-wrap gap-2">
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Name"
                className={clsx(inputClass, 'min-w-[10rem] flex-1')}
              />
              <input
                value={manualHomeroom}
                onChange={(e) => setManualHomeroom(e.target.value)}
                placeholder="Homeroom #"
                className={clsx(inputClass, 'w-32')}
              />
              <select value={manualGender} onChange={(e) => setManualGender(e.target.value as Gender)} className={clsx(inputClass, 'w-auto')}>
                {genderOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <TactileButton variant="primary" onClick={submitManualAdd}>
                <Plus size={18} /> Add
              </TactileButton>
            </div>
          </section>

          {/* Roster list - the only part of this modal that scrolls */}
          <section className="flex min-h-[11rem] flex-1 flex-col">
            <label className="mb-1 block shrink-0 text-sm font-bold text-neutral-500 dark:text-neutral-400">
              Roster ({activeClass.students.length} students)
            </label>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10">
              {activeClass.students.length === 0 ? (
                <p className="p-4 text-center text-neutral-400 dark:text-neutral-500">No students yet. Add some above!</p>
              ) : (
                activeClass.students.map((s) => (
                  <RosterRow
                    key={s.id}
                    student={s}
                    editing={editingId === s.id}
                    onEdit={() => setEditingId(s.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={(patch) => {
                      onUpdateStudent(s.id, patch)
                      setEditingId(null)
                    }}
                    onDelete={() => onDeleteStudent(s.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Class-level actions */}
          <section className="flex shrink-0 flex-wrap items-center gap-2 border-t border-black/10 pt-4 dark:border-white/10">
            <TactileButton onClick={() => setConfirmingUnseatAll(true)}>
              <UserX size={18} /> Unseat All
            </TactileButton>
            <TactileButton onClick={onCreateClass}>
              <Plus size={18} /> Create New Class
            </TactileButton>
            <TactileButton variant="danger" className="ml-auto" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={18} /> Delete Class
            </TactileButton>
          </section>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmingUnseatAll}
        title="Unseat All Students?"
        message={`This will clear every desk in "${activeClass.name}" and move all students back to the unseated list. This can't be undone.`}
        confirmLabel="Unseat All"
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
  editing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (patch: Partial<Omit<Student, 'id'>>) => void
  onDelete: () => void
}

function RosterRow({ student, editing, onEdit, onCancelEdit, onSave, onDelete }: RosterRowProps) {
  const [name, setName] = useState(student.name)
  const [homeroom, setHomeroom] = useState(student.homeroom)
  const [gender, setGender] = useState<Gender>(student.gender)

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-black/5 p-2 last:border-b-0 dark:border-white/5">
        <input value={name} onChange={(e) => setName(e.target.value)} className={clsx(inputClass, 'min-w-[8rem] flex-1 py-1')} />
        <input value={homeroom} onChange={(e) => setHomeroom(e.target.value)} className={clsx(inputClass, 'w-24 py-1')} />
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={clsx(inputClass, 'w-auto py-1')}>
          {genderOptions.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
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
      <span className="flex-1 truncate font-semibold text-neutral-800 dark:text-neutral-100">{student.name}</span>
      <span className="text-sm text-neutral-400 dark:text-neutral-500">Room {student.homeroom || '-'}</span>
      <button
        onClick={onEdit}
        className="rounded-full p-1.5 text-neutral-400 hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
      >
        <Pencil size={16} />
      </button>
      <button onClick={onDelete} className="rounded-full p-1.5 text-neutral-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15">
        <Trash2 size={16} />
      </button>
    </div>
  )
}
