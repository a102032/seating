import type { ClassData, SavedLine } from '../types'

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
   * How many steps of the task each student has had checked today (2026-10-15, the teacher: a writing
   * lesson has five). All of them is Done. Kept until the line is cleared or the day ends.
   */
  checks: Record<string, number>
}

/** The class's line today: empty on a new day, and without anyone no longer in the class. */
export function lineOf(cls: ClassData | undefined, day: string): ClassLine {
  const line = cls?.line
  if (!cls) return { day, now: null, waiting: [], checks: {} }
  const here = new Set(cls.students.map((s) => s.id))
  if (!line || line.day !== day) {
    // A new day empties the line, but a saved line keeps where everyone is in its steps.
    const kept = savedLineOf(cls)?.checks ?? {}
    return { day, now: null, waiting: [], checks: Object.fromEntries(Object.entries(kept).filter(([id, n]) => here.has(id) && n > 0)) }
  }
  const waiting = line.waiting.filter((id) => here.has(id) && id !== line.now)
  const now = line.now && here.has(line.now) ? line.now : null
  // The first version kept a list of who was Done, before steps: all their steps checked.
  const kept = line.checks ?? Object.fromEntries((line.done ?? []).map((id) => [id, ALL_DONE]))
  const checks = Object.fromEntries(Object.entries(kept).filter(([id, n]) => here.has(id) && n > 0))
  // Whoever was with the teacher has left the class: the next one is called.
  return now === null && waiting.length > 0 ? { day, now: waiting[0], waiting: waiting.slice(1), checks } : { day, now, waiting, checks }
}

/** Past any number of steps, for the Done marks saved before there were steps. */
const ALL_DONE = 99

/** The saved line in use, if the Line is running one. */
export function savedLineOf(cls: ClassData | undefined): SavedLine | undefined {
  return cls?.lineSavedAs ? cls.savedLines?.find((s) => s.id === cls.lineSavedAs) : undefined
}

/** How many steps of the task a class's Line checks: the saved line's, or "How many steps?"'s. Unset is one. */
export function stepsOf(cls: ClassData | undefined): number {
  const saved = savedLineOf(cls)
  return Math.min(MAX_STEPS, Math.max(1, saved ? saved.steps.length : (cls?.lineSteps ?? 1)))
}

/** Each step's name in a saved line ('' where it has none); a quick line's steps have none. */
export function stepNamesOf(cls: ClassData | undefined): string[] {
  const saved = savedLineOf(cls)
  return Array.from({ length: stepsOf(cls) }, (_, i) => saved?.steps[i]?.trim() ?? '')
}

export const MAX_STEPS = 6
/** Saved lines a class keeps: few enough that "Start the Line" stays one short window. */
export const MAX_SAVED_LINES = 4
/** A line's name, on the column's top button and in "Start the Line". */
export const LINE_NAME_MAX = 20
/** A step's name has to fit on a desk under its dots, in the narrowest desk the Line leaves. */
export const STEP_NAME_MAX = 12

/** The steps this student has had checked, never more than the task has. */
export function checkedOf(line: ClassLine, id: string, steps: number): number {
  return Math.min(steps, line.checks[id] ?? 0)
}

/** The next one in line goes to the teacher. */
function callNext(line: ClassLine): ClassLine {
  return { ...line, now: line.waiting[0] ?? null, waiting: line.waiting.slice(1) }
}

/**
 * A child taps their desk. Into an empty line they go straight to the teacher; otherwise to the
 * back. Already in line, nothing changes. Their steps so far stay with them.
 */
export function joinLine(line: ClassLine, id: string): ClassLine {
  if (line.now === id || line.waiting.includes(id)) return line
  if (line.now === null) return { ...line, now: id }
  return { ...line, waiting: [...line.waiting, id] }
}

/**
 * Done: the step the student brought is checked (on the last step, the whole task: All Done). They
 * go back to their seat and the next one is called.
 */
export function doneInLine(line: ClassLine, steps: number): ClassLine {
  if (line.now === null) return line
  const checks = { ...line.checks, [line.now]: Math.min(steps, checkedOf(line, line.now, steps) + 1) }
  return callNext({ ...line, checks })
}

/**
 * Change Steps (2026-10-15, the teacher): a tap moves a student one step on, through Done and back
 * to none, for two steps brought at once, a Done pressed by mistake, a student who finished early
 * or one checked at their seat.
 */
export function cycleSteps(line: ClassLine, id: string, steps: number): ClassLine {
  const checked = checkedOf(line, id, steps)
  const checks = { ...line.checks }
  if (checked >= steps) delete checks[id]
  else checks[id] = checked + 1
  return { ...line, checks }
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

/** Out of line, back to their seat: a child who tapped by mistake, or one the teacher takes out. No step checked. */
export function leaveLine(line: ClassLine, id: string): ClassLine {
  if (line.now === id) return callNext(line)
  return { ...line, waiting: line.waiting.filter((w) => w !== id) }
}

/** Everyone out of line, and every step and Done mark off the desks: a fresh start for the next activity. */
export function clearLine(line: ClassLine): ClassLine {
  return { ...line, now: null, waiting: [], checks: {} }
}

/** Nothing in line and nothing checked today: opening the Line starts a new activity, so it asks how many steps. */
export function lineIsFresh(line: ClassLine): boolean {
  return line.now === null && line.waiting.length === 0 && Object.keys(line.checks).length === 0
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

/**
 * What a desk shows while the Line is open: its place (and the green ring with the teacher), its
 * steps checked as dots, or Done.
 */
export type LineSteps = { checked: number; of: number; step: string }
export type LineMark = { place: number; now: boolean; steps?: LineSteps } | LineSteps | 'done'

/**
 * Every desk's mark. A place in line comes first, since a waiting child looks for their number; then
 * Done, or the dots of a task with steps. A line whose steps have names shows every seated student's
 * dots from the start, the step they are on lit and named, so a child sees what they are working
 * on; a quick line shows them once a step is checked. While Change Steps is on, every seated student
 * shows their steps and no places: that is what is being changed.
 */
export function lineMarksOf(
  line: ClassLine,
  steps: number,
  seated: string[],
  changing: boolean,
  names: string[] = [],
): Map<string, LineMark> {
  const marks = new Map<string, LineMark>()
  const everyone = changing || names.some(Boolean)
  const progress = (id: string): LineMark | null => {
    const checked = checkedOf(line, id, steps)
    if (checked >= steps) return 'done'
    // The step they are working on now, by name, under the dots.
    return steps > 1 && (checked > 0 || everyone) ? { checked, of: steps, step: names[checked] ?? '' } : null
  }
  for (const id of everyone ? seated : Object.keys(line.checks)) {
    const mark = progress(id)
    if (mark) marks.set(id, mark)
  }
  // In line, their steps stay on the desk beside their number (2026-10-16, the teacher), so a child
  // waiting still sees which step they brought.
  if (!changing)
    placesInLine(line).forEach((place, id) => {
      const before = marks.get(id)
      const steps = typeof before === 'object' && 'checked' in before ? before : undefined
      marks.set(id, { place, now: id === line.now, ...(steps ? { steps } : {}) })
    })
  return marks
}
