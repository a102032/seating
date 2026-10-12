import clsx from 'clsx'
import { Check, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { textWidthEm } from '../lib/fitText'
import { GROUP_COLORS, groupTextColor } from '../lib/groups'
import type { Gap, LayoutPlan } from '../lib/layouts'
import type { Student } from '../types'
import { AbsentIcon } from './AbsentIcon'
import { TactileButton } from './TactileButton'

interface GroupBuilderProps {
  plan: LayoutPlan
  /** Everyone at a desk, away today too: groups chosen ahead of time are for the whole class. */
  seating: (string | null)[]
  studentsById: Map<string, Student>
  absentIds: Set<string>
  /** Students whose homeroom shows after their name, as on the desks (lib/sameNames). */
  homerooms: Set<string>
  /** How many frames, from the choice made: "6 groups", or half the class for pairs. */
  groupCount: number
  /** Pairs: once a pair has its two, the next pair lights by itself. */
  pairs: boolean
  /** The choice in the window's own words, "6 groups" or "Pairs". */
  title: string
  onStart: (members: string[][]) => void
  onCancel: () => void
}

/** The room drawn small: desks one unit wide, with the layout's own gaps between them. */
const GAP_UNITS: Record<Gap, number> = { even: 0.12, touch: 0.03, aisle: 0.4 }

/** Where each column (or row) of desks starts, in desk widths. A fraction (a table of five's end desk) sits part way to the next. */
function positions(count: number, gaps: Gap[]): { at: (n: number) => number; total: number } {
  const starts = [0]
  for (let i = 1; i < count; i++) starts.push(starts[i - 1] + 1 + GAP_UNITS[gaps[i - 1] ?? 'even'])
  return {
    at: (n) => {
      const base = Math.min(count - 1, Math.floor(n))
      return starts[base] + (n - base) * (1 + GAP_UNITS[gaps[base] ?? 'even'])
    },
    total: starts[count - 1] + 1,
  }
}

/** Names in the frames shrink, a pixel at a time, until every frame holds its own: the screen never scrolls. */
const FRAME_FONT_MAX = 19
const FRAME_FONT_MIN = 10
/** The board reads one touch as two: after a name leaves a frame, the next one slides under the same finger. */
const CHIP_GUARD_MS = 600

/**
 * "I'll choose" (2026-10-12, the teacher): the class's desks drawn small, names only, on one side
 * and the groups' frames on the other. One frame is lit; a tap on a name sends it there, and a tap
 * on a frame lights that one instead. With pairs, a pair that has its two lights the next one by
 * itself, so pairing a class is one tap a student. A name tapped in a frame goes back to its desk. Start waits until everyone has a group, so no child is left without one.
 */
export function GroupBuilder({
  plan,
  seating,
  studentsById,
  absentIds,
  homerooms,
  groupCount,
  pairs,
  title,
  onStart,
  onCancel,
}: GroupBuilderProps) {
  const seated = useMemo(
    () =>
      seating.map((id, desk) => ({ id, desk })).filter((s): s is { id: string; desk: number } => Boolean(s.id && studentsById.has(s.id))),
    [seating, studentsById],
  )
  const total = seated.length
  const frames = Math.max(1, Math.min(groupCount, total))
  // Each frame's even share, the larger shares last: with pairs and an odd class, the last pair is the three.
  const targets = useMemo(
    () => Array.from({ length: frames }, (_, i) => Math.floor(total / frames) + (i >= frames - (total % frames) ? 1 : 0)),
    [frames, total],
  )
  const [members, setMembers] = useState<string[][]>(() => Array.from({ length: frames }, () => []))
  const [lit, setLit] = useState(0)
  const lastChipTap = useRef(0)
  const groupOf = useMemo(() => {
    const out = new Map<string, number>()
    members.forEach((m, i) => m.forEach((id) => out.set(id, i)))
    return out
  }, [members])
  const left = total - groupOf.size

  function place(studentId: string) {
    if (groupOf.has(studentId)) return
    const next = members.map((m, i) => (i === lit ? [...m, studentId] : m))
    setMembers(next)
    // Pairs: the lit pair just got its two, so on to the next pair that needs someone. Only for
    // pairs: rows of five and four would send a row's fifth name into the next group.
    if (pairs && next[lit].length === targets[lit]) {
      for (let step = 1; step < frames; step++) {
        const i = (lit + step) % frames
        if (next[i].length < targets[i]) {
          setLit(i)
          break
        }
      }
    }
  }

  function sendBack(studentId: string) {
    const now = performance.now()
    if (now - lastChipTap.current < CHIP_GUARD_MS) return
    lastChipTap.current = now
    setMembers((all) => all.map((m) => m.filter((id) => id !== studentId)))
  }

  // The room's shape, measured so the names can be sized to the desks.
  const across = positions(plan.columns, plan.columnGaps)
  const down = positions(plan.rows, plan.rowGaps)
  const chartRef = useRef<HTMLDivElement>(null)
  const framesRef = useRef<HTMLDivElement>(null)
  const [chart, setChart] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = chartRef.current
    if (!el) return
    const update = () => setChart({ width: el.clientWidth, height: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const label = (s: Student, id: string) => ({ name: s.name, homeroom: homerooms.has(id) ? s.homeroom : '' })
  // One name size for the whole room, from its longest name, as on the board's desks.
  const longest = Math.max(
    3,
    ...seated.map(({ id }) => {
      const l = label(studentsById.get(id)!, id)
      return textWidthEm(l.name) + (l.homeroom ? textWidthEm(l.homeroom) * 0.62 + 0.25 : 0)
    }),
  )
  const deskW = chart.width / across.total
  const deskH = chart.height / down.total
  const deskFont = Math.max(9, Math.min(24, (deskW * 0.86) / longest, deskH * 0.42))

  // Every frame holds its names: start big and come down until none of them overflows.
  useLayoutEffect(() => {
    const el = framesRef.current
    if (!el) return
    const overflows = () =>
      [...el.querySelectorAll<HTMLElement>('[data-frame-body]')].some((body) => body.scrollHeight > body.clientHeight + 1)
    let size = FRAME_FONT_MAX
    el.style.setProperty('--frame-font', `${size}px`)
    while (size > FRAME_FONT_MIN && overflows()) {
      size -= 1
      el.style.setProperty('--frame-font', `${size}px`)
    }
  })

  const columns = frames <= 3 ? frames : frames === 4 ? 2 : 3
  const rows = Math.ceil(frames / columns)

  return (
    <div
      data-ink="board"
      data-group-builder=""
      className="fixed inset-0 z-[25] flex flex-col gap-2 bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-2"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm">
        <div className="min-w-0">
          <div className="font-bold text-card-foreground" style={{ fontSize: 'clamp(0.95rem, 2vmin, 1.25rem)' }}>
            Tap a group, then tap its students.
          </div>
          <div className="text-sm text-muted-foreground">
            {title} · {left === 0 ? 'Everyone has a group.' : `${left} ${left === 1 ? 'student' : 'students'} to go.`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TactileButton onClick={onCancel} className="!px-3 !py-2">
            <X size={16} /> Cancel
          </TactileButton>
          <TactileButton
            active={left === 0}
            disabled={left > 0}
            onClick={() => onStart(members)}
            className="!px-4 !py-2"
            title={left > 0 ? 'Put everyone in a group first' : 'Start the groups'}
          >
            <Check size={16} /> Start
          </TactileButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {/* The room, small: who is still to place, where they sit. */}
        <div className="flex min-h-0 min-w-0 flex-1 rounded-2xl border border-border bg-card/50 p-2">
          <div ref={chartRef} data-builder-chart="" className="relative min-h-0 min-w-0 flex-1">
            {plan.seats.map((seat, desk) => {
              const id = seating[desk]
              const student = id ? studentsById.get(id) : undefined
              const style = {
                left: `${(across.at(seat.column) / across.total) * 100}%`,
                top: `${(down.at(seat.row) / down.total) * 100}%`,
                width: `${(1 / across.total) * 100}%`,
                height: `${(1 / down.total) * 100}%`,
                padding: 2,
              }
              if (!id || !student) {
                return (
                  <div key={desk} className="absolute" style={style}>
                    <div className="h-full w-full rounded-lg border border-dashed border-border/60" />
                  </div>
                )
              }
              const inGroup = groupOf.get(id)
              if (inGroup !== undefined) {
                // Moved over: the desk is left empty, with its group's colour as a small mark.
                return (
                  <div key={desk} className="absolute" style={style}>
                    <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border/70">
                      <span
                        className="size-2.5 rounded-full opacity-70"
                        style={{ background: GROUP_COLORS[inGroup % GROUP_COLORS.length].bg }}
                      />
                    </div>
                  </div>
                )
              }
              const l = label(student, id)
              return (
                <div key={desk} className="absolute" style={style}>
                  <button
                    type="button"
                    data-student-id={id}
                    onClick={() => place(id)}
                    className={clsx(
                      'relative flex h-full w-full items-center justify-center gap-[0.25em] rounded-lg bg-card px-1 font-bold text-card-foreground shadow-sm ring-1 ring-black/10 active:scale-95 dark:ring-white/15',
                      absentIds.has(id) && 'opacity-60',
                    )}
                    style={{ fontSize: deskFont, touchAction: 'manipulation' }}
                    title={`Put ${student.name} in Group ${lit + 1}`}
                  >
                    {absentIds.has(id) && <AbsentIcon className="absolute top-0.5 left-1 h-[0.8em] w-[0.8em] text-muted-foreground" />}
                    <span className="whitespace-nowrap">{l.name}</span>
                    {l.homeroom && <span className="text-[0.62em] font-semibold opacity-50">{l.homeroom}</span>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* The groups. The lit one is where the next name goes. */}
        <div
          ref={framesRef}
          className="grid min-h-0 min-w-0 flex-1 gap-2"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            ['--frame-font' as string]: `${FRAME_FONT_MAX}px`,
          }}
        >
          {members.map((ids, i) => {
            const color = GROUP_COLORS[i % GROUP_COLORS.length].bg
            const fg = groupTextColor(color)
            const isLit = i === lit
            return (
              <section
                key={i}
                data-frame={i}
                onClick={() => setLit(i)}
                className={clsx(
                  'flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-2xl border-[3px] bg-card text-card-foreground shadow-md transition-[box-shadow,scale] duration-200',
                  isLit && 'z-10 scale-[1.02] ring-4 ring-amber-400',
                )}
                style={{ borderColor: color, touchAction: 'manipulation' }}
              >
                <header
                  className="flex shrink-0 items-center justify-between gap-2 px-2.5 py-1 font-extrabold"
                  style={{ background: color, color: fg, fontSize: 'calc(var(--frame-font) * 0.95)' }}
                >
                  <span className="truncate">Group {i + 1}</span>
                  <span className="tabular-nums opacity-90">{ids.length}</span>
                </header>
                <div data-frame-body="" className="flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-hidden p-1.5">
                  {ids.map((id) => {
                    const s = studentsById.get(id)
                    if (!s) return null
                    const l = label(s, id)
                    return (
                      <button
                        key={id}
                        type="button"
                        data-chip-id={id}
                        onClick={(e) => {
                          e.stopPropagation()
                          sendBack(id)
                        }}
                        title={`Send ${s.name} back`}
                        className={clsx(
                          'flex h-[1.9em] shrink-0 items-center gap-[0.3em] rounded-full px-[0.7em] font-bold shadow-sm active:scale-95',
                          absentIds.has(id) && 'opacity-60',
                        )}
                        style={{ fontSize: 'var(--frame-font)', background: `${color}22`, touchAction: 'manipulation' }}
                      >
                        <span className="whitespace-nowrap">{l.name}</span>
                        {l.homeroom && <span className="text-[0.62em] font-semibold opacity-50">{l.homeroom}</span>}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
