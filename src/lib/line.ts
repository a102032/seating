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
}

/** The class's line today: empty on a new day, and without anyone no longer in the class. */
export function lineOf(cls: ClassData | undefined, day: string): ClassLine {
  const line = cls?.line
  if (!cls || !line || line.day !== day) return { day, now: null, waiting: [] }
  const here = new Set(cls.students.map((s) => s.id))
  const waiting = line.waiting.filter((id) => here.has(id) && id !== line.now)
  const now = line.now && here.has(line.now) ? line.now : null
  // Whoever was with the teacher has left the class: the next one is called, as Done would.
  return now === null && waiting.length > 0 ? { day, now: waiting[0], waiting: waiting.slice(1) } : { day, now, waiting }
}

/**
 * A child taps their desk. Into an empty line they go straight to the teacher; otherwise to the
 * back. Already in line, nothing changes.
 */
export function joinLine(line: ClassLine, id: string): ClassLine {
  if (line.now === id || line.waiting.includes(id)) return line
  if (line.now === null) return { ...line, now: id }
  return { ...line, waiting: [...line.waiting, id] }
}

/** Done: the student with the teacher goes back to their seat, and the next one is called. */
export function doneInLine(line: ClassLine): ClassLine {
  return { ...line, now: line.waiting[0] ?? null, waiting: line.waiting.slice(1) }
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

/** Out of line, back to their seat: a child who tapped by mistake, or one the teacher takes out. */
export function leaveLine(line: ClassLine, id: string): ClassLine {
  if (line.now === id) return doneInLine(line)
  return { ...line, waiting: line.waiting.filter((w) => w !== id) }
}

/** Everyone out of line. */
export function clearLine(line: ClassLine): ClassLine {
  return { ...line, now: null, waiting: [] }
}

/** How many are in line, the one with the teacher included. */
export function lineCount(line: ClassLine): number {
  return line.waiting.length + (line.now ? 1 : 0)
}
