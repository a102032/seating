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
   * Stars a class has to earn for one class point. Unset or 1 means every star counts, which
   * is how the meter behaved before this existed - so old saved classes need no migration.
   */
  starsPerClassPoint?: number
  /** Stars banked toward the next class point, so a divisor never loses the leftovers. */
  goalRemainder?: number
}

export type AlarmSound = 'ding' | 'chime' | 'bell' | 'trainWhistle' | 'guitar' | 'rooster'

export interface TimerSettings {
  warningEnabled: boolean
  alarmSound: AlarmSound
}
