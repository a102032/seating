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

type AttendanceRecord = Pick<ClassData, 'attendance' | 'attendanceTaken'>

/**
 * The days attendance was taken. A save from before the list existed has none, and back then
 * every day in the record was a taken day, so that is how it reads. Anything that changes the
 * record writes the list out first, so a day marked ahead is never mistaken for a taken one.
 */
export function takenDays(cls: AttendanceRecord | undefined): string[] {
  return cls?.attendanceTaken ?? Object.keys(cls?.attendance ?? {}).sort()
}

export function attendanceTakenOn(cls: AttendanceRecord | undefined, key: string): boolean {
  return takenDays(cls).includes(key)
}

/** Every day with something on record - taken, or someone marked away - oldest first. */
export function attendanceDates(cls: AttendanceRecord): string[] {
  const marked = Object.entries(cls.attendance ?? {})
    .filter(([, away]) => away.length > 0)
    .map(([day]) => day)
  return [...new Set([...takenDays(cls), ...marked])].sort()
}

/** Monday to Friday of a month ("2026-09"), as date keys: the school days a record can show. */
export function schoolDaysIn(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const days: string[] = []
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay()
    if (weekday !== 0 && weekday !== 6) days.push(dateKey(d))
  }
  return days
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * The whole record as a spreadsheet: one row per student, one column per day with something on
 * record, an A where they were away, and their total at the end.
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
