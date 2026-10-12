import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClassSettingsModal, SECTIONS, type SettingsSection } from './components/ClassSettingsModal'
import clsx from 'clsx'
import { ChooseAvatarBanner, ChooseAvatarPicker } from './components/ChooseAvatars'
import { ClassTitle } from './components/ClassTitle'
import { GetReady } from './components/GetReady'
import { DeskGrid } from './components/DeskGrid'
import { FlipDeck } from './components/FlipDeck'
import { FloatingGoal } from './components/FloatingGoal'
import { SetupGuide } from './components/SetupGuide'
import { Tour } from './components/Tour'
import { GUIDE_STEPS, rememberGuideDone, shouldGuide, stepBefore, stepFrom, stepPlace, type GuideScope } from './lib/setupGuide'
import { GroupActivity } from './components/GroupActivity'
import { GroupActivityModal } from './components/GroupActivityModal'
import { GroupBuilder } from './components/GroupBuilder'
import { SaveGroupsModal } from './components/SaveGroupsModal'
import { GroupExitModal } from './components/GroupExitModal'
import { PointsMeter } from './components/PointsMeter'
import { ChestMoment } from './components/quest/ChestMoment'
import { OurQuest } from './components/quest/OurQuest'
import { chestNow, prizesOf, questOf } from './lib/quest'
import { clockPieceClass, ROW_GAP, tabClass } from './lib/topBar'
import { SeatClassBanner } from './components/SeatClassBanner'
import { SideRail } from './components/SideRail'
import { SplashScreen } from './components/SplashScreen'
import { BigTimer, TimerClock, TimerDim } from './components/BigTimer'
import { AccountQuestionModal, SwitchTeacherModal } from './components/Account'
import { DEFAULT_GET_READY_PRIZE } from './lib/getReady'
import { goalIsLive, MAX_CLASSES, pointsModeOf, starsWaitOnDesks, useClasses } from './hooks/useClasses'
import { useClassPhotos } from './hooks/useClassPhotos'
import { useFlipDeck } from './hooks/useFlipDeck'
import { canFloat, FLOAT_SIZE, useAppInFront, useFloatingWindow } from './hooks/useFloatingWindow'
import { useGroupPicker } from './hooks/useGroupPicker'
import { usePicker } from './hooks/usePicker'
import {
  buildGroups,
  framesFor,
  groupsFromSaved,
  handMadeGroups,
  MAX_SAVED_GROUPS,
  pruneGroups,
  schemeLabel,
  summarizeGroupPoints,
  type GroupScheme,
} from './lib/groups'
import { pickChances } from './lib/participation'
import { playCoinTick, playGroupsDone, playPointDeduct, playShuffle, primeAudio } from './lib/sound'
import { flyStarsFrom, flyStarsToGoal } from './lib/starFlight'
import { homeroomsToShow } from './lib/sameNames'
import { binPhotos } from './lib/drive'
import { studentsAsShown } from './lib/stickers'
import { applyTheme, loadTheme, type Theme } from './lib/theme'
import { absentOn, attendanceTakenOn, dateKey } from './lib/attendance'
import { planFor } from './lib/layouts'
import { rememberInClass, resumesInClass } from './lib/resume'
import { type ClassData, type Student } from './types'

const PANEL_SIDE_KEY = 'seating-chart-panel-side-v1'
const GROUP_CHIMES_KEY = 'seating-chart-group-chimes-v1'

type PanelSide = 'left' | 'right'

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
    setParticipation,
    clearParticipationDay,
    clearParticipation,
    setGoal,
    setClassTheme,
    setRoom,
    setPointsMode,
    clearDeskStars,
    setShowAllHomerooms,
    setDeskPictures,
    setStudentPhotos,
    setChartPhotos,
    setGetReady,
    setCelebrationGif,
    resetClassGoal,
    setClassPoints,
    addToClassGoal,
    openChest,
    setPrizes,
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
    saveGroups,
    removeSavedGroups,
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

  const photos = useClassPhotos(classes, activeClass, cloud.account?.uid)
  /**
   * A photo the teacher took out - removed, replaced, its student or class deleted - goes to the
   * bin in their Drive, so a child's photo never stays behind after the child has left the class.
   */
  const binStudentPhotos = (cls: ClassData | undefined, studentIds: string[]) => {
    const uid = cloud.account?.uid
    if (!uid || !cls) return
    const ids = new Set(studentIds)
    binPhotos(
      uid,
      cls.students.flatMap((s) => (ids.has(s.id) && s.photo ? [{ file: s.photo }] : [])),
    )
  }
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
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('students')
  /** The tour of the app, from Help in Class Settings, or offered at the end of a new class's setup. */
  const [tourOpen, setTourOpen] = useState(false)
  const [flipDeckOpen, setFlipDeckOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  /** "I'll choose": the teacher taps the names into this many groups. */
  const [groupBuilder, setGroupBuilder] = useState<{ scheme: GroupScheme; count: number } | null>(null)
  const [saveGroupsOpen, setSaveGroupsOpen] = useState(false)
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
  const [panelSide, setPanelSide] = useState<PanelSide>(loadPanelSide)
  /**
   * The board's own theme, which every class shared before each class had its own (2026-10-11): a
   * class that hasn't picked one yet still shows it.
   */
  const [boardTheme] = useState<Theme>(loadTheme)
  const theme = activeClass?.theme ?? boardTheme
  /**
   * The splash is up until the teacher starts a class, every time the app is opened rather than
   * once. Opening this app is something a teacher does at the top of a lesson, so a deliberate
   * "start" is the moment they're already having - and it costs one tap to get past. A refresh
   * isn't opening it: the same tab, the same teacher and the same day go straight back to the
   * class (lib/resume).
   */
  const [splashOpen, setSplashOpen] = useState(() => !(activeClass && resumesInClass(cloud.account?.uid)))
  useEffect(() => {
    if (!splashOpen) rememberInClass(cloud.account?.uid)
  }, [splashOpen, cloud.account?.uid])
  /** The class goal in its own small window over the lesson, so a point doesn't mean switching apps. */
  const { win: floatWin, open: openFloat, close: closeFloat } = useFloatingWindow(theme)
  const appInFront = useAppInFront()
  /** Our Quest, the treasure map, slid over the board (a tap on the meter's chest). */
  const [questOpen, setQuestOpen] = useState(false)
  /** A full chest opening, and which one: kept as it starts, since opening it moves the class to the next. */
  const [chestOpening, setChestOpening] = useState<number | null>(null)
  /** Open the chest was tapped in the floating window: the chest opens once the app is in front. */
  const [chestAsked, setChestAsked] = useState(false)
  /** The guide through Class Settings, while it runs: which sections it walks, and the step it is on (lib/setupGuide). */
  const [guide, setGuide] = useState<{ scope: GuideScope; index: number } | null>(null)
  /** Get Ready! is running in the floating window, so the side panel's stands down. */
  const [floatReadying, setFloatReadying] = useState(false)
  if (!floatWin && floatReadying) setFloatReadying(false)
  const goalLive = activeClass ? goalIsLive(activeClass) : false
  /** The Quest's chest the class is on (lib/quest). */
  const quest = activeClass ? questOf(activeClass) : null
  const chest = quest ? chestNow(quest) : null
  /** How the class runs points: a class goal, each student's own stars, or none. */
  const pointsMode = activeClass ? pointsModeOf(activeClass) : 'goal'
  /** Stars stay on the desks: a student's own (student points), or waiting for All Stars In! (a class goal's). */
  const desksMode = activeClass ? starsWaitOnDesks(activeClass) : false

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Desks picked by hand are for giving points: switching to no points lets them go, rather than
  // leaving the board dimmed with no Unpick All to undo it.
  useEffect(() => {
    if (pointsMode === 'none') resetPointsSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsMode])

  // No goal, nothing to float: switching the goal off in Pickers & Points takes the window with it.
  useEffect(() => {
    if (!goalLive) closeFloat()
  }, [goalLive, closeFloat])

  useEffect(() => {
    resetPointsSelection()
    // Another class is another set of groups; the activity closes rather than showing them.
    setGroupActivityOpen(false)
    setQuestOpen(false)
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
  // Whose homeroom number shows after their name: two students sharing a name, as on the desks.
  const showAllHomerooms = activeClass?.showAllHomerooms === true
  const homeroomTagged = useMemo(() => homeroomsToShow(studentsById.values(), showAllHomerooms), [studentsById, showAllHomerooms])

  const deck = useFlipDeck(seatedIds, activeClassId, flipDeckOpen, {
    genderOf: (id) => studentsById.get(id)?.gender ?? 'unspecified',
    giftsAllowed: () => pointsMode !== 'none',
    // A surprise card's stars are the whole class's, so they go in no one's participation record.
    // With a class goal they fly from the card into the chest, one a star, and the meter waits for
    // them to land. With student points every student here gets them (2026-10-11), as with Get
    // Ready!: a surprise card is nobody's turn.
    onGift: (cardId, stars) => {
      if (!activeClassId) return
      if (pointsMode === 'students') {
        adjustPoints(activeClassId, seatedIds, stars)
        playCoinTick()
        setToast({ id: Date.now(), text: `Everyone gets ${stars} stars!` })
        return
      }
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

  /** "I'll choose": the class's desks small on one side, the groups on the other, the names tapped in. */
  function chooseGroups(scheme: GroupScheme) {
    if (!activeClass) return
    setGroupBuilder({ scheme, count: framesFor(scheme, seating, plan) })
  }

  /** The groups the teacher chose by hand, on the board as they were tapped in. Shuffle still mixes them, into as many cards. */
  function startChosenGroups(members: string[][]) {
    if (!activeClassId || !groupBuilder) return
    setGroups(activeClassId, handMadeGroups(members), groupBuilder.scheme)
    setGroupScheme(groupBuilder.scheme)
    setGroupBuilder(null)
    setDealWasShuffle(false)
    setDealTick(0)
    setGroupsLocked(false)
    openGroupActivity()
  }

  /** Saved groups, brought back for today: anyone new joins the smallest group, and the teacher is told. */
  function startSavedGroups(savedId: string) {
    const saved = activeClass?.savedGroups?.find((s) => s.id === savedId)
    if (!activeClassId || !activeClass || !saved) return
    const { groups: fresh, joined } = groupsFromSaved(saved, seating)
    if (fresh.length === 0) {
      setToast({ id: Date.now(), text: `Nobody in "${saved.name}" has a desk in this class now.` })
      return
    }
    const madeBy: GroupScheme = saved.madeBy ?? { kind: 'count', count: fresh.length }
    setGroups(activeClassId, fresh, madeBy, saved.id)
    setGroupScheme(madeBy)
    setDealWasShuffle(false)
    setDealTick(0)
    setGroupsLocked(false)
    openGroupActivity()
    if (joined.length === 1) {
      const who = studentsById.get(joined[0].studentId)?.name ?? 'A new student'
      setToast({ id: Date.now(), text: `${who} joined ${joined[0].groupName}.` })
    } else if (joined.length > 1) {
      setToast({ id: Date.now(), text: `${joined.length} new students joined the smallest groups.` })
    }
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
    // With no points the cards carry no score, so there is nothing to ask about.
    if (pointsMode !== 'none' && summarizeGroupPoints(groups).totalPoints > 0) setExitPromptOpen(true)
    else setGroupActivityOpen(false)
  }

  /** The points go out - onto the class goal, or to each student in a group - and the board comes back. */
  function giveOutGroupPoints() {
    if (!activeClass) return
    const { totalPoints } = summarizeGroupPoints(groups)
    finishGroupActivity(activeClass.id)
    setExitPromptOpen(false)
    setGroupActivityOpen(false)
    playGroupsDone()
    setToast({
      id: Date.now(),
      text:
        pointsMode === 'students'
          ? "Everyone got their group's points."
          : `${totalPoints} point${totalPoints === 1 ? '' : 's'} added to the class goal.`,
    })
  }

  /** Class Settings opens on the class list, the part a teacher comes for most, unless asked for another section. */
  /** A full chest opens on a tap: the big moment, with the wheel (components/quest/ChestMoment). */
  function startChestOpening() {
    if (!chest?.ready || chestOpening !== null) return
    setChestAsked(false)
    setChestOpening(chest.chest)
  }

  // Open the chest, tapped in the floating window: it opens the moment the app is in front.
  useEffect(() => {
    if (chestAsked && appInFront && chest?.ready && chestOpening === null) {
      setChestAsked(false)
      setChestOpening(chest.chest)
    }
    if (chestAsked && !chest?.ready) setChestAsked(false)
  }, [chestAsked, appInFront, chest, chestOpening])

  function openSettings(section: SettingsSection = 'students') {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  // --- The guide through Class Settings (lib/setupGuide) ------------------------------------
  const guideContext = { cls: activeClass!, signedIn: Boolean(cloud.account) }

  /** To step `from`, or the next one after it that applies; past the end, the guide is done. */
  function guideTo(scope: GuideScope, from: number) {
    const index = activeClass ? stepFrom(from, scope, { ...guideContext, showing: () => false }) : null
    if (index === null) {
      endGuide()
      return
    }
    setGuide({ scope, index })
    const section = GUIDE_STEPS[index].section
    if (section) openSettings(section)
  }

  /** Back to the step before that applies, in its own section; on the first step there is none. */
  function guideBack(scope: GuideScope, from: number) {
    const index = activeClass ? stepBefore(from, scope, { ...guideContext, showing: () => false }) : null
    if (index === null) return
    setGuide({ scope, index })
    const section = GUIDE_STEPS[index].section
    if (section) openSettings(section)
  }

  /** Help's Guide me walks the section that is open; a new class walks the whole setup. */
  function startGuide(scope: GuideScope) {
    guideTo(scope, 0)
  }

  /** Done or stopped: a new teacher's first sign-in doesn't start it again on this board. */
  function endGuide() {
    setGuide(null)
    if (cloud.account) rememberGuideDone(cloud.account.uid)
  }

  /** Another class, made and opened straight to its name, with the whole setup walked through. */
  function newClass() {
    createClass()
    openSettings('class')
    startGuide('all')
  }

  function openTour() {
    if (guide) endGuide()
    setSettingsOpen(false)
    setTourOpen(true)
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
      // Their first class: the guide walks them through setting it up.
      if (shouldGuide(cloud.account.uid, classes)) startGuide('all')
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
      // Nobody earns a star on a day they aren't here, so an absent desk doesn't select; and with
      // no points a desk is never picked by hand, since that is only ever for giving a point.
      if (!studentId || absentIds.has(studentId) || pointsMode === 'none') return
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
    // Unpick All whenever anyone is picked, not only everyone (2026-10-08, the teacher): a few
    // students tapped all over the board took a tap each to let go of. A pick still showing is
    // let go of the same way (the side rail, 2026-10-09); it used to be taken over by Pick All.
    if (pointsSelection.size > 0) {
      resetPointsSelection()
      return
    }
    if (picker.hasResult) {
      picker.dismiss()
      return
    }
    setSpentDelta(null)
    setLandedTick(0)
    // Selecting everyone is the one case where nothing dims, so the ripple is the only
    // confirmation the board gives. Deselecting needs none - the dimming lifts.
    setStaggerWiggle(true)
    setPointsSelection(new Set(seatedIds))
  }

  /**
   * Pick Whole Row: everyone here today in the rows (or at the tables) of the students picked by
   * hand, so a row that did a good job is one desk and one tap rather than a tap a desk
   * (2026-10-08, the teacher). The rows are Pick Row's, from the room's plan. Null when nobody
   * is picked by hand, or the desks are covered.
   */
  function wholeSetsOfSelection() {
    if (flipDeckOpen || groupActivityOpen || picker.hasResult || pointsSelection.size === 0) return null
    const sets = new Set<number>()
    presentSeating.forEach((id, i) => {
      const seat = plan.seats[i]
      if (id && seat && pointsSelection.has(id)) sets.add(seat.set)
    })
    const ids = presentSeating.filter((id, i): id is string => Boolean(id) && plan.seats[i] !== undefined && sets.has(plan.seats[i].set))
    return { ids, count: sets.size, whole: ids.every((id) => pointsSelection.has(id)) }
  }
  const wholeSets = wholeSetsOfSelection()

  function pickWholeSets() {
    if (!wholeSets || wholeSets.whole) return
    setSpentDelta(null)
    setLandedTick(0)
    setStaggerWiggle(false)
    setPointsSelection(new Set(wholeSets.ids))
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

  const sideRail = (
    <SideRail
      goalLive={goalLive}
      points={pointsMode !== 'none'}
      canFloat={canFloat}
      floating={floatWin !== null}
      onToggleFloat={() => (floatWin ? closeFloat() : void openFloat(FLOAT_SIZE))}
      getReadyOpen={getReadyOpen}
      // Get Ready! stands down in Swap Seats and Attendance, while a pick is flashing, and while
      // the floating window's own is running.
      getReadyDisabled={swapMode || attendanceMode || choosingAvatars || picker.isPicking || floatReadying}
      onGetReady={() => setGetReadyOpen(true)}
      // All Stars In! only in a class goal whose stars wait on the desks: student points keep theirs.
      deskStars={desksMode && goalLive ? activeClass.students.reduce((n, s) => n + (s.points ?? 0), 0) : null}
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
      side={panelSide}
      onToggleSide={togglePanelSide}
      saveError={saveError}
      cloud={cloud}
      onSwitchTeacher={openSwitchTeacher}
      pointsSelectedCount={activeSelection.size}
      allSeatedSelected={seatedIds.length > 0 && seatedIds.every((id) => activeSelection.has(id))}
      anyPicked={pointsSelection.size > 0 || (picker.hasResult && !flipDeckOpen)}
      onToggleSelectAll={toggleSelectAll}
      wholeSets={wholeSets && { count: wholeSets.count, whole: wholeSets.whole, onPick: pickWholeSets }}
      onAwardPoint={() => applyPointsDelta(1)}
      onDeductPoint={() => applyPointsDelta(-1)}
      showMinus={desksMode}
      canDeductPoint={canDeductPoint}
      flipDeckOpen={flipDeckOpen}
      pickFlashing={picker.isPicking}
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
      onToggleGroupActivity={() => {
        if (groupActivityOpen) requestExitGroups()
        else setGroupModalOpen(true)
      }}
    />
  )

  const classTitle = (
    <ClassTitle
      classes={classes}
      activeClassId={activeClassId}
      onSelectClass={setActiveClassId}
      onOpenSettings={() => openSettings()}
      onNewClass={classes.length < MAX_CLASSES ? newClass : null}
      disabled={swapMode || attendanceMode || choosingAvatars}
      settingsDisabled={groupActivityOpen && groupsLocked}
      side={panelSide}
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
              // The start of a lesson: photos another computer added come down now, opening
              // Google's window only if there are some and the hour's pass has run out. Not on
              // the same tap as reconnecting, which has the one window a tap may open.
              else
                void photos.getPhotos(
                  classes.find((c) => c.id === id),
                  true,
                )
              setActiveClassId(id)
              setSplashOpen(false)
            }}
            onNewClass={() => {
              if (cloud.needsSignIn) void cloud.signIn()
              // Made, opened, and straight to its name, as New Class in the class list does.
              setSplashOpen(false)
              newClass()
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
        // The rail runs the window's whole height down its side and the bar along the top to the far
        // side, both flush against the window's edges (2026-10-10, the teacher's mock-ups); the desks
        // keep a gap from the other two. In Chalkboard everything meets the wooden frame's inside
        // edge (--frame-pad), so the frame stays whole.
        className="grid h-[100dvh] w-[100dvw] gap-[var(--board-gap)] bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-[var(--frame-pad,0px)]"
        style={{
          gridTemplateColumns: panelSide === 'left' ? 'var(--rail-w) minmax(0, 1fr)' : 'minmax(0, 1fr) var(--rail-w)',
          gridTemplateRows: 'auto minmax(0, 1fr)',
          gridTemplateAreas: panelSide === 'left' ? "'rail bar' 'rail board'" : "'bar rail' 'board rail'",
        }}
        onPointerDownCapture={primeAudio}
      >
        {/* Plain boxes, deliberately. They were framer layout boxes so the panel glided when it
            moved to the other side - a once-a-term change - and that made framer measure the
            page on every render: every desk tap, every point, every picker flash. */}
        {/* Above the timer's dim (TimerDim), with the class's tab: the teacher's own buttons stay bright. */}
        <div className="relative z-[16] flex min-h-0" style={{ gridArea: 'rail' }}>
          {sideRail}
        </div>

        {/* The row along the top: the goal meter by the rail, an aisle, and the class's name and gear
            in a tab in the far corner (2026-10-11, the teacher's mock-up). With no goal there is no
            meter - a meter on screen is one the class will ask about every lesson, whether or not
            the teacher wanted one - and the timer, put away, is a piece of its own by the rail. */}
        <div
          data-side={panelSide}
          className={clsx('flex min-w-0', ROW_GAP, panelSide === 'left' ? 'flex-row' : 'flex-row-reverse')}
          style={{ gridArea: 'bar' }}
        >
          {goalLive ? (
            <PointsMeter
              classId={activeClass.id}
              classPoints={activeClass.classPoints ?? 0}
              goalsReached={activeClass.goalsReached ?? 0}
              goal={activeClass.pointsGoal ?? 0}
              chest={chest!}
              onTapChest={() => (chest?.ready ? startChestOpening() : setQuestOpen((open) => !open))}
              holdKeyMoment={!appInFront}
              lifted={meterLifted}
              side={panelSide}
              leading={<TimerClock />}
            />
          ) : (
            <>
              <TimerClock frame={clockPieceClass} />
              <div className="flex-1" />
            </>
          )}
          <div data-ink="panel" data-class-tab="" className={clsx(tabClass(panelSide), 'relative z-[16]')}>
            {classTitle}
          </div>
        </div>

        <div
          className={`relative flex min-h-0 min-w-0 flex-col gap-2 mb-[var(--board-gap)] ${panelSide === 'left' ? 'mr-[var(--board-gap)]' : 'ml-[var(--board-gap)]'}`}
          style={{ gridArea: 'board' }}
        >
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

            {questOpen && quest && goalLive && (
              <OurQuest
                quest={quest}
                onOpenChest={() => {
                  setQuestOpen(false)
                  startChestOpening()
                }}
                onClose={() => setQuestOpen(false)}
              />
            )}

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
                    // The cards' settings are with every other tool's, in Class Settings.
                    onOpenSettings={() => openSettings('tools')}
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
                    points={pointsMode !== 'none'}
                    onResetPoints={() => resetGroupPoints(activeClass.id)}
                    onAdjustPoints={(groupId, delta) => adjustGroupPoints(activeClass.id, groupId, delta)}
                    onMove={(studentId, groupId) => moveStudentToGroup(activeClass.id, studentId, groupId)}
                    onNewGroups={() => setGroupModalOpen(true)}
                    onShuffle={shuffleGroups}
                    onSave={() => setSaveGroupsOpen(true)}
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
        savedGroups={activeClass.savedGroups ?? []}
        onStart={startGroups}
        onChoose={chooseGroups}
        onContinue={continueGroups}
        onStartSaved={startSavedGroups}
        onRemoveSaved={(savedId) => removeSavedGroups(activeClass.id, savedId)}
      />

      {groupBuilder && (
        <GroupBuilder
          plan={plan}
          seating={seating}
          studentsById={studentsById}
          absentIds={absentIds}
          homerooms={homeroomTagged}
          groupCount={groupBuilder.count}
          pairs={groupBuilder.scheme.kind === 'size'}
          title={schemeLabel(groupBuilder.scheme, groupBuilder.count, plan.setName)}
          onStart={startChosenGroups}
          onCancel={() => setGroupBuilder(null)}
        />
      )}

      <SaveGroupsModal
        open={saveGroupsOpen}
        onClose={() => setSaveGroupsOpen(false)}
        savedName={activeClass.savedGroups?.find((s) => s.id === activeClass.groupsSavedAs)?.name ?? null}
        full={(activeClass.savedGroups?.length ?? 0) >= MAX_SAVED_GROUPS}
        onSave={(name) => {
          saveGroups(activeClass.id, name)
          setToast({ id: Date.now(), text: `Saved as "${name}".` })
        }}
      />

      <GroupExitModal
        open={exitPromptOpen}
        onClose={() => setExitPromptOpen(false)}
        groups={groups}
        onGiveOut={giveOutGroupPoints}
        toStudents={pointsMode === 'students'}
        onKeep={() => {
          setExitPromptOpen(false)
          setGroupActivityOpen(false)
        }}
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

      {/* Get Ready! is the whole class, so it goes in no one's participation record. With a class
          goal its stars go straight into the jar, leaving any waiting on desks where they are. */}
      <GetReady
        open={getReadyOpen}
        lastDrum={activeClass.getReadyDrum}
        // In every way of running points (2026-10-11, the teacher): into the class goal, to every
        // student here with student points, or no prize at all, a challenge for its own sake.
        prize={pointsMode === 'none' ? 0 : (activeClass.getReadyPrize ?? DEFAULT_GET_READY_PRIZE)}
        everyone={pointsMode === 'students'}
        silent={activeClass.getReadySilent === true}
        onSetSilent={(silent) => setGetReady(activeClass.id, { getReadySilent: silent })}
        onChooseDrum={(seconds) => setGetReady(activeClass.id, { getReadyDrum: seconds })}
        onAward={(stars) => {
          // The whole class, so it goes in no one's participation record.
          if (pointsMode === 'students') adjustPoints(activeClass.id, seatedIds, stars)
          else addToClassGoal(activeClass.id, stars)
        }}
        onLiftMeter={setMeterLifted}
        onClose={() => setGetReadyOpen(false)}
      />

      <ClassSettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          // Closing the window ends the guide; its last word, at Done, ends it too.
          if (guide) endGuide()
        }}
        section={settingsSection}
        onSection={setSettingsSection}
        activeClass={activeClass}
        classes={classes}
        cloud={cloud}
        onSwitchTeacher={openSwitchTeacher}
        onNewClass={newClass}
        canAddClass={classes.length < MAX_CLASSES}
        onGuide={() => startGuide(settingsSection)}
        onTour={openTour}
        onRename={(name) => renameClass(activeClass.id, name)}
        onSetRoom={(room) => setRoom(activeClass.id, room)}
        onSetLayout={(layout) => setLayout(activeClass.id, layout)}
        onSetShowAllHomerooms={(show) => setShowAllHomerooms(activeClass.id, show)}
        theme={theme}
        onSetTheme={(next) => setClassTheme(activeClass.id, next)}
        onDeleteClass={() => {
          // The class's photo folder goes to Drive's bin with it, if it ever had one.
          if (cloud.account) binPhotos(cloud.account.uid, [{ classId: activeClass.id }])
          deleteClass(activeClass.id)
        }}
        onAddStudents={(students) => addStudents(activeClass.id, students)}
        onRemoveStudents={(studentIds) => {
          binStudentPhotos(activeClass, studentIds)
          deleteStudents(activeClass.id, studentIds)
        }}
        onReplaceStudents={(students) => {
          binStudentPhotos(
            activeClass,
            activeClass.students.map((s) => s.id),
          )
          return replaceStudents(activeClass.id, students)
        }}
        onUpdateStudent={(studentId, patch) => updateStudent(activeClass.id, studentId, patch)}
        onDeleteStudent={(studentId) => {
          binStudentPhotos(activeClass, [studentId])
          deleteStudent(activeClass.id, studentId)
        }}
        onUnseatStudent={(studentId) => unseatStudent(activeClass.id, studentId)}
        onUnseatAll={() => unseatAll(activeClass.id)}
        onSeatClass={() => seatClass(activeClass.id)}
        onMixUpSeats={() => {
          // A pick is ringed by desk, and that desk now holds somebody else.
          picker.dismiss()
          mixUpSeats(activeClass.id)
          playShuffle()
        }}
        onSetDeskPictures={(shows) => setDeskPictures(activeClass.id, shows)}
        onPhotosSaved={(saved) => {
          binStudentPhotos(
            activeClass,
            Object.keys(saved).filter((id) => activeClass.students.some((s) => s.id === id && s.photo && s.photo !== saved[id])),
          )
          setStudentPhotos(activeClass.id, saved)
        }}
        onRemovePhotos={(studentIds) => {
          binStudentPhotos(activeClass, studentIds)
          setStudentPhotos(activeClass.id, Object.fromEntries(studentIds.map((id) => [id, undefined])))
        }}
        photosNotHere={photos.notHere}
        onGetPhotos={() => void photos.getPhotos(activeClass)}
        gettingPhotos={photos.getting}
        photosProblem={photos.problem}
        onSetChartPhotos={(on) => setChartPhotos(activeClass.id, on)}
        onStudentsChoose={() => {
          // The desks have to be in view: the cards come down, and a pick or a selection on the
          // board goes, as for Attendance.
          setFlipDeckOpen(false)
          picker.dismiss()
          resetPointsSelection()
          setChoosingAvatars(true)
        }}
        studentsChooseBlocked={groupActivityOpen}
        onAssignAvatars={(themeId, options) => assignAvatars(activeClass.id, themeId, options)}
        onSetPointsMode={(mode) => setPointsMode(activeClass.id, mode)}
        onSetStarsOnDesks={(on) => setStarsOnDesks(activeClass.id, on)}
        onSetGoal={(goal) => setGoal(activeClass.id, goal)}
        onSetCelebrationGif={(gifId) => setCelebrationGif(activeClass.id, gifId)}
        onSetPrizes={(prizes) => setPrizes(activeClass.id, prizes)}
        onSetClassPoints={(points) => setClassPoints(activeClass.id, points)}
        onResetClassGoal={() => resetClassGoal(activeClass.id)}
        onClearDeskStars={() => clearDeskStars(activeClass.id)}
        tools={{
          pickers: picker.settings,
          onUpdatePickers: picker.updateSettings,
          pickedThisRound: pickedThisRound.size,
          roundStarted: pickedThisRound.size > 0 || picker.rowsPicked > 0,
          onStartNewRound: () => {
            startNewRound(activeClass.id)
            picker.resetRows()
          },
          getReadyPrize: activeClass.getReadyPrize ?? DEFAULT_GET_READY_PRIZE,
          onSetGetReadyPrize: (prize) => setGetReady(activeClass.id, { getReadyPrize: prize }),
          flip: deck.settings,
          onUpdateFlip: deck.updateSettings,
          groupChimes,
          onSetGroupChimes: updateGroupChimes,
        }}
        onToggleAbsentInRecord={(studentId, day) => toggleAbsentInRecord(activeClass.id, studentId, day)}
        onSetParticipation={(day, studentId, count) => setParticipation(activeClass.id, day, studentId, count)}
        onClearParticipationDay={(day) => clearParticipationDay(activeClass.id, day)}
        onClearParticipation={() => clearParticipation(activeClass.id)}
      />

      {/* The timer, big over the board; put away, it is the clock in the bar. */}
      <TimerDim />
      <BigTimer />

      {guide && settingsOpen && !splashOpen && (
        <SetupGuide
          step={GUIDE_STEPS[guide.index]}
          where={(() => {
            const step = GUIDE_STEPS[guide.index]
            const place = stepPlace(guide.index, guide.scope, { ...guideContext, showing: () => false })
            return step.section ? `${SECTIONS.find((sec) => sec.id === step.section)!.label} · ${place.label}` : 'All done'
          })()}
          finish={stepPlace(guide.index, guide.scope, { ...guideContext, showing: () => false }).finish}
          context={guideContext}
          // Next (it's done) and Skip (leave it as it is) both move on to the next thing.
          onNext={() => guideTo(guide.scope, guide.index + 1)}
          onSkip={() => guideTo(guide.scope, guide.index + 1)}
          onBack={() => guideBack(guide.scope, guide.index)}
          canGoBack={stepBefore(guide.index, guide.scope, { ...guideContext, showing: () => false }) !== null}
          onStop={endGuide}
          onTour={openTour}
        />
      )}

      {tourOpen && <Tour onClose={() => setTourOpen(false)} />}

      {chestOpening !== null && activeClass && (
        <ChestMoment
          chest={chestOpening}
          prizes={prizesOf(activeClass)}
          spinners={seatedIds.map((id) => ({ id, name: studentsById.get(id)?.name ?? '' }))}
          onSpinnerPicked={(id) => recordPick(activeClass.id, id, today)}
          onWon={(prize) => openChest(activeClass.id, prize)}
          onClose={() => {
            // The Mega chest ends the quest: a new one starts at the Wood chest.
            if (chestOpening === 4) setToast({ id: Date.now(), text: 'A new quest begins!' })
            setChestOpening(null)
          }}
          from={() => document.querySelector('[data-quest-chest]')}
        />
      )}

      {floatWin && goalLive && (
        <FloatingGoal
          win={floatWin}
          className={activeClass.name}
          classPoints={activeClass.classPoints ?? 0}
          goal={activeClass.pointsGoal ?? 0}
          chest={chest!}
          goalsReached={activeClass.goalsReached ?? 0}
          chestAsked={chestAsked}
          onAdd={() => addToClassGoal(activeClass.id, 1)}
          // The browser may or may not bring the app forward for this. Either way the chest
          // opens only once the app is in front: it needs the whole board.
          onOpenChest={() => {
            setChestAsked(true)
            window.focus()
          }}
          pick={
            picker.mode === 'student-flashing' || picker.mode === 'student-result'
              ? (() => {
                  const shown = picker.shownStudentId ? studentsById.get(picker.shownStudentId) : undefined
                  return {
                    name: shown?.name ?? '',
                    // The name alone (2026-10-08, the teacher), with the homeroom number after it
                    // where two students share the name, as on the desks: the float is the only
                    // place the class sees who was picked, so it must tell two Amys apart.
                    homeroom: shown && homeroomTagged.has(shown.id) ? shown.homeroom.trim() : '',
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
            silent: activeClass.getReadySilent === true,
            onSetSilent: (silent) => setGetReady(activeClass.id, { getReadySilent: silent }),
            onChooseDrum: (seconds) => setGetReady(activeClass.id, { getReadyDrum: seconds }),
            onAward: (stars) => addToClassGoal(activeClass.id, stars),
            onActiveChange: setFloatReadying,
          }}
        />
      )}
    </>
  )
}
