import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2, Upload, UserX } from 'lucide-react'
import clsx from 'clsx'
import { parseRosterCsv } from '../lib/csv'
import type { ClassData, Gender, Student } from '../types'
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
}

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'boy', label: 'Boy' },
  { value: 'girl', label: 'Girl' },
  { value: 'unspecified', label: 'Unspecified' },
]

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
}: ClassSettingsModalProps) {
  const [name, setName] = useState(activeClass.name)
  const [dragOver, setDragOver] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualHomeroom, setManualHomeroom] = useState('')
  const [manualGender, setManualGender] = useState<Gender>('unspecified')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
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
    setDeleteConfirmText('')
    setEditingId(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={closeAndReset} title="Class Settings" wide>
      <div className="flex flex-col gap-6">
        {/* Rename */}
        <section>
          <label className="mb-1 block text-sm font-bold text-neutral-500">Class Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            className="w-full rounded-lg border-2 border-neutral-300 px-3 py-2 text-lg font-semibold outline-none focus:border-indigo-500"
          />
        </section>

        {/* CSV Upload */}
        <section>
          <label className="mb-1 block text-sm font-bold text-neutral-500">Import Roster (CSV)</label>
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
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-4 border-dashed p-6 text-center transition-colors',
              dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100',
            )}
          >
            <Upload className="text-neutral-400" size={28} />
            <p className="font-semibold text-neutral-500">Drag a CSV here or click to choose a file</p>
            <p className="text-xs text-neutral-400">Columns: Student Name, Homeroom Number, Gender</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
        </section>

        {/* Manual add */}
        <section>
          <label className="mb-1 block text-sm font-bold text-neutral-500">Add a Student</label>
          <div className="flex flex-wrap gap-2">
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Name"
              className="min-w-[10rem] flex-1 rounded-lg border-2 border-neutral-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
            <input
              value={manualHomeroom}
              onChange={(e) => setManualHomeroom(e.target.value)}
              placeholder="Homeroom #"
              className="w-32 rounded-lg border-2 border-neutral-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
            <select
              value={manualGender}
              onChange={(e) => setManualGender(e.target.value as Gender)}
              className="rounded-lg border-2 border-neutral-300 px-3 py-2 outline-none focus:border-indigo-500"
            >
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

        {/* Roster list */}
        <section>
          <label className="mb-1 block text-sm font-bold text-neutral-500">
            Roster ({activeClass.students.length} students)
          </label>
          <div className="max-h-56 overflow-y-auto rounded-xl border-2 border-neutral-200">
            {activeClass.students.length === 0 ? (
              <p className="p-4 text-center text-neutral-400">No students yet. Add some above!</p>
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
        <section className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4">
          <TactileButton onClick={onUnseatAll}>
            <UserX size={18} /> Unseat All
          </TactileButton>
          <TactileButton onClick={onCreateClass}>
            <Plus size={18} /> Create New Class
          </TactileButton>
          <div className="ml-auto">
            {!confirmingDelete ? (
              <TactileButton variant="danger" onClick={() => setConfirmingDelete(true)}>
                <Trash2 size={18} /> Delete Class
              </TactileButton>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border-2 border-rose-300 bg-rose-50 p-2">
                <span className="text-sm font-semibold text-rose-700">
                  Type "{activeClass.name}" to confirm:
                </span>
                <input
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-40 rounded-lg border-2 border-rose-300 px-2 py-1 outline-none focus:border-rose-500"
                />
                <TactileButton
                  variant="danger"
                  disabled={deleteConfirmText !== activeClass.name}
                  onClick={() => {
                    onDeleteClass()
                    setConfirmingDelete(false)
                    setDeleteConfirmText('')
                    onClose()
                  }}
                  className={deleteConfirmText !== activeClass.name ? 'opacity-40' : ''}
                >
                  Confirm Delete
                </TactileButton>
                <TactileButton onClick={() => setConfirmingDelete(false)}>Cancel</TactileButton>
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 p-2 last:border-b-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[8rem] flex-1 rounded-lg border-2 border-indigo-300 px-2 py-1 outline-none"
        />
        <input
          value={homeroom}
          onChange={(e) => setHomeroom(e.target.value)}
          className="w-24 rounded-lg border-2 border-indigo-300 px-2 py-1 outline-none"
        />
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender)}
          className="rounded-lg border-2 border-indigo-300 px-2 py-1 outline-none"
        >
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
    <div className="flex items-center gap-2 border-b border-neutral-100 p-2 last:border-b-0 hover:bg-neutral-50">
      <span
        className={clsx(
          'h-2.5 w-2.5 shrink-0 rounded-full',
          student.gender === 'boy' ? 'bg-sky-400' : student.gender === 'girl' ? 'bg-pink-400' : 'bg-slate-400',
        )}
      />
      <span className="flex-1 truncate font-semibold">{student.name}</span>
      <span className="text-sm text-neutral-400">Room {student.homeroom || '-'}</span>
      <button onClick={onEdit} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700">
        <Pencil size={16} />
      </button>
      <button onClick={onDelete} className="rounded-full p-1.5 text-neutral-400 hover:bg-rose-100 hover:text-rose-600">
        <Trash2 size={16} />
      </button>
    </div>
  )
}
