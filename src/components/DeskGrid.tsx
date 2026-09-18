import { DESK_COLUMNS, DESK_COUNT, DESK_ROWS, type Student } from '../types'
import { Desk, type DeskHighlight } from './Desk'

interface DeskGridProps {
  seating: (string | null)[]
  studentsById: Map<string, Student>
  selectedDesk: number | null
  /** Student ids currently selected for a points action. */
  pointsSelection: Set<string>
  deskHighlights: DeskHighlight[]
  onTapDesk: (index: number) => void
}

export function DeskGrid({ seating, studentsById, selectedDesk, pointsSelection, deskHighlights, onTapDesk }: DeskGridProps) {
  return (
    <div
      className="grid h-full w-full gap-2 sm:gap-3"
      style={{
        gridTemplateColumns: `repeat(${DESK_COLUMNS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${DESK_ROWS}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: DESK_COUNT }, (_, index) => {
        const studentId = seating[index]
        const student = studentId ? studentsById.get(studentId) : undefined
        return (
          <Desk
            key={index}
            index={index}
            student={student}
            selected={selectedDesk === index}
            pointsSelected={student !== undefined && pointsSelection.has(student.id)}
            highlight={deskHighlights[index] ?? 'none'}
            onTap={onTapDesk}
          />
        )
      })}
    </div>
  )
}
