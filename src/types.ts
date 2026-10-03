import type { RoomLayout } from './lib/layouts'

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
 * The Rows layout: six desks across and five deep - thirty desks, which is most classes. A
 * class with more than thirty students gets a seventh column on the right, for thirty-five.
 * Classes of thirty or fewer never see it, so their board stays exactly as it was.
 *
 * Desks 0-29 are the six-wide chart, row by row, as they always were; the seventh column is
 * desks 30-34, top to bottom. Numbering the new desks on the end, rather than re-numbering
 * the grid seven wide, is what keeps every seating chart saved before this in its place.
 * The other layouts (Pairs, tables...) and how every layout numbers its desks are in
 * lib/layouts.ts; MAX_DESKS stays the most students a class seats.
 */
export const DESK_COUNT = 30
export const DESK_COLUMNS = 6
export const DESK_ROWS = 5
export const MAX_DESK_COLUMNS = 7
export const MAX_DESKS = MAX_DESK_COLUMNS * DESK_ROWS

/** Which column (the app's "row" of desks, as Pick Row means it) a Rows desk is in, counting from the left. */
export function deskColumn(deskIndex: number): number {
  return deskIndex < DESK_COUNT ? deskIndex % DESK_COLUMNS : DESK_COLUMNS
}

function deskAt(row: number, column: number): number {
  return column < DESK_COLUMNS ? row * DESK_COLUMNS + column : DESK_COUNT + row
}

/** Every Rows desk on the board, in reading order (row by row, left to right). */
export function desksInOrder(columns: number): number[] {
  return Array.from({ length: columns * DESK_ROWS }, (_, i) => deskAt(Math.floor(i / columns), i % columns))
}

export interface ClassData {
  id: string
  name: string
  students: Student[]
  /**
   * Who is away, by local date ("2026-09-27"). Absence only ever lasts the day it is filed
   * under: tomorrow is a new key. A day can be here without attendance having been taken - the
   * record can be edited, including days ahead, when a teacher knows someone will be away.
   */
  attendance?: Record<string, string[]>
  /**
   * The days attendance was actually taken (the mode switched on at the board), so a day with
   * nobody away still counts, and a day with only an absence marked ahead doesn't. Saves from
   * before this have no list: every day in `attendance` was a taken day then, and
   * lib/attendance's takenDays reads them that way until the next change writes the list.
   */
  attendanceTaken?: string[]
  /**
   * Who sits at each desk: a student id, or null for an empty desk. The desks are numbered by the
   * class's layout (lib/layouts.ts); in Rows, the numbering the app always had. Padded to
   * MAX_SEATS on load, so any layout fits - older saves have 30 or 35.
   */
  seating: (string | null)[]
  /** How the desks stand in the room. Unset is Rows, the six-by-five grid. */
  layout?: RoomLayout
  updatedAt: string
  /**
   * When the class was made, which is the order classes are listed in once they come from a
   * teacher's account. Classes from before sign-in existed get one when they first go up.
   */
  createdAt?: string
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
   * Whether each desk (and flip card) shows its student's stars. Unset is off: the board shows
   * the jar, which the whole class fills, and nothing for children to compare. The stars are
   * still counted, and the roster shows them to the teacher.
   */
  showDeskStars?: boolean
  /**
   * Show every student's homeroom number after their name on the board. Unset is off: the
   * number then shows only where two students share a name (lib/sameNames), which is its job.
   */
  showAllHomerooms?: boolean
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
  // groupPointsMode, where a group's points went (each student or the class goal), is no
  // longer read: group points always go onto the class goal. Older saves may still carry it.
}

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

/** The flip clock's digits, or a dial whose red shrinks as the time runs out. */
export type TimerFace = 'flip' | 'dial'

export interface TimerSettings {
  warningEnabled: boolean
  alarmSound: AlarmSound
  face: TimerFace
}
