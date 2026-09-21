import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { assetUrl } from '../lib/assets'
import { goalFanfareDurationMs } from '../lib/sound'

interface GoalCelebrationProps {
  /** Where on screen the chest is, so the burst erupts from it rather than from nowhere. */
  origin: { x: number; y: number } | null
  /** A preloaded gif to show instead of the chest. Null falls back to the chest. */
  gifUrl: string | null
  onDone: () => void
}

// Sized for a smartboard seen from the back of a room: a couple of hundred specks reads as
// a few bits of dust falling, not as a celebration.
const BURST_COUNT = 170
const RAIN_COUNT = 380
/** Launched upward from along the whole bottom edge, not from a single point. */
const FOUNTAIN_COUNT = 240
/**
 * Falling confetti reaches terminal velocity almost at once and then sways - without a cap
 * it accelerates forever and drops like gravel, which is the difference between fluttering
 * and being thrown.
 */
const TERMINAL_VY = 5.2
const COLORS = ['#fb8500', '#ffb703', '#fcd227', '#f43f5e', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  spin: number
  angle: number
  color: string
  star: boolean
  /** Rain waits its turn so the sky keeps producing for the whole celebration. */
  delay: number
  life: number
  /** rain refills from the top, fountain relaunches from the bottom, burst is a one-off. */
  kind: 'burst' | 'rain' | 'fountain'
  /** Phase and width of the side-to-side drift as it falls. */
  phase: number
  sway: number
}

/** Fixed at module load so the drift doesn't reshuffle on every render. */
const CARD_STARS = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: (i * 31) % 96,
  size: 12 + ((i * 13) % 30),
  duration: 6 + ((i * 7) % 50) / 10,
  // Negative delays spread them through the cycle, so the card is already full of stars the
  // instant it appears rather than starting empty.
  delay: -((i * 23) % 110) / 10,
  peak: 0.4 + ((i * 17) % 45) / 100,
  spin: ((i * 53) % 160) - 80,
  pale: i % 3 === 0,
}))

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * radius, Math.sin(a) * radius)
  }
  ctx.closePath()
  ctx.fill()
}

/**
 * Full-screen stars and confetti when the class fills the chest.
 *
 * Drawn on one canvas rather than as elements: a few hundred animated DOM nodes next to
 * thirty desks stutters on a classroom smartboard, and a canvas overlay costs the layout
 * nothing. Tap anywhere to cut it short - it shares the screen with a lesson.
 */
export function GoalCelebration({ origin, gifUrl, onDone }: GoalCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // No particles under reduced motion, and none without a 2d context - the card carries
    // the moment on its own either way, and it waits for the teacher regardless.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = window.innerWidth
    let h = window.innerHeight
    const size = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    // Run for as long as the fanfare does, so the room isn't watching a still screen with
    // music still playing.
    const particleMs = goalFanfareDurationMs()
    const from = origin ?? { x: w / 2, y: h * 0.25 }
    const particles: Particle[] = []

    // The eruption out of the chest. Sprayed in every direction rather than upward: the
    // chest sits at the top of the screen, so an upward burst leaves the viewport before
    // anyone sees it. A full spray plus gravity arcs the treasure out across the board.
    for (let i = 0; i < BURST_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 5 + Math.random() * 13
      particles.push({
        x: from.x,
        y: from.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 7 + Math.random() * 12,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2,
        color: COLORS[i % COLORS.length],
        star: i % 2 === 0,
        delay: 0,
        life: 1,
        kind: 'burst',
        phase: Math.random() * Math.PI * 2,
        sway: 0.5 + Math.random() * 1.1,
      })
    }

    // Then the sky opens, staggered across most of the run so it keeps falling.
    for (let i = 0; i < RAIN_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 2.5 + Math.random() * 3.5,
        size: 7 + Math.random() * 11,
        spin: (Math.random() - 0.5) * 0.2,
        angle: Math.random() * Math.PI * 2,
        color: COLORS[i % COLORS.length],
        star: i % 3 === 0,
        delay: Math.random() * 1200,
        life: 1,
        kind: 'rain',
        phase: Math.random() * Math.PI * 2,
        sway: 0.5 + Math.random() * 1.3,
      })
    }

    // Fired upward from right along the bottom edge, spread across the full width, so the
    // screen fills from below as well as above. Gravity turns each one over at the top of
    // its arc and brings it back down on its own.
    for (let i = 0; i < FOUNTAIN_COUNT; i++) {
      particles.push({
        x: (w * (i + 0.5)) / FOUNTAIN_COUNT + (Math.random() - 0.5) * 30,
        y: h + 12,
        vx: (Math.random() - 0.5) * 3.4,
        vy: -(10 + Math.random() * 10),
        size: 7 + Math.random() * 11,
        spin: (Math.random() - 0.5) * 0.26,
        angle: Math.random() * Math.PI * 2,
        color: COLORS[i % COLORS.length],
        star: i % 4 === 0,
        // Evenly staggered, not randomly: random clumps, and a clump of fountains all
        // launching together gives a big spray then a lull, then another spray.
        delay: (i / FOUNTAIN_COUNT) * 5200 + Math.random() * 320,
        life: 1,
        kind: 'fountain',
        phase: Math.random() * Math.PI * 2,
        sway: 0.5 + Math.random() * 1.3,
      })
    }

    const started = performance.now()
    let raf = 0

    const frame = (now: number) => {
      const elapsed = now - started
      ctx.clearRect(0, 0, w, h)
      // Everything fades together over the last second rather than vanishing.
      const fade = elapsed > particleMs - 1000 ? Math.max(0, (particleMs - elapsed) / 1000) : 1
      // Stop feeding the sky near the end so the last of it can actually land.
      const refilling = elapsed < particleMs - 1600

      for (const p of particles) {
        if (elapsed < p.delay) continue
        // The sway is what makes it flutter rather than fall in a straight line.
        p.x += p.vx + Math.sin(elapsed / 230 + p.phase) * p.sway
        p.y += p.vy
        p.vy = Math.min(p.vy + 0.16, TERMINAL_VY)
        p.vx *= 0.995
        p.angle += p.spin
        if (p.y > h + 40) {
          // Rain and fountains recycle rather than running out: a fixed count can then keep
          // going for any duration, which is what lets this follow the audio.
          if (p.kind === 'burst' || !refilling) continue
          if (p.kind === 'rain') {
            p.x = Math.random() * w
            p.y = -20 - Math.random() * 80
            p.vy = 2.5 + Math.random() * 3.5
            p.vx = (Math.random() - 0.5) * 1.6
          } else {
            // Relaunched from a random depth below the edge, so each one waits a different
            // moment before it climbs back into view. Firing them all the instant they land
            // makes the fountain pulse in waves rather than run continuously.
            p.x = Math.random() * w
            p.y = h + 12 + Math.random() * 900
            p.vy = -(10 + Math.random() * 10)
            p.vx = (Math.random() - 0.5) * 3.4
          }
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.globalAlpha = fade
        ctx.fillStyle = p.color
        if (p.star) drawStar(ctx, p.size)
        else ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66)
        ctx.restore()
      }

      // The particles finish on their own; dismissing is the teacher's call.
      if (elapsed < particleMs) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [origin])

  // Portalled to the body on purpose. The meter has a backdrop-filter, and a
  // backdrop-filter makes its element the containing block for fixed-position descendants -
  // so rendered in place, this "full screen" overlay was confined to the meter's own box.
  return createPortal(
    <div className="fixed inset-0 z-[60]" onPointerDown={() => doneRef.current()}>
      <canvas ref={canvasRef} className="pointer-events-none h-full w-full" />
      {/* One focal point, so the room knows what just happened rather than only seeing
          things fall. A single element - the particles are the canvas's job. */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative flex items-center justify-center">
          {/* Prize-wheel rays behind the card. Cheap - one spinning conic gradient. */}
          <motion.div
            className="absolute h-[140vmin] w-[140vmin] rounded-full opacity-[0.22]"
            style={{
              background:
                'repeating-conic-gradient(#fff 0deg 9deg, transparent 9deg 18deg)',
              maskImage: 'radial-gradient(circle, #000 18%, transparent 62%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 18%, transparent 62%)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
          />
          <div className="absolute h-[70vmin] w-[70vmin] rounded-full bg-amber-300/35 blur-3xl" />

          <motion.div
            className="celebration-card relative flex w-[min(92vw,620px)] flex-col items-center gap-5 overflow-hidden rounded-[2.5rem] border-[6px] border-amber-200 px-10 py-9 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.45)]"
            initial={{ scale: 0.35, rotate: -10, y: 30 }}
            animate={{ scale: [0.35, 1.1, 1], rotate: [-10, 4, 0], y: [30, -8, 0] }}
            transition={{ duration: 0.75, ease: 'backOut' }}
          >
            {/* Behind everything, inside the card's rounded box. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {CARD_STARS.map((st) => (
                <span
                  key={st.id}
                  className="celebration-star"
                  style={
                    {
                      left: `${st.left}%`,
                      width: st.size,
                      height: st.size,
                      '--star-duration': `${st.duration}s`,
                      '--star-delay': `${st.delay}s`,
                      '--star-peak': st.peak,
                      '--star-spin': `${st.spin}deg`,
                    } as React.CSSProperties
                  }
                >
                  <svg viewBox="0 0 24 24" className={st.pale ? 'h-full w-full text-white' : 'h-full w-full text-amber-100'}>
                    <path
                      fill="currentColor"
                      d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"
                    />
                  </svg>
                </span>
              ))}
            </div>

            <motion.div
              className="relative w-full"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              {gifUrl ? (
                <img
                  src={gifUrl}
                  alt=""
                  className="mx-auto max-h-[42vh] w-auto max-w-full rounded-2xl border-4 border-amber-100 object-contain shadow-lg"
                />
              ) : (
                <img
                  src={assetUrl('/treasure/chest-open.svg')}
                  alt=""
                  className="mx-auto h-36 w-36 drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
                />
              )}
            </motion.div>

            <div className="relative text-center leading-none">
              <motion.div
                className="text-5xl font-extrabold tracking-tight text-amber-950 drop-shadow-sm sm:text-6xl"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 14 }}
              >
                Congratulations!
              </motion.div>
              <motion.div
                className="mt-2 text-2xl font-bold text-amber-900 sm:text-3xl"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.35 }}
              >
                You did it!
              </motion.div>
              <div className="mt-3 text-sm font-semibold text-amber-900/70">Tap anywhere to close</div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
