import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, Layers, Settings, Shuffle, X } from 'lucide-react'
import { DEAL_STAGGER_MS, type useFlipDeck } from '../hooks/useFlipDeck'
import type { Student } from '../types'
import { homeroomsToShow } from '../lib/sameNames'
import { FlipCard } from './FlipCard'
import { TactileButton } from './TactileButton'

interface FlipDeckProps {
  deck: ReturnType<typeof useFlipDeck>
  studentsById: Map<string, Student>
  /** Cards show the stars waiting for their student, as the desks do - see starsOnDesks in types.ts. */
  showStars: boolean
  /** Every card shows its homeroom number, as the desks do. */
  showAllHomerooms: boolean
  onOpenSettings: () => void
  onExit: () => void
  /**
   * The layout mock-ups' Teacher's Shelf: the deck's controls go there, out of the children's
   * reach, instead of across the top of the cards. Absent in the app as it is.
   */
  toolbarSlot?: HTMLElement | null
}

export function FlipDeck({ deck, studentsById, showStars, showAllHomerooms, onOpenSettings, onExit, toolbarSlot }: FlipDeckProps) {
  const { cards, columns, inPlay, studentsLeft, phase, settings } = deck
  const { shuffle, tap, activeId, revealAll, hideAll, anyFaceUp } = deck
  const pileRef = useRef<HTMLDivElement>(null)
  // As on the desks: a homeroom number only after a name two students share.
  const tagged = useMemo(() => homeroomsToShow(studentsById.values(), showAllHomerooms), [studentsById, showAllHomerooms])
  /** Where each discarded card has to travel to reach the pile, measured when it was tapped. */
  const [flyTo, setFlyTo] = useState(new Map<string, FlyTo>())
  /** Discards that have finished their flight - the pile counts a card when it lands, not when it leaves. */
  const [landed, setLanded] = useState(new Set<string>())
  const pileCount = cards.filter((c) => c.setAside && landed.has(c.studentId)).length

  function tapCard(studentId: string) {
    const card = cards.find((c) => c.studentId === studentId)
    const pile = pileRef.current?.getBoundingClientRect()
    const el = document.querySelector(`[data-flip-card="${studentId}"]`)?.getBoundingClientRect()
    // Only a card that this tap can put away: the glowing student, or a face-up gift (which goes
    // once its stars are sent, so its flight is measured at every tap and the last one is used).
    const leaving = card?.faceUp && (card.bonus || studentId === activeId)
    if (leaving && pile && el) {
      const pileX = pile.left + pile.width / 2
      const pileY = pile.top + pile.height / 2
      const flight = { x: pileX - (el.left + el.width / 2), y: pileY - (el.top + el.height / 2), scale: PILE_CARD_W / el.width }
      setFlyTo((prev) => new Map(prev).set(studentId, flight))
    }
    tap(studentId)
  }

  function reshuffle() {
    setLanded(new Set())
    shuffle()
  }

  const toolbar = (
    <div
      className={
        toolbarSlot
          ? 'flex h-full items-center gap-2'
          : 'flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm'
      }
    >
      <div className="flex items-center gap-1.5">
        <TactileButton onClick={reshuffle} disabled={phase !== 'ready'} className="!px-3 !py-2">
          <Shuffle size={16} /> Shuffle
        </TactileButton>
        <TactileButton onClick={anyFaceUp ? hideAll : revealAll} disabled={phase !== 'ready'} className="!px-3 !py-2">
          {anyFaceUp ? <EyeOff size={16} /> : <Eye size={16} />}
          {anyFaceUp ? 'Hide All' : 'Reveal All'}
        </TactileButton>
      </div>

      <DiscardPile pileRef={pileRef} count={phase === 'shuffling' ? 0 : pileCount} />

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">
          <Layers size={15} />
          {studentsLeft} left
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          title="Flip card settings"
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent active:scale-95"
        >
          <Settings size={17} />
        </button>
        {/* In the shelf, its Seats button is the way back. */}
        {!toolbarSlot && (
          <button
            type="button"
            onClick={onExit}
            title="Back to the seating chart"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent active:scale-95"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-2">
      {toolbarSlot ? createPortal(toolbar, toolbarSlot) : toolbar}

      {/* A little room on the sides and bottom: the glowing card's outline is drawn outside the
          card, and the board sits in a clipped frame (so it can slide over the desks), which cut
          the outline off on any card touching an edge. */}
      <div className="relative min-h-0 flex-1 px-1 pb-1">
        {phase === 'shuffling' ? (
          <ShuffleStack count={Math.max(inPlay.length, 1)} />
        ) : (
          // Every card keeps its slot for the whole round. A discarded card leaves an empty
          // space rather than letting the rest close up, so nothing grows, shrinks or moves
          // while the class is looking for the card they meant to pick.
          <div
            className="grid h-full w-full auto-rows-fr gap-2 sm:gap-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {cards.map((card, index) => {
              // The short row goes on top, not the bottom: the bottom rows are the ones a
              // small child can reach, so those are the ones that stay full. It starts at the
              // left like a line of writing, so the empty spaces sit together at the top right,
              // and the card after it starts the next row.
              const gaps = (columns - (cards.length % columns)) % columns
              const topRow = columns - gaps
              const gridColumnStart = gaps !== 0 && index === topRow ? 1 : undefined
              // Dealt bottom row first, left to right, and up: the board fills the way the
              // layout reads, and the short row is the last one to land.
              const rows = Math.ceil(cards.length / columns)
              const row = index < topRow ? 0 : 1 + Math.floor((index - topRow) / columns)
              const column = index < topRow ? index : (index - topRow) % columns
              const dealOrder = (rows - 1 - row) * columns + column
              const student = card.bonus ? undefined : studentsById.get(card.studentId)
              if (!card.bonus && !student) return null
              return (
                // Raised while its card flies out, so it crosses the board over the other cards.
                <div key={card.studentId} className={clsx('relative min-h-0', card.setAside && 'z-20')} style={{ gridColumnStart }}>
                  <AnimatePresence
                    custom={flyTo.get(card.studentId)}
                    onExitComplete={() => setLanded((prev) => new Set(prev).add(card.studentId))}
                  >
                    {!card.setAside && (
                      // The deal is a CSS animation (flip-card-deal in index.css) so the graphics
                      // chip flies the cards in: framer moved all thirty frame by frame. Framer
                      // keeps the discard, one card at a time, which needs AnimatePresence.
                      <motion.div
                        variants={CARD_VARIANTS}
                        initial={false}
                        animate="placed"
                        exit="discarded"
                        className={clsx('h-full min-h-0', phase === 'dealing' && 'flip-card-deal')}
                        style={phase === 'dealing' ? { animationDelay: `${dealOrder * DEAL_STAGGER_MS}ms` } : undefined}
                      >
                        <FlipCard
                          id={card.studentId}
                          student={student}
                          bonus={card.bonus}
                          gift={card.gift}
                          back={card.back}
                          faceUp={card.faceUp}
                          showStars={showStars}
                          showHomeroom={tagged.has(card.studentId)}
                          genderColors={settings.genderColors}
                          active={card.studentId === activeId}
                          dimmed={card.faceUp && card.spent}
                          onTap={() => tapCard(card.studentId)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}

        {studentsLeft === 0 && phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="rounded-2xl bg-card px-6 py-4 text-center shadow-xl">
              <p className="text-lg font-bold text-card-foreground">Every card has been picked!</p>
              <p className="mt-1 text-sm text-muted-foreground">Tap Shuffle to deal a fresh deck.</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

interface FlyTo {
  x: number
  y: number
  scale: number
}

/** A card on the pile, which is what a put-away card shrinks to as it lands. */
const PILE_CARD_W = 28
const PILE_PATTERN =
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 3px, transparent 3px 6px), linear-gradient(to bottom right, #a78bfa, #7c3aed)'

const CARD_VARIANTS = {
  placed: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 },
  // Straight onto the pile, shrinking to a pile card's size on the way, and gone as it lands.
  discarded: (to?: FlyTo) => ({
    x: to?.x ?? 0,
    y: to?.y ?? 0,
    scale: to?.scale ?? 0.3,
    rotate: 12,
    opacity: [1, 1, 0],
    transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as const, opacity: { duration: 0.55, times: [0, 0.8, 1] } },
  }),
}

/**
 * Where put-away cards land, stacking up as the round burns down. It sits in the middle of the
 * toolbar: in the board's bottom-right corner it covered the card under it (2026-10-05, the
 * teacher). Empty, it is a dashed outline, so the first card has somewhere to fly to.
 */
function DiscardPile({ count, pileRef }: { count: number; pileRef: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={pileRef}
      data-discard-pile={count}
      className="pointer-events-none relative flex h-9 w-16 shrink-0 items-center justify-center"
    >
      {count === 0 ? (
        <div className="h-9 w-7 rounded-md border-2 border-dashed border-border" />
      ) : (
        <>
          {[0, 1, 2].slice(0, Math.min(3, count)).map((i) => (
            <div
              key={i}
              className="absolute h-9 w-7 rounded-md border border-black/10 shadow-sm dark:border-white/10"
              // Fanned, with a card back's stripes, so it reads as a pile of cards and not a button.
              style={{ transform: `rotate(${(i - 1) * 14}deg) translateX(${(i - 1) * 6}px)`, backgroundImage: PILE_PATTERN }}
            />
          ))}
          <span
            // Keyed on the count so each card landing pops it.
            key={count}
            className="count-pop absolute -right-0.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-extrabold leading-none text-amber-950 shadow"
          >
            {count}
          </span>
        </>
      )}
    </div>
  )
}

/** The deck cut into two halves that riffle together, a few times over. */
function ShuffleStack({ count }: { count: number }) {
  const leaves = Array.from({ length: Math.min(count, 10) }, (_, i) => i)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="relative h-56 w-44">
        {leaves.map((i) => {
          const leftHalf = i % 2 === 0
          return (
            <motion.div
              key={i}
              className={clsx(
                'absolute inset-0 rounded-xl border border-black/10 bg-gradient-to-br shadow-lg dark:border-white/10',
                leftHalf ? 'from-violet-400 to-violet-600' : 'from-sky-400 to-sky-600',
              )}
              animate={{
                x: [0, leftHalf ? -90 : 90, 0, leftHalf ? -70 : 70, 0],
                rotate: [0, leftHalf ? -12 : 12, 0, leftHalf ? -8 : 8, 0],
                y: [0, i * -3, 0, i * -2, 0],
              }}
              transition={{ duration: 0.95, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut', delay: i * 0.012 }}
            />
          )
        })}
      </div>
      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        className="text-lg font-bold text-muted-foreground"
      >
        Shuffling…
      </motion.p>
    </div>
  )
}
