export type Gender = 'boy' | 'girl' | 'unspecified'

export interface Student {
  id: string
  name: string
  homeroom: string
  gender: Gender
  /** id of a chosen LibraryAvatar (see lib/avatarLibrary.ts) - falls back to the plain gender default when unset. */
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
}

export type AlarmSound = 'ding' | 'chime' | 'bell' | 'trainWhistle' | 'guitar' | 'rooster'

export interface TimerSettings {
  warningEnabled: boolean
  alarmSound: AlarmSound
}
