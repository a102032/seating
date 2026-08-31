import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { ClassTabs } from './components/ClassTabs'
import { ClassSettingsModal } from './components/ClassSettingsModal'
import { DeskGrid } from './components/DeskGrid'
import { FlipTimer } from './components/FlipTimer'
import { RosterPool } from './components/RosterPool'
import { TimerSettingsModal } from './components/TimerSettingsModal'
import { Toolbar } from './components/Toolbar'
import { useClasses } from './hooks/useClasses'
import { usePicker } from './hooks/usePicker'
import { primeAudio } from './lib/sound'
import type { Student, TimerSettings } from './types'

const DEFAULT_TIMER_SETTINGS: TimerSettings = { warningEnabled: true, alarmSound: 'ding' }

function loadTimerSettings(): TimerSettings {
  try {
    const raw = localStorage.getItem('seating-chart-timer-settings-v1')
    if (!raw) return DEFAULT_TIMER_SETTINGS
    return { ...DEFAULT_TIMER_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_TIMER_SETTINGS
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
    assignSeat,
    swapSeats,
    unseatAll,
    unseatStudent,
    unseatedStudents,
    isCloudSynced,
  } = useClasses()

  const [swapMode, setSwapMode] = useState(false)
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null)
  const [rosterOpen, setRosterOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timerVisible, setTimerVisible] = useState(false)
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false)
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(loadTimerSettings)

  const seating = activeClass?.seating ?? []
  const picker = usePicker(seating)

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
    if (!studentId) return

    if (over.data.current?.type === 'desk') {
      assignSeat(activeClassId, over.data.current.deskIndex as number, studentId)
    } else if (over.data.current?.type === 'roster-pool') {
      unseatStudent(activeClassId, studentId)
    }
  }

  if (!activeClass) {
    return <div className="flex h-full w-full items-center justify-center text-neutral-400">Loading...</div>
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className="flex h-[100dvh] w-[100dvw] flex-col bg-neutral-50 p-2 sm:p-3"
        onPointerDownCapture={primeAudio}
      >
        <header className="flex h-12 shrink-0 items-center gap-3 sm:h-14">
          <div className="min-w-0 flex-1">
            <ClassTabs classes={classes} activeClassId={activeClassId} onSelect={setActiveClassId} onCreate={() => createClass()} />
          </div>
        </header>

        <div className="flex h-10 shrink-0 items-center sm:h-12">
          <Toolbar
            swapMode={swapMode}
            onToggleSwap={() => {
              setSwapMode((v) => !v)
              setSelectedDesk(null)
            }}
            onPickStudent={picker.pickStudent}
            onPickRow={picker.pickRow}
            onOpenTimer={() => setTimerVisible((v) => !v)}
            onOpenSettings={() => setSettingsOpen(true)}
            isCloudSynced={isCloudSynced}
          />
        </div>

        <main className="min-h-0 flex-1 py-2">
          <DeskGrid
            seating={seating}
            studentsById={studentsById}
            swapMode={swapMode}
            selectedDesk={selectedDesk}
            deskHighlights={picker.deskHighlights}
            onTapDesk={handleTapDesk}
          />
        </main>

        <RosterPool students={unseatedStudents} open={rosterOpen} onToggle={() => setRosterOpen((v) => !v)} />
      </div>

      <FlipTimer
        visible={timerVisible}
        onClose={() => setTimerVisible(false)}
        settings={timerSettings}
        onOpenSettings={() => setTimerSettingsOpen(true)}
      />
      <TimerSettingsModal
        open={timerSettingsOpen}
        onClose={() => setTimerSettingsOpen(false)}
        settings={timerSettings}
        onChange={updateTimerSettings}
      />

      <ClassSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeClass={activeClass}
        onRename={(name) => renameClass(activeClass.id, name)}
        onAddStudents={(students) => addStudents(activeClass.id, students)}
        onUpdateStudent={(studentId, patch) => updateStudent(activeClass.id, studentId, patch)}
        onDeleteStudent={(studentId) => deleteStudent(activeClass.id, studentId)}
        onCreateClass={() => createClass()}
        onDeleteClass={() => deleteClass(activeClass.id)}
        onUnseatAll={() => unseatAll(activeClass.id)}
      />
    </DndContext>
  )
}
