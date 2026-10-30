import type { ClassData, PointsMode, StudentGroup } from '../types'
import { GROUP_COLORS, GENDER_COLORS } from './groups'
import { MAX_SEATS } from './layouts'
import { hasNoAvatar } from './stickers'

/**
 * Classes saved the old way, brought up to what this version expects: the one place that knows
 * what older versions saved (the deep clean, 2026-10-26). Every class is passed through it as it
 * comes in - from this board's own copy when the app opens, from the teacher's account (another
 * computer, perhaps on an older version), and when the board's own classes are taken into an
 * account - so nothing else in the app has to remember an old shape. A class already in today's
 * shape comes back as it went in, the same object, so it isn't counted as a change and sent.
 *
 * Each step is one change the app went through, oldest first. When a field changes shape again,
 * the step goes here, with a test in lib/test/upgrade.test.ts, rather than a fallback where the
 * field is read.
 */
export function upgradeClass(c: ClassData): ClassData {
  let next = c
  for (const step of STEPS) next = step(next)
  return next
}

/**
 * Saves from before the seventh column hold thirty desks, and from before layouts thirty-five;
 * the rest start empty, so every layout has all its desks.
 */
function withAllDesks(c: ClassData): ClassData {
  if (c.seating?.length >= MAX_SEATS) return c
  const seating = c.seating ?? []
  return { ...c, seating: [...seating, ...Array.from({ length: MAX_SEATS - seating.length }, () => null)] }
}

/**
 * Attendance before `attendanceTaken` (2026-10-04): every day in the record was a day attendance
 * was taken, so that is what the list says. Since then a day can hold an absence marked ahead,
 * which isn't a taken day, so the list is kept separately.
 */
function withTakenDays(c: ClassData): ClassData {
  if (c.attendanceTaken !== undefined || !c.attendance) return c
  return { ...c, attendanceTaken: Object.keys(c.attendance).sort() }
}

/**
 * Before the Avatars switch (2026-10-05), a teacher who wanted names only gave the whole class No
 * Avatar. A class whose students all have it (two or more, so it was the whole class rather than
 * one family's choice) becomes a class with its avatars switched off, and its students are free
 * to have a character again when they are switched back on.
 */
function withAvatarsSwitch(c: ClassData): ClassData {
  if (c.avatarsOff !== undefined || c.students.length < 2 || !c.students.every(hasNoAvatar)) return c
  return { ...c, avatarsOff: true, students: c.students.map((s) => ({ ...s, avatarId: undefined })) }
}

/**
 * "Stars for 1 class point" went (2026-10-11, the teacher: a bigger goal makes it just as much of a
 * challenge). A class that had it above 1 gets its goal and its meter multiplied by it, the banked
 * stars added on, so it fills at exactly the pace it did and the next point lands where it would have.
 */
function withoutStarRate(c: ClassData): ClassData {
  if (c.starsPerClassPoint === undefined && c.goalRemainder === undefined) return c
  const { starsPerClassPoint, goalRemainder, ...rest } = c
  const rate = Math.max(1, Math.round(starsPerClassPoint ?? 1))
  if (rate === 1) return rest
  return {
    ...rest,
    pointsGoal: c.pointsGoal ? c.pointsGoal * rate : c.pointsGoal,
    classPoints: (c.classPoints ?? 0) * rate + (goalRemainder ?? 0),
  }
}

/**
 * How a class runs points was a Class Goal switch before the choice (2026-10-11): on is a class
 * goal; off gave stars that went nowhere the class could see, which is no points in all but name.
 * `goalEnabled` is still written beside the choice, for a computer on an older version.
 */
function withPointsMode(c: ClassData): ClassData {
  if (c.pointsMode) return c
  const mode: PointsMode = (c.pointsGoal ?? 0) > 0 && c.goalEnabled !== false ? 'goal' : 'none'
  return { ...c, pointsMode: mode }
}

/**
 * Group colours that were also the statuses' (red, amber, green, grey) went (2026-10-03), so "look
 * for the red card" means Help. Groups kept in one are coloured afresh by position, all of them
 * together so two groups can't end up sharing one - "Continue with Last Groups" would otherwise
 * bring back yesterday's red Group 1.
 */
const RETIRED_COLORS = new Set(['#ef4444', '#22c55e', '#f97316', '#84cc16', '#f59e0b', '#059669', '#64748b', '#b45309', '#f43f5e'])

function withGroupColors(c: ClassData): ClassData {
  if (!c.groups?.some((g) => RETIRED_COLORS.has(g.color))) return c
  const groups: StudentGroup[] = c.groups.map((g, i) => ({
    ...g,
    color: g.name === 'Boys' ? GENDER_COLORS.boy.bg : g.name === 'Girls' ? GENDER_COLORS.girl.bg : GROUP_COLORS[i % GROUP_COLORS.length].bg,
  }))
  return { ...c, groups }
}

/** Past any number of steps (there are six at most), for the Done marks saved before there were steps. */
const ALL_DONE = 99

/**
 * The Line kept a list of who was Done before it had steps (2026-10-15): all their steps checked.
 */
function withLineChecks(c: ClassData): ClassData {
  const line = c.line
  if (!line || (line.checks && line.done === undefined)) return c
  const { done, ...rest } = line
  return { ...c, line: { ...rest, checks: rest.checks ?? Object.fromEntries((done ?? []).map((id) => [id, ALL_DONE])) } }
}

/**
 * 7 Rows was a layout of its own for a few hours (2026-10-30) before Rows learned how many rows it
 * has: it is Rows with seven, numbered the same, so nobody moves.
 */
function withRowCount(c: ClassData): ClassData {
  if ((c.layout as string) !== 'rows7') return c
  return { ...c, layout: 'rows', rowCount: 7 }
}

const STEPS: ((c: ClassData) => ClassData)[] = [
  withAllDesks,
  withTakenDays,
  withAvatarsSwitch,
  withoutStarRate,
  withPointsMode,
  withGroupColors,
  withLineChecks,
  withRowCount,
]
