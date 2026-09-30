import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAX_DESKS, deskColumn } from '../types'
import type { DeskHighlight } from '../components/Desk'
import { playPickerLand, playPickerTick } from '../lib/sound'

type PickerMode = 'idle' | 'student-flashing' | 'student-result' | 'row-flashing' | 'row-result'

const FLASH_DURATION_MS = 2200
const FLASH_TICK_MS = 90
const SETTINGS_KEY = 'seating-chart-picker-settings-v1'

interface PickerSettings {
  allowRepeats: boolean
  soundEnabled: boolean
}

const DEFAULT_SETTINGS: PickerSettings = {
  allowRepeats: false,
  soundEnabled: true,
}

function loadSettings(): PickerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const stored = JSON.parse(raw) as Partial<PickerSettings> & {
      allowRepeatsStudents?: boolean
      allowRepeatsRows?: boolean
    }
    // Students and rows used to have a toggle each. Carry a saved pair over by taking
    // either one as "on", so a teacher who had turned repeats on keeps them on.
    const allowRepeats =
      stored.allowRepeats ?? Boolean(stored.allowRepeatsStudents || stored.allowRepeatsRows)
    return { ...DEFAULT_SETTINGS, ...stored, allowRepeats }
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
  return deskColumn(deskIndex)
}

/** `columns` is how many rows of desks Pick Row chooses between: six, or seven for a class of more than thirty. */
export function usePicker(seating: (string | null)[], classId: string | null, columns: number) {
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

  const intervalRef = useRef<number | null>(null)
  /** Whose clock the flashing runs on - this page's, or the floating window's (see pickStudent). */
  const timerWindowRef = useRef<Window>(window)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      try {
        timerWindowRef.current.clearInterval(intervalRef.current)
      } catch {
        // The floating window it ran on has closed, and its clock went with it.
      }
    }
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

  /**
   * `clock` is the window whose timer paces the flashing. A pick started from the floating
   * class goal runs on the floating window's clock: this page is behind the lesson then, and
   * Chrome slows a hidden page's timers to about one a second - the flicker would crawl.
   */
  const pickStudent = useCallback((clock: Window = window) => {
    if (mode === 'student-flashing' || mode === 'row-flashing') return
    const { allowRepeats, soundEnabled } = settingsRef.current
    const currentSeating = seatingRef.current
    const occupiedIndices = currentSeating
      .map((studentId, index) => ({ studentId, index }))
      .filter((d): d is { studentId: string; index: number } => Boolean(d.studentId))

    // Prefer drawing from a locked row, if one is active and still has someone left in it.
    const rowEligible =
      rowLock !== null
        ? occupiedIndices.filter((d) => columnOf(d.index) === rowLock && (allowRepeats || !pickedStudentIds.has(d.studentId)))
        : []
    const stayingInRow = rowEligible.length > 0

    let eligible = stayingInRow
      ? rowEligible
      : allowRepeats
        ? occupiedIndices
        : occupiedIndices.filter((d) => !pickedStudentIds.has(d.studentId))
    let usedPicked = pickedStudentIds
    if (!allowRepeats && !stayingInRow && eligible.length === 0) {
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
    timerWindowRef.current = clock
    intervalRef.current = clock.setInterval(() => {
      // The final pass lands rather than flashing. It used to do both, which fired a tick and
      // the landing in the same callback and buried the one under the other.
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
        if (soundEnabled) playPickerLand()
        return
      }
      const pick = flashPool[Math.floor(Math.random() * flashPool.length)]
      setFlashDesk(pick.index)
      if (soundEnabled) playPickerTick()
    }, FLASH_TICK_MS)
  }, [mode, pickedStudentIds, rowLock, clearTimers])

  const pickRow = useCallback(() => {
    if (mode === 'student-flashing' || mode === 'row-flashing') return
    const { allowRepeats, soundEnabled } = settingsRef.current
    // Only rows with somebody in them today. A class that doesn't fill the grid, or a row
    // whose students are all away, used to be able to win - a row of nobody.
    const occupied = new Set(seatingRef.current.flatMap((id, index) => (id ? [columnOf(index)] : [])))
    const rows = Array.from({ length: columns }, (_, i) => i).filter((c) => occupied.has(c))
    if (rows.length === 0) return
    let eligible = rows.filter((c) => allowRepeats || !pickedColumns.has(c))
    let usedPicked = pickedColumns
    if (eligible.length === 0) {
      usedPicked = new Set()
      eligible = rows
    }
    // Same idea as pickStudent: flash across every row for a lively sequence,
    // but only ever land the winner on one that's still eligible.
    const flashPool = rows

    clearTimers()
    setMode('row-flashing')
    setWinnerColumn(null)

    const startedAt = Date.now()
    timerWindowRef.current = window
    intervalRef.current = window.setInterval(() => {
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
        if (soundEnabled) playPickerLand()
        return
      }
      const pick = flashPool[Math.floor(Math.random() * flashPool.length)]
      setFlashColumn(pick)
      if (soundEnabled) playPickerTick()
    }, FLASH_TICK_MS)
  }, [mode, pickedColumns, columns, clearTimers])

  const dismiss = useCallback(() => {
    // Also stops a flash that is still running: one paced by the floating window stops for
    // good when that window closes, and would leave the picker stuck mid-flash.
    clearTimers()
    setMode('idle')
    setWinnerDesk(null)
    setWinnerColumn(null)
    setFlashDesk(null)
    setFlashColumn(null)
    setRowLock(null)
  }, [clearTimers])

  const resetPickHistory = useCallback(() => {
    setPickedStudentIds(new Set())
    setPickedColumns(new Set())
    setStudentPickCounts(new Map())
    setColumnPickCounts(new Map())
  }, [])

  // Memoised so App can depend on it without re-running on every render.
  const winnerStudentIds = useMemo(() => {
    if (winnerDesk !== null) {
      const id = seating[winnerDesk]
      return id ? [id] : []
    }
    if (winnerColumn !== null) {
      return seating.filter((id, index): id is string => Boolean(id) && columnOf(index) === winnerColumn)
    }
    return []
  }, [seating, winnerDesk, winnerColumn])

  /**
   * Whether the next Pick Student really will stay inside the locked row.
   *
   * pickStudent falls back to the whole class the moment the locked row runs out of people it
   * may still draw (and drops the lock as it does). This mirrors that test exactly, so the
   * button can stop advertising the row one pick before the behaviour changes rather than one
   * pick after - a label that lies on the last click of a round is worse than no label.
   */
  const rowLockBinds =
    rowLock !== null &&
    seating.some(
      (studentId, index) =>
        Boolean(studentId) &&
        columnOf(index) === rowLock &&
        (settings.allowRepeats || !pickedStudentIds.has(studentId as string)),
    )

  const deskHighlights: DeskHighlight[] = Array.from({ length: MAX_DESKS }, (_, index) => {
    if (mode === 'student-flashing') return flashDesk === index ? 'flashing' : 'dimmed'
    if (mode === 'student-result') return winnerDesk === index ? 'winner' : 'dimmed'
    if (mode === 'row-flashing') return columnOf(index) === flashColumn ? 'flashing' : 'dimmed'
    if (mode === 'row-result') return columnOf(index) === winnerColumn ? 'winner' : 'dimmed'
    return 'none'
  })

  /**
   * The student Pick Student is showing right now: whoever the flash is on, then the winner.
   * The floating class goal shows it as a name, since the desks are behind the lesson.
   */
  const shownStudentId =
    mode === 'student-flashing' && flashDesk !== null
      ? seating[flashDesk]
      : mode === 'student-result' && winnerDesk !== null
        ? seating[winnerDesk]
        : null

  return {
    mode,
    isPicking: mode === 'student-flashing' || mode === 'row-flashing',
    hasResult: mode === 'student-result' || mode === 'row-result',
    /** Who the board is currently pointing at, so the points buttons can act on them. */
    winnerStudentIds,
    shownStudentId,
    rowLocked: rowLock !== null,
    /** True only while Pick Student is genuinely confined to the locked row. */
    rowLockBinds,
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
