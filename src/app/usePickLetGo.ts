import { useEffect } from 'react'
import type { usePicker } from '../hooks/usePicker'
import type { usePointsSelection } from './usePointsSelection'

/** How long a pick stays up after it lands, or after the last star given to it. */
export const LET_GO_MS = 10_000
/** The desks ease back over this, rather than snapping, so the class sees the pick end. */
const FADE_MS = 1000

/**
 * A pick lets go by itself (2026-10-27, the teacher: "I will forget to release the random student,
 * row, or whole class picker... I think most teachers will face the same problem"). It reverses the
 * rule that picks never expire, on purpose: Pick a Random Student, Pick a Random Row and Pick All let go
 * 10 seconds after they land, or after the last star given to them, so a child still answering when
 * the star comes keeps the pick. Desks tapped by hand stay until let go: the teacher chose those.
 * A tap on a desk picks a child again if the pick went too soon.
 */
export function usePickLetGo(picker: ReturnType<typeof usePicker>, selection: ReturnType<typeof usePointsSelection>) {
  const pickShown = picker.hasResult
  const key = pickShown
    ? `${picker.mode}:${picker.winnerStudentIds.join(',')}`
    : selection.byPickAll && selection.selection.size > 0
      ? 'all'
      : null
  const { dismiss } = picker
  const letGoAll = selection.reset

  useEffect(() => {
    if (!key) return
    const timer = setTimeout(() => {
      const root = document.documentElement
      root.setAttribute('data-pick-letting-go', '')
      setTimeout(() => root.removeAttribute('data-pick-letting-go'), FADE_MS + 200)
      if (key === 'all') letGoAll()
      else dismiss()
    }, LET_GO_MS)
    return () => clearTimeout(timer)
    // A star given (landedTick) starts the 10 seconds again; letGoAll is a fresh function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, selection.landedTick, dismiss])
}
