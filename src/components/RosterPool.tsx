import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import clsx from 'clsx'
import type { Student } from '../types'

interface RosterChipProps {
  student: Student
  draggable: boolean
}

const genderDot: Record<string, string> = {
  boy: 'bg-sky-400',
  girl: 'bg-rose-400',
  unspecified: 'bg-slate-400',
}

function RosterChip({ student, draggable }: RosterChipProps) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `student-${student.id}`,
    data: { type: 'student', fromDeskIndex: null, studentId: student.id },
    disabled: !draggable,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      style={{ ...style, touchAction: 'none' }}
      className={clsx(
        'flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 shadow-sm dark:border-white/10 dark:bg-neutral-800',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      <span className={clsx('h-3 w-3 rounded-full', genderDot[student.gender])} />
      <span className="whitespace-nowrap font-semibold text-neutral-800 dark:text-neutral-100" style={{ fontSize: 'clamp(0.8rem, 1.6vmin, 1.1rem)' }}>
        {student.name}
      </span>
      <span className="whitespace-nowrap text-neutral-400 dark:text-neutral-500" style={{ fontSize: 'clamp(0.65rem, 1.2vmin, 0.9rem)' }}>
        Rm {student.homeroom}
      </span>
    </div>
  )
}

interface RosterPoolProps {
  students: Student[]
  open: boolean
  onToggle: () => void
  swapMode: boolean
}

export function RosterPool({ students, open, onToggle, swapMode }: RosterPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'roster-pool', data: { type: 'roster-pool' }, disabled: !swapMode })

  return (
    <div
      className={clsx(
        'flex shrink-0 flex-col rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-black/5 backdrop-blur-xl backdrop-saturate-150 transition-all duration-200 dark:border-white/10 dark:bg-neutral-900/60 dark:shadow-black/20',
        open ? 'h-[18vh]' : 'h-12',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-center gap-2 rounded-2xl py-1.5 font-semibold text-neutral-600 hover:bg-black/[0.04] active:scale-[0.99] dark:text-neutral-300 dark:hover:bg-white/[0.06]"
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
            <p className="w-full text-center text-neutral-400 dark:text-neutral-500">
              {swapMode ? 'Everyone has a seat! Drag a student here to unseat them.' : 'Everyone has a seat!'}
            </p>
          ) : (
            students.map((s) => <RosterChip key={s.id} student={s} draggable={swapMode} />)
          )}
        </div>
      )}
    </div>
  )
}
