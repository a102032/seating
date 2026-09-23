import { Frown, Gift, Star, type LucideIcon } from 'lucide-react'
import type { BonusKind } from '../hooks/useFlipDeck'

/** Each bonus card has its own colour, one icon and a label short enough for a young EFL reader. */
export const BONUS_FACES: Record<BonusKind, { label: string; icon: LucideIcon; face: string; fill?: boolean }> = {
  everyone: { label: 'Everyone +1', icon: Star, face: 'from-amber-200 to-yellow-400 text-amber-950', fill: true },
  jackpot: { label: 'Jackpot +3', icon: Gift, face: 'from-fuchsia-400 to-violet-500 text-white' },
  oops: { label: 'Oops!', icon: Frown, face: 'from-slate-200 to-slate-400 text-slate-800' },
}
