export type Gender = 'boy' | 'girl' | 'unspecified'

export interface Student {
  id: string
  name: string
  homeroom: string
  gender: Gender
}

export const DESK_COUNT = 30
export const DESK_COLUMNS = 5
export const DESK_ROWS = 6

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
