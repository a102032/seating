import type { ClassData } from '../types'

/**
 * The Line (2026-10-15, the teacher): a doctor's office for checking work. During independent
 * work a child who is ready to be checked taps their own desk, gets a number on it, and waits at
 * their seat rather than in a crowd at the teacher's desk. One student is with the teacher; the
 * rest wait in order. For any assignment, not only writing, so it says nothing about what the
 * work is or why a child is in line: one tap, as a point needs no reason.
 *
 * Kept with the class (ClassData.line), so a refresh keeps everyone's place and a second screen
 * open on the class shows the same line. A line lasts the day it was made: tomorrow starts empty
 * (a date changing, never a timer).
 */
export interface ClassLine {
  /** The day this line is for ("2026-10-15"). */
  day: string
  /** The student with the teacher now, or null when nobody is in line. */
  now: string | null
  /** Who is waiting, in order: the first is next. */
  waiting: string[]
  /**
   * Who the teacher has checked and finished with today (Done): their desk says so, until they get
   * in line again with the next piece of work, or the line is cleared.
   */
  done: string[]
}

/** The class's line today: empty on a new day, and without anyone no longer in the class. */
export function lineOf(cls: ClassData | undefined, day: string): ClassLine {
  const line = cls?.line
  if (!cls || !line || line.day !== day) return { day, now: null, waiting: [], done: [] }
  const here = new Set(cls.students.map((s) => s.id))
  const waiting = line.waiting.filter((id) => here.has(id) && id !== line.now)
  const now = line.now && here.has(line.now) ? line.now : null
  const done = (line.done ?? []).filter((id) => here.has(id))
  // Whoever was with the teacher has left the class: the next one is called.
  return now === null && waiting.length > 0 ? { day, now: waiting[0], waiting: waiting.slice(1), done } : { day, now, waiting, done }
}

/** The next one in line goes to the teacher. */
function callNext(line: ClassLine): ClassLine {
  return { ...line, now: line.waiting[0] ?? null, waiting: line.waiting.slice(1) }
}

/**
 * A child taps their desk. Into an empty line they go straight to the teacher; otherwise to the
 * back. Already in line, nothing changes. A child whose work was done gets in line with the next
 * piece of it (the next step of their writing), and the Done mark gives way to their number.
 */
export function joinLine(line: ClassLine, id: string): ClassLine {
  if (line.now === id || line.waiting.includes(id)) return line
  const done = line.done.filter((d) => d !== id)
  if (line.now === null) return { ...line, now: id, done }
  return { ...line, waiting: [...line.waiting, id], done }
}

/**
 * Done (2026-10-15, the teacher): the work is checked and finished. The student goes back to their
 * seat with Done on their desk, and the next one is called.
 */
export function doneInLine(line: ClassLine): ClassLine {
  if (line.now === null) return line
  return callNext({ ...line, done: line.done.includes(line.now) ? line.done : [...line.done, line.now] })
}

/**
 * Skip: the student with the teacher goes to the back of the line, and the next one is called.
 * The back rather than one place down: whether they weren't ready or have something to fix, it
 * gives them time, and it is the rule children already know. With nobody else waiting there is
 * no one to call, so nothing changes.
 */
export function skipInLine(line: ClassLine): ClassLine {
  if (line.now === null || line.waiting.length === 0) return line
  return { ...line, now: line.waiting[0], waiting: [...line.waiting.slice(1), line.now] }
}

/** Out of line, back to their seat: a child who tapped by mistake, or one the teacher takes out. Not done. */
export function leaveLine(line: ClassLine, id: string): ClassLine {
  if (line.now === id) return callNext(line)
  return { ...line, waiting: line.waiting.filter((w) => w !== id) }
}

/** Everyone out of line, and the Done marks off the desks: a fresh start for the next activity. */
export function clearLine(line: ClassLine): ClassLine {
  return { ...line, now: null, waiting: [], done: [] }
}

/**
 * Each student's place in line, as their desk shows it: the one with the teacher is 1, and keeps
 * it until Done, Skip or back to their seat (2026-10-15, the teacher); the next is 2.
 */
export function placesInLine(line: ClassLine): Map<string, number> {
  const places = new Map<string, number>()
  const first = line.now ? 2 : 1
  if (line.now) places.set(line.now, 1)
  line.waiting.forEach((id, i) => places.set(id, first + i))
  return places
}

/** How many are in line, the one with the teacher included. */
export function lineCount(line: ClassLine): number {
  return line.waiting.length + (line.now ? 1 : 0)
}

/** What a desk shows while the Line is open: its place (and the green ring with the teacher), or Done. */
export type LineMark = { place: number; now: boolean } | 'done'

/** Every desk's mark: a place for everyone in line, Done for everyone finished. */
export function lineMarksOf(line: ClassLine): Map<string, LineMark> {
  const marks = new Map<string, LineMark>()
  line.done.forEach((id) => marks.set(id, 'done'))
  placesInLine(line).forEach((place, id) => marks.set(id, { place, now: id === line.now }))
  return marks
}
