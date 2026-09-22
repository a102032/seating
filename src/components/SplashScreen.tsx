import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import {
  Apple,
  Backpack,
  Book,
  BookOpen,
  Calculator,
  Eraser,
  FlaskConical,
  Globe,
  GraduationCap,
  Highlighter,
  NotebookPen,
  Paperclip,
  Palette,
  Pencil,
  Plus,
  Ruler,
  Scissors,
  Star,
  type LucideIcon,
} from 'lucide-react'
import type { ClassData } from '../types'

interface SplashScreenProps {
  classes: ClassData[]
  /** Tap a class card: make it active and hand the board over, in one go. */
  onOpenClass: (id: string) => void
  /** Make a class and open its settings, ready for a roster. */
  onNewClass: () => void
  /** First run: open the class that already exists rather than making a second empty one. */
  onSetUpFirst: () => void
  /** False once every class slot is used, so New Class stops offering what it can't do. */
  canAddClass: boolean
}

/**
 * Chalk. Pastels at the top for the lettering and the supplies, saturated-but-dusty below
 * for the bunting and the class cards, and the board and frame at the bottom. Literal on
 * purpose: this screen is the one place in the app that doesn't follow the theme.
 */
const CHALK = {
  white: '#f4f1e8',
  yellow: '#f7e3a1',
  peach: '#f9c9a8',
  pink: '#f4a6c0',
  mint: '#a8e6cf',
  sky: '#a9d8f0',
  lavender: '#c9b8f0',
} as const

const FLAGS = ['#ef8a7a', '#f6c65b', '#6cc4a1', '#5fb3d9', '#b48fe0', '#f29bb4', '#f0a35e']
const CARDS = [CHALK.yellow, CHALK.mint, CHALK.sky, CHALK.pink, CHALK.lavender, CHALK.peach]

const INK = '#1f4a3b'

/**
 * Classroom supplies, drifting up the board.
 *
 * Line icons are chalk doodles - drawn in a pastel on a green board, a Lucide pencil reads
 * as sketched on rather than pasted on, which is why nothing here is hand-drawn. Placement
 * is spread by hand rather than randomised, so the board is full without two apples ever
 * riding up side by side.
 */
interface Drifter {
  Icon: LucideIcon
  left: number
  size: number
  dur: number
  delay: number
  color: string
  sway: number
  peak: number
}

const DRIFTERS: Drifter[] = [
  { Icon: Pencil, left: 2, size: 44, dur: 15, delay: -2, color: CHALK.yellow, sway: 16, peak: 0.8 },
  { Icon: Ruler, left: 7, size: 50, dur: 18, delay: -9, color: CHALK.sky, sway: -12, peak: 0.7 },
  { Icon: Apple, left: 12, size: 38, dur: 13, delay: -5, color: CHALK.pink, sway: 10, peak: 0.8 },
  { Icon: Book, left: 4, size: 46, dur: 17, delay: -13, color: CHALK.mint, sway: -18, peak: 0.75 },
  { Icon: Highlighter, left: 10, size: 38, dur: 14, delay: -1, color: CHALK.peach, sway: 14, peak: 0.75 },
  { Icon: Eraser, left: 15, size: 40, dur: 16, delay: -7, color: CHALK.lavender, sway: -10, peak: 0.7 },
  { Icon: Globe, left: 6, size: 44, dur: 20, delay: -16, color: CHALK.sky, sway: 14, peak: 0.65 },
  { Icon: Star, left: 14, size: 28, dur: 12, delay: -3, color: CHALK.yellow, sway: 20, peak: 0.85 },
  { Icon: Scissors, left: 85, size: 38, dur: 15, delay: -6, color: CHALK.pink, sway: 12, peak: 0.75 },
  { Icon: Calculator, left: 91, size: 42, dur: 17, delay: -14, color: CHALK.mint, sway: -16, peak: 0.7 },
  { Icon: Paperclip, left: 96, size: 34, dur: 13, delay: -4, color: CHALK.white, sway: 18, peak: 0.65 },
  { Icon: Backpack, left: 88, size: 48, dur: 18, delay: -10, color: CHALK.peach, sway: -12, peak: 0.75 },
  { Icon: Palette, left: 94, size: 42, dur: 16, delay: -8, color: CHALK.lavender, sway: 10, peak: 0.75 },
  { Icon: NotebookPen, left: 83, size: 46, dur: 19, delay: -11, color: CHALK.sky, sway: -14, peak: 0.7 },
  { Icon: FlaskConical, left: 97, size: 38, dur: 14, delay: -9, color: CHALK.mint, sway: 12, peak: 0.75 },
  { Icon: Star, left: 90, size: 26, dur: 11, delay: -2, color: CHALK.peach, sway: 16, peak: 0.85 },
  // A few down the middle: hidden behind the board most of the way, they surface above and
  // below it, so the wall doesn't read as two strips with a dead centre.
  { Icon: BookOpen, left: 30, size: 44, dur: 16, delay: -12, color: CHALK.yellow, sway: -14, peak: 0.7 },
  { Icon: GraduationCap, left: 50, size: 46, dur: 18, delay: -15, color: CHALK.white, sway: -18, peak: 0.7 },
  { Icon: Pencil, left: 68, size: 36, dur: 14, delay: -7, color: CHALK.pink, sway: -10, peak: 0.75 },
  { Icon: Apple, left: 42, size: 34, dur: 15, delay: -11, color: CHALK.mint, sway: 12, peak: 0.8 },
]

function Bunting() {
  // The string sags from corner to corner. y(t) below is the sag; its derivative gives the
  // slope at each flag, which is what the flag is rotated to - a flat-topped flag on a
  // sloping string floats off it at one corner, which is what the last cut got wrong.
  const sag = (t: number) => 10 + Math.sin(t * Math.PI) * 44
  const slope = (t: number) => ((44 * Math.PI * Math.cos(t * Math.PI)) / 1000) * (180 / Math.PI)
  const n = 11
  const flagW = 72
  const flagH = 86
  const flags = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n
    return { x: t * 1000, y: sag(t), rot: slope(t), color: FLAGS[i % FLAGS.length] }
  })
  // The string as a smooth curve, sampled, running just past both corners.
  const string = Array.from({ length: 41 }, (_, i) => {
    const t = -0.01 + (i / 40) * 1.02
    return `${i === 0 ? 'M' : 'L'} ${t * 1000} ${sag(Math.min(1, Math.max(0, t)))}`
  }).join(' ')
  return (
    <svg
      viewBox="0 0 1000 150"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-auto w-full"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <filter id="bunting-shadow" x="-10%" y="-20%" width="120%" height="170%">
          <feDropShadow dx="2" dy="5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.55" />
        </filter>
        {/* A little body in the cloth - lighter at the fold, a shade darker toward the
            point - so pastel reads as fabric rather than tissue. The hue is untouched. */}
        <linearGradient id="flag-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <g filter="url(#bunting-shadow)">
        {flags.map((f, i) => {
          const pts = `${-flagW / 2},0 ${flagW / 2},0 0,${flagH}`
          return (
            <g key={i} transform={`translate(${f.x} ${f.y}) rotate(${f.rot})`}>
              <polygon points={pts} fill={f.color} />
              <polygon points={pts} fill="url(#flag-shade)" />
              <polygon points={pts} fill="none" stroke={CHALK.white} strokeWidth="3" strokeLinejoin="round" />
            </g>
          )
        })}
        <path d={string} fill="none" stroke={CHALK.white} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/**
 * Drawings the kids left on the board - sun, cloud, cat, house, the usual - each at its
 * own angle the way they'd land. Hand-drawn paths, roughened with a displacement filter so
 * the lines wobble like chalk. Kept to the edges and corners, and quiet, so they're set
 * dressing for the welcome and not competition for it. The mid-edge ones hide on a phone,
 * where the cards take that space.
 */
const DOODLES: {
  Shape: (props: { color: string }) => React.ReactElement
  style: React.CSSProperties
  rotate: number
  color: string
  opacity: number
  small?: boolean
}[] = [
  { Shape: Sun, style: { left: '3%', top: '13%', '--w': '9cqw' } as React.CSSProperties, rotate: -12, color: CHALK.yellow, opacity: 0.6 },
  { Shape: Cloud, style: { right: '5%', top: '15%', '--w': '11cqw' } as React.CSSProperties, rotate: 6, color: CHALK.white, opacity: 0.5 },
  { Shape: Tree, style: { left: '5%', bottom: '8%', '--w': '8cqw' } as React.CSSProperties, rotate: 5, color: CHALK.mint, opacity: 0.6 },
  { Shape: House, style: { right: '6%', bottom: '9%', '--w': '9cqw' } as React.CSSProperties, rotate: -7, color: CHALK.peach, opacity: 0.55 },
  { Shape: Cat, style: { left: '4%', top: '44%', '--w': '7.5cqw' } as React.CSSProperties, rotate: 14, color: CHALK.pink, opacity: 0.55, small: true },
  { Shape: Dog, style: { right: '4%', top: '42%', '--w': '8cqw' } as React.CSSProperties, rotate: -10, color: CHALK.sky, opacity: 0.55, small: true },
  { Shape: AppleDoodle, style: { left: '20%', bottom: '7%', '--w': '5.5cqw' } as React.CSSProperties, rotate: 18, color: CHALK.pink, opacity: 0.55, small: true },
  { Shape: Flower, style: { right: '22%', bottom: '6%', '--w': '6cqw' } as React.CSSProperties, rotate: -15, color: CHALK.lavender, opacity: 0.55, small: true },
  { Shape: Heart, style: { left: '16%', top: '22%', '--w': '4.5cqw' } as React.CSSProperties, rotate: -22, color: CHALK.pink, opacity: 0.5, small: true },
  { Shape: Smiley, style: { right: '14%', top: '31%', '--w': '5cqw' } as React.CSSProperties, rotate: 12, color: CHALK.yellow, opacity: 0.5, small: true },
  { Shape: Sum, style: { left: '38%', bottom: '5%', '--w': '13cqw' } as React.CSSProperties, rotate: -4, color: CHALK.white, opacity: 0.5 },
  { Shape: StarShape, style: { left: '27%', bottom: '24%', '--w': '4.5cqw' } as React.CSSProperties, rotate: 20, color: CHALK.yellow, opacity: 0.5, small: true },
]

function ChalkDoodles() {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ containerType: 'inline-size' }}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="chalk-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {DOODLES.map((d, i) => (
        <div
          key={i}
          className={`splash-doodle ${d.small ? 'hidden sm:block' : ''}`}
          style={{ ...d.style, transform: `rotate(${d.rotate}deg)`, opacity: d.opacity }}
        >
          <svg viewBox="0 0 100 100" className="h-auto w-full" style={{ filter: 'url(#chalk-rough)' }} aria-hidden>
            <g fill="none" stroke={d.color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <d.Shape color={d.color} />
            </g>
          </svg>
        </div>
      ))}
    </div>
  )
}

/* The drawings. Deliberately a little off - that's the point. */
function Sun() {
  return (
    <>
      <circle cx="50" cy="52" r="17" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.2
        const x1 = 50 + Math.cos(a) * 24, y1 = 52 + Math.sin(a) * 24
        const x2 = 50 + Math.cos(a) * (34 + (i % 2) * 4), y2 = 52 + Math.sin(a) * (34 + (i % 2) * 4)
        return <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} />
      })}
      <path d="M43 50 q2 -3 4 0 M53 49 q2 -3 4 0 M42 58 q8 7 16 0" />
    </>
  )
}
function Cloud() {
  return <path d="M22 66 q-12 -2 -9 -13 q3 -10 15 -8 q3 -14 18 -12 q13 2 15 12 q13 -4 18 6 q5 11 -6 15 z" />
}
function Tree() {
  return (
    <>
      <path d="M50 12 L26 46 h14 L22 72 h56 L60 46 h14 z" />
      <path d="M45 72 v18 h10 v-18" />
    </>
  )
}
function House() {
  return (
    <>
      <path d="M18 50 L50 20 L82 50" />
      <path d="M26 46 v36 h48 v-36" />
      <path d="M44 82 v-20 h12 v20" />
      <path d="M32 56 h10 v10 h-10 z M58 56 h10 v10 h-10 z" />
    </>
  )
}
function Cat() {
  return (
    <>
      <path d="M28 40 L24 16 L42 30 M72 40 L76 16 L58 30" />
      <circle cx="50" cy="52" r="24" />
      <path d="M40 48 q2 -3 4 0 M56 48 q2 -3 4 0 M48 58 l2 2 l2 -2" />
      <path d="M22 54 h16 M22 62 l16 -3 M78 54 h-16 M78 62 l-16 -3" />
    </>
  )
}
function Dog() {
  return (
    <>
      <circle cx="50" cy="50" r="24" />
      <path d="M28 38 q-10 4 -8 22 q2 10 10 6 M72 38 q10 4 8 22 q-2 10 -10 6" />
      <path d="M40 46 q2 -3 4 0 M56 46 q2 -3 4 0" />
      <path d="M46 56 q4 -3 8 0 q-4 5 -8 0 M50 58 v6 M42 66 q8 6 16 0" />
    </>
  )
}
function AppleDoodle() {
  return (
    <>
      <path d="M50 30 q-16 -8 -24 8 q-6 14 4 32 q6 12 20 8 q14 4 20 -8 q10 -18 4 -32 q-8 -16 -24 -8 z" />
      <path d="M50 30 q0 -10 6 -14 M50 30 q8 -12 20 -10 q-4 10 -20 10" />
    </>
  )
}
function Flower() {
  return (
    <>
      <circle cx="50" cy="42" r="9" />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return <circle key={i} cx={50 + Math.cos(a) * 17} cy={42 + Math.sin(a) * 17} r="8" />
      })}
      <path d="M50 51 v36 M50 72 q-12 -4 -14 -12 M50 78 q12 -4 14 -12" />
    </>
  )
}
function Heart() {
  return <path d="M50 82 q-30 -22 -30 -42 q0 -14 14 -14 q10 0 16 10 q6 -10 16 -10 q14 0 14 14 q0 20 -30 42 z" />
}
function Smiley() {
  return (
    <>
      <circle cx="50" cy="50" r="30" />
      <path d="M38 42 q2 -4 5 0 M57 42 q2 -4 5 0 M34 58 q16 16 32 0" />
    </>
  )
}
function StarShape() {
  return <path d="M50 14 L60 40 L88 42 L66 60 L73 88 L50 72 L27 88 L34 60 L12 42 L40 40 z" />
}
function Sum({ color }: { color: string }) {
  return (
    <text x="4" y="62" fill={color} stroke="none" fontFamily="'Cabin Sketch', 'Andika', sans-serif" fontWeight="700" fontSize="34">
      2+2=4
    </text>
  )
}

/** The chalk "!" strokes that sit beside a chalk headline. */
function ChalkMarks({ className, delay, flip }: { className: string; delay: number; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 60"
      className={`splash-twinkle pointer-events-none absolute h-10 w-10 sm:h-14 sm:w-14 ${className}`}
      style={{ '--delay': `${delay}s`, transform: flip ? 'scaleX(-1)' : undefined } as CSSProperties}
      aria-hidden
    >
      <g stroke={CHALK.white} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M10 44 L22 30" />
        <path d="M26 50 L30 32" />
        <path d="M6 30 L18 24" />
      </g>
    </svg>
  )
}

/** The ledge under the board, with an eraser and three sticks of chalk sitting on it. */
function ChalkTray() {
  return (
    <div
      className="relative z-20 mx-auto w-[96%] rounded-b-lg bg-gradient-to-b from-[#c48f4f] via-[#a9773a] to-[#8d5f2b] shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
      style={{ height: 'clamp(14px, 1.9vw, 26px)' }}
    >
      {/* The lip - a lighter edge along the front. */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[#e0b57a]/70" />
      {/* Eraser, felt down, standing on the lip. */}
      <div
        className="absolute left-[7%] rounded-[3px] bg-gradient-to-b from-[#5b8bb5] to-[#2f5d84] shadow-[0_3px_5px_rgba(0,0,0,0.45)]"
        style={{ width: 'clamp(64px, 9vw, 124px)', height: 'clamp(20px, 2.8vw, 38px)', bottom: 'calc(100% - 5px)' }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[32%] rounded-b-[3px] bg-[#ebe6d8]" />
      </div>
      {/* Chalk, lying on the lip. */}
      <div className="absolute right-[8%] flex items-end" style={{ bottom: 'calc(100% - 6px)', gap: 'clamp(6px, 0.8vw, 12px)' }}>
        {[CHALK.white, CHALK.pink, CHALK.yellow].map((c, i) => (
          <div
            key={i}
            className="rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.45)]"
            style={{
              background: `linear-gradient(to bottom, #fff 0%, ${c} 55%, rgba(0,0,0,0.12) 100%)`,
              width: 'clamp(38px, 5.2vw, 72px)',
              height: 'clamp(8px, 1vw, 14px)',
              transform: `rotate(${i === 1 ? -4 : i === 2 ? 5 : 0}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The front door: a chalkboard.
 *
 * Two states. Which one shows turns on classes.length, not on whether anyone has a roster yet
 * - "first run" means exactly one class exists and it's empty, which is the state useClasses
 * seeds on a truly fresh app (and re-seeds if the last class is ever deleted). Anything else
 * lays every class out as a card the teacher taps to open, rosters full or not: a period
 * that hasn't been imported yet is still a real class, and it gets a card that says so.
 */
export function SplashScreen({ classes, onOpenClass, onNewClass, onSetUpFirst, canAddClass }: SplashScreenProps) {
  const firstRun = classes.length === 1 && classes[0].students.length === 0

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden p-3 sm:p-6"
      style={{
        // The wall. A little cooler than the board so the frame has something to sit against.
        background: 'radial-gradient(ellipse at 50% 30%, #2f7461 0%, #1c4a3d 70%, #143a30 100%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.4 }}
    >
      {/* The drift, on the wall. Behind the frame, so the supplies show in the space
          around the board and never on it; the board is opaque and hides them as they
          pass behind. Pointer-events off so nothing here ever eats a tap. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {DRIFTERS.map((d, i) => (
          <span
            key={i}
            className="splash-float"
            style={
              {
                left: `${d.left}%`,
                color: d.color,
                '--dur': `${d.dur}s`,
                '--delay': `${d.delay}s`,
                '--sway': `${d.sway}px`,
                '--peak': d.peak,
                '--from-rot': `${(i % 3) * 7 - 10}deg`,
                '--mid-rot': `${(i % 4) * 5 - 6}deg`,
                '--to-rot': `${(i % 5) * 6 - 12}deg`,
              } as CSSProperties
            }
          >
            <d.Icon size={d.size} strokeWidth={1.75} />
          </span>
        ))}
      </div>

      <motion.div
        className="relative z-10 flex w-full max-w-5xl flex-col"
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      >
        {/* The wooden frame. */}
        <div className="relative rounded-2xl bg-gradient-to-br from-[#c9975a] via-[#a9773a] to-[#7f5424] p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)] sm:p-3.5">
          <Bunting />
          <div className="splash-board relative overflow-hidden rounded-lg" style={{ minHeight: 'min(78vh, 640px)' }}>
            <ChalkDoodles />

            {/* The chalk-drawn inner border. */}
            <div
              className="pointer-events-none absolute inset-4 rounded-xl border-2 border-dashed sm:inset-6"
              style={{ borderColor: 'rgba(244,241,232,0.55)' }}
            />

            {/* What the teacher reads and taps. */}
            <div className="relative z-10 flex min-h-[inherit] flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
              <div className="relative">
                <ChalkMarks className="-left-12 top-0 sm:-left-16" delay={0} />
                <ChalkMarks className="-right-12 top-1 sm:-right-16" delay={0.9} flip />
                <motion.h1
                  className="splash-chalk"
                  style={{ color: CHALK.yellow, fontSize: 'clamp(2.4rem, 8vmin, 4.6rem)', lineHeight: 1 }}
                  initial={{ scale: 0.6, rotate: -5, opacity: 0 }}
                  animate={{ scale: 1, rotate: -1.5, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
                >
                  Welcome, Teacher!
                </motion.h1>
              </div>

              <motion.p
                className="splash-chalk relative mt-3 max-w-xl"
                style={{ color: CHALK.sky, fontSize: 'clamp(1.05rem, 2.8vmin, 1.5rem)' }}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {firstRun ? "Let's set up your first class." : 'Pick a class to start, or make a new one.'}
              </motion.p>

              {!firstRun && (
                <motion.div
                  className="relative mt-7 flex flex-wrap items-stretch justify-center gap-3 sm:gap-4"
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.55 } } }}
                >
                  {classes.map((c, i) => (
                    <ClassCard
                      key={c.id}
                      name={c.name}
                      students={c.students.length}
                      color={CARDS[i % CARDS.length]}
                      tilt={i % 2 === 0 ? -2 : 1.6}
                      onClick={() => onOpenClass(c.id)}
                    />
                  ))}
                </motion.div>
              )}

              <motion.div
                className="relative mt-7 flex flex-wrap items-center justify-center gap-3"
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: firstRun ? 0.55 : 0.85 }}
              >
                {firstRun ? (
                  <ChalkButton primary onClick={onSetUpFirst}>
                    <GraduationCap size={22} /> Create My First Class
                  </ChalkButton>
                ) : (
                  canAddClass && (
                    <ChalkButton onClick={onNewClass}>
                      <Plus size={22} /> New Class
                    </ChalkButton>
                  )
                )}
              </motion.div>
            </div>
          </div>
        </div>
        <ChalkTray />
      </motion.div>
    </motion.div>
  )
}

/** A class, as a card stuck to the board. Tapping it opens the class. */
function ClassCard({
  name,
  students,
  color,
  tilt,
  onClick,
}: {
  name: string
  students: number
  color: string
  tilt: number
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex min-w-[9.5rem] flex-col items-center justify-center rounded-xl border-2 px-5 py-4 shadow-[0_6px_0_rgba(0,0,0,0.28)] outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      style={{ background: color, color: INK, rotate: tilt, borderColor: 'rgba(244,241,232,0.85)' }}
      variants={{ hidden: { y: 18, opacity: 0, scale: 0.85 }, show: { y: 0, opacity: 1, scale: 1 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      whileHover={{ scale: 1.06, rotate: 0 }}
      whileTap={{ scale: 0.95, y: 3 }}
    >
      <span className="text-lg font-extrabold leading-tight sm:text-xl">{name}</span>
      <span className="mt-1 text-xs font-semibold opacity-70 sm:text-sm">
        {students === 0 ? 'No students yet' : `${students} student${students === 1 ? '' : 's'}`}
      </span>
    </motion.button>
  )
}

function ChalkButton({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border-2 px-6 py-3 text-base font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:text-lg"
      style={
        primary
          ? { background: CHALK.yellow, color: INK, borderColor: CHALK.white, boxShadow: '0 6px 0 rgba(0,0,0,0.28)' }
          : { background: 'rgba(244,241,232,0.1)', color: CHALK.white, borderColor: CHALK.white, boxShadow: '0 4px 0 rgba(0,0,0,0.22)' }
      }
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95, y: 3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      {children}
    </motion.button>
  )
}
