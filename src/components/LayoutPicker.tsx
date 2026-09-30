import { Check } from 'lucide-react'
import clsx from 'clsx'
import { ROOM_LAYOUTS, layoutPlan, type Gap, type RoomLayout } from '../lib/layouts'

interface LayoutPickerProps {
  layout: RoomLayout
  onSetLayout: (layout: RoomLayout) => void
}

const LABELS: Record<RoomLayout, [string, string?]> = {
  rows: ['Rows'],
  pairs: ['Pairs'],
  threes: ['Rows of 3'],
  tables4: ['Tables of 4'],
  'tables5-top': ['Tables of 5', '5th desk on top'],
  'tables5-bottom': ['Tables of 5', '5th desk below'],
}

/**
 * Gaps in a drawing, as a share of a desk. Wider than the board's own, so the pairs and tables
 * read at thumbnail size.
 */
const GAP: Record<Gap, number> = { touch: 0.08, even: 0.28, aisle: 0.6 }

/** The room from above: the layout's own desks, so a drawing can't disagree with the board. */
function LayoutDrawing({ layout }: { layout: RoomLayout }) {
  const plan = layoutPlan(layout, false)
  const offsets = (count: number, gaps: Gap[]) => {
    const at = [0]
    for (let i = 1; i < count; i++) at.push(at[i - 1] + 1 + GAP[gaps[i - 1]])
    return { at, total: at[count - 1] + 1 }
  }
  const x = offsets(plan.columns, plan.columnGaps)
  const y = offsets(plan.rows, plan.rowGaps)
  return (
    <span className="relative block h-[4.75rem] w-full overflow-hidden rounded-lg bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]">
      <span className="absolute inset-[9%]">
        {plan.seats.map((seat, i) => {
          const whole = Math.floor(seat.column)
          const left = x.at[whole] + (seat.column - whole) * (1 + GAP[plan.columnGaps[whole]])
          return (
            <span
              key={i}
              className="absolute rounded-t-[2px] bg-card shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)]"
              style={{
                left: `${(left / x.total) * 100}%`,
                top: `${(y.at[seat.row] / y.total) * 100}%`,
                width: `${(1 / x.total) * 100}%`,
                height: `${(1 / y.total) * 100}%`,
              }}
            />
          )
        })}
      </span>
    </span>
  )
}

/**
 * How the desks stand in this room, picked from drawings the way a theme is. Per class, since
 * classes can meet in different rooms. A change is immediate: between Rows, Pairs and Rows of 3
 * nobody moves, and into or out of tables the class keeps its order, back rows first.
 */
export function LayoutPicker({ layout, onSetLayout }: LayoutPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {ROOM_LAYOUTS.map((id) => {
        const active = id === layout
        const [label, detail] = LABELS[id]
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSetLayout(id)}
            aria-pressed={active}
            className={clsx(
              'relative flex flex-col items-center gap-1 rounded-xl border-2 p-1 transition-colors active:scale-[0.97]',
              active ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/60',
            )}
          >
            <LayoutDrawing layout={id} />
            {active && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                <Check size={13} strokeWidth={3} />
              </span>
            )}
            <span className="text-center text-xs leading-tight font-semibold text-foreground">
              {label}
              {detail && <span className="block font-normal text-muted-foreground">{detail}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
