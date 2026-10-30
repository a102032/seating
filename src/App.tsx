import { AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChooseAvatarBanner } from './components/ChooseAvatars'
import { ClassTitle } from './components/ClassTitle'
import { GetReady } from './components/GetReady'
import { DeskGrid } from './components/DeskGrid'
import { Tour } from './components/Tour'
import { shouldGuide } from './lib/setupGuide'
import { PointsMeter } from './components/PointsMeter'
import { FullScreenButton } from './components/FullScreenButton'
import { BoardLockButton, BoardLockShield } from './components/BoardLock'
import { useBoardLock } from './hooks/useBoardLock'
import { clockPieceClass, ROW_GAP, tabClass } from './lib/topBar'
import { SeatClassBanner } from './components/SeatClassBanner'
import { LineHint, ModeHint, TourOffer, useTourOffer } from './components/BoardHint'
import { LinePanel } from './components/Line'
import { SendStarsModal } from './components/SendStarsModal'
import { SideRail } from './components/SideRail'
import { SplashScreen } from './components/SplashScreen'
import { BigTimer, TimerClock, TimerDim } from './components/BigTimer'
import { AccountQuestionModal, SwitchTeacherModal } from './components/Account'
import type { SpinnerPick } from './components/SpinnerName'
import { DEFAULT_GET_READY_PRIZE } from './lib/getReady'
import { goalIsLive, MAX_CLASSES, pointsModeOf, starsWaitOnDesks, useClasses } from './hooks/useClasses'
import { useClassPhotos } from './hooks/useClassPhotos'
import { canFloat, FLOAT_SIZE } from './hooks/useFloatingWindow'
import { timer } from './hooks/useTimer'
import { usePicker } from './hooks/usePicker'
import { pickChances, spinnerChoices, weightedChoice } from './lib/participation'
import { pointsOnMeter } from './lib/points'
import { primeAudio } from './lib/sound'
import { flyStarsToGoal } from './lib/starFlight'
import { homeroomsToShow } from './lib/sameNames'
import { studentsAsShown } from './lib/stickers'
import { applyTheme, loadTheme, type Theme } from './lib/theme'
import { absentOn, attendanceTakenOn } from './lib/attendance'
import { planFor } from './lib/layouts'
import { rememberInClass, resumesInClass } from './lib/resume'
import { type Student } from './types'
import { ClassSettingsWindow } from './app/ClassSettingsWindow'
import { ChooseAvatarWindow, useChooseAvatars } from './app/useChooseAvatars'
import { FlipCardsBoard, useFlipCards } from './app/useFlipCards'
import { FloatingGoalFor, useFloat } from './app/useFloat'
import { GroupActivityBoard, GroupActivityWindows, useGroupActivityScreen } from './app/useGroupActivityScreen'
import { LineWindows, useLineScreen } from './app/useLineScreen'
import { usePanelSide } from './app/usePanelSide'
import { AttendanceReminder, useAttendanceReminder } from './app/useAttendanceReminder'
import { usePointButtons, usePointsSelection } from './app/usePointsSelection'
import { useQuestScreens } from './app/useQuestScreens'
import { SettingsGuide, useSettingsWindow } from './app/useSettingsWindow'
import { Toast, useToast } from './app/Toast'
import { useToday } from './app/useToday'

/**
 * The app's wiring: the class that is open (useClasses), and the screens over it. Each screen
 * keeps its own state in `src/app/` - the Line, Group Activity, the flip cards, the quests' maps,
 * Class Settings with its guide and the tour, Choose Your Avatar, the floating window, the points
 * selection - and what is here is only what ties them together: which one a desk tap goes to, and
 * which stand down while another is up.
 */
export default function App() {
  const store = useClasses()
  const { classes, activeClass, activeClassId, setActiveClassId, cloud, saveError, unseatedStudents } = store

  /**
   * Switch Teacher, from the splash or the side panel's Saved mark. Whether the board has changes
   * the account hasn't got is read as it opens, since switching would lose them.
   */
  const [switchTeacher, setSwitchTeacher] = useState<{ unsent: boolean } | null>(null)
  const openSwitchTeacher = () => setSwitchTeacher({ unsent: cloud.status !== 'saved' && cloud.unsent() })

  const photos = useClassPhotos(classes, activeClass, cloud.account?.uid)

  const [swapMode, setSwapMode] = useState(false)
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null)
  const [attendanceMode, setAttendanceMode] = useState(false)
  /** Get Ready! is up: "How long?", then the star. */
  const [getReadyOpen, setGetReadyOpen] = useState(false)
  /** Get Ready!'s stars are landing: the meter sits above its faded board. */
  const [meterLifted, setMeterLifted] = useState(false)
  const choosing = useChooseAvatars()
  const today = useToday()
  const reminder = useAttendanceReminder(today)
  const settings = useSettingsWindow(activeClass, cloud.account?.uid)
  const [tourOffered, dismissTourOffer] = useTourOffer()
  const boardLock = useBoardLock()
  const toast = useToast()
  const [panelSide, togglePanelSide] = usePanelSide()
  const quests = useQuestScreens()
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

  const goalLive = activeClass ? goalIsLive(activeClass) : false
  /** How the class runs points: a class goal, each student's own stars, or none. */
  const pointsMode = activeClass ? pointsModeOf(activeClass) : 'goal'
  /** Stars stay on the desks: a student's own (student points), or waiting for All Stars In! (a class goal's). */
  const desksMode = activeClass ? starsWaitOnDesks(activeClass) : false
  /**
   * The stars waiting on the desks for All Stars In!, in a class goal that puts them there first
   * (student points keep theirs); null where stars go straight to the goal. The picture at the
   * meter's start sends them in, after asking (SendStarsModal).
   */
  const deskStars = activeClass && desksMode && goalLive ? activeClass.students.reduce((n, s) => n + (s.points ?? 0), 0) : null
  const [sendStarsAsk, setSendStarsAsk] = useState(false)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const seating = activeClass?.seating ?? []
  /**
   * Where the desks stand: the class's layout, grown for a big class. Swap Seats shows the side
   * desks too, so a student can be moved off to the side of the room (lib/layouts, planFor).
   */
  const plan = planFor(activeClass, { sideDesks: swapMode })
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
  const seatedIds = useMemo(() => presentSeating.filter((id): id is string => Boolean(id)), [presentSeating])
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
      if (activeClassId) store.recordPick(activeClassId, id, today, round)
    },
  })
  const float = useFloat(theme, goalLive, picker)

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

  /**
   * Pick a Spinner, as the chest opens: someone here today, the students picked less often lately
   * given the better chance, as every picker does. It is a turn, so it goes in the record.
   */
  // As the floating window shows a pick: the homeroom number after a name two students share.
  const spinnerPick = (id: string): SpinnerPick | null => {
    const s = studentsById.get(id)
    return s?.name ? { name: s.name, homeroom: homeroomTagged.has(id) ? s.homeroom.trim() : '' } : null
  }
  const lastSpinner = useRef<string | null>(null)
  const pickSpinner = useCallback(
    (different?: boolean): SpinnerPick | null => {
      if (!activeClass || seatedIds.length === 0) return null
      // "Pick a different student" (2026-10-27): the one passed over gets their turn back, and is
      // never picked again this time unless they are the only one here.
      const passed = different ? lastSpinner.current : null
      if (passed) store.takeBackPick(activeClass.id, passed, today)
      // Nobody who has already had a turn today, until everyone has (lib/participation).
      const fresh = spinnerChoices(activeClass, seatedIds, today).filter((id) => id !== passed)
      const others = seatedIds.filter((id) => id !== passed)
      const id = weightedChoice(fresh.length > 0 ? fresh : others.length > 0 ? others : seatedIds, chanceOf)
      lastSpinner.current = id
      // Into Pick Student's round as well, so Pick Student passes them by for the rest of the round.
      store.recordPick(activeClass.id, id, today, [...[...pickedThisRound].filter((x) => x !== passed), id])
      return spinnerPick(id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeClass, seatedIds, chanceOf, today, pickedThisRound, homeroomTagged],
  )

  const lineScreen = useLineScreen({ cls: activeClass, today, store, pointsMode, goalLive, desksMode })
  // While the Line is open the desks show names only (2026-10-16, the teacher): the room the
  // picture leaves goes to the step's dots and name, and the picture is big in the Line's column
  // for the one with the teacher.
  const deskStudentsById = useMemo(
    () =>
      lineScreen.open && activeClass ? new Map(studentsAsShown({ ...activeClass, avatarsOff: true }).map((s) => [s.id, s])) : studentsById,
    [lineScreen.open, activeClass, studentsById],
  )

  const flip = useFlipCards({ classId: activeClassId, seatedIds, studentsById, pointsMode, today, store, toast: toast.show })
  const selection = usePointsSelection()
  const groups = useGroupActivityScreen({
    cls: activeClass,
    presentSeating,
    studentsById,
    absentIds,
    plan,
    pointsMode,
    today,
    pickerSettings: picker.settings,
    chanceOf,
    store,
    onOpening: () => {
      flip.setOpen(false)
      selection.reset()
    },
    toast: toast.show,
  })
  const points = usePointButtons({
    selection,
    picker,
    flipDeckOpen: flip.open,
    flipActiveId: flip.deck.activeId,
    groupActivityOpen: groups.open,
    presentSeating,
    seatedIds,
    plan,
    studentsById,
    classId: activeClassId,
    goalLive,
    desksMode,
    today,
    adjustPoints: store.adjustPoints,
  })

  // Desks picked by hand are for giving points: switching to no points lets them go, rather than
  // leaving the board dimmed with no Unpick All to undo it.
  useEffect(() => {
    if (pointsMode === 'none') selection.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsMode])

  useEffect(() => {
    selection.reset()
    // Another class is another set of groups; the activity closes rather than showing them.
    groups.closeForAnotherClass()
    // And another line: each class keeps its own, and the screen closes rather than mixing them.
    lineScreen.setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassId])

  /** Another class, made and opened straight to its name, with the whole setup walked through. */
  function newClass() {
    store.createClass()
    settings.openAt('class')
    settings.startGuide('all')
  }

  /**
   * Tools' Go There (Class Settings): the timer, Group Activity or the Line, whose own choices are
   * on the tool itself. Class Settings closes and the tool opens as its rail button would; what
   * would stop the button (the Line during a group activity) leaves the board as it is.
   */
  function goToTool(place: 'timer' | 'attendance' | 'group' | 'line') {
    if (place === 'attendance') {
      settings.setSection('attendance')
      return
    }
    settings.hide()
    if (place === 'timer') timer.open()
    else if (place === 'group' && !groups.open) {
      lineScreen.setOpen(false)
      flip.setOpen(false)
      groups.openModal()
    } else if (place === 'line' && !lineScreen.open && !groups.open) {
      flip.setOpen(false)
      toggleLine()
    }
  }

  function toggleLine() {
    // The desks have to be in view, and nothing else may be turning a desk tap into something else.
    setSelectedDesk(null)
    lineScreen.toggle()
  }

  function toggleSwap() {
    setSwapMode((v) => !v)
    setSelectedDesk(null)
    selection.reset()
  }

  /** Opening a class from the splash or the class list asks about attendance if it isn't taken today. */
  function openClass(id: string) {
    setActiveClassId(id)
    reminder.classOpened(classes.find((c) => c.id === id))
  }

  /** The reminder's Take Attendance: the desks come into view and attendance mode is on. */
  function takeAttendanceNow() {
    reminder.later()
    flip.setOpen(false)
    lineScreen.setOpen(false)
    if (swapMode) toggleSwap()
    if (!attendanceMode) toggleAttendance()
  }

  function toggleAttendance() {
    if (!activeClass) return
    // Switching it off is what records the day, so a class with nobody away gets its
    // check from on-then-off, with no separate button to find.
    if (attendanceMode) store.markAttendanceTaken(activeClass.id, today)
    else {
      picker.dismiss()
      selection.reset()
    }
    setAttendanceMode(!attendanceMode)
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
      settings.openAt('class')
      // Their first class: the guide walks them through setting it up.
      if (shouldGuide(cloud.account.uid, classes)) settings.startGuide('all')
    }
    // Only the moment the account arrives counts; classes and the splash are read as they are then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.account])

  /** A desk tap means whatever the board is doing: choosing an avatar, attendance, the Line, a pick, a point or Swap Seats. */
  function handleTapDesk(index: number) {
    if (!activeClassId) return
    const studentId = seating[index]
    const absent = studentId !== null && absentIds.has(studentId)
    if (choosing.on) {
      choosing.tapDesk(studentId, absent)
      return
    }
    if (attendanceMode) {
      if (studentId) store.toggleAbsent(activeClassId, studentId, today)
      return
    }
    if (lineScreen.open) {
      lineScreen.tapDesk(index, studentId, absent)
      return
    }
    if (picker.hasResult) {
      picker.dismiss()
      return
    }
    if (!swapMode) {
      // Nobody earns a star on a day they aren't here, so an absent desk doesn't select; and with
      // no points a desk is never picked by hand, since that is only ever for giving a point.
      if (!studentId || absentIds.has(studentId) || pointsMode === 'none') return
      selection.toggle(studentId)
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
    store.swapSeats(activeClassId, selectedDesk, index)
    setSelectedDesk(null)
  }

  /**
   * All Stars In!: every desk's stars fly into the jar at once - one star from each desk that has
   * some, so a whole class pours in - and the desks start the next lesson empty. Only ever from a
   * tap: stars left on the desks wait there for next time.
   */
  function allStarsIn() {
    setSendStarsAsk(false)
    if (!activeClass) return
    const waiting = activeClass.students.filter((s) => (s.points ?? 0) > 0).map((s) => s.id)
    if (waiting.length === 0) return
    flyStarsToGoal(waiting)
    store.bankDeskStars(activeClass.id)
  }

  if (!activeClass) {
    return <div className="flex h-full w-full items-center justify-center text-neutral-400">Loading...</div>
  }

  // Full Screen sits in the top bar's far corner, after the goal's count (2026-10-14, the teacher:
  // the rail's foot was the wrong spot), or alone in that corner with no goal. The board's lock
  // sits beside it (2026-10-19): the far top corner is out of a small child's reach.
  const cornerButtons = (
    <>
      <BoardLockButton
        locked={boardLock.locked}
        onToggle={boardLock.toggle}
        buttonRef={boardLock.buttonRef}
        className="shrink-0 rounded-lg p-1 hover:bg-accent active:scale-95"
      />
      <FullScreenButton
        size={22}
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95"
      />
    </>
  )

  const { activeSelection } = points
  const sideRail = (
    <SideRail
      goalLive={goalLive}
      points={pointsMode !== 'none'}
      canFloat={canFloat}
      floating={float.win !== null}
      onToggleFloat={() => (float.win ? float.close() : void float.open(FLOAT_SIZE))}
      getReadyOpen={getReadyOpen}
      // Get Ready! stands down in Swap Seats and Attendance, while a pick is flashing, and while
      // the floating window's own is running.
      getReadyDisabled={swapMode || attendanceMode || choosing.on || picker.isPicking || float.readying}
      onGetReady={() => setGetReadyOpen(true)}
      swapMode={swapMode}
      onToggleSwap={toggleSwap}
      attendanceMode={attendanceMode}
      choosingAvatars={choosing.on}
      attendanceTaken={attendanceTakenOn(activeClass, today)}
      // An amber dot until today's is taken (2026-10-27), for a board left on all day.
      attendanceDue={!attendanceTakenOn(activeClass, today) && activeClass.students.length > 0}
      onToggleAttendance={toggleAttendance}
      onPickStudent={() => (groups.open ? groups.picker.run('student') : points.startPick(picker.pickStudent))}
      onPickRow={() => (groups.open ? groups.picker.run('group') : points.startPick(picker.pickRow))}
      groupMode={groups.open}
      // During a group activity the "set" Pick Student can stay inside is the picked group.
      rowLocked={groups.open ? groups.picker.lockedGroupId !== null : picker.rowLocked}
      rowLockBinds={groups.open ? groups.picker.lockBinds : picker.rowLockBinds}
      setName={plan.setName}
      studentPickActive={
        groups.open ? groups.picker.pick?.kind === 'student' : picker.mode === 'student-flashing' || picker.mode === 'student-result'
      }
      rowPickActive={groups.open ? groups.picker.pick?.kind === 'group' : picker.mode === 'row-flashing' || picker.mode === 'row-result'}
      side={panelSide}
      onToggleSide={togglePanelSide}
      saveError={saveError}
      cloud={cloud}
      onSwitchTeacher={openSwitchTeacher}
      pointsSelectedCount={activeSelection.size}
      allSeatedSelected={seatedIds.length > 0 && seatedIds.every((id) => activeSelection.has(id))}
      anyPicked={selection.selection.size > 0 || (picker.hasResult && !flip.open)}
      onToggleSelectAll={points.toggleSelectAll}
      wholeSets={points.wholeSets && { count: points.wholeSets.count, whole: points.wholeSets.whole, onPick: points.pickWholeSets }}
      onAwardPoint={() => points.applyPointsDelta(1)}
      onDeductPoint={() => points.applyPointsDelta(-1)}
      showMinus={desksMode}
      canDeductPoint={points.canDeductPoint}
      flipDeckOpen={flip.open}
      pickFlashing={picker.isPicking}
      onToggleFlipDeck={() => {
        // Deal outside the state updater - React may run an updater more than once, which
        // would deal (and sound) twice.
        const opening = !flip.open
        // A finished pick would otherwise still be lit up behind the deck, and waiting there
        // for the teacher when the cards go away.
        if (opening) picker.dismiss()
        flip.setOpen(opening)
        if (opening) flip.deck.deal()
        selection.reset()
      }}
      groupActivityOpen={groups.open}
      groupActivityLocked={groups.open && groups.locked}
      lineOpen={lineScreen.open}
      lineWaiting={lineScreen.waitingWhileClosed}
      onToggleLine={toggleLine}
      onToggleGroupActivity={() => {
        if (groups.open) groups.requestExit()
        else groups.openModal()
      }}
    />
  )

  const classTitle = (
    <ClassTitle
      classes={classes}
      activeClassId={activeClassId}
      onSelectClass={openClass}
      onOpenSettings={() => settings.openAt()}
      onNewClass={classes.length < MAX_CLASSES ? newClass : null}
      disabled={swapMode || attendanceMode || choosing.on}
      settingsDisabled={groups.open && groups.locked}
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
              openClass(id)
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
      {!splashOpen && <BoardLockShield lock={boardLock} />}
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
        {/* Faded while the board is locked, so the teacher sees at a glance that it is. */}
        <div className={clsx('relative z-[16] flex min-h-0', boardLock.locked && !splashOpen && 'opacity-50')} style={{ gridArea: 'rail' }}>
          {sideRail}
        </div>

        {/* The row along the top: the class's name and gear in a tab by the rail, an aisle, and the
            goal meter on to the far corner (2026-10-14, the beta testers; it was the other way round,
            the teacher's mock-up of 2026-10-11). With no goal there is no meter - a meter on screen
            is one the class will ask about every lesson, whether or not the teacher wanted one - and
            the timer, put away, is a piece of its own beside the tab. */}
        <div
          data-side={panelSide}
          className={clsx('flex min-w-0', ROW_GAP, panelSide === 'left' ? 'flex-row' : 'flex-row-reverse')}
          style={{ gridArea: 'bar' }}
        >
          <div data-ink="panel" data-class-tab="" className={clsx(tabClass, 'relative z-[16]')}>
            {classTitle}
          </div>
          {goalLive ? (
            <PointsMeter
              classId={activeClass.id}
              classPoints={pointsOnMeter(activeClass)}
              goalsReached={activeClass.goalsReached ?? 0}
              goal={activeClass.pointsGoal ?? 0}
              celebrationGifId={activeClass.celebrationGifId}
              onOpenGoalSettings={() => settings.openAt('points')}
              holdCelebration={!float.appInFront}
              onWaitingChange={float.setGoalWaiting}
              lifted={meterLifted}
              side={panelSide}
              leading={<TimerClock />}
              trailing={cornerButtons}
              deskStars={deskStars}
              onSendDeskStars={() => setSendStarsAsk(true)}
              quest={quests.meterQuest(
                activeClass,
                store,
                pickSpinner,
                seatedIds.map(spinnerPick).filter((p): p is SpinnerPick => p !== null),
              )}
            />
          ) : (
            <>
              <TimerClock frame={clockPieceClass} />
              <div className="flex-1" />
              <div data-ink="panel" className={clsx(clockPieceClass, 'empty:hidden')}>
                {cornerButtons}
              </div>
            </>
          )}
        </div>

        <div
          className={`relative flex min-h-0 min-w-0 flex-col gap-2 mb-[var(--board-gap)] ${panelSide === 'left' ? 'mr-[var(--board-gap)]' : 'ml-[var(--board-gap)]'}`}
          style={{ gridArea: 'board' }}
        >
          {choosing.on ? (
            <ChooseAvatarBanner onDone={choosing.stop} />
          ) : swapMode || attendanceMode ? (
            <ModeHint mode={swapMode ? 'swap' : 'attendance'} onDone={swapMode ? toggleSwap : toggleAttendance} />
          ) : lineScreen.open ? (
            <LineHint changing={lineScreen.changing} />
          ) : unseatedStudents.length > 0 ? (
            <SeatClassBanner unseatedCount={unseatedStudents.length} onSeatClass={() => store.seatClass(activeClass.id)} />
          ) : tourOffered && !flip.open && !groups.open && activeClass.students.length > 0 ? (
            <TourOffer onTour={settings.openTour} onDismiss={dismissTourOffer} />
          ) : null}

          {/* The Line's column stands on the right of the desks, whichever side the rail is on: the
              teacher sits with the board behind him, at its right (2026-10-15). */}
          <div className="flex min-h-0 flex-1 gap-2">
            <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              <DeskGrid
                seating={seating}
                plan={plan}
                studentsById={deskStudentsById}
                selectedDesk={selectedDesk}
                pointsSelection={activeSelection}
                landedTick={selection.spentDelta === null ? 0 : selection.landedTick}
                staggerWiggle={selection.staggerWiggle}
                deskHighlights={picker.deskHighlights}
                absentIds={absentIds}
                showStars={desksMode}
                showAllHomerooms={activeClass.showAllHomerooms === true}
                lineMarks={lineScreen.marks}
                onTapDesk={handleTapDesk}
              />

              <FlipCardsBoard
                flip={flip}
                studentsById={studentsById}
                showStars={desksMode}
                showAllHomerooms={activeClass.showAllHomerooms === true}
                onOpenSettings={() => settings.openAt('tools')}
                onExit={() => {
                  flip.setOpen(false)
                  selection.reset()
                }}
              />

              <GroupActivityBoard
                screen={groups}
                cls={activeClass}
                studentsById={studentsById}
                absentIds={absentIds}
                points={pointsMode !== 'none'}
                store={store}
              />
            </main>
            {lineScreen.open && (
              <LinePanel
                line={lineScreen.line}
                studentsById={studentsById}
                homerooms={homeroomTagged}
                points={pointsMode !== 'none'}
                onStar={lineScreen.star}
                onDone={lineScreen.done}
                onSkip={lineScreen.skip}
                onAskLeave={lineScreen.askLeave}
                onClear={lineScreen.askClear}
                silent={!lineScreen.sounds}
                onSetSilent={(silent) => store.setLineSilent(activeClass.id, silent)}
                steps={lineScreen.steps}
                stepNames={lineScreen.stepNames}
                lineName={lineScreen.savedLine?.name ?? null}
                onAskSteps={lineScreen.askSteps}
                changing={lineScreen.changing}
                onToggleChanging={lineScreen.toggleChanging}
                onCycle={lineScreen.tapCard}
              />
            )}
          </div>
        </div>
      </div>

      <LineWindows lineScreen={lineScreen} cls={activeClass} studentOf={(id) => studentsById.get(id) ?? null} store={store} />

      <Toast toast={toast.toast} onClear={toast.clear} />

      <GroupActivityWindows
        screen={groups}
        cls={activeClass}
        presentSeating={presentSeating}
        studentsById={studentsById}
        absentIds={absentIds}
        homerooms={homeroomTagged}
        plan={plan}
        pointsMode={pointsMode}
        store={store}
        toast={toast.show}
      />

      <ChooseAvatarWindow
        choosing={choosing}
        cls={activeClass}
        onChoose={(studentId, avatarId) => store.updateStudent(activeClass.id, studentId, { avatarId })}
      />

      <AttendanceReminder
        cls={reminder.askFor === activeClass.id ? activeClass : null}
        onTake={takeAttendanceNow}
        onLater={reminder.later}
        onClose={reminder.close}
      />

      <SendStarsModal
        open={sendStarsAsk && (deskStars ?? 0) > 0}
        cls={activeClass}
        stars={deskStars ?? 0}
        onSend={allStarsIn}
        onClose={() => setSendStarsAsk(false)}
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
        onSetSilent={(silent) => store.setGetReady(activeClass.id, { getReadySilent: silent })}
        onChooseDrum={(seconds) => store.setGetReady(activeClass.id, { getReadyDrum: seconds })}
        onAward={(stars) => {
          // The whole class, so it goes in no one's participation record.
          if (pointsMode === 'students') store.adjustPoints(activeClass.id, seatedIds, stars)
          else store.addToClassGoal(activeClass.id, stars)
        }}
        onLiftMeter={setMeterLifted}
        onClose={() => setGetReadyOpen(false)}
      />

      <ClassSettingsWindow
        settings={settings}
        cls={activeClass}
        store={store}
        theme={theme}
        photos={photos}
        onSwitchTeacher={openSwitchTeacher}
        onNewClass={newClass}
        // A pick is ringed by desk, and that desk now holds somebody else.
        onMixUpSeats={picker.dismiss}
        onStudentsChoose={() => {
          // The desks have to be in view: the cards come down, and a pick or a selection on the
          // board goes, as for Attendance.
          flip.setOpen(false)
          lineScreen.setOpen(false)
          picker.dismiss()
          selection.reset()
          choosing.start()
        }}
        studentsChooseBlocked={groups.open}
        tools={{
          showFloat: goalLive && canFloat,
          setName: plan.setName,
          getReadyPrize: activeClass.getReadyPrize ?? DEFAULT_GET_READY_PRIZE,
          onSetGetReadyPrize: (prize) => store.setGetReady(activeClass.id, { getReadyPrize: prize }),
          flip: flip.deck.settings,
          onUpdateFlip: flip.deck.updateSettings,
          onGoTo: goToTool,
        }}
      />

      {/* The timer, big over the board; put away, it is the clock in the bar. */}
      <TimerDim />
      <BigTimer />

      {settings.open && !splashOpen && <SettingsGuide settings={settings} />}

      {settings.tourOpen && <Tour onClose={settings.closeTour} />}

      {goalLive && (
        <FloatingGoalFor
          float={float}
          cls={activeClass}
          store={store}
          picker={picker}
          studentsById={studentsById}
          homerooms={homeroomTagged}
          // Off whenever the side panel's Pick Student would be, or it would pick behind cards.
          canPick={!picker.isPicking && !swapMode && !attendanceMode && !choosing.on && !flip.open && !groups.open && seatedIds.length > 0}
          onPick={(win) => points.startPick(() => picker.pickStudent(win))}
          canGetReady={!getReadyOpen && !picker.isPicking && !swapMode && !attendanceMode && !choosing.on}
          onOpenChest={quests.requestChestOpen}
        />
      )}
    </>
  )
}
