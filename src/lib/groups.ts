import type { Gender, GroupPlace, SavedGroups, Student, StudentGroup } from '../types'
import type { LayoutPlan } from './layouts'
import { neighbourGroups, neighbourhoods, placeGroups, type Placed } from './seatGroups'

/**
 * How the class gets split. The teacher picks one with a single tap - nothing here is typed.
 *
 * - `count`: this many groups, as even as they can be: the room cut into that many
 *   neighbourhoods (lib/seatGroups).
 * - `size`: groups of this many, from the desks side by side and behind (lib/seatGroups);
 *   nobody is ever left as a group of one, the thing that makes a kid feel left over.
 * - `gender`: boys and girls. Students with no gender set go wherever there's more room.
 * - `rows`: one group per row of desks, or per table in a table layout.
 *
 * Groups made from the seats are numbered, and their cards placed, the way they sit in the room
 * (seatGroups' placeGroups), front of the room first, left to right.
 *
 * Counts and sizes are made from where the students sit, so nobody carries a chair across the
 * room (2026-10-05, the teacher's call); Shuffle is the way to mix them (`mix`).
 */
export type GroupScheme = { kind: 'count'; count: number } | { kind: 'size'; size: number } | { kind: 'gender' } | { kind: 'rows' }

/** A scheme in the Group Activity window's own words, for Continue with Last Groups: "Pairs · 13 groups". */
export function schemeLabel(scheme: GroupScheme | undefined, groups: number, setName: 'row' | 'table'): string {
  const many = `${groups} ${groups === 1 ? 'group' : 'groups'}`
  if (!scheme || scheme.kind === 'count') return many
  if (scheme.kind === 'size') return `${scheme.size === 2 ? 'Pairs' : `Groups of ${scheme.size}`} · ${many}`
  if (scheme.kind === 'gender') return 'Boys / Girls'
  return `${setName === 'table' ? 'Tables' : 'Rows'} · ${many}`
}

/**
 * Fixed colours, the same on every theme, ordered so the first six - the counts a class
 * uses most - are six different families: Group 1 and Group 2 should never be told apart by
 * a squint.
 *
 * None of them is red, amber, orange, green or grey, because those are the statuses (Help,
 * Ready, Done, Working) and the status is what the room scans for. The set used to include
 * the exact red of Help and green of Done, so Group 1 always wore a red band, even while it
 * was working happily, and "look for the red card" stopped working. Twelve colours; pairs
 * of a full 35 make 17 groups, so the last few repeat.
 */
export const GROUP_COLORS: { bg: string; fg: string }[] = [
  { bg: '#3b82f6', fg: '#ffffff' }, // blue
  { bg: '#ec4899', fg: '#ffffff' }, // pink
  { bg: '#14b8a6', fg: '#ffffff' }, // teal
  { bg: '#8b5cf6', fg: '#ffffff' }, // violet
  { bg: '#8d5a2b', fg: '#ffffff' }, // brown
  { bg: '#334155', fg: '#ffffff' }, // charcoal
  { bg: '#0ea5e9', fg: '#ffffff' }, // sky
  { bg: '#d946ef', fg: '#ffffff' }, // fuchsia
  { bg: '#6366f1', fg: '#ffffff' }, // indigo
  { bg: '#0891b2', fg: '#ffffff' }, // cyan
  { bg: '#7e22ce', fg: '#ffffff' }, // plum
  { bg: '#1e3a8a', fg: '#ffffff' }, // navy
]

/**
 * The app's gender colours, close to the card backs', so Boys / Girls reads at once. Girls
 * were rose, a red that read as Help from the back of the room; they are pink now.
 */
export const GENDER_COLORS: Record<'boy' | 'girl', { bg: string; fg: string }> = {
  boy: { bg: '#0ea5e9', fg: '#ffffff' },
  girl: { bg: '#ec4899', fg: '#ffffff' },
}

/** Text colour for a group's band - dark on the two light colours, white everywhere else. */
export function groupTextColor(bg: string): string {
  return GROUP_COLORS.find((c) => c.bg === bg)?.fg ?? '#ffffff'
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Round-robin deal, so group sizes never differ by more than one. */
function deal(ids: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => [])
  ids.forEach((id, i) => groups[i % groupCount].push(id))
  return groups
}

interface SeatedStudent {
  student: Student
  deskIndex: number
}

/** Where each seated student sits in the room. A desk the plan doesn't draw (there shouldn't be one) counts as behind the back row. */
function placed(seated: SeatedStudent[], plan: LayoutPlan): Placed[] {
  return seated.map((s) => ({
    id: s.student.id,
    seat: plan.seats[s.deskIndex] ?? { column: s.deskIndex % plan.columns, row: plan.rows, set: -1 },
  }))
}

/** The groups a count, a size or the rows make from the seats, in the order they are numbered, with their cards' places. */
function bySeats(
  scheme: { kind: 'count'; count: number } | { kind: 'size'; size: number } | { kind: 'rows' },
  seated: SeatedStudent[],
  plan: LayoutPlan,
): { members: string[][]; places: GroupPlace[] | null } {
  const where = placed(seated, plan)
  let groups: Placed[][]
  if (scheme.kind === 'count') groups = neighbourhoods(where, plan, Math.min(scheme.count, where.length))
  else if (scheme.kind === 'size') groups = neighbourGroups(where, plan, scheme.size)
  else {
    const sets = new Map<number, Placed[]>()
    where.forEach((p) => sets.set(p.seat.set, [...(sets.get(p.seat.set) ?? []), p]))
    groups = [...sets.values()]
  }
  const { groups: ordered, places } = placeGroups(groups)
  return { members: ordered.map((g) => g.map((p) => p.id)), places }
}

function seatedStudents(seating: (string | null)[], studentsById: Map<string, Student>): SeatedStudent[] {
  const out: SeatedStudent[] = []
  seating.forEach((id, deskIndex) => {
    const student = id ? studentsById.get(id) : undefined
    if (student) out.push({ student, deskIndex })
  })
  return out
}

/**
 * What a scheme would produce, for the chooser's captions - "15 groups", "5 each" - and for
 * greying out the schemes that don't fit this class. Null means the scheme can't be used.
 */
export function describeScheme(
  scheme: GroupScheme,
  seating: (string | null)[],
  studentsById: Map<string, Student>,
  plan: LayoutPlan,
): { groups: number; caption: string } | null {
  const seated = seatedStudents(seating, studentsById)
  const n = seated.length
  if (n < 2) return null
  const setOf = (deskIndex: number) => plan.seats[deskIndex]?.set ?? -1

  switch (scheme.kind) {
    case 'count': {
      if (scheme.count > n) return null
      // What the seats will actually make, so the caption never promises what the deal won't give.
      const sizes = bySeats(scheme, seated, plan).members.map((g) => g.length)
      const small = Math.min(...sizes)
      const large = Math.max(...sizes)
      return {
        groups: sizes.length,
        caption: small === large ? `${small} each` : `${small}–${large} each`,
      }
    }
    case 'size': {
      if (scheme.size > n) return null
      const groups = bySeats(scheme, seated, plan).members.length
      return { groups, caption: `${groups} group${groups === 1 ? '' : 's'}` }
    }
    case 'gender': {
      const boys = seated.filter((s) => s.student.gender === 'boy').length
      const girls = seated.filter((s) => s.student.gender === 'girl').length
      if (boys === 0 || girls === 0) return null
      return { groups: 2, caption: `${boys} · ${girls}` }
    }
    case 'rows': {
      const rows = new Set(seated.map((s) => setOf(s.deskIndex)))
      if (rows.size < 2) return null
      return { groups: rows.size, caption: `${rows.size} groups` }
    }
  }
}

function makeGroup(
  index: number,
  studentIds: string[],
  name?: string,
  color?: { bg: string },
  id?: string,
  place?: GroupPlace,
): StudentGroup {
  return {
    id: id ?? crypto.randomUUID(),
    name: name ?? `Group ${index + 1}`,
    color: (color ?? GROUP_COLORS[index % GROUP_COLORS.length]).bg,
    studentIds,
    points: 0,
    ...(place ? { place } : {}),
  }
}

/**
 * Deal the seated class into groups. Counts, sizes and rows come from the seats; boys and girls
 * from the roster. With `mix` (Shuffle) everyone is dealt at random instead, into as many cards
 * as are on the board, so Shuffle is the one way to mix a class up. `previous` keeps each card's
 * identity by position, and its place on the board, so a shuffle re-deals the chips without tearing
 * the cards down around them.
 */
export function buildGroups(
  scheme: GroupScheme,
  seating: (string | null)[],
  studentsById: Map<string, Student>,
  previous: StudentGroup[] | undefined,
  plan: LayoutPlan,
  { mix = false }: { mix?: boolean } = {},
): StudentGroup[] {
  const seated = seatedStudents(seating, studentsById)
  const ids = seated.map((s) => s.student.id)
  const keepId = (i: number) => previous?.[i]?.id
  const numbered = (members: string[][], places: (GroupPlace | undefined)[] | null) =>
    members.map((m, i) => makeGroup(i, m, `Group ${i + 1}`, undefined, keepId(i), places?.[i]))

  if (mix && scheme.kind !== 'gender') {
    const cards = previous && previous.length > 0 ? previous.length : buildGroups(scheme, seating, studentsById, undefined, plan).length
    const members = deal(shuffled(ids), Math.max(1, Math.min(cards, ids.length)))
    // Every card keeps its place only if every card had one, so the board never mixes the two layouts.
    const places = previous && previous.length === members.length && previous.every((g) => g.place) ? previous.map((g) => g.place) : null
    return numbered(members, places)
  }

  switch (scheme.kind) {
    case 'count':
    case 'size':
    case 'rows': {
      const { members, places } = bySeats(scheme, seated, plan)
      return numbered(members, places)
    }
    case 'gender': {
      const byGender: Record<Gender, string[]> = {
        boy: [],
        girl: [],
        unspecified: [],
      }
      shuffled(seated).forEach((s) => byGender[s.student.gender].push(s.student.id))
      // Nobody is left out for want of a gender: the unspecified go to whichever side is
      // shorter, one at a time, so the two sides stay as even as the class allows.
      byGender.unspecified.forEach((id) => (byGender.boy.length <= byGender.girl.length ? byGender.boy : byGender.girl).push(id))
      return [
        makeGroup(0, byGender.boy, 'Boys', GENDER_COLORS.boy, keepId(0)),
        makeGroup(1, byGender.girl, 'Girls', GENDER_COLORS.girl, keepId(1)),
      ]
    }
  }
}

/**
 * How many groups "I'll choose" starts with: the count chosen, half the class for pairs (the
 * last pair a three in an odd class), or a group for every table with someone at it. Counted
 * over everyone at a desk, away today too, since groups chosen by hand are for the whole class.
 */
export function framesFor(scheme: GroupScheme, seating: (string | null)[], plan: LayoutPlan): number {
  const seated = seating.map((id, desk) => (id ? desk : -1)).filter((desk) => desk >= 0)
  if (scheme.kind === 'count') return Math.min(scheme.count, seated.length)
  if (scheme.kind === 'size') return Math.max(1, Math.floor(seated.length / scheme.size))
  if (scheme.kind === 'rows') return new Set(seated.map((desk) => plan.seats[desk]?.set ?? -1)).size
  return 2
}

/** Groups the teacher made by hand ("I'll choose"), numbered in the order they were filled. No places: the board deals them in its usual grid. */
export function handMadeGroups(members: string[][]): StudentGroup[] {
  return members.filter((m) => m.length > 0).map((m, i) => makeGroup(i, m))
}

/** The most saved groups a class keeps, so the Group Activity window stays short. */
export const MAX_SAVED_GROUPS = 6

/**
 * Saved groups brought back for today's lesson. A student no longer seated drops out, and a
 * student seated since they were saved joins the smallest group (the first of them, on a tie),
 * so nobody is left without a group; `joined` says who went where, for the line the teacher
 * sees. Points and statuses start fresh.
 */
export function groupsFromSaved(
  saved: SavedGroups,
  seating: (string | null)[],
): { groups: StudentGroup[]; joined: { studentId: string; groupName: string }[] } {
  const seated = seating.filter((id): id is string => Boolean(id))
  const here = new Set(seated)
  const groups: StudentGroup[] = saved.groups
    .map((g) => ({
      id: crypto.randomUUID(),
      name: g.name,
      color: g.color,
      studentIds: g.studentIds.filter((id) => here.has(id)),
      points: 0,
      ...(g.place ? { place: g.place } : {}),
    }))
    .filter((g) => g.studentIds.length > 0)
  const grouped = new Set(groups.flatMap((g) => g.studentIds))
  const joined: { studentId: string; groupName: string }[] = []
  if (groups.length === 0) return { groups, joined }
  for (const id of seated) {
    if (grouped.has(id)) continue
    const smallest = groups.reduce((a, b) => (b.studentIds.length < a.studentIds.length ? b : a))
    smallest.studentIds = [...smallest.studentIds, id]
    joined.push({ studentId: id, groupName: smallest.name })
  }
  return { groups, joined }
}

/**
 * Saved groups after the roster or seating has changed: anyone no longer seated drops out,
 * and a group left with nobody in it goes too. Points are kept - they belong to the group,
 * not to whoever happened to leave.
 */
export function pruneGroups(groups: StudentGroup[], seating: (string | null)[]): StudentGroup[] {
  const seated = new Set(seating.filter(Boolean) as string[])
  return groups
    .map((g) => ({
      ...g,
      studentIds: g.studentIds.filter((id) => seated.has(id)),
    }))
    .filter((g) => g.studentIds.length > 0)
}

/** Move one student into another group. A no-op if they're already there. */
export function moveStudent(groups: StudentGroup[], studentId: string, toGroupId: string): StudentGroup[] {
  const from = groups.find((g) => g.studentIds.includes(studentId))
  if (!from || from.id === toGroupId) return groups
  return groups.map((g) => {
    if (g.id === from.id)
      return {
        ...g,
        studentIds: g.studentIds.filter((id) => id !== studentId),
      }
    if (g.id === toGroupId) return { ...g, studentIds: [...g.studentIds, studentId] }
    return g
  })
}

/** What finishing the activity will put on the class goal, for the message the teacher sees afterwards. */
export function summarizeGroupPoints(groups: StudentGroup[]): { totalPoints: number } {
  return { totalPoints: groups.reduce((sum, g) => sum + g.points, 0) }
}
