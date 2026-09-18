import clsx from 'clsx'
import { Star } from 'lucide-react'
import { resolveAvatarSrc } from '../lib/avatarLibrary'
import type { Student } from '../types'
import { AvatarSparkles } from './AvatarSparkles'

export type DeskHighlight = 'none' | 'flashing' | 'dimmed' | 'winner'

interface DeskProps {
  index: number
  student: Student | undefined
  selected: boolean
  pointsSelected: boolean
  highlight: DeskHighlight
  onTap: (index: number) => void
}

const genderStyles: Record<string, string> = {
  boy: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-400/10 dark:border-sky-400/25 dark:text-sky-200',
  girl: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-400/10 dark:border-rose-400/25 dark:text-rose-200',
  unspecified: 'bg-secondary border-border text-secondary-foreground',
}

export function Desk({ index, student, selected, pointsSelected, highlight, onTap }: DeskProps) {
  const empty = !student
  const avatarSrc = student ? resolveAvatarSrc(student) : undefined
  const points = student?.points ?? 0

  return (
    <button
      type="button"
      onClick={() => onTap(index)}
      className={clsx(
        'group relative flex h-full w-full select-none flex-col items-center justify-center rounded-2xl border p-1 text-center shadow-sm transition-colors duration-150 outline-none',
        empty ? 'bg-card/50 border-border text-muted-foreground' : genderStyles[student.gender],
        selected && 'ring-4 ring-blue-500 animate-pulse',
        pointsSelected && !selected && 'ring-4 ring-emerald-500',
        highlight === 'dimmed' && 'opacity-25',
        highlight === 'flashing' && 'brightness-110 saturate-150',
        !empty && 'cursor-pointer',
      )}
      style={{ containerType: 'inline-size' }}
    >
      {!empty && points > 0 && (
        <div
          className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 font-bold text-amber-950 shadow-sm"
          style={{ fontSize: 'clamp(0.6rem, 5.5cqi, 0.95rem)' }}
        >
          <Star size={10} className="shrink-0 fill-amber-950" />
          {points}
        </div>
      )}
      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
        {student ? (
          <div className="flex h-full w-full items-stretch justify-center gap-1">
            {avatarSrc ? (
              <div
                className="relative flex h-full shrink-0 items-center justify-center"
                style={{ width: 'clamp(1.4rem, 28%, 3.6rem)' }}
              >
                {highlight === 'winner' && <AvatarSparkles />}
                <div className="h-full w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10">
                  <img
                    src={avatarSrc}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-contain select-none pointer-events-none"
                  />
                </div>
              </div>
            ) : (
              highlight === 'winner' && <AvatarSparkles />
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
              <span
                className="w-full truncate px-1 font-bold leading-tight"
                style={{ fontSize: 'clamp(0.8rem, 9cqi, 1.9rem)' }}
              >
                {student.name}
              </span>
              <span
                className="opacity-70"
                style={{ fontSize: 'clamp(0.65rem, 5cqi, 1.15rem)' }}
              >
                {student.homeroom}
              </span>
            </div>
          </div>
        ) : (
          <span
            className="opacity-50"
            style={{ fontSize: 'clamp(0.7rem, 6cqi, 1.15rem)' }}
          >
            Empty
          </span>
        )}
      </div>
    </button>
  )
}
