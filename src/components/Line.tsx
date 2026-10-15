import clsx from 'clsx'
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { lineCount, type ClassLine } from '../lib/line'
import type { Student } from '../types'
import { SoundButton } from './GetReady'
import { Modal } from './Modal'
import { PointIcon, QueueIcon } from './RailIcons'
import { StudentPicture } from './StudentPicture'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

/**
 * The board reads one touch as two. Done and Skip change who is under the finger, so a second
 * touch would finish two students; a window's buttons appear under the finger that opened it.
 */
const TAP_GUARD_MS = 700
/** The star only adds, so a second star a moment later is the board's ghost touch, not the teacher. */
const STAR_GUARD_MS = 250

interface LinePanelProps {
  line: ClassLine
  studentsById: Map<string, Student>
  /** Students whose homeroom number shows after their name: two sharing a name, as on the desks. */
  homerooms: Set<string>
  /** The class runs points, so the student with the teacher can be given a star. */
  points: boolean
  onStar: () => void
  onDone: () => void
  onSkip: () => void
  /** A name in the line was tapped: ask whether to take them out. */
  onAskLeave: (studentId: string) => void
  onClear: () => void
  /** No sound for the Line, set by the speaker by "In line", as Get Ready!'s is on "How long?". */
  silent: boolean
  onSetSilent: (silent: boolean) => void
}

/**
 * The Line's column, on the right of the board (2026-10-15, the teacher: he sits with the board
 * behind him and needs his buttons in reach without standing). The top is for the class to read
 * from their seats: who is with the teacher, big, and the line in order under it. The bottom is the
 * teacher's: Skip, then the star and Done, where a seated hand lands when he turns round, and Clear
 * Line under them, which asks first. The list never scrolls: as many names as fit, then "+3 more", since every
 * child's number is on their own desk anyway.
 */
export function LinePanel({
  line,
  studentsById,
  homerooms,
  points,
  onStar,
  onDone,
  onSkip,
  onAskLeave,
  onClear,
  silent,
  onSetSilent,
}: LinePanelProps) {
  const now = line.now ? studentsById.get(line.now) : undefined
  const lastTap = useRef(0)
  const lastStar = useRef(0)
  const guarded = (e: MouseEvent, ms: number, last: { current: number }, run: () => void) => {
    if (e.timeStamp >= last.current && e.timeStamp - last.current < ms) return
    last.current = e.timeStamp
    run()
  }

  // How many names fit: measured from the room the list has and one row's height, so a short
  // screen shows fewer names rather than a list that scrolls.
  const listRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(99)
  useLayoutEffect(() => {
    const list = listRef.current
    const probe = probeRef.current
    if (!list || !probe) return
    const measure = () => {
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0
      const row = probe.offsetHeight
      if (row > 0) setFits(Math.max(1, Math.floor((list.clientHeight + gap) / (row + gap))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])
  const overflow = line.waiting.length > fits
  const shown = overflow ? line.waiting.slice(0, fits - 1) : line.waiting
  // The places the desks show: the one with the teacher is 1, so the first waiting is 2.
  const firstPlace = now ? 2 : 1

  const nameOf = (id: string) => {
    const s = studentsById.get(id)
    if (!s) return ''
    return homerooms.has(id) && s.homeroom.trim() ? `${s.name} ${s.homeroom.trim()}` : s.name
  }

  return (
    <aside
      data-ink="panel"
      data-line-panel=""
      aria-label="Line"
      className="flex h-full w-[clamp(10.5rem,15vw,15rem)] shrink-0 flex-col gap-[clamp(0.35rem,1.2vh,0.75rem)] overflow-hidden rounded-2xl border border-border bg-card/80 p-[clamp(0.4rem,1.2vh,0.75rem)] text-card-foreground shadow-sm"
    >
      {/* With the teacher: the class reads it from their seats. */}
      <section className="flex shrink-0 flex-col items-center gap-1 rounded-xl bg-emerald-500/15 px-1.5 py-[clamp(0.25rem,1vh,0.6rem)] text-center">
        <span className="font-bold text-emerald-800 dark:text-emerald-200" style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 1rem)' }}>
          With the teacher
        </span>
        {now ? (
          <>
            <StudentPicture
              student={now}
              className="pointer-events-none h-[clamp(2.5rem,11vh,5.5rem)] w-[clamp(2.5rem,11vh,5.5rem)] select-none object-contain"
            />
            {/* Number 1, as on their desk, until they are done or back in their seat. */}
            <span className="flex w-full min-w-0 items-center justify-center gap-1.5" style={{ fontSize: 'clamp(1rem, 3vmin, 1.9rem)' }}>
              <span
                className="grid min-w-[1.5em] shrink-0 place-items-center rounded-full bg-emerald-600 px-[0.25em] text-[0.7em] font-bold leading-[1.45] text-white tabular-nums"
                aria-hidden
              >
                1
              </span>
              <span data-line-now="" className="block min-w-0 truncate font-bold leading-tight">
                {nameOf(now.id)}
              </span>
            </span>
          </>
        ) : (
          <>
            <QueueIcon className="h-[clamp(2.5rem,11vh,5.5rem)] w-[clamp(2.5rem,11vh,5.5rem)] p-[8%] opacity-25" />
            <span className="block font-bold leading-tight text-muted-foreground" style={{ fontSize: 'clamp(0.9rem, 2.4vmin, 1.4rem)' }}>
              Nobody yet
            </span>
          </>
        )}
      </section>

      {/* The line, in order. A tap on a name asks whether to take them out. */}
      <section className="flex min-h-0 flex-1 flex-col gap-1">
        <div className="flex shrink-0 items-center justify-between gap-1">
          <span className="font-bold text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 1rem)' }}>
            In line{line.waiting.length > 0 ? ` · ${line.waiting.length}` : ''}
          </span>
          {/* No sound, for a quiet writing lesson: beside the list rather than a switch in Class
              Settings, as Get Ready!'s speaker is on "How long?", and kept with the class. */}
          <SoundButton silent={silent} onTap={() => onSetSilent(!silent)} className="!size-8 [&_svg]:!size-[18px]" />
        </div>
        <div ref={listRef} className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
          {/* One row, unseen, to measure how tall a row is on this screen. */}
          <div ref={probeRef} aria-hidden className="invisible absolute inset-x-0 top-0">
            <Row number={1}>Probe</Row>
          </div>
          {shown.map((id, i) => (
            <button
              key={id}
              type="button"
              data-line-row={id}
              onClick={() => onAskLeave(id)}
              className="shrink-0 rounded-lg text-left transition-transform active:scale-[0.97]"
            >
              <Row number={firstPlace + i}>{nameOf(id)}</Row>
            </button>
          ))}
          {overflow && (
            <div className="shrink-0">
              <Row number={null}>+{line.waiting.length - shown.length} more</Row>
            </div>
          )}
        </div>
      </section>

      {/* The teacher's: in the bottom corner, where a seated hand lands. */}
      <section className="flex shrink-0 flex-col gap-[clamp(0.3rem,1vh,0.5rem)]">
        <TactileButton
          disabled={!now || line.waiting.length === 0}
          title={line.waiting.length === 0 ? 'Nobody else is waiting' : 'Back to the end of the line'}
          onClick={(e) => guarded(e, TAP_GUARD_MS, lastTap, onSkip)}
          className={panelButton('w-full')}
        >
          Skip
        </TactileButton>
        <div className="flex gap-[clamp(0.25rem,0.8vh,0.4rem)]">
          {points && (
            <TactileButton
              aria-label="Give a Star"
              title="A star for the student with you"
              data-points="award"
              disabled={!now}
              onClick={(e) => guarded(e, STAR_GUARD_MS, lastStar, onStar)}
              className={panelButton('w-[30%] shrink-0 !px-0')}
            >
              <PointIcon className="size-[clamp(1.25rem,4vh,2rem)]" />
            </TactileButton>
          )}
          <TactileButton
            variant="primary"
            disabled={!now}
            onClick={(e) => guarded(e, TAP_GUARD_MS, lastTap, onDone)}
            className={panelButton('min-w-0 flex-1 !bg-emerald-600 !text-white hover:!bg-emerald-700')}
          >
            Done
          </TactileButton>
        </div>
        <button
          type="button"
          disabled={lineCount(line) === 0 && line.done.length === 0}
          onClick={onClear}
          className="self-center rounded-lg px-2 py-0.5 font-semibold text-destructive transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          style={{ fontSize: 'clamp(0.75rem, 1.6vmin, 0.95rem)' }}
        >
          Clear Line
        </button>
      </section>
    </aside>
  )
}

/** The teacher's buttons: a finger's size on every board, and bigger words than the app's everyday buttons. */
function panelButton(extra: string) {
  return clsx('!h-[clamp(2.6rem,7.5vh,3.75rem)] !rounded-xl !py-0 justify-center !text-[clamp(1rem,2.6vmin,1.4rem)] !font-bold', extra)
}

/** One name in the line: its number, as on the desk, and the name. */
function Row({ number, children }: { number: number | null; children: ReactNode }) {
  return (
    <div className="flex h-[clamp(1.85rem,5.4vh,2.6rem)] items-center gap-2 rounded-lg bg-black/[0.04] px-1.5 dark:bg-white/[0.06]">
      {number !== null ? (
        <span
          className="grid min-w-[1.6em] shrink-0 place-items-center rounded-full bg-primary px-[0.3em] font-bold leading-[1.5] text-primary-foreground tabular-nums"
          style={{ fontSize: 'clamp(0.75rem, 1.9vmin, 1.1rem)' }}
        >
          {number}
        </span>
      ) : null}
      <span
        className={clsx('min-w-0 flex-1 truncate font-bold', number === null && 'text-center text-muted-foreground')}
        style={{ fontSize: 'clamp(0.85rem, 2.3vmin, 1.3rem)' }}
      >
        {children}
      </span>
    </div>
  )
}

/**
 * "Kevin, get out of line?" A child who tapped the wrong desk, or changed their mind, taps it
 * again; the teacher taps a name in the line. Both buttons wait a moment before they answer, since
 * the window opens under the finger that tapped, and a tap outside means stay.
 */
export function LineLeaveModal({ student, onLeave, onStay }: { student: Student | null; onLeave: () => void; onStay: () => void }) {
  const open = student !== null
  const [who, setWho] = useState<Student | null>(student)
  if (student && student !== who) setWho(student)
  const openedAt = useRef(0)
  useLayoutEffect(() => {
    if (open) openedAt.current = performance.now()
  }, [open, student?.id])
  const shown = useLingerWhileClosing(open)
  if (!shown || !who) return null
  const tooSoon = (e: MouseEvent) => e.timeStamp - openedAt.current < TAP_GUARD_MS

  return (
    <Modal open={open} onClose={onStay} title={`${who.name}, get out of line?`}>
      <div className="flex flex-col items-center gap-4">
        <StudentPicture student={who} className="pointer-events-none size-[clamp(5rem,20vh,9rem)] select-none object-contain" />
        <div className="grid w-full grid-cols-2 gap-3">
          <TactileButton variant="danger" onClick={(e) => !tooSoon(e) && onLeave()} className={panelButton('')}>
            Get out
          </TactileButton>
          <TactileButton variant="primary" onClick={(e) => !tooSoon(e) && onStay()} className={panelButton('')}>
            Stay in line
          </TactileButton>
        </div>
      </div>
    </Modal>
  )
}
