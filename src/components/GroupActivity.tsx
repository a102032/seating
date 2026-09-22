import clsx from 'clsx'
import { motion } from 'framer-motion'
import {
  Check,
  ClipboardCheck,
  Hammer,
  Hand,
  Lock,
  LockOpen,
  LogOut,
  Minus,
  Pencil,
  Plus,
  Shuffle,
  Star,
  Target,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { textWidthEm } from '../lib/fitText'
import { groupTextColor } from '../lib/groups'
import {
  playCardDeal,
  playCardFlip,
  playPointAward,
  playPointDeduct,
  playShuffle,
  playStatusDone,
  playStatusHelp,
  playStatusReady,
} from '../lib/sound'
import type { GroupPointsMode, GroupStatus, Student, StudentGroup } from '../types'
import { Input } from '@/components/ui/input'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface GroupActivityProps {
  groups: StudentGroup[]
  studentsById: Map<string, Student>
  pointsMode: GroupPointsMode
  /**
   * Non-zero asks for a deal: the chips gather into a stack and are dealt out. Bumped for
   * every new deal, and 0 when saved groups are being picked up - those just appear.
   */
  dealTick: number
  canShuffle: boolean
  onAdjustPoints: (groupId: string, delta: number) => void
  onMove: (studentId: string, groupId: string) => void
  onRename: (groupId: string, name: string) => void
  onNewGroups: () => void
  onShuffle: () => void
  onExit: () => void
  onSetStatus: (groupId: string, status: GroupStatus) => void
  /** A soft chime when a group taps Need Help, Ready or Done. */
  chimes: boolean
  /**
   * Students are at the board: only the status lights answer to a tap. Everything that
   * moves a name, changes a score or leaves the screen is frozen until the teacher unlocks.
   */
  locked: boolean
  onToggleLock: () => void
}

/**
 * The four lights, in the order a group's work usually goes. Colours are fixed on every
 * theme and the same on every card - a status is never confused with a group's colour.
 */
const STATUSES: { id: GroupStatus; label: string; icon: typeof Hand; bg: string; fg: string }[] = [
  { id: 'working', label: 'Working', icon: Hammer, bg: '#64748b', fg: '#ffffff' },
  { id: 'help', label: 'Need Help', icon: Hand, bg: '#ef4444', fg: '#ffffff' },
  { id: 'ready', label: 'Ready to Check', icon: ClipboardCheck, bg: '#f59e0b', fg: '#451a03' },
  { id: 'done', label: 'Done', icon: Check, bg: '#22c55e', fg: '#ffffff' },
]

/** Chips sit in the stack this long before the first one is dealt. */
const GATHER_MS = 520
const DEAL_STAGGER_MS = 55
/** Chip padding and the gap between number and name, in em - the measured text is added to this. */
const CHIP_CHROME_EM = 0.8 * 2 + 0.35
/** The widest a chip may grow for a long name; past this the name shrinks inside the chip instead. */
const CHIP_MAX_EM = 11
const CHIP_MIN_EM = 5.5
/** The card's fixed dimensions the layout planner has to account for, in px. */
const CARD_BORDER_PX = 3 * 2
const CHIP_HEIGHT_EM = 2.25
const GRID_PAD_PX = 2 * 2
/** How far the chips may shrink to make a deal fit the board, before the board clips instead. */
const CHIP_SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]

interface BoardMetrics {
  width: number
  height: number
  /** The chip font at full size, in px. */
  fontPx: number
  /** The group-name font in px, from the same clamp the header uses. */
  headerFontPx: number
}

/**
 * How tightly a card is packed. Normal is the design; compact and tight give up padding,
 * light size and button size, in that order, so that the names - the thing that has to be
 * read from the back of the room - are the last thing to shrink.
 */
type Density = 'normal' | 'compact' | 'tight'

/** The classes each density renders with. The numbers in cardChrome are these, in px. */
const DENSITY = {
  normal: {
    headerPad: 'py-1.5',
    nameScale: 1,
    bodyPad: 'p-2',
    chipGap: 'gap-2',
    stripPad: 'py-1.5',
    light: 'h-9',
    dim: 'w-9',
    lit: 'px-3',
    icon: 17,
    footerPad: 'p-1.5',
    button: 'h-[38px] w-[50px]',
    score: 'min-w-[3.5rem] text-2xl',
    star: 20,
    sign: 20,
  },
  compact: {
    headerPad: 'py-1',
    nameScale: 0.85,
    bodyPad: 'p-1.5',
    chipGap: 'gap-1.5',
    stripPad: 'py-1',
    light: 'h-7',
    dim: 'w-7',
    lit: 'px-2.5',
    icon: 15,
    footerPad: 'p-1',
    button: 'h-8 w-10',
    score: 'min-w-[2.75rem] text-xl',
    star: 17,
    sign: 18,
  },
  tight: {
    headerPad: 'py-0.5',
    nameScale: 0.75,
    bodyPad: 'p-1',
    chipGap: 'gap-1',
    stripPad: 'py-0.5',
    light: 'h-6',
    dim: 'w-6',
    lit: 'px-2',
    icon: 13,
    footerPad: 'p-0.5',
    button: 'h-7 w-9',
    score: 'min-w-[2.5rem] text-lg',
    star: 15,
    sign: 16,
  },
} as const

/**
 * A card's chrome - everything that isn't chips - at each density, in px. Computed from the
 * classes above rather than measured, because the plan decides which density renders:
 * measuring the result would have the plan chasing its own output.
 */
interface CardChrome {
  density: Density
  header: number
  bodyPad: number
  chipGap: number
  strip: number
  footer: number
  gridGap: number
}

function cardChrome(density: Density, headerFontPx: number): CardChrome {
  const nameLine = Math.ceil(headerFontPx * DENSITY[density].nameScale * 1.25)
  switch (density) {
    case 'normal':
      // header py-1.5 + name button py-0.5; body p-2, gap-2; lights h-9 in py-1.5; buttons 38px in p-1.5 + border
      return { density, header: 12 + 4 + nameLine, bodyPad: 16, chipGap: 8, strip: 12 + 36, footer: 12 + 38 + 1, gridGap: 12 }
    case 'compact':
      // header py-1; body p-1.5, gap-1.5; lights h-7 in py-1; buttons h-8 in p-1 + border
      return { density, header: 8 + 4 + nameLine, bodyPad: 12, chipGap: 6, strip: 8 + 28, footer: 8 + 32 + 1, gridGap: 8 }
    case 'tight':
      // header py-0.5; body p-1, gap-1; lights h-6 in py-0.5; buttons h-7 in p-0.5 + border
      return { density, header: 4 + 4 + nameLine, bodyPad: 8, chipGap: 4, strip: 4 + 24, footer: 4 + 28 + 1, gridGap: 8 }
  }
}

interface LayoutPlan {
  columns: number
  chipScale: number
  chrome: CardChrome
}

/**
 * The column count, chip size and card chrome that fit every card on the board at once.
 *
 * The app never scrolls - that's a rule, not a preference - so the board can't just be as
 * tall as thirteen cards need. Every dimension in a card is known here, which means the
 * layout can be planned rather than measured after the fact: try the nicest column count
 * first at full-size chips, then more columns; then tighten the card's chrome; and only
 * when nothing fits shrink the chips a step (all of them - one size for the class holds)
 * and try again. Names are what has to be read from the back of the room, so they are the
 * last thing to give.
 */
function planLayout(sizes: number[], chipEm: number, board: BoardMetrics): LayoutPlan {
  const n = sizes.length
  const preferred = Math.max(1, columnsFor(n))
  const chromes = (['normal', 'compact', 'tight'] as const).map((density) => cardChrome(density, board.headerFontPx))
  if (board.width === 0 || n === 0) return { columns: preferred, chipScale: 1, chrome: chromes[0] }
  const width = board.width - GRID_PAD_PX
  const height = board.height - GRID_PAD_PX
  // If nothing fits, the plan that overflows least - the board clips the rest, never scrolls.
  let fallback: LayoutPlan = { columns: preferred, chipScale: CHIP_SCALES[CHIP_SCALES.length - 1], chrome: chromes[2] }
  let fallbackOverflow = Infinity
  for (const chipScale of CHIP_SCALES) {
    const chipW = chipEm * board.fontPx * chipScale
    const chipH = CHIP_HEIGHT_EM * board.fontPx * chipScale
    for (const chrome of chromes) {
      const gap = board.width >= 640 ? chrome.gridGap : 8
      for (let columns = preferred; columns <= n; columns++) {
        const cardW = (width - (columns - 1) * gap) / columns
        const inner = cardW - CARD_BORDER_PX - chrome.bodyPad
        // Narrower than a chip, and every extra column is narrower still.
        if (inner < chipW) break
        const perRow = Math.floor((inner + chrome.chipGap) / (chipW + chrome.chipGap))
        const rows = Math.max(1, ...sizes.map((size) => Math.ceil(size / perRow)))
        const cardH =
          CARD_BORDER_PX + chrome.header + chrome.bodyPad + rows * chipH + (rows - 1) * chrome.chipGap + chrome.strip + chrome.footer
        const gridRows = Math.ceil(n / columns)
        const overflow = gridRows * cardH + (gridRows - 1) * gap - height
        if (overflow <= 0) return { columns, chipScale, chrome }
        if (overflow < fallbackOverflow) {
          fallbackOverflow = overflow
          fallback = { columns, chipScale, chrome }
        }
      }
    }
  }
  return fallback
}

/** Columns for a given number of cards, chosen so the grid is always full - no half-empty last row. */
function columnsFor(count: number): number {
  if (count <= 3) return count
  if (count === 4) return 2
  if (count <= 6) return 3
  if (count <= 8) return 4
  if (count <= 10) return 5
  if (count <= 12) return 4
  return 5
}

interface ChipSlot {
  studentId: string
  group: StudentGroup
  /** Deal order: round-robin across the groups, the way a hand is dealt. */
  index: number
}

/**
 * The activity itself: one card per group, each with its members and its own score.
 *
 * Moving a student is tap, then tap - lift a chip, tap the card it belongs in. Dragging
 * was tried and taken out: on a touch board it fights with scrolling, and one way to do a
 * thing is easier to teach than two. Building groups by hand is deliberately not a mode,
 * since with thirty students that's sixty taps before the lesson can start.
 */
export function GroupActivity({
  groups,
  studentsById,
  pointsMode,
  dealTick,
  canShuffle,
  onAdjustPoints,
  onMove,
  onRename,
  onNewGroups,
  onShuffle,
  onExit,
  onSetStatus,
  chimes,
  locked,
  onToggleLock,
}: GroupActivityProps) {
  /** The chip that's been picked up and is waiting for a card to be tapped. */
  const [lifted, setLifted] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<StudentGroup | null>(null)
  /**
   * How many chips have left the stack; Infinity while no deal is running. A fresh deal
   * starts in the stack from the first frame, so the chips never flash up in the cards
   * before gathering - only a shuffle gathers from cards the teacher has actually seen.
   */
  const [dealt, setDealt] = useState(() => (dealTick === 0 ? Infinity : 0))
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const [board, setBoard] = useState<BoardMetrics>({ width: 0, height: 0, fontPx: 16, headerFontPx: 16 })

  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const update = () => {
      // The same clamp(1rem, 2.2vmin, 1.4rem) the group name renders at.
      const vmin = Math.min(window.innerWidth, window.innerHeight)
      setBoard({
        width: el.clientWidth,
        height: el.clientHeight,
        fontPx: parseFloat(getComputedStyle(el).fontSize) || 16,
        headerFontPx: Math.min(22.4, Math.max(16, 0.022 * vmin)),
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const slots = useMemo(() => {
    const out: ChipSlot[] = []
    const longest = Math.max(0, ...groups.map((g) => g.studentIds.length))
    for (let r = 0; r < longest; r++) {
      groups.forEach((group) => {
        const studentId = group.studentIds[r]
        if (studentId && studentsById.has(studentId)) out.push({ studentId, group, index: out.length })
      })
    }
    return out
  }, [groups, studentsById])
  const slotById = useMemo(() => new Map(slots.map((s) => [s.studentId, s])), [slots])

  /**
   * One chip width for the whole class, from its longest name - so the chips line up in rows
   * like the desks do, instead of a ragged run of different lengths. A name past the cap
   * shrinks inside its chip rather than widening every chip on the board.
   */
  const chipEm = useMemo(() => {
    let widest = 0
    slots.forEach(({ studentId }) => {
      const s = studentsById.get(studentId)
      if (s) widest = Math.max(widest, textWidthEm(s.name) + textWidthEm(s.homeroom) * 0.72)
    })
    return Math.min(CHIP_MAX_EM, Math.max(CHIP_MIN_EM, widest + CHIP_CHROME_EM))
  }, [slots, studentsById])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // The deal: every chip gathers into one stack in the middle of the board, then they're
  // dealt out one at a time into the cards. Framer's layoutId carries each chip between the
  // two places, so the same element appears to fly.
  useEffect(() => {
    if (dealTick === 0) return
    clearTimers()
    setLifted(null)
    setDealt(0)
    playShuffle()
    const total = slots.length
    for (let i = 1; i <= total; i++) {
      timers.current.push(
        setTimeout(
          () => {
            setDealt(i)
            playCardDeal()
          },
          GATHER_MS + (i - 1) * DEAL_STAGGER_MS,
        ),
      )
    }
    timers.current.push(setTimeout(() => setDealt(Infinity), GATHER_MS + total * DEAL_STAGGER_MS + 50))
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealTick])

  function setStatus(group: StudentGroup, status: GroupStatus) {
    if ((group.status ?? 'working') === status) return
    onSetStatus(group.id, status)
    if (!chimes) return
    if (status === 'help') playStatusHelp()
    else if (status === 'ready') playStatusReady()
    else if (status === 'done') playStatusDone()
  }

  function move(studentId: string, groupId: string) {
    const from = groups.find((g) => g.studentIds.includes(studentId))
    setLifted(null)
    if (!from || from.id === groupId) return
    onMove(studentId, groupId)
    playCardFlip()
  }

  // A chip lifted before the lock was tapped stays lifted in state but not on screen, so a
  // student can't complete a move the teacher started.
  const liftedChip = locked ? null : lifted
  const dealing = dealt !== Infinity
  const inStack = dealing ? slots.filter((s) => s.index >= dealt) : []
  const { columns, chipScale, chrome } = planLayout(
    groups.map((g) => g.studentIds.length),
    chipEm,
    board,
  )
  const d = DENSITY[chrome.density]
  const gridGap = board.width >= 640 ? chrome.gridGap : 8
  const chipFont = `calc(var(--chip-font) * ${chipScale})`

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-2" style={{ ['--chip-font' as string]: 'clamp(1.05rem, 2.2vmin, 1.45rem)' }}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <TactileButton onClick={onNewGroups} disabled={dealing || locked} className="!px-3 !py-2">
            <Users size={16} /> New Groups
          </TactileButton>
          <TactileButton
            onClick={onShuffle}
            disabled={!canShuffle || dealing || locked}
            className="!px-3 !py-2"
            title={canShuffle ? 'Deal these groups again' : 'Tap New Groups to shuffle'}
          >
            <Shuffle size={16} /> Shuffle
          </TactileButton>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground"
            title={
              pointsMode === 'students'
                ? 'Every student gets a star for each of their group’s points'
                : 'Each group point becomes one class point on the goal meter'
            }
          >
            {pointsMode === 'students' ? <Users size={15} /> : <Target size={15} />}
            <span className="hidden sm:inline">{pointsMode === 'students' ? 'Stars to each student' : 'Points to class goal'}</span>
          </span>
          {/* For when students come up to the board to change their own light: nothing else
              answers to a tap until the teacher unlocks. */}
          <TactileButton
            active={locked}
            onClick={onToggleLock}
            disabled={dealing}
            className="!px-3 !py-2"
            title={
              locked
                ? 'Names and scores are frozen; only the status lights work. Tap to unlock.'
                : 'Freeze names and scores so students can tap their own status light'
            }
          >
            {locked ? <Lock size={16} /> : <LockOpen size={16} />} {locked ? 'Locked' : 'Lock'}
          </TactileButton>
          <TactileButton onClick={onExit} disabled={dealing || locked} className="!px-3 !py-2">
            <LogOut size={16} /> Exit Group Activity
          </TactileButton>
        </div>
      </div>

      <div ref={boardRef} className="relative min-h-0 flex-1" style={{ fontSize: 'var(--chip-font)' }}>
        {/* Never scrolls: planLayout picks columns and chip size so the cards fit. They sit
            centred on the board, fit their contents, and every card in a deal shares the
            tallest one's height (the 1fr rows of an auto-height grid), so a lopsided group
            can't make its card the odd one out. */}
        <div className="flex h-full flex-col overflow-hidden">
          <div
            className="my-auto grid p-0.5 text-base"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: '1fr', gap: gridGap }}
          >
            {groups.map((group) => {
              const fg = groupTextColor(group.color)
              const liftedHere = liftedChip !== null && group.studentIds.includes(liftedChip)
              const dropTarget = liftedChip !== null && !liftedHere
              return (
                <motion.section
                  key={group.id}
                  layout
                  data-group-id={group.id}
                  data-ink="group-card"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  onClick={() => lifted && !locked && move(lifted, group.id)}
                  className={clsx(
                    'relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-[3px] bg-card text-card-foreground shadow-md',
                    dropTarget && 'cursor-pointer',
                  )}
                  // A real border, not a ring outside the card: a ring is clipped wherever a card
                  // meets the edge of the board, and showed up on some sides and not others.
                  style={{ borderColor: group.color }}
                >
                  {/* The colour band is the group's name tag - it's what the class will call them. */}
                  <header className={clsx('flex shrink-0 items-center px-3', d.headerPad)} style={{ background: group.color, color: fg }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        if (lifted || locked) return
                        e.stopPropagation()
                        setRenaming(group)
                      }}
                      title="Rename this group"
                      className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-left font-extrabold leading-tight hover:bg-white/15 active:scale-[0.98]"
                      style={{ fontSize: `calc(clamp(1rem, 2.2vmin, 1.4rem) * ${d.nameScale})` }}
                    >
                      <span className="truncate">{group.name}</span>
                      <Pencil size={13} className="shrink-0 opacity-60" />
                    </button>
                  </header>

                  <div className={clsx('relative min-h-0 flex-1', d.bodyPad)}>
                    {dropTarget && (
                      <div
                        className="pointer-events-none absolute inset-1 animate-pulse rounded-xl border-2 border-dashed"
                        style={{ borderColor: group.color }}
                      />
                    )}
                    <div className={clsx('flex flex-wrap content-start justify-center', d.chipGap)} style={{ fontSize: chipFont }}>
                      {group.studentIds.length === 0 && (
                        <span className="w-full py-3 text-center text-sm font-medium text-muted-foreground">
                          Empty - tap here to move someone in
                        </span>
                      )}
                      {group.studentIds.map((studentId) => {
                        const student = studentsById.get(studentId)
                        const slot = slotById.get(studentId)
                        if (!student || !slot) return null
                        // Still in the stack: hold its place, so the card keeps its height
                        // through the deal instead of growing chip by chip.
                        if (dealing && slot.index >= dealt) return <Chip key={studentId} student={student} widthEm={chipEm} placeholder />
                        const isLifted = liftedChip === studentId
                        return (
                          <Chip
                            key={studentId}
                            student={student}
                            widthEm={chipEm}
                            tint={group.color}
                            lifted={isLifted}
                            // A tap anywhere on another card means "move here", chips
                            // included - the teacher is aiming at the card, not the name.
                            onClick={() => {
                              if (locked) return
                              if (dropTarget) move(lifted!, group.id)
                              else setLifted(isLifted ? null : studentId)
                            }}
                            title={isLifted ? 'Now tap the group to move them to' : 'Tap, then tap another group to move them'}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* The status lights: one lit with its word, three dim. One tap goes straight
                      to any state - no cycling past the one you wanted. This is the one
                      control that stays live for students when the board is locked. */}
                  <div
                    data-status-strip
                    className={clsx(
                      'flex shrink-0 items-center justify-center gap-1.5 border-t border-black/5 px-2 dark:border-white/10',
                      d.stripPad,
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {STATUSES.map((status) => {
                      const lit = (group.status ?? 'working') === status.id
                      const Icon = status.icon
                      return (
                        <motion.button
                          key={status.id}
                          type="button"
                          layout
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          onClick={() => setStatus(group, status.id)}
                          disabled={dealing}
                          title={lit ? status.label : `Set to ${status.label}`}
                          data-status={status.id}
                          data-lit={lit || undefined}
                          className={clsx(
                            'flex shrink-0 items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-colors active:scale-95',
                            d.light,
                            lit
                              ? `${d.lit} shadow-sm`
                              : `${d.dim} bg-black/5 text-foreground/45 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20`,
                            lit && status.id === 'help' && 'status-help-pulse',
                          )}
                          style={{
                            background: lit ? status.bg : undefined,
                            color: lit ? status.fg : undefined,
                            fontSize: 'clamp(0.8rem, 1.5vmin, 1rem)',
                            touchAction: 'manipulation',
                          }}
                        >
                          <Icon size={d.icon} strokeWidth={2.5} />
                          {lit && <span>{status.label}</span>}
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* The same +/- as the side panel - one size for a point, wherever it's given. */}
                  <footer
                    className={clsx(
                      'flex shrink-0 items-center justify-center gap-2 border-t border-black/5 dark:border-white/10',
                      d.footerPad,
                    )}
                  >
                    <TactileButton
                      onClick={(e) => {
                        e.stopPropagation()
                        if (group.points === 0) return
                        onAdjustPoints(group.id, -1)
                        playPointDeduct()
                      }}
                      disabled={group.points === 0 || dealing || locked}
                      title="Take a point away"
                      className={clsx('shrink-0 !px-0 justify-center', d.button)}
                    >
                      <Minus size={d.sign} strokeWidth={2.75} />
                    </TactileButton>
                    <span className={clsx('flex items-center justify-center gap-1 px-1 font-extrabold tabular-nums', d.score)}>
                      <Star size={d.star} className="fill-amber-500 text-amber-500" strokeWidth={0} />
                      <motion.span
                        key={group.points}
                        initial={{ scale: 1.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                      >
                        {group.points}
                      </motion.span>
                    </span>
                    <TactileButton
                      onClick={(e) => {
                        e.stopPropagation()
                        onAdjustPoints(group.id, 1)
                        playPointAward()
                      }}
                      disabled={dealing || locked}
                      title="Give a point"
                      className={clsx('shrink-0 !px-0 justify-center', d.button)}
                    >
                      <Plus size={d.sign} strokeWidth={2.75} />
                    </TactileButton>
                  </footer>
                </motion.section>
              )
            })}
          </div>
        </div>

        {/* The stack the chips are dealt from. The next chip to go sits on top. */}
        {dealing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ fontSize: chipFont }}>
            <div className="relative" style={{ width: `${chipEm}em`, height: '2.25em' }}>
              {[...inStack].reverse().map((slot) => {
                const student = studentsById.get(slot.studentId)
                if (!student) return null
                // Offsets come from the chip's own deal position, so a waiting chip's box never
                // changes as the ones above it leave. Any change would start a layout animation
                // on it, and framer's shared-layout pass then re-mixes its opacity from a stale
                // snapshot - which faded the whole stack out on the second chip dealt.
                const depth = slots.length - 1 - slot.index
                return (
                  <div
                    key={slot.studentId}
                    className="absolute inset-0"
                    style={{
                      transform: `translate(${(depth % 3) - 1}px, ${-Math.min(depth, 12) * 0.6}px) rotate(${((slot.index * 7) % 5) - 2}deg)`,
                    }}
                  >
                    <Chip student={student} widthEm={chipEm} stacked />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <RenameGroupModal
        group={renaming}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          if (renaming) onRename(renaming.id, name)
          setRenaming(null)
        }}
      />
    </div>
  )
}

interface ChipProps {
  student: Student
  widthEm: number
  /** The group's colour, washed out behind the name. Neutral while in the stack. */
  tint?: string
  lifted?: boolean
  /** Holds a dealt chip's place in its card while it's still in the stack. */
  placeholder?: boolean
  stacked?: boolean
  onClick?: () => void
  title?: string
}

/** A student's name tag: homeroom number and name, one size for the whole class. */
function Chip({ student, widthEm, tint, lifted, placeholder, stacked, onClick, title }: ChipProps) {
  // A name too long for the chip shrinks to fit rather than being cut off - it's the one
  // student whose name is long, and "Alexandr…" on a scoreboard is worse than small type.
  const needed = textWidthEm(student.name) + textWidthEm(student.homeroom) * 0.72 + CHIP_CHROME_EM
  const nameScale = needed > widthEm ? Math.max(0.6, (widthEm - CHIP_CHROME_EM) / (needed - CHIP_CHROME_EM)) : 1
  const className = clsx(
    // A fixed height, so a chip whose name had to shrink stays the same size as its neighbours.
    // Any clipping happens at the chip, never at the name: a name box clipped at one line
    // height cut the tails off every y and g.
    'flex h-[2.25em] shrink-0 items-center gap-[0.35em] overflow-hidden rounded-full px-[0.8em] font-bold leading-tight shadow-sm select-none disabled:cursor-default',
    placeholder ? 'invisible' : 'text-card-foreground',
    stacked && 'bg-card ring-1 ring-black/10 dark:ring-white/15',
    lifted && 'z-20 ring-[3px] ring-amber-400',
  )
  const style = { width: `${widthEm}em`, background: tint ? `${tint}22` : undefined }
  const inner = (
    <>
      <span className="shrink-0 text-[0.72em] font-semibold opacity-50">{student.homeroom}</span>
      <span className="whitespace-nowrap" style={{ fontSize: `${nameScale}em` }}>
        {student.name}
      </span>
    </>
  )

  if (placeholder) {
    return (
      <div className={className} style={style} aria-hidden>
        {inner}
      </div>
    )
  }
  return (
    <motion.button
      type="button"
      // In the stack a chip only ever needs to fly in (layoutId does that on mount); its own
      // box must not animate while it waits, or the deal above re-mixes its opacity.
      layout={!stacked}
      layoutId={`chip-${student.id}`}
      // A chip flies from the stack to its card as one solid thing. Framer's default is to
      // crossfade shared-layout elements, which also dimmed every chip still in the stack.
      layoutCrossfade={false}
      // No opacity in the entrance: framer takes a chip's start opacity for its flight from
      // the last snapshot, and a chip still fading in would then fly in half-faded.
      initial={stacked ? { scale: 0.6 } : false}
      animate={{ scale: lifted ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      disabled={stacked}
      title={title}
      className={className}
      style={{ ...style, touchAction: 'manipulation' }}
    >
      {inner}
    </motion.button>
  )
}

/** The one place typing is allowed, and it's optional: "Group 3" is a fine name. */
function RenameGroupModal({ group, onClose, onSave }: { group: StudentGroup | null; onClose: () => void; onSave: (name: string) => void }) {
  return (
    <Modal open={group !== null} onClose={onClose} title="Rename Group">
      {/* Keyed so each group opens with its own name, without an effect to copy it in. */}
      <RenameForm key={group?.id ?? 'none'} group={group} onClose={onClose} onSave={onSave} />
    </Modal>
  )
}

function RenameForm({ group, onClose, onSave }: { group: StudentGroup | null; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(group?.name ?? '')
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(name)
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={24}
        autoFocus
        placeholder={group?.name}
        className="text-lg font-bold"
      />
      <div className="flex gap-2">
        <TactileButton type="button" onClick={onClose} className="flex-1 justify-center">
          Cancel
        </TactileButton>
        <TactileButton type="submit" active className="flex-1 justify-center">
          Save
        </TactileButton>
      </div>
    </form>
  )
}
