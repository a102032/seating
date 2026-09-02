import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import { ClassSettingsModal } from './components/ClassSettingsModal'
import { DeskGrid } from './components/DeskGrid'
import { PickerSettingsModal } from './components/PickerSettingsModal'
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
    deleteStudent,
    swapSeats,
    seatClass,
    unseatAll,
    unseatStudent,
    unseatedStudents,
    isCloudSynced,
  } = useClasses()

  const [swapMode, setSwapMode] = useState(false)
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false)
  const [pickerSettingsOpen, setPickerSettingsOpen] = useState(false)
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(loadTimerSettings)
  const [panelSide, setPanelSide] = useState<PanelSide>(loadPanelSide)
  const [theme, setTheme] = useState<Theme>(loadTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const seating = activeClass?.seating ?? []
  const picker = usePicker(seating, activeClassId)

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>()
    activeClass?.students.forEach((s) => map.set(s.id, s))
    return map
  }, [activeClass])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
    if (!swapMode) return

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

  function handleDragEnd(event: DragEndEvent) {
    if (!activeClassId) return
    const { active, over } = event
    if (!over) return
    const studentId = active.data.current?.studentId as string | null | undefined
    const fromDeskIndex = active.data.current?.fromDeskIndex as number | undefined
    if (!studentId || fromDeskIndex === undefined) return

    if (over.data.current?.type === 'desk') {
      const toDeskIndex = over.data.current.deskIndex as number
      if (toDeskIndex === fromDeskIndex) return
      swapSeats(activeClassId, fromDeskIndex, toDeskIndex)
    }
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
      }}
      onPickStudent={picker.pickStudent}
      onPickRow={picker.pickRow}
      rowLocked={picker.rowLocked}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenPickerSettings={() => setPickerSettingsOpen(true)}
      timerSettings={timerSettings}
      onOpenTimerSettings={() => setTimerSettingsOpen(true)}
      isCloudSynced={isCloudSynced}
      side={panelSide}
      onToggleSide={togglePanelSide}
      theme={theme}
    />
  )

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className={`flex h-[100dvh] w-[100dvw] gap-3 bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-2 sm:p-3 ${
          panelSide === 'right' ? 'flex-row-reverse' : 'flex-row'
        }`}
        onPointerDownCapture={primeAudio}
      >
        {sidePanel}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <SeatClassBanner unseatedCount={unseatedStudents.length} onSeatClass={() => seatClass(activeClass.id)} />

          <main className="min-h-0 flex-1">
            <DeskGrid
              seating={seating}
              studentsById={studentsById}
              swapMode={swapMode}
              selectedDesk={selectedDesk}
              deskHighlights={picker.deskHighlights}
              onTapDesk={handleTapDesk}
            />
          </main>
        </div>
      </div>

      <TimerSettingsModal
        open={timerSettingsOpen}
        onClose={() => setTimerSettingsOpen(false)}
        settings={timerSettings}
        onChange={updateTimerSettings}
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
    </DndContext>
  )
}
