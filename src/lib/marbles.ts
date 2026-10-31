import type { ClassData } from '../types'
import { dateKey } from './attendance'
import { LUNAR_NEW_YEAR } from './greetings'
import type { QuestPrize } from './quest'

/**
 * The Marble Jar (DECISIONS, "The Marble Jar"): the teacher's own marble jar on the board, a class's
 * pointsMode 'quest' (the Knight's, Pirate and Space quests that shared it were retired 2026-10-30).
 * Each goal filled wins a spin of the marble wheel; the marbles it wins pour into the class jar,
 * falling and piling up as real marbles do (lib/marbleScene); a jar filled to its line opens the
 * prize wheel. Everything here only works things out; components/MarbleMoment draws it.
 */

/**
 * Plain marbles (some with a season's design, or popped popcorn), the Power Marble, the Mega, the
 * rare Mega Mega Marble (2026-10-31) and the rain cloud's tiny drops, which stay tiny.
 */
export type MarbleKind = 'plain' | 'power' | 'mega' | 'megamega' | 'drop'
const KINDS: MarbleKind[] = ['plain', 'power', 'mega', 'megamega', 'drop']

/**
 * A marble as kept with the class: its kind, its colour, where it came to rest and how it was
 * turned, and its size (a marble the Power Marble zapped is bigger than a plain one). Kept where
 * they settled, so a reload, the laptop and the board all show the same jar without dropping
 * them again. Short, because a full jar is sixty of them in every save.
 */
export type SavedMarble = [kind: KindCode, colour: number, x: number, y: number, angle: number, r: number, design?: string]
export type KindCode = 0 | 1 | 2 | 3 | 4

export const kindOf = (m: SavedMarble): MarbleKind => KINDS[m[0]] ?? 'plain'
export const kindCode = (k: MarbleKind): KindCode => KINDS.indexOf(k) as KindCode

export interface MarbleJarState {
  /** Which jar the class is on, from 1. */
  number: number
  marbles: SavedMarble[]
  /**
   * Spins won and not yet spun. A goal filled with the app behind the lesson (the floating window)
   * waits here for the board, and so does one won while the jar is full: it goes into the next jar.
   */
  spins: number
  /** The jars filled, with the prize each one won. */
  filled: { prize: QuestPrize; on: string }[]
  /** The days the last spins were won, newest last (two kept), for "The last spin took 6 days." */
  spinDays: string[]
  startedOn: string
}

export function jarOf(c: ClassData): MarbleJarState {
  return c.marbleJar ?? { number: 1, marbles: [], spins: 0, filled: [], spinDays: [], startedOn: c.createdAt?.slice(0, 10) ?? dateKey() }
}

// --- The jar --------------------------------------------------------------------------------------

/**
 * The jar, in the physics' own units (y down; a plain marble is 2 across). The glass is 14 marbles'
 * radius wide inside (2026-10-24, the teacher: a sixth wider, the marbles the same size, so it
 * fills more slowly), with shoulders curving in to a neck a Mega drops through easily.
 */
export const JAR = {
  W: 20,
  H: 27,
  CX: 10,
  FLOOR: 25.6,
  WALL: 7,
  SHOULDER: 10.4,
  NECK: 4.6,
  NECK_TOP: 7.2,
  MOUTH: 6.1,
  FILL_Y: 9.3,
  CORNER: 2.2,
}

/**
 * The Mega a touch bigger since every spin became a win (2026-10-30, the teacher): 2.7 fills about 7
 * plain marbles' room, more than a Power Marble with the five it zaps on average (about 6.8), so the
 * Mega stays the biggest win in what it adds to the jar. It still drops easily through the neck (4.6 each side).
 */
export const RADIUS: Record<MarbleKind, number> = { plain: 1, power: 1.4, mega: 2.7, megamega: 3.3, drop: 0.42 }

/** The inside of the glass: the left half from the mouth down to the middle of the floor, then the same mirrored back up. */
export const JAR_PATH: [number, number][] = (() => {
  const { CX, NECK, NECK_TOP, WALL, SHOULDER, FLOOR, MOUTH, CORNER: c } = JAR
  const half: [number, number][] = [
    [CX - NECK, MOUTH],
    [CX - NECK, NECK_TOP],
  ]
  for (let i = 1; i <= 6; i++) {
    const t = i / 6
    half.push([
      CX - NECK - (WALL - NECK) * Math.sin((t * Math.PI) / 2),
      NECK_TOP + (SHOULDER - NECK_TOP) * (1 - Math.cos((t * Math.PI) / 2)),
    ])
  }
  half.push([CX - WALL, FLOOR - c])
  for (let i = 1; i <= 6; i++) {
    const a = Math.PI - (i / 6) * (Math.PI / 2)
    half.push([CX - WALL + c + c * Math.cos(a), FLOOR - c + c * Math.sin(a)])
  }
  half.push([CX, FLOOR])
  const right = half
    .slice(0, -1)
    .reverse()
    .map(([x, y]): [number, number] => [2 * CX - x, y])
  return [...half, ...right]
})()

/** The inside of the glass under a height, measured by sampling, since the shoulders curve. */
function glassBelow(y0: number): number {
  const inside = (x: number, y: number) => {
    let c = false
    for (let i = 0, j = JAR_PATH.length - 1; i < JAR_PATH.length; j = i++) {
      const [xi, yi] = JAR_PATH[i]
      const [xj, yj] = JAR_PATH[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  let n = 0
  const d = 0.1
  for (let x = JAR.CX - JAR.WALL; x < JAR.CX + JAR.WALL; x += d)
    for (let y = y0; y < JAR.FLOOR; y += d) if (inside(x + d / 2, y + d / 2)) n++
  return n * d * d
}

/**
 * How much the jar holds up to its line, counted in plain marbles (about 58). The jar is full by how
 * much of it the marbles fill, never by one big marble poking up to the line (2026-10-24, the
 * teacher: a Mega touching the line with the jar mostly empty wasn't fair). Marbles leave gaps, so
 * it is the glass under the line at 80% packed, which, tried, is where piles of mixed marbles reach
 * the line.
 */
export const CAPACITY = Math.round((glassBelow(JAR.FILL_Y) * 0.8) / Math.PI)

/** How much a marble fills: a plain one 1, a Power Marble about 2, a Mega about 7. */
const room = (m: SavedMarble) => m[5] * m[5]

export const jarFill = (s: MarbleJarState) => s.marbles.reduce((n, m) => n + room(m), 0)
export const jarIsFull = (s: MarbleJarState) => jarFill(s) >= CAPACITY - 0.01

// --- The marble wheel -----------------------------------------------------------------------------

export type WedgeId = '5' | 'rain' | 'popcorn' | 'power' | 'mega' | 'witch' | 'santa' | 'envelope'

export interface Wedge {
  id: WedgeId
  /** Plain for 5 marbles, silver for the Power Marble, gold for the Mega, as on the prize wheel. */
  tier: 'plain' | 'silver' | 'gold'
  fill?: string
  /** Degrees round the wheel, clockwise from the top. */
  from: number
  to: number
}

/**
 * The special marbles a class's wheel has, each on unless switched off in Points' More options
 * (2026-10-31, the teacher's students' ideas). A wedge switched off is 5 marbles, so the pace stays.
 */
export interface MarbleExtras {
  rain?: boolean
  popcorn?: boolean
  power?: boolean
  mega?: boolean
  seasons?: boolean
}
export const EXTRAS: (keyof MarbleExtras)[] = ['rain', 'popcorn', 'power', 'mega', 'seasons']
export const extraOn = (e: MarbleExtras | undefined, k: keyof MarbleExtras) => e?.[k] !== false

/** The season the calendar is in, for the seasonal marbles: October, December, and the school weeks before Lunar New Year. */
export type Season = 'none' | 'oct' | 'dec' | 'lny'
const dayNumber = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000
/** Today, or the day a check pretends it is (window.__marbleDay), to see each season's jar. */
const today = () => (globalThis as { __marbleDay?: string }).__marbleDay ?? dateKey()
export function seasonOn(day = today()): Season {
  const month = +day.slice(5, 7)
  if (month === 10) return 'oct'
  if (month === 12) return 'dec'
  const n = dayNumber(day)
  // It often falls in the winter break, so its marbles come in the four weeks before, and stay a fortnight after.
  if (LUNAR_NEW_YEAR.some((d) => n >= dayNumber(d) - 28 && n <= dayNumber(d) + 14)) return 'lny'
  return 'none'
}
export const seasonFor = (e: MarbleExtras | undefined, day = today()): Season => (extraOn(e, 'seasons') ? seasonOn(day) : 'none')

const SEASON_WEDGE: Record<Exclude<Season, 'none'>, WedgeId> = { oct: 'witch', dec: 'santa', lny: 'envelope' }
const PLAIN_FILLS = ['#38bdf8', '#a3e635', '#f472b6', '#fb923c', '#a78bfa', '#2dd4bf']

/**
 * Every spin a win (2026-10-28, the teacher): eight equal wedges, so each is as wide as its chance.
 * Since 2026-10-31: 5 marbles, the rain cloud, the Power Marble, 5, popcorn, 5 (or the season's own
 * wedge), the Mega, 5. Each new wedge adds about what 5 marbles do (measured in the preview), so a
 * jar is still about 10 or 11 spins. The Power and the Mega sit opposite each other.
 */
export function wedgesFor(extras?: MarbleExtras, season: Season = 'none'): Wedge[] {
  const ids: WedgeId[] = ['5', 'rain', 'power', '5', 'popcorn', '5', 'mega', '5']
  if (!extraOn(extras, 'rain')) ids[1] = '5'
  if (!extraOn(extras, 'power')) ids[2] = '5'
  if (!extraOn(extras, 'popcorn')) ids[4] = '5'
  if (!extraOn(extras, 'mega')) ids[6] = '5'
  if (season !== 'none') ids[5] = SEASON_WEDGE[season]
  let plain = 0
  return ids.map((id, i) => ({
    id,
    tier: id === 'mega' ? 'gold' : id === 'power' ? 'silver' : 'plain',
    fill: id === '5' ? PLAIN_FILLS[plain++ % PLAIN_FILLS.length] : undefined,
    from: i * 45,
    to: (i + 1) * 45,
  }))
}
/** The wheel with everything on and no season. */
export const WEDGES: Wedge[] = wedgesFor()

/** Where the wheel lands: a point anywhere round it, so each wedge's chance is its width. */
export function spinLanding(random = Math.random, wedges = WEDGES): { wedge: number; at: number } {
  const spot = random() * 360
  const wedge = Math.max(
    0,
    wedges.findIndex((w) => spot >= w.from && spot < w.to),
  )
  const w = wedges[wedge]
  const edge = Math.min(2, (w.to - w.from) * 0.15)
  return { wedge, at: Math.min(w.to - edge, Math.max(w.from + edge, spot)) }
}

/** About one Mega in four grows into a Mega Mega Marble, about once a year (2026-10-31). */
export const MEGA_MEGA_CHANCE = 0.25

export const WEDGE_WORDS: Record<WedgeId, string> = {
  '5': '5 marbles!',
  rain: 'Rain cloud!',
  popcorn: 'Popcorn!',
  power: 'Power Marble!',
  mega: 'Mega Marble!',
  witch: 'Witch!',
  santa: 'Santa!',
  envelope: 'Red envelope!',
}

/** How many marbles a Power Marble zaps: 4, 5 or 6, by chance (2026-10-28, the teacher). */
export function zapCount(random = Math.random): number {
  return 4 + Math.min(2, Math.floor(random() * 3))
}

/** The prize wheel a full jar opens: the Gold chest's, mostly medium prizes with two big ones, since a jar is about a semester. */
export const JAR_PRIZE_WHEEL = 3

// --- Changes --------------------------------------------------------------------------------------

/** Spins won as goals fill: kept as they are won, like the Knight's keys. */
export function withSpinsWon(c: ClassData, spins: number, day = dateKey()): ClassData {
  if (spins <= 0) return c
  const j = jarOf(c)
  return { ...c, marbleJar: { ...j, spins: j.spins + spins, spinDays: [...j.spinDays, day].slice(-2) } }
}

/** A spin spun and its marbles settled: the jar kept as they came to rest. */
export function withSpinUsed(c: ClassData, marbles: SavedMarble[]): ClassData {
  const j = jarOf(c)
  return { ...c, marbleJar: { ...j, spins: Math.max(0, j.spins - 1), marbles } }
}

/** The jar as it settled after something moved it without a spin (a marble zapped growing, say). */
export function withMarblesSettled(c: ClassData, marbles: SavedMarble[]): ClassData {
  return { ...c, marbleJar: { ...jarOf(c), marbles } }
}

/** The full jar's prize won: a new, empty jar, with any spins still waiting. */
export function withJarFilled(c: ClassData, prize: QuestPrize, day = dateKey()): ClassData {
  const j = jarOf(c)
  if (!jarIsFull(j)) return c
  return {
    ...c,
    marbleJar: { ...j, number: j.number + 1, marbles: [], filled: [...j.filled, { prize, on: day }].slice(-20), startedOn: day },
  }
}

/** An empty jar from the start, for a teacher who tried it out first (Points' Start Over). */
export function withJarRestarted(c: ClassData, day = dateKey()): ClassData {
  return { ...c, marbleJar: { number: 1, marbles: [], spins: 0, filled: [], spinDays: [], startedOn: day } }
}

function daysFrom(a: string, b: string): number {
  const t = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.round((t(b) - t(a)) / 86_400_000)
}

export function lastSpinWords(j: MarbleJarState): string {
  const [a, b] = j.spinDays.length >= 2 ? j.spinDays.slice(-2) : [j.startedOn, j.spinDays[0]]
  if (!a || !b) return 'No spins yet.'
  const days = Math.max(0, daysFrom(a, b))
  if (days === 0) return 'The last spin took less than a day.'
  return `The last spin took ${days} ${days === 1 ? 'day' : 'days'}.`
}

/** The seasons' marble designs: half the plain marbles a season pours wear one, and they stay in the jar after it. */
export const SEASON_DESIGNS: Record<Season, string[]> = {
  none: [],
  oct: ['pk1', 'pk2', 'pk3', 'pk4', 'pk5', 'lolly', 'ghost', 'franken', 'bat'],
  dec: ['snowflake', 'orn1', 'orn2', 'orn3', 'peppermint', 'candycane', 'snowball'],
  lny: ['fu', 'coin', 'lantern', 'mandarin'],
}
/** Each design's marble colour (popcorn popped white or butter yellow). */
export const DESIGN_COLOUR: Record<string, string> = {
  ghost: '#f4f6ff',
  franken: '#7fcf5f',
  bat: '#7b4cc9',
  snowflake: '#8fd0ff',
  peppermint: '#ffffff',
  candycane: '#ffffff',
  snowball: '#f2f8ff',
  fu: '#d62828',
  pk1: '#f47a12',
  pk2: '#f47a12',
  pk3: '#f47a12',
  pk4: '#f47a12',
  pk5: '#f47a12',
  lolly: '#f29a1f',
  orn1: '#14918f',
  orn2: '#2a9d5c',
  orn3: '#e5383b',
  coin: '#f2c230',
  lantern: '#e63946',
  mandarin: '#ff9f1c',
  puffed: '#fffaf0',
  puffedButter: '#ffe08a',
  megamega: '#2a1470',
}

/** The marbles' colours, Toy Theater's bright set (the teacher liked their look). */
export const MARBLE_COLOURS = ['#ef3b3b', '#2b9be0', '#5cbf4a', '#f7d230', '#9b6ef3', '#ff8a2a', '#25c4b3', '#f364a8']
export const POWER_COLOUR = '#5b8cff'
export const MEGA_COLOUR = '#ff5a5f'
