import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Pointer, Star } from 'lucide-react'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { dateKey } from '../../lib/attendance'
import { type DayCount, participationDates } from '../../lib/participation'
import type { ClassData } from '../../types'
import { AbsentIcon } from '../AbsentIcon'
import { ConfirmModal } from '../ConfirmModal'
import { Btn } from './parts'

interface ParticipationSectionProps {
  activeClass: ClassData
  /** One student's day, set by hand. */
  onSetCount: (day: string, studentId: string, count: DayCount) => void
  /** A whole day out of the record. */
  onClearDay: (day: string) => void
  /** The whole record back to nothing. */
  onClearAll: () => void
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
export function ParticipationSection({ activeClass, onSetCount, onClearDay, onClearAll }: ParticipationSectionProps) {
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

  function showDay(next: string) {
    setDay(next)
    setEditing(null)
    setHeldOrder(null)
  }

  if (activeClass.students.length === 0) {
    return (
      <>
        <div className="cs-page-head">
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
      <div className="cs-page-head">
        <div className="cs-right">
          <span className="flex items-center gap-1" data-guide="day-nav">
            <button
              type="button"
              className="cs-icon-btn"
              aria-label="The lesson before"
              disabled={at <= 0}
              onClick={() => showDay(days[at - 1])}
            >
              <ChevronLeft />
            </button>
            <b>{dayLabel(day)}</b>
            {day === today && <span className="cs-hint">(today)</span>}
            <button
              type="button"
              className="cs-icon-btn"
              aria-label="The lesson after"
              disabled={at < 0 || at >= days.length - 1}
              onClick={() => showDay(days[at + 1])}
            >
              <ChevronRight />
            </button>
          </span>
          <Btn kind="quiet" small data-guide="clear-day" disabled={Object.keys(counts).length === 0} onClick={() => setConfirming('day')}>
            Clear This Day
          </Btn>
          <Btn kind="quiet-red" small data-guide="start-over" disabled={dates.length === 0} onClick={() => setConfirming('all')}>
            Start Over
          </Btn>
        </div>
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
