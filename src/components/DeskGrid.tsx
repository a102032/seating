import { useEffect, useMemo, useState } from 'react'
import { fitClassNameSize, NAME_ONLY_MAX_CQI } from '../lib/fitText'
import { homeroomsToShow } from '../lib/sameNames'
import { hasNoAvatar } from '../lib/stickers'
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
  /** Each desk shows its student's stars. Off by default: the board shows the jar instead. */
  showStars: boolean
  /** Every desk shows its homeroom number, not only names two students share. */
  showAllHomerooms: boolean
  onTapDesk: (index: number) => void
}

export function DeskGrid({
  seating,
  plan,
  studentsById,
  selectedDesk,
  pointsSelection,
  landedTick,
  staggerWiggle,
  deskHighlights,
  absentIds,
  showStars,
  showAllHomerooms,
  onTapDesk,
}: DeskGridProps) {
  const seated = seating.map((id) => (id ? studentsById.get(id) : undefined))

  // While a picker is flashing or showing its winner it owns the board's attention, so the
  // points selection stands down rather than dimming on top of the picker's own dimming.
  const pickerOwnsBoard = deskHighlights.some((h) => h !== 'none')
  const showSelection = !pickerOwnsBoard && pointsSelection.size > 0

  // With every student selected nothing is left to dim, so those desks shiver instead.
  const seatedStudents = seated.filter((s): s is Student => s !== undefined)
  const everyoneSelected = showSelection && seatedStudents.length > 0 && seatedStudents.every((s) => pointsSelection.has(s.id))

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
  // A homeroom number shows only after a name two students share (lib/sameNames), and the
  // name size makes room for it.
  const tagged = useMemo(() => homeroomsToShow(studentsById.values(), showAllHomerooms), [studentsById, showAllHomerooms])
  // On a no-avatar desk the number hangs under the name, so it adds nothing to the name's width.
  const labels = seatedStudents.map((s) => `${s.name}\t${tagged.has(s.id) && !hasNoAvatar(s) ? s.homeroom : ''}`).join('\n')
  // A class with no avatars at all lets the names grow into the room the pictures had. A class
  // with some still keeps one size for every name, centred or not.
  const nameOnlyClass = seatedStudents.length > 0 && seatedStudents.every(hasNoAvatar)
  const nameSize = useMemo(
    () =>
      fitClassNameSize(
        labels
          ? labels.split('\n').map((l) => {
              const [name, homeroom] = l.split('\t')
              return { name, homeroom }
            })
          : [],
        nameOnlyClass ? NAME_ONLY_MAX_CQI : undefined,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labels, fontsLoaded, nameOnlyClass],
  )
  // A centred name with a homeroom number under it needs room below it as well as above: the
  // name is held to about a third of the desk's height, or a bit under half when no centred
  // name has a number. One cap for the class, so the names stay one size.
  const nameHeightCap = seatedStudents.some((s) => hasNoAvatar(s) && tagged.has(s.id)) ? 34 : 44

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
          inSelection && landedTick > 0 ? 'landed' : !showSelection ? 'none' : inSelection ? 'selected' : 'muted'
        }
        wiggleDelayMs={showSelection && inSelection && staggerWiggle ? position * 18 : 0}
        landedTick={landedTick}
        wiggleLoop={everyoneSelected && inSelection}
        highlight={deskHighlights[index] ?? 'none'}
        absent={student !== undefined && absentIds.has(student.id)}
        nameSize={nameSize}
        nameHeightCap={nameHeightCap}
        showHomeroom={student !== undefined && tagged.has(student.id)}
        showStars={showStars}
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
