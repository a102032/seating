import { fitClassNameSize } from '../lib/fitText'
import { DESK_COLUMNS, DESK_COUNT, DESK_ROWS, type Student } from '../types'
import { Desk, type DeskHighlight } from './Desk'

interface DeskGridProps {
  seating: (string | null)[]
  studentsById: Map<string, Student>
  selectedDesk: number | null
  /** Student ids currently selected for a points action. */
  pointsSelection: Set<string>
  /** 0 while no points have landed on this selection; otherwise bumped per award. */
  landedTick: number
  /** Whether this selection arrived all at once (Select All), which ripples rather than twitches. */
  staggerWiggle: boolean
  deskHighlights: DeskHighlight[]
  onTapDesk: (index: number) => void
}

export function DeskGrid({ seating, studentsById, selectedDesk, pointsSelection, landedTick, staggerWiggle, deskHighlights, onTapDesk }: DeskGridProps) {
  const seated = seating.map((id) => (id ? studentsById.get(id) : undefined))

  // While a picker is flashing or showing its winner it owns the board's attention, so the
  // points selection stands down rather than dimming on top of the picker's own dimming.
  const pickerOwnsBoard = deskHighlights.some((h) => h !== 'none')
  const showSelection = !pickerOwnsBoard && pointsSelection.size > 0

  // One size for every desk, so no student's name ends up visibly smaller than the rest.
  const nameSize = fitClassNameSize(seated.filter((s): s is Student => s !== undefined).map((s) => s.name))

  return (
    <div
      className="grid h-full w-full gap-2 p-2.5 sm:gap-3 sm:p-3"
      style={{
        gridTemplateColumns: `repeat(${DESK_COLUMNS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${DESK_ROWS}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: DESK_COUNT }, (_, index) => {
        const student = seated[index]
        const inSelection = student !== undefined && pointsSelection.has(student.id)
        return (
          <Desk
            key={index}
            index={index}
            student={student}
            selected={selectedDesk === index}
            pointsState={
              !showSelection ? 'none' : !inSelection ? 'muted' : landedTick > 0 ? 'landed' : 'selected'
            }
            wiggleDelayMs={showSelection && inSelection && staggerWiggle ? index * 18 : 0}
            landedTick={landedTick}
            highlight={deskHighlights[index] ?? 'none'}
            nameSize={nameSize}
            onTap={onTapDesk}
          />
        )
      })}
    </div>
  )
}
