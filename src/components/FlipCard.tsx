import clsx from 'clsx'
import { Gift, Star } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import { GIFT_REEL_LENGTH, GIFT_ROLL_MS, GIFT_STARS, type BonusKind, type GiftState } from '../hooks/useFlipDeck'
import { HOMEROOM_TAG_SCALE } from '../lib/fitText'
import { resolveAvatarSrc } from '../lib/stickers'
import type { Gender, Student } from '../types'

interface FlipCardProps {
  /** The card's identity: a student id, or a bonus card's made-up one. */
  id: string
  /** Exactly one of student or bonus. */
  student?: Student
  bonus?: BonusKind
  /** A gift a student has turned over, and how far it has got. */
  gift?: GiftState
  back: Gender
  faceUp: boolean
  /** Show the stars waiting for the student, in a class that puts them on the desks first - see starsOnDesks in types.ts. */
  showStars: boolean
  /** Another student has the same name, so the homeroom number tells them apart (lib/sameNames). */
  showHomeroom: boolean
  /** Colour the back by gender so the class can be told "pick a blue card". */
  genderColors: boolean
  /** Their turn: the side panel's +/- go to this card. */
  active: boolean
  /** Face up, but a later card has the turn. */
  dimmed: boolean
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

export function FlipCard({
  id,
  student,
  bonus,
  gift,
  back,
  faceUp,
  showStars,
  showHomeroom,
  genderColors,
  active,
  dimmed,
  onTap,
}: FlipCardProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      data-flip-card={id}
      data-bonus={bonus}
      data-gift-stage={gift?.stage}
      // Where a star flies from when this student gets a point (lib/starFlight). Face down,
      // the class can't see whose card it is, so nothing flies from it.
      data-star-from={student && faceUp ? student.id : undefined}
      data-state={active ? 'active' : dimmed ? 'dimmed' : faceUp ? 'up' : 'down'}
      // Lifts under a mouse, presses under a finger, fades once its turn is over - all CSS, so
      // the graphics chip runs it. These were framer props on every card, and every card turned
      // re-ran framer's machinery on all thirty.
      className={clsx(
        'relative h-full w-full cursor-pointer select-none rounded-xl outline-none [transition:scale_0.2s,translate_0.2s,opacity_0.35s] hover:-translate-y-1 hover:scale-[1.04] active:scale-[0.97]',
        dimmed && 'opacity-45',
      )}
      style={{ perspective: 800, containerType: 'inline-size' }}
    >
      {/* The turn is a CSS transition (flip-card-turn in index.css), run by the graphics chip. */}
      <div
        className="flip-card-turn relative h-full w-full"
        style={{ transformStyle: 'preserve-3d', transform: `rotateY(${faceUp ? 180 : 0}deg)` }}
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
          <GiftFace gift={gift} />
        ) : (
          student && <StudentFace student={student} active={active} showStars={showStars} showHomeroom={showHomeroom} />
        )}
      </div>
    </button>
  )
}

const FACE_STYLE = { backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' } as const

function StudentFace({
  student,
  active,
  showStars,
  showHomeroom,
}: {
  student: Student
  active: boolean
  showStars: boolean
  showHomeroom: boolean
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
      {showStars && points > 0 && (
        <div
          // Keyed on the score so an award from the side panel pops the badge.
          key={points}
          // As big as the desks' chip, for the same reason: the class is meant to see them.
          className="count-pop absolute right-1 top-1 z-10 flex items-center gap-[0.15em] rounded-full bg-amber-400 px-[0.45em] py-[0.15em] font-bold leading-none text-amber-950 shadow-sm"
          style={{ fontSize: 'clamp(0.7rem, 10cqi, 1.4rem)' }}
        >
          <Star className="h-[0.85em] w-[0.85em] shrink-0 fill-amber-950" strokeWidth={0} />
          {points}
        </div>
      )}
      {avatarSrc && (
        <div className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10">
          <img src={avatarSrc} alt="" draggable={false} className="h-full w-full object-contain select-none pointer-events-none" />
        </div>
      )}
      {avatarSrc ? (
        <span
          className="w-full shrink-0 truncate px-0.5 text-center font-bold leading-tight text-card-foreground"
          style={{ fontSize: 'clamp(0.7rem, 13cqi, 1.4rem)' }}
        >
          {student.name}
          {showHomeroom && (
            <span data-ink="homeroom" className="ml-[0.25em] font-semibold opacity-50" style={{ fontSize: `${HOMEROOM_TAG_SCALE}em` }}>
              {student.homeroom}
            </span>
          )}
        </span>
      ) : (
        // No avatar: the name alone, bigger, in the middle of the card, with the homeroom number
        // (where one shows) under it, as on the desks.
        <span
          className="w-full shrink-0 px-0.5 text-center font-bold leading-tight text-card-foreground"
          style={{ fontSize: 'clamp(0.85rem, 19cqi, 2.2rem)' }}
        >
          <span className="block truncate">{student.name}</span>
          {showHomeroom && (
            <span data-ink="homeroom" className="block truncate font-semibold opacity-50" style={{ fontSize: `${HOMEROOM_TAG_SCALE}em` }}>
              {student.homeroom}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

/**
 * A Mystery Gift's face, step by step (useFlipDeck's tapGift): wrapped and dancing, "Open!"; the
 * number rolling; then "+3" and a star, waiting with "Tap!" until a tap sends them to the chest.
 * A 5 turns the card gold with a bigger burst. Shown by Reveal All, it is a still present that
 * says "Gift". Every move is CSS (index.css), so nothing re-renders while the number rolls.
 */
function GiftFace({ gift }: { gift?: GiftState }) {
  const landed = gift !== undefined && (gift.stage === 'open' || gift.stage === 'sent')
  const gold = landed && gift.stars === 5
  return (
    <div
      className={clsx(
        'absolute inset-0 flex flex-col items-center justify-center gap-[3cqi] overflow-hidden rounded-xl border-2 border-black/10 bg-gradient-to-br p-1.5 shadow-md',
        gold ? 'from-amber-200 via-yellow-300 to-amber-500 text-amber-950' : 'from-fuchsia-400 to-violet-500 text-white',
      )}
      style={FACE_STYLE}
      data-gift-stars={landed ? gift.stars : undefined}
    >
      {!gift || gift.stage === 'wrapped' ? (
        <>
          <span className={clsx('flex min-h-0 flex-1 items-center justify-center', gift && 'gift-dance')}>
            <Gift strokeWidth={2.25} style={{ width: '34cqi', height: '34cqi' }} />
          </span>
          <CardWord>{gift ? 'Open!' : 'Gift'}</CardWord>
        </>
      ) : gift.stage === 'rolling' ? (
        <Reel stars={gift.stars} />
      ) : (
        <>
          <Burst gold={gold} />
          <span
            className={clsx('flex items-center gap-[2cqi] font-extrabold leading-none', gift.stage === 'open' ? 'gift-land' : '')}
            style={{ fontSize: '30cqi' }}
          >
            <span className={clsx('flex items-center gap-[2cqi]', gift.stage === 'open' && 'gift-waiting')}>
              +{gift.stars}
              <Star className="shrink-0 fill-current" strokeWidth={0} style={{ width: '0.85em', height: '0.85em' }} />
            </span>
          </span>
          {gift.stage === 'open' && <CardWord>Tap!</CardWord>}
        </>
      )}
    </div>
  )
}

function CardWord({ children }: { children: string }) {
  return (
    <span
      className="w-full shrink-0 truncate text-center font-extrabold leading-tight"
      style={{ fontSize: 'clamp(0.7rem, 13cqi, 1.4rem)' }}
    >
      {children}
    </span>
  )
}

/** The number rolling: a strip of numbers sliding up behind a window, slowing onto the gift's own. */
function Reel({ stars }: { stars: number }) {
  const numbers = useMemo(() => {
    const all = GIFT_STARS.map((g) => g.stars)
    const from = all.indexOf(stars)
    // Every number in turn, ending on the gift's: the class sees all four go past before it stops.
    return Array.from({ length: GIFT_REEL_LENGTH }, (_, i) => all[(from + 1 + i) % all.length]).map((n, i, strip) =>
      i === strip.length - 1 ? stars : n,
    )
  }, [stars])
  return (
    <span className="flex items-center gap-[2cqi] font-extrabold leading-none" style={{ fontSize: '30cqi' }}>
      +
      <span className="relative block overflow-hidden" style={{ height: '1em', width: '0.62em' }}>
        <span
          className="gift-reel absolute inset-x-0 top-0 flex flex-col items-center"
          style={{ '--roll-ms': `${GIFT_ROLL_MS}ms`, '--reel-end': `-${numbers.length - 1}em` } as CSSProperties}
        >
          {numbers.map((n, i) => (
            <span key={i} className="block" style={{ height: '1em' }}>
              {n}
            </span>
          ))}
        </span>
      </span>
      <Star className="shrink-0 fill-current" strokeWidth={0} style={{ width: '0.85em', height: '0.85em' }} />
    </span>
  )
}

/** The small celebration as the number lands: stars bursting out from the middle - more, and further, for a gold 5. */
function Burst({ gold }: { gold: boolean }) {
  const count = gold ? 12 : 7
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Star
          key={i}
          className={clsx('gift-burst absolute left-1/2 top-1/2 fill-current', gold ? 'text-amber-600' : 'text-yellow-200')}
          strokeWidth={0}
          style={
            {
              width: gold ? '11cqi' : '9cqi',
              height: gold ? '11cqi' : '9cqi',
              '--turn': `${(i * 360) / count + (i % 2) * 12}deg`,
              '--reach': gold ? '-48cqi' : '-34cqi',
              '--burst-ms': gold ? '0.95s' : '0.7s',
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}
