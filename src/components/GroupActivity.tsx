import clsx from 'clsx'
import { motion } from 'framer-motion'
import { LogOut, Minus, Pencil, Plus, Shuffle, Star, Target, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { textWidthEm } from '../lib/fitText'
import { groupTextColor } from '../lib/groups'
import { playCardDeal, playCardFlip, playPointAward, playPointDeduct, playShuffle } from '../lib/sound'
import type { GroupPointsMode, Student, StudentGroup } from '../types'
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
}

/** Chips sit in the stack this long before the first one is dealt. */
const GATHER_MS = 520
const DEAL_STAGGER_MS = 55
/** Chip padding and the gap between number and name, in em - the measured text is added to this. */
const CHIP_CHROME_EM = 0.8 * 2 + 0.35
/** The widest a chip may grow for a long name; past this the name shrinks inside the chip instead. */
const CHIP_MAX_EM = 11
const CHIP_MIN_EM = 5.5
/** A card's border and body padding, either side - what it needs beyond one chip's width. */
const CARD_CHROME_PX = 3 * 2 + 8 * 2

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
  /** The board's width and the chip font in px, so the column count can promise every chip fits at full size. */
  const [board, setBoard] = useState({ width: 0, fontPx: 16 })

  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const update = () => setBoard({ width: el.clientWidth, fontPx: parseFloat(getComputedStyle(el).fontSize) || 16 })
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

  function move(studentId: string, groupId: string) {
    const from = groups.find((g) => g.studentIds.includes(studentId))
    setLifted(null)
    if (!from || from.id === groupId) return
    onMove(studentId, groupId)
    playCardFlip()
  }

  const dealing = dealt !== Infinity
  const inStack = dealing ? slots.filter((s) => s.index >= dealt) : []
  // Never more columns than the chips allow: a chip is one size everywhere, so a card
  // must be at least a chip wide, plus its border and padding.
  const gapPx = board.width >= 640 ? 12 : 8
  const cardMinPx = chipEm * board.fontPx + CARD_CHROME_PX
  const maxColumns = board.width > 0 ? Math.max(1, Math.floor((board.width + gapPx) / (cardMinPx + gapPx))) : 99
  const columns = Math.max(1, Math.min(columnsFor(groups.length), maxColumns))

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-2" style={{ ['--chip-font' as string]: 'clamp(1.05rem, 2.2vmin, 1.45rem)' }}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <TactileButton onClick={onNewGroups} disabled={dealing} className="!px-3 !py-2">
            <Users size={16} /> New Groups
          </TactileButton>
          <TactileButton
            onClick={onShuffle}
            disabled={!canShuffle || dealing}
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
          <TactileButton onClick={onExit} disabled={dealing} className="!px-3 !py-2">
            <LogOut size={16} /> Exit Group Activity
          </TactileButton>
        </div>
      </div>

      <div ref={boardRef} className="relative min-h-0 flex-1" style={{ fontSize: 'var(--chip-font)' }}>
        {/* Scrolls only when the cards outgrow the board; otherwise they sit centred on it.
            Cards fit their contents, and every card in a deal shares the tallest one's
            height (the 1fr rows of an auto-height grid), so a lopsided group can't make its
            card the odd one out. Centred with auto margins rather than content-center, so
            the grid's own height stays its content's and nothing is cut off when it scrolls. */}
        <div className="flex h-full flex-col overflow-y-auto">
          <div
            className="my-auto grid gap-2 p-0.5 text-base sm:gap-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}
          >
            {groups.map((group) => {
              const fg = groupTextColor(group.color)
              const liftedHere = lifted !== null && group.studentIds.includes(lifted)
              const dropTarget = lifted !== null && !liftedHere
              return (
                <motion.section
                  key={group.id}
                  layout
                  data-group-id={group.id}
                  data-ink="group-card"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  onClick={() => lifted && move(lifted, group.id)}
                  className={clsx(
                    'relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-[3px] bg-card text-card-foreground shadow-md',
                    dropTarget && 'cursor-pointer',
                  )}
                  // A real border, not a ring outside the card: a ring is clipped wherever a card
                  // meets the edge of the board, and showed up on some sides and not others.
                  style={{ borderColor: group.color }}
                >
                  {/* The colour band is the group's name tag - it's what the class will call them. */}
                  <header className="flex shrink-0 items-center px-3 py-1.5" style={{ background: group.color, color: fg }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        if (lifted) return
                        e.stopPropagation()
                        setRenaming(group)
                      }}
                      title="Rename this group"
                      className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-left font-extrabold leading-tight hover:bg-white/15 active:scale-[0.98]"
                      style={{ fontSize: 'clamp(1rem, 2.2vmin, 1.4rem)' }}
                    >
                      <span className="truncate">{group.name}</span>
                      <Pencil size={13} className="shrink-0 opacity-60" />
                    </button>
                  </header>

                  <div className="relative min-h-0 flex-1 p-2">
                    {dropTarget && (
                      <div
                        className="pointer-events-none absolute inset-1 animate-pulse rounded-xl border-2 border-dashed"
                        style={{ borderColor: group.color }}
                      />
                    )}
                    <div className="flex flex-wrap content-start justify-center gap-2" style={{ fontSize: 'var(--chip-font)' }}>
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
                        const isLifted = lifted === studentId
                        return (
                          <Chip
                            key={studentId}
                            student={student}
                            widthEm={chipEm}
                            tint={group.color}
                            lifted={isLifted}
                            // A tap anywhere on another card means "move here", chips
                            // included - the teacher is aiming at the card, not the name.
                            onClick={() => (dropTarget ? move(lifted!, group.id) : setLifted(isLifted ? null : studentId))}
                            title={isLifted ? 'Now tap the group to move them to' : 'Tap, then tap another group to move them'}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* The same +/- as the side panel - one size for a point, wherever it's given. */}
                  <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-black/5 p-1.5 dark:border-white/10">
                    <TactileButton
                      onClick={(e) => {
                        e.stopPropagation()
                        if (group.points === 0) return
                        onAdjustPoints(group.id, -1)
                        playPointDeduct()
                      }}
                      disabled={group.points === 0 || dealing}
                      title="Take a point away"
                      className="h-[38px] w-[50px] shrink-0 !px-0 justify-center"
                    >
                      <Minus size={20} strokeWidth={2.75} />
                    </TactileButton>
                    <span className="flex min-w-[3.5rem] items-center justify-center gap-1 px-1 text-2xl font-extrabold tabular-nums">
                      <Star size={20} className="fill-amber-500 text-amber-500" strokeWidth={0} />
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
                      disabled={dealing}
                      title="Give a point"
                      className="h-[38px] w-[50px] shrink-0 !px-0 justify-center"
                    >
                      <Plus size={20} strokeWidth={2.75} />
                    </TactileButton>
                  </footer>
                </motion.section>
              )
            })}
          </div>
        </div>

        {/* The stack the chips are dealt from. The next chip to go sits on top. */}
        {dealing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
                    style={{ transform: `translate(${(depth % 3) - 1}px, ${-Math.min(depth, 12) * 0.6}px) rotate(${((slot.index * 7) % 5) - 2}deg)` }}
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
    'flex h-[2.25em] shrink-0 items-center gap-[0.35em] rounded-full px-[0.8em] font-bold leading-none shadow-sm select-none',
    placeholder ? 'invisible' : 'text-card-foreground',
    stacked && 'bg-card ring-1 ring-black/10 dark:ring-white/15',
    lifted && 'z-20 ring-[3px] ring-amber-400',
  )
  const style = { width: `${widthEm}em`, background: tint ? `${tint}22` : undefined }
  const inner = (
    <>
      <span className="shrink-0 text-[0.72em] font-semibold opacity-50">{student.homeroom}</span>
      <span className="truncate" style={{ fontSize: `${nameScale}em` }}>
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
