import { Check } from 'lucide-react'
import { layoutPlan, planFor, rowChoices, rowCountOf, type Gap, type LayoutPlan, type RoomLayout } from '../lib/layouts'
import type { ClassData } from '../types'

interface LayoutPickerProps {
  cls: ClassData
  onSetLayout: (layout: RoomLayout, rows?: number) => void
}

/** The kinds of room, one picture each: Tables of 5 is one picture, its fifth desk a choice under it. */
type Kind = 'rows' | 'pairs' | 'threes' | 'tables4' | 'tables5'
const KINDS: Kind[] = ['rows', 'pairs', 'threes', 'tables4', 'tables5']
const KIND_LABELS: Record<Kind, string> = {
  rows: 'Rows',
  pairs: 'Pairs',
  threes: 'Rows of 3',
  tables4: 'Tables of 4',
  tables5: 'Tables of 5',
}
const kindOf = (layout: RoomLayout): Kind => (layout === 'tables5-top' || layout === 'tables5-bottom' ? 'tables5' : layout)
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

/**
 * The room from above: the layout's own desks, so a drawing can't disagree with the board. `filled`
 * is how many students sit there, the way Seat Students fills the room; the rest are drawn faded.
 */
function drawingOf(plan: LayoutPlan, filled: number): Drawing {
  const offsets = (count: number, gaps: Gap[], size: number) => {
    const at = [0]
    for (let i = 1; i < count; i++) at.push(at[i - 1] + size + GAP[gaps[i - 1]])
    return { at, total: at[count - 1] + size }
  }
  const x = offsets(plan.columns, plan.columnGaps, 1)
  const y = offsets(plan.rows, plan.rowGaps, DESK_DEPTH)
  const seated = new Set(plan.fillOrder.slice(0, filled))
  return {
    width: x.total,
    height: y.total,
    desks: plan.seats.map((seat, i) => {
      const whole = Math.floor(seat.column)
      // A table of five's end desk sits halfway across its table, half a desk and half the gap
      // along. Only it looks up the gap after its column: the last column has none, and that
      // lookup once put the last column of every drawing on top of the fourth.
      const left = seat.column === whole ? x.at[whole] : x.at[whole] + (seat.column - whole) * (1 + GAP[plan.columnGaps[whole]])
      return { x: left, y: y.at[seat.row], spare: !seated.has(i) }
    }),
  }
}

// Where thirty students sit: every kind of room is drawn as a class of thirty, so they can be
// compared desk for desk. Only Tables of 4 has more desks than that (nine tables, 36), and its six
// spare desks are drawn faded, as on the board.
const KIND_PLANS: Record<Kind, RoomLayout> = { rows: 'rows', pairs: 'pairs', threes: 'threes', tables4: 'tables4', tables5: 'tables5-top' }
const DRAWINGS = Object.fromEntries(KINDS.map((k) => [k, drawingOf(layoutPlan(KIND_PLANS[k], false), CLASS_SIZE)])) as Record<Kind, Drawing>
/** One frame for all of them, so a desk is the same size in every drawing and only the room changes. */
const VIEW_W = Math.max(...KINDS.map((k) => DRAWINGS[k].width)) + MARGIN * 2
const VIEW_H = Math.max(...KINDS.map((k) => DRAWINGS[k].height)) + MARGIN * 2

function LayoutDrawing({ drawing, fit, className = 'cs-pic-art' }: { drawing: Drawing; fit?: boolean; className?: string }) {
  const { width, height, desks } = drawing
  // The kinds share one frame; a choice under them is framed on its own room, so it fills its button.
  const w = fit ? width + MARGIN * 2 : VIEW_W
  const h = fit ? height + MARGIN * 2 : VIEW_H
  return (
    <span className={`${className} bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]`}>
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-full w-full" aria-hidden>
        <g transform={`translate(${(w - width) / 2} ${(h - height) / 2})`}>
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
 * classes can meet in different rooms. A change is immediate: between six or seven rows, Pairs and
 * Rows of 3 nobody moves, and otherwise the class keeps its order, back rows first. The drawings
 * are sized by the screen's height (Class Settings' pictures), so the Class section fits.
 *
 * A kind with a choice shows it beside the pictures, in the row's spare room (2026-10-30, the teacher: the app
 * goes to other schools, without every room in the menu): Rows, how many rows, each drawn with
 * this class's own students so a teacher sees their room; Tables of 5, where the fifth desk goes.
 */
export function LayoutPicker({ cls, onSetLayout }: LayoutPickerProps) {
  const layout = cls.layout ?? 'rows'
  const kind = kindOf(layout)
  const rows = rowCountOf(cls)
  const students = cls.students.length
  return (
    <div className="cs-rooms-wrap" data-guide="layouts">
      <div className="cs-pics cs-rooms">
        {KINDS.map((id) => {
          const active = id === kind
          return (
            <button
              key={id}
              type="button"
              className="cs-pic"
              onClick={() => onSetLayout(id === 'tables5' ? (kind === 'tables5' ? layout : 'tables5-top') : id)}
              aria-pressed={active}
            >
              <LayoutDrawing drawing={DRAWINGS[id]} />
              {active && (
                <span className="cs-tick">
                  <Check strokeWidth={3.5} />
                </span>
              )}
              <span>{KIND_LABELS[id]}</span>
            </button>
          )
        })}
      </div>
      {kind === 'rows' && (
        <div className="cs-room-choice" data-guide="row-count">
          <span>How many rows?</span>
          <div>
            {rowChoices(students, rows).map((n) => {
              const plan = planFor({ ...cls, layout: 'rows', rowCount: n, seating: [] })
              return (
                <button key={n} type="button" aria-pressed={n === rows} aria-label={`${n} rows`} onClick={() => onSetLayout('rows', n)}>
                  <LayoutDrawing drawing={drawingOf(plan, students || plan.seats.length)} fit className="cs-room-art" />
                  <b>{n}</b>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {kind === 'tables5' && (
        <div className="cs-room-choice" data-guide="row-count">
          <span>Fifth desk</span>
          <div className="cs-one-column">
            {(['tables5-top', 'tables5-bottom'] as const).map((id) => (
              <button key={id} type="button" aria-pressed={id === layout} onClick={() => onSetLayout(id)}>
                <LayoutDrawing drawing={drawingOf(layoutPlan(id, false), CLASS_SIZE)} fit className="cs-room-art" />
                <b>{id === 'tables5-top' ? 'On top' : 'Below'}</b>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
