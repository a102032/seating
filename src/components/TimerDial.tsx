import { useEffect, useState, type CSSProperties } from 'react'

/** The red, the same in every theme: it *is* the time left, as the group colours are the groups. */
const DIAL_RED = '#ef4444'
const WEDGE_R = 39

interface TimerDialProps {
  /** The time the countdown was set to. The red starts as a full circle for any time. */
  configuredSeconds: number
  remainingSeconds: number
  /** When a running countdown ends; null when paused or stopped. */
  endsAt: number | null
  /** The time ran out and nobody has reset it yet. */
  timesUp: boolean
  className?: string
  style?: CSSProperties
}

/**
 * A Time Timer-style dial: the red is the time left and shrinks back towards the top as it
 * runs, the way the teacher's Gynzy timer does, so a child who can't yet read "4:53" can see
 * how much is left.
 *
 * The red always starts as a full circle for the time set, rather than on a 60-minute face:
 * at side-panel size a 3-minute timer on a 60-minute face would be a sliver that barely moves.
 * No numbers round the edge for the same reason - they'd be too small to read from the back.
 */
export function TimerDial({ configuredSeconds, remainingSeconds, endsAt, timesUp, className, style }: TimerDialProps) {
  // Redrawn every frame while running, so the red shrinks smoothly rather than in one-second steps.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    let frame = requestAnimationFrame(function tick() {
      setNow(Date.now())
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [endsAt])

  let fraction = 0
  if (configuredSeconds > 0) {
    // `now` is a frame stale on the first draw after Start; the countdown's own second holds it back.
    const msLeft = endsAt !== null ? Math.min(Math.max(0, endsAt - now), remainingSeconds * 1000 + 500) : remainingSeconds * 1000
    fraction = Math.min(1, msLeft / (configuredSeconds * 1000))
  }
  const angle = fraction * 2 * Math.PI
  const handX = 50 + 42 * Math.sin(angle)
  const handY = 50 - 42 * Math.cos(angle)

  return (
    <svg viewBox="0 0 100 100" className={className} style={style} role="img" aria-label={timesUp ? "Time's up" : 'Time left'}>
      <circle cx="50" cy="50" r="48" className="fill-card stroke-black/10 dark:stroke-white/15" strokeWidth="1.5" />
      {!timesUp && <Wedge fraction={fraction} />}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6
        const inner = i % 3 === 0 ? 40 : 42
        return (
          <line
            key={i}
            x1={50 + inner * Math.sin(a)}
            y1={50 - inner * Math.cos(a)}
            x2={50 + 46 * Math.sin(a)}
            y2={50 - 46 * Math.cos(a)}
            className="stroke-card-foreground"
            strokeOpacity={0.5}
            strokeWidth={i % 3 === 0 ? 2.4 : 1.5}
            strokeLinecap="round"
          />
        )
      })}
      {timesUp ? (
        // Where the red was: a pale red disc and the words, breathing slowly until the timer is reset.
        <g className="dial-times-up">
          <circle cx="50" cy="50" r={WEDGE_R} fill={DIAL_RED} fillOpacity={0.14} />
          <text x="50" y="46" textAnchor="middle" fontSize="17" fontWeight="700" className="fill-red-600 dark:fill-red-400">
            Time&rsquo;s
          </text>
          <text x="50" y="65" textAnchor="middle" fontSize="17" fontWeight="700" className="fill-red-600 dark:fill-red-400">
            up!
          </text>
        </g>
      ) : (
        <>
          <line x1="50" y1="50" x2={handX} y2={handY} className="stroke-card-foreground" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="50" cy="50" r="5" className="fill-card stroke-card-foreground" strokeWidth="2.6" />
        </>
      )}
    </svg>
  )
}

/** The red from twelve o'clock, clockwise, as far as the time left reaches. */
function Wedge({ fraction }: { fraction: number }) {
  if (fraction <= 0.0005) return null
  if (fraction >= 0.9995) return <circle cx="50" cy="50" r={WEDGE_R} fill={DIAL_RED} />
  const angle = fraction * 2 * Math.PI
  const x = 50 + WEDGE_R * Math.sin(angle)
  const y = 50 - WEDGE_R * Math.cos(angle)
  const largeArc = fraction > 0.5 ? 1 : 0
  return <path d={`M50 50 L50 ${50 - WEDGE_R} A${WEDGE_R} ${WEDGE_R} 0 ${largeArc} 1 ${x} ${y} Z`} fill={DIAL_RED} />
}
