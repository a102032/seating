import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { attendanceDates, attendanceToCsv, dateKey, schoolDaysIn, takenDays } from '../lib/attendance'
import type { ClassData } from '../types'
import { AbsentIcon } from './AbsentIcon'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'
import { useDrive } from '../hooks/useDrive'
import { updateAttendanceSheet } from '../lib/drive'
import { GoogleG } from './Account'
import { DriveLink, DriveProblem } from './GoogleTab'

interface AttendanceHistoryModalProps {
  open: boolean
  onClose: () => void
  activeClass: ClassData
  /** Mark a student away on a day, or bring them back - past, today or ahead. */
  onToggleAbsent: (studentId: string, day: string) => void
  /** The signed-in teacher, whose Drive the record can go to. */
  uid?: string
}

/** "2026-09" from "2026-09-27". */
function monthOf(key: string): string {
  return key.slice(0, 7)
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return dateKey(d).slice(0, 7)
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

/** A second tap on the same square this soon is the board reading one touch as two. */
const REPEAT_TAP_MS = 700

/**
 * The teacher's own informal record, one month at a time: the roster down the side, every
 * school day across the top, a zzz where someone is away. Tapping a square marks or clears
 * it, on any day - fixing a past mistake, or marking a trip that hasn't happened yet.
 *
 * Every Monday to Friday gets a column, not only the days attendance was taken, because a
 * day that was missed or is still ahead needs somewhere to tap. Days that were taken read
 * at full strength; the rest are quieter. Editing here never counts as taking attendance.
 */
export function AttendanceHistoryModal({ open, onClose, activeClass, onToggleAbsent, uid }: AttendanceHistoryModalProps) {
  const drive = useDrive(uid)
  const today = dateKey()
  const thisMonth = today.slice(0, 7)
  const dates = useMemo(() => attendanceDates(activeClass), [activeClass])
  const taken = useMemo(() => new Set(takenDays(activeClass)), [activeClass])
  const firstMonth = dates.length > 0 && monthOf(dates[0]) < thisMonth ? monthOf(dates[0]) : thisMonth
  const [month, setMonth] = useState(thisMonth)
  const lastTap = useRef<{ key: string; at: number } | null>(null)

  // Opening it always starts on this month, the one a teacher is most likely looking for.
  useEffect(() => {
    if (open) setMonth(thisMonth)
  }, [open, thisMonth])

  // Weekdays, plus any weekend day that already holds a record from before, so nothing
  // anyone entered is ever hidden.
  const days = useMemo(() => [...new Set([...schoolDaysIn(month), ...dates.filter((d) => monthOf(d) === month)])].sort(), [month, dates])

  /** `at` is the tap's own timestamp, so two taps are compared by when they actually happened. */
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

  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Modal open={open} onClose={onClose} title={`Attendance - ${activeClass.name}`} size="xl">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <TactileButton
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              disabled={month <= firstMonth}
              className="!px-2.5"
              title="Last month"
            >
              <ChevronLeft size={18} />
            </TactileButton>
            <span className="min-w-[10rem] text-center font-bold text-foreground">{monthLabel(month)}</span>
            {/* Forward has no end: a teacher marking a trip next month needs to get there. */}
            <TactileButton onClick={() => setMonth((m) => shiftMonth(m, 1))} className="!px-2.5" title="Next month">
              <ChevronRight size={18} />
            </TactileButton>
          </div>
          {/* After a Drive update, the note where the hint was links to the Sheet. */}
          {drive.problem ? (
            <DriveProblem text={drive.problem.text} />
          ) : drive.done ? (
            <DriveLink file={drive.done.file} />
          ) : (
            <p className="hidden text-sm text-muted-foreground md:block">Tap a square to mark who is away.</p>
          )}
          <div className="flex gap-1.5">
            {/* One Sheet per class in the teacher's Drive folder, brought up to date in place
                rather than a new file every time. The CSV stays, for anyone not signed in. */}
            {uid && (
              <TactileButton
                onClick={() => void drive.run('attendance', (token) => updateAttendanceSheet(token, activeClass))}
                disabled={dates.length === 0 || drive.busy !== null}
                title="Bring this class's attendance Sheet in Google Drive up to date"
              >
                <GoogleG size={16} /> {drive.busy ? 'Updating…' : 'Update in Drive'}
              </TactileButton>
            )}
            <TactileButton onClick={downloadCsv} disabled={dates.length === 0} title="Download every day's attendance as a CSV file">
              <Download size={16} /> Export
            </TactileButton>
          </div>
        </div>

        {activeClass.students.length === 0 ? (
          <p className="rounded-2xl border border-black/10 p-6 text-center text-muted-foreground dark:border-white/10">
            No students in this class yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left align-bottom font-semibold">Student</th>
                  {days.map((d) => {
                    const isToday = d === today
                    return (
                      <th
                        key={d}
                        className={clsx(
                          'px-0 py-1 text-center leading-tight tabular-nums',
                          // A line before each Monday, so the weeks read as weeks.
                          weekdayOf(d) === 1 && 'border-l border-black/10 dark:border-white/10',
                          isToday && 'bg-primary/15',
                          taken.has(d) || isToday ? 'font-bold text-foreground' : 'font-normal text-muted-foreground',
                        )}
                        title={taken.has(d) ? 'Attendance was taken' : undefined}
                      >
                        <span className="block text-[0.65rem] opacity-70">{WEEKDAY_LETTERS[weekdayOf(d)]}</span>
                        {Number(d.slice(8))}
                      </th>
                    )
                  })}
                  <th className="px-2 py-1.5 text-center align-bottom font-semibold">Away</th>
                </tr>
              </thead>
              <tbody>
                {activeClass.students.map((s) => {
                  const away = days.filter((d) => activeClass.attendance?.[d]?.includes(s.id))
                  return (
                    <tr key={s.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-0.5">
                        <span className="mr-1.5 text-xs text-muted-foreground">{s.homeroom}</span>
                        <span className="font-semibold">{s.name}</span>
                      </td>
                      {days.map((d) => {
                        const isAway = away.includes(d)
                        return (
                          <td
                            key={d}
                            className={clsx(
                              'p-0 text-center',
                              weekdayOf(d) === 1 && 'border-l border-black/10 dark:border-white/10',
                              d === today && 'bg-primary/15',
                            )}
                          >
                            <button
                              type="button"
                              onClick={(e) => toggle(s.id, d, e.timeStamp)}
                              aria-pressed={isAway}
                              aria-label={`${s.name}, ${d}: ${isAway ? 'away' : 'here'}`}
                              className={clsx(
                                'mx-auto my-0.5 flex h-7 w-7 items-center justify-center rounded-lg transition-colors active:scale-90',
                                // Empty squares carry a faint fill, so they read as something to tap.
                                isAway ? 'bg-muted' : 'bg-black/[0.035] hover:bg-accent dark:bg-white/[0.05]',
                              )}
                            >
                              {isAway && <AbsentIcon className="h-5 w-5 text-foreground" />}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-2 py-0.5 text-center font-bold tabular-nums">{away.length || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
