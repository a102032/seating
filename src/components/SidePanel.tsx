import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Layers,
  Minus,
  Plus,
  Settings,
  Shuffle,
  TriangleAlert,
  User,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useFitToHeight } from '../hooks/useFitToHeight'
import { GroupActivityIcon, PickGroupIcon, PickRowIcon, PickTableIcon } from './PickerIcons'
import { useShrinkToFit } from '../hooks/useShrinkToFit'
import type { ClassData, TimerSettings } from '../types'
import type { useCloudSync } from '../hooks/useCloudSync'
import { Badge } from '@/components/ui/badge'
import { SyncMark } from './Account'
import { ConfirmModal } from './ConfirmModal'
import { FlipTimer } from './FlipTimer'
import { TactileButton } from './TactileButton'

interface SidePanelProps {
  classes: ClassData[]
  activeClassId: string | null
  onSelectClass: (id: string) => void
  swapMode: boolean
  onToggleSwap: () => void
  /** Attendance is on: a desk tap marks a student absent or back, and nothing else answers. */
  attendanceMode: boolean
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
  onToggleSelectAll: () => void
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
  swapMode,
  onToggleSwap,
  attendanceMode,
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
  onToggleSelectAll,
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
  const busy = swapMode || attendanceMode || groupActivityOpen
  // Swap Seats and Attendance both turn a desk tap into something else, so while either is
  // on it is the only thing on the panel that answers.
  const deskMode = swapMode || attendanceMode
  const [listOpen, setListOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<ClassData | null>(null)

  const activeClass = classes.find((c) => c.id === activeClassId)
  // The class name shares its row with the class switcher and the settings gear, so a name
  // that still doesn't fit gives up a little size before it gives up letters.
  const classNameRef = useShrinkToFit<HTMLSpanElement>(activeClass?.name, 0.75)

  // Fits itself to the screen's height rather than to a list of screens: anything that adds a
  // line to the panel starts the fitting again.
  const asideRef = useRef<HTMLElement>(null)
  const fitKey = [flipDeckOpen, pointsSelectedCount > 0, Boolean(cloud.account), saveError, classes.length > 1, timerSettings.face].join()
  const fit = useFitToHeight(asideRef, FIT_STEPS.length - 1, fitKey)

  useEffect(() => {
    if (deskMode) setListOpen(false)
  }, [deskMode])

  function requestSwitch(cls: ClassData) {
    if (cls.id === activeClassId) {
      setListOpen(false)
      return
    }
    setSwitchTarget(cls)
  }

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
      {/* relative and above the panel, so the class list can open over what is below. */}
      <div className="relative z-30 shrink-0">
        <div className="relative z-30 flex items-center gap-1">
          <span
            ref={classNameRef}
            data-ink="class-name"
            className="truncate px-1 font-bold text-foreground"
            style={{ fontSize: 'calc(clamp(1rem, 1.9vmin, 1.3rem) * var(--fit, 1))' }}
          >
            {activeClass?.name}
          </span>
          {classes.length > 1 && (
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              disabled={deskMode}
              title="Switch class"
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
            >
              <motion.span animate={{ rotate: listOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
                <ChevronDown size={18} />
              </motion.span>
            </button>
          )}
          {/*
            Class Settings is a gear beside the class's name, the way the pickers' settings are
            a gear beside theirs. It was a button with a word on the row below, and Attendance
            sat here instead, which left a long class name 67px and cut "Grade 4 English" to
            "Grade ...". It stands down when a running activity is underneath, since settings
            rearrange the class, and when the board is locked for students.
          */}
          <button
            type="button"
            onClick={onOpenSettings}
            disabled={deskMode || groupsLocked}
            title="Class Settings"
            aria-label="Class Settings"
            className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            <Settings size={18} />
          </button>
        </div>

        {/*
          The class list opens over the panel, like a menu, rather than pushing the timer and the
          pickers down: on a board that gives the app 1280x559 it pushed Pick All and +/- off
          the bottom. A tap anywhere else closes it.
        */}
        {listOpen && classes.length > 1 && (
          <button
            type="button"
            aria-label="Close the class list"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setListOpen(false)}
          />
        )}
        <AnimatePresence initial={false}>
          {listOpen && classes.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              data-ink="menu"
              className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
            >
              <div className="flex flex-col gap-1">
                {' '}
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => requestSwitch(cls)}
                    className={clsx(
                      'w-full truncate rounded-xl px-3 py-2 text-left font-semibold transition-colors active:scale-[0.98]',
                      cls.id === activeClassId
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                    style={{ fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
            disabled={swapMode || flipDeckOpen || groupActivityOpen || pickFlashing}
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
            disabled={flipDeckOpen || groupActivityOpen || attendanceMode}
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
                : 'Pick Student'}
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
              {groupMode ? 'Pick Group' : setName === 'table' ? 'Pick Table' : 'Pick Row'}
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
              title={allSeatedSelected ? 'Unpick All' : 'Pick All'}
              // Wide enough for "Unpick All", so +/- don't change width when the label does.
              className="w-[6.1em] shrink-0 !px-0 !text-[clamp(0.8rem,2vmin,1.3rem)] justify-center"
            >
              {allSeatedSelected ? 'Unpick All' : 'Pick All'}
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

      <ConfirmModal
        open={switchTarget !== null}
        title={`Switch to "${switchTarget?.name}"?`}
        message={`You'll now see "${switchTarget?.name}"'s seating chart instead of "${activeClass?.name}". Don't worry - "${activeClass?.name}" stays saved exactly as you left it, and you can switch back anytime.`}
        confirmLabel="Yes, Switch"
        cancelLabel="No"
        onCancel={() => setSwitchTarget(null)}
        onConfirm={() => {
          if (switchTarget) onSelectClass(switchTarget.id)
          setSwitchTarget(null)
          setListOpen(false)
        }}
      />
    </aside>
  )
}
