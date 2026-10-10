import clsx from 'clsx'
import { Star } from 'lucide-react'
import { HOMEROOM_TAG_SCALE } from '../lib/fitText'
import { hasNoAvatar, resolveAvatarSrc } from '../lib/stickers'
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
  /**
   * The most a no-avatar desk's name may be, in cqb (a share of the desk's height), shared by
   * the class: the name sits in the middle and the homeroom number, where one shows, hangs
   * under it, so a short desk must still have room below the name.
   */
  nameHeightCap: number
  /** Another student in the class has the same name, so the homeroom number tells them apart. */
  showHomeroom: boolean
  /** Show the stars waiting on the desk, in a class that puts them there first - see starsOnDesks in types.ts. */
  showStars: boolean
  onTap: (index: number) => void
}

export function Desk({
  index,
  student,
  selected,
  pointsState,
  wiggleDelayMs,
  landedTick,
  wiggleLoop,
  highlight,
  absent,
  nameSize,
  nameHeightCap,
  showHomeroom,
  showStars,
  onTap,
}: DeskProps) {
  const empty = !student
  const points = student?.points ?? 0
  const nameOnly = student !== undefined && hasNoAvatar(student)
  // The room above a centred name: from near the desk's top down to just above the name's
  // capitals, which start about a third of the name's size above the middle.
  const nameFont = `min(${nameSize}cqi, ${nameHeightCap}cqb)`
  const nameOnlyZzz = `min(34cqb, calc(47cqb - 0.44 * ${nameFont}))`

  return (
    <button
      type="button"
      onClick={() => onTap(index)}
      data-ink={empty ? 'desk-empty' : 'desk'}
      // Where a star flies from when this student gets a point (lib/starFlight).
      data-star-from={student?.id}
      aria-label={empty ? 'Empty desk' : undefined}
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
        // Ghosted, not hidden: the name can still be read, but an absent desk must not pass
        // for a present one at a glance (it was at 70% and did).
        absent && !empty && 'desk-absent',
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
      // A no-avatar desk measures its height too (cqb), to keep its centred name inside it.
      style={{ containerType: nameOnly ? 'size' : 'inline-size', animationDelay: wiggleDelayMs ? `${wiggleDelayMs}ms` : undefined }}
    >
      {/* An empty desk is just the faded tile. It said "Empty", on every empty desk, which
          was one more word on a board already full of names. */}
      {empty ? null : (
        <>
          {/* The stars sit over the avatar's empty top corner, leaving the whole bottom row
              to the name. The homeroom number sat in the other corner on every desk; it is
              after the name now, and only where two students share one (lib/sameNames). */}
          {showStars && points > 0 && (
            // The stars waiting on this desk for All Stars In! (a class that puts them on the
            // desks first). A filled amber chip, big enough to count from the back of the room -
            // the class is meant to see them - and it pops when a star lands or goes. Keyed on
            // the count, so every change replays the pop.
            <div
              key={points}
              className="count-pop absolute right-1 top-1 z-10 flex items-center gap-[0.15em] rounded-full bg-amber-400 px-[0.45em] py-[0.15em] font-bold leading-none text-amber-950 shadow-sm"
              style={{ fontSize: 'clamp(0.7rem, 11cqi, 1.5rem)' }}
            >
              {/* Sized in em so the star tracks the number as the desk grows - a fixed
                  pixel size drifts away from it on a smartboard. */}
              <Star className="h-[0.85em] w-[0.85em] shrink-0 fill-amber-950" strokeWidth={0} />
              {points}
            </div>
          )}

          {nameOnly ? (
            // No avatar: the name alone, in the middle of the desk, so the names line up across a
            // row whether or not a homeroom number hangs under one. The number shows where it
            // always would (two students sharing a name, or the switch), under the name rather
            // than after it. Away today: a small zzz above the name, and the desk fades as any does.
            <>
              {absent && (
                // As big as the room above the centred name allows, and never more than a third of the desk.
                <AbsentIcon
                  className="absolute left-1/2 top-[3cqb] -translate-x-1/2 text-muted-foreground"
                  style={{ height: nameOnlyZzz, width: nameOnlyZzz }}
                />
              )}
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <span
                  className="relative block w-full px-1 font-bold leading-tight"
                  style={{ fontSize: nameFont, color: 'var(--desk-name, var(--card-foreground))' }}
                >
                  <span className="block truncate">{student.name}</span>
                  {showHomeroom && (
                    <span
                      data-ink="homeroom"
                      // Only as tall as its digits, so the name above it can be bigger.
                      className="absolute inset-x-0 top-full block truncate font-semibold leading-none opacity-50"
                      style={{ fontSize: `${HOMEROOM_TAG_SCALE}em` }}
                    >
                      {student.homeroom}
                    </span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
                {absent ? (
                  // A little smaller than an avatar, so an absent desk reads as emptier at a glance.
                  <AbsentIcon className="h-[78%] w-[78%] text-muted-foreground" />
                ) : (
                  <img
                    src={resolveAvatarSrc(student) ?? undefined}
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
                {showHomeroom && (
                  <span
                    data-ink="homeroom"
                    className="ml-[0.25em] font-semibold opacity-50"
                    style={{ fontSize: `${HOMEROOM_TAG_SCALE}em` }}
                  >
                    {student.homeroom}
                  </span>
                )}
              </span>
            </>
          )}
        </>
      )}
    </button>
  )
}
