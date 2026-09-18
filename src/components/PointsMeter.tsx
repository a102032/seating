import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { playGoalCelebration, playPointAward } from '../lib/sound'

interface PointsMeterProps {
  classId: string
  classPoints: number
  goal: number
  onOpenGoalSettings: () => void
}

interface FloatingPop {
  id: number
  amount: number
}

const CONFETTI_COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']

interface ConfettiPiece {
  id: number
  x: number
  y: number
  rotate: number
  delay: number
  color: string
}

function CelebrationBurst() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  // Randomized per burst in an effect (not during render) so each celebration looks different.
  useEffect(() => {
    setPieces(
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 280,
        y: -(40 + Math.random() * 90),
        rotate: (Math.random() - 0.5) * 360,
        delay: Math.random() * 0.15,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    )
  }, [])

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-visible"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: p.color, left: '50%', top: '50%' }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 70], opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.7, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        className="absolute rounded-full bg-amber-400 px-4 py-1.5 text-sm font-extrabold whitespace-nowrap text-amber-950 shadow-lg"
      >
        🎉 Goal Reached!
      </motion.div>
    </motion.div>
  )
}

/** A horizontal, animated class-wide progress bar toward a teacher-set point goal - meant to be visible and exciting for the whole room, not just the teacher. */
export function PointsMeter({ classId, classPoints, goal, onOpenGoalSettings }: PointsMeterProps) {
  const prevRef = useRef<{ classId: string; value: number } | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [pops, setPops] = useState<FloatingPop[]>([])
  const nextPopId = useRef(0)
  // Normally mirrors classPoints, but during a celebration it holds at "full" so the bar
  // doesn't snap down to the new cycle's value while the confetti is still landing.
  const [displayPoints, setDisplayPoints] = useState(classPoints)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { classId, value: classPoints }
    // Just mounted or switched classes - snap to the new value without celebrating or popping.
    if (!prev || prev.classId !== classId) {
      setDisplayPoints(classPoints)
      return
    }

    if (classPoints < prev.value) {
      setDisplayPoints(goal)
      setCelebrating(true)
      playGoalCelebration()
      const t = setTimeout(() => {
        setCelebrating(false)
        setDisplayPoints(classPoints)
      }, 2200)
      return () => clearTimeout(t)
    }
    if (classPoints > prev.value) {
      const amount = classPoints - prev.value
      setDisplayPoints(classPoints)
      playPointAward()
      const id = nextPopId.current++
      setPops((p) => [...p, { id, amount }])
      const t = setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1100)
      return () => clearTimeout(t)
    }
  }, [classId, classPoints, goal])

  const pct = goal > 0 ? Math.min(100, (displayPoints / goal) * 100) : 0

  if (goal <= 0) {
    return (
      <button
        type="button"
        onClick={onOpenGoalSettings}
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent active:scale-[0.99]"
      >
        <Star size={16} /> Set a class goal to start the points meter
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'relative flex h-14 shrink-0 items-center gap-3 overflow-visible rounded-2xl border border-border bg-card/70 px-4 shadow-sm backdrop-blur-xl transition-shadow',
        celebrating && 'shadow-[0_0_0_3px_rgba(251,191,36,0.6)]',
      )}
    >
      <button
        type="button"
        onClick={onOpenGoalSettings}
        title="Change class goal"
        className="flex shrink-0 items-center gap-1.5 rounded-full p-1 text-amber-500 transition-transform active:scale-90"
      >
        <motion.span animate={celebrating ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.3, 1.3, 1.2, 1.2, 1] } : {}} transition={{ duration: 1.2 }}>
          <Star size={20} className="fill-amber-400" />
        </motion.span>
      </button>

      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #38bdf8, #a3e635, #facc15)', backgroundSize: '200% 100%', backgroundPositionX: `${100 - pct}%` }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
        <AnimatePresence>
          {pops.map((pop) => (
            <motion.span
              key={pop.id}
              className="pointer-events-none absolute right-1 top-0 text-xs font-extrabold text-amber-600 drop-shadow-sm dark:text-amber-300"
              initial={{ opacity: 0, y: 6, scale: 0.7 }}
              animate={{ opacity: 1, y: -20, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              +{pop.amount}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

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

      <AnimatePresence>{celebrating && <CelebrationBurst />}</AnimatePresence>
    </div>
  )
}
