import { deskColumn, type Gender, type Student, type StudentGroup } from '../types'

/**
 * How the class gets split. The teacher picks one with a single tap - nothing here is typed.
 *
 * - `count`: this many groups, as even as they can be.
 * - `size`: groups of this many; leftovers are spread across the groups rather than left as
 *   a group of one or two, which is the thing that makes a kid feel left over.
 * - `gender`: boys and girls. Students with no gender set go wherever there's more room.
 * - `rows`: one group per row of desks, or per table in a table layout, in board order.
 */
export type GroupScheme = { kind: 'count'; count: number } | { kind: 'size'; size: number } | { kind: 'gender' } | { kind: 'rows' }

/**
 * Which row of desks, or which table, a desk belongs to - the room's layout decides
 * (lib/layouts). In a table layout the `rows` scheme is one group per table.
 */
export type SetOf = (deskIndex: number) => number

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
const GENDER_COLORS: Record<'boy' | 'girl', { bg: string; fg: string }> = {
  boy: { bg: '#0ea5e9', fg: '#ffffff' },
  girl: { bg: '#ec4899', fg: '#ffffff' },
}

/** Colours groups were saved in before the statuses got their colours to themselves. */
const RETIRED_COLORS = new Set(['#ef4444', '#22c55e', '#f97316', '#84cc16', '#f59e0b', '#059669', '#64748b', '#b45309', '#f43f5e'])

/**
 * Saved groups in a retired colour are coloured afresh by position, all of them together so
 * two groups can't end up sharing one - "Continue with Last Groups" would otherwise bring
 * back yesterday's red Group 1.
 */
function recolorRetired(groups: StudentGroup[]): StudentGroup[] {
  if (!groups.some((g) => RETIRED_COLORS.has(g.color))) return groups
  return groups.map((g, i) => ({
    ...g,
    color: g.name === 'Boys' ? GENDER_COLORS.boy.bg : g.name === 'Girls' ? GENDER_COLORS.girl.bg : GROUP_COLORS[i % GROUP_COLORS.length].bg,
  }))
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

function seatedStudents(seating: (string | null)[], studentsById: Map<string, Student>): SeatedStudent[] {
  const out: SeatedStudent[] = []
  seating.forEach((id, deskIndex) => {
    const student = id ? studentsById.get(id) : undefined
    if (student) out.push({ student, deskIndex })
  })
  return out
}

/** How many groups a `size` scheme makes for `n` students: never a group smaller than the size asked for. */
function groupsForSize(n: number, size: number): number {
  return Math.max(1, Math.floor(n / size))
}

/**
 * What a scheme would produce, for the chooser's captions - "15 groups", "5 each" - and for
 * greying out the schemes that don't fit this class. Null means the scheme can't be used.
 */
export function describeScheme(
  scheme: GroupScheme,
  seating: (string | null)[],
  studentsById: Map<string, Student>,
  setOf: SetOf = deskColumn,
): { groups: number; caption: string } | null {
  const seated = seatedStudents(seating, studentsById)
  const n = seated.length
  if (n < 2) return null

  switch (scheme.kind) {
    case 'count': {
      if (scheme.count > n) return null
      const small = Math.floor(n / scheme.count)
      const large = Math.ceil(n / scheme.count)
      return {
        groups: scheme.count,
        caption: small === large ? `${small} each` : `${small}–${large} each`,
      }
    }
    case 'size': {
      if (scheme.size > n) return null
      const groups = groupsForSize(n, scheme.size)
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

function makeGroup(index: number, studentIds: string[], name?: string, color?: { bg: string }, id?: string): StudentGroup {
  return {
    id: id ?? crypto.randomUUID(),
    name: name ?? `Group ${index + 1}`,
    color: (color ?? GROUP_COLORS[index % GROUP_COLORS.length]).bg,
    studentIds,
    points: 0,
  }
}

/**
 * Deal the seated class into groups. Random schemes shuffle first; rows and gender are
 * fixed by the board. `previous` keeps each card's identity by position, so a shuffle
 * re-deals the chips without tearing the cards down around them.
 */
export function buildGroups(
  scheme: GroupScheme,
  seating: (string | null)[],
  studentsById: Map<string, Student>,
  previous?: StudentGroup[],
  setOf: SetOf = deskColumn,
): StudentGroup[] {
  const seated = seatedStudents(seating, studentsById)
  const ids = seated.map((s) => s.student.id)
  const keepId = (i: number) => previous?.[i]?.id

  switch (scheme.kind) {
    case 'count':
      return deal(shuffled(ids), Math.min(scheme.count, ids.length)).map((members, i) =>
        makeGroup(i, members, `Group ${i + 1}`, undefined, keepId(i)),
      )
    case 'size':
      return deal(shuffled(ids), groupsForSize(ids.length, scheme.size)).map((members, i) =>
        makeGroup(i, members, `Group ${i + 1}`, undefined, keepId(i)),
      )
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
    case 'rows': {
      const rows = new Map<number, string[]>()
      seated.forEach((s) => {
        const row = setOf(s.deskIndex)
        rows.set(row, [...(rows.get(row) ?? []), s.student.id])
      })
      return Array.from(rows.keys())
        .sort((a, b) => a - b)
        .map((row, i) => makeGroup(i, rows.get(row) ?? [], `Group ${i + 1}`, undefined, keepId(i)))
    }
  }
}

/**
 * Saved groups after the roster or seating has changed: anyone no longer seated drops out,
 * and a group left with nobody in it goes too. Points are kept - they belong to the group,
 * not to whoever happened to leave.
 */
export function pruneGroups(groups: StudentGroup[], seating: (string | null)[]): StudentGroup[] {
  const seated = new Set(seating.filter(Boolean) as string[])
  return recolorRetired(groups)
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

/** What finishing the activity will hand out, for the message the teacher sees afterwards. */
export function summarizeGroupPoints(groups: StudentGroup[]): {
  totalPoints: number
  studentsAwarded: number
} {
  return groups.reduce(
    (acc, g) => ({
      totalPoints: acc.totalPoints + g.points,
      studentsAwarded: acc.studentsAwarded + (g.points > 0 ? g.studentIds.length : 0),
    }),
    { totalPoints: 0, studentsAwarded: 0 },
  )
}
