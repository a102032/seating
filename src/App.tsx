import { AnimatePresence, motion } from 'framer-motion'
import { PictureInPicture2, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClassSettingsModal, type SettingsTab } from './components/ClassSettingsModal'
import { ChooseAvatarBanner, ChooseAvatarPicker } from './components/ChooseAvatars'
import { ClassTitle } from './components/ClassTitle'
import { GetReady } from './components/GetReady'
import { DeskGrid } from './components/DeskGrid'
import { FlipDeck } from './components/FlipDeck'
import { FlipDeckSettingsModal } from './components/FlipDeckSettingsModal'
import { FloatingGoal } from './components/FloatingGoal'
import { SetupGuide } from './components/SetupGuide'
import { GUIDE_STEPS, nextStep, rememberGuideDone, shouldGuide, type GuideStepId } from './lib/setupGuide'
import { GroupActivity } from './components/GroupActivity'
import { GroupActivityModal } from './components/GroupActivityModal'
import { GroupExitModal } from './components/GroupExitModal'
import { PickersPointsModal } from './components/PickersPointsModal'
import { PointsMeter } from './components/PointsMeter'
import { SeatClassBanner } from './components/SeatClassBanner'
import { SidePanel } from './components/SidePanel'
import { SplashScreen } from './components/SplashScreen'
import { TactileButton } from './components/TactileButton'
import { AccountQuestionModal, SwitchTeacherModal } from './components/Account'
import { TimerSettingsModal } from './components/TimerSettingsModal'
import { DEFAULT_GET_READY_PRIZE } from './lib/getReady'
import { goalIsLive, starsWaitOnDesks, useClasses } from './hooks/useClasses'
import { useFlipDeck } from './hooks/useFlipDeck'
import { canFloat, FLOAT_SIZE, useAppInFront, useFloatingWindow } from './hooks/useFloatingWindow'
import { useGroupPicker } from './hooks/useGroupPicker'
import { usePicker } from './hooks/usePicker'
import { buildGroups, pruneGroups, summarizeGroupPoints, type GroupScheme } from './lib/groups'
import { pickChances } from './lib/participation'
import { playCoinTick, playGroupsDone, playPointDeduct, playShuffle, primeAudio } from './lib/sound'
import { flyStarsFrom, flyStarsToGoal } from './lib/starFlight'
import { resolveAvatarSrc, studentsAsShown } from './lib/stickers'
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
    deleteStudents,
    replaceStudents,
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
    setAvatarsOff,
    setGetReady,
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
   * Switch Teacher, from the splash or the side panel's Saved mark. Whether the board has changes
   * the account hasn't got is read as it opens, since switching would lose them.
   */
  const [switchTeacher, setSwitchTeacher] = useState<{ unsent: boolean } | null>(null)
  const openSwitchTeacher = () => setSwitchTeacher({ unsent: cloud.status !== 'saved' && cloud.unsent() })

  const [swapMode, setSwapMode] = useState(false)
  /** Get Ready! is up: "How long?", then the star. */
  const [getReadyOpen, setGetReadyOpen] = useState(false)
  /** Get Ready!'s stars are landing: the meter sits above its faded board. */
  const [meterLifted, setMeterLifted] = useState(false)
  const [attendanceMode, setAttendanceMode] = useState(false)
  /** Choose Your Avatar: the children come up and tap their own desk to choose. */
  const [choosingAvatars, setChoosingAvatars] = useState(false)
  /** Whose picker is open in Choose Your Avatar. */
  const [choosingFor, setChoosingFor] = useState<string | null>(null)
  /** When the last picker closed: the board's second touch lands on the desk under it. */
  const chooseClosedAt = useRef(0)
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
  /** The guided first setup's step, while it runs (lib/setupGuide). */
  const [guideStep, setGuideStep] = useState<GuideStepId | null>(null)
  /** How many students the class had as the step began: adding some moves "Add your students" on. */
  const [guideStudents, setGuideStudents] = useState(0)
  /** Get Ready! is running in the floating window, so the side panel's stands down. */
  const [floatReadying, setFloatReadying] = useState(false)
  if (!floatWin && floatReadying) setFloatReadying(false)
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

  // As the board shows them: with the class's avatars switched off, names only (each student's
  // own pick is kept in the roster).
  const studentsById = useMemo(() => {
    const map = new Map<string, Student>()
    if (activeClass) studentsAsShown(activeClass).forEach((s) => map.set(s.id, s))
    return map
  }, [activeClass])

  const deck = useFlipDeck(seatedIds, activeClassId, flipDeckOpen, {
    genderOf: (id) => studentsById.get(id)?.gender ?? 'unspecified',
    giftsAllowed: () => goalLive,
    // A Mystery Gift's stars are the whole class's, straight into the chest in either way of
    // running points, so they go in no one's participation record. They fly from the card,
    // one a star, and the meter waits for them to land.
    onGift: (cardId, stars) => {
      if (!activeClassId) return
      const box = document.querySelector(`[data-flip-card="${CSS.escape(cardId)}"]`)?.getBoundingClientRect()
      if (box) flyStarsFrom(box.left + box.width / 2, box.top + box.height / 2, stars, Math.min(56, box.width * 0.3), { loud: false })
      addToClassGoal(activeClassId, stars)
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
    setGroups(activeClassId, buildGroups(scheme, presentSeating, studentsById, groups, plan), scheme)
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
    // Remembered with the class, so Shuffle works after Continue too.
    setGroupScheme(activeClass?.groupsMadeBy ?? null)
    setDealTick(0)
    openGroupActivity()
  }

  function shuffleGroups() {
    if (!activeClassId || !groupScheme) return
    // Shuffle mixes everyone at random, into the same number of cards: the seats made the first deal.
    setGroups(activeClassId, buildGroups(groupScheme, presentSeating, studentsById, groups, plan, { mix: true }))
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
   * The guided setup moves the teacher from one step to the next, opening the window each step
   * happens in: a tab of Class Settings, Pickers & Points, or neither for the last word.
   */
  function goToStep(id: GuideStepId | null) {
    if (id === null) {
      endGuide()
      return
    }
    const place = GUIDE_STEPS.find((step) => step.id === id)!.place
    setGuideStep(id)
    setGuideStudents(activeClass?.students.length ?? 0)
    if (typeof place === 'object') {
      setPickerSettingsOpen(false)
      openSettings(place.settings)
    } else {
      setSettingsOpen(false)
      setPickerSettingsOpen(place === 'pickers')
    }
  }

  function startGuide() {
    if (activeClass) goToStep(nextStep(null, activeClass))
  }

  function advanceGuide() {
    if (activeClass) goToStep(nextStep(guideStep, activeClass))
  }

  /** Done or skipped: not offered by itself again on this board (Guide Me brings it back). */
  function endGuide() {
    setGuideStep(null)
    if (cloud.account) rememberGuideDone(cloud.account.uid)
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
      // Their first class: the guided setup walks them through it.
      if (shouldGuide(cloud.account.uid, classes)) startGuide()
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
    if (choosingAvatars) {
      const studentId = seating[index]
      // Away today, they can choose another day; and a picker just closed leaves the board's
      // second touch on the same desk, which would open it again.
      if (!studentId || absentIds.has(studentId) || performance.now() - chooseClosedAt.current < 700) return
      setChoosingFor(studentId)
      return
    }
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

  // "Add your students" moves on by itself once a list is in.
  if (guideStep === 'students' && activeClass.students.length > guideStudents) advanceGuide()

  /**
   * The goal's controls, at the top of the side panel where the class's name is when there's no
   * goal: Get Ready! and Float. Float belonged on the meter, because the meter is what floats,
   * until the teacher found buttons beside the meter took the eye from it. Get Ready! stands down
   * with the rest of the panel in Swap Seats and Attendance, and while a pick is flashing. Float
   * stays lit while the goal floats; where the browser can't float it, Get Ready! is alone.
   * The two share the row equally, like Attendance and Swap Seats under them, and Float sits on
   * the outside, the screen's edge, whichever side the panel is on (2026-10-05, the teacher):
   * Get Ready! is the one used mid-lesson, so it is the one nearer the board.
   */
  const evenly = '!gap-1.5 !px-2.5 !py-[var(--btn-py,0.5rem)] grow shrink basis-0 justify-center'
  const getReadyButton = (
    <TactileButton
      key="get-ready"
      active={getReadyOpen}
      disabled={swapMode || attendanceMode || choosingAvatars || picker.isPicking || floatReadying}
      onClick={() => setGetReadyOpen(true)}
      className={evenly}
      title="A star for getting ready quickly and quietly"
    >
      <Star size={16} className="fill-amber-400 text-amber-600" /> Get Ready!
    </TactileButton>
  )
  const floatButton = canFloat && (
    <TactileButton
      key="float"
      active={floatWin !== null}
      onClick={() => (floatWin ? closeFloat() : void openFloat(FLOAT_SIZE))}
      className={evenly}
      title={floatWin ? 'Close the floating class goal' : 'Float the class goal in a small window over your lesson'}
    >
      <PictureInPicture2 size={16} /> Float
    </TactileButton>
  )
  const goalControls = <>{panelSide === 'left' ? [floatButton, getReadyButton] : [getReadyButton, floatButton]}</>

  const sidePanel = (
    <SidePanel
      classes={classes}
      activeClassId={activeClassId}
      onSelectClass={setActiveClassId}
      // With a goal on, the class's name labels the goal meter and the goal's controls take its row.
      nameInBar={goalLive}
      goalControls={goalControls}
      deskStars={desksMode ? activeClass.students.reduce((n, s) => n + (s.points ?? 0), 0) : null}
      onAllStarsIn={allStarsIn}
      swapMode={swapMode}
      onToggleSwap={() => {
        setSwapMode((v) => !v)
        setSelectedDesk(null)
        resetPointsSelection()
      }}
      attendanceMode={attendanceMode}
      choosingAvatars={choosingAvatars}
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
            onNewClass={() => {
              if (cloud.needsSignIn) void cloud.signIn()
              // Made, opened, and straight to its name, as New Class in Class Settings does.
              createClass()
              setSplashOpen(false)
              openSettings('class')
              if (shouldGuide(cloud.account?.uid, classes)) startGuide()
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
              lifted={meterLifted}
              title={
                <ClassTitle
                  place="bar"
                  classes={classes}
                  activeClassId={activeClassId}
                  onSelectClass={setActiveClassId}
                  onOpenSettings={() => openSettings()}
                  disabled={swapMode || attendanceMode || choosingAvatars}
                  settingsDisabled={groupActivityOpen && groupsLocked}
                />
              }
            />
          )}

          {choosingAvatars ? (
            <ChooseAvatarBanner
              onDone={() => {
                setChoosingAvatars(false)
                setChoosingFor(null)
              }}
            />
          ) : (
            <SeatClassBanner unseatedCount={unseatedStudents.length} onSeatClass={() => seatClass(activeClass.id)} />
          )}

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
        plan={plan}
        setName={plan.setName}
        lastGroups={groups}
        lastMadeBy={activeClass.groupsMadeBy}
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
        goalLive={goalLive}
      />

      <PickersPointsModal
        open={pickerSettingsOpen}
        onClose={() => {
          setPickerSettingsOpen(false)
          if (guideStep === 'goal') advanceGuide()
        }}
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
        getReadyPrize={activeClass.getReadyPrize ?? DEFAULT_GET_READY_PRIZE}
        onSetGetReadyPrize={(prize) => setGetReady(activeClass.id, { getReadyPrize: prize })}
      />

      {/* Choose Your Avatar: the student whose desk was tapped picks from the characters, then a pose. */}
      <ChooseAvatarPicker
        student={choosingFor ? (activeClass.students.find((s) => s.id === choosingFor) ?? null) : null}
        onChoose={(avatarId) => {
          if (choosingFor) updateStudent(activeClass.id, choosingFor, { avatarId })
          chooseClosedAt.current = performance.now()
          setChoosingFor(null)
        }}
        onClose={() => {
          chooseClosedAt.current = performance.now()
          setChoosingFor(null)
        }}
      />

      {/* Get Ready! puts class points straight into the jar, so it fits both ways of running
          points; it is the whole class, so it goes in no one's participation record. */}
      <GetReady
        open={getReadyOpen && goalLive}
        lastDrum={activeClass.getReadyDrum}
        prize={activeClass.getReadyPrize ?? DEFAULT_GET_READY_PRIZE}
        onChooseDrum={(seconds) => setGetReady(activeClass.id, { getReadyDrum: seconds })}
        onAward={(stars) => addToClassGoal(activeClass.id, stars)}
        onLiftMeter={setMeterLifted}
        onClose={() => setGetReadyOpen(false)}
      />

      <ClassSettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        onClose={() => {
          setSettingsOpen(false)
          if (guideStep === 'seat') advanceGuide()
          else if (guideStep && typeof GUIDE_STEPS.find((step) => step.id === guideStep)?.place === 'object') endGuide()
        }}
        activeClass={activeClass}
        classes={classes}
        classesCount={classes.length}
        unseatedCount={unseatedStudents.length}
        onRename={(name) => renameClass(activeClass.id, name)}
        onAddStudents={(students) => addStudents(activeClass.id, students)}
        onRemoveStudents={(studentIds) => deleteStudents(activeClass.id, studentIds)}
        onReplaceStudents={(students) => replaceStudents(activeClass.id, students)}
        onUpdateStudent={(studentId, patch) => updateStudent(activeClass.id, studentId, patch)}
        onAssignAvatars={(themeId, options) => assignAvatars(activeClass.id, themeId, options)}
        onDeleteStudent={(studentId) => deleteStudent(activeClass.id, studentId)}
        onUnseatStudent={(studentId) => unseatStudent(activeClass.id, studentId)}
        onCreateClass={() => {
          createClass()
          if (shouldGuide(cloud.account?.uid, classes)) startGuide()
        }}
        onGuideMe={startGuide}
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
        onSetAvatarsOff={(off) => setAvatarsOff(activeClass.id, off)}
        onStudentsChoose={() => {
          // The desks have to be in view: the cards come down, and a pick or a selection on the
          // board goes, as for Attendance.
          setFlipDeckOpen(false)
          picker.dismiss()
          resetPointsSelection()
          setChoosingAvatars(true)
        }}
        studentsChooseBlocked={groupActivityOpen}
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

      {guideStep && !splashOpen && <SetupGuide step={guideStep} onNext={advanceGuide} onSkip={endGuide} />}

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
              ? (() => {
                  const shown = picker.shownStudentId ? studentsById.get(picker.shownStudentId) : undefined
                  return {
                    name: shown?.name ?? '',
                    // As the desks show them: none when the class's avatars are off.
                    avatarSrc: shown ? resolveAvatarSrc(shown) : null,
                    landed: picker.mode === 'student-result',
                  }
                })()
              : null
          }
          // Off whenever the side panel's Pick Student would be, or it would pick behind cards.
          canPick={
            !picker.isPicking &&
            !swapMode &&
            !attendanceMode &&
            !choosingAvatars &&
            !flipDeckOpen &&
            !groupActivityOpen &&
            seatedIds.length > 0
          }
          onPick={() => {
            pickOnFloatClock.current = true
            startPick(() => picker.pickStudent(floatWin))
          }}
          onClearPick={picker.dismiss}
          // The app's own Get Ready!, over the lesson: the same drums and prize, and it stands
          // down whenever the side panel's would.
          getReady={{
            canStart: !getReadyOpen && !picker.isPicking && !swapMode && !attendanceMode && !choosingAvatars,
            lastDrum: activeClass.getReadyDrum,
            prize: activeClass.getReadyPrize ?? DEFAULT_GET_READY_PRIZE,
            onChooseDrum: (seconds) => setGetReady(activeClass.id, { getReadyDrum: seconds }),
            onAward: (stars) => addToClassGoal(activeClass.id, stars),
            onActiveChange: setFloatReadying,
          }}
        />
      )}
    </>
  )
}
