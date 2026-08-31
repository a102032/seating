import { useCallback, useEffect, useRef, useState } from 'react'
import { DESK_COLUMNS, DESK_COUNT } from '../types'
import type { DeskHighlight } from '../components/Desk'

type PickerMode = 'idle' | 'student-flashing' | 'student-result' | 'row-flashing' | 'row-result'

const FLASH_DURATION_MS = 4200
const FLASH_TICK_MS = 90

function columnOf(deskIndex: number): number {
  return deskIndex % DESK_COLUMNS
}

export function usePicker(seating: (string | null)[]) {
  const seatingRef = useRef(seating)
  seatingRef.current = seating

  const [mode, setMode] = useState<PickerMode>('idle')
  const [flashDesk, setFlashDesk] = useState<number | null>(null)
  const [flashColumn, setFlashColumn] = useState<number | null>(null)
  const [winnerDesk, setWinnerDesk] = useState<number | null>(null)
  const [winnerColumn, setWinnerColumn] = useState<number | null>(null)
  const [pickedStudentIds, setPickedStudentIds] = useState<Set<string>>(new Set())
  const [pickedColumns, setPickedColumns] = useState<Set<number>>(new Set())

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    intervalRef.current = null
    timeoutRef.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const pickStudent = useCallback(() => {
    if (mode === 'student-flashing' || mode === 'row-flashing') return
    const currentSeating = seatingRef.current
    let occupiedIndices = currentSeating
      .map((studentId, index) => ({ studentId, index }))
      .filter((d): d is { studentId: string; index: number } => Boolean(d.studentId))

    let eligible = occupiedIndices.filter((d) => !pickedStudentIds.has(d.studentId))
    let usedPicked = pickedStudentIds
    if (eligible.length === 0) {
      // Everyone has been picked this session - start a fresh round.
      usedPicked = new Set()
      eligible = occupiedIndices
    }
    if (eligible.length === 0) return // no one seated at all

    clearTimers()
    setMode('student-flashing')
    setWinnerDesk(null)

    const startedAt = Date.now()
    intervalRef.current = setInterval(() => {
      const pick = eligible[Math.floor(Math.random() * eligible.length)]
      setFlashDesk(pick.index)
      if (Date.now() - startedAt >= FLASH_DURATION_MS) {
        clearTimers()
        const winner = eligible[Math.floor(Math.random() * eligible.length)]
        setFlashDesk(null)
        setWinnerDesk(winner.index)
        setPickedStudentIds(new Set(usedPicked).add(winner.studentId))
        setMode('student-result')
      }
    }, FLASH_TICK_MS)
  }, [mode, pickedStudentIds, clearTimers])

  const pickRow = useCallback(() => {
    if (mode === 'student-flashing' || mode === 'row-flashing') return
    let eligible = Array.from({ length: DESK_COLUMNS }, (_, i) => i).filter((c) => !pickedColumns.has(c))
    let usedPicked = pickedColumns
    if (eligible.length === 0) {
      usedPicked = new Set()
      eligible = Array.from({ length: DESK_COLUMNS }, (_, i) => i)
    }

    clearTimers()
    setMode('row-flashing')
    setWinnerColumn(null)

    const startedAt = Date.now()
    intervalRef.current = setInterval(() => {
      const pick = eligible[Math.floor(Math.random() * eligible.length)]
      setFlashColumn(pick)
      if (Date.now() - startedAt >= FLASH_DURATION_MS) {
        clearTimers()
        const winner = eligible[Math.floor(Math.random() * eligible.length)]
        setFlashColumn(null)
        setWinnerColumn(winner)
        setPickedColumns(new Set(usedPicked).add(winner))
        setMode('row-result')
      }
    }, FLASH_TICK_MS)
  }, [mode, pickedColumns, clearTimers])

  const dismiss = useCallback(() => {
    setMode('idle')
    setWinnerDesk(null)
    setWinnerColumn(null)
    setFlashDesk(null)
    setFlashColumn(null)
  }, [])

  const deskHighlights: DeskHighlight[] = Array.from({ length: DESK_COUNT }, (_, index) => {
    if (mode === 'student-flashing') return flashDesk === index ? 'flashing' : 'dimmed'
    if (mode === 'student-result') return winnerDesk === index ? 'winner' : 'none'
    if (mode === 'row-flashing') return columnOf(index) === flashColumn ? 'flashing' : 'dimmed'
    if (mode === 'row-result') return columnOf(index) === winnerColumn ? 'winner' : 'none'
    return 'none'
  })

  return {
    mode,
    isPicking: mode === 'student-flashing' || mode === 'row-flashing',
    hasResult: mode === 'student-result' || mode === 'row-result',
    deskHighlights,
    pickStudent,
    pickRow,
    dismiss,
  }
}
