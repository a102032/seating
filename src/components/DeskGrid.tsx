import { DESK_COLUMNS, DESK_COUNT, type Student } from '../types'
import { Desk, type DeskHighlight } from './Desk'

interface DeskGridProps {
  seating: (string | null)[]
  studentsById: Map<string, Student>
  swapMode: boolean
  selectedDesk: number | null
  deskHighlights: DeskHighlight[]
  onTapDesk: (index: number) => void
}

export function DeskGrid({ seating, studentsById, swapMode, selectedDesk, deskHighlights, onTapDesk }: DeskGridProps) {
  return (
    <div
      className="grid h-full w-full gap-2 sm:gap-3"
      style={{
        gridTemplateColumns: `repeat(${DESK_COLUMNS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(6, minmax(0, 1fr))`,
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
            swapMode={swapMode}
            selected={selectedDesk === index}
            highlight={deskHighlights[index] ?? 'none'}
            onTap={onTapDesk}
          />
        )
      })}
    </div>
  )
}
