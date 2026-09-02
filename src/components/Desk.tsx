import { useDraggable } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { Student } from '../types'
import { AvatarSparkles } from './AvatarSparkles'

export type DeskHighlight = 'none' | 'flashing' | 'dimmed' | 'winner'

interface DeskProps {
  index: number
  student: Student | undefined
  swapMode: boolean
  selected: boolean
  highlight: DeskHighlight
  onTap: (index: number) => void
}

const genderStyles: Record<string, string> = {
  boy: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-400/10 dark:border-sky-400/25 dark:text-sky-200',
  girl: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-400/10 dark:border-rose-400/25 dark:text-rose-200',
  unspecified: 'bg-secondary border-border text-secondary-foreground',
}

const avatarSrc: Partial<Record<string, string>> = {
  boy: '/avatars/boy.png',
  girl: '/avatars/girl.png',
}

export function Desk({ index, student, swapMode, selected, highlight, onTap }: DeskProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `desk-${index}`,
    data: { type: 'desk', deskIndex: index },
  })

  const { setNodeRef: setDragRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: student ? `student-${student.id}` : `empty-desk-${index}`,
    data: { type: 'student', fromDeskIndex: index, studentId: student?.id ?? null },
    disabled: !student || !swapMode,
  })

  const empty = !student
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <button
      type="button"
      ref={setDropRef}
      onClick={() => onTap(index)}
      className={clsx(
        'group relative flex h-full w-full select-none flex-col items-center justify-center rounded-2xl border p-1 text-center shadow-sm transition-colors duration-150 outline-none',
        empty ? 'bg-card/50 border-border text-muted-foreground' : genderStyles[student.gender],
        isOver && 'ring-4 ring-emerald-400',
        selected && 'ring-4 ring-blue-500 animate-pulse',
        highlight === 'dimmed' && 'opacity-25',
        highlight === 'flashing' && 'brightness-110 saturate-150',
        swapMode && !empty && 'cursor-pointer',
        isDragging && 'opacity-30',
      )}
      style={{ touchAction: 'none' }}
    >
      <div
        ref={setDragRef}
        {...(empty || !swapMode ? {} : listeners)}
        {...(empty || !swapMode ? {} : attributes)}
        style={style}
        className={clsx(
          'flex h-full w-full flex-col items-center justify-center gap-0.5',
          !empty && swapMode && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {student ? (
          <motion.div layout className="flex h-full w-full items-stretch justify-center gap-1" initial={false}>
            {avatarSrc[student.gender] ? (
              <div className="relative flex h-full shrink-0 items-end justify-center" style={{ width: 'clamp(1.4rem, 24%, 3.4rem)' }}>
                {highlight === 'winner' && <AvatarSparkles />}
                <img
                  src={avatarSrc[student.gender]}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-contain object-bottom select-none pointer-events-none"
                />
              </div>
            ) : (
              highlight === 'winner' && <AvatarSparkles />
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
              <span
                className="w-full truncate px-1 font-bold leading-tight"
                style={{ fontSize: 'clamp(1.05rem, 3.4vmin, 2.75rem)' }}
              >
                {student.name}
              </span>
              <span
                className="opacity-70"
                style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 1.35rem)' }}
              >
                {student.homeroom}
              </span>
            </div>
          </motion.div>
        ) : (
          <span
            className="opacity-50"
            style={{ fontSize: 'clamp(0.7rem, 1.6vmin, 1.15rem)' }}
          >
            Empty
          </span>
        )}
      </div>
    </button>
  )
}
