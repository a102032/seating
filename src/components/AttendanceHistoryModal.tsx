import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { attendanceDates, attendanceToCsv, dateKey } from '../lib/attendance'
import type { ClassData } from '../types'
import { AbsentIcon } from './AbsentIcon'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface AttendanceHistoryModalProps {
  open: boolean
  onClose: () => void
  activeClass: ClassData
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

/**
 * The teacher's own informal record, one month at a time: the roster down the side, the days
 * attendance was taken across the top, a zzz where someone was away. Only days that were
 * taken get a column, so a month of lessons fits without a column for every weekend.
 */
export function AttendanceHistoryModal({ open, onClose, activeClass }: AttendanceHistoryModalProps) {
  const thisMonth = dateKey().slice(0, 7)
  const dates = useMemo(() => attendanceDates(activeClass), [activeClass])
  const firstMonth = dates.length > 0 ? monthOf(dates[0]) : thisMonth
  const [month, setMonth] = useState(thisMonth)

  // Opening it always starts on this month, the one a teacher is most likely looking for.
  useEffect(() => {
    if (open) setMonth(thisMonth)
  }, [open, thisMonth])

  const days = dates.filter((d) => monthOf(d) === month)

  function downloadCsv() {
    const blob = new Blob([attendanceToCsv(activeClass)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeClass.name.trim() || 'class'} attendance.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Attendance - ${activeClass.name}`} size="wide">
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
            <TactileButton
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= thisMonth}
              className="!px-2.5"
              title="Next month"
            >
              <ChevronRight size={18} />
            </TactileButton>
          </div>
          <TactileButton onClick={downloadCsv} disabled={dates.length === 0} title="Download every day's attendance as a CSV file">
            <Download size={16} /> Export
          </TactileButton>
        </div>

        {days.length === 0 ? (
          <p className="rounded-2xl border border-black/10 p-6 text-center text-muted-foreground dark:border-white/10">
            No attendance taken in {monthLabel(month).split(' ')[0]}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="sticky left-0 bg-card px-3 py-2 text-left font-semibold">Student</th>
                  {days.map((d) => (
                    <th key={d} className="px-1.5 py-2 text-center font-semibold tabular-nums">
                      {Number(d.slice(8))}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold">Away</th>
                </tr>
              </thead>
              <tbody>
                {activeClass.students.map((s) => {
                  const away = days.filter((d) => activeClass.attendance?.[d]?.includes(s.id))
                  return (
                    <tr key={s.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="sticky left-0 whitespace-nowrap bg-card px-3 py-1.5">
                        <span className="mr-1.5 text-xs text-muted-foreground">{s.homeroom}</span>
                        <span className="font-semibold">{s.name}</span>
                      </td>
                      {days.map((d) => (
                        <td key={d} className="px-1.5 py-1.5 text-center">
                          {away.includes(d) && <AbsentIcon className="mx-auto h-5 w-5 text-muted-foreground" />}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-center font-bold tabular-nums">{away.length || ''}</td>
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
