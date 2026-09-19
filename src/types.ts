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
  /** Rolling total toward pointsGoal - wraps back down (never above the goal) each time the class hits it. Unset is treated as 0. */
  classPoints?: number
  /** Teacher-set target for the class points meter. Unset or 0 means the meter isn't configured yet. */
  pointsGoal?: number
}

export type AlarmSound = 'ding' | 'chime' | 'bell' | 'trainWhistle' | 'guitar' | 'rooster'

export interface TimerSettings {
  warningEnabled: boolean
  alarmSound: AlarmSound
}
