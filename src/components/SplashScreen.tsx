import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { GraduationCap, Plus, Sparkles } from 'lucide-react'
import { resolveAvatarSrc } from '../lib/stickers'
import type { ClassData } from '../types'
import { TactileButton } from './TactileButton'

interface SplashScreenProps {
  classes: ClassData[]
  activeClassId: string | null
  /** Switch which class Start Class will open. */
  onSelectClass: (id: string) => void
  /** Dismiss the splash and hand the board over. */
  onStart: () => void
  /** Make a class and open its settings, ready for a roster. */
  onNewClass: () => void
  /** First run: open the class that already exists rather than making a second empty one. */
  onSetUpFirst: () => void
  /** False once every class slot is used, so New Class stops offering what it can't do. */
  canAddClass: boolean
}

/** Stars drifting up behind the card, the same idiom the goal celebration uses. */
const STARS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: (i * 37 + (i % 5) * 11) % 100,
  size: 9 + ((i * 13) % 22),
  duration: 7 + ((i * 7) % 9),
  delay: -((i * 11) % 14),
  peak: 0.25 + ((i % 4) * 0.13),
  spin: 40 + ((i * 29) % 180),
}))

/** A few characters to wave from the card. Ids are fixed, so the same faces greet every time. */
const GREETERS = ['splash-a', 'splash-f', 'splash-k', 'splash-r', 'splash-w']

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning!'
  if (h < 17) return 'Good afternoon!'
  return 'Good evening!'
}

/**
 * The front door.
 *
 * Two states. Which one shows turns on classes.length, not on whether anyone has a roster yet
 * - "first run" means exactly one class exists and it's empty, which is the state useClasses
 * seeds on a truly fresh app (and re-seeds if the last class is ever deleted). The moment a
 * second class exists, the teacher has already used New Class at least once and is mid-setup
 * across periods - possibly with every roster still empty - so from there the splash always
 * offers the picker rather than collapsing back to a single "set up your first class" button
 * that would hide the classes already created.
 */
export function SplashScreen({
  classes,
  activeClassId,
  onSelectClass,
  onStart,
  onNewClass,
  onSetUpFirst,
  canAddClass,
}: SplashScreenProps) {
  const hello = useMemo(greeting, [])
  // Narrowly "exactly one class, and it's empty" - not "every class is empty". Two or
  // more classes existing at all, even unpopulated ones, means the teacher already took
  // an affirmative New Class action and is mid-setup across several periods; collapsing
  // that down to a single "set up your first class" button would hide the others.
  const firstRun = classes.length === 1 && classes[0].students.length === 0
  const active = classes.find((c) => c.id === activeClassId) ?? classes[0]
  const studentCount = active?.students.length ?? 0

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35 }}
    >
      {/* Behind everything: the drift. Pointer-events off so it never eats a tap. */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map((s) => (
          <span
            key={s.id}
            className="celebration-star text-amber-300"
            style={
              {
                left: `${s.left}%`,
                '--star-duration': `${s.duration}s`,
                '--star-delay': `${s.delay}s`,
                '--star-peak': s.peak,
                '--star-spin': `${s.spin}deg`,
              } as React.CSSProperties
            }
          >
            <Sparkles size={s.size} className="fill-current" strokeWidth={1.5} />
          </span>
        ))}
      </div>

      <motion.div
        className="relative w-full max-w-xl rounded-3xl border border-border bg-card/90 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8"
        data-ink="panel"
        initial={{ scale: 0.82, y: 26, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        {/* The greeters bob on their own clocks, so the row never pulses in unison. */}
        <div className="mb-3 flex items-end justify-center gap-1 sm:gap-2">
          {GREETERS.map((id, i) => (
            <motion.img
              key={id}
              src={resolveAvatarSrc({ id })}
              alt=""
              draggable={false}
              className="h-12 w-12 select-none sm:h-16 sm:w-16"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: [0, -7, 0], opacity: 1 }}
              transition={{
                y: { duration: 1.9 + i * 0.22, repeat: Infinity, ease: 'easeInOut', delay: i * 0.13 },
                opacity: { duration: 0.35, delay: 0.15 + i * 0.07 },
              }}
            />
          ))}
        </div>

        <motion.h1
          className="font-extrabold text-foreground"
          style={{ fontSize: 'clamp(1.8rem, 5.2vmin, 3rem)', lineHeight: 1.1 }}
          initial={{ scale: 0.7, rotate: -4, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
        >
          {firstRun ? 'Welcome!' : hello}
        </motion.h1>

        <motion.p
          className="mx-auto mt-2 max-w-md text-muted-foreground"
          style={{ fontSize: 'clamp(0.9rem, 2vmin, 1.1rem)' }}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {firstRun
            ? "Let's get your first class set up — add your students and we'll seat them for you."
            : studentCount > 0
              ? `${active?.name} is ready — ${studentCount} student${studentCount === 1 ? '' : 's'} waiting.`
              : `${active?.name} has no students yet.`}
        </motion.p>

        {/* Which class is about to start. Only worth showing when there's a choice to make. */}
        {!firstRun && classes.length > 1 && (
          <motion.div
            className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.32 }}
          >
            {classes.map((c) => (
              <TactileButton
                key={c.id}
                active={c.id === active?.id}
                onClick={() => onSelectClass(c.id)}
                className="!px-3 !py-1.5"
              >
                {c.name}
              </TactileButton>
            ))}
          </motion.div>
        )}

        <motion.div
          className="mt-5 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center"
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {firstRun ? (
            <TactileButton variant="primary" onClick={onSetUpFirst} className="justify-center !px-6 !py-3.5">
              <GraduationCap size={20} /> Set Up My First Class
            </TactileButton>
          ) : (
            <>
              <TactileButton variant="primary" onClick={onStart} className="justify-center !px-6 !py-3.5">
                <GraduationCap size={20} /> Start {active?.name ?? 'Class'}
              </TactileButton>
              {canAddClass && (
                <TactileButton onClick={onNewClass} className="justify-center !px-5 !py-3.5">
                  <Plus size={20} /> New Class
                </TactileButton>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
