import { Check } from 'lucide-react'
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
  'tables5-top': ['Tables of 5', '5th on top'],
  'tables5-bottom': ['Tables of 5', '5th below'],
}

/**
 * Gaps in a drawing, as a share of a desk's width. Far wider than the board's own, so pairs and
 * tables read at thumbnail size: desks pushed together share an edge, and an aisle is plain.
 */
const GAP: Record<Gap, number> = { touch: 0, even: 0.3, aisle: 0.75 }
/** A desk a little wider than it is deep, as on the board. */
const DESK_DEPTH = 0.78
/** Every drawing is a class of thirty, so they can be compared desk for desk. */
const CLASS_SIZE = 30
const MARGIN = 0.5

interface Drawing {
  width: number
  height: number
  desks: { x: number; y: number; spare: boolean }[]
}

/** The room from above: the layout's own desks, so a drawing can't disagree with the board. */
function drawingOf(layout: RoomLayout): Drawing {
  const plan = layoutPlan(layout, false)
  const offsets = (count: number, gaps: Gap[], size: number) => {
    const at = [0]
    for (let i = 1; i < count; i++) at.push(at[i - 1] + size + GAP[gaps[i - 1]])
    return { at, total: at[count - 1] + size }
  }
  const x = offsets(plan.columns, plan.columnGaps, 1)
  const y = offsets(plan.rows, plan.rowGaps, DESK_DEPTH)
  // Where thirty students sit, the way Seat Students fills the room. Only Tables of 4 has more
  // desks than that (nine tables, 36), and its six spare desks are drawn faded, as on the board.
  const filled = new Set(plan.fillOrder.slice(0, CLASS_SIZE))
  return {
    width: x.total,
    height: y.total,
    desks: plan.seats.map((seat, i) => {
      const whole = Math.floor(seat.column)
      // A table of five's end desk sits halfway across its table, half a desk and half the gap
      // along. Only it looks up the gap after its column: the last column has none, and that
      // lookup once put the last column of every drawing on top of the fourth.
      const left = seat.column === whole ? x.at[whole] : x.at[whole] + (seat.column - whole) * (1 + GAP[plan.columnGaps[whole]])
      return { x: left, y: y.at[seat.row], spare: !filled.has(i) }
    }),
  }
}

const DRAWINGS = Object.fromEntries(ROOM_LAYOUTS.map((id) => [id, drawingOf(id)])) as Record<RoomLayout, Drawing>
/** One frame for all six, so a desk is the same size in every drawing and only the room changes. */
const VIEW_W = Math.max(...ROOM_LAYOUTS.map((id) => DRAWINGS[id].width)) + MARGIN * 2
const VIEW_H = Math.max(...ROOM_LAYOUTS.map((id) => DRAWINGS[id].height)) + MARGIN * 2

function LayoutDrawing({ layout }: { layout: RoomLayout }) {
  const { width, height, desks } = DRAWINGS[layout]
  return (
    <span className="cs-pic-art bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block h-full w-full" aria-hidden>
        <g transform={`translate(${(VIEW_W - width) / 2} ${(VIEW_H - height) / 2})`}>
          {desks.map((desk, i) => (
            <rect
              key={i}
              x={desk.x}
              y={desk.y}
              width={1}
              height={DESK_DEPTH}
              rx={0.14}
              vectorEffect="non-scaling-stroke"
              className={desk.spare ? 'layout-desk layout-desk-spare' : 'layout-desk'}
            />
          ))}
        </g>
      </svg>
    </span>
  )
}

/**
 * How the desks stand in this room, picked from drawings the way a theme is. Per class, since
 * classes can meet in different rooms. A change is immediate: between Rows, Pairs and Rows of 3
 * nobody moves, and into or out of tables the class keeps its order, back rows first. The
 * drawings are sized by the screen's height (Class Settings' pictures), so the Class section fits.
 */
export function LayoutPicker({ layout, onSetLayout }: LayoutPickerProps) {
  return (
    <div className="cs-pics cs-rooms cs-fill" data-guide="layouts">
      {ROOM_LAYOUTS.map((id) => {
        const active = id === layout
        const [label, detail] = LABELS[id]
        return (
          <button key={id} type="button" className="cs-pic" onClick={() => onSetLayout(id)} aria-pressed={active}>
            <LayoutDrawing layout={id} />
            {active && (
              <span className="cs-tick">
                <Check strokeWidth={3.5} />
              </span>
            )}
            <span>
              {label}
              {detail && <small>{detail}</small>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
