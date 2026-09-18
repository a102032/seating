import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { resolveAvatarSrc } from '../lib/avatarLibrary'
import type { Gender, Student } from '../types'

interface FlipCardProps {
  student: Student
  faceUp: boolean
  /** Colour the back by gender so the class can be told "pick a blue card". */
  genderColors: boolean
  selectedForPoints: boolean
  onTap: () => void
}

const BACK_STYLES: Record<Gender, string> = {
  boy: 'from-sky-400 to-sky-600 text-sky-50',
  girl: 'from-rose-400 to-rose-600 text-rose-50',
  unspecified: 'from-slate-400 to-slate-600 text-slate-50',
}

const NEUTRAL_BACK = 'from-violet-400 to-violet-600 text-violet-50'

/** Diagonal weave, the way a real card back has a pattern rather than a flat colour. */
const BACK_PATTERN =
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 6px, transparent 6px 12px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.08) 0 6px, transparent 6px 12px)'

export function FlipCard({ student, faceUp, genderColors, selectedForPoints, onTap }: FlipCardProps) {
  const avatarSrc = resolveAvatarSrc(student)
  const points = student.points ?? 0

  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className="relative h-full w-full cursor-pointer select-none rounded-xl outline-none"
      style={{ perspective: 800, containerType: 'inline-size' }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 20 }}
      >
        {/* Back */}
        <div
          className={clsx(
            'absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br shadow-md dark:border-white/10',
            genderColors ? BACK_STYLES[student.gender] : NEUTRAL_BACK,
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: BACK_PATTERN }} />
          <Star size={28} className="relative fill-current opacity-70" strokeWidth={0} />
        </div>

        {/* Face */}
        <div
          className={clsx(
            'absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 bg-card p-1.5 shadow-md',
            selectedForPoints ? 'border-emerald-500' : 'border-black/10 dark:border-white/10',
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {points > 0 && (
            <div className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-950 shadow-sm">
              <Star size={9} className="shrink-0 fill-amber-950" strokeWidth={0} />
              {points}
            </div>
          )}
          {avatarSrc && (
            <div className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10">
              <img
                src={avatarSrc}
                alt=""
                draggable={false}
                className="h-full w-full object-contain select-none pointer-events-none"
              />
            </div>
          )}
          <span
            className="w-full shrink-0 truncate px-0.5 text-center font-bold leading-tight text-card-foreground"
            style={{ fontSize: 'clamp(0.7rem, 13cqi, 1.4rem)' }}
          >
            {student.name}
          </span>
        </div>
      </motion.div>
    </motion.button>
  )
}
