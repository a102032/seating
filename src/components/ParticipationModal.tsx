import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, Eraser, Minus, Plus, RotateCcw, Star, User } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { dateKey } from '../lib/attendance'
import { type DayCount, participationDates } from '../lib/participation'
import type { ClassData } from '../types'
import { AbsentIcon } from './AbsentIcon'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface ParticipationModalProps {
  open: boolean
  onClose: () => void
  activeClass: ClassData
  /** One student's day, set by hand. */
  onSetCount: (day: string, studentId: string, count: DayCount) => void
  /** A whole lesson out of the record. */
  onClearDay: (day: string) => void
  /** The whole record back to nothing. */
  onClearAll: () => void
}

/**
 * One number with - and + beside it. A second tap within 0.2 s is the board reading one touch
 * as two, so it is let go: a deliberate run of taps still counts every one.
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
    <span className="flex items-center gap-1" aria-label={label}>
      {icon}
      <TactileButton onClick={() => step(-1)} disabled={value <= 0} className="!px-2 !py-1.5" title={`${label}: one fewer`}>
        <Minus size={15} />
      </TactileButton>
      <span className="w-6 text-center font-bold tabular-nums text-foreground">{value}</span>
      <TactileButton onClick={() => step(1)} className="!px-2 !py-1.5" title={`${label}: one more`}>
        <Plus size={15} />
      </TactileButton>
    </span>
  )
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/**
 * Who had a turn, one lesson at a time: how many times each student was picked and given a
 * point that day, the fewest first, so the ones a teacher might want to call on next time are
 * at the top. For the teacher only - it never shows on the board - and for looking back, not
 * for running a lesson: the picker already gives the students picked less often a better chance.
 * What it can't know is a child called on by hand who answered without a star.
 */
export function ParticipationModal({ open, onClose, activeClass, onSetCount, onClearDay, onClearAll }: ParticipationModalProps) {
  const today = dateKey()
  const dates = useMemo(() => participationDates(activeClass), [activeClass])
  // Every day with a record, and today even before anything has happened in it.
  const days = useMemo(() => [...new Set([...dates, today])].sort(), [dates, today])
  const [day, setDay] = useState(today)
  /**
   * The student whose numbers are being fixed (2026-10-06, the teacher: picks and points made
   * while trying things out in real lessons had no way back out). While one is open the list
   * holds its order, or the row would jump away as its numbers change the sort.
   */
  const [editing, setEditing] = useState<string | null>(null)
  const [heldOrder, setHeldOrder] = useState<string[] | null>(null)
  const [confirming, setConfirming] = useState<'day' | 'all' | null>(null)

  function showDay(next: string) {
    setDay(next)
    setEditing(null)
    setHeldOrder(null)
  }

  // Opening it starts on the latest lesson with something in it: today, or the last one before.
  useEffect(() => {
    if (open) showDay(dates.length > 0 && !dates.includes(today) ? dates[dates.length - 1] : today)
    // Only on opening; the record growing underneath shouldn't move the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const at = days.indexOf(day)
  const counts = activeClass.participation?.[day] ?? {}
  const away = new Set(activeClass.attendance?.[day] ?? [])
  const seated = new Set(activeClass.seating.filter(Boolean))

  // The class as it was that day: everyone on record, and everyone in a seat now (who could have
  // been picked). Away at the bottom, so a child who wasn't there doesn't read as quiet.
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
  const dayHasRecord = Object.keys(counts).length > 0
  const anyRecord = dates.length > 0

  function startEditing(studentId: string) {
    setHeldOrder(heldOrder ?? rows.map((r) => r.student.id))
    setEditing(studentId)
  }

  function doneEditing() {
    setEditing(null)
    setHeldOrder(null)
  }
  const pickedTotal = rows.reduce((n, r) => n + r.picked, 0)
  const notYet = rows.filter((r) => !r.away && r.picked + r.points === 0).length

  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <>
      {/* Out of the way while a confirm is up, as Class Settings does, so a tap on it isn't a tap outside this. */}
      <Modal open={open && !confirming} onClose={onClose} title={`Participation - ${activeClass.name}`} size="xl">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <TactileButton onClick={() => showDay(days[at - 1])} disabled={at <= 0} className="!px-2.5" title="The lesson before">
                <ChevronLeft size={18} />
              </TactileButton>
              <span className="min-w-[14rem] text-center font-bold text-foreground">
                {dayLabel(day)}
                {day === today && <span className="ml-1.5 font-normal text-muted-foreground">(today)</span>}
              </span>
              <TactileButton
                onClick={() => showDay(days[at + 1])}
                disabled={at < 0 || at >= days.length - 1}
                className="!px-2.5"
                title="The lesson after"
              >
                <ChevronRight size={18} />
              </TactileButton>
            </div>
            <p className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User size={15} /> Picked
              </span>
              <span className="flex items-center gap-1">
                <Star size={15} className="fill-amber-400 text-amber-500" /> Given a point
              </span>
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl border border-black/10 p-6 text-center text-muted-foreground dark:border-white/10">
              No students in seats yet.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {pickedTotal === 0 && rows.every((r) => r.points === 0)
                  ? 'Nobody was picked or given a point on this day.'
                  : notYet > 0
                    ? `${notYet} student${notYet === 1 ? '' : 's'} not picked or given a point. They're at the top.`
                    : 'Everyone here was picked or given a point.'}
              </p>
              {/* Columns that read down, so the fewest are together at the top of the first one. */}
              <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
                {rows.map(({ student, picked, points, away: isAway }) => {
                  const none = !isAway && picked + points === 0
                  const fixing = editing === student.id
                  const numbers = (
                    <>
                      <span className={clsx('flex w-9 items-center justify-end gap-0.5 tabular-nums', picked === 0 && 'opacity-35')}>
                        <User size={14} className="text-muted-foreground" />
                        {picked}
                      </span>
                      <span className={clsx('flex w-9 items-center justify-end gap-0.5 tabular-nums', points === 0 && 'opacity-35')}>
                        <Star size={14} className="fill-amber-400 text-amber-500" />
                        {points}
                      </span>
                    </>
                  )
                  return (
                    <div
                      key={student.id}
                      className={clsx(
                        'mb-1.5 flex break-inside-avoid flex-col gap-1.5 rounded-xl border px-2.5 py-1.5',
                        fixing
                          ? 'border-primary/60 bg-primary/5'
                          : none
                            ? 'border-amber-400/60 bg-amber-400/10'
                            : 'border-black/10 dark:border-white/10',
                        isAway && !fixing && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-8 shrink-0 text-xs text-muted-foreground">{student.homeroom}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{student.name}</span>
                        {isAway && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <AbsentIcon className="h-4 w-4" /> Away
                          </span>
                        )}
                        {fixing ? (
                          <TactileButton onClick={doneEditing} className="!px-2.5 !py-1.5" title="Done">
                            <Check size={16} /> Done
                          </TactileButton>
                        ) : (
                          // An away student's numbers show only if they have any (picked before
                          // being marked away), so they can be fixed too.
                          (!isAway || picked + points > 0) && (
                            <button
                              type="button"
                              onClick={() => startEditing(student.id)}
                              title="Tap to fix these numbers"
                              className="-my-1 flex items-center rounded-lg px-1 py-1 hover:bg-accent"
                              style={{ touchAction: 'manipulation' }}
                            >
                              {numbers}
                            </button>
                          )
                        )}
                      </div>
                      {fixing && (
                        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
                          <CountStepper
                            icon={<User size={15} className="text-muted-foreground" />}
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
              <p className="text-xs text-muted-foreground">
                Picked by Pick Student, the group picker or a flip card. A point given to a few students, not the whole class. A student you
                call on yourself shows here only if you give them a point. Tap a student's numbers to fix them.
              </p>
              {/* Taking things back out of the record: a lesson that was all trying things out,
                or the whole record, at the end of testing or the start of a term. */}
              <div className="flex flex-wrap justify-end gap-2">
                <TactileButton onClick={() => setConfirming('day')} disabled={!dayHasRecord}>
                  <Eraser size={16} /> Clear This Lesson
                </TactileButton>
                <TactileButton onClick={() => setConfirming('all')} disabled={!anyRecord}>
                  <RotateCcw size={16} /> Start Over
                </TactileButton>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={confirming === 'day'}
        title="Clear this lesson?"
        message={`Who was picked and given a point on ${dayLabel(day)} goes from "${activeClass.name}"'s record.${
          day === today ? ' Everyone picked today gets their turn back.' : ''
        } Other lessons stay. This can't be undone.`}
        confirmLabel="Yes, Clear It"
        cancelLabel="No"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          onClearDay(day)
          setConfirming(null)
          // On to the lesson before it, or today when there is none.
          const before = dates.filter((d) => d < day)
          showDay(before.length > 0 ? before[before.length - 1] : today)
        }}
      />

      <ConfirmModal
        open={confirming === 'all'}
        title="Start the record over?"
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
