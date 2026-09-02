import { useCallback, useEffect, useRef, useState } from 'react'
import { DESK_COLUMNS, DESK_COUNT } from '../types'
import type { DeskHighlight } from '../components/Desk'
import { playPickerTick } from '../lib/sound'

type PickerMode = 'idle' | 'student-flashing' | 'student-result' | 'row-flashing' | 'row-result'

const FLASH_DURATION_MS = 2200
const FLASH_TICK_MS = 90
const SETTINGS_KEY = 'seating-chart-picker-settings-v1'

interface PickerSettings {
  allowRepeatsStudents: boolean
  allowRepeatsRows: boolean
  soundEnabled: boolean
}

const DEFAULT_SETTINGS: PickerSettings = {
  allowRepeatsStudents: false,
  allowRepeatsRows: false,
  soundEnabled: true,
}

function loadSettings(): PickerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: PickerSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

function columnOf(deskIndex: number): number {
  return deskIndex % DESK_COLUMNS
}

export function usePicker(seating: (string | null)[], classId: string | null) {
  const seatingRef = useRef(seating)
  seatingRef.current = seating

  const [mode, setMode] = useState<PickerMode>('idle')
  const [flashDesk, setFlashDesk] = useState<number | null>(null)
  const [flashColumn, setFlashColumn] = useState<number | null>(null)
  const [winnerDesk, setWinnerDesk] = useState<number | null>(null)
  const [winnerColumn, setWinnerColumn] = useState<number | null>(null)
  const [pickedStudentIds, setPickedStudentIds] = useState<Set<string>>(new Set())
  const [pickedColumns, setPickedColumns] = useState<Set<number>>(new Set())
  /** A row a teacher has "drilled into" via Pick Row - Pick Student then draws only from here until it's exhausted or the teacher taps to clear it. */
  const [rowLock, setRowLock] = useState<number | null>(null)

  /** How many times each student/row has been picked this session - persists until Reset, independent of the round-based no-repeat tracking above. */
  const [studentPickCounts, setStudentPickCounts] = useState<Map<string, number>>(new Map())
  const [columnPickCounts, setColumnPickCounts] = useState<Map<number, number>>(new Map())

  const [settings, setSettings] = useState<PickerSettings>(loadSettings)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    intervalRef.current = null
    timeoutRef.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  // A different class means a different roster entirely - start the session fresh.
  useEffect(() => {
    clearTimers()
    setMode('idle')
    setFlashDesk(null)
    setFlashColumn(null)
    setWinnerDesk(null)
    setWinnerColumn(null)
    setRowLock(null)
    setPickedStudentIds(new Set())
    setPickedColumns(new Set())
    setStudentPickCounts(new Map())
    setColumnPickCounts(new Map())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const updateSettings = useCallback((patch: Partial<PickerSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const pickStudent = useCallback(() => {
    if (mode === 'student-flashing' || mode === 'row-flashing') return
    const { allowRepeatsStudents, soundEnabled } = settingsRef.current
    const currentSeating = seatingRef.current
    const occupiedIndices = currentSeating
      .map((studentId, index) => ({ studentId, index }))
      .filter((d): d is { studentId: string; index: number } => Boolean(d.studentId))

    // Prefer drawing from a locked row, if one is active and still has someone left in it.
    const rowEligible =
      rowLock !== null
        ? occupiedIndices.filter((d) => columnOf(d.index) === rowLock && (allowRepeatsStudents || !pickedStudentIds.has(d.studentId)))
        : []
    const stayingInRow = rowEligible.length > 0

    let eligible = stayingInRow
      ? rowEligible
      : allowRepeatsStudents
        ? occupiedIndices
        : occupiedIndices.filter((d) => !pickedStudentIds.has(d.studentId))
    let usedPicked = pickedStudentIds
    if (!allowRepeatsStudents && !stayingInRow && eligible.length === 0) {
      // Everyone has been picked this round - start a fresh round.
      usedPicked = new Set()
      eligible = occupiedIndices
    }
    if (eligible.length === 0) return // no one seated at all

    // The flashing sequence cycles through everyone currently in play (the whole
    // row, or the whole class) so it always feels lively - only the final winner
    // is drawn from the narrower "hasn't been picked yet" pool.
    const flashPool = stayingInRow ? occupiedIndices.filter((d) => columnOf(d.index) === rowLock) : occupiedIndices

    clearTimers()
    setMode('student-flashing')
    setWinnerDesk(null)
    if (!stayingInRow) setRowLock(null)

    const startedAt = Date.now()
    intervalRef.current = setInterval(() => {
      const pick = flashPool[Math.floor(Math.random() * flashPool.length)]
      setFlashDesk(pick.index)
      if (soundEnabled) playPickerTick(pick.index)
      if (Date.now() - startedAt >= FLASH_DURATION_MS) {
        clearTimers()
        const winner = eligible[Math.floor(Math.random() * eligible.length)]
        setFlashDesk(null)
        setWinnerDesk(winner.index)
        setPickedStudentIds(new Set(usedPicked).add(winner.studentId))
        setStudentPickCounts((prev) => {
          const next = new Map(prev)
          next.set(winner.studentId, (next.get(winner.studentId) ?? 0) + 1)
          return next
        })
        setMode('student-result')
      }
    }, FLASH_TICK_MS)
  }, [mode, pickedStudentIds, rowLock, clearTimers])

  const pickRow = useCallback(() => {
    if (mode === 'student-flashing' || mode === 'row-flashing') return
    const { allowRepeatsRows, soundEnabled } = settingsRef.current
    let eligible = Array.from({ length: DESK_COLUMNS }, (_, i) => i).filter((c) => allowRepeatsRows || !pickedColumns.has(c))
    let usedPicked = pickedColumns
    if (eligible.length === 0) {
      usedPicked = new Set()
      eligible = Array.from({ length: DESK_COLUMNS }, (_, i) => i)
    }
    // Same idea as pickStudent: flash across every row for a lively sequence,
    // but only ever land the winner on one that's still eligible.
    const flashPool = Array.from({ length: DESK_COLUMNS }, (_, i) => i)

    clearTimers()
    setMode('row-flashing')
    setWinnerColumn(null)

    const startedAt = Date.now()
    intervalRef.current = setInterval(() => {
      const pick = flashPool[Math.floor(Math.random() * flashPool.length)]
      setFlashColumn(pick)
      if (soundEnabled) playPickerTick(pick)
      if (Date.now() - startedAt >= FLASH_DURATION_MS) {
        clearTimers()
        const winner = eligible[Math.floor(Math.random() * eligible.length)]
        setFlashColumn(null)
        setWinnerColumn(winner)
        setPickedColumns(new Set(usedPicked).add(winner))
        setColumnPickCounts((prev) => {
          const next = new Map(prev)
          next.set(winner, (next.get(winner) ?? 0) + 1)
          return next
        })
        setRowLock(winner)
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
    setRowLock(null)
  }, [])

  const resetPickHistory = useCallback(() => {
    setPickedStudentIds(new Set())
    setPickedColumns(new Set())
    setStudentPickCounts(new Map())
    setColumnPickCounts(new Map())
  }, [])

  const deskHighlights: DeskHighlight[] = Array.from({ length: DESK_COUNT }, (_, index) => {
    if (mode === 'student-flashing') return flashDesk === index ? 'flashing' : 'dimmed'
    if (mode === 'student-result') return winnerDesk === index ? 'winner' : 'dimmed'
    if (mode === 'row-flashing') return columnOf(index) === flashColumn ? 'flashing' : 'dimmed'
    if (mode === 'row-result') return columnOf(index) === winnerColumn ? 'winner' : 'dimmed'
    return 'none'
  })

  return {
    mode,
    isPicking: mode === 'student-flashing' || mode === 'row-flashing',
    hasResult: mode === 'student-result' || mode === 'row-result',
    rowLocked: rowLock !== null,
    deskHighlights,
    pickStudent,
    pickRow,
    dismiss,
    settings,
    updateSettings,
    studentPickCounts,
    columnPickCounts,
    resetPickHistory,
  }
}
