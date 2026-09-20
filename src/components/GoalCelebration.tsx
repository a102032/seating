import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { assetUrl } from '../lib/assets'

interface GoalCelebrationProps {
  /** Where on screen the chest is, so the burst erupts from it rather than from nowhere. */
  origin: { x: number; y: number } | null
  /** A preloaded gif to show instead of the chest. Null falls back to the chest. */
  gifUrl: string | null
  onDone: () => void
}

const DURATION_MS = 4200
// Sized for a smartboard seen from the back of a room: a couple of hundred specks reads as
// a few bits of dust falling, not as a celebration.
const BURST_COUNT = 170
const RAIN_COUNT = 430
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
}

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

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      const t = setTimeout(() => doneRef.current(), 900)
      return () => clearTimeout(t)
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      const t = setTimeout(() => doneRef.current(), DURATION_MS)
      return () => clearTimeout(t)
    }

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
        delay: Math.random() * (DURATION_MS * 0.42),
        life: 1,
      })
    }

    const started = performance.now()
    let raf = 0

    const frame = (now: number) => {
      const elapsed = now - started
      ctx.clearRect(0, 0, w, h)
      // Everything fades together over the last second rather than vanishing.
      const fade = elapsed > DURATION_MS - 1000 ? Math.max(0, (DURATION_MS - elapsed) / 1000) : 1

      for (const p of particles) {
        if (elapsed < p.delay) continue
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.16
        p.vx *= 0.995
        p.angle += p.spin
        if (p.y > h + 40) continue

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.globalAlpha = fade
        ctx.fillStyle = p.color
        if (p.star) drawStar(ctx, p.size)
        else ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66)
        ctx.restore()
      }

      if (elapsed < DURATION_MS) raf = requestAnimationFrame(frame)
      else doneRef.current()
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
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: DURATION_MS / 1000, times: [0, 0.07, 0.8, 1] }}
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
            className="relative flex w-[min(92vw,620px)] flex-col items-center gap-5 rounded-[2.5rem] border-[6px] border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 px-10 py-9 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.45)]"
            initial={{ scale: 0.35, rotate: -10, y: 30 }}
            animate={{ scale: [0.35, 1.1, 1], rotate: [-10, 4, 0], y: [30, -8, 0] }}
            transition={{ duration: 0.75, ease: 'backOut' }}
          >
            <motion.div
              className="w-full"
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

            <div className="text-center leading-none">
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
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
