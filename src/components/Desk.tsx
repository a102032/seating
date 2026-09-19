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
  /** Name size in cqi, shared by every desk in the class - see lib/fitText.ts. */
  nameSize: number
  onTap: (index: number) => void
}

export function Desk({ index, student, selected, pointsSelected, highlight, nameSize, onTap }: DeskProps) {
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
          {/* Both corners sit over the avatar's empty top corners, leaving the whole
              bottom row to the name. */}
          <span
            className="absolute left-1.5 top-1 z-10 font-semibold leading-none opacity-45"
            style={{ fontSize: 'clamp(0.55rem, 8cqi, 1rem)' }}
          >
            {student.homeroom}
          </span>

          {points > 0 && (
            <div
              className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 font-bold leading-none text-amber-950 shadow-sm"
              style={{ fontSize: 'clamp(0.55rem, 7.5cqi, 1rem)' }}
            >
              <Star size={9} className="shrink-0 fill-amber-950" strokeWidth={0} />
              {points}
            </div>
          )}

          <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
            {highlight === 'winner' && <AvatarSparkles />}
            <img
              src={resolveAvatarSrc(student)}
              alt=""
              draggable={false}
              className="h-full w-full object-contain select-none pointer-events-none"
            />
          </div>

          <span
            className="w-full shrink-0 truncate px-1 pb-0.5 font-bold leading-tight"
            style={{ fontSize: `${nameSize}cqi` }}
          >
            {student.name}
          </span>
        </>
      )}
    </button>
  )
}
