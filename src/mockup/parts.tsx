import clsx from 'clsx'
import {
  ArrowLeftRight,
  Check,
  ClipboardCheck,
  Layers,
  Minus,
  PictureInPicture2,
  Plus,
  Settings,
  Shuffle,
  Star,
  TriangleAlert,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SyncMark } from '../components/Account'
import { GroupActivityIcon, PickGroupIcon, PickRowIcon, PickTableIcon } from '../components/PickerIcons'
import type { SidePanelProps } from '../components/SidePanel'
import { TactileButton } from '../components/TactileButton'
import { TileButton } from './TileButton'

/** What both mock-up layouts are handed: the side panel's own props, and the goal's two buttons. */
export interface LayoutProps extends SidePanelProps {
  /** Get Ready!, with a goal on. */
  getReady: { onClick: () => void; disabled: boolean; active: boolean } | null
  /** Float, with a goal on and a browser that can float it. */
  float: { onClick: () => void; active: boolean } | null
}

/** The seating chart itself: a room of desks, none picked. */
function SeatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[2, 9.5, 17].flatMap((x) => [2.5, 9.75, 17].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={5} height={4.5} rx={1.2} />))}
    </svg>
  )
}

/**
 * What the board is showing, one lit at a time: the seating chart, the flip cards or the group
 * cards, and the two desk modes. Seats is the way home from any of them, so the lit tile always
 * answers "where am I?". The same rules as the side panel decide what may be tapped when.
 */
export function modeTiles(p: LayoutProps, fitLabel = false) {
  const deskMode = p.swapMode || p.attendanceMode || p.choosingAvatars
  const onSeats = !p.flipDeckOpen && !p.groupActivityOpen && !deskMode
  const goHome = () => {
    if (p.flipDeckOpen) p.onToggleFlipDeck()
    else if (p.groupActivityOpen) p.onToggleGroupActivity()
    else if (p.attendanceMode) p.onToggleAttendance()
    else if (p.swapMode) p.onToggleSwap()
  }
  return {
    seats: (
      <TileButton
        key="seats"
        fitLabel={fitLabel}
        icon={<SeatsIcon />}
        label="Seats"
        active={onSeats}
        onClick={goHome}
        disabled={p.choosingAvatars || p.groupActivityLocked || p.pickFlashing}
        title="Back to the seating chart"
      />
    ),
    cards: (
      <TileButton
        key="cards"
        fitLabel={fitLabel}
        icon={<Layers />}
        label="Cards"
        active={p.flipDeckOpen}
        onClick={p.onToggleFlipDeck}
        disabled={(deskMode || p.groupActivityOpen || p.pickFlashing) && !p.flipDeckOpen}
        title="Flip Cards"
      />
    ),
    groups: (
      <TileButton
        key="groups"
        fitLabel={fitLabel}
        icon={<GroupActivityIcon />}
        label="Groups"
        active={p.groupActivityOpen}
        onClick={p.onToggleGroupActivity}
        disabled={deskMode || p.groupActivityLocked}
        title="Group Activity"
      />
    ),
    attendance: (
      <TileButton
        key="attendance"
        fitLabel={fitLabel}
        icon={
          p.attendanceTaken && !p.attendanceMode ? (
            <Check strokeWidth={3} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ClipboardCheck />
          )
        }
        label="Attendance"
        active={p.attendanceMode}
        onClick={p.onToggleAttendance}
        disabled={p.swapMode || p.choosingAvatars || p.flipDeckOpen || p.groupActivityOpen || p.pickFlashing}
        title={p.attendanceTaken ? 'Attendance is done for today' : 'Take attendance'}
      />
    ),
    swap: (
      <TileButton
        key="swap"
        fitLabel={fitLabel}
        icon={<Shuffle />}
        label="Swap"
        active={p.swapMode}
        onClick={p.onToggleSwap}
        disabled={p.flipDeckOpen || p.groupActivityOpen || p.attendanceMode || p.choosingAvatars}
        title="Swap Seats"
      />
    ),
  }
}

/** Get Ready! and Float as tiles, where a goal is on. */
export function goalTiles(p: LayoutProps) {
  return {
    getReady: p.getReady && (
      <TileButton
        key="get-ready"
        icon={<Star className="fill-amber-400 text-amber-600" />}
        label="Get Ready!"
        active={p.getReady.active}
        onClick={p.getReady.onClick}
        disabled={p.getReady.disabled}
        title="A star for getting ready quickly and quietly"
      />
    ),
    float: p.float && (
      <TileButton
        key="float"
        icon={<PictureInPicture2 />}
        label="Float"
        active={p.float.active}
        onClick={p.float.onClick}
        title={p.float.active ? 'Close the floating class goal' : 'Float the class goal over your lesson'}
      />
    ),
  }
}

/** Pick a Random Student and Pick a Random Row (Table, Group), with the side panel's rules and words. */
export function pickerButtons(p: LayoutProps, className?: string) {
  const deskMode = p.swapMode || p.attendanceMode || p.choosingAvatars
  const studentLabel = p.rowLockBinds
    ? p.groupMode
      ? 'Pick from This Group'
      : p.setName === 'table'
        ? 'Pick from This Table'
        : 'Pick from This Row'
    : 'Pick a Random Student'
  const rowLabel = p.groupMode ? 'Pick a Random Group' : p.setName === 'table' ? 'Pick a Random Table' : 'Pick a Random Row'
  const rowIcon = p.groupMode ? (
    <PickGroupIcon size={18} />
  ) : p.setName === 'table' ? (
    <PickTableIcon size={18} />
  ) : (
    <PickRowIcon size={18} />
  )
  return {
    student: (
      <TactileButton
        key="pick-student"
        active={p.studentPickActive}
        onClick={p.onPickStudent}
        disabled={deskMode || p.flipDeckOpen}
        className={clsx('justify-start !whitespace-normal text-left leading-tight', className)}
      >
        <User size={18} className="shrink-0" /> {studentLabel}
      </TactileButton>
    ),
    row: (
      <TactileButton
        key="pick-row"
        active={p.rowLocked || p.rowPickActive}
        onClick={p.onPickRow}
        disabled={deskMode || p.flipDeckOpen}
        className={clsx('justify-start !whitespace-normal text-left leading-tight', className)}
      >
        <span className="shrink-0">{rowIcon}</span> {rowLabel}
      </TactileButton>
    ),
    studentTile: (
      <TileButton
        key="pick-student-tile"
        icon={<User />}
        label={p.rowLockBinds ? (p.groupMode ? 'This Group' : p.setName === 'table' ? 'This Table' : 'This Row') : 'Random Student'}
        active={p.studentPickActive}
        onClick={p.onPickStudent}
        disabled={deskMode || p.flipDeckOpen}
        title={studentLabel}
      />
    ),
    rowTile: (
      <TileButton
        key="pick-row-tile"
        icon={rowIcon}
        label={p.groupMode ? 'Random Group' : p.setName === 'table' ? 'Random Table' : 'Random Row'}
        active={p.rowLocked || p.rowPickActive}
        onClick={p.onPickRow}
        disabled={deskMode || p.flipDeckOpen}
        title={rowLabel}
      />
    ),
  }
}

/** Pick All, minus (with stars on the desks first) and plus: the same buttons as the side panel's. */
export function PointsRow({ p, className }: { p: LayoutProps; className?: string }) {
  const busy = p.swapMode || p.attendanceMode || p.choosingAvatars || p.groupActivityOpen
  return (
    <div className={clsx('flex items-stretch gap-1.5', className)}>
      <TactileButton
        active={p.allSeatedSelected}
        disabled={busy || p.flipDeckOpen}
        onClick={p.onToggleSelectAll}
        title={p.anyPickedByHand ? 'Unpick All' : 'Pick All'}
        className="w-[6.1em] shrink-0 !px-0 !text-[clamp(0.8rem,2vmin,1.3rem)] justify-center"
      >
        {p.anyPickedByHand ? 'Unpick All' : 'Pick All'}
      </TactileButton>
      {p.showMinus && (
        <TactileButton
          disabled={busy || p.pointsSelectedCount === 0 || !p.canDeductPoint}
          onClick={p.onDeductPoint}
          title={p.pointsSelectedCount > 0 && !p.canDeductPoint ? 'No points to take away' : 'Deduct Point'}
          className="min-w-9 flex-1 !px-0 justify-center"
        >
          <Minus className="size-[clamp(20px,3.2vh,34px)]" strokeWidth={2.75} />
        </TactileButton>
      )}
      <TactileButton
        disabled={busy || p.pointsSelectedCount === 0}
        onClick={p.onAwardPoint}
        title="Award Point"
        data-points="award"
        className="min-w-9 flex-1 !px-0 justify-center"
      >
        <Plus className="size-[clamp(20px,3.2vh,34px)]" strokeWidth={2.75} />
      </TactileButton>
    </div>
  )
}

/**
 * The line under the points: whose turn it is on the flip cards, Pick Whole Row, or how many are
 * picked - the side panel's line, word for word. Always present on the flip cards, so nothing
 * jumps as turns change hands.
 */
export function PointsStatus({ p, className }: { p: LayoutProps; className?: string }) {
  const busy = p.swapMode || p.attendanceMode || p.choosingAvatars || p.groupActivityOpen
  if (p.flipDeckOpen)
    return (
      <p className={clsx('truncate px-1 text-center text-xs font-medium text-muted-foreground', className)}>
        {p.flipActiveName ? (
          <>
            Points go to <span className="font-bold text-foreground">{p.flipActiveName}</span>
          </>
        ) : (
          'Flip a card to give points'
        )}
      </p>
    )
  if (p.wholeSets)
    return (
      <TactileButton
        onClick={p.wholeSets.onPick}
        disabled={busy || p.wholeSets.whole}
        className={clsx('justify-center !py-[var(--btn-py,0.5rem)]', className)}
        title={p.wholeSets.whole ? `The whole ${p.setName} is picked` : `Pick everyone in the ${p.setName}`}
      >
        {p.setName === 'table' ? <PickTableIcon size={18} /> : <PickRowIcon size={18} />}
        Pick Whole {p.setName === 'table' ? 'Table' : 'Row'}
        {p.wholeSets.count > 1 ? 's' : ''}
      </TactileButton>
    )
  if (p.pointsSelectedCount > 0)
    return (
      <p className={clsx('px-1 text-center text-xs font-medium text-muted-foreground', className)}>
        {p.pointsSelectedCount} student{p.pointsSelectedCount === 1 ? '' : 's'} selected
      </p>
    )
  return null
}

/** All Stars In!, only where stars wait on the desks first. */
export function AllStarsIn({ p, className }: { p: LayoutProps; className?: string }) {
  if (p.deskStars === null) return null
  const busy = p.swapMode || p.attendanceMode || p.choosingAvatars || p.groupActivityOpen
  return (
    <TactileButton
      onClick={p.onAllStarsIn}
      disabled={busy || p.deskStars === 0}
      className={clsx('justify-center !py-[var(--btn-py,0.5rem)]', className)}
      title={p.deskStars === 0 ? 'No stars on the desks yet' : 'Add every star on the desks to the class goal'}
    >
      <Star size={18} className="fill-amber-400 text-amber-500" />
      All Stars In!
      <span className="rounded-full bg-amber-400/25 px-1.5 text-xs font-bold tabular-nums text-foreground">{p.deskStars}</span>
    </TactileButton>
  )
}

/** The Saved mark, Not saving, the move-the-panel arrow and the pickers' settings gear, small, on one line. */
export function SmallControls({ p, showSideArrow = true }: { p: LayoutProps; showSideArrow?: boolean }) {
  const deskMode = p.swapMode || p.attendanceMode || p.choosingAvatars
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5">
      {p.cloud.account && (
        <SyncMark
          account={p.cloud.account}
          status={p.cloud.status}
          needsSignIn={p.cloud.needsSignIn}
          signingIn={p.cloud.signingIn}
          signInError={p.cloud.signInError}
          disabled={deskMode}
          side={p.side}
          onSignIn={() => void p.cloud.signIn()}
          onSwitchTeacher={p.onSwitchTeacher}
        />
      )}
      {p.saveError && (
        <Badge variant="outline" className="gap-1.5 border-amber-400/50 text-amber-600 dark:text-amber-400">
          <TriangleAlert size={12} />
          Not saving
        </Badge>
      )}
      <button
        type="button"
        onClick={p.onOpenPickerSettings}
        disabled={deskMode}
        title="Pickers & Points settings"
        className="rounded-lg p-1 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
      >
        <Settings size={16} />
      </button>
      {showSideArrow && (
        <button
          type="button"
          onClick={p.onToggleSide}
          disabled={deskMode}
          title={`Move panel to the ${p.side === 'left' ? 'right' : 'left'}`}
          className="rounded-lg p-1 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowLeftRight size={16} />
        </button>
      )}
    </div>
  )
}
