import { DESK_COLUMNS, type Gender, type Student, type StudentGroup } from '../types'

/**
 * How the class gets split. The teacher picks one with a single tap - nothing here is typed.
 *
 * - `count`: this many groups, as even as they can be.
 * - `size`: groups of this many; leftovers are spread across the groups rather than left as
 *   a group of one or two, which is the thing that makes a kid feel left over.
 * - `gender`: boys and girls. Students with no gender set go wherever there's more room.
 * - `rows`: one group per row of desks, in board order.
 */
export type GroupScheme = { kind: 'count'; count: number } | { kind: 'size'; size: number } | { kind: 'gender' } | { kind: 'rows' }

/**
 * Fixed colours, the same on every theme, ordered so neighbouring groups sit far apart on
 * the wheel: Group 1 and Group 2 should never be told apart by a squint. Fifteen is the most
 * groups the board can produce (pairs of a full class of thirty).
 */
export const GROUP_COLORS: { bg: string; fg: string }[] = [
  { bg: '#ef4444', fg: '#ffffff' }, // red
  { bg: '#3b82f6', fg: '#ffffff' }, // blue
  { bg: '#22c55e', fg: '#ffffff' }, // green
  { bg: '#f97316', fg: '#ffffff' }, // orange
  { bg: '#8b5cf6', fg: '#ffffff' }, // violet
  { bg: '#14b8a6', fg: '#ffffff' }, // teal
  { bg: '#ec4899', fg: '#ffffff' }, // pink
  { bg: '#84cc16', fg: '#1a2e05' }, // lime
  { bg: '#6366f1', fg: '#ffffff' }, // indigo
  { bg: '#f59e0b', fg: '#451a03' }, // amber
  { bg: '#0ea5e9', fg: '#ffffff' }, // sky
  { bg: '#d946ef', fg: '#ffffff' }, // fuchsia
  { bg: '#059669', fg: '#ffffff' }, // emerald
  { bg: '#64748b', fg: '#ffffff' }, // slate
  { bg: '#b45309', fg: '#ffffff' }, // brown
]

/** The app's gender colours, shared with desks and card backs, so Boys / Girls reads at once. */
const GENDER_COLORS: Record<'boy' | 'girl', { bg: string; fg: string }> = {
  boy: { bg: '#0ea5e9', fg: '#ffffff' },
  girl: { bg: '#f43f5e', fg: '#ffffff' },
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
      const rows = new Set(seated.map((s) => s.deskIndex % DESK_COLUMNS))
      if (rows.size < 2) return null
      return { groups: rows.size, caption: `${rows.size} groups` }
    }
  }
}

function makeGroup(index: number, studentIds: string[], name?: string, color?: { bg: string }): StudentGroup {
  return {
    id: crypto.randomUUID(),
    name: name ?? `Group ${index + 1}`,
    color: (color ?? GROUP_COLORS[index % GROUP_COLORS.length]).bg,
    studentIds,
    points: 0,
  }
}

/**
 * Deal the seated class into groups. Random schemes shuffle first; rows and gender are
 * fixed by the board. `previous` lets a re-shuffle keep any names the teacher typed, so
 * "Red Team" survives a second deal of the same shape.
 */
export function buildGroups(
  scheme: GroupScheme,
  seating: (string | null)[],
  studentsById: Map<string, Student>,
  previous?: StudentGroup[],
): StudentGroup[] {
  const seated = seatedStudents(seating, studentsById)
  const ids = seated.map((s) => s.student.id)
  const keepName = (i: number, fallback: string) => {
    const prev = previous?.[i]
    if (!prev) return fallback
    // Only a name the teacher chose is worth carrying; a default name is regenerated so a
    // new shape never shows "Group 1, Group 2, Group 4".
    return /^Group \d+$/.test(prev.name) || prev.name === 'Boys' || prev.name === 'Girls' ? fallback : prev.name
  }

  switch (scheme.kind) {
    case 'count':
      return deal(shuffled(ids), Math.min(scheme.count, ids.length)).map((members, i) =>
        makeGroup(i, members, keepName(i, `Group ${i + 1}`)),
      )
    case 'size':
      return deal(shuffled(ids), groupsForSize(ids.length, scheme.size)).map((members, i) =>
        makeGroup(i, members, keepName(i, `Group ${i + 1}`)),
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
        makeGroup(0, byGender.boy, keepName(0, 'Boys'), GENDER_COLORS.boy),
        makeGroup(1, byGender.girl, keepName(1, 'Girls'), GENDER_COLORS.girl),
      ]
    }
    case 'rows': {
      const rows = new Map<number, string[]>()
      seated.forEach((s) => {
        const row = s.deskIndex % DESK_COLUMNS
        rows.set(row, [...(rows.get(row) ?? []), s.student.id])
      })
      return Array.from(rows.keys())
        .sort((a, b) => a - b)
        .map((row, i) => makeGroup(i, rows.get(row) ?? [], keepName(i, `Group ${i + 1}`)))
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
