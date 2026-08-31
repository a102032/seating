import { motion } from 'framer-motion'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

interface FlipDigitProps {
  value: string
  warning: boolean
}

/** Fills its parent box, showing only the top or bottom crop of the full glyph. */
function Face({ value, warning, half }: { value: string; warning: boolean; half: 'top' | 'bottom' }) {
  return (
    <div
      className={clsx(
        'absolute inset-0 overflow-hidden font-mono font-black tabular-nums transition-colors duration-300',
        warning ? 'bg-rose-600 text-rose-50' : 'bg-neutral-800 text-neutral-50 dark:bg-neutral-700',
      )}
    >
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{ fontSize: 'clamp(1.4rem, 6.5vmin, 4.2rem)', height: '200%', top: half === 'top' ? '0' : '-100%' }}
      >
        {value}
      </div>
    </div>
  )
}

const FLIP_PHASE_MS = 220

export function FlipDigit({ value, warning }: FlipDigitProps) {
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
      className="relative shrink-0 overflow-hidden rounded-lg shadow-lg"
      style={{ perspective: 400, width: 'clamp(2.2rem, 9vmin, 6rem)', aspectRatio: '3 / 4' }}
    >
      {/* Resting plates - top updates the instant a flip starts (hidden behind leaf1 until it clears); bottom updates only once leaf2 finishes. */}
      <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden rounded-t-lg">
        <Face value={topValue} warning={warning} half="top" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden rounded-b-lg">
        <Face value={settled} warning={warning} half="bottom" />
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
          <Face value={settled} warning={warning} half="top" />
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
          <Face value={pending} warning={warning} half="bottom" />
        </motion.div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/40" />
    </div>
  )
}
