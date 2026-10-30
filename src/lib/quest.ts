import type { ClassData } from '../types'

/**
 * The prize wheel and its prizes (DECISIONS, "Treasure Quest" and "The Marble Jar"). It came with
 * the Knight's quest, whose five chests (Wood to Mega) each had their own wheel; since the quests
 * were retired (2026-10-30) only the Marble Jar's full jar opens one, the Gold chest's
 * (JAR_PRIZE_WHEEL in lib/marbles). Everything here only works things out; the chest opening draws it.
 */

export type PrizeSize = 's' | 'm' | 'b'

export interface QuestPrize {
  name: string
  size: PrizeSize
}

export const CHESTS = [
  { name: 'Wood', keys: 1 },
  { name: 'Bronze', keys: 2 },
  { name: 'Silver', keys: 3 },
  { name: 'Gold', keys: 4 },
  { name: 'Mega', keys: 5 },
] as const

export const MEGA = CHESTS.length - 1

/**
 * Each wheel's eight slices: small (plain), medium (silver) and big (gold), agreed 2026-10-12.
 * Every quest ends on a big prize, no chest's worst prize is worse than the usual one of the
 * chest before, and the first gold slice, on the Silver wheel, is a moment of its own.
 */
export const WHEEL_ODDS: [number, number, number][] = [
  [6, 2, 0],
  [4, 4, 0],
  [2, 5, 1],
  [0, 6, 2],
  [0, 0, 8],
]

/** The teacher's own rewards (2026-10-07): whole-class activities first, stuff only at the top. */
export const DEFAULT_PRIZES: QuestPrize[] = [
  { name: 'Drawing time', size: 's' },
  { name: 'Reading time', size: 's' },
  { name: 'Game time', size: 's' },
  { name: 'Music time', size: 's' },
  { name: 'A 10-minute video', size: 'm' },
  { name: 'Class picks the game', size: 'm' },
  { name: 'Sit with a friend', size: 'm' },
  { name: 'Treasure box', size: 'b' },
  { name: 'Toy party', size: 'b' },
  { name: 'Candy treat', size: 'b' },
]

/** The words a prize's size goes by in Points. */
export const SIZE_NAMES: Record<PrizeSize, string> = { s: 'Small', m: 'Medium', b: 'Big' }

/** The longest prize name: it has to fit a slice's card and the prize card at a size the back row reads. */
export const PRIZE_NAME_MAX = 28

export function prizesOf(c: ClassData): QuestPrize[] {
  return c.questPrizes ?? DEFAULT_PRIZES
}


/** A slice of the wheel: a prize, and how good a slice it is (its colour), which is the size it was dealt as. */
export interface Slice extends QuestPrize {
  slot: PrizeSize
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * The prizes a slice of this size can hold: the teacher's of that size, or, if they have none,
 * the nearest size they have, so there is never an empty slice.
 */
function pool(prizes: QuestPrize[], size: PrizeSize): QuestPrize[] {
  const order: Record<PrizeSize, PrizeSize[]> = { s: ['s', 'm', 'b'], m: ['m', 's', 'b'], b: ['b', 'm', 's'] }
  for (const s of order[size]) {
    const p = prizes.filter((x) => x.size === s)
    if (p.length) return p
  }
  return DEFAULT_PRIZES.filter((x) => x.size === size)
}

/**
 * A chest's wheel, dealt fresh as it opens: the agreed odds, each prize used before any is used
 * twice, and the gold slices spread round the wheel rather than side by side.
 */
export function buildWheel(chest: number, prizes: QuestPrize[]): Slice[] {
  const [ns, nm, nb] = WHEEL_ODDS[chest]
  const take = (size: PrizeSize, n: number) => {
    const p = shuffled(pool(prizes, size))
    return Array.from({ length: n }, (_, i) => ({ ...p[i % p.length], slot: size }))
  }
  const big = take('b', nb)
  const rest = shuffled([...take('s', ns), ...take('m', nm)])
  const slots: (Slice | null)[] = new Array(8).fill(null)
  const start = Math.floor(Math.random() * 8)
  big.forEach((p, i) => {
    slots[(start + Math.round((i * 8) / nb)) % 8] = p
  })
  for (let i = 0; i < 8; i++) if (!slots[i]) slots[i] = rest.pop()!
  return slots as Slice[]
}
