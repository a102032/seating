import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, Download, Minus, Plus, Pointer, Star } from 'lucide-react'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { useDrive } from '../../hooks/useDrive'
import { dateKey } from '../../lib/attendance'
import { updateParticipationSheet } from '../../lib/drive'
import { type DayCount, participationDates, participationToCsv } from '../../lib/participation'
import type { ClassData } from '../../types'
import { AbsentIcon } from '../AbsentIcon'
import { GoogleG } from '../Account'
import { ConfirmModal } from '../ConfirmModal'
import { DriveLink, DriveProblem } from './GoogleSection'
import { Btn, MoreRow, SubHead } from './parts'

interface ParticipationSectionProps {
  activeClass: ClassData
  /** One student's day, set by hand. */
  onSetCount: (day: string, studentId: string, count: DayCount) => void
  /** A whole day out of the record. */
  onClearDay: (day: string) => void
  /** The whole record back to nothing. */
  onClearAll: () => void
  /** The signed-in teacher, whose Drive the record can go to. */
  uid?: string
  /** Records' switch between Attendance and Participation, at the head of the page. */
  records?: ReactNode
}

/**
 * One number with − and + beside it. A second tap within 0.2 s is the board reading one touch as
 * two, so it is let go: a deliberate run of taps still counts every one.
 */
function CountStepper({ icon, label, value, onChange }: { icon: ReactNode; label: string; value: number; onChange: (n: number) => void }) {
  const lastTap = useRef(0)
  function step(by: number) {
    const now = performance.now()
    if (now - lastTap.current < 200) return
    lastTap.current = now
    onChange(Math.max(0, value + by))
  }
  return (
    <span className="cs-stepper" aria-label={label}>
      {icon}
      <button type="button" disabled={value <= 0} onClick={() => step(-1)} aria-label={`${label}: one fewer`}>
        <Minus size={16} />
      </button>
      <span className="w-6 text-center font-bold tabular-nums">{value}</span>
      <button type="button" onClick={() => step(1)} aria-label={`${label}: one more`}>
        <Plus size={16} />
      </button>
    </span>
  )
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/**
 * Who had a turn, one lesson at a time: how many times each student was picked and given a point
 * that day, the fewest first and tinted, so the ones to call on next time are at the top; away
 * students at the end. For the teacher only - it never shows on the board. Clear This Day and Start
 * Over are at the top, where they are seen, rather than under the list.
 */
export function ParticipationSection({ activeClass, onSetCount, onClearDay, onClearAll, uid, records }: ParticipationSectionProps) {
  const drive = useDrive(uid)
  const today = dateKey()
  const dates = useMemo(() => participationDates(activeClass), [activeClass])
  // Every day with a record, and today even before anything has happened in it.
  const days = useMemo(() => [...new Set([...dates, today])].sort(), [dates, today])
  // It opens on the latest lesson with something in it: today, or the last one before.
  const [day, setDay] = useState(() => (dates.length > 0 && !dates.includes(today) ? dates[dates.length - 1] : today))
  /**
   * The student whose numbers are being fixed (2026-10-06, the teacher: test picks and points had
   * no way back out). While one is open the list holds its order, so the card doesn't jump away.
   */
  const [editing, setEditing] = useState<string | null>(null)
  const [heldOrder, setHeldOrder] = useState<string[] | null>(null)
  const [confirming, setConfirming] = useState<'day' | 'all' | null>(null)
  // More options: Clear This Day and Start Over, rare and red (2026-10-26).
  const [more, setMore] = useState(false)

  // The whole record, every day, as attendance's Export does (2026-10-12, the teacher: "we need this").
  function downloadCsv() {
    const blob = new Blob([participationToCsv(activeClass)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeClass.name.trim() || 'class'} participation.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function showDay(next: string) {
    setDay(next)
    setEditing(null)
    setHeldOrder(null)
  }

  if (activeClass.students.length === 0) {
    return (
      <>
        <div className="cs-page-head">
          {records}
          <p>Who had a turn, lesson by lesson.</p>
        </div>
        <div className="cs-list">
          <div className="cs-empty">
            <span className="cs-hint">Add students first.</span>
          </div>
        </div>
      </>
    )
  }

  const at = days.indexOf(day)
  const counts = activeClass.participation?.[day] ?? {}
  const away = new Set(activeClass.attendance?.[day] ?? [])
  const seated = new Set(activeClass.seating.filter(Boolean))
  // The class as it was that day: everyone on record, and everyone in a seat now (who could have
  // been picked). Away at the end, so a child who wasn't there doesn't read as quiet.
  const rows = activeClass.students
    .filter((s) => counts[s.id] || seated.has(s.id))
    .map((s) => {
      const [picked, points] = counts[s.id] ?? [0, 0]
      return { student: s, picked, points, away: away.has(s.id) }
    })
    .sort(
      (a, b) =>
        Number(a.away) - Number(b.away) ||
        a.picked + a.points - (b.picked + b.points) ||
        a.student.name.localeCompare(b.student.name, undefined, { sensitivity: 'base' }),
    )
  if (heldOrder) {
    const place = (id: string) => (heldOrder.includes(id) ? heldOrder.indexOf(id) : heldOrder.length)
    rows.sort((a, b) => place(a.student.id) - place(b.student.id))
  }
  const notYet = rows.filter((r) => !r.away && r.picked + r.points === 0).length
  const nobody = rows.every((r) => r.picked + r.points === 0)

  return (
    <>
      {more ? (
        <>
          <SubHead back="Participation" title="More options" onBack={() => setMore(false)} />
          <div className="cs-group">
            <div className="cs-row">
              <span className="cs-row-label">
                <b>Clear This Day</b>
                <small>Takes {dayLabel(day)} out of the record. Anyone picked today gets their turn back.</small>
              </span>
              <Btn small data-guide="clear-day" disabled={Object.keys(counts).length === 0} onClick={() => setConfirming('day')}>
                Clear This Day
              </Btn>
            </div>
            <div className="cs-row">
              <span className="cs-row-label">
                <b>Start Over</b>
                <small>Empties the whole record, at the end of testing or the start of a term.</small>
              </span>
              <Btn kind="red" small data-guide="start-over" disabled={dates.length === 0} onClick={() => setConfirming('all')}>
                Start Over
              </Btn>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="cs-page-head">
            {records}
            <div className="cs-right">
              {uid && (
                <Btn
                  small
                  data-guide="part-drive"
                  disabled={dates.length === 0 || drive.busy !== null}
                  onClick={() => void drive.run('participation', (token) => updateParticipationSheet(token, activeClass))}
                >
                  <GoogleG size={18} /> {drive.busy ? 'Updating…' : 'Update in Drive'}
                </Btn>
              )}
              <Btn small data-guide="part-export" disabled={dates.length === 0} onClick={downloadCsv}>
                <Download /> Export to CSV
              </Btn>
              {drive.problem ? <DriveProblem text={drive.problem.text} /> : drive.done ? <DriveLink file={drive.done.file} /> : null}
            </div>
          </div>
          <div className="cs-navbar" data-guide="day-nav">
            <button type="button" aria-label="The lesson before" disabled={at <= 0} onClick={() => showDay(days[at - 1])}>
              <ChevronLeft />
            </button>
            <b>
              {dayLabel(day)}
              {day === today && <span className="cs-hint inline"> (today)</span>}
            </b>
            <button
              type="button"
              aria-label="The lesson after"
              disabled={at < 0 || at >= days.length - 1}
              onClick={() => showDay(days[at + 1])}
            >
              <ChevronRight />
            </button>
          </div>
          <p className="cs-hint" style={{ marginTop: -4 }}>
            {rows.length === 0
              ? 'No students in seats yet.'
              : nobody
                ? 'Nobody was picked or given a point on this day.'
                : notYet > 0
                  ? `${notYet} ${notYet === 1 ? 'student' : 'students'} not picked or given a point. They're at the top. Tap a student to fix their numbers.`
                  : 'Everyone here was picked or given a point. Tap a student to fix their numbers.'}
          </p>
          <div className="cs-part" data-guide="part-grid">
            {rows.map(({ student, picked, points, away: isAway }) => {
              const fixing = editing === student.id
              return (
                <div
                  key={student.id}
                  className={clsx(
                    'cs-pc',
                    fixing ? 'cs-fixing' : !isAway && picked + points === 0 && 'cs-none',
                    isAway && !fixing && 'cs-awayc',
                  )}
                >
                  <div className="cs-pc-top">
                    <span className="cs-hr">{student.homeroom}</span>
                    <span className="min-w-0 flex-1 truncate">{student.name}</span>
                    {fixing ? (
                      <Btn
                        small
                        onClick={() => {
                          setEditing(null)
                          setHeldOrder(null)
                        }}
                      >
                        <Check /> Done
                      </Btn>
                    ) : isAway && picked + points === 0 ? (
                      <span className="cs-n">
                        <AbsentIcon className="h-4 w-4" /> Away
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="cs-n rounded-lg px-1 hover:bg-secondary"
                        title="Tap to fix these numbers"
                        onClick={() => {
                          setHeldOrder(heldOrder ?? rows.map((r) => r.student.id))
                          setEditing(student.id)
                        }}
                      >
                        <span className={picked === 0 ? 'opacity-40' : undefined}>
                          <Pointer size={14} /> {picked}
                        </span>
                        <span className={points === 0 ? 'opacity-40' : undefined}>
                          <Star size={14} className="fill-amber-400 text-amber-500" /> {points}
                        </span>
                      </button>
                    )}
                  </div>
                  {fixing && (
                    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
                      <CountStepper
                        icon={<Pointer size={15} />}
                        label="Picked"
                        value={picked}
                        onChange={(n) => onSetCount(day, student.id, [n, points])}
                      />
                      <CountStepper
                        icon={<Star size={15} className="fill-amber-400 text-amber-500" />}
                        label="Given a point"
                        value={points}
                        onChange={(n) => onSetCount(day, student.id, [picked, n])}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Export and Update in Drive are the whole record, every lesson (2026-10-12, the teacher: "we
          need this"), at the top beside Records' switch, as attendance's are; one Sheet per class in
          the teacher's Drive folder, brought up to date in place. Clearing is rare: More options. */}
          <MoreRow inside="Clear This Day, Start Over" onClick={() => setMore(true)} />
        </>
      )}

      <ConfirmModal
        open={confirming === 'day'}
        title="Clear This Day?"
        message={`Who was picked and given a point on ${dayLabel(day)} goes from "${activeClass.name}"'s record.${
          day === today ? ' Everyone picked today gets their turn back.' : ''
        } Other days stay. This can't be undone.`}
        confirmLabel="Yes, Clear It"
        cancelLabel="No"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          onClearDay(day)
          setConfirming(null)
          const before = dates.filter((d) => d < day)
          showDay(before.length > 0 ? before[before.length - 1] : today)
        }}
      />
      <ConfirmModal
        open={confirming === 'all'}
        title="Start Over?"
        message={`Every lesson in "${activeClass.name}"'s participation record goes, and everyone starts again at zero. This can't be undone.`}
        confirmLabel="Yes, Start Over"
        cancelLabel="No"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          onClearAll()
          setConfirming(null)
          showDay(today)
        }}
      />
    </>
  )
}
