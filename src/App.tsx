import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { ClassSettingsModal } from './components/ClassSettingsModal'
import { DeskGrid } from './components/DeskGrid'
import { FlipDeck } from './components/FlipDeck'
import { FlipDeckSettingsModal } from './components/FlipDeckSettingsModal'
import { GroupActivity } from './components/GroupActivity'
import { GroupActivityModal } from './components/GroupActivityModal'
import { PickersPointsModal } from './components/PickersPointsModal'
import { PointsMeter } from './components/PointsMeter'
import { SeatClassBanner } from './components/SeatClassBanner'
import { SidePanel } from './components/SidePanel'
import { SplashScreen } from './components/SplashScreen'
import { TimerSettingsModal } from './components/TimerSettingsModal'
import { effectiveGroupPointsMode, MAX_CLASSES, useClasses } from './hooks/useClasses'
import { useFlipDeck } from './hooks/useFlipDeck'
import { usePicker } from './hooks/usePicker'
import { buildGroups, pruneGroups, summarizeGroupPoints, type GroupScheme } from './lib/groups'
import { playGroupsDone, playPointDeduct, primeAudio } from './lib/sound'
import { applyTheme, chooseTheme, loadTheme, type Theme } from './lib/theme'
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
    setGoalSettings,
    setGoalEnabled,
    setCelebrationGif,
    resetClassGoal,
    resetPoints,
    deleteStudent,
    swapSeats,
    seatClass,
    unseatAll,
    unseatStudent,
    unseatedStudents,
    setGroups,
    adjustGroupPoints,
    moveStudentToGroup,
    renameGroup,
    setGroupPointsMode,
    finishGroupActivity,
    saveError,
  } = useClasses()

  const [swapMode, setSwapMode] = useState(false)
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null)
  // Keyed by student id, not desk index, so a desk and a revealed flip card select the same way.
  const [pointsSelection, setPointsSelection] = useState<Set<string>>(new Set())
  /**
   * Non-null once the current selection has been awarded, holding the sign of that award.
   * A spent selection is still shown (so the teacher sees what just landed) but the next
   * desk tap replaces it instead of adding to it - otherwise a selection left over from the
   * last award quietly collects a second point when the teacher picks someone else.
   */
  const [spentDelta, setSpentDelta] = useState<number | null>(null)
  /** True when the live selection arrived in one go, so the wiggle ripples across the grid. */
  const [staggerWiggle, setStaggerWiggle] = useState(false)
  /** Counts awards so a repeat award on the same desks replays their pop. */
  const [landedTick, setLandedTick] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false)
  const [pickerSettingsOpen, setPickerSettingsOpen] = useState(false)
  const [flipDeckOpen, setFlipDeckOpen] = useState(false)
  const [flipSettingsOpen, setFlipSettingsOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupActivityOpen, setGroupActivityOpen] = useState(false)
  /** How the current groups were made, so Shuffle can deal the same shape again. Null for saved groups. */
  const [groupScheme, setGroupScheme] = useState<GroupScheme | null>(null)
  /** Counts deals, so the cards replay their fly-in on each one and not when saved groups are picked up. */
  const [dealTick, setDealTick] = useState(0)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(loadTimerSettings)
  const [panelSide, setPanelSide] = useState<PanelSide>(loadPanelSide)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  /**
   * The splash is up until the teacher starts a class, on every open rather than once.
   * Opening this app is something a teacher does at the top of a lesson, so a deliberate
   * "start" is the moment they're already having - and it costs one tap to get past.
   */
  const [splashOpen, setSplashOpen] = useState(true)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    resetPointsSelection()
    // Another class is another set of groups; the activity closes rather than showing them.
    setGroupActivityOpen(false)
    setGroupScheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassId])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const seating = activeClass?.seating ?? []
  const picker = usePicker(seating, activeClassId)
  const seatedIds = useMemo(() => (activeClass?.seating ?? []).filter((id): id is string => Boolean(id)), [activeClass])
  const deck = useFlipDeck(seatedIds, activeClassId, flipDeckOpen)

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>()
    activeClass?.students.forEach((s) => map.set(s.id, s))
    return map
  }, [activeClass])

  /** The saved groups as they stand today - anyone who has left their desk since is out. */
  const groups = useMemo(() => pruneGroups(activeClass?.groups ?? [], seating), [activeClass, seating])

  function openGroupActivity() {
    setFlipDeckOpen(false)
    resetPointsSelection()
    setGroupActivityOpen(true)
  }

  function startGroups(scheme: GroupScheme) {
    if (!activeClassId) return
    setGroups(activeClassId, buildGroups(scheme, seating, studentsById, groups))
    setGroupScheme(scheme)
    setDealTick((t) => t + 1)
    openGroupActivity()
  }

  function continueGroups() {
    if (!activeClassId) return
    setGroups(activeClassId, groups)
    setGroupScheme(null)
    openGroupActivity()
  }

  function shuffleGroups() {
    if (!activeClassId || !groupScheme) return
    setGroups(activeClassId, buildGroups(groupScheme, seating, studentsById, groups))
    setDealTick((t) => t + 1)
  }

  /** Done: the points go out the way the teacher chose, and the board comes back. */
  function finishGroups() {
    if (!activeClass) return
    const { totalPoints, studentsAwarded } = summarizeGroupPoints(groups)
    const mode = effectiveGroupPointsMode(activeClass)
    finishGroupActivity(activeClass.id)
    setGroupActivityOpen(false)
    if (totalPoints > 0) playGroupsDone()
    setToast({
      id: Date.now(),
      text:
        totalPoints === 0
          ? 'No points this time. Your groups are saved for next time.'
          : mode === 'students'
            ? `${studentsAwarded} students got their group’s stars. Groups saved for next time.`
            : `${totalPoints} point${totalPoints === 1 ? '' : 's'} added to the class goal. Groups saved for next time.`,
    })
  }

  /** New Class from the splash: make it, then drop the teacher straight into its roster. */
  function startNewClassFromSplash() {
    createClass()
    setSplashOpen(false)
    setSettingsOpen(true)
  }

  /**
   * First run. The class already exists - useClasses seeds one - so this opens that empty
   * class rather than creating a second one next to it.
   */
  function setUpFirstClass() {
    setSplashOpen(false)
    setSettingsOpen(true)
  }

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

  /**
   * A picker result *is* a points selection - the board is already pointing at those
   * students, so the +/- buttons should act on them without the teacher re-tapping each
   * desk. It stays derived rather than copied into state so there's nothing to keep in sync.
   */
  const activeSelection = useMemo(
    () => (picker.hasResult ? new Set(picker.winnerStudentIds) : pointsSelection),
    [picker.hasResult, picker.winnerStudentIds, pointsSelection],
  )

  function resetPointsSelection() {
    setPointsSelection(new Set())
    setSpentDelta(null)
    setStaggerWiggle(false)
    setLandedTick(0)
  }

  function togglePointsSelection(studentId: string) {
    setStaggerWiggle(false)
    if (spentDelta !== null) {
      // The round is over - start a fresh one on the desk that was just tapped.
      setSpentDelta(null)
      setLandedTick(0)
      setPointsSelection(new Set([studentId]))
      return
    }
    setPointsSelection((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleSelectAll() {
    setSpentDelta(null)
    setLandedTick(0)
    const allSelected = seatedIds.length > 0 && seatedIds.every((id) => pointsSelection.has(id))
    // Selecting everyone is the one case where nothing dims, so the ripple is the only
    // confirmation the board gives. Deselecting needs none - the dimming lifts.
    setStaggerWiggle(!allSelected)
    setPointsSelection(allSelected ? new Set() : new Set(seatedIds))
  }

  /**
   * A pick takes the board over, so it replaces whatever was selected by hand rather than
   * hiding it. Without this, dismissing the pick handed the board back to a stale selection
   * the teacher had forgotten about - and the next award would have gone to them too.
   */
  function startPick(run: () => void) {
    if (picker.isPicking) return
    resetPointsSelection()
    run()
  }

  function applyPointsDelta(delta: number) {
    if (!activeClassId || activeSelection.size === 0) return
    adjustPoints(activeClassId, Array.from(activeSelection), delta)
    // Awards already sound: the coin ticks when the class meter moves. Taking a point away
    // never moves the meter by design, so without this the minus button was silent - the
    // teacher pressed it and nothing said it had landed.
    if (delta < 0) playPointDeduct()
    // Awarding deliberately changes nothing about what the board is showing: a pick stays a
    // pick, a selection stays selected. Only the desks react, and only for a moment. The
    // dimmed board is the record of what is selected, so it doesn't need a timer to expire -
    // the next thing the teacher does ends the round.
    setStaggerWiggle(false)
    setLandedTick((t) => t + 1)
    setSpentDelta(delta)
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
        resetPointsSelection()
      }}
      onPickStudent={() => startPick(picker.pickStudent)}
      onPickRow={() => startPick(picker.pickRow)}
      rowLocked={picker.rowLocked}
      rowLockBinds={picker.rowLockBinds}
      studentPickActive={picker.mode === 'student-flashing' || picker.mode === 'student-result'}
      rowPickActive={picker.mode === 'row-flashing' || picker.mode === 'row-result'}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenPickerSettings={() => setPickerSettingsOpen(true)}
      timerSettings={timerSettings}
      onOpenTimerSettings={() => setTimerSettingsOpen(true)}
      side={panelSide}
      onToggleSide={togglePanelSide}
      saveError={saveError}
      pointsSelectedCount={activeSelection.size}
      allSeatedSelected={seatedIds.length > 0 && seatedIds.every((id) => activeSelection.has(id))}
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
        resetPointsSelection()
      }}
      groupActivityOpen={groupActivityOpen}
      onToggleGroupActivity={() => {
        if (groupActivityOpen) setGroupActivityOpen(false)
        else setGroupModalOpen(true)
      }}
    />
  )

  return (
    <>
      <AnimatePresence>
        {splashOpen && (
          <SplashScreen
            classes={classes}
            onOpenClass={(id) => {
              setActiveClassId(id)
              setSplashOpen(false)
            }}
            onNewClass={startNewClassFromSplash}
            onSetUpFirst={setUpFirstClass}
            canAddClass={classes.length < MAX_CLASSES}
          />
        )}
      </AnimatePresence>

      <div
        // data-ink is where a theme may repaint the whole ground. The comic theme lays a
        // halftone lattice over this gradient, which it can only do by replacing
        // background-image wholesale - Tailwind's gradient owns that property.
        data-ink="canvas"
        className={`flex h-[100dvh] w-[100dvw] gap-3 bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-2 sm:p-3 ${
          panelSide === 'right' ? 'flex-row-reverse' : 'flex-row'
        }`}
        onPointerDownCapture={primeAudio}
      >
        <motion.div layout transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="flex shrink-0">
          {sidePanel}
        </motion.div>

        <motion.div layout transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {/* Hidden entirely until a goal exists - a meter on screen is a meter the class
              will ask about every lesson, whether or not the teacher wanted one. */}
          {(activeClass.pointsGoal ?? 0) > 0 && activeClass.goalEnabled !== false && (
            <PointsMeter
              classId={activeClass.id}
              classPoints={activeClass.classPoints ?? 0}
              goal={activeClass.pointsGoal ?? 0}
              celebrationGifId={activeClass.celebrationGifId}
              onOpenGoalSettings={() => setPickerSettingsOpen(true)}
            />
          )}

          <SeatClassBanner unseatedCount={unseatedStudents.length} onSeatClass={() => seatClass(activeClass.id)} />

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <DeskGrid
              seating={seating}
              studentsById={studentsById}
              selectedDesk={selectedDesk}
              pointsSelection={activeSelection}
              landedTick={spentDelta === null ? 0 : landedTick}
              staggerWiggle={staggerWiggle}
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
                      resetPointsSelection()
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Group Activity slides in from the side the way a class turns to face its
                teams - and back out the same way when the board returns. */}
            <AnimatePresence>
              {groupActivityOpen && (
                <motion.div
                  initial={{ x: '100%', opacity: 0.6 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0.6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 32 }}
                  className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]"
                >
                  <GroupActivity
                    groups={groups}
                    studentsById={studentsById}
                    pointsMode={effectiveGroupPointsMode(activeClass)}
                    dealTick={dealTick}
                    canShuffle={groupScheme !== null}
                    onAdjustPoints={(groupId, delta) => adjustGroupPoints(activeClass.id, groupId, delta)}
                    onMove={(studentId, groupId) => moveStudentToGroup(activeClass.id, studentId, groupId)}
                    onRename={(groupId, name) => renameGroup(activeClass.id, groupId, name)}
                    onNewGroups={() => setGroupModalOpen(true)}
                    onShuffle={shuffleGroups}
                    onHide={() => setGroupActivityOpen(false)}
                    onDone={finishGroups}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </motion.div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={() => setToast(null)}
            className="fixed bottom-5 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-black/10 bg-card px-5 py-3 text-center font-semibold text-card-foreground shadow-2xl dark:border-white/10"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <GroupActivityModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        activeClass={activeClass}
        studentsById={studentsById}
        lastGroups={groups}
        onStart={startGroups}
        onContinue={continueGroups}
        onSetPointsMode={(mode) => setGroupPointsMode(activeClass.id, mode)}
      />

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

      <PickersPointsModal
        open={pickerSettingsOpen}
        onClose={() => setPickerSettingsOpen(false)}
        settings={picker.settings}
        onUpdateSettings={picker.updateSettings}
        studentPickCounts={picker.studentPickCounts}
        columnPickCounts={picker.columnPickCounts}
        studentsById={studentsById}
        activeClass={activeClass}
        onSaveGoal={(goal, starsPer) => setGoalSettings(activeClass.id, goal, starsPer)}
        onSetGoalEnabled={(enabled) => setGoalEnabled(activeClass.id, enabled)}
        onSetCelebrationGif={(gifId) => setCelebrationGif(activeClass.id, gifId)}
        onResetClassGoal={() => resetClassGoal(activeClass.id)}
        onResetStars={() => resetPoints(activeClass.id)}
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
        onSetTheme={(next) => {
          // A pick from the picker is the only thing that gets remembered - see chooseTheme.
          setTheme(next)
          chooseTheme(next)
        }}
      />
    </>
  )
}
