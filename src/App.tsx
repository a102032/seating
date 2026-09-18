import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { ClassSettingsModal } from './components/ClassSettingsModal'
import { DeskGrid } from './components/DeskGrid'
import { PickerSettingsModal } from './components/PickerSettingsModal'
import { PointsGoalModal } from './components/PointsGoalModal'
import { PointsMeter } from './components/PointsMeter'
import { SeatClassBanner } from './components/SeatClassBanner'
import { SidePanel } from './components/SidePanel'
import { TimerSettingsModal } from './components/TimerSettingsModal'
import { useClasses } from './hooks/useClasses'
import { usePicker } from './hooks/usePicker'
import { primeAudio } from './lib/sound'
import { applyTheme, loadTheme, type Theme } from './lib/theme'
import type { Student, TimerSettings } from './types'

const DEFAULT_TIMER_SETTINGS: TimerSettings = { warningEnabled: true, alarmSound: 'ding' }
const PANEL_SIDE_KEY = 'seating-chart-panel-side-v1'

type PanelSide = 'left' | 'right'

function loadTimerSettings(): TimerSettings {
  try {
    const raw = localStorage.getItem('seating-chart-timer-settings-v1')
    if (!raw) return DEFAULT_TIMER_SETTINGS
    return { ...DEFAULT_TIMER_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_TIMER_SETTINGS
  }
}

function loadPanelSide(): PanelSide {
  try {
    const raw = localStorage.getItem(PANEL_SIDE_KEY)
    return raw === 'right' ? 'right' : 'left'
  } catch {
    return 'left'
  }
}

export default function App() {
  const {
    classes,
    activeClass,
    activeClassId,
    setActiveClassId,
    createClass,
    renameClass,
    deleteClass,
    addStudents,
    updateStudent,
    adjustPoints,
    setPointsGoal,
    deleteStudent,
    swapSeats,
    seatClass,
    unseatAll,
    unseatStudent,
    unseatedStudents,
    saveError,
  } = useClasses()

  const [swapMode, setSwapMode] = useState(false)
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null)
  const [pointsSelection, setPointsSelection] = useState<Set<number>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false)
  const [pickerSettingsOpen, setPickerSettingsOpen] = useState(false)
  const [pointsGoalOpen, setPointsGoalOpen] = useState(false)
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(loadTimerSettings)
  const [panelSide, setPanelSide] = useState<PanelSide>(loadPanelSide)
  const [theme, setTheme] = useState<Theme>(loadTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    setPointsSelection(new Set())
  }, [activeClassId])

  const seating = activeClass?.seating ?? []
  const picker = usePicker(seating, activeClassId)

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>()
    activeClass?.students.forEach((s) => map.set(s.id, s))
    return map
  }, [activeClass])

  function updateTimerSettings(next: TimerSettings) {
    setTimerSettings(next)
    localStorage.setItem('seating-chart-timer-settings-v1', JSON.stringify(next))
  }

  function togglePanelSide() {
    setPanelSide((prev) => {
      const next = prev === 'left' ? 'right' : 'left'
      localStorage.setItem(PANEL_SIDE_KEY, next)
      return next
    })
  }

  function handleTapDesk(index: number) {
    if (!activeClassId) return
    if (picker.hasResult) {
      picker.dismiss()
      return
    }
    if (!swapMode) {
      if (!seating[index]) return
      setPointsSelection((prev) => {
        const next = new Set(prev)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
      })
      return
    }

    if (selectedDesk === null) {
      setSelectedDesk(index)
      return
    }
    if (selectedDesk === index) {
      setSelectedDesk(null)
      return
    }
    swapSeats(activeClassId, selectedDesk, index)
    setSelectedDesk(null)
  }

  function toggleSelectAll() {
    const seatedIndices = seating.reduce<number[]>((acc, id, i) => {
      if (id) acc.push(i)
      return acc
    }, [])
    const allSelected = seatedIndices.length > 0 && seatedIndices.every((i) => pointsSelection.has(i))
    setPointsSelection(allSelected ? new Set() : new Set(seatedIndices))
  }

  function applyPointsDelta(delta: number) {
    if (!activeClassId || pointsSelection.size === 0) return
    const studentIds = Array.from(pointsSelection)
      .map((i) => seating[i])
      .filter((id): id is string => Boolean(id))
    adjustPoints(activeClassId, studentIds, delta)
  }

  if (!activeClass) {
    return <div className="flex h-full w-full items-center justify-center text-neutral-400">Loading...</div>
  }

  const sidePanel = (
    <SidePanel
      classes={classes}
      activeClassId={activeClassId}
      onSelectClass={setActiveClassId}
      swapMode={swapMode}
      onToggleSwap={() => {
        setSwapMode((v) => !v)
        setSelectedDesk(null)
        setPointsSelection(new Set())
      }}
      onPickStudent={picker.pickStudent}
      onPickRow={picker.pickRow}
      rowLocked={picker.rowLocked}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenPickerSettings={() => setPickerSettingsOpen(true)}
      timerSettings={timerSettings}
      onOpenTimerSettings={() => setTimerSettingsOpen(true)}
      side={panelSide}
      onToggleSide={togglePanelSide}
      theme={theme}
      saveError={saveError}
      pointsSelectedCount={pointsSelection.size}
      allSeatedSelected={seating.length > 0 && seating.some(Boolean) && seating.every((id, i) => !id || pointsSelection.has(i))}
      onToggleSelectAll={toggleSelectAll}
      onAwardPoint={() => applyPointsDelta(1)}
      onDeductPoint={() => applyPointsDelta(-1)}
    />
  )

  return (
    <>
      <div
        className={`flex h-[100dvh] w-[100dvw] gap-3 bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-2 sm:p-3 ${
          panelSide === 'right' ? 'flex-row-reverse' : 'flex-row'
        }`}
        onPointerDownCapture={primeAudio}
      >
        <motion.div layout transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="flex shrink-0">
          {sidePanel}
        </motion.div>

        <motion.div layout transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <PointsMeter
            classId={activeClass.id}
            classPoints={activeClass.classPoints ?? 0}
            goal={activeClass.pointsGoal ?? 0}
            onOpenGoalSettings={() => setPointsGoalOpen(true)}
          />

          <SeatClassBanner unseatedCount={unseatedStudents.length} onSeatClass={() => seatClass(activeClass.id)} />

          <main className="min-h-0 flex-1">
            <DeskGrid
              seating={seating}
              studentsById={studentsById}
              selectedDesk={selectedDesk}
              pointsSelection={pointsSelection}
              deskHighlights={picker.deskHighlights}
              onTapDesk={handleTapDesk}
            />
          </main>
        </motion.div>
      </div>

      <TimerSettingsModal
        open={timerSettingsOpen}
        onClose={() => setTimerSettingsOpen(false)}
        settings={timerSettings}
        onChange={updateTimerSettings}
      />

      <PointsGoalModal
        open={pointsGoalOpen}
        onClose={() => setPointsGoalOpen(false)}
        currentGoal={activeClass.pointsGoal ?? 0}
        onSave={(goal) => setPointsGoal(activeClass.id, goal)}
      />

      <PickerSettingsModal
        open={pickerSettingsOpen}
        onClose={() => setPickerSettingsOpen(false)}
        settings={picker.settings}
        onUpdateSettings={picker.updateSettings}
        studentPickCounts={picker.studentPickCounts}
        columnPickCounts={picker.columnPickCounts}
        studentsById={studentsById}
        onReset={picker.resetPickHistory}
      />

      <ClassSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeClass={activeClass}
        classes={classes}
        classesCount={classes.length}
        unseatedCount={unseatedStudents.length}
        onRename={(name) => renameClass(activeClass.id, name)}
        onAddStudents={(students) => addStudents(activeClass.id, students)}
        onUpdateStudent={(studentId, patch) => updateStudent(activeClass.id, studentId, patch)}
        onDeleteStudent={(studentId) => deleteStudent(activeClass.id, studentId)}
        onUnseatStudent={(studentId) => unseatStudent(activeClass.id, studentId)}
        onCreateClass={() => createClass()}
        onDeleteClass={() => deleteClass(activeClass.id)}
        onUnseatAll={() => unseatAll(activeClass.id)}
        onSeatClass={() => seatClass(activeClass.id)}
        theme={theme}
        onSetTheme={setTheme}
      />
    </>
  )
}
