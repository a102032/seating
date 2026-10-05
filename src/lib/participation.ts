import type { ClassData } from '../types'
import { dateKey } from './attendance'

/**
 * Who has had a turn: a quiet record, for the teacher only, of how many times each student was
 * picked and given a point, day by day. Nothing of it shows on the board - a mark on the desks
 * of children who have had a turn makes every other child "not chosen yet", and tells the ones
 * who have that they're safe to stop listening. The teacher reads it in Class Settings, and the
 * picker reads it to give the students picked less often lately a better chance.
 *
 * Picked: Pick Student (and Pick from This Row), the group picker's Pick Student, the floating
 * window's Pick, and a flip card turned over by hand. Points: a star given to some students,
 * not to everyone at once - Pick All and +, Everyone +1, Get Ready! and group points are the
 * whole class, and say nothing about one child. The app only knows what is tapped: a child the
 * teacher calls on who answers without a star leaves no trace.
 */

/** One student's day: [times picked, times given points]. A pair, not an object, because a year of them is kept in every class. */
export type DayCount = [picked: number, points: number]

/** Date key ("2026-10-05") → student id → their day. */
export type ParticipationRecord = Record<string, Record<string, DayCount>>

function bump(c: ClassData, day: string, ids: string[], which: 0 | 1): ClassData {
  if (ids.length === 0) return c
  const record = c.participation ?? {}
  const counts = { ...record[day] }
  for (const id of ids) {
    const was = counts[id] ?? [0, 0]
    counts[id] = which === 0 ? [was[0] + 1, was[1]] : [was[0], was[1] + 1]
  }
  return { ...c, participation: { ...record, [day]: counts } }
}

/** A student was picked today. */
export function withPick(c: ClassData, studentId: string, day: string): ClassData {
  return bump(c, day, [studentId], 0)
}

/** These students were given points today: once each, however many stars it was. */
export function withPoints(c: ClassData, studentIds: string[], day: string): ClassData {
  return bump(c, day, studentIds, 1)
}

/** Every day with anything on record, oldest first. */
export function participationDates(c: ClassData): string[] {
  return Object.entries(c.participation ?? {})
    .filter(([, counts]) => Object.keys(counts).length > 0)
    .map(([day]) => day)
    .sort()
}

/** A student gone from the roster is gone from the record too. */
export function withoutStudent(record: ParticipationRecord | undefined, studentId: string): ParticipationRecord | undefined {
  if (!record) return record
  return Object.fromEntries(
    Object.entries(record).map(([day, counts]) => {
      const rest = { ...counts }
      delete rest[studentId]
      return [day, rest]
    }),
  )
}

/** How far back the picker looks when it evens things out: about two months of lessons. */
const WINDOW_DAYS = 56
/** The most and least a student's chance can be, against everyone else's. Never zero, so anyone could be next. */
const MOST = 3
const LEAST = 1 / 3

function daysBefore(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dateKey(new Date(y, m - 1, d - n))
}

/**
 * Each student's chance of being picked, against the rest: more for a student picked less often
 * than their share lately, less for one picked more. A better chance, not first in line - if the
 * quiet ones always came first the class would work out the order, and whoever had just been
 * picked would know they were safe.
 *
 * A student's share counts only the days the picker was used and they were here, so a child back
 * from a week away isn't owed a week of picks. How far behind is measured against what chance
 * alone would give (behind by more than the usual wobble), so a few picks either way early in
 * the term don't swing it, and the gap closes over a few weeks rather than in one lesson.
 */
export function pickChances(c: ClassData, today: string): Map<string, number> {
  const since = daysBefore(today, WINDOW_DAYS)
  const days = Object.entries(c.participation ?? {}).filter(
    ([day, counts]) => day > since && day <= today && Object.values(counts).some(([picked]) => picked > 0),
  )
  const chances = new Map<string, number>()
  if (days.length === 0) return chances

  const tally = c.students.map((s) => {
    let picked = 0
    let here = 0
    for (const [day, counts] of days) {
      if (c.attendance?.[day]?.includes(s.id)) continue
      here += 1
      picked += counts[s.id]?.[0] ?? 0
    }
    return { id: s.id, picked, here }
  })
  const totalPicked = tally.reduce((n, t) => n + t.picked, 0)
  const totalHere = tally.reduce((n, t) => n + t.here, 0)
  if (totalPicked === 0 || totalHere === 0) return chances

  const perDay = totalPicked / totalHere
  for (const t of tally) {
    const expected = t.here * perDay
    const behind = (expected - t.picked) / Math.sqrt(Math.max(1, expected))
    chances.set(t.id, Math.min(MOST, Math.max(LEAST, 2 ** behind)))
  }
  return chances
}

/** One of these, each as likely as its weight says. */
export function weightedChoice<T>(items: T[], weightOf: (item: T) => number): T {
  const weights = items.map((item) => Math.max(0, weightOf(item)))
  const total = weights.reduce((n, w) => n + w, 0)
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}
