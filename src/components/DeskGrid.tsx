import { fitClassNameSize } from '../lib/fitText'
import { DESK_COLUMNS, DESK_COUNT, DESK_ROWS, type Student } from '../types'
import { Desk, type DeskHighlight, type DeskPointsState } from './Desk'

interface DeskGridProps {
  seating: (string | null)[]
  studentsById: Map<string, Student>
  selectedDesk: number | null
  /** Student ids currently selected for a points action. */
  pointsSelection: Set<string>
  /** What the current selection is doing: still being chosen, or just awarded/deducted. */
  pointsPhase: Exclude<DeskPointsState, 'none'>
  deskHighlights: DeskHighlight[]
  onTapDesk: (index: number) => void
}

export function DeskGrid({ seating, studentsById, selectedDesk, pointsSelection, pointsPhase, deskHighlights, onTapDesk }: DeskGridProps) {
  const seated = seating.map((id) => (id ? studentsById.get(id) : undefined))

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
        return (
          <Desk
            key={index}
            index={index}
            student={student}
            selected={selectedDesk === index}
            pointsState={student !== undefined && pointsSelection.has(student.id) ? pointsPhase : 'none'}
            highlight={deskHighlights[index] ?? 'none'}
            nameSize={nameSize}
            onTap={onTapDesk}
          />
        )
      })}
    </div>
  )
}
