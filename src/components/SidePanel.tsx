import clsx from 'clsx'
import { ArrowLeftRight, Check, ClipboardCheck, Layers, Minus, Plus, Settings, Shuffle, Star, TriangleAlert, User } from 'lucide-react'
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { useFitToHeight } from '../hooks/useFitToHeight'
import { GroupActivityIcon, PickGroupIcon, PickRowIcon, PickTableIcon } from './PickerIcons'
import type { ClassData, TimerSettings } from '../types'
import type { useCloudSync } from '../hooks/useCloudSync'
import { Badge } from '@/components/ui/badge'
import { SyncMark } from './Account'
import { ClassTitle } from './ClassTitle'
import { FlipTimer } from './FlipTimer'
import { TactileButton } from './TactileButton'

interface SidePanelProps {
  classes: ClassData[]
  activeClassId: string | null
  onSelectClass: (id: string) => void
  /**
   * A class goal is on, so the class's name sits at the end of the goal meter (ClassTitle) and
   * the goal's own controls take its row here.
   */
  nameInBar: boolean
  /** The goal's controls for that row: Get Ready!, and Float where the browser can float the goal. */
  goalControls: ReactNode
  /** Stars waiting on the desks, in a class that puts them there first; null where they go straight to the goal. */
  deskStars: number | null
  /** All Stars In!: every desk's stars to the goal. */
  onAllStarsIn: () => void
  swapMode: boolean
  onToggleSwap: () => void
  /** Attendance is on: a desk tap marks a student absent or back, and nothing else answers. */
  attendanceMode: boolean
  /** Choose Your Avatar is on: a desk tap opens that student's picker, and the panel stands down as for the desk modes. */
  choosingAvatars: boolean
  /** Attendance has been taken for this class today, so the button carries a check. */
  attendanceTaken: boolean
  onToggleAttendance: () => void
  onPickStudent: () => void
  onPickRow: () => void
  /** The group cards are up, so the two pickers work on them instead of the desks. */
  groupMode: boolean
  rowLocked: boolean
  /** Pick Student is currently confined to the row that was picked. */
  rowLockBinds: boolean
  /** What Pick Row picks in this room: a row of desks, or a table (lib/layouts). */
  setName: 'row' | 'table'
  /** A student pick is flashing or its winner is on the board. */
  studentPickActive: boolean
  /** A row pick is flashing or its winner is on the board. */
  rowPickActive: boolean
  onOpenSettings: () => void
  onOpenPickerSettings: () => void
  timerSettings: TimerSettings
  onOpenTimerSettings: () => void
  side: 'left' | 'right'
  onToggleSide: () => void
  saveError: boolean
  /** Signing in and sync: once signed in, a Saved mark sits at the foot of the panel. */
  cloud: ReturnType<typeof useCloudSync>
  onSwitchTeacher: () => void
  pointsSelectedCount: number
  allSeatedSelected: boolean
  /** Some students are picked by hand, so Pick All reads Unpick All and lets them all go. */
  anyPickedByHand: boolean
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
  /** Whose turn it is on the flip cards - the student +/- will score. */
  flipActiveName: string | null
  onToggleFlipDeck: () => void
  groupActivityOpen: boolean
  /** The board is locked for students: the activity can't be left from here either. */
  groupActivityLocked: boolean
  /** The board is locked for students, so the controls that would undo their work stand down. */
  groupsLocked: boolean
  onToggleGroupActivity: () => void
}

/**
 * The panel's spacing at each step of fitting itself to a short screen (useFitToHeight): the
 * gaps go first, then the buttons' padding, then the dial. Names and button text never shrink
 * here. Step 0 is the panel as it always was, so a screen it fitted is drawn exactly as before.
 */
const FIT_STEPS: CSSProperties[] = [
  {},
  { '--panel-gap': '0.5rem', '--panel-pad': '0.625rem', '--btn-py': '0.5rem' },
  { '--panel-gap': '0.4rem', '--panel-pad': '0.5rem', '--btn-py': '0.375rem', '--panel-inner-gap': '0.3rem', '--dial-cap': '13.5vh' },
  {
    '--panel-gap': '0.3rem',
    '--panel-pad': '0.5rem',
    '--btn-py': '0.25rem',
    '--panel-inner-gap': '0.25rem',
    '--dial-cap': '12vh',
    '--points-row': 'clamp(32px, 7vh - 12px, 76px)',
  },
] as CSSProperties[]

/** A panel button's padding top and bottom, which a short screen's panel takes in. */
const FIT_PY = '!py-[var(--btn-py,0.625rem)]'

export function SidePanel({
  classes,
  activeClassId,
  onSelectClass,
  nameInBar,
  goalControls,
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
  onOpenSettings,
  onOpenPickerSettings,
  timerSettings,
  onOpenTimerSettings,
  side,
  onToggleSide,
  saveError,
  cloud,
  onSwitchTeacher,
  pointsSelectedCount,
  allSeatedSelected,
  anyPickedByHand,
  onToggleSelectAll,
  wholeSets,
  onAwardPoint,
  onDeductPoint,
  showMinus,
  canDeductPoint,
  flipDeckOpen,
  pickFlashing,
  flipActiveName,
  onToggleFlipDeck,
  groupActivityOpen,
  groupActivityLocked,
  groupsLocked,
  onToggleGroupActivity,
}: SidePanelProps) {
  // The group cards carry their own scores, so the board's pickers and +/- stand down
  // while the activity is up - the same way Swap Seats quiets everything else.
  const busy = swapMode || attendanceMode || choosingAvatars || groupActivityOpen
  // Swap Seats and Attendance both turn a desk tap into something else, so while either is
  // on it is the only thing on the panel that answers - and so does Choose Your Avatar, which
  // ends with Done on the board.
  const deskMode = swapMode || attendanceMode || choosingAvatars

  // Fits itself to the screen's height rather than to a list of screens: anything that adds a
  // line to the panel starts the fitting again.
  const asideRef = useRef<HTMLElement>(null)
  const fitKey = [
    flipDeckOpen,
    pointsSelectedCount > 0,
    Boolean(wholeSets),
    Boolean(cloud.account),
    saveError,
    classes.length > 1,
    timerSettings.face,
    nameInBar,
    Boolean(goalControls),
    deskStars !== null,
  ].join()
  const fit = useFitToHeight(asideRef, FIT_STEPS.length - 1, fitKey)

  return (
    <aside
      ref={asideRef}
      data-ink="panel"
      data-fit={fit}
      style={FIT_STEPS[fit]}
      className={clsx(
        // The panel grows with the screen once its text does. Its buttons and labels are sized
        // in vmin, so on a tall screen they grew while the panel stayed 16rem - at 1920x1080 the
        // class name was cut and Swap Seats ran out past the edge. 30vmin keeps the two in
        // step: 16rem until about 850px tall, which is where the text starts growing, and
        // 21rem where the text stops. A board 800px tall or less is exactly as it was.
        'flex h-full w-56 shrink-0 flex-col gap-[var(--panel-gap,0.75rem)] rounded-3xl border border-white/60 bg-card/70 p-[var(--panel-pad,0.75rem)] shadow-xl shadow-black/5 sm:w-[clamp(16rem,30vmin,21rem)]',
        'dark:border-white/10 dark:shadow-black/20',
      )}
    >
      {/*
        The top row: the class's name, or - with a class goal on - the goal's own controls, while
        the name labels the goal meter instead (ClassTitle). The teacher found buttons beside the
        meter took the eye from it; the quiet name there doesn't.
      */}
      {nameInBar ? (
        goalControls && <div className="flex shrink-0 items-center gap-1.5">{goalControls}</div>
      ) : (
        <ClassTitle
          place="panel"
          classes={classes}
          activeClassId={activeClassId}
          onSelectClass={onSelectClass}
          onOpenSettings={onOpenSettings}
          disabled={deskMode}
          settingsDisabled={groupsLocked}
        />
      )}

      <FlipTimer settings={timerSettings} onOpenSettings={onOpenTimerSettings} disabled={deskMode} />

      <div className="flex shrink-0 flex-col gap-[var(--panel-inner-gap,0.375rem)]">
        <div className="flex gap-1.5">
          {/*
            The two desk modes, side by side: each turns a desk tap into something else, and
            only one can be on, so the one that's on lights up and the other greys out.
            Attendance is one button, one meaning: on, and a desk tap marks a student absent
            (or back); off, and the day is recorded. The check says today's is done. It stands
            down while cards cover the desks, since the desks are what it acts on.
          */}
          <TactileButton
            active={attendanceMode}
            onClick={onToggleAttendance}
            disabled={swapMode || choosingAvatars || flipDeckOpen || groupActivityOpen || pickFlashing}
            className={clsx('grow shrink basis-0 !px-2 justify-center', FIT_PY)}
            title={attendanceTaken ? 'Attendance is done for today' : 'Take attendance'}
          >
            {attendanceTaken && !attendanceMode ? (
              <Check size={18} strokeWidth={3} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ClipboardCheck size={18} />
            )}
            Attendance
          </TactileButton>
          <TactileButton
            active={swapMode}
            onClick={onToggleSwap}
            // Swap Seats acts on the desks, so it is only for the seating chart: not while the
            // flip cards or the group cards cover them.
            disabled={flipDeckOpen || groupActivityOpen || attendanceMode || choosingAvatars}
            className={clsx('grow shrink basis-0 !px-2 justify-center', FIT_PY)}
            title={flipDeckOpen || groupActivityOpen ? 'Seats can only be swapped on the seating chart' : undefined}
          >
            <Shuffle size={18} /> Swap Seats
          </TactileButton>
        </div>
        <div data-ink="group" className="rounded-2xl border border-black/10 p-2 dark:border-white/10">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pickers &amp; Points</span>
            <button
              type="button"
              onClick={onOpenPickerSettings}
              disabled={deskMode}
              title="Pickers & Points settings"
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
            >
              <Settings size={15} />
            </button>
          </div>
          <div className="flex flex-col gap-[var(--panel-inner-gap,0.375rem)]">
            {/*
              The label says what the button will actually do. Picking a row quietly confines
              Pick Student to it, and the only thing that said so was a hover tooltip on the
              other button - which does not exist on a tablet, where this app is mostly used.
              No row number: rows carry no visible label on purpose, since teachers disagree
              about which end of the grid is the front of the room, so "this row" is the only
              honest way to name it. It reverts the moment the lock stops binding.
            */}
            {/* The flip cards are their own picker - the class chooses by tapping a card - so
                the other two stand down rather than lighting up desks behind the deck. */}
            <TactileButton
              active={studentPickActive}
              onClick={onPickStudent}
              disabled={deskMode || flipDeckOpen}
              className={clsx('w-full justify-start', FIT_PY)}
            >
              <User size={18} />{' '}
              {rowLockBinds
                ? groupMode
                  ? 'Pick from This Group'
                  : setName === 'table'
                    ? 'Pick from This Table'
                    : 'Pick from This Row'
                : // "Random" is the point (2026-10-08, the teacher): without it a teacher may think
                  // this is how to pick a student by hand, which is a tap on their desk.
                  'Pick a Random Student'}
            </TactileButton>
            {/* A row and a group are both "a set of students", so the button keeps its
                meaning and only what counts as a set changes with the screen. */}
            <TactileButton
              active={rowLocked || rowPickActive}
              onClick={onPickRow}
              disabled={deskMode || flipDeckOpen}
              className={clsx('w-full justify-start', FIT_PY)}
              title={
                rowLockBinds
                  ? groupMode
                    ? 'Picks are staying in this group. Tap the board to go back to the whole class.'
                    : `Picks are staying in this ${setName}. Tap any desk to go back to the whole class.`
                  : undefined
              }
            >
              {groupMode ? <PickGroupIcon size={18} /> : setName === 'table' ? <PickTableIcon size={18} /> : <PickRowIcon size={18} />}{' '}
              {groupMode ? 'Pick a Random Group' : setName === 'table' ? 'Pick a Random Table' : 'Pick a Random Row'}
            </TactileButton>
            <TactileButton
              active={flipDeckOpen}
              onClick={onToggleFlipDeck}
              disabled={busy || pickFlashing}
              className={clsx('w-full justify-start', FIT_PY)}
            >
              <Layers size={18} /> Flip Cards
            </TactileButton>
            <TactileButton
              active={groupActivityOpen}
              onClick={onToggleGroupActivity}
              disabled={deskMode || groupActivityLocked}
              className={clsx('w-full justify-start', FIT_PY)}
            >
              <GroupActivityIcon size={18} /> Group Activity
            </TactileButton>
          </div>

          {/*
            Pick All used to be a bare icon square wedged between two other icon
            squares - nothing told it apart from +/- at a glance. It says the word
            now, in the vocabulary of the buttons above it (Pick Student, Pick Row),
            sized to the word; +/- share whatever is left, since they're the two
            buttons a teacher taps most. No icon: the highlight is the state, the
            word is the action.
          */}
          {/* Taller as the screen gets taller. These are the buttons tapped all lesson, and
              they were the smallest on the panel while a third of it sat empty on a big board.
              A 640-tall screen keeps the 38px it had, so the panel still fits there. */}
          <div className="mt-1.5 flex h-[var(--points-row,clamp(38px,7vh_-_7px,76px))] items-stretch gap-1.5">
            <TactileButton
              active={allSeatedSelected}
              // On the flip cards +/- always mean "the student named below", never the room.
              disabled={busy || flipDeckOpen}
              onClick={onToggleSelectAll}
              // Lit only with everyone picked; Unpick All whenever anyone is picked by hand, so one
              // tap lets go of students tapped all over the board (2026-10-08, the teacher).
              title={anyPickedByHand ? 'Unpick All' : 'Pick All'}
              // Wide enough for "Unpick All", so +/- don't change width when the label does.
              className="w-[6.1em] shrink-0 !px-0 !text-[clamp(0.8rem,2vmin,1.3rem)] justify-center"
            >
              {anyPickedByHand ? 'Unpick All' : 'Pick All'}
            </TactileButton>
            {/* The word takes what the word needs; +/- share the rest. They're the two
                buttons a teacher taps most, so the free space is theirs. */}
            {/* Greyed when nobody selected has a star to lose, like a group card's minus at
                zero: the sound of a point going with nothing going was a small lie. Only where
                stars wait on the desks; straight to the goal, + has the row to itself. */}
            {showMinus && (
              <TactileButton
                disabled={busy || pointsSelectedCount === 0 || !canDeductPoint}
                onClick={onDeductPoint}
                title={pointsSelectedCount > 0 && !canDeductPoint ? 'No points to take away' : 'Deduct Point'}
                className="min-w-9 flex-1 !px-0 justify-center"
              >
                <Minus className="size-[clamp(20px,3.2vh,34px)]" strokeWidth={2.75} />
              </TactileButton>
            )}
            {/* data-points: in Elementary, where every other button is pale, + stays yellow so
                a hand finds it without looking (index.css). */}
            <TactileButton
              disabled={busy || pointsSelectedCount === 0}
              onClick={onAwardPoint}
              title="Award Point"
              data-points="award"
              className="min-w-9 flex-1 !px-0 justify-center"
            >
              <Plus className="size-[clamp(20px,3.2vh,34px)]" strokeWidth={2.75} />
            </TactileButton>
          </div>
          {/*
            All Stars In! finishes what + and - started, so it sits under them, only in a class
            that puts its stars on the desks first. Greyed with none waiting, so the teacher always
            knows where it is, and only ever a tap: stars left on the desks wait for next time,
            with no message about it - the stars on the desks are the reminder, and the count says
            how many. It was on the goal meter, which took the eye from the meter.
          */}
          {deskStars !== null && (
            <TactileButton
              onClick={onAllStarsIn}
              disabled={busy || deskStars === 0}
              className={clsx('mt-1.5 w-full justify-center', FIT_PY)}
              title={deskStars === 0 ? 'No stars on the desks yet' : 'Add every star on the desks to the class goal'}
            >
              <Star size={18} className="fill-amber-400 text-amber-500" />
              All Stars In!
              <span className="rounded-full bg-amber-400/25 px-1.5 text-xs font-bold tabular-nums text-foreground">{deskStars}</span>
            </TactileButton>
          )}
          {flipDeckOpen ? (
            // Always one line, name or not, so nothing below it jumps as turns change hands.
            <p className="mt-1 truncate px-1 text-center text-xs font-medium text-muted-foreground">
              {flipActiveName ? (
                <>
                  Points go to <span className="font-bold text-foreground">{flipActiveName}</span>
                </>
              ) : (
                'Flip a card to give points'
              )}
            </p>
          ) : wholeSets ? (
            // Where "3 students selected" was: tap one student in a row that did well, then this,
            // and the whole row is picked. Greyed once it is, so the panel doesn't jump.
            <TactileButton
              onClick={wholeSets.onPick}
              disabled={busy || wholeSets.whole}
              className={clsx('mt-1.5 w-full justify-center', FIT_PY)}
              title={wholeSets.whole ? `The whole ${setName} is picked` : `Pick everyone in the ${setName}`}
            >
              {setName === 'table' ? <PickTableIcon size={18} /> : <PickRowIcon size={18} />}
              Pick Whole {setName === 'table' ? 'Table' : 'Row'}
              {wholeSets.count > 1 ? 's' : ''}
            </TactileButton>
          ) : (
            pointsSelectedCount > 0 && (
              <p className="mt-1 px-1 text-center text-xs font-medium text-muted-foreground">
                {pointsSelectedCount} student{pointsSelectedCount === 1 ? '' : 's'} selected
              </p>
            )
          )}
        </div>
      </div>

      {/* The bottom strip. mt-auto keeps it at the foot of the panel on tall screens. It used
          to be an empty flex-1 spacer, which shrank to nothing when the timer controls were
          open but still carried the panel's 12px gap on both sides - 12px of pure dead space
          at exactly the moment the panel was out of room. No divider above it: a rule across
          the panel for one small button read as the start of a section with nothing in it. */}
      <div className="mt-auto flex shrink-0 flex-col">
        {/* One row, so a Saved mark beside the arrow costs the panel no height. */}
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5">
          {cloud.account && (
            <SyncMark
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
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-400/50 text-amber-600 dark:text-amber-400"
              title="Changes aren't saving on this device right now. Its storage may be full, or this may be a private window."
            >
              <TriangleAlert size={12} />
              Not saving
            </Badge>
          )}
          <button
            type="button"
            onClick={onToggleSide}
            disabled={deskMode}
            title={`Move panel to the ${side === 'left' ? 'right' : 'left'}`}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowLeftRight size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
