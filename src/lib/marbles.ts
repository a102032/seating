import type { ClassData } from '../types'
import { dateKey } from './attendance'
import type { QuestPrize } from './quest'

/**
 * The Marble Jar (DECISIONS, "The Marble Jar"): the teacher's own marble jar on the board, a class's
 * pointsMode 'quest' (the Knight's, Pirate and Space quests that shared it were retired 2026-10-30).
 * Each goal filled wins a spin of the marble wheel; the marbles it wins pour into the class jar,
 * falling and piling up as real marbles do (lib/marblePhysics); a jar filled to its line opens the
 * prize wheel. Everything here only works things out; components/MarbleMoment draws it.
 */

export type MarbleKind = 'plain' | 'power' | 'mega'
const KINDS: MarbleKind[] = ['plain', 'power', 'mega']

/**
 * A marble as kept with the class: its kind, its colour, where it came to rest and how it was
 * turned, and its size (a marble the Power Marble zapped is bigger than a plain one). Kept where
 * they settled, so a reload, the laptop and the board all show the same jar without dropping
 * them again. Short, because a full jar is sixty of them in every save.
 */
export type SavedMarble = [kind: 0 | 1 | 2, colour: number, x: number, y: number, angle: number, r: number]

export const kindOf = (m: SavedMarble): MarbleKind => KINDS[m[0]]
export const kindCode = (k: MarbleKind): 0 | 1 | 2 => KINDS.indexOf(k) as 0 | 1 | 2

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
export const RADIUS: Record<MarbleKind, number> = { plain: 1, power: 1.4, mega: 2.7 }

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

export type WedgeId = '5' | 'power' | 'mega'

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
 * Every spin a win (2026-10-28, the teacher: the stars are earned by effort, and a 2 or 3 felt like a
 * loss to the child who spun it): eight equal wedges, six of 5 marbles, one Power Marble and one Mega,
 * so each wedge is still as wide as its chance and the Mega is about 1 spin in 8, about once a jar.
 * A spin adds about 5.5 to the jar, so a jar is about 10 or 11 spins: two prize wheels a semester,
 * which the teacher wants. The Power and the Mega sit opposite each other.
 */
export const WEDGES: Wedge[] = (
  [
    { id: '5', tier: 'plain', fill: '#38bdf8' },
    { id: '5', tier: 'plain', fill: '#a3e635' },
    { id: 'power', tier: 'silver' },
    { id: '5', tier: 'plain', fill: '#f472b6' },
    { id: '5', tier: 'plain', fill: '#a78bfa' },
    { id: '5', tier: 'plain', fill: '#fb923c' },
    { id: 'mega', tier: 'gold' },
    { id: '5', tier: 'plain', fill: '#2dd4bf' },
  ] as const
).map((w, i) => ({ ...w, from: i * 45, to: (i + 1) * 45 }))

/** Where the wheel lands: a point anywhere round it, so each wedge's chance is its width. */
export function spinLanding(random = Math.random): { wedge: number; at: number } {
  const spot = random() * 360
  const wedge = Math.max(
    0,
    WEDGES.findIndex((w) => spot >= w.from && spot < w.to),
  )
  const w = WEDGES[wedge]
  const edge = Math.min(2, (w.to - w.from) * 0.15)
  return { wedge, at: Math.min(w.to - edge, Math.max(w.from + edge, spot)) }
}

/** What a wedge pours in. */
export function marblesFor(id: WedgeId): MarbleKind[] {
  if (id === 'power') return ['power']
  if (id === 'mega') return ['mega']
  return Array(Number(id)).fill('plain')
}

export const WEDGE_WORDS: Record<WedgeId, string> = {
  '5': '5 marbles!',
  power: 'Power Marble!',
  mega: 'Mega Marble!',
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

/** The marbles' colours, Toy Theater's bright set (the teacher liked their look). */
export const MARBLE_COLOURS = ['#ef3b3b', '#2b9be0', '#5cbf4a', '#f7d230', '#9b6ef3', '#ff8a2a', '#25c4b3', '#f364a8']
export const POWER_COLOUR = '#5b8cff'
export const MEGA_COLOUR = '#ff5a5f'
