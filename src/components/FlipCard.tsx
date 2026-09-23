import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Gift, Star } from 'lucide-react'
import type { BonusKind } from '../hooks/useFlipDeck'
import { BONUS_FACES } from '../lib/bonusCards'
import { resolveAvatarSrc } from '../lib/stickers'
import type { Gender, Student } from '../types'

interface FlipCardProps {
  /** The card's identity: a student id, or a bonus card's made-up one. */
  id: string
  /** Exactly one of student or bonus. */
  student?: Student
  bonus?: BonusKind
  back: Gender
  faceUp: boolean
  /** Colour the back by gender so the class can be told "pick a blue card". */
  genderColors: boolean
  /** Their turn: the side panel's +/- go to this card. */
  active: boolean
  /** Face up, but a later card has the turn. */
  dimmed: boolean
  /** A jackpot that just landed on this student; the tick replays the burst. */
  jackpotHit?: { points: number; tick: number } | null
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

export function FlipCard({ id, student, bonus, back, faceUp, genderColors, active, dimmed, jackpotHit, onTap }: FlipCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      data-flip-card={id}
      data-bonus={bonus}
      data-state={active ? 'active' : dimmed ? 'dimmed' : faceUp ? 'up' : 'down'}
      // Opacity goes through animate: framer owns this element's inline styles.
      animate={{ opacity: dimmed ? 0.45 : 1 }}
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26, opacity: { duration: 0.35 } }}
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
            genderColors ? BACK_STYLES[back] : NEUTRAL_BACK,
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: BACK_PATTERN }} />
          <Star size={28} className="relative fill-current opacity-70" strokeWidth={0} />
        </div>

        {/* Face */}
        {bonus ? (
          <BonusFace kind={bonus} faceUp={faceUp} />
        ) : (
          student && <StudentFace student={student} active={active} jackpotHit={jackpotHit} />
        )}
      </motion.div>
    </motion.button>
  )
}

const FACE_STYLE = { backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' } as const

function StudentFace({
  student,
  active,
  jackpotHit,
}: {
  student: Student
  active: boolean
  jackpotHit?: { points: number; tick: number } | null
}) {
  const avatarSrc = resolveAvatarSrc(student)
  const points = student.points ?? 0
  return (
    <div
      className={clsx(
        'absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 bg-card p-1.5 shadow-md',
        // A class rather than a framer value: framer never clears a box-shadow it has set.
        active ? 'flip-card-active border-amber-400' : 'border-black/10 dark:border-white/10',
      )}
      style={FACE_STYLE}
    >
      {points > 0 && (
        <motion.div
          // Keyed on the score so an award from the side panel pops the badge.
          key={points}
          initial={{ scale: 1.6 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 12 }}
          className="absolute right-1 top-1 z-10 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-950 shadow-sm"
        >
          <Star size={9} className="shrink-0 fill-amber-950" strokeWidth={0} />
          {points}
        </motion.div>
      )}
      {avatarSrc && (
        <div className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10">
          <img src={avatarSrc} alt="" draggable={false} className="h-full w-full object-contain select-none pointer-events-none" />
        </div>
      )}
      <span
        className="w-full shrink-0 truncate px-0.5 text-center font-bold leading-tight text-card-foreground"
        style={{ fontSize: 'clamp(0.7rem, 13cqi, 1.4rem)' }}
      >
        {student.name}
      </span>
      {jackpotHit && (
        // The jackpot rising off the card as it lands, then gone - the badge keeps the score.
        <motion.span
          key={jackpotHit.tick}
          initial={{ y: 10, scale: 0.6, opacity: 0 }}
          animate={{ y: -18, scale: 1.15, opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.35, duration: 1.6, ease: 'easeOut', opacity: { delay: 0.35, duration: 1.6, times: [0, 0.15, 0.7, 1] } }}
          className="pointer-events-none absolute inset-x-0 top-1/3 z-20 mx-auto flex w-fit items-center gap-1 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 px-2.5 py-1 font-extrabold text-white shadow-lg"
          style={{ fontSize: 'clamp(0.8rem, 14cqi, 1.6rem)' }}
        >
          <Gift className="shrink-0" style={{ width: '1em', height: '1em' }} />+{jackpotHit.points}
        </motion.span>
      )}
    </div>
  )
}

/**
 * A bonus card's face: its colour, one big icon and its label. The icon pops in as the card
 * lands - or, for Oops!, wobbles - and that's the whole show; the class goal keeps the
 * one big celebration.
 */
function BonusFace({ kind, faceUp }: { kind: BonusKind; faceUp: boolean }) {
  const { label, icon: Icon, face, fill } = BONUS_FACES[kind]
  const reveal =
    kind === 'oops'
      ? { initial: { rotate: 0 }, animate: { rotate: [0, -16, 13, -9, 5, 0] }, transition: { delay: 0.35, duration: 0.7 } }
      : { initial: { scale: 0.3 }, animate: { scale: [0.3, 1.25, 1] }, transition: { delay: 0.3, duration: 0.5 } }
  return (
    <div
      className={clsx(
        'absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-black/10 bg-gradient-to-br p-1.5 shadow-md',
        face,
      )}
      style={FACE_STYLE}
    >
      <motion.span
        // Keyed on the side it shows, so every reveal replays the icon's entrance.
        key={faceUp ? 'up' : 'down'}
        {...reveal}
        className="flex min-h-0 flex-1 items-center justify-center"
      >
        <Icon className={clsx(fill && 'fill-current')} strokeWidth={fill ? 0 : 2.25} style={{ width: '34cqi', height: '34cqi' }} />
      </motion.span>
      <span
        className="w-full shrink-0 truncate text-center font-extrabold leading-tight"
        style={{ fontSize: 'clamp(0.7rem, 13cqi, 1.4rem)' }}
      >
        {label}
      </span>
    </div>
  )
}
