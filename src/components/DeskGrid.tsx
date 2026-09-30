import { useEffect, useMemo, useState } from 'react'
import { fitClassNameSize } from '../lib/fitText'
import type { Gap, LayoutPlan } from '../lib/layouts'
import { DESK_ROWS, desksInOrder, type Student } from '../types'
import { Desk, type DeskHighlight } from './Desk'

/** A gap as a grid track. The even gap and the aisle grow a step on a bigger screen, as the grid's gap always has. */
function track(gap: Gap): string {
  return gap === 'touch' ? '3px' : gap === 'aisle' ? 'var(--aisle)' : 'var(--gap)'
}

/** Desk tracks with a gap track between each pair, so a layout can mix gaps and aisles. */
function template(count: number, gaps: Gap[]): string {
  return Array.from({ length: count }, (_, i) => (i < count - 1 ? `minmax(0, 1fr) ${track(gaps[i])}` : 'minmax(0, 1fr)')).join(' ')
}

interface DeskGridProps {
  seating: (string | null)[]
  /** Where the desks stand (lib/layouts). */
  plan: LayoutPlan
  studentsById: Map<string, Student>
  selectedDesk: number | null
  /** Student ids currently selected for a points action. */
  pointsSelection: Set<string>
  /** 0 while no points have landed on this selection; otherwise bumped per award. */
  landedTick: number
  /** Whether this selection arrived all at once (Select All), which ripples rather than twitches. */
  staggerWiggle: boolean
  deskHighlights: DeskHighlight[]
  /** Students marked absent today. */
  absentIds: Set<string>
  onTapDesk: (index: number) => void
}

export function DeskGrid({ seating, plan, studentsById, selectedDesk, pointsSelection, landedTick, staggerWiggle, deskHighlights, absentIds, onTapDesk }: DeskGridProps) {
  const seated = seating.map((id) => (id ? studentsById.get(id) : undefined))

  // While a picker is flashing or showing its winner it owns the board's attention, so the
  // points selection stands down rather than dimming on top of the picker's own dimming.
  const pickerOwnsBoard = deskHighlights.some((h) => h !== 'none')
  const showSelection = !pickerOwnsBoard && pointsSelection.size > 0

  // With every student selected nothing is left to dim, so those desks shiver instead.
  const seatedStudents = seated.filter((s): s is Student => s !== undefined)
  const everyoneSelected =
    showSelection && seatedStudents.length > 0 && seatedStudents.every((s) => pointsSelection.has(s.id))

  // Names are measured in Andika. If it arrives after the desks are first drawn (a first
  // visit, a slow connection) they were sized in the stand-in face, a size too small, and
  // stayed that way until something else redrew the board.
  const [fontsLoaded, setFontsLoaded] = useState(0)
  useEffect(() => {
    const fonts = document.fonts
    if (!fonts) return
    const refit = () => setFontsLoaded((n) => n + 1)
    fonts.addEventListener('loadingdone', refit)
    return () => fonts.removeEventListener('loadingdone', refit)
  }, [])

  // One size for every desk, so no student's name ends up visibly smaller than the rest.
  // Measured once per roster rather than on every tap.
  const names = seatedStudents.map((s) => s.name).join('\n')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nameSize = useMemo(() => fitClassNameSize(names ? names.split('\n') : []), [names, fontsLoaded])

  const renderDesk = (index: number, position: number) => {
    const student = seated[index]
    const inSelection = student !== undefined && pointsSelection.has(student.id)
    return (
      <Desk
        key={index}
        index={index}
        student={student}
        selected={selectedDesk === index}
        pointsState={
          // Points can land on a picker's winner too, so the pop is decided before the
          // dimming is - the picker keeps the board, the desk still reacts.
          inSelection && landedTick > 0
            ? 'landed'
            : !showSelection
              ? 'none'
              : inSelection
                ? 'selected'
                : 'muted'
        }
        wiggleDelayMs={showSelection && inSelection && staggerWiggle ? position * 18 : 0}
        landedTick={landedTick}
        wiggleLoop={everyoneSelected && inSelection}
        highlight={deskHighlights[index] ?? 'none'}
        absent={student !== undefined && absentIds.has(student.id)}
        nameSize={nameSize}
        onTap={onTapDesk}
      />
    )
  }

  // Rows is drawn exactly as the board always was, so a class that never picks a layout sees
  // no change at all.
  if (plan.kind === 'rows') {
    return (
      <div
        className="grid h-full w-full gap-2 p-2.5 sm:gap-3 sm:p-3"
        style={{
          gridTemplateColumns: `repeat(${plan.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${DESK_ROWS}, minmax(0, 1fr))`,
        }}
      >
        {desksInOrder(plan.columns).map(renderDesk)}
      </div>
    )
  }

  // The other layouts put a track between every column and row: 3px where desks are pushed
  // together, an aisle between tables. A table of five's end desk spans its table's two columns
  // and is one desk wide, centred.
  const readingOrder = plan.seats
    .map((seat, index) => ({ seat, index }))
    .sort((a, b) => a.seat.row - b.seat.row || a.seat.column - b.seat.column)
  return (
    <div
      className="grid h-full w-full p-2.5 [--aisle:1rem] [--gap:0.5rem] sm:p-3 sm:[--aisle:1.5rem] sm:[--gap:0.75rem]"
      style={{
        gridTemplateColumns: template(plan.columns, plan.columnGaps),
        gridTemplateRows: template(plan.rows, plan.rowGaps),
      }}
    >
      {readingOrder.map(({ seat, index }, position) => {
        const whole = Math.floor(seat.column)
        const centred = seat.column !== whole
        return (
          <div
            key={index}
            className="min-h-0 min-w-0"
            style={{
              gridRow: 2 * seat.row + 1,
              gridColumn: centred ? `${2 * whole + 1} / span 3` : 2 * whole + 1,
              justifySelf: centred ? 'center' : undefined,
              width: centred ? `calc((100% - ${track(plan.columnGaps[whole])}) / 2)` : undefined,
            }}
          >
            {renderDesk(index, position)}
          </div>
        )
      })}
    </div>
  )
}
