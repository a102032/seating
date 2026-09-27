export type Gender = 'boy' | 'girl' | 'unspecified'

export interface Student {
  id: string
  name: string
  homeroom: string
  gender: Gender
  /** Chosen sticker as "theme/pose" (see lib/stickers.ts) - falls back to a character derived from the student id. */
  avatarId?: string
  /** Accumulated class points, floored at 0. Unset is treated as 0 - older saved students predate this field. */
  points?: number
}

/**
 * The chart is six desks across and five deep - thirty desks, which is most classes. A class
 * with more than thirty students gets a seventh column on the right, for thirty-five. Classes
 * of thirty or fewer never see it, so their board stays exactly as it was.
 *
 * Desks 0-29 are the six-wide chart, row by row, as they always were; the seventh column is
 * desks 30-34, top to bottom. Numbering the new desks on the end, rather than re-numbering
 * the grid seven wide, is what keeps every seating chart saved before this in its place.
 */
export const DESK_COUNT = 30
export const DESK_COLUMNS = 6
export const DESK_ROWS = 5
export const MAX_DESK_COLUMNS = 7
export const MAX_DESKS = MAX_DESK_COLUMNS * DESK_ROWS

/** Which column (the app's "row" of desks, as Pick Row means it) a desk is in, counting from the left. */
export function deskColumn(deskIndex: number): number {
  return deskIndex < DESK_COUNT ? deskIndex % DESK_COLUMNS : DESK_COLUMNS
}

/** Which row a desk is in, counting from the top. */
export function deskRow(deskIndex: number): number {
  return deskIndex < DESK_COUNT ? Math.floor(deskIndex / DESK_COLUMNS) : deskIndex - DESK_COUNT
}

export function deskAt(row: number, column: number): number {
  return column < DESK_COLUMNS ? row * DESK_COLUMNS + column : DESK_COUNT + row
}

/** Six columns, or seven when the class needs them: more than thirty students, or anyone still sitting in the seventh. */
export function deskColumnsFor(cls: Pick<ClassData, 'students' | 'seating'> | undefined): number {
  if (!cls) return DESK_COLUMNS
  const needed = cls.students.length > DESK_COUNT || cls.seating.slice(DESK_COUNT).some(Boolean)
  return needed ? MAX_DESK_COLUMNS : DESK_COLUMNS
}

/** Every desk on the board, in reading order (row by row, left to right). */
export function desksInOrder(columns: number): number[] {
  return Array.from({ length: columns * DESK_ROWS }, (_, i) => deskAt(Math.floor(i / columns), i % columns))
}

export interface ClassData {
  id: string
  name: string
  students: Student[]
  /**
   * Who was absent, by local date ("2026-09-27"). A date being here at all means attendance
   * was taken that day - an empty list is "everyone was here", which is different from a day
   * nobody took it. Absence only ever lasts the day it was marked: tomorrow is a new key.
   */
  attendance?: Record<string, string[]>
  /** length MAX_DESKS (older saves have DESK_COUNT and are padded on load); each slot holds a student id or null for an empty desk */
  seating: (string | null)[]
  updatedAt: string
  /** Class points earned toward pointsGoal - wraps back down each time the class hits it. Unset is treated as 0. */
  classPoints?: number
  /** How many class points fill the goal. Unset or 0 means the meter isn't configured yet. */
  pointsGoal?: number
  /**
   * Whether the class goal is switched on. Kept separate from pointsGoal so turning the
   * meter off doesn't throw away the number the teacher set. Unset counts as on, so classes
   * saved before this behave as they did.
   */
  goalEnabled?: boolean
  /**
   * Which celebration plays when the goal is reached: a GIPHY id from lib/celebrationGifs,
   * or unset for the treasure chest. The chest is also the fallback whenever a chosen gif
   * hasn't loaded, so a bad network never leaves the moment blank.
   */
  celebrationGifId?: string
  /**
   * Stars a class has to earn for one class point. Unset or 1 means every star counts, which
   * is how the meter behaved before this existed - so old saved classes need no migration.
   */
  starsPerClassPoint?: number
  /** Stars banked toward the next class point, so a divisor never loses the leftovers. */
  goalRemainder?: number
  /**
   * How many times the class has filled its goal. The meter celebrates when this climbs -
   * never on classPoints falling, since a reset or a correction is a fall too, and used to
   * throw the party.
   */
  goalsReached?: number
  /**
   * The last groups the teacher made, membership and any points not yet handed out. Kept so
   * "Group Activity" can pick up where it left off - a teacher running the same teams all
   * week shouldn't have to re-deal every lesson. Cleared only by making new groups.
   */
  groups?: StudentGroup[]
  /** Where a group's points go when the activity ends. Unset means each student. */
  groupPointsMode?: GroupPointsMode
}

/**
 * What a group's points become when the activity finishes: a star for every member, or
 * one class point per group point straight onto the class goal meter.
 */
export type GroupPointsMode = 'students' | 'goal'

/**
 * Where a group is with its work - the digital cousin of the red, yellow and green cups on a
 * group's table. Unset means working.
 */
export type GroupStatus = 'working' | 'help' | 'ready' | 'done'

export interface StudentGroup {
  id: string
  name: string
  status?: GroupStatus
  /** A fixed hex colour, the same on every theme - it *is* the group's identity on screen. */
  color: string
  studentIds: string[]
  /** Points earned this session, floored at 0. Zeroed when the activity finishes. */
  points: number
}

export type AlarmSound = 'ding' | 'chime' | 'bell' | 'trainWhistle' | 'guitar' | 'rooster'

export interface TimerSettings {
  warningEnabled: boolean
  alarmSound: AlarmSound
}
