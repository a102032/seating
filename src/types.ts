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

export const DESK_COUNT = 30
export const DESK_COLUMNS = 6
export const DESK_ROWS = 5

export interface ClassData {
  id: string
  name: string
  students: Student[]
  /** length DESK_COUNT, each slot holds a student id or null for an empty desk */
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

export interface StudentGroup {
  id: string
  name: string
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
