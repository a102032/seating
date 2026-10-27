import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Modal } from '../components/Modal'
import { TactileButton } from '../components/TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'
import { attendanceTakenOn } from '../lib/attendance'
import type { ClassData } from '../types'

const KEY = 'seating-chart-attendance-reminder-v1'
/** The window opens under the finger that opened the class, and the board reads one touch as two. */
const TAP_GUARD_MS = 700

/** The classes the teacher closed the reminder for today, kept on this board. */
type Closed = { day: string; ids: string[] }

function loadClosed(today: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Closed | null
    return saved?.day === today ? saved.ids : []
  } catch {
    return []
  }
}

function saveClosed(today: string, ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: today, ids }))
  } catch {
    // Not remembered: it asks again next time this class opens today, which is harmless.
  }
}

/**
 * The attendance reminder (2026-10-27, the teacher: "Attendance is very, very important. But it is
 * also easy for a teacher to forget"). Opening a class whose attendance isn't taken today - from the
 * splash or the class list, never a refresh - asks first: Take Attendance, Remind me later, or Close.
 * Never on a clock, so it never pops up mid-lesson in front of the class: Remind me later asks again
 * the next time this class is opened today; Close means not again today for this class (kept on this
 * board). The rail's Attendance button carries an amber dot until it is taken, for a board left on.
 */
export function useAttendanceReminder(today: string) {
  const [askFor, setAskFor] = useState<string | null>(null)
  return {
    askFor,
    /** A class was opened: ask, unless its attendance is taken, it has no students, or it was closed today. */
    classOpened: (cls: ClassData | undefined) => {
      if (!cls || cls.students.length === 0 || attendanceTakenOn(cls, today)) return
      // '*' is every class: the checks (scripts/) set it, as they open classes for their own reasons.
      const closed = loadClosed(today)
      if (closed.includes(cls.id) || closed.includes('*')) return
      setAskFor(cls.id)
    },
    later: () => setAskFor(null),
    close: () => {
      if (askFor) saveClosed(today, [...loadClosed(today).filter((id) => id !== askFor), askFor])
      setAskFor(null)
    },
  }
}

export function AttendanceReminder({
  cls,
  onTake,
  onLater,
  onClose,
}: {
  cls: ClassData | null
  onTake: () => void
  onLater: () => void
  onClose: () => void
}) {
  const open = cls !== null
  const openedAt = useRef(0)
  useLayoutEffect(() => {
    if (open) openedAt.current = performance.now()
  }, [open])
  // The class's name is kept through the closing fade.
  const last = useRef<ClassData | null>(null)
  if (cls) last.current = cls
  const shown = useLingerWhileClosing(open)
  if (!shown || !last.current) return null
  const ready = (e: MouseEvent) => e.timeStamp - openedAt.current >= TAP_GUARD_MS

  return (
    // A tap outside is "Remind me later": it asks again next time, so nothing is lost by it.
    <Modal open={open} onClose={() => performance.now() - openedAt.current >= TAP_GUARD_MS && onLater()} title="Take attendance?">
      <div className="flex flex-col gap-4" data-attendance-reminder="">
        <p className="text-lg">Attendance for {last.current.name} isn&apos;t taken yet today.</p>
        <TactileButton type="button" variant="primary" onClick={(e) => ready(e) && onTake()}>
          Take Attendance
        </TactileButton>
        <div className="flex gap-3">
          <TactileButton type="button" className="flex-1" onClick={(e) => ready(e) && onLater()}>
            Remind me later
          </TactileButton>
          <TactileButton type="button" className="flex-1" onClick={(e) => ready(e) && onClose()}>
            Close
          </TactileButton>
        </div>
      </div>
    </Modal>
  )
}
