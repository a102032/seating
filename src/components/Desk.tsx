import clsx from 'clsx'
import { Star } from 'lucide-react'
import { resolveAvatarSrc } from '../lib/stickers'
import type { Student } from '../types'
import { AbsentIcon } from './AbsentIcon'

export type DeskHighlight = 'none' | 'flashing' | 'dimmed' | 'winner'

/**
 * Where this desk sits in a points round. 'muted' is the one that carries the selection:
 * the chosen desks are left alone and everything else recedes.
 */
export type DeskPointsState = 'none' | 'selected' | 'landed' | 'muted'

interface DeskProps {
  index: number
  student: Student | undefined
  selected: boolean
  pointsState: DeskPointsState
  /** Delay in ms before this desk's select wiggle, so a whole-class select ripples. */
  wiggleDelayMs: number
  /** Bumped on every award, so a repeat award replays the pop. */
  landedTick: number
  /** Keep shivering: every student is selected, so no dimming can show it. */
  wiggleLoop: boolean
  highlight: DeskHighlight
  /** Marked absent today: the zzz stands in for the avatar, and the desk steps back a little. */
  absent: boolean
  /** Name size in cqi, shared by every desk in the class - see lib/fitText.ts. */
  nameSize: number
  onTap: (index: number) => void
}

export function Desk({ index, student, selected, pointsState, wiggleDelayMs, landedTick, wiggleLoop, highlight, absent, nameSize, onTap }: DeskProps) {
  const empty = !student
  const points = student?.points ?? 0

  return (
    <button
      type="button"
      onClick={() => onTap(index)}
      data-ink={empty ? 'desk-empty' : 'desk'}
      className={clsx(
        // Rounded at the top, square at the bottom, so the desks sit on the grid like objects on a shelf.
        // A hairline and a little lift, not an outline. This was a 2px #1b3a4b - a fixed
        // dark navy that ignored the theme, so on a bright ground it read as thirty
        // near-black boxes. Borderless was tried and fails on the Light theme, where a
        // white desk on a near-white ground loses its edge entirely; a hairline also
        // survives a classroom projector, which washes soft shadows out.
        'group relative flex h-full w-full select-none flex-col items-center overflow-hidden rounded-t-[1.15rem] border p-1 text-center shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] transition-opacity duration-200',
        empty
          ? 'border-border bg-card/40 text-muted-foreground'
          : 'border-[rgba(0,0,0,0.12)] bg-card text-card-foreground dark:border-[rgba(255,255,255,0.16)]',
        // A desk presses in under the finger, so a tap registers before anything else moves.
        !empty && 'active:scale-[0.97]',
        selected && 'ring-4 ring-blue-500 animate-pulse',
        (pointsState === 'muted' || highlight === 'dimmed') && 'desk-muted',
        // Faded, not hidden: the name still has to be read from the back of the room.
        absent && !empty && 'opacity-70',
        pointsState === 'selected' && (wiggleLoop ? 'desk-wiggle-loop' : 'desk-wiggle'),
        pointsState === 'landed' && (landedTick % 2 === 0 ? 'desk-landed-a' : 'desk-landed-b'),
        pointsState === 'landed' && wiggleLoop && 'desk-wiggle-loop',
        // The picked desk (or row) is ringed in the pickers' amber, the colour the group picker
        // and the floating window use too. It had a ring of twinkling stars swirling round it,
        // taken out for the board's sake: six moving, glowing stars per desk, redrawn every
        // frame for as long as the pick stayed up. The flashing desk had a brightness filter
        // for the same reason - the dimmed desks around it already make it stand out.
        // An outline, not a ring: Chalkboard and Comic Book draw their desks with their own
        // box-shadow, which a ring (also a box-shadow) loses to.
        highlight === 'winner' ? 'desk-picked outline-4 outline-solid outline-amber-400' : 'outline-none',
        !empty && 'cursor-pointer',
      )}
      style={{ containerType: 'inline-size', animationDelay: wiggleDelayMs ? `${wiggleDelayMs}ms` : undefined }}
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
            data-ink="homeroom"
            className="absolute left-1.5 top-1 z-10 font-semibold leading-none opacity-45"
            style={{ fontSize: 'clamp(0.55rem, 8cqi, 1rem)' }}
          >
            {student.homeroom}
          </span>

          {points > 0 && (
            <div
              className="absolute right-1 top-1 z-10 flex items-center gap-[0.15em] rounded-full border-[1.5px] border-card-foreground/25 px-[0.45em] py-[0.2em] font-bold leading-none text-card-foreground"
              style={{ fontSize: 'clamp(0.55rem, 7.5cqi, 1rem)' }}
            >
              {/* Sized in em so the star tracks the number as the desk grows - a fixed
                  pixel size drifts away from it on a smartboard. */}
              <Star className="h-[0.85em] w-[0.85em] shrink-0 fill-amber-500 text-amber-500" strokeWidth={0} />
              {points}
            </div>
          )}

          <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
            {absent ? (
              // A little smaller than an avatar, so an absent desk reads as emptier at a glance.
              <AbsentIcon className="h-[78%] w-[78%] text-muted-foreground" />
            ) : (
              <img
                src={resolveAvatarSrc(student)}
                alt=""
                draggable={false}
                className="h-full w-full object-contain select-none pointer-events-none"
              />
            )}
          </div>

          <span
            className="w-full shrink-0 truncate px-1 pb-0.5 font-bold leading-tight"
            // Its own colour token rather than the card's text colour - see --desk-name in
            // index.css. Dark and Comic Book point it back at the card colour.
            style={{ fontSize: `${nameSize}cqi`, color: 'var(--desk-name, var(--card-foreground))' }}
          >
            {student.name}
          </span>
        </>
      )}
    </button>
  )
}
