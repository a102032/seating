import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Star, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { dateKey } from '../lib/attendance'
import { participationDates } from '../lib/participation'
import type { ClassData } from '../types'
import { AbsentIcon } from './AbsentIcon'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface ParticipationModalProps {
  open: boolean
  onClose: () => void
  activeClass: ClassData
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
export function ParticipationModal({ open, onClose, activeClass }: ParticipationModalProps) {
  const today = dateKey()
  const dates = useMemo(() => participationDates(activeClass), [activeClass])
  // Every day with a record, and today even before anything has happened in it.
  const days = useMemo(() => [...new Set([...dates, today])].sort(), [dates, today])
  const [day, setDay] = useState(today)

  // Opening it starts on the latest lesson with something in it: today, or the last one before.
  useEffect(() => {
    if (open) setDay(dates.length > 0 && !dates.includes(today) ? dates[dates.length - 1] : today)
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
  const pickedTotal = rows.reduce((n, r) => n + r.picked, 0)
  const notYet = rows.filter((r) => !r.away && r.picked + r.points === 0).length

  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Modal open={open} onClose={onClose} title={`Participation - ${activeClass.name}`} size="xl">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <TactileButton onClick={() => setDay(days[at - 1])} disabled={at <= 0} className="!px-2.5" title="The lesson before">
              <ChevronLeft size={18} />
            </TactileButton>
            <span className="min-w-[14rem] text-center font-bold text-foreground">
              {dayLabel(day)}
              {day === today && <span className="ml-1.5 font-normal text-muted-foreground">(today)</span>}
            </span>
            <TactileButton
              onClick={() => setDay(days[at + 1])}
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
                return (
                  <div
                    key={student.id}
                    className={clsx(
                      'mb-1.5 flex break-inside-avoid items-center gap-2 rounded-xl border px-2.5 py-1.5',
                      none ? 'border-amber-400/60 bg-amber-400/10' : 'border-black/10 dark:border-white/10',
                      isAway && 'opacity-50',
                    )}
                  >
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">{student.homeroom}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{student.name}</span>
                    {isAway ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AbsentIcon className="h-4 w-4" /> Away
                      </span>
                    ) : (
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
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Picked by Pick Student, the group picker or a flip card. A point given to a few students, not the whole class. A student you
              call on yourself shows here only if you give them a point.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
