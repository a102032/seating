import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClassSettingsModal, type SettingsTab } from './components/ClassSettingsModal'
import { DeskGrid } from './components/DeskGrid'
import { FlipDeck } from './components/FlipDeck'
import { FlipDeckSettingsModal } from './components/FlipDeckSettingsModal'
import { FloatingGoal } from './components/FloatingGoal'
import { GroupActivity } from './components/GroupActivity'
import { GroupActivityModal } from './components/GroupActivityModal'
import { GroupExitModal } from './components/GroupExitModal'
import { PickersPointsModal } from './components/PickersPointsModal'
import { PointsMeter } from './components/PointsMeter'
import { SeatClassBanner } from './components/SeatClassBanner'
import { SidePanel } from './components/SidePanel'
import { SplashScreen } from './components/SplashScreen'
import { AccountQuestionModal, SwitchTeacherModal } from './components/Account'
import { TimerSettingsModal } from './components/TimerSettingsModal'
import { goalIsLive, starsWaitOnDesks, useClasses } from './hooks/useClasses'
import { useFlipDeck } from './hooks/useFlipDeck'
import { canFloat, FLOAT_SIZE, useAppInFront, useFloatingWindow } from './hooks/useFloatingWindow'
import { useGroupPicker } from './hooks/useGroupPicker'
import { usePicker } from './hooks/usePicker'
import { buildGroups, pruneGroups, summarizeGroupPoints, type GroupScheme } from './lib/groups'
import { pickChances } from './lib/participation'
import { playCoinTick, playGroupsDone, playPointDeduct, playShuffle, primeAudio } from './lib/sound'
import { flyStarsToGoal } from './lib/starFlight'
import { applyTheme, chooseTheme, loadTheme, type Theme } from './lib/theme'
import { absentOn, attendanceTakenOn, dateKey } from './lib/attendance'
import { planFor } from './lib/layouts'
import { type Student, type TimerSettings } from './types'

const DEFAULT_TIMER_SETTINGS: TimerSettings = { warningEnabled: true, alarmSound: 'ding', face: 'flip' }
const PANEL_SIDE_KEY = 'seating-chart-panel-side-v1'
const GROUP_CHIMES_KEY = 'seating-chart-group-chimes-v1'

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

function loadGroupChimes(): boolean {
  try {
    return localStorage.getItem(GROUP_CHIMES_KEY) !== '0'
  } catch {
    return true
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
    bankDeskStars,
    setStarsOnDesks,
    recordPick,
    startNewRound,
    setGoalSettings,
    setGoalEnabled,
    setShowAllHomerooms,
    setCelebrationGif,
    resetClassGoal,
    setClassPoints,
    addToClassGoal,
    deleteStudent,
    swapSeats,
    seatClass,
    mixUpSeats,
    setLayout,
    unseatAll,
    unseatStudent,
    toggleAbsent,
    markAttendanceTaken,
    toggleAbsentInRecord,
    unseatedStudents,
    setGroups,
    adjustGroupPoints,
    resetGroupPoints,
    moveStudentToGroup,
    setGroupStatus,
    finishGroupActivity,
    cloud,
    saveError,
  } = useClasses()

  /**
   * Switch teacher, from the splash or the side panel's Saved mark. Whether the board has changes
   * the account hasn't got is read as it opens, since switching would lose them.
   */
  const [switchTeacher, setSwitchTeacher] = useState<{ unsent: boolean } | null>(null)
  const openSwitchTeacher = () => setSwitchTeacher({ unsent: cloud.status !== 'saved' && cloud.unsent() })

  const [swapMode, setSwapMode] = useState(false)
  const [attendanceMode, setAttendanceMode] = useState(false)
  /**
   * Today, for the attendance record. Re-read every minute and whenever the app comes back
   * into view, so a board left open overnight starts the morning with everyone present
   * rather than showing yesterday's absences until something happens to redraw it.
   */
  const [today, setToday] = useState(dateKey)
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('students')
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false)
  const [pickerSettingsOpen, setPickerSettingsOpen] = useState(false)
  const [flipDeckOpen, setFlipDeckOpen] = useState(false)
  const [flipSettingsOpen, setFlipSettingsOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupActivityOpen, setGroupActivityOpen] = useState(false)
  /** How the current groups were made, so Shuffle can deal the same shape again. Null for saved groups. */
  const [groupScheme, setGroupScheme] = useState<GroupScheme | null>(null)
  /** Non-zero asks the activity to deal; bumped for every deal, and set back to 0 when saved groups are picked up. */
  const [dealTick, setDealTick] = useState(0)
  /** Whether the current deal came from Shuffle, which is the only thing that riffles. */
  const [dealWasShuffle, setDealWasShuffle] = useState(false)
  /** Exit was tapped with points still on the board, and the teacher is being asked what to do with them. */
  const [exitPromptOpen, setExitPromptOpen] = useState(false)
  /** Students are at the board: only the status lights answer to a tap. Cleared by a new deal or a class switch. */
  const [groupsLocked, setGroupsLocked] = useState(false)
  const [groupChimes, setGroupChimes] = useState(loadGroupChimes)
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
  /** The class goal in its own small window over the lesson, so a point doesn't mean switching apps. */
  const { win: floatWin, open: openFloat, close: closeFloat } = useFloatingWindow(theme)
  const appInFront = useAppInFront()
  /** A goal filled from the floating window, whose chest is waiting for the app to be in front. */
  const [goalWaiting, setGoalWaiting] = useState(false)
  const goalLive = activeClass ? goalIsLive(activeClass) : false
  /** Stars wait on the desks for All Stars In!, rather than flying straight to the goal. */
  const desksMode = activeClass ? starsWaitOnDesks(activeClass) : false

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // No goal, nothing to float: switching the goal off in Pickers & Points takes the window with it.
  useEffect(() => {
    if (!goalLive) closeFloat()
  }, [goalLive, closeFloat])

  useEffect(() => {
    resetPointsSelection()
    // Another class is another set of groups; the activity closes rather than showing them.
    setGroupActivityOpen(false)
    setGroupScheme(null)
    setGroupsLocked(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassId])

  useEffect(() => {
    const refresh = () => setToday(dateKey())
    const interval = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const seating = activeClass?.seating ?? []
  /** Where the desks stand: the class's layout, grown for a big class. */
  const plan = planFor(activeClass)
  const setOf = useCallback((deskIndex: number) => plan.seats[deskIndex]?.set ?? -1, [plan])
  const absentIds = useMemo(() => absentOn(activeClass, today), [activeClass, today])
  /**
   * The seating chart as the lesson sees it today: an absent student's desk counts as empty
   * for everything that chooses students - the pickers, the flip cards, Pick All, new groups.
   * The real seating is untouched; they're back in their seat tomorrow.
   */
  const presentSeating = useMemo(
    () => (activeClass?.seating ?? []).map((id) => (id && absentIds.has(id) ? null : id)),
    [activeClass, absentIds],
  )
  /**
   * Who has had a turn, for the pickers: the students picked less often lately get a better
   * chance (lib/participation). Read again as the record grows, which is cheap.
   */
  const chances = useMemo(() => (activeClass ? pickChances(activeClass, today) : new Map<string, number>()), [activeClass, today])
  const chanceOf = useCallback((id: string) => chances.get(id) ?? 1, [chances])
  /** Pick Student's round, kept with the class so a reload doesn't start it over. A new day is a new round. */
  const pickRound = activeClass?.pickRound
  const pickedThisRound = useMemo(() => new Set(pickRound && pickRound.day === today ? pickRound.ids : []), [pickRound, today])
  const picker = usePicker(presentSeating, activeClassId, plan, {
    picked: pickedThisRound,
    chanceOf,
    onPicked: (id, round) => {
      if (activeClassId) recordPick(activeClassId, id, today, round)
    },
  })
  const seatedIds = useMemo(() => presentSeating.filter((id): id is string => Boolean(id)), [presentSeating])

  /**
   * A pick started from the floating class goal runs on that window's clock, which stops for
   * good if the window closes mid-flash. Without this the picker would be left flashing
   * forever, with Pick Student greyed out.
   */
  const pickOnFloatClock = useRef(false)
  const { mode: pickMode, dismiss: dismissPick } = picker
  useEffect(() => {
    if (pickMode !== 'student-flashing') {
      pickOnFloatClock.current = false
      return
    }
    if (!floatWin && pickOnFloatClock.current) {
      pickOnFloatClock.current = false
      dismissPick()
    }
  }, [floatWin, pickMode, dismissPick])

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>()
    activeClass?.students.forEach((s) => map.set(s.id, s))
    return map
  }, [activeClass])

  const deck = useFlipDeck(seatedIds, activeClassId, flipDeckOpen, {
    genderOf: (id) => studentsById.get(id)?.gender ?? 'unspecified',
    // Bonus points land the way any award does, class meter included. Everyone +1 is the whole
    // class, so it isn't in the participation record; a jackpot is one student's.
    onEveryone: () => {
      if (!activeClassId) return
      if (goalLive && !desksMode) flyStarsToGoal(seatedIds)
      adjustPoints(activeClassId, seatedIds, 1)
    },
    onJackpot: (id, points) => {
      if (!activeClassId) return
      if (goalLive && !desksMode) flyStarsToGoal([id])
      adjustPoints(activeClassId, [id], points, today)
    },
    onTurned: (id) => {
      if (activeClassId) recordPick(activeClassId, id, today)
    },
  })

  /** The saved groups as they stand today - anyone who has left their desk since is out. */
  const groups = useMemo(() => pruneGroups(activeClass?.groups ?? [], activeClass?.seating ?? []), [activeClass])
  /**
   * The pickers, while the group cards are up. The seating chart's picker lights up desks,
   * which are behind the cards and so invisible here, which is why the panel's two picker
   * buttons hand over to this one instead of being greyed out.
   */
  const pickableGroups = useMemo(
    () => groups.map((g) => ({ ...g, studentIds: g.studentIds.filter((id) => !absentIds.has(id)) })),
    [groups, absentIds],
  )
  const groupPicker = useGroupPicker(pickableGroups, {
    allowRepeats: picker.settings.allowRepeats,
    soundEnabled: picker.settings.soundEnabled,
    resetKey: dealTick,
    chanceOf,
    onStudentPicked: (id) => {
      if (activeClassId) recordPick(activeClassId, id, today)
    },
  })

  function openGroupActivity() {
    setFlipDeckOpen(false)
    resetPointsSelection()
    setGroupActivityOpen(true)
  }

  function startGroups(scheme: GroupScheme) {
    if (!activeClassId) return
    setGroups(activeClassId, buildGroups(scheme, presentSeating, studentsById, groups, setOf))
    setGroupScheme(scheme)
    setDealWasShuffle(false)
    setDealTick((t) => t + 1)
    setGroupsLocked(false)
    openGroupActivity()
  }

  function updateGroupChimes(on: boolean) {
    setGroupChimes(on)
    remember(GROUP_CHIMES_KEY, on ? '1' : '0')
  }

  function continueGroups() {
    if (!activeClassId) return
    setGroups(activeClassId, groups)
    setGroupScheme(null)
    setDealTick(0)
    openGroupActivity()
  }

  function shuffleGroups() {
    if (!activeClassId || !groupScheme) return
    setGroups(activeClassId, buildGroups(groupScheme, presentSeating, studentsById, groups, setOf))
    setDealWasShuffle(true)
    setDealTick((t) => t + 1)
  }

  /**
   * One way out. With nothing on the scoreboard it just closes; with points, the teacher is
   * asked whether they go out now or wait with the groups - handing thirty students their
   * stars is not something that should happen as a side effect of leaving a screen.
   */
  function requestExitGroups() {
    groupPicker.dismiss()
    if (summarizeGroupPoints(groups).totalPoints > 0) setExitPromptOpen(true)
    else setGroupActivityOpen(false)
  }

  /** The points go onto the class goal, and the board comes back. */
  function giveOutGroupPoints() {
    if (!activeClass) return
    const { totalPoints } = summarizeGroupPoints(groups)
    finishGroupActivity(activeClass.id)
    setExitPromptOpen(false)
    setGroupActivityOpen(false)
    playGroupsDone()
    setToast({ id: Date.now(), text: `${totalPoints} point${totalPoints === 1 ? '' : 's'} added to the class goal.` })
  }

  /**
   * Settings opens on the roster, except for a class just made from the splash: that one needs
   * its name first, and the name is on the Class tab.
   */
  function openSettings(tab: SettingsTab = 'students') {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }

  /**
   * A brand-new teacher's first sign-in goes straight to setting up a class: the splash steps
   * aside and Class Settings opens on the Class tab, on the empty class useClasses already made
   * (so not a second one beside it). Only for a sign-in made here and now, onto a fresh board -
   * a teacher whose account already has classes gets them as cards on the splash, and opening
   * the app already signed in is not a sign-in.
   */
  const signedInAtStart = useRef(Boolean(cloud.account))
  useEffect(() => {
    if (!cloud.account) {
      signedInAtStart.current = false
      return
    }
    if (signedInAtStart.current) return
    signedInAtStart.current = true
    const fresh = classes.length === 1 && classes[0].students.length === 0
    if (fresh && splashOpen) {
      setSplashOpen(false)
      openSettings('class')
    }
    // Only the moment the account arrives counts; classes and the splash are read as they are then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.account])

  // A full or locked-down storage refuses a write by throwing. Unguarded, moving the panel
  // took the whole app down with it; now the choice just isn't remembered.
  function remember(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
  }

  function updateTimerSettings(next: TimerSettings) {
    setTimerSettings(next)
    remember('seating-chart-timer-settings-v1', JSON.stringify(next))
  }

  function togglePanelSide() {
    const next = panelSide === 'left' ? 'right' : 'left'
    setPanelSide(next)
    remember(PANEL_SIDE_KEY, next)
  }

  function handleTapDesk(index: number) {
    if (!activeClassId) return
    if (attendanceMode) {
      const studentId = seating[index]
      if (studentId) toggleAbsent(activeClassId, studentId, today)
      return
    }
    if (picker.hasResult) {
      picker.dismiss()
      return
    }
    if (!swapMode) {
      const studentId = seating[index]
      // Nobody earns a star on a day they aren't here, so an absent desk doesn't select.
      if (!studentId || absentIds.has(studentId)) return
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
   * The flip cards work the same way: whoever was flipped last has the turn, and the points.
   */
  const activeSelection = useMemo(() => {
    if (flipDeckOpen) return new Set(deck.activeId ? [deck.activeId] : [])
    return picker.hasResult ? new Set(picker.winnerStudentIds) : pointsSelection
  }, [flipDeckOpen, deck.activeId, picker.hasResult, picker.winnerStudentIds, pointsSelection])

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
    // Pick All takes the board over, as a pick does: a pick still showing would otherwise keep
    // the points, and + went to the one picked student instead of the class.
    if (picker.hasResult) picker.dismiss()
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

  // Minus is only for stars waiting on the desks - one already in the jar never comes out - and
  // stars are floored at 0, so it only means something when someone selected has one.
  const canDeductPoint = desksMode && Array.from(activeSelection).some((id) => (studentsById.get(id)?.points ?? 0) > 0)

  function applyPointsDelta(delta: number) {
    if (!activeClassId || activeSelection.size === 0) return
    // No sound of a point going when there was nothing to take.
    if (delta < 0 && !canDeductPoint) return
    const ids = Array.from(activeSelection)
    // Straight to the goal: a star flies from each desk into the jar, and the meter moves as it
    // lands. Only while there is a jar on the board to fly to. On the desks, the star stays put.
    if (delta > 0 && goalLive && !desksMode) flyStarsToGoal(ids)
    // Everyone selected is the whole class (Pick All), which says nothing about one child, so
    // only a star given to some students goes in the participation record.
    const wholeClass = seatedIds.length > 1 && seatedIds.every((id) => activeSelection.has(id))
    adjustPoints(activeClassId, ids, delta, wholeClass ? undefined : today)
    // Awards straight to the goal already sound: the coin ticks when the meter moves. A star
    // that stays on a desk, or lands with no goal on, moves no meter, so it ticks here. Taking
    // a point away never moves the meter by design, so without this the minus button was
    // silent - the teacher pressed it and nothing said it had landed.
    if (delta < 0) playPointDeduct()
    else if (desksMode || !goalLive) playCoinTick()
    // Awarding deliberately changes nothing about what the board is showing: a pick stays a
    // pick, a selection stays selected. Only the desks react, and only for a moment. The
    // dimmed board is the record of what is selected, so it doesn't need a timer to expire -
    // the next thing the teacher does ends the round.
    setStaggerWiggle(false)
    setLandedTick((t) => t + 1)
    setSpentDelta(delta)
  }

  /**
   * All Stars In!: every desk's stars fly into the jar at once - one star from each desk that has
   * some, so a whole class pours in - and the desks start the next lesson empty. Only ever from a
   * tap: stars left on the desks wait there for next time.
   */
  function allStarsIn() {
    if (!activeClass) return
    const waiting = activeClass.students.filter((s) => (s.points ?? 0) > 0).map((s) => s.id)
    if (waiting.length === 0) return
    flyStarsToGoal(waiting)
    bankDeskStars(activeClass.id)
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
      attendanceMode={attendanceMode}
      attendanceTaken={attendanceTakenOn(activeClass, today)}
      onToggleAttendance={() => {
        // Switching it off is what records the day, so a class with nobody away gets its
        // check from on-then-off, with no separate button to find.
        if (attendanceMode) markAttendanceTaken(activeClass.id, today)
        else {
          picker.dismiss()
          resetPointsSelection()
        }
        setAttendanceMode(!attendanceMode)
      }}
      onPickStudent={() => (groupActivityOpen ? groupPicker.run('student') : startPick(picker.pickStudent))}
      onPickRow={() => (groupActivityOpen ? groupPicker.run('group') : startPick(picker.pickRow))}
      groupMode={groupActivityOpen}
      // During a group activity the "set" Pick Student can stay inside is the picked group.
      rowLocked={groupActivityOpen ? groupPicker.lockedGroupId !== null : picker.rowLocked}
      rowLockBinds={groupActivityOpen ? groupPicker.lockBinds : picker.rowLockBinds}
      setName={plan.setName}
      studentPickActive={
        groupActivityOpen ? groupPicker.pick?.kind === 'student' : picker.mode === 'student-flashing' || picker.mode === 'student-result'
      }
      rowPickActive={
        groupActivityOpen ? groupPicker.pick?.kind === 'group' : picker.mode === 'row-flashing' || picker.mode === 'row-result'
      }
      onOpenSettings={() => openSettings()}
      onOpenPickerSettings={() => setPickerSettingsOpen(true)}
      timerSettings={timerSettings}
      onOpenTimerSettings={() => setTimerSettingsOpen(true)}
      side={panelSide}
      onToggleSide={togglePanelSide}
      saveError={saveError}
      cloud={cloud}
      onSwitchTeacher={openSwitchTeacher}
      pointsSelectedCount={activeSelection.size}
      allSeatedSelected={seatedIds.length > 0 && seatedIds.every((id) => activeSelection.has(id))}
      onToggleSelectAll={toggleSelectAll}
      onAwardPoint={() => applyPointsDelta(1)}
      onDeductPoint={() => applyPointsDelta(-1)}
      showMinus={desksMode}
      canDeductPoint={canDeductPoint}
      flipDeckOpen={flipDeckOpen}
      pickFlashing={picker.isPicking}
      flipActiveName={deck.activeId ? (studentsById.get(deck.activeId)?.name ?? null) : null}
      onToggleFlipDeck={() => {
        // Deal outside the state updater - React may run an updater more than once, which
        // would deal (and sound) twice.
        const opening = !flipDeckOpen
        // A finished pick would otherwise still be lit up behind the deck, and waiting there
        // for the teacher when the cards go away.
        if (opening) picker.dismiss()
        setFlipDeckOpen(opening)
        if (opening) deck.deal()
        resetPointsSelection()
      }}
      groupActivityOpen={groupActivityOpen}
      groupActivityLocked={groupActivityOpen && groupsLocked}
      groupsLocked={groupActivityOpen && groupsLocked}
      onToggleGroupActivity={() => {
        if (groupActivityOpen) requestExitGroups()
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
              // The board knows the teacher but its link to their Google account has dropped:
              // the tap that opens the class asks Google to reconnect them. Their window usually
              // closes by itself; if it's closed, the class is open anyway and the Saved mark
              // keeps Sign in again.
              if (cloud.needsSignIn) void cloud.signIn()
              setActiveClassId(id)
              setSplashOpen(false)
            }}
            account={cloud.account}
            signingIn={cloud.signingIn}
            signInError={cloud.signInError}
            onSignIn={() => void cloud.signIn()}
            onSwitchTeacher={openSwitchTeacher}
          />
        )}
      </AnimatePresence>
      <AccountQuestionModal question={cloud.question} onAnswer={cloud.answerQuestion} />
      {cloud.account && (
        <SwitchTeacherModal
          account={cloud.account}
          open={switchTeacher !== null}
          unsent={switchTeacher?.unsent ?? false}
          onCancel={() => setSwitchTeacher(null)}
          onConfirm={() => void cloud.switchTeacher()}
        />
      )}

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
        {/* Plain boxes, deliberately. They were framer layout boxes so the panel glided when it
            moved to the other side - a once-a-term change - and that made framer measure the
            page on every render: every desk tap, every point, every picker flash. */}
        <div className="flex shrink-0">{sidePanel}</div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {/* Hidden entirely until a goal exists - a meter on screen is a meter the class
              will ask about every lesson, whether or not the teacher wanted one. */}
          {(activeClass.pointsGoal ?? 0) > 0 && activeClass.goalEnabled !== false && (
            <PointsMeter
              classId={activeClass.id}
              classPoints={activeClass.classPoints ?? 0}
              goalsReached={activeClass.goalsReached ?? 0}
              goal={activeClass.pointsGoal ?? 0}
              celebrationGifId={activeClass.celebrationGifId}
              onOpenGoalSettings={() => setPickerSettingsOpen(true)}
              holdCelebration={!appInFront}
              onWaitingChange={setGoalWaiting}
              floating={floatWin !== null}
              onToggleFloat={canFloat ? () => (floatWin ? closeFloat() : void openFloat(FLOAT_SIZE)) : undefined}
              deskStars={desksMode ? activeClass.students.reduce((n, s) => n + (s.points ?? 0), 0) : null}
              onAllStarsIn={allStarsIn}
            />
          )}

          <SeatClassBanner unseatedCount={unseatedStudents.length} onSeatClass={() => seatClass(activeClass.id)} />

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <DeskGrid
              seating={seating}
              plan={plan}
              studentsById={studentsById}
              selectedDesk={selectedDesk}
              pointsSelection={activeSelection}
              landedTick={spentDelta === null ? 0 : landedTick}
              staggerWiggle={staggerWiggle}
              deskHighlights={picker.deskHighlights}
              absentIds={absentIds}
              showStars={desksMode}
              showAllHomerooms={activeClass.showAllHomerooms === true}
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
                  data-ink="board"
                  className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]"
                >
                  <FlipDeck
                    deck={deck}
                    studentsById={studentsById}
                    showStars={desksMode}
                    showAllHomerooms={activeClass.showAllHomerooms === true}
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
                  data-ink="board"
                  className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]"
                >
                  <GroupActivity
                    groups={groups}
                    studentsById={studentsById}
                    absentIds={absentIds}
                    dealTick={dealTick}
                    dealWasShuffle={dealWasShuffle}
                    canShuffle={groupScheme !== null}
                    onResetPoints={() => resetGroupPoints(activeClass.id)}
                    onAdjustPoints={(groupId, delta) => adjustGroupPoints(activeClass.id, groupId, delta)}
                    onMove={(studentId, groupId) => moveStudentToGroup(activeClass.id, studentId, groupId)}
                    onNewGroups={() => setGroupModalOpen(true)}
                    onShuffle={shuffleGroups}
                    onExit={requestExitGroups}
                    onSetStatus={(groupId, status) => setGroupStatus(activeClass.id, groupId, status)}
                    chimes={groupChimes}
                    locked={groupsLocked}
                    onToggleLock={() => setGroupsLocked((v) => !v)}
                    pick={groupPicker.pick}
                    lockedGroupId={groupPicker.lockedGroupId}
                    onDismissPick={groupPicker.dismiss}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
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
        seating={presentSeating}
        studentsById={studentsById}
        setOf={setOf}
        setName={plan.setName}
        lastGroups={groups}
        onStart={startGroups}
        onContinue={continueGroups}
        chimes={groupChimes}
        onSetChimes={updateGroupChimes}
      />

      <GroupExitModal
        open={exitPromptOpen}
        onClose={() => setExitPromptOpen(false)}
        groups={groups}
        onGiveOut={giveOutGroupPoints}
        onKeep={() => {
          setExitPromptOpen(false)
          setGroupActivityOpen(false)
        }}
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
        roundStarted={deck.roundStarted}
      />

      <PickersPointsModal
        open={pickerSettingsOpen}
        onClose={() => setPickerSettingsOpen(false)}
        settings={picker.settings}
        onUpdateSettings={picker.updateSettings}
        activeClass={activeClass}
        roundStarted={pickedThisRound.size > 0 || picker.rowsPicked > 0}
        onStartNewRound={() => {
          startNewRound(activeClass.id)
          picker.resetRows()
        }}
        onSaveGoal={(goal, starsPer) => setGoalSettings(activeClass.id, goal, starsPer)}
        onSetGoalEnabled={(enabled) => setGoalEnabled(activeClass.id, enabled)}
        onSetStarsOnDesks={(on) => setStarsOnDesks(activeClass.id, on)}
        onSetCelebrationGif={(gifId) => setCelebrationGif(activeClass.id, gifId)}
        onResetClassGoal={() => resetClassGoal(activeClass.id)}
        onSetClassPoints={(points) => setClassPoints(activeClass.id, points)}
      />

      <ClassSettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
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
        onMixUpSeats={() => {
          // A pick is ringed by desk, and that desk now holds somebody else.
          picker.dismiss()
          mixUpSeats(activeClass.id)
          playShuffle()
        }}
        onSetLayout={(layout) => setLayout(activeClass.id, layout)}
        onSetShowAllHomerooms={(show) => setShowAllHomerooms(activeClass.id, show)}
        onToggleAbsentInRecord={(studentId, day) => toggleAbsentInRecord(activeClass.id, studentId, day)}
        theme={theme}
        onSetTheme={(next) => {
          // A pick from the picker is the only thing that gets remembered - see chooseTheme.
          setTheme(next)
          chooseTheme(next)
        }}
        cloud={cloud}
        onSwitchTeacher={openSwitchTeacher}
      />

      {floatWin && goalLive && (
        <FloatingGoal
          win={floatWin}
          className={activeClass.name}
          classPoints={activeClass.classPoints ?? 0}
          goal={activeClass.pointsGoal ?? 0}
          waiting={goalWaiting}
          onAdd={() => addToClassGoal(activeClass.id, 1)}
          // The browser may or may not bring the app forward for this. Either way the chest
          // opens only once the app is in front, so the fanfare never plays behind the lesson.
          onCelebrate={() => window.focus()}
          pick={
            picker.mode === 'student-flashing' || picker.mode === 'student-result'
              ? {
                  name: (picker.shownStudentId && studentsById.get(picker.shownStudentId)?.name) || '',
                  landed: picker.mode === 'student-result',
                }
              : null
          }
          // Off whenever the side panel's Pick Student would be, or it would pick behind cards.
          canPick={!picker.isPicking && !swapMode && !attendanceMode && !flipDeckOpen && !groupActivityOpen && seatedIds.length > 0}
          onPick={() => {
            pickOnFloatClock.current = true
            startPick(() => picker.pickStudent(floatWin))
          }}
          onClearPick={picker.dismiss}
        />
      )}
    </>
  )
}
