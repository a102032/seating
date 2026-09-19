import clsx from 'clsx'
import { Star } from 'lucide-react'
import { resolveAvatarSrc } from '../lib/stickers'
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

export function Desk({ index, student, selected, pointsSelected, highlight, onTap }: DeskProps) {
  const empty = !student
  const points = student?.points ?? 0

  return (
    <button
      type="button"
      onClick={() => onTap(index)}
      className={clsx(
        // Rounded at the top, square at the bottom, so the desks sit on the grid like objects on a shelf.
        'group relative flex h-full w-full select-none flex-col items-center overflow-hidden rounded-t-[1.15rem] border-2 p-1 text-center shadow-sm transition-colors duration-150 outline-none',
        empty ? 'border-border bg-card/40 text-muted-foreground' : 'border-[#1b3a4b] bg-card text-card-foreground dark:border-white/25',
        selected && 'ring-4 ring-blue-500 animate-pulse',
        pointsSelected && !selected && 'ring-4 ring-emerald-500',
        highlight === 'dimmed' && 'opacity-25',
        highlight === 'flashing' && 'brightness-110 saturate-150',
        !empty && 'cursor-pointer',
      )}
      style={{ containerType: 'inline-size' }}
    >
      {empty ? (
        <span className="m-auto opacity-50" style={{ fontSize: 'clamp(0.7rem, 6cqi, 1.15rem)' }}>
          Empty
        </span>
      ) : (
        <>
          {points > 0 && (
            <div
              className="absolute bottom-1 right-1 z-10 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 font-bold text-amber-950 shadow-sm"
              style={{ fontSize: 'clamp(0.6rem, 5.5cqi, 0.95rem)' }}
            >
              <Star size={10} className="shrink-0 fill-amber-950" strokeWidth={0} />
              {points}
            </div>
          )}

          <div className="relative flex min-h-0 w-full flex-[3] items-center justify-center">
            {highlight === 'winner' && <AvatarSparkles />}
            <img
              src={resolveAvatarSrc(student)}
              alt=""
              draggable={false}
              className="h-full w-full object-contain select-none pointer-events-none"
            />
          </div>

          <div className="flex w-full shrink-0 flex-col items-center justify-center pb-0.5">
            <span className="w-full truncate px-1 font-bold leading-tight" style={{ fontSize: 'clamp(0.8rem, 10cqi, 1.6rem)' }}>
              {student.name}
            </span>
            <span className="opacity-60" style={{ fontSize: 'clamp(0.6rem, 6cqi, 1.05rem)' }}>
              {student.homeroom}
            </span>
          </div>
        </>
      )}
    </button>
  )
}
