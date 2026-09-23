import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { ArrowDownRight, Eye, EyeOff, Layers, RotateCcw, Settings, Shuffle, X } from 'lucide-react'
import { DEAL_STAGGER_MS, type FlipMode, type useFlipDeck } from '../hooks/useFlipDeck'
import { DESK_COLUMNS, type Student } from '../types'
import { FlipCard } from './FlipCard'
import { TactileButton } from './TactileButton'

interface FlipDeckProps {
  deck: ReturnType<typeof useFlipDeck>
  studentsById: Map<string, Student>
  onOpenSettings: () => void
  onExit: () => void
}

export function FlipDeck({ deck, studentsById, onOpenSettings, onExit }: FlipDeckProps) {
  const { cards, inPlay, setAsideCount, phase, settings, updateSettings, shuffle, tap, activeId, revealAll, hideAll, anyFaceUp } = deck
  const boardRef = useRef<HTMLDivElement>(null)
  /** Where each discarded card has to travel to reach the pile, measured when it was tapped. */
  const [flyTo, setFlyTo] = useState(new Map<string, FlyTo>())
  /** Discards that have finished their flight - the pile counts a card when it lands, not when it leaves. */
  const [landed, setLanded] = useState(new Set<string>())
  const pileCount = cards.filter((c) => c.setAside && landed.has(c.studentId)).length

  function tapCard(studentId: string) {
    const card = cards.find((c) => c.studentId === studentId)
    const board = boardRef.current?.getBoundingClientRect()
    const el = document.querySelector(`[data-flip-card="${studentId}"]`)?.getBoundingClientRect()
    if (card?.faceUp && settings.flipMode === 'discard' && board && el) {
      // The pile's own box: bottom-2 right-2, w-20 h-24.
      const pileX = board.right - 8 - PILE_W / 2
      const pileY = board.bottom - 8 - PILE_H / 2
      const flight = { x: pileX - (el.left + el.width / 2), y: pileY - (el.top + el.height / 2), scale: PILE_CARD_W / el.width }
      setFlyTo((prev) => new Map(prev).set(studentId, flight))
    }
    tap(studentId)
  }

  function reshuffle() {
    setLanded(new Set())
    shuffle()
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <TactileButton onClick={reshuffle} disabled={phase !== 'ready'} className="!px-3 !py-2">
            <Shuffle size={16} /> Shuffle
          </TactileButton>
          <TactileButton onClick={anyFaceUp ? hideAll : revealAll} disabled={phase !== 'ready'} className="!px-3 !py-2">
            {anyFaceUp ? <EyeOff size={16} /> : <Eye size={16} />}
            {anyFaceUp ? 'Hide All' : 'Reveal All'}
          </TactileButton>
        </div>

        <FlipModeSwitch mode={settings.flipMode} onChange={(flipMode) => updateSettings({ flipMode })} />

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">
            <Layers size={15} />
            {inPlay.length} left
            {setAsideCount > 0 && <span className="font-medium opacity-60">· {setAsideCount} done</span>}
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Flip card settings"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent active:scale-95"
          >
            <Settings size={17} />
          </button>
          <button
            type="button"
            onClick={onExit}
            title="Back to the seating chart"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {phase === 'shuffling' ? (
          <ShuffleStack count={Math.max(inPlay.length, 1)} />
        ) : (
          // Every card keeps its slot for the whole round. A discarded card leaves an empty
          // space rather than letting the rest close up, so nothing grows, shrinks or moves
          // while the class is looking for the card they meant to pick.
          <div
            ref={boardRef}
            className="grid h-full w-full auto-rows-fr gap-2 sm:gap-3"
            style={{ gridTemplateColumns: `repeat(${DESK_COLUMNS}, minmax(0, 1fr))` }}
          >
            {cards.map((card, index) => {
              const student = studentsById.get(card.studentId)
              if (!student) return null
              return (
                // Raised while its card flies out, so it crosses the board over the other cards.
                <div key={card.studentId} className={clsx('relative min-h-0', card.setAside && 'z-20')}>
                  <AnimatePresence
                    custom={flyTo.get(card.studentId)}
                    onExitComplete={() => setLanded((prev) => new Set(prev).add(card.studentId))}
                  >
                    {!card.setAside && (
                      <motion.div
                        variants={CARD_VARIANTS}
                        initial="dealt"
                        animate="placed"
                        exit="discarded"
                        transition={{
                          type: 'spring',
                          stiffness: 260,
                          damping: 24,
                          delay: phase === 'dealing' ? (index * DEAL_STAGGER_MS) / 1000 : 0,
                        }}
                        className="h-full min-h-0"
                      >
                        <FlipCard
                          student={student}
                          faceUp={card.faceUp}
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

        {pileCount > 0 && phase !== 'shuffling' && <DiscardPile count={pileCount} />}

        {inPlay.length === 0 && phase === 'ready' && (
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

const FLIP_MODES: { id: FlipMode; label: string; icon: typeof RotateCcw }[] = [
  { id: 'stay', label: 'Flip Back', icon: RotateCcw },
  { id: 'discard', label: 'Discard', icon: ArrowDownRight },
]

/**
 * What tapping a face-up card does. It lives on the toolbar rather than in settings because
 * it changes the meaning of the tap itself - the teacher should never have to remember it.
 */
function FlipModeSwitch({ mode, onChange }: { mode: FlipMode; onChange: (mode: FlipMode) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm font-semibold text-muted-foreground xl:inline">Tap a picked card to</span>
      <div role="radiogroup" aria-label="Tap a picked card to" className="flex rounded-full bg-secondary p-1">
        {FLIP_MODES.map(({ id, label, icon: Icon }) => {
          const on = mode === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(id)}
              className={clsx(
                'relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors active:scale-95',
                on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {on && (
                <motion.span
                  layoutId="flip-mode-pill"
                  className="absolute inset-0 rounded-full bg-card shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon size={15} className="relative" />
              <span className="relative">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface FlyTo {
  x: number
  y: number
  scale: number
}

const PILE_W = 80
const PILE_H = 96
const PILE_CARD_W = 56

const CARD_VARIANTS = {
  dealt: { opacity: 0, scale: 0.4, x: 0, y: -140, rotate: -12 },
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

/** Where set-aside cards land, stacking up as the round burns down. */
function DiscardPile({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 flex h-24 w-20 items-center justify-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute h-20 w-14 rounded-lg border border-black/10 bg-gradient-to-br from-violet-400 to-violet-600 opacity-90 shadow-lg dark:border-white/10"
          style={{ transform: `rotate(${(i - 1) * 6}deg) translateY(${i * -2}px)` }}
        />
      ))}
      <motion.span
        key={count}
        initial={{ scale: 1.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 12 }}
        className="relative z-10 rounded-full bg-amber-400 px-2.5 py-1 text-sm font-extrabold text-amber-950 shadow-md"
      >
        {count}
      </motion.span>
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
