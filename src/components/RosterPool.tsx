import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import clsx from 'clsx'
import type { Student } from '../types'

interface RosterChipProps {
  student: Student
}

const genderDot: Record<string, string> = {
  boy: 'bg-sky-400',
  girl: 'bg-pink-400',
  unspecified: 'bg-slate-400',
}

function RosterChip({ student }: RosterChipProps) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { type: 'student', fromDeskIndex: null, studentId: student.id },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ ...style, touchAction: 'none' }}
      className={clsx(
        'flex shrink-0 cursor-grab items-center gap-2 rounded-full border-2 border-neutral-300 bg-white px-4 py-2 shadow active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      <span className={clsx('h-3 w-3 rounded-full', genderDot[student.gender])} />
      <span className="whitespace-nowrap font-semibold" style={{ fontSize: 'clamp(0.8rem, 1.6vmin, 1.1rem)' }}>
        {student.name}
      </span>
      <span className="whitespace-nowrap text-neutral-400" style={{ fontSize: 'clamp(0.65rem, 1.2vmin, 0.9rem)' }}>
        Rm {student.homeroom}
      </span>
    </div>
  )
}

interface RosterPoolProps {
  students: Student[]
  open: boolean
  onToggle: () => void
}

export function RosterPool({ students, open, onToggle }: RosterPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'roster-pool', data: { type: 'roster-pool' } })

  return (
    <div
      className={clsx(
        'flex shrink-0 flex-col rounded-t-2xl border-t-4 border-neutral-300 bg-neutral-100 shadow-inner transition-all duration-200',
        open ? 'h-[18vh]' : 'h-12',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-center gap-2 rounded-t-2xl py-1.5 font-bold text-neutral-600 hover:bg-neutral-200 active:scale-[0.99]"
      >
        <Users size={18} />
        <span>Unseated Students ({students.length})</span>
        {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>
      {open && (
        <div
          ref={setNodeRef}
          className={clsx(
            'flex flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-3 pb-2',
            isOver && 'ring-4 ring-inset ring-emerald-400',
          )}
        >
          {students.length === 0 ? (
            <p className="w-full text-center text-neutral-400">Everyone has a seat! Drag a student here to unseat them.</p>
          ) : (
            students.map((s) => <RosterChip key={s.id} student={s} />)
          )}
        </div>
      )}
    </div>
  )
}
