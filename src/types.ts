import type { RoomLayout } from './lib/layouts'
import type { ParticipationRecord } from './lib/participation'
import type { GroupScheme } from './lib/groups'

export type Gender = 'boy' | 'girl' | 'unspecified'

export interface Student {
  id: string
  name: string
  homeroom: string
  gender: Gender
  /** Chosen sticker as "theme/pose" (see lib/stickers.ts) - falls back to a character derived from the student id. */
  avatarId?: string
  /**
   * Stars waiting on the student's desk, floored at 0, in a class whose stars go on the desks
   * first (starsOnDesks): All Stars In! sends them to the class goal and sets this back to 0.
   * In a class whose stars go straight to the goal it isn't used. Older saves may hold a
   * running total from when every class counted stars all term; it is cleared when a class
   * starts putting stars on the desks, so it is never sent to the goal twice.
   */
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
   * How the class runs points. Unset or false: straight to the goal - a star flies from the desk
   * into the class goal the moment it is given, desks show nothing, and there is no minus.
   * True: stars on the desks first - they collect on the desks through the lesson, where the
   * class can see them, minus takes one back, and All Stars In! sends them all to the goal. Only
   * while the goal is on: with no goal there is nowhere for desk stars to go.
   */
  starsOnDesks?: boolean
  // showDeskStars, the switch that showed a running total of stars on every desk all term, is
  // no longer read: a desk's stars are now this lesson's, on their way to the goal. Older saves
  // may still carry it.
  /** Who has been picked and given points, day by day (lib/participation). For the teacher, never on the board. */
  participation?: ParticipationRecord
  /**
   * Pick Student's round, with Allow Repeats off: who has been picked since everyone last had a
   * turn. Kept with the class rather than in the page, so a reload mid-lesson or a trip to
   * another class doesn't start it over; a new day starts a new round.
   */
  pickRound?: { day: string; ids: string[] }
  /**
   * Avatars off for the whole class: desks, flip cards and the printed chart show names only.
   * Each student's own pick is kept, for when they are turned back on - a teacher who wants
   * plain names for a while shouldn't lose the characters the children chose. Unset is on.
   */
  avatarsOff?: boolean
  /**
   * Get Ready!'s prize: the class points a full star is worth, the same on every drum. Unset is 5.
   */
  getReadyPrize?: number
  /** The drum Get Ready! used last time, in seconds, outlined in "How long?" so the same job is the same tap. */
  getReadyDrum?: number
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
  /** The day the goal was last filled ("2026-10-05"), so the splash can say the class opened the chest. */
  goalReachedOn?: string
  /**
   * The last groups the teacher made, membership and any points not yet handed out. Kept so
   * "Group Activity" can pick up where it left off - a teacher running the same teams all
   * week shouldn't have to re-deal every lesson. Cleared only by making new groups.
   */
  groups?: StudentGroup[]
  /**
   * How those groups were made (pairs, four groups, rows...), so Continue with Last Groups can
   * say so in the Group Activity window's own words, and Shuffle still works after it.
   */
  groupsMadeBy?: GroupScheme
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
