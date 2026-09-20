import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../lib/assets'
import { gifUrl as giphyUrl } from '../lib/celebrationGifs'
import { playCoinTick, playGoalCelebration } from '../lib/sound'
import { GoalCelebration } from './GoalCelebration'

interface PointsMeterProps {
  classId: string
  classPoints: number
  goal: number
  /** GIPHY id for the celebration, or empty for the treasure chest. */
  celebrationGifId?: string
  onOpenGoalSettings: () => void
}

interface Sparkle {
  id: number
  /** Percent along the track, so sparkles sit where the coin was when it moved. */
  pct: number
  dx: number
  dy: number
  size: number
  delay: number
}

/** How full the meter has to get before the chest starts straining. */
const RATTLE_FROM = 0.85
/** Start fetching the celebration gif here, so it's decoded before the chest opens. */
const PRELOAD_FROM = 0.7
const CLOSE_UP_MS = 900

const treasure = (name: string) => assetUrl(`/treasure/${name}.svg`)

/**
 * The class goal, as a voyage from the map to the chest.
 *
 * The coin is the class: it rides the leading edge of the fill rather than the bar just
 * growing, so the bar has something in it that moves. The chest starts rattling near the end
 * because the last few points are the exciting ones and nothing used to mark them, and when
 * it opens the celebration erupts from the chest's own position on screen rather than from
 * nowhere. Nothing here changes the row's height - the icons sit in space the 56px row
 * already had.
 */
export function PointsMeter({ classId, classPoints, goal, celebrationGifId, onOpenGoalSettings }: PointsMeterProps) {
  const prevRef = useRef<{ classId: string; value: number } | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'idle' | 'opening' | 'closing'>('idle')
  const [burstOrigin, setBurstOrigin] = useState<{ x: number; y: number } | null>(null)
  const [sparkles, setSparkles] = useState<Sparkle[]>([])
  const [pop, setPop] = useState<{ id: number; amount: number } | null>(null)
  const nextId = useRef(0)
  // Normally mirrors classPoints, but holds at full through the celebration so the bar
  // doesn't snap back to the new run while the chest is still open.
  const [displayPoints, setDisplayPoints] = useState(classPoints)
  // Null until the gif has actually decoded. The chest is what shows otherwise, so a slow
  // or blocked network costs the moment nothing.
  const [readyGif, setReadyGif] = useState<string | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { classId, value: classPoints }
    if (!prev || prev.classId !== classId) {
      setDisplayPoints(classPoints)
      setPhase('idle')
      return
    }

    // A drop means the goal was reached and the total wrapped.
    if (classPoints < prev.value) {
      setDisplayPoints(goal)
      setPhase('opening')
      playGoalCelebration()
      const box = chestRef.current?.getBoundingClientRect()
      setBurstOrigin(box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null)
      return
    }

    if (classPoints > prev.value) {
      const amount = classPoints - prev.value
      setDisplayPoints(classPoints)
      playCoinTick()
      const id = nextId.current++
      setPop({ id, amount })
      const landed = goal > 0 ? Math.min(100, (classPoints / goal) * 100) : 0
      setSparkles((s) => [
        ...s,
        ...Array.from({ length: 7 }, (_, i) => ({
          id: nextId.current++,
          pct: landed,
          dx: -8 - Math.random() * 34,
          dy: (Math.random() - 0.5) * 30,
          size: 3 + Math.random() * 4,
          delay: i * 0.035,
        })),
      ])
      const t = setTimeout(() => {
        setPop((p) => (p?.id === id ? null : p))
        setSparkles((s) => s.slice(-7))
      }, 900)
      return () => clearTimeout(t)
    }
  }, [classId, classPoints, goal])

  // Fetch the gif on approach rather than when the chest opens - starting the download at
  // the moment it's needed means it arrives halfway through, which looks broken.
  const approaching = goal > 0 && classPoints / goal >= PRELOAD_FROM
  useEffect(() => {
    if (!celebrationGifId) {
      setReadyGif(null)
      return
    }
    if (!approaching) return
    const url = giphyUrl(celebrationGifId)
    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (!cancelled) setReadyGif(url)
    }
    img.onerror = () => {
      if (!cancelled) setReadyGif(null)
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [celebrationGifId, approaching])

  /** The celebration is over: shut the lid, send the coin home, then pick up the new total. */
  function finishCelebration() {
    if (phase !== 'opening') return
    setPhase('closing')
    setDisplayPoints(0)
    setTimeout(() => setPhase('idle'), CLOSE_UP_MS)
  }

  const pct = goal > 0 ? Math.min(100, (displayPoints / goal) * 100) : 0
  const open = phase === 'opening'
  const rattling = !open && goal > 0 && pct / 100 >= RATTLE_FROM

  return (
    <div
      className={clsx(
        'relative flex h-14 shrink-0 items-center gap-2.5 overflow-visible rounded-2xl border border-border bg-card/70 px-3 shadow-sm backdrop-blur-xl transition-shadow sm:gap-3 sm:px-4',
        open && 'shadow-[0_0_0_3px_rgba(251,191,36,0.65)]',
      )}
    >
      {/* Where the voyage starts. It unrolls again when a new run begins. */}
      <motion.img
        src={treasure('map')}
        alt=""
        draggable={false}
        className="h-[30px] w-[30px] shrink-0 select-none"
        animate={phase === 'closing' ? { rotate: [0, -9, 6, 0], scale: [1, 1.18, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.7 }}
      />

      <div className="relative h-4 flex-1">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #38bdf8, #a3e635, #facc15)',
              backgroundSize: '200% 100%',
              backgroundPositionX: `${100 - pct}%`,
            }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </div>

        {/* Sparkles are left behind at the point the coin reached, so they trail it. */}
        <AnimatePresence>
          {sparkles.map((s) => (
            <motion.span
              key={s.id}
              className="pointer-events-none absolute top-1/2 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]"
              style={{ left: `${s.pct}%`, width: s.size, height: s.size }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: s.dx, y: s.dy, scale: 0.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, delay: s.delay, ease: 'easeOut' }}
            />
          ))}
        </AnimatePresence>

        {/* The class, travelling. */}
        <motion.img
          src={treasure('star-coin')}
          alt=""
          draggable={false}
          className="pointer-events-none absolute top-1/2 h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 select-none drop-shadow"
          initial={false}
          animate={{ left: `${pct}%`, rotate: open ? [0, 360] : 0 }}
          transition={{
            left: { type: 'spring', stiffness: 120, damping: 18 },
            rotate: { duration: 0.8, repeat: open ? Infinity : 0, ease: 'linear' },
          }}
        />

        <AnimatePresence>
          {pop && (
            <motion.span
              key={pop.id}
              className="pointer-events-none absolute -top-1 text-xs font-extrabold text-amber-600 drop-shadow-sm dark:text-amber-300"
              style={{ left: `${pct}%` }}
              initial={{ opacity: 0, y: 4, scale: 0.7 }}
              animate={{ opacity: 1, y: -18, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85 }}
            >
              +{pop.amount}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Where it's going. Straining near the end, then open. */}
      <button
        type="button"
        onClick={onOpenGoalSettings}
        title="Class goal settings"
        className="shrink-0 rounded-xl p-0.5 transition-transform active:scale-90"
      >
        <motion.div
          ref={chestRef}
          animate={
            open
              ? { rotate: 0, scale: [1, 1.35, 1.15], y: [0, -6, 0] }
              : rattling
                ? { rotate: [0, -6, 6, -4, 4, 0], scale: [1, 1.06, 1], y: [0, -2, 0] }
                : { rotate: 0, scale: 1, y: 0 }
          }
          transition={
            open
              ? { duration: 0.55, ease: 'backOut' }
              : rattling
                ? { duration: 0.9, repeat: Infinity, repeatDelay: 0.7 }
                : { duration: 0.25 }
          }
        >
          <img
            src={treasure(open ? 'chest-open' : 'chest-closed')}
            alt=""
            draggable={false}
            className="h-8 w-8 select-none"
          />
        </motion.div>
      </button>

      <motion.span
        key={displayPoints}
        initial={{ scale: 1.35 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 12 }}
        className="shrink-0 font-bold tabular-nums text-foreground"
        style={{ fontSize: 'clamp(0.85rem, 1.6vmin, 1.1rem)' }}
      >
        {displayPoints} / {goal}
      </motion.span>

      {open && <GoalCelebration origin={burstOrigin} gifUrl={readyGif} onDone={finishCelebration} />}
    </div>
  )
}
