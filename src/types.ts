import type { RoomLayout } from './lib/layouts'
import type { ParticipationRecord } from './lib/participation'
import type { GroupScheme } from './lib/groups'
import type { Theme } from './lib/theme'
import type { MarbleJarState } from './lib/marbles'
import type { QuestPrize } from './lib/quest'

export type Gender = 'boy' | 'girl' | 'unspecified'

/**
 * How a class runs points: a class goal, a class goal that wins keys on a quest (2026-10-24, the
 * teacher: the goal as it was and the Quest, each a choice), each student's own stars, or none
 * (ClassData.pointsMode).
 */
export type PointsMode = 'goal' | 'quest' | 'students' | 'none'

export interface Student {
  id: string
  name: string
  homeroom: string
  gender: Gender
  /** Chosen sticker as "theme/pose" (see lib/stickers.ts) - falls back to a character derived from the student id. */
  avatarId?: string
  /**
   * The student's photo: the id of its file in the teacher's own Google Drive (lib/drive), never
   * the picture itself. It shows only while the class shows photos (ClassData.photosOn); the
   * student's character is kept beside it, for when the class shows characters again.
   */
  photo?: string
  /**
   * Stars on the student's desk, floored at 0. In a class with student points (pointsMode
   * 'students') they are the student's own, kept until the teacher clears them. In a class goal
   * whose stars go on the desks first (starsOnDesks), they are this lesson's, waiting: All Stars
   * In! sends them to the goal and sets this back to 0. Otherwise it isn't used. Older saves may
   * hold a running total from when every class counted stars all term; it is cleared whenever a
   * class starts putting stars on the desks, so it is never shown or sent anywhere.
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
   * before this had no list: every day in `attendance` was a taken day then, and lib/upgrade
   * writes the list out that way as they come in.
   */
  attendanceTaken?: string[]
  /**
   * Who sits at each desk: a student id, or null for an empty desk. The desks are numbered by the
   * class's layout (lib/layouts.ts); in Rows, the numbering the app always had. Padded to
   * MAX_SEATS as it comes in (lib/upgrade), so any layout fits - older saves have 30 or 35.
   */
  seating: (string | null)[]
  /** How the desks stand in the room. Unset is Rows, the six-by-five grid. */
  layout?: RoomLayout
  /** In Rows, how many rows across (2 to 7, lib/layouts). Unset is six. */
  rowCount?: number
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
   * meter off doesn't throw away the number the teacher set. Since pointsMode it is only read by
   * lib/upgrade, for a class saved before the choice, and written beside the choice (on only for
   * a class goal), so a computer still on an older version shows the same thing.
   */
  goalEnabled?: boolean
  /**
   * How the class runs points (2026-10-11, the teacher): 'goal', the class goal the whole class
   * fills together (the default); 'students', each student's own stars on their desk, kept until
   * the teacher clears them; or 'none', no points at all. A class saved before the choice is given
   * one from the old switch as it comes in (lib/upgrade): with its goal on 'goal', with it off
   * (its stars went nowhere the class could see) 'none'.
   */
  pointsMode?: PointsMode
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
   * Photos on the desks (2026-10-12): students with a photo show it, and the rest their character.
   * One of three, with avatarsOff (lib/stickers' deskPicturesOf): characters, photos or names.
   * Unset is characters.
   */
  photosOn?: boolean
  /**
   * The printed seating chart with the students' photos, whatever the board shows: a substitute
   * is who photos help most. Unset follows the board.
   */
  chartPhotos?: boolean
  /**
   * Get Ready!'s prize: the class points a full star is worth, the same on every drum. Unset is 5.
   */
  getReadyPrize?: number
  /** The drum Get Ready! used last time, in seconds, outlined in "How long?" so the same job is the same tap. */
  getReadyDrum?: number
  /**
   * Get Ready! with no sound at all, set by the speaker on "How long?" and kept until it is tapped
   * back on (a test next door, quiet reading). The star still throbs on every beat. Unset is sound on.
   */
  getReadySilent?: boolean
  /**
   * This class's own colour theme (2026-10-11, the teacher: "Pick a color theme for this class").
   * Unset follows the board's theme, the one every class shared before (lib/theme's loadTheme).
   */
  theme?: Theme
  /** The number of the classroom the class meets in, for the printed seating chart. */
  room?: string
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
   * The prizes for the Marble Jar's prize wheel, each medium or big (small ones were the retired
   * quests' early chests). Unset is lib/quest's starting list. Saves from before 2026-10-30 may also
   * hold the retired Knight, Pirate and Space quests' places (quest, pirateQuest, spaceQuest,
   * questAdventure): nothing reads them, and they are left as they are.
   */
  questPrizes?: QuestPrize[]
  /** The Marble Jar: the marbles where they settled, spins waiting, and the jars filled. Read through jarOf. */
  marbleJar?: MarbleJarState
  /**
   * Stars a class had to earn for one class point, and the stars banked toward the next. No longer
   * used (2026-10-11, the teacher: a bigger goal is the same challenge, with one setting fewer):
   * a class saved with a rate above 1 has its goal and meter multiplied by it as it comes in
   * (lib/upgrade), so it fills at exactly the pace it did. Only lib/upgrade reads these.
   */
  starsPerClassPoint?: number
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
  /**
   * Groups the teacher kept to use again (2026-10-12, the teacher: writing groups, math groups,
   * groups for the map manipulatives), named by the teacher. Started from the Group Activity
   * window; six at most, so the window stays short.
   */
  savedGroups?: SavedGroups[]
  /** The saved groups the groups on the board came from, so Save keeps changes in them. */
  groupsSavedAs?: string
  /**
   * The Line (lib/line): who is with the teacher, and who is waiting to be checked, in order.
   * Kept with the class so a refresh keeps everyone's place; read through lineOf, which gives a
   * new day an empty line. `done` is a line saved before steps; lib/upgrade turns it into checks.
   */
  line?: { day: string; now: string | null; waiting: string[]; checks?: Record<string, number>; done?: string[] }
  /** How many steps a task has in the Line, from "How many steps?" (each one checked; all of them is Done). Unset is one. */
  lineSteps?: number
  /**
   * Lines the teacher named and kept to use again (2026-10-16, the teacher: a writing project over
   * several lessons): four at most, each with its steps' names and where every student is in them.
   */
  savedLines?: SavedLine[]
  /** The saved line in use, whose steps the Line checks; unset is a quick line of lineSteps unnamed steps. */
  lineSavedAs?: string
  /**
   * The Line with no sound (the speaker on its column, as Get Ready!'s is on "How long?"): a quiet
   * writing lesson. Kept until it is tapped back on. Unset is sound on.
   */
  lineSilent?: boolean
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
  /**
   * Where the card sits when the cards are laid out like the room (lib/seatGroups' placeGroups):
   * its column and row of cards, and how many desks across the group sits, so its names go that
   * many to a line. Only groups made from the seats have one; Shuffle keeps each card's.
   */
  place?: GroupPlace
}

/**
 * A line kept to use again: its name ("Writing"), its steps' names in order (one entry a step, ''
 * for a step left unnamed), and how many steps each student has had checked, kept from lesson to
 * lesson so a project over several days carries on where it was.
 */
export interface SavedLine {
  id: string
  name: string
  steps: string[]
  checks?: Record<string, number>
}

/** A set of groups kept to use again: who is in each group, and where its card sits. Points and status are never kept. */
export interface SavedGroups {
  id: string
  name: string
  groups: Pick<StudentGroup, 'name' | 'color' | 'studentIds' | 'place'>[]
  madeBy?: GroupScheme
  savedAt: string
}

export interface GroupPlace {
  column: number
  row: number
  across: number
}

export type AlarmSound = 'ding' | 'chime' | 'bell' | 'trainWhistle' | 'guitar' | 'rooster'
