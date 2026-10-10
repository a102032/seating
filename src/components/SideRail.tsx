import clsx from 'clsx'
import { ArrowLeftRight, Check, Minus, PictureInPicture2, TriangleAlert } from 'lucide-react'
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useFitToHeight } from '../hooks/useFitToHeight'
import { timer, useTimer } from '../hooks/useTimer'
import type { useCloudSync } from '../hooks/useCloudSync'
import { assetUrl } from '../lib/assets'
import { SyncMark } from './Account'
import {
  AllIcon,
  FromGroupIcon,
  FromRowIcon,
  FromTableIcon,
  NoneIcon,
  PickGroupIcon,
  PickRowIcon,
  PickStudentIcon,
  PickTableIcon,
  WholeRowIcon,
  WholeTableIcon,
} from './PickerIcons'
import { AttendanceIcon, DrumIcon, FlipIcon, GroupIcon, HourglassIcon, PointIcon, SwapIcon } from './RailIcons'
import { TactileButton } from './TactileButton'

interface SideRailProps {
  /** A class goal is on: Float and Get Ready! exist only with one. */
  goalLive: boolean
  /** The browser can float the class goal over the lesson (Chrome and Edge). */
  canFloat: boolean
  floating: boolean
  onToggleFloat: () => void
  getReadyOpen: boolean
  getReadyDisabled: boolean
  onGetReady: () => void
  /** Stars waiting on the desks, in a class that puts them there first; null where they go straight to the goal. */
  deskStars: number | null
  onAllStarsIn: () => void
  swapMode: boolean
  onToggleSwap: () => void
  /** Attendance is on: a desk tap marks a student absent or back, and nothing else answers. */
  attendanceMode: boolean
  /** Choose Your Avatar is on: a desk tap opens that student's picker, and the rail stands down as for the desk modes. */
  choosingAvatars: boolean
  /** Attendance has been taken for this class today, so the button carries a check. */
  attendanceTaken: boolean
  onToggleAttendance: () => void
  onPickStudent: () => void
  onPickRow: () => void
  /** The group cards are up, so the two pickers work on them instead of the desks. */
  groupMode: boolean
  rowLocked: boolean
  /** Pick Student is currently confined to the row (table, group) that was picked. */
  rowLockBinds: boolean
  /** What Pick Row picks in this room: a row of desks, or a table (lib/layouts). */
  setName: 'row' | 'table'
  /** A student pick is flashing or its winner is on the board. */
  studentPickActive: boolean
  /** A row pick is flashing or its winner is on the board. */
  rowPickActive: boolean
  side: 'left' | 'right'
  onToggleSide: () => void
  saveError: boolean
  /** Signing in and sync: once signed in, a Saved mark sits at the foot of the rail. */
  cloud: ReturnType<typeof useCloudSync>
  onSwitchTeacher: () => void
  pointsSelectedCount: number
  allSeatedSelected: boolean
  /** Someone is picked, by hand or by a picker, so Pick All reads Unpick All and lets them all go. */
  anyPicked: boolean
  onToggleSelectAll: () => void
  /**
   * Pick Whole Row (or Table): the rows of the students picked by hand. Null when nobody is
   * picked by hand; `whole` when everyone in those rows already is.
   */
  wholeSets: { count: number; whole: boolean; onPick: () => void } | null
  onAwardPoint: () => void
  onDeductPoint: () => void
  /**
   * The class puts its stars on the desks first, so minus has a star still at stake to take
   * back. Straight to the goal there is no minus: a star in the jar never comes out.
   */
  showMinus: boolean
  /** Someone selected has at least one star, so minus has something to take. */
  canDeductPoint: boolean
  flipDeckOpen: boolean
  /** A pick is mid-flash; opening the flip cards now would leave it landing on hidden desks. */
  pickFlashing: boolean
  onToggleFlipDeck: () => void
  groupActivityOpen: boolean
  /** The board is locked for students: the activity can't be left from here either. */
  groupActivityLocked: boolean
  onToggleGroupActivity: () => void
}

/**
 * The rail's spacing at each step of fitting itself to a short screen (useFitToHeight): the gaps
 * and the buttons' padding first, then the icons, a little at a time and only as far as they must.
 * Step 0 is the rail as drawn on a screen with room.
 */
const TIGHT = { '--rpad': 'clamp(2px, 0.6vh, 6px)', '--rg-gap': 'clamp(3px, 0.7vh, 7px)', '--bgap': 'calc(2px + var(--bgap-extra, 0px))' }
const FIT_STEPS = [
  {},
  TIGHT,
  ...[0.92, 0.84, 0.76, 0.68, 0.6, 0.52].map((f) => ({ ...TIGHT, '--ri': `max(14px, calc(clamp(22px, 5.2vh, 40px) * ${f}))` })),
] as CSSProperties[]

/**
 * The side rail (2026-10-08 to 2026-10-10, worked out with the teacher in a preview): one column
 * of the teacher's own icons, no words, in place of the side panel's buttons with words, which took
 * 256px; the desks and the goal meter have that room now. Float is a bare icon at the very top, like
 * a gear; then Get Ready! and the timer; Attendance and Swap Seats; the three pickers; Flip Cards and
 * Group Activity; the star that gives the point. Every button the same size, a line between each
 * kind, the Saved mark and the side arrows bare at the foot. It runs the whole height of the window
 * flush against its edge, with square corners where it meets the window and rounded ones facing
 * the desks, so it reads as part of the window rather than a card on the board.
 *
 * Every button keeps its name for a screen reader and a mouse (aria-label and title), which is also
 * how the checks find them.
 */
export function SideRail(props: SideRailProps) {
  const {
    goalLive,
    canFloat,
    floating,
    onToggleFloat,
    getReadyOpen,
    getReadyDisabled,
    onGetReady,
    deskStars,
    onAllStarsIn,
    swapMode,
    onToggleSwap,
    attendanceMode,
    choosingAvatars,
    attendanceTaken,
    onToggleAttendance,
    onPickStudent,
    onPickRow,
    groupMode,
    rowLocked,
    rowLockBinds,
    setName,
    studentPickActive,
    rowPickActive,
    side,
    onToggleSide,
    saveError,
    cloud,
    onSwitchTeacher,
    pointsSelectedCount,
    allSeatedSelected,
    anyPicked,
    onToggleSelectAll,
    wholeSets,
    onAwardPoint,
    onDeductPoint,
    showMinus,
    canDeductPoint,
    flipDeckOpen,
    pickFlashing,
    onToggleFlipDeck,
    groupActivityOpen,
    groupActivityLocked,
    onToggleGroupActivity,
  } = props
  // The group cards carry their own scores, so the board's pickers and + stand down while the
  // activity is up - the same way Swap Seats quiets everything else.
  const busy = swapMode || attendanceMode || choosingAvatars || groupActivityOpen
  // Swap Seats and Attendance both turn a desk tap into something else, so while either is on it
  // is the only thing on the rail that answers - and so does Choose Your Avatar, which ends with
  // Done on the board.
  const deskMode = swapMode || attendanceMode || choosingAvatars
  const timerView = useTimer((s) => s.view)
  const timerUp = useTimer((s) => s.up)

  // Fits itself to the screen's height: anything that adds a button starts the fitting again.
  const asideRef = useRef<HTMLElement>(null)
  const fitKey = [goalLive && canFloat, goalLive, showMinus, deskStars !== null, Boolean(cloud.account), saveError].join()
  const fit = useFitToHeight(asideRef, FIT_STEPS.length - 1, fitKey)

  const table = setName === 'table'
  const studentPicker = rowLockBinds
    ? {
        name: groupMode ? 'Pick from This Group' : table ? 'Pick from This Table' : 'Pick from This Row',
        icon: groupMode ? FromGroupIcon : table ? FromTableIcon : FromRowIcon,
      }
    : // "Random" is the point (2026-10-08, the teacher): without it a teacher may think this is
      // how to pick a student by hand, which is a tap on their desk.
      { name: 'Pick a Random Student', icon: PickStudentIcon }

  return (
    <aside
      ref={asideRef}
      data-ink="panel"
      data-rail=""
      data-fit={fit}
      aria-label="Tools"
      style={FIT_STEPS[fit]}
      className={clsx(
        'side-rail flex h-full min-h-0 w-[var(--rail-w)] flex-col gap-[var(--rg-gap)] overflow-hidden border-border bg-card/70 px-[5px] py-1.5 shadow-xl shadow-black/5 dark:shadow-black/20',
        side === 'left' ? 'rounded-r-[20px] border-r' : 'rounded-l-[20px] border-l',
      )}
    >
      {/* Float is a bare icon at the very top, like a gear: a setting for the window, not a lesson tool. */}
      {goalLive && canFloat && (
        <div className="flex shrink-0 justify-center">
          <button
            type="button"
            onClick={onToggleFloat}
            aria-label="Float"
            title={floating ? 'Close the floating class goal' : 'Float the class goal in a small window over your lesson'}
            aria-pressed={floating}
            className={clsx(
              'grid place-items-center rounded-lg p-[3px] active:scale-95',
              floating ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <PictureInPicture2 className="size-[calc(var(--ri)*0.9)]" strokeWidth={2} />
          </button>
        </div>
      )}

      <Group>
        {goalLive && (
          <RailButton
            name="Get Ready!"
            title="A star for getting ready quickly and quietly"
            active={getReadyOpen}
            disabled={getReadyDisabled}
            onClick={onGetReady}
          >
            <DrumIcon className="rail-icon" />
          </RailButton>
        )}
        {/* The timer opens big over the board from here; lit while it is, red when its time is up. */}
        <RailButton
          name="Timer"
          active={timerView === 'big'}
          disabled={deskMode}
          onClick={timer.railTap}
          className={clsx(timerUp && timerView !== 'off' && 'rail-alarm')}
          guard
        >
          <HourglassIcon className="rail-icon" />
        </RailButton>
      </Group>
      <Line />

      <Group>
        {/*
          The two desk modes: each turns a desk tap into something else, and only one can be on, so
          the one that's on lights up and the other greys out. Attendance is one button, one
          meaning: on, and a desk tap marks a student absent (or back); off, and the day is
          recorded. The check says today's is done. Both stand down while cards cover the desks.
        */}
        <RailButton
          name="Attendance"
          title={attendanceTaken ? 'Attendance is done for today' : 'Take attendance'}
          active={attendanceMode}
          disabled={swapMode || choosingAvatars || flipDeckOpen || groupActivityOpen || pickFlashing}
          onClick={onToggleAttendance}
        >
          <AttendanceIcon className="rail-icon" />
          {attendanceTaken && !attendanceMode && (
            <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-emerald-500 text-white shadow">
              <Check size={11} strokeWidth={3.5} />
            </span>
          )}
        </RailButton>
        <RailButton
          name="Swap Seats"
          title={flipDeckOpen || groupActivityOpen ? 'Seats can only be swapped on the seating chart' : 'Swap Seats'}
          active={swapMode}
          disabled={flipDeckOpen || groupActivityOpen || attendanceMode || choosingAvatars}
          onClick={onToggleSwap}
        >
          <SwapIcon className="rail-icon" />
        </RailButton>
      </Group>
      <Line />

      {/*
        The three pickers follow what is lit on the board. A row picked: the student picker picks
        inside it. Desks tapped by hand: the row picker fills their rows. Anyone picked: Pick All
        lets them go. The flip cards are their own picker - the class chooses by tapping a card -
        so the pickers stand down rather than lighting up desks behind the deck.
      */}
      <Group>
        <RailButton
          name={studentPicker.name}
          active={studentPickActive}
          disabled={deskMode || flipDeckOpen}
          onClick={onPickStudent}
          face={rowLockBinds ? 'from' : 'student'}
        >
          <studentPicker.icon className="rail-icon" />
        </RailButton>
        {wholeSets && !groupMode ? (
          // Tap one student in a row that did well, then this, and the whole row is picked.
          // Greyed once it is.
          <RailButton
            name={`Pick Whole ${table ? 'Table' : 'Row'}${wholeSets.count > 1 ? 's' : ''}`}
            title={wholeSets.whole ? `The whole ${setName} is picked` : `Pick everyone in the ${setName}`}
            disabled={busy || wholeSets.whole}
            onClick={wholeSets.onPick}
            face="whole"
          >
            {table ? <WholeTableIcon className="rail-icon" /> : <WholeRowIcon className="rail-icon" />}
          </RailButton>
        ) : (
          // A row and a group are both "a set of students", so the button keeps its meaning and
          // only what counts as a set changes with the screen.
          <RailButton
            name={groupMode ? 'Pick a Random Group' : table ? 'Pick a Random Table' : 'Pick a Random Row'}
            title={
              rowLockBinds
                ? groupMode
                  ? 'Picks are staying in this group. Tap the board to go back to the whole class.'
                  : `Picks are staying in this ${setName}. Tap any desk to go back to the whole class.`
                : undefined
            }
            active={rowLocked || rowPickActive}
            disabled={deskMode || flipDeckOpen}
            onClick={onPickRow}
            face="row"
          >
            {groupMode ? (
              <PickGroupIcon className="rail-icon" />
            ) : table ? (
              <PickTableIcon className="rail-icon" />
            ) : (
              <PickRowIcon className="rail-icon" />
            )}
          </RailButton>
        )}
        {/* Lit only with everyone picked; Unpick All whenever anyone is picked, so one tap lets go of
            students tapped all over the board (2026-10-08, the teacher). On the flip cards + always
            means the student whose card is up, never the room. */}
        <RailButton
          name={anyPicked ? 'Unpick All' : 'Pick All'}
          active={allSeatedSelected && !anyPicked}
          disabled={busy || flipDeckOpen}
          onClick={onToggleSelectAll}
          face={anyPicked ? 'none' : 'all'}
        >
          {anyPicked ? <NoneIcon className="rail-icon" /> : <AllIcon className="rail-icon" />}
        </RailButton>
      </Group>
      <Line />

      <Group>
        <RailButton name="Flip Cards" active={flipDeckOpen} disabled={busy || pickFlashing} onClick={onToggleFlipDeck}>
          <FlipIcon className="rail-icon" />
        </RailButton>
        <RailButton
          name="Group Activity"
          active={groupActivityOpen}
          disabled={deskMode || groupActivityLocked}
          onClick={onToggleGroupActivity}
        >
          <GroupIcon className="rail-icon" />
        </RailButton>
      </Group>
      <Line />

      <Group>
        {/* Greyed when nobody selected has a star to lose: the sound of a point going with nothing
            going was a small lie. Only where stars wait on the desks. */}
        {showMinus && (
          <RailButton
            name="Deduct Point"
            title={pointsSelectedCount > 0 && !canDeductPoint ? 'No points to take away' : 'Deduct Point'}
            disabled={busy || pointsSelectedCount === 0 || !canDeductPoint}
            onClick={onDeductPoint}
          >
            <Minus className="rail-icon" strokeWidth={2.75} />
          </RailButton>
        )}
        {/* data-points: in Elementary, where every other button is pale, the star stays yellow so a
            hand finds it without looking (index.css). */}
        <RailButton name="Award Point" disabled={busy || pointsSelectedCount === 0} onClick={onAwardPoint} points>
          <PointIcon className="rail-icon" />
        </RailButton>
        {/* All Stars In! finishes what + and - started, only in a class that puts its stars on the
            desks first: the chest they go into, with how many are waiting. Greyed with none, and only
            ever a tap - stars left on the desks wait for next time. */}
        {deskStars !== null && (
          <RailButton
            name="All Stars In!"
            title={deskStars === 0 ? 'No stars on the desks yet' : 'Add every star on the desks to the class goal'}
            disabled={busy || deskStars === 0}
            onClick={onAllStarsIn}
          >
            <img src={assetUrl('/treasure/chest-closed.svg')} alt="" draggable={false} className="rail-icon" />
            <span className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-amber-400 px-1 text-center text-xs font-bold tabular-nums text-amber-950 shadow">
              {deskStars}
            </span>
          </RailButton>
        )}
      </Group>

      {/* The foot: the Saved mark and the side arrows, bare. mt-auto keeps them at the bottom. */}
      <div className="mt-auto flex shrink-0 flex-wrap items-center justify-center gap-0.5 pt-0.5">
        {cloud.account && (
          <SyncMark
            compact
            account={cloud.account}
            status={cloud.status}
            needsSignIn={cloud.needsSignIn}
            signingIn={cloud.signingIn}
            signInError={cloud.signInError}
            disabled={deskMode}
            side={side}
            onSignIn={() => void cloud.signIn()}
            onSwitchTeacher={onSwitchTeacher}
          />
        )}
        {saveError && (
          <span
            className="grid place-items-center p-0.5 text-amber-600 dark:text-amber-400"
            title="Not saving: changes aren't saving on this device right now. Its storage may be full, or this may be a private window."
            aria-label="Not saving"
            role="img"
          >
            <TriangleAlert size={16} />
          </span>
        )}
        <button
          type="button"
          onClick={onToggleSide}
          disabled={deskMode}
          title={`Move panel to the ${side === 'left' ? 'right' : 'left'}`}
          className="rounded-lg p-0.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowLeftRight size={16} />
        </button>
      </div>
    </aside>
  )
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-[var(--bgap)]">{children}</div>
}

/** A hairline between each kind of tool. */
function Line() {
  return <div className="mx-1 h-px shrink-0 bg-border" />
}

const TAP_GUARD_MS = 700

/**
 * One of the rail's buttons: an icon, every one the same size. A button whose meaning changes
 * with the board (a picker's other face) gives a small pop as it changes, so the eye notices.
 * `guard` ignores a second tap for 0.7 s, for a button whose second tap would undo the first:
 * smart boards read one touch as two.
 */
function RailButton({
  name,
  title,
  active = false,
  disabled = false,
  onClick,
  className,
  face,
  points = false,
  guard = false,
  children,
}: {
  name: string
  title?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  face?: string
  points?: boolean
  guard?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const lastFace = useRef(face)
  useLayoutEffect(() => {
    if (face === lastFace.current) return
    lastFace.current = face
    ref.current?.animate([{ scale: 0.8 }, { scale: 1.08, offset: 0.6 }, { scale: 1 }], { duration: 350, easing: 'ease' })
  }, [face])
  const lastTap = useRef(0)
  return (
    <TactileButton
      ref={ref}
      active={active}
      disabled={disabled}
      aria-label={name}
      title={title ?? name}
      data-points={points ? 'award' : undefined}
      onClick={() => {
        if (guard) {
          const now = performance.now()
          if (now >= lastTap.current && now - lastTap.current < TAP_GUARD_MS) return
          lastTap.current = now
        }
        onClick()
      }}
      className={clsx('relative w-full !gap-0 !rounded-xl !px-0.5 !py-[var(--rpad)] justify-center', className)}
    >
      {children}
    </TactileButton>
  )
}
