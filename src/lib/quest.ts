import type { ClassData } from '../types'
import { dateKey } from './attendance'

/**
 * The Quest (DECISIONS, "Treasure Quest"): a class goal with a longer arc. Each goal filled wins a
 * key; five chests a quest, needing 1, 2, 3, 4 and 5 keys; a chest with all its keys opens on a
 * tap, and a wheel rises out of it with the teacher's own prizes. About a key a week makes a quest
 * a semester. Everything here only works things out; the meter, the key moment, the chest opening
 * and Our Quest draw it.
 */

export type PrizeSize = 's' | 'm' | 'b'

export interface QuestPrize {
  name: string
  size: PrizeSize
}

export interface QuestState {
  /** Which quest the class is on, from 1: "Our Quest 2" from the second one. */
  number: number
  /** The chest the class is working towards, 0 (Wood) to 4 (Mega). */
  chest: number
  /**
   * Keys won towards it. A chest with all its keys waits, rattling, for the teacher's tap; a key
   * won meanwhile is kept and goes towards the next chest, so no goal is ever wasted.
   */
  keys: number
  /** The chests opened this quest, with what was inside: the class's memories on the map. */
  opened: { chest: number; prize: QuestPrize; on: string }[]
  /** The days the last keys were won, newest last (two kept), for "The last key took 6 days." */
  keyDays: string[]
  /** When this quest started, for how long its first key took. */
  startedOn: string
  /**
   * The Pirate Quest (2026-10-25): the same quest with islands for chests and map pieces for keys,
   * each island needing one more piece than the last, 2 to 6. The Space Quest (2026-10-26): the same
   * with trips for chests and bars of fuel for keys (`chest` is the place the rocket stands on, 0
   * Earth, and `keys` the bars in its cells). Unset is the Knight's.
   */
  kind?: 'pirate' | 'space'
  /** The last quest's islands and prizes, kept when a new one starts, for the whole voyage shown at its end. */
  previous?: { chest: number; prize: QuestPrize; on: string }[]
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

export function questOf(c: ClassData): QuestState {
  const startedOn = c.createdAt?.slice(0, 10) ?? dateKey()
  if (isPirate(c)) return c.pirateQuest ?? { number: 1, chest: 0, keys: 0, opened: [], keyDays: [], startedOn, kind: 'pirate' }
  if (isSpace(c)) return c.spaceQuest ?? { number: 1, chest: 0, keys: 0, opened: [], keyDays: [], startedOn, kind: 'space' }
  return c.quest ?? { number: 1, chest: 0, keys: 0, opened: [], keyDays: [], startedOn }
}

/** The pieces each island needs on the Pirate Quest: one more than the last, starting at two, since one piece is no puzzle. */
export const PIRATE_PIECES = [2, 3, 4, 5, 6]

/**
 * The Space Quest's fuel (2026-10-26, the teacher): the rocket can't take off until its fuel cells
 * are full, and each trip is further, so it needs more of them. A cell holds four bars, so a trip
 * needs one cell or more rather than one cell with more and more bars; each goal filled pours in
 * two bars, half a cell, which makes a quest 18 goals, near the Pirate Quest's 20.
 */
export const TRIP_CELLS = [1, 1, 2, 2, 3]
export const BARS_PER_CELL = 4
export const BARS_PER_GOAL = 2

export const keysNeeded = (q: QuestState) =>
  q.kind === 'pirate' ? PIRATE_PIECES[q.chest] : q.kind === 'space' ? TRIP_CELLS[q.chest] * BARS_PER_CELL : CHESTS[q.chest].keys

/** Each adventure keeps its own place, so trying another loses nothing. */
const isPirate = (c: ClassData) => c.questAdventure === 'pirate'
const isSpace = (c: ClassData) => c.questAdventure === 'space'
const withState = (c: ClassData, q: QuestState): ClassData =>
  q.kind === 'pirate' ? { ...c, pirateQuest: q } : q.kind === 'space' ? { ...c, spaceQuest: q } : { ...c, quest: q }

/** The chest has all its keys and waits for the teacher's tap. */
export const chestIsReady = (q: QuestState) => q.keys >= keysNeeded(q)

/** Keys won as goals fill: kept as they are won, so a reload, another screen or the floating window never loses one. */
export function withKeysWon(c: ClassData, keys: number, day = dateKey()): ClassData {
  if (keys <= 0) return c
  const q = questOf(c)
  // On the Space Quest a goal pours in two bars of fuel.
  const won = q.kind === 'space' ? keys * BARS_PER_GOAL : keys
  return withState(c, { ...q, keys: q.keys + won, keyDays: [...q.keyDays, day].slice(-2) })
}

/**
 * The chest opened and its prize won: it goes on the map, and the class walks on to the next one,
 * taking any spare keys with it. After the Mega chest a new quest starts at the Wood chest - not
 * Mega forever, which would be a big party every five weeks.
 */
export function withChestOpened(c: ClassData, prize: QuestPrize, day = dateKey()): ClassData {
  const q = questOf(c)
  if (!chestIsReady(q)) return c
  const spare = q.keys - keysNeeded(q)
  const opened = [...q.opened, { chest: q.chest, prize, on: day }]
  if (q.chest === MEGA) {
    return withState(c, {
      number: q.number + 1,
      chest: 0,
      keys: spare,
      opened: [],
      keyDays: q.keyDays,
      startedOn: day,
      kind: q.kind,
      previous: opened,
    })
  }
  return withState(c, { ...q, chest: q.chest + 1, keys: spare, opened })
}

/** The quest from the start, for a teacher who tried it out first (Points' Start Over). The meter is left alone. */
export function withQuestRestarted(c: ClassData, day = dateKey()): ClassData {
  return withState(c, {
    number: 1,
    chest: 0,
    keys: 0,
    opened: [],
    keyDays: [],
    startedOn: day,
    ...(isPirate(c) && { kind: 'pirate' as const }),
    ...(isSpace(c) && { kind: 'space' as const }),
  })
}

function daysFrom(a: string, b: string): number {
  const t = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.round((t(b) - t(a)) / 86_400_000)
}

/**
 * How long the last key took, in days, to help set the goal's size (about a key a week makes a
 * quest a semester). Null before the first key.
 */
export function lastKeyTook(q: QuestState): number | null {
  const [a, b] = q.keyDays.length >= 2 ? q.keyDays.slice(-2) : [q.startedOn, q.keyDays[0]]
  if (!b || !a) return null
  return Math.max(0, daysFrom(a, b))
}

export function lastKeyWords(q: QuestState): string {
  const days = lastKeyTook(q),
    what = q.kind === 'pirate' ? 'piece' : 'key'
  // On the Space Quest a goal is two bars of fuel.
  if (q.kind === 'space') {
    if (days === null) return 'No fuel yet.'
    if (days === 0) return 'The last 2 bars took less than a day.'
    return `The last 2 bars took ${days} ${days === 1 ? 'day' : 'days'}.`
  }
  if (days === null) return `No ${what}s yet.`
  if (days === 0) return `The last ${what} took less than a day.`
  return `The last ${what} took ${days} ${days === 1 ? 'day' : 'days'}.`
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
