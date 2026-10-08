import clsx from 'clsx'
import { Lock, LockOpen, LogOut, Minus, Plus, RotateCcw, Shuffle, Star, Users } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { textWidthEm } from '../lib/fitText'
import { groupTextColor } from '../lib/groups'
import {
  playCardDeal,
  playCardFlip,
  playCoinTick,
  playPointDeduct,
  playShuffle,
  playStatusDone,
  playStatusHelp,
  playStatusReady,
} from '../lib/sound'
import type { GroupPick } from '../hooks/useGroupPicker'
import type { GroupStatus, Student, StudentGroup } from '../types'
import { GroupStatusPicker, statusStyle } from './GroupStatusPicker'
import { AbsentIcon } from './AbsentIcon'
import { ConfirmModal } from './ConfirmModal'
import { TactileButton } from './TactileButton'

interface GroupActivityProps {
  groups: StudentGroup[]
  studentsById: Map<string, Student>
  /**
   * Away today. They stay on their team's card - the team is whole again tomorrow - but
   * faded, and the pickers pass them by.
   */
  absentIds: Set<string>
  /**
   * Non-zero asks for a deal: the chips gather into a stack and are dealt out. Bumped for
   * every new deal, and 0 when saved groups are being picked up - those just appear.
   */
  dealTick: number
  canShuffle: boolean
  /** This deal came from the Shuffle button, so it gets the riffle sound. A first deal doesn't. */
  dealWasShuffle: boolean
  onResetPoints: () => void
  onAdjustPoints: (groupId: string, delta: number) => void
  onMove: (studentId: string, groupId: string) => void
  onNewGroups: () => void
  onShuffle: () => void
  onExit: () => void
  onSetStatus: (groupId: string, status: GroupStatus) => void
  /** A soft chime when a group taps Need Help, Ready or Done. */
  chimes: boolean
  /**
   * Students are at the board. Everything that would destroy work is frozen: moving a name,
   * New Groups, Shuffle and Exit. Status and points stay live, because awarding a
   * point for being on task is a normal thing to do in the middle of an activity and
   * unlocking to do it would be backwards.
   */
  locked: boolean
  onToggleLock: () => void
  /** A pick running on the cards: a whole group, or one student out of the groups. */
  pick: GroupPick | null
  /** The group Pick Student is staying in after Pick Group (useGroupPicker), if any. */
  lockedGroupId: string | null
  onDismissPick: () => void
}

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
    statusIcon: 16,
    footerPad: 'p-1.5',
    buttonH: 'h-[38px]',
    score: 'text-2xl',
  },
  compact: {
    headerPad: 'py-1',
    nameScale: 0.85,
    bodyPad: 'p-1.5',
    chipGap: 'gap-1.5',
    statusIcon: 15,
    footerPad: 'p-1',
    buttonH: 'h-8',
    score: 'text-xl',
  },
  tight: {
    headerPad: 'py-0.5',
    nameScale: 0.75,
    bodyPad: 'p-1',
    chipGap: 'gap-1',
    statusIcon: 13,
    footerPad: 'p-0.5',
    buttonH: 'h-7',
    score: 'text-lg',
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
  footer: number
  gridGap: number
}

function cardChrome(density: Density, headerFontPx: number): CardChrome {
  const style = DENSITY[density]
  // The band is as tall as whichever is taller, the group's name or the status chip.
  const headerLine = Math.max(Math.ceil(headerFontPx * style.nameScale * 1.25), style.statusIcon + 8)
  switch (density) {
    case 'normal':
      // header py-1.5 + inner py-0.5; body p-2, gap-2; buttons 38px in p-1.5 + border
      return { density, header: 12 + 4 + headerLine, bodyPad: 16, chipGap: 8, footer: 12 + 38 + 1, gridGap: 12 }
    case 'compact':
      // header py-1; body p-1.5, gap-1.5; buttons h-8 in p-1 + border
      return { density, header: 8 + 4 + headerLine, bodyPad: 12, chipGap: 6, footer: 8 + 32 + 1, gridGap: 8 }
    case 'tight':
      // header py-0.5; body p-1, gap-1; buttons h-7 in p-0.5 + border
      return { density, header: 4 + 4 + headerLine, bodyPad: 8, chipGap: 4, footer: 4 + 28 + 1, gridGap: 8 }
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
        const cardH = CARD_BORDER_PX + chrome.header + chrome.bodyPad + rows * chipH + (rows - 1) * chrome.chipGap + chrome.footer
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
  absentIds,
  dealTick,
  canShuffle,
  dealWasShuffle,
  onResetPoints,
  onAdjustPoints,
  onMove,
  onNewGroups,
  onShuffle,
  onExit,
  onSetStatus,
  chimes,
  locked,
  onToggleLock,
  pick,
  lockedGroupId,
  onDismissPick,
}: GroupActivityProps) {
  /** The chip that's been picked up and is waiting for a card to be tapped. */
  const [lifted, setLifted] = useState<string | null>(null)
  /** The group whose status is being chosen, with the card's rect so the copy can fly from it. */
  const [picking, setPicking] = useState<{ group: StudentGroup; from: DOMRect } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  /**
   * How many chips have left the stack; Infinity while no deal is running. A fresh deal
   * starts in the stack from the first frame, so the chips never flash up in the cards
   * before gathering - only a shuffle gathers from cards the teacher has actually seen.
   */
  const [dealt, setDealt] = useState(() => (dealTick === 0 ? Infinity : 0))
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const [board, setBoard] = useState<BoardMetrics>({ width: 0, height: 0, fontPx: 16, headerFontPx: 16 })

  // Measured before the first paint, so the cards are planned against the real board from the
  // start rather than laid out once at zero size and then again.
  useLayoutEffect(() => {
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
  // dealt out one at a time into the cards. The chip in the stack and the chip in the card
  // are different elements; the glide below makes it look like one chip flying.
  useEffect(() => {
    if (dealTick === 0) return
    clearTimers()
    setLifted(null)
    setDealt(0)
    // The riffle belongs to the Shuffle button. On a first deal there is nothing to shuffle,
    // and playing it there made every new set of groups sound like two sounds at once.
    if (dealWasShuffle) playShuffle()
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

  /*
   * How chips move: whichever element stands for a student right now - in a card or in the
   * stack - is remembered with where it was drawn. After every render, a chip that has moved
   * is put back where it was and handed to the browser to glide home (element.animate, which
   * the graphics chip runs), so gathering, dealing, moving a name to another group and the
   * chips closing up behind it are all the same small glide. This was framer's layoutId on
   * every chip, which re-measured all thirty chips and every card on every render - a +1 on
   * a card kept a board's processor busy for a third of a second.
   */
  const chipEls = useRef(new Map<string, HTMLElement>())
  const chipRefs = useRef(new Map<string, (el: HTMLElement | null) => void>())
  const lastPos = useRef(new Map<string, { x: number; y: number }>())
  function chipRef(studentId: string) {
    let fn = chipRefs.current.get(studentId)
    if (!fn) {
      fn = (el) => {
        if (el) chipEls.current.set(studentId, el)
        else chipEls.current.delete(studentId)
      }
      chipRefs.current.set(studentId, fn)
    }
    return fn
  }
  useLayoutEffect(() => {
    // Every position is read before any glide starts. Starting one makes the browser redo the
    // page's layout before the next read, so reading and starting in turn did it thirty times
    // over on every step of the deal.
    const now = new Map<string, { x: number; y: number }>()
    chipEls.current.forEach((el, studentId) => now.set(studentId, pagePosition(el)))
    chipEls.current.forEach((el, studentId) => {
      const pos = now.get(studentId)!
      const was = lastPos.current.get(studentId)
      if (!was) {
        // A chip with nowhere to fly from: a fresh deal's chips pop into the stack.
        if (el.dataset.stacked) el.animate([{ transform: 'scale(0.6)' }, { transform: 'none' }], { duration: 320, easing: GLIDE_EASING })
        return
      }
      const dx = was.x - pos.x
      const dy = was.y - pos.y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: GLIDE_MS, easing: GLIDE_EASING })
    })
    lastPos.current = now
  })

  function setStatus(group: StudentGroup, status: GroupStatus) {
    if ((group.status ?? 'working') === status) return
    onSetStatus(group.id, status)
    if (!chimes) return
    if (status === 'help') playStatusHelp()
    else if (status === 'ready') playStatusReady()
    else if (status === 'done') playStatusDone()
  }

  /** The live group behind the open picker, so its copy shows the status that was just set. */
  const pickingGroup = picking ? (groups.find((g) => g.id === picking.group.id) ?? picking.group) : null

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
  // Every card in a deal is the same width, so the word is shown on all of them or none.
  const cardWidth = columns > 0 ? (board.width - GRID_PAD_PX - (columns - 1) * gridGap) / columns : 0
  const showStatusLabel = cardWidth >= 235
  // The points row is sized by the card's width, not by the density. Density is chosen to
  // make the cards fit by height, so a board that went to eight columns can leave a card
  // half as wide carrying a row built for a wide one - which is how the buttons ended up
  // clipped at the card's edges. Heights still come from the density, so the layout the
  // planner worked out stays true.
  const points =
    cardWidth >= 260
      ? { width: 'max-w-[50px]', score: 'min-w-[3.5rem]', star: 20, sign: 20 }
      : cardWidth >= 200
        ? { width: 'max-w-11', score: 'min-w-[3rem]', star: 18, sign: 18 }
        : { width: 'max-w-9', score: 'min-w-[2.25rem]', star: 15, sign: 16 }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-2" style={{ ['--chip-font' as string]: 'clamp(1.05rem, 2.2vmin, 1.45rem)' }}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <TactileButton onClick={onNewGroups} disabled={dealing || locked} className="!px-3 !py-2">
            <Users size={16} /> New Groups
          </TactileButton>
          <TactileButton
            onClick={onShuffle}
            disabled={!canShuffle || dealing || locked}
            className="!px-3 !py-2"
            title={canShuffle ? 'Mix everyone up' : 'Tap New Groups to shuffle'}
          >
            <Shuffle size={16} /> Shuffle
          </TactileButton>
          <TactileButton
            onClick={() => setConfirmingReset(true)}
            disabled={dealing || locked || groups.every((g) => g.points === 0)}
            className="!px-3 !py-2"
            title="Set every group's score back to 0"
          >
            <RotateCcw size={16} /> Reset Points
          </TactileButton>
        </div>

        <div className="flex items-center gap-2">
          {/* For when students come up to the board to change their own light: nothing else
              answers to a tap until the teacher unlocks. */}
          <TactileButton
            active={locked}
            onClick={onToggleLock}
            disabled={dealing}
            className="!px-3 !py-2"
            title={
              locked
                ? 'Names are frozen so students can tap their own status. Points still work. Tap to unlock.'
                : 'Freeze the names so students can come up and tap their own status'
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
        {/* A landed pick clears on a tap anywhere, the same as one on the seating chart.
            Chips, the status chip and the score buttons stop the click themselves, so the
            things a teacher might be reaching for still do their own job. */}
        <div className="flex h-full flex-col overflow-hidden" onClick={() => pick && onDismissPick()}>
          <div
            className="my-auto grid p-0.5 text-base"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: '1fr', gap: gridGap }}
          >
            {groups.map((group) => {
              const fg = groupTextColor(group.color)
              const status = statusStyle(group.status)
              const groupPick = pick?.kind === 'group'
              // While Pick Student is staying in a picked group, that group keeps its ring and
              // the others stay faded, so the class can see where the pick is coming from.
              const focusing = groupPick || (pick !== null && lockedGroupId !== null)
              const litCard = groupPick ? pick.flashId === group.id || pick.winnerId === group.id : lockedGroupId === group.id
              const wonCard = groupPick ? pick.winnerId === group.id : focusing && lockedGroupId === group.id
              const liftedHere = liftedChip !== null && group.studentIds.includes(liftedChip)
              const dropTarget = liftedChip !== null && !liftedHere
              return (
                <section
                  key={group.id}
                  data-group-id={group.id}
                  data-ink="group-card"
                  onClick={() => lifted && !locked && move(lifted, group.id)}
                  className={clsx(
                    'relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-[3px] bg-card text-card-foreground shadow-md transition-[scale] duration-300',
                    dropTarget && 'cursor-pointer',
                    status.id === 'help' && 'card-help-pulse',
                    // The lit card is the one not faded. It also had a brightness filter,
                    // repainted on every flash, which the fading already made unnecessary.
                    focusing && !litCard && 'opacity-35',
                    wonCard && 'card-pick-winner scale-[1.04]',
                  )}
                  // A real border, not a ring outside the card: a ring is clipped wherever a card
                  // meets the edge of the board, and showed up on some sides and not others.
                  // Hidden rather than unmounted while its copy is down at the picker, so the
                  // grid keeps its shape and the copy looks like the card itself flew.
                  style={{
                    borderColor: group.color,
                    visibility: picking?.group.id === group.id ? 'hidden' : undefined,
                  }}
                >
                  {/* The colour band is the group's name tag - it's what the class will call them. */}
                  <header className={clsx('flex shrink-0 items-center px-3', d.headerPad)} style={{ background: group.color, color: fg }}>
                    {/* Plain text, not a button. Groups are Group 1, 2, 3 or Boys and Girls
                        and that is enough; a rename field stretching to the status chip was
                        mostly a way for a student to open a dialog by accident. */}
                    <span
                      className="min-w-0 flex-1 truncate font-extrabold leading-tight"
                      style={{ fontSize: `calc(clamp(1rem, 2.2vmin, 1.4rem) * ${d.nameScale})` }}
                    >
                      {group.name}
                    </span>

                    {/* The status target. It stays live when the board is locked - it is the
                        one thing students are here to tap. */}
                    <button
                      type="button"
                      data-status-target={group.status ?? 'working'}
                      disabled={dealing}
                      onClick={(e) => {
                        e.stopPropagation()
                        const card = (e.currentTarget as HTMLElement).closest('[data-group-id]')
                        if (card) setPicking({ group, from: card.getBoundingClientRect() })
                      }}
                      title={`${status.label} - tap to change`}
                      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-bold whitespace-nowrap active:scale-95"
                      // The chip wears the status colour, not a faded white, so it says the
                      // same thing the card body does. The ring in the band's own text colour
                      // keeps it separate when a red group is also asking for help.
                      style={{
                        background: status.color,
                        color: status.fg,
                        boxShadow: `0 0 0 2px ${fg}`,
                        fontSize: `calc(clamp(0.82rem, 1.7vmin, 1.05rem) * ${d.nameScale})`,
                      }}
                    >
                      <status.icon size={d.statusIcon} strokeWidth={2.75} />
                      {showStatusLabel && <span>{status.label}</span>}
                    </button>
                  </header>

                  {/* The body carries the status, because it is the biggest surface a card
                      has. Working has no wash, so a board of working groups looks calm and a
                      single red card is impossible to miss. */}
                  <div className={clsx('relative min-h-0 flex-1', d.bodyPad)} style={{ background: status.wash ?? undefined }}>
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
                        const studentPick = pick?.kind === 'student'
                        return (
                          <Chip
                            key={studentId}
                            chipRef={chipRef(studentId)}
                            student={student}
                            widthEm={chipEm}
                            tint={group.color}
                            plain={status.wash !== null}
                            lifted={isLifted}
                            absent={absentIds.has(studentId)}
                            dimmed={studentPick && pick.flashId !== studentId && pick.winnerId !== studentId}
                            won={studentPick && pick.winnerId === studentId}
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

                  {/* The same +/- as the side panel - one size for a point, wherever it's given. */}
                  <footer
                    className={clsx(
                      'flex shrink-0 items-center justify-center gap-2 border-t border-black/5 dark:border-white/10',
                      d.footerPad,
                    )}
                    // The wash runs to the bottom of the card. Stopping it above the score
                    // left every card two-tone and cut the colour in half at a distance.
                    style={{ background: status.wash ?? undefined }}
                  >
                    <TactileButton
                      onClick={(e) => {
                        e.stopPropagation()
                        if (group.points === 0) return
                        onAdjustPoints(group.id, -1)
                        playPointDeduct()
                      }}
                      disabled={group.points === 0 || dealing}
                      title="Take a point away"
                      // flex-1 with a cap rather than a fixed width: on a wide card they are
                      // the side panel's size, on a narrow one they give ground instead of
                      // pushing each other out of the card.
                      className={clsx('min-w-0 flex-1 !px-0 justify-center', d.buttonH, points.width)}
                    >
                      <Minus size={points.sign} strokeWidth={2.75} />
                    </TactileButton>
                    <span
                      className={clsx(
                        'flex shrink-0 items-center justify-center gap-1 px-1 font-extrabold tabular-nums',
                        d.score,
                        points.score,
                      )}
                    >
                      <Star size={points.star} className="fill-amber-500 text-amber-500" strokeWidth={0} />
                      <span key={group.points} className="count-pop">
                        {group.points}
                      </span>
                    </span>
                    <TactileButton
                      onClick={(e) => {
                        e.stopPropagation()
                        onAdjustPoints(group.id, 1)
                        playCoinTick()
                      }}
                      disabled={dealing}
                      title="Give a point"
                      data-points="award"
                      className={clsx('min-w-0 flex-1 !px-0 justify-center', d.buttonH, points.width)}
                    >
                      <Plus size={points.sign} strokeWidth={2.75} />
                    </TactileButton>
                  </footer>
                </section>
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
                    <Chip chipRef={chipRef(slot.studentId)} student={student} widthEm={chipEm} stacked />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmingReset}
        title="Reset every group's points?"
        message="All the groups go back to 0. Nothing else changes - the groups themselves stay exactly as they are."
        confirmLabel="Yes, Reset"
        cancelLabel="No"
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          onResetPoints()
          setConfirmingReset(false)
        }}
      />

      {pickingGroup && picking && (
        <GroupStatusPicker
          group={pickingGroup}
          studentsById={studentsById}
          chipEm={chipEm}
          from={picking.from}
          onChoose={(next) => setStatus(pickingGroup, next)}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}

interface ChipProps {
  student: Student
  widthEm: number
  /** The group's colour, washed out behind the name. Neutral while in the stack. */
  tint?: string
  /**
   * The body behind this chip is carrying a status wash, so the chip drops its group tint
   * and sits on the plain card colour. Two washes stacked turn every name muddy.
   */
  plain?: boolean
  lifted?: boolean
  /** Away today: faded, with the zzz in place of the homeroom number. */
  absent?: boolean
  /** Someone else is being picked right now, so this name stands back. */
  dimmed?: boolean
  /** This name is the one the picker landed on. */
  won?: boolean
  /** Holds a dealt chip's place in its card while it's still in the stack. */
  placeholder?: boolean
  stacked?: boolean
  /** Hands the chip's element to the glide that moves chips between places. */
  chipRef?: (el: HTMLElement | null) => void
  onClick?: () => void
  title?: string
}

/** How long a chip takes to glide to a new place, and the ease: a touch of overshoot, like the spring it replaced. */
const GLIDE_MS = 450
const GLIDE_EASING = 'cubic-bezier(0.3, 1.15, 0.6, 1)'

/**
 * Where an element sits on the page, from its layout rather than what is drawn: offsets ignore
 * transforms, so a chip still gliding - or the whole board still sliding in - reads as where
 * it will end up, not where it happens to be this frame.
 */
function pagePosition(el: HTMLElement): { x: number; y: number } {
  let x = 0
  let y = 0
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft
    y += node.offsetTop
  }
  return { x, y }
}

/** A student's name tag: homeroom number and name, one size for the whole class. */
function Chip({ student, widthEm, tint, plain, lifted, absent, dimmed, won, placeholder, stacked, chipRef, onClick, title }: ChipProps) {
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
    plain && !stacked && 'bg-card',
    lifted && 'z-20 ring-[3px] ring-amber-400',
    won && 'z-20 shadow-lg ring-[3px] ring-amber-400',
    // Growing a touch when lifted or picked, and fading when someone else is being picked or
    // they're away: CSS, which the graphics chip runs. The glide between places is a
    // transform, so it and this scale never fight.
    !placeholder && 'transition-[scale,opacity] duration-300',
    !placeholder && (lifted || won) && 'scale-[1.06]',
    !placeholder && (dimmed ? 'opacity-30' : absent ? 'opacity-40' : undefined),
  )
  const style = { width: `${widthEm}em`, background: plain || !tint ? undefined : `${tint}22` }
  const inner = (
    <>
      {absent ? (
        <AbsentIcon className="h-[1.1em] w-[1.1em] shrink-0 text-muted-foreground" />
      ) : (
        <span className="shrink-0 text-[0.72em] font-semibold opacity-50">{student.homeroom}</span>
      )}
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
    <button
      type="button"
      ref={chipRef}
      data-stacked={stacked ? '' : undefined}
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
    </button>
  )
}
