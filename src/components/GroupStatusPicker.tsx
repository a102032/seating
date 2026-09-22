import clsx from 'clsx'
import { animate, motion } from 'framer-motion'
import { Check, CircleHelp, Pencil, ThumbsUp, type LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { groupTextColor } from '../lib/groups'
import type { GroupStatus, Student, StudentGroup } from '../types'

export interface StatusStyle {
  id: GroupStatus
  label: string
  icon: LucideIcon
  /** The status colour, fixed on every theme. */
  color: string
  /** Text and icon colour on top of `color`. */
  fg: string
  /**
   * The wash laid over the card's body. Strong on purpose: this is read across a classroom,
   * not at arm's length, and a faint tint was indistinguishable from the next card at the
   * back of the room. The name chips sit on the plain card colour so they stay crisp on top
   * of it. Working has none: if every card were tinted the board would go one flat colour
   * and the signal would be worth nothing.
   */
  wash: string | null
}

/**
 * The four states, in the order work actually goes. Icons are chosen to be read without
 * English: a question mark survives any size where a raised hand turns to mush, and a
 * thumbs up needs no teaching where a flag does.
 */
export const STATUSES: StatusStyle[] = [
  { id: 'working', label: 'Working', icon: Pencil, color: '#64748b', fg: '#ffffff', wash: null },
  { id: 'help', label: 'Help', icon: CircleHelp, color: '#ef4444', fg: '#ffffff', wash: 'rgba(239, 68, 68, 0.72)' },
  { id: 'ready', label: 'Ready', icon: ThumbsUp, color: '#f59e0b', fg: '#451a03', wash: 'rgba(245, 158, 11, 0.8)' },
  { id: 'done', label: 'Done', icon: Check, color: '#22c55e', fg: '#ffffff', wash: 'rgba(34, 197, 94, 0.72)' },
]

export function statusStyle(status: GroupStatus | undefined): StatusStyle {
  return STATUSES.find((s) => s.id === (status ?? 'working')) ?? STATUSES[0]
}

interface GroupStatusPickerProps {
  group: StudentGroup
  studentsById: Map<string, Student>
  /** The card's own chip width, so the copy that flies down matches the card it came from. */
  chipEm: number
  /** Where the card sits on the board right now - the start of the flight. */
  from: DOMRect
  onChoose: (status: GroupStatus) => void
  onClose: () => void
}

interface Flight {
  x: number
  y: number
  scale: number
}

/**
 * Choosing a group's status.
 *
 * It is a panel low on the screen rather than buttons on the card, because a card in the top
 * row of a smartboard is two metres up and a small card would mean small buttons - both
 * worst for the shortest student, who needs this most. The card flies down to meet the
 * buttons, so nothing has to say which group is being changed.
 *
 * There is no close button and no instructions. The group's current status is one of the
 * four choices and is shown as already chosen, so a child who opened this by accident taps
 * the lit one and nothing happens. Tapping outside closes it too.
 */
export function GroupStatusPicker({ group, studentsById, chipEm, from, onChoose, onClose }: GroupStatusPickerProps) {
  const portraitRef = useRef<HTMLDivElement>(null)
  const flightRef = useRef<Flight | null>(null)
  const [closing, setClosing] = useState(false)
  /** The status just tapped, so the card flies home already wearing its new colour. */
  const [chosen, setChosen] = useState<GroupStatus | null>(null)

  const style = statusStyle(chosen ?? group.status)
  const fg = groupTextColor(group.color)

  // Measured before paint, so the copy starts exactly where the real card is and there is no
  // frame where it appears in the wrong place.
  useLayoutEffect(() => {
    const el = portraitRef.current
    if (!el) return
    const to = el.getBoundingClientRect()
    if (!to.width) return
    const flight: Flight = {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      scale: from.width / to.width,
    }
    flightRef.current = flight
    void animate(el, { x: [flight.x, 0], y: [flight.y, 0], scale: [flight.scale, 1] }, { type: 'spring', stiffness: 260, damping: 30 })
  }, [from])

  function flyHome() {
    if (closing) return
    setClosing(true)
    const el = portraitRef.current
    const flight = flightRef.current
    if (el && flight) {
      void animate(el, { x: flight.x, y: flight.y, scale: flight.scale, opacity: 0 }, { type: 'spring', stiffness: 320, damping: 34 })
    }
    setTimeout(onClose, 300)
  }

  function choose(status: GroupStatus) {
    if (closing) return
    onChoose(status)
    setChosen(status)
    flyHome()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end" onClick={flyHome}>
      {/* The blur is what makes the panel feel lifted. The panel itself stays solid: two
          translucent layers read as muddy, and these are the buttons that matter most to a
          child who is stuck, on a screen a projector has already washed out. */}
      <motion.div
        className="absolute inset-0 bg-black/35 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: closing ? 0.2 : 0.22 }}
      />

      <div className="relative flex w-full flex-col items-center gap-4 px-4 pb-[7vh]">
        {/* A copy of the card, at one size whatever the group's size, so the buttons always
            land in the same place and a big group never pushes them out of reach. */}
        <div
          ref={portraitRef}
          onClick={(e) => e.stopPropagation()}
          className="flex w-[clamp(15rem,30vw,22rem)] flex-col overflow-hidden rounded-2xl border-[3px] bg-card text-card-foreground shadow-2xl"
          style={{ borderColor: group.color }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-1.5" style={{ background: group.color, color: fg }}>
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold leading-tight">{group.name}</span>
            {/* The same status pill the card wears, so the copy that flies down is the card. */}
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-1.5 py-1 text-sm font-bold whitespace-nowrap">
              <style.icon size={15} strokeWidth={2.75} />
              {style.label}
            </span>
          </div>
          <div className="flex flex-wrap content-start justify-center gap-1.5 p-2" style={{ background: style.wash ?? undefined }}>
            {group.studentIds.map((id) => {
              const student = studentsById.get(id)
              if (!student) return null
              return (
                <span
                  key={id}
                  className={clsx(
                    'flex h-[2.25em] items-center justify-center gap-[0.35em] overflow-hidden rounded-full px-[0.8em] text-sm font-bold leading-tight',
                    style.wash !== null && 'bg-card',
                  )}
                  style={{ width: `${chipEm}em`, background: style.wash === null ? `${group.color}22` : undefined, fontSize: '0.85rem' }}
                >
                  <span className="shrink-0 text-[0.72em] font-semibold opacity-50">{student.homeroom}</span>
                  <span className="whitespace-nowrap">{student.name}</span>
                </span>
              )
            })}
          </div>
        </div>

        {/* One row, left to right, in the order work goes - a two by two grid leaves a child
            guessing whether to read across or down. Every button wears its own colour, so the
            code is taught every time it is opened. */}
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: closing ? 0 : 1, y: closing ? 24 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="flex w-full max-w-[64rem] gap-2 sm:gap-3"
        >
          {STATUSES.map((status) => {
            const current = (chosen ?? group.status ?? 'working') === status.id
            const Icon = status.icon
            return (
              <button
                key={status.id}
                type="button"
                data-slot="button"
                data-status-choice={status.id}
                data-current={current || undefined}
                onClick={() => choose(status.id)}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-4 font-extrabold shadow-lg transition-transform active:scale-95 sm:py-5',
                  current && 'scale-[1.04]',
                )}
                style={{
                  background: status.color,
                  color: status.fg,
                  boxShadow: current ? `0 0 0 4px ${status.fg}, 0 0 0 7px ${status.color}` : undefined,
                  touchAction: 'manipulation',
                }}
              >
                <Icon size={34} strokeWidth={2.75} />
                <span style={{ fontSize: 'clamp(1rem, 2.1vmin, 1.5rem)' }}>{status.label}</span>
              </button>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
