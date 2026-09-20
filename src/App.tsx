import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { ClassSettingsModal } from './components/ClassSettingsModal'
import { DeskGrid } from './components/DeskGrid'
import { FlipDeck } from './components/FlipDeck'
import { FlipDeckSettingsModal } from './components/FlipDeckSettingsModal'
import { PickerSettingsModal } from './components/PickerSettingsModal'
import { PointsGoalModal } from './components/PointsGoalModal'
import { PointsMeter } from './components/PointsMeter'
import { SeatClassBanner } from './components/SeatClassBanner'
import { SidePanel } from './components/SidePanel'
import { TimerSettingsModal } from './components/TimerSettingsModal'
import { useClasses } from './hooks/useClasses'
import { useFlipDeck } from './hooks/useFlipDeck'
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
    assignAvatars,
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
  // Keyed by student id, not desk index, so a desk and a revealed flip card select the same way.
  const [pointsSelection, setPointsSelection] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false)
  const [pickerSettingsOpen, setPickerSettingsOpen] = useState(false)
  const [pointsGoalOpen, setPointsGoalOpen] = useState(false)
  const [flipDeckOpen, setFlipDeckOpen] = useState(false)
  const [flipSettingsOpen, setFlipSettingsOpen] = useState(false)
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
  const seatedIds = useMemo(() => (activeClass?.seating ?? []).filter((id): id is string => Boolean(id)), [activeClass])
  const deck = useFlipDeck(seatedIds, activeClassId, flipDeckOpen)

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
      const studentId = seating[index]
      if (!studentId) return
      togglePointsSelection(studentId)
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

  function togglePointsSelection(studentId: string) {
    setPointsSelection((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleSelectAll() {
    const allSelected = seatedIds.length > 0 && seatedIds.every((id) => pointsSelection.has(id))
    setPointsSelection(allSelected ? new Set() : new Set(seatedIds))
  }

  function applyPointsDelta(delta: number) {
    if (!activeClassId || pointsSelection.size === 0) return
    adjustPoints(activeClassId, Array.from(pointsSelection), delta)
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
      allSeatedSelected={seatedIds.length > 0 && seatedIds.every((id) => pointsSelection.has(id))}
      onToggleSelectAll={toggleSelectAll}
      onAwardPoint={() => applyPointsDelta(1)}
      onDeductPoint={() => applyPointsDelta(-1)}
      flipDeckOpen={flipDeckOpen}
      onToggleFlipDeck={() => {
        // Deal outside the state updater - React may run an updater more than once, which
        // would deal (and sound) twice.
        const opening = !flipDeckOpen
        setFlipDeckOpen(opening)
        if (opening) deck.deal()
        setPointsSelection(new Set())
      }}
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

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <DeskGrid
              seating={seating}
              studentsById={studentsById}
              selectedDesk={selectedDesk}
              pointsSelection={pointsSelection}
              deskHighlights={picker.deskHighlights}
              onTapDesk={handleTapDesk}
            />

            {/* The flip deck slides up over the seating chart and back down on the way out,
                keeping the side panel's points buttons and the class goal meter in play. */}
            <AnimatePresence>
              {flipDeckOpen && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 260, damping: 32 }}
                  className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]"
                >
                  <FlipDeck
                    deck={deck}
                    studentsById={studentsById}
                    pointsSelection={pointsSelection}
                    onToggleSelect={togglePointsSelection}
                    onOpenSettings={() => setFlipSettingsOpen(true)}
                    onExit={() => {
                      setFlipDeckOpen(false)
                      setPointsSelection(new Set())
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </motion.div>
      </div>

      <TimerSettingsModal
        open={timerSettingsOpen}
        onClose={() => setTimerSettingsOpen(false)}
        settings={timerSettings}
        onChange={updateTimerSettings}
      />

      <FlipDeckSettingsModal
        open={flipSettingsOpen}
        onClose={() => setFlipSettingsOpen(false)}
        settings={deck.settings}
        onChange={deck.updateSettings}
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
        onAssignAvatars={(themeId, options) => assignAvatars(activeClass.id, themeId, options)}
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
