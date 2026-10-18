import clsx from 'clsx'
import { Star } from 'lucide-react'
import { HOMEROOM_TAG_SCALE, NAME_FLOOR_PX, NAME_UNDER_PICTURE } from '../lib/fitText'
import type { LineMark } from '../lib/line'
import { hasNoPicture } from '../lib/stickers'
import type { Student } from '../types'
import { AbsentIcon } from './AbsentIcon'
import { DoneIcon } from './DoneIcon'
import { StudentPicture } from './StudentPicture'

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
  /** Some desks in the class have a picture, so every name is the smaller size the pictures leave. */
  mixedClass: boolean
  /** Another student in the class has the same name, so the homeroom number tells them apart. */
  showHomeroom: boolean
  /** Show the stars waiting on the desk, in a class that puts them there first - see starsOnDesks in types.ts. */
  showStars: boolean
  /**
   * The Line (lib/line): this student's place in line, shown big on their desk so they can see it
   * from their seat (1 while they are with the teacher, ringed in green); the steps of the task
   * checked so far, as dots; or Done once every step is, in place of their picture.
   */
  lineMark?: LineMark
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
  mixedClass,
  showHomeroom,
  showStars,
  lineMark,
  onTap,
}: DeskProps) {
  const empty = !student
  const points = student?.points ?? 0
  // A finished desk in the Line shows Done big, where a picture would be, even while the Line shows names only.
  const nameOnly = student !== undefined && hasNoPicture(student) && lineMark !== 'done'
  const linePlace = typeof lineMark === 'object' && 'place' in lineMark ? lineMark : undefined
  const lineSteps = typeof lineMark === 'object' ? ('checked' in lineMark ? lineMark : lineMark.steps) : undefined
  // The room above a centred name: from near the desk's top down to just above the name's
  // capitals, which start about a third of the name's size above the middle.
  // A name under a picture is about two thirds of the size that fits the desk's width, so the
  // picture above it has the room (the beta testers, 2026-10-14: the avatars were too small to
  // see from the back, and the name took more of the desk than the picture). It never goes under
  // NAME_FLOOR_PX, which still reads from the back, nor over the size that fits, so no name is cut.
  const nameUnderPicture = `min(${nameSize}cqi, max(${(nameSize * NAME_UNDER_PICTURE).toFixed(2)}cqi, ${NAME_FLOOR_PX}px))`
  // In a class with some avatars every name is one size, so a no-avatar desk takes the smaller
  // size too; in a class of names only the name has the whole desk and can be big.
  const nameFont = `min(${mixedClass ? nameUnderPicture : `${nameSize}cqi`}, ${nameHeightCap}cqb)`
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
        // Faint, with no outline or shadow (2026-10-14, the beta testers): the avatar and the
        // name are what the room reads, and white tiles with a hairline round each got in their
        // way. It was a hairline and a little lift, and before that a 2px fixed navy that read as
        // thirty near-black boxes. The colour is --desk-bg (index.css): a third of the card's
        // colour, or on Light a soft grey, since a faint white desk vanishes on its white board.
        'group relative flex h-full w-full select-none flex-col items-center overflow-hidden rounded-t-[1.15rem] p-1 text-center transition-opacity duration-200',
        empty ? 'bg-[var(--desk-empty-bg)] text-muted-foreground' : 'bg-[var(--desk-bg)] text-card-foreground',
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
        highlight === 'winner'
          ? 'desk-picked outline-4 outline-solid outline-amber-400'
          : // With the teacher (the Line): ringed in green, which pulses a few times as they are
            // called and then holds still, so a child at their seat sees it is their turn.
            typeof lineMark === 'object' && 'place' in lineMark && lineMark.now
            ? 'desk-called outline-4 outline-solid outline-emerald-500'
            : 'outline-none',
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

          {(lineSteps || linePlace) && (
            // The Line's marks, in the top corner the stars leave free: their place in line, and beside
            // it the steps of their task, so a child waiting still sees which step they brought.
            <div className="absolute left-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] items-start gap-[0.25rem]">
              {linePlace && (
                // Their place in line: big enough to read from their own seat, and counting down as the
                // line moves. With the teacher it is 1, in the ring's green, until they are done or
                // back in their seat.
                <div
                  data-line-mark={linePlace.place}
                  className={clsx(
                    'grid min-w-[1.6em] shrink-0 place-items-center rounded-full px-[0.35em] py-[0.1em] font-bold leading-none shadow-md tabular-nums',
                    linePlace.now ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground',
                  )}
                  style={{ fontSize: 'clamp(0.8rem, 14cqi, 1.75rem)' }}
                >
                  {linePlace.place}
                </div>
              )}
              {lineSteps && (
                // The steps of the task checked so far (●●○○○): read from across the room without
                // reading a word, and by the teacher as where everyone is. Green for a step done, amber
                // for the one they are working on, hollow for one not reached yet (2026-10-16, the
                // teacher). Beside the dots, quietly, the name of the step they are on (a saved
                // line's): not bold and not coloured, since thirty names in a bright colour drew the
                // eye from the students' own, and up here it leaves the foot of the desk to the
                // homeroom number. Beside the dots while the desk has room; on a narrow desk (a big
                // class on a small screen) the name goes under them, so it is never cut.
                <div
                  data-line-steps={lineSteps.checked}
                  className="flex min-w-0 flex-wrap items-center gap-x-[0.2em] gap-y-[0.15em] px-[0.15em] py-[0.2em]"
                  style={{ fontSize: 'clamp(0.6rem, 8.5cqi, 1.15rem)' }}
                >
                  {Array.from({ length: lineSteps.of }, (_, i) => (
                    <span
                      key={i}
                      data-step-dot={i < lineSteps.checked ? 'done' : i === lineSteps.checked ? 'now' : 'ahead'}
                      className={clsx(
                        'block size-[0.8em] shrink-0 rounded-full border-[0.15em]',
                        i < lineSteps.checked
                          ? 'border-emerald-600 bg-emerald-500'
                          : i === lineSteps.checked
                            ? 'border-amber-600 bg-amber-500'
                            : 'border-slate-400 bg-transparent',
                      )}
                    />
                  ))}
                  {lineSteps.step && (
                    <span
                      data-line-step-name=""
                      className="ml-[0.15em] min-w-0 truncate pr-[0.2em] font-normal leading-[1.15] text-muted-foreground"
                      // As big as the room beside the number allows, so a long name is whole.
                      style={{
                        fontSize: `min(0.9em, calc((100cqi - 1.2rem${linePlace ? ' - 26cqi' : ''}) / ${(lineSteps.step.length * 0.52).toFixed(2)}))`,
                      }}
                    >
                      {lineSteps.step}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {nameOnly ? (
            // No avatar: the name alone, in the middle of the desk, so the names line up across a
            // row whether or not a homeroom number hangs under one. The number shows where it
            // always would (two students sharing a name, or the switch), under the name rather
            // than after it. Away today: a small zzz above the name, and the desk fades as any does.
            <>
              {absent ? (
                // As big as the room above the centred name allows, and never more than a third of the desk.
                <AbsentIcon
                  className="absolute left-1/2 top-[3cqb] -translate-x-1/2 text-muted-foreground"
                  style={{ height: nameOnlyZzz, width: nameOnlyZzz }}
                />
              ) : null}
              <div
                // Below the Line's marks, which can take two lines across the top (a number, then the
                // dots and the step's name), so they never sit on the name.
                className={clsx('flex min-h-0 w-full flex-1 items-center justify-center', lineSteps && 'pt-[24cqb]')}
              >
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
                ) : lineMark === 'done' ? (
                  // Done, in place of their picture (2026-10-15, the teacher), until they get in line again.
                  <DoneIcon className="h-full w-full" />
                ) : (
                  <StudentPicture student={student} className="h-full w-full object-contain select-none pointer-events-none" />
                )}
              </div>

              <span
                className="w-full shrink-0 truncate px-1 pb-0.5 font-bold leading-[1.1]"
                // Its own colour token rather than the card's text colour - see --desk-name in
                // index.css. Dark and Comic Book point it back at the card colour.
                style={{ fontSize: nameUnderPicture, color: 'var(--desk-name, var(--card-foreground))' }}
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
