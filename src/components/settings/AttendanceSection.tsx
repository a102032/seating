import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { useDrive } from '../../hooks/useDrive'
import { attendanceDates, attendanceToCsv, dateKey, schoolDaysIn, takenDays } from '../../lib/attendance'
import { updateAttendanceSheet } from '../../lib/drive'
import type { ClassData } from '../../types'
import { AbsentIcon } from '../AbsentIcon'
import { GoogleG } from '../Account'
import { DriveLink, DriveProblem } from './GoogleSection'
import { Btn } from './parts'

interface AttendanceSectionProps {
  activeClass: ClassData
  /** Mark a student away on a day, or bring them back - past, today or ahead. */
  onToggleAbsent: (studentId: string, day: string) => void
  /** The signed-in teacher, whose Drive the record can go to. */
  uid?: string
  /** Records' switch between Attendance and Participation, at the head of the page. */
  records?: ReactNode
}

/** "2026-09" from "2026-09-27". */
const monthOf = (key: string) => key.slice(0, 7)

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  return dateKey(new Date(y, m - 1 + by, 1)).slice(0, 7)
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** A second tap on the same circle this soon is the board reading one touch as two. */
const REPEAT_TAP_MS = 700

/**
 * The teacher's own informal record, one month at a time, inside the window rather than in a
 * second one on top of it: the class down the side, every school day across the top, a zzz where
 * someone is away. A tap marks or clears a day - fixing a past mistake, or marking a trip ahead.
 * Every Monday to Friday gets a column, since a missed day or one ahead needs somewhere to tap;
 * days attendance was taken read at full strength. Editing here never counts as taking it.
 */
export function AttendanceSection({ activeClass, onToggleAbsent, uid, records }: AttendanceSectionProps) {
  const drive = useDrive(uid)
  const today = dateKey()
  const thisMonth = monthOf(today)
  const dates = useMemo(() => attendanceDates(activeClass), [activeClass])
  const taken = useMemo(() => new Set(takenDays(activeClass)), [activeClass])
  const firstMonth = dates.length > 0 && monthOf(dates[0]) < thisMonth ? monthOf(dates[0]) : thisMonth
  // It opens on this month, the one a teacher is most likely looking for.
  const [month, setMonth] = useState(thisMonth)
  const lastTap = useRef<{ key: string; at: number } | null>(null)

  // Weekdays, plus any weekend day that already holds a record, so nothing entered is ever hidden.
  const days = useMemo(() => [...new Set([...schoolDaysIn(month), ...dates.filter((d) => monthOf(d) === month)])].sort(), [month, dates])

  function toggle(studentId: string, day: string, at: number) {
    const key = `${studentId}|${day}`
    if (lastTap.current?.key === key && at - lastTap.current.at < REPEAT_TAP_MS) return
    lastTap.current = { key, at }
    onToggleAbsent(studentId, day)
  }

  function downloadCsv() {
    const blob = new Blob([attendanceToCsv(activeClass)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeClass.name.trim() || 'class'} attendance.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (activeClass.students.length === 0) {
    return (
      <>
        <div className="cs-page-head">
          {records}
          <p>Who was away, day by day.</p>
        </div>
        <div className="cs-list">
          <div className="cs-empty">
            <span className="cs-hint">Add students first.</span>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="cs-page-head">
        {records}
        <div className="cs-right">
          {/* One Sheet per class in the teacher's Drive folder, brought up to date in place. The file
              stays, for anyone not signed in. */}
          {uid && (
            <Btn
              small
              data-guide="att-drive"
              disabled={dates.length === 0 || drive.busy !== null}
              onClick={() => void drive.run('attendance', (token) => updateAttendanceSheet(token, activeClass))}
            >
              <GoogleG size={18} /> {drive.busy ? 'Updating…' : 'Update in Drive'}
            </Btn>
          )}
          <Btn small data-guide="att-export" disabled={dates.length === 0} onClick={downloadCsv}>
            <Download /> Export to CSV
          </Btn>
          {drive.problem ? <DriveProblem text={drive.problem.text} /> : drive.done ? <DriveLink file={drive.done.file} /> : null}
        </div>
      </div>
      {/* The month big and plain, its arrows a finger wide (2026-10-26, the teacher: it was easy to miss). */}
      <div className="cs-navbar" data-guide="month-nav">
        <button type="button" aria-label="Last month" disabled={month <= firstMonth} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft />
        </button>
        <b>{monthLabel(month)}</b>
        {/* Forward has no end: a teacher marking a trip next month needs to get there. */}
        <button type="button" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRight />
        </button>
      </div>
      <div className="cs-att" data-guide="att-grid">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              {days.map((d) => (
                <th
                  key={d}
                  className={clsx(
                    d === today && 'cs-today',
                    weekdayOf(d) === 1 && 'cs-monday',
                    (taken.has(d) || d === today) && 'cs-taken',
                  )}
                  title={taken.has(d) ? 'Attendance was taken' : undefined}
                >
                  {WEEKDAY_LETTERS[weekdayOf(d)]}
                  <b>{Number(d.slice(8))}</b>
                </th>
              ))}
              <th>Away</th>
            </tr>
          </thead>
          <tbody>
            {activeClass.students.map((s) => {
              const away = days.filter((d) => activeClass.attendance?.[d]?.includes(s.id))
              return (
                <tr key={s.id}>
                  <td>
                    <span className="mr-1.5 text-xs font-normal text-muted-foreground">{s.homeroom}</span>
                    {s.name}
                  </td>
                  {days.map((d) => {
                    const isAway = away.includes(d)
                    return (
                      <td key={d} className={clsx(d === today && 'cs-today', weekdayOf(d) === 1 && 'cs-monday')}>
                        <button
                          type="button"
                          className={clsx('cs-dot', isAway ? 'cs-away' : !taken.has(d) && 'cs-untaken')}
                          aria-pressed={isAway}
                          aria-label={`${s.name}, ${d}: ${isAway ? 'away' : 'here'}`}
                          onClick={(e) => toggle(s.id, d, e.timeStamp)}
                        >
                          {isAway && <AbsentIcon className="h-[18px] w-[18px]" />}
                        </button>
                      </td>
                    )
                  })}
                  <td className="font-bold">{away.length || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
