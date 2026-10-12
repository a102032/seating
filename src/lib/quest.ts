import type { ClassData, PrizeSize, QuestPrize, QuestState } from '../types'
import { dateKey } from './attendance'
import { pointsModeOf } from './points'

/**
 * The Quest (DECISIONS, "Treasure Quest", "The plan, agreed"): each goal filled wins a key; five
 * chests a quest, needing 1, 2, 3, 4 and 5 keys, so a quest is fifteen keys, about a semester at
 * a key a week. A chest with all its keys opens on a tap, and a wheel of eight prizes rises out
 * of it. After the Mega chest a new quest starts at the Wood chest.
 */

export interface ChestTier {
  name: string
  keys: number
}

export const CHESTS: ChestTier[] = [
  { name: 'Wood', keys: 1 },
  { name: 'Bronze', keys: 2 },
  { name: 'Silver', keys: 3 },
  { name: 'Gold', keys: 4 },
  { name: 'Mega', keys: 5 },
]

/**
 * How each chest's eight slices are shared out: small (plain), medium (silver) and big (gold).
 * Every quest ends on a big prize, no chest's worst prize is worse than the usual one of the chest
 * before, and the first gold slice is on the Silver wheel (the agreed odds, 2026-10-12).
 */
export const ODDS: [number, number, number][] = [
  [6, 2, 0],
  [4, 4, 0],
  [2, 5, 1],
  [0, 6, 2],
  [0, 0, 8],
]

/** The teacher's own rewards, the list a class starts with. */
export const DEFAULT_PRIZES: QuestPrize[] = [
  { id: 'p-draw', name: 'Drawing time', size: 's' },
  { id: 'p-read', name: 'Reading time', size: 's' },
  { id: 'p-game', name: 'Game time', size: 's' },
  { id: 'p-music', name: 'Music time', size: 's' },
  { id: 'p-video', name: '10-minute video', size: 'm' },
  { id: 'p-pick', name: 'Class picks the game', size: 'm' },
  { id: 'p-friend', name: 'Sit with a friend', size: 'm' },
  { id: 'p-box', name: 'Treasure box', size: 'b' },
  { id: 'p-party', name: 'Toy party', size: 'b' },
  { id: 'p-candy', name: 'Candy', size: 'b' },
]

export const SIZE_NAMES: Record<PrizeSize, string> = { s: 'Small', m: 'Medium', b: 'Big' }

/** Fifteen keys, a quest. */
const KEYS_PER_QUEST = CHESTS.reduce((n, c) => n + c.keys, 0)

export function prizesOf(c: ClassData): QuestPrize[] {
  return c.prizes && c.prizes.length ? c.prizes : DEFAULT_PRIZES
}

export function questOf(c: ClassData): QuestState {
  return c.quest ?? { number: 1, keys: 0, opened: [], keyDays: [], startedOn: c.createdAt?.slice(0, 10) ?? dateKey() }
}

/** Keys the chests before this one used. */
function keysBefore(chest: number): number {
  return CHESTS.slice(0, chest).reduce((n, c) => n + c.keys, 0)
}

export interface ChestNow {
  /** 0 Wood ... 4 Mega. */
  chest: number
  /** Keys in its locks, never more than it needs. */
  have: number
  need: number
  /** Every lock is gold: it opens on a tap. */
  ready: boolean
}

/** The chest the class is on, and how many of its locks are gold. */
export function chestNow(q: QuestState): ChestNow {
  const chest = Math.min(q.opened.length, CHESTS.length - 1)
  const need = CHESTS[chest].keys
  const have = Math.max(0, Math.min(need, q.keys - keysBefore(chest)))
  return { chest, have, need, ready: have >= need }
}

/**
 * Keys won as goals fill. Only a class goal wins them. A key won while a full chest waits carries
 * into the next chest; the chest still opens on its own tap.
 */
export function withKeysWon(c: ClassData, keys: number, day = dateKey()): ClassData {
  if (keys <= 0 || pointsModeOf(c) !== 'goal') return c
  const q = questOf(c)
  return { ...c, quest: { ...q, keys: q.keys + keys, keyDays: [...q.keyDays, day].slice(-2) } }
}

/**
 * A full chest opened, and what the wheel gave. After the Mega chest a new quest starts at the
 * Wood chest; keys won past the Mega chest's carry into it.
 */
export function withChestOpened(c: ClassData, prize: QuestPrize, day = dateKey()): ClassData {
  const q = questOf(c)
  if (!chestNow(q).ready) return c
  const opened = [...q.opened, { prize, on: day }]
  if (opened.length < CHESTS.length) return { ...c, quest: { ...q, opened } }
  return { ...c, quest: { number: q.number + 1, keys: q.keys - KEYS_PER_QUEST, opened: [], keyDays: q.keyDays, startedOn: day } }
}

/** Whole days between two date keys. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00`)
  const b = Date.parse(`${to}T12:00:00`)
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * "The last key took 6 days.", to help set the goal's size: from the key before, or the first
 * key from the start of the quest. Null before there is a key.
 */
export function lastKeyTook(q: QuestState): string | null {
  const last = q.keyDays[q.keyDays.length - 1]
  if (!last || q.keys <= 0) return null
  const from = q.keyDays.length > 1 ? q.keyDays[q.keyDays.length - 2] : q.startedOn
  const days = daysBetween(from, last)
  if (days === 0) return 'The last key took less than a day.'
  return `The last key took ${days} day${days === 1 ? '' : 's'}.`
}

/** A slice of a chest's wheel: the prize, and whether its slice is plain, silver or gold. */
export interface Slice {
  prize: QuestPrize
  size: PrizeSize
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Prizes of one size, for its slices. A list with none of a size borrows from the nearest one
 * (a medium slice takes a small prize before a big one), and the slice keeps the size the odds
 * gave it, so the wheel always has its gold.
 */
function prizesFor(size: PrizeSize, prizes: QuestPrize[]): QuestPrize[] {
  const order: Record<PrizeSize, PrizeSize[]> = { s: ['s', 'm', 'b'], m: ['m', 's', 'b'], b: ['b', 'm', 's'] }
  for (const s of order[size]) {
    const found = prizes.filter((p) => p.size === s)
    if (found.length) return found
  }
  return DEFAULT_PRIZES.filter((p) => p.size === size)
}

/**
 * A chest's wheel: eight slices by the agreed odds, each size's prizes spread over its slices
 * before any repeats, and gold slices spaced round the wheel rather than side by side.
 */
export function buildWheel(chest: number, prizes: QuestPrize[]): Slice[] {
  const [small, medium, big] = ODDS[chest]
  const take = (size: PrizeSize, n: number): Slice[] => {
    const pool = shuffled(prizesFor(size, prizes))
    return Array.from({ length: n }, (_, i) => ({ prize: pool[i % pool.length], size }))
  }
  const slots: (Slice | null)[] = new Array(8).fill(null)
  const gold = take('b', big)
  const start = Math.floor(Math.random() * 8)
  gold.forEach((s, i) => {
    let at = (start + Math.round((i * 8) / Math.max(1, big))) % 8
    while (slots[at]) at = (at + 1) % 8
    slots[at] = s
  })
  // Plain and silver mixed, so the silver ones don't bunch together either.
  const rest = shuffled([...take('s', small), ...take('m', medium)])
  for (let i = 0; i < 8; i++) if (!slots[i]) slots[i] = rest.pop()!
  return slots as Slice[]
}

/** A new prize's id. */
export function prizeId(): string {
  return `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
