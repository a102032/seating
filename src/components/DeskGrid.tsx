import { DESK_COLUMNS, DESK_COUNT, type Student } from '../types'
import { Desk, type DeskHighlight } from './Desk'
import { GlowingBorder } from './effects/GlowingBorder'
import { Sparkles } from './effects/Sparkles'

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
        const highlight = deskHighlights[index] ?? 'none'
        return (
          <div key={index} className="relative h-full w-full">
            {highlight === 'flashing' && <GlowingBorder variant="flashing" />}
            {highlight === 'winner' && <GlowingBorder variant="winner" />}
            <Desk
              index={index}
              student={student}
              swapMode={swapMode}
              selected={selectedDesk === index}
              highlight={highlight}
              onTap={onTapDesk}
            />
            {highlight === 'winner' && <Sparkles />}
          </div>
        )
      })}
    </div>
  )
}
