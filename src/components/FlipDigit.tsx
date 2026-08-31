import { motion } from 'framer-motion'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { WarningLevel } from '../hooks/useCountdown'

interface FlipDigitProps {
  value: string
  warningLevel: WarningLevel
}

const LEVEL_CLASSES: Record<WarningLevel, string> = {
  none: 'bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50',
  yellow: 'bg-amber-400 text-amber-950',
  orange: 'bg-orange-500 text-white',
  red: 'bg-rose-600 text-rose-50',
}

/** Fills its parent box, showing only the top or bottom crop of the full glyph. */
function Face({ value, warningLevel, half }: { value: string; warningLevel: WarningLevel; half: 'top' | 'bottom' }) {
  return (
    <div
      className={clsx(
        'absolute inset-0 overflow-hidden border border-black/5 font-mono font-black tabular-nums transition-colors duration-300 dark:border-white/10',
        LEVEL_CLASSES[warningLevel],
      )}
    >
      <div
        className={clsx(
          'absolute inset-x-0 h-1/2',
          half === 'top'
            ? 'top-0 bg-gradient-to-t from-transparent to-black/[0.04] dark:to-white/[0.04]'
            : 'bottom-0 bg-gradient-to-b from-transparent to-black/10 dark:to-black/30',
        )}
      />
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{ fontSize: 'clamp(1.2rem, 78cqw, 4.2rem)', height: '200%', top: half === 'top' ? '0' : '-100%' }}
      >
        {value}
      </div>
    </div>
  )
}

const FLIP_PHASE_MS = 260

export function FlipDigit({ value, warningLevel }: FlipDigitProps) {
  const [settled, setSettled] = useState(value)
  const [pending, setPending] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'leaf1' | 'leaf2'>('idle')

  useEffect(() => {
    if (value !== settled && phase === 'idle') {
      setPending(value)
      setPhase('leaf1')
    }
  }, [value, settled, phase])

  const topValue = pending ?? settled

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden rounded-lg shadow-lg"
      style={{ perspective: 260, aspectRatio: '3 / 4', containerType: 'inline-size' }}
    >
      {/* Resting plates - top updates the instant a flip starts (hidden behind leaf1 until it clears); bottom updates only once leaf2 finishes. */}
      <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden rounded-t-lg">
        <Face value={topValue} warningLevel={warningLevel} half="top" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-b-lg">
        <Face value={settled} warningLevel={warningLevel} half="bottom" />
      </div>

      {phase === 'leaf1' && pending !== null && (
        <motion.div
          className="absolute inset-x-0 top-0 h-1/2 origin-bottom overflow-hidden rounded-t-lg"
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          initial={{ rotateX: 0 }}
          animate={{ rotateX: -90 }}
          transition={{ duration: FLIP_PHASE_MS / 1000, ease: 'easeIn' }}
          onAnimationComplete={() => setPhase('leaf2')}
        >
          <Face value={settled} warningLevel={warningLevel} half="top" />
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            transition={{ duration: FLIP_PHASE_MS / 1000, ease: 'easeIn' }}
          />
        </motion.div>
      )}

      {phase === 'leaf2' && pending !== null && (
        <motion.div
          className="absolute inset-x-0 bottom-0 h-1/2 origin-top overflow-hidden rounded-b-lg"
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          initial={{ rotateX: 90 }}
          animate={{ rotateX: 0 }}
          transition={{ duration: FLIP_PHASE_MS / 1000, ease: 'easeOut' }}
          onAnimationComplete={() => {
            setSettled(pending)
            setPending(null)
            setPhase('idle')
          }}
        >
          <Face value={pending} warningLevel={warningLevel} half="bottom" />
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0 }}
            transition={{ duration: FLIP_PHASE_MS / 1000, ease: 'easeOut' }}
          />
        </motion.div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/15 dark:bg-black/40" />
    </div>
  )
}
