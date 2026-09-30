import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { WarningLevel } from '../hooks/useCountdown'

interface FlipDigitProps {
  value: string
  warningLevel: WarningLevel
}

const LEVEL_CLASSES: Record<WarningLevel, string> = {
  none: 'bg-card text-card-foreground',
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

      {/* The two leaves are CSS animations (flip-leaf-* in index.css), so the graphics chip
          turns them: framer drove them frame by frame, every second, for as long as a
          countdown ran. Each leaf moves on to the next phase when its own animation ends -
          the shade inside it ends at the same moment, hence the target check. */}
      {phase === 'leaf1' && pending !== null && (
        <div
          className="flip-leaf-fall absolute inset-x-0 top-0 h-1/2 origin-bottom overflow-hidden rounded-t-lg"
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          onAnimationEnd={(e) => e.target === e.currentTarget && setPhase('leaf2')}
        >
          <Face value={settled} warningLevel={warningLevel} half="top" />
          <div className="flip-leaf-shade-in absolute inset-0 bg-black" />
        </div>
      )}

      {phase === 'leaf2' && pending !== null && (
        <div
          className="flip-leaf-rise absolute inset-x-0 bottom-0 h-1/2 origin-top overflow-hidden rounded-b-lg"
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return
            setSettled(pending)
            setPending(null)
            setPhase('idle')
          }}
        >
          <Face value={pending} warningLevel={warningLevel} half="bottom" />
          <div className="flip-leaf-shade-out absolute inset-0 bg-black" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/15 dark:bg-black/40" />
    </div>
  )
}
