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
  // A string sagging between the top corners, with flags hung along it.
  const n = 13
  const flags = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const x = 40 + t * 920
    // Catenary-ish sag: lowest in the middle.
    const y = 14 + Math.sin(t * Math.PI) * 26
    return { x, y, color: FLAGS[i % FLAGS.length] }
  })
  const path = flags.map((f, i) => `${i === 0 ? 'M' : 'L'} ${f.x} ${f.y}`).join(' ')
  return (
    <svg
      viewBox="0 0 1000 110"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-0 h-[14%] w-full"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        {/* The flags hang a little off the slate, so they throw a shadow onto it. */}
        <filter id="bunting-shadow" x="-10%" y="-10%" width="120%" height="160%">
          <feDropShadow dx="2" dy="5" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#bunting-shadow)">
        <path d={path} fill="none" stroke={CHALK.white} strokeWidth="3" strokeLinecap="round" />
        {flags.map((f, i) => (
          <polygon
            key={i}
            points={`${f.x - 26},${f.y} ${f.x + 26},${f.y} ${f.x},${f.y + 52}`}
            fill={f.color}
            stroke={CHALK.white}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
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

/** The ledge under the board, with an eraser and three sticks of chalk on it. */
function ChalkTray() {
  return (
    <div
      className="relative mx-auto w-[96%] rounded-b-lg bg-gradient-to-b from-[#c48f4f] via-[#a9773a] to-[#8d5f2b] shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
      style={{ height: 'clamp(14px, 1.9vw, 26px)' }}
    >
      {/* The lip - a lighter edge along the front. */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[#e0b57a]/70" />
      {/* Eraser: felt block on top, wooden back below. */}
      <div
        className="absolute left-[7%] rounded-[3px] bg-gradient-to-b from-[#5b8bb5] to-[#2f5d84] shadow-[0_3px_5px_rgba(0,0,0,0.4)]"
        style={{ width: 'clamp(64px, 9vw, 124px)', height: 'clamp(20px, 2.8vw, 38px)', bottom: '55%' }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[32%] rounded-b-[3px] bg-[#ebe6d8]" />
      </div>
      {/* Chalk sticks. */}
      <div className="absolute right-[8%] flex items-end" style={{ bottom: '58%', gap: 'clamp(6px, 0.8vw, 12px)' }}>
        {[CHALK.white, CHALK.pink, CHALK.yellow].map((c, i) => (
          <div
            key={i}
            className="rounded-full shadow-[0_2px_3px_rgba(0,0,0,0.4)]"
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
        <div className="rounded-2xl bg-gradient-to-br from-[#c9975a] via-[#a9773a] to-[#7f5424] p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)] sm:p-3.5">
          <div className="splash-board relative overflow-hidden rounded-lg" style={{ minHeight: 'min(78vh, 640px)' }}>
            <Bunting />

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
