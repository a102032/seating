import type { ClassData } from '../types'

/**
 * Today's key in the attendance record: the local date, not UTC. A lesson at 7:50 in Taipei
 * is still yesterday in UTC, and would have been filed under the wrong day.
 */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function absentOn(cls: Pick<ClassData, 'attendance'> | undefined, key: string): Set<string> {
  return new Set(cls?.attendance?.[key] ?? [])
}

export function attendanceTakenOn(cls: Pick<ClassData, 'attendance'> | undefined, key: string): boolean {
  return cls?.attendance?.[key] !== undefined
}

/** Every date attendance was taken, oldest first. */
export function attendanceDates(cls: Pick<ClassData, 'attendance'>): string[] {
  return Object.keys(cls.attendance ?? {}).sort()
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * The whole record as a spreadsheet: one row per student, one column per day attendance was
 * taken, an A where they were away, and their total at the end.
 */
export function attendanceToCsv(cls: ClassData): string {
  const dates = attendanceDates(cls)
  const header = ['Homeroom', 'Name', ...dates, 'Days absent']
  const rows = cls.students.map((s) => {
    const marks = dates.map((d) => (cls.attendance?.[d]?.includes(s.id) ? 'A' : ''))
    return [s.homeroom, s.name, ...marks, String(marks.filter(Boolean).length)]
  })
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}
