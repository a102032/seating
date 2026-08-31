import { useDraggable } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { Student } from '../types'

export type DeskHighlight = 'none' | 'flashing' | 'winner' | 'dimmed'

interface DeskProps {
  index: number
  student: Student | undefined
  swapMode: boolean
  selected: boolean
  highlight: DeskHighlight
  onTap: (index: number) => void
}

const genderStyles: Record<string, string> = {
  boy: 'bg-sky-200 border-sky-400 text-sky-950',
  girl: 'bg-pink-200 border-pink-400 text-pink-950',
  unspecified: 'bg-slate-200 border-slate-400 text-slate-900',
}

export function Desk({ index, student, swapMode, selected, highlight, onTap }: DeskProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `desk-${index}`,
    data: { type: 'desk', deskIndex: index },
  })

  const { setNodeRef: setDragRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: student ? `student-${student.id}` : `empty-desk-${index}`,
    data: { type: 'student', fromDeskIndex: index, studentId: student?.id ?? null },
    disabled: !student,
  })

  const empty = !student
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <button
      type="button"
      ref={setDropRef}
      onClick={() => onTap(index)}
      className={clsx(
        'group relative flex h-full w-full select-none flex-col items-center justify-center rounded-xl border-4 p-1 text-center shadow-sm transition-colors duration-150 outline-none',
        empty ? 'bg-neutral-200 border-neutral-300 text-neutral-500' : genderStyles[student.gender],
        isOver && 'ring-4 ring-emerald-400',
        selected && 'ring-4 ring-amber-400 animate-pulse',
        highlight === 'dimmed' && 'opacity-25',
        highlight === 'flashing' && 'brightness-125 saturate-150',
        highlight === 'winner' && 'ring-8 ring-yellow-300 scale-105 z-10 shadow-2xl',
        swapMode && !empty && 'cursor-pointer',
        isDragging && 'opacity-30',
      )}
      style={{ touchAction: 'none' }}
    >
      <div
        ref={setDragRef}
        {...(empty ? {} : listeners)}
        {...(empty ? {} : attributes)}
        style={style}
        className={clsx('flex h-full w-full flex-col items-center justify-center gap-0.5', !empty && 'cursor-grab active:cursor-grabbing')}
      >
        {student ? (
          <motion.div
            layout
            className="flex w-full flex-col items-center justify-center"
            initial={false}
          >
            <span
              className="w-full truncate px-1 font-bold leading-tight"
              style={{ fontSize: 'clamp(0.7rem, 2.3vmin, 1.9rem)' }}
            >
              {student.name}
            </span>
            <span
              className="opacity-70"
              style={{ fontSize: 'clamp(0.55rem, 1.2vmin, 1rem)' }}
            >
              Room {student.homeroom}
            </span>
          </motion.div>
        ) : (
          <span
            className="opacity-50"
            style={{ fontSize: 'clamp(0.6rem, 1.5vmin, 1.1rem)' }}
          >
            Empty
          </span>
        )}
      </div>
    </button>
  )
}
