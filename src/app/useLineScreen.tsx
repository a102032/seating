import { useMemo, useRef, useState } from 'react'
import { ConfirmModal } from '../components/ConfirmModal'
import { LineLeaveModal, LineStartModal, type LineChoice } from '../components/Line'
import type { useClasses } from '../hooks/useClasses'
import {
  checkedOf,
  clearLine,
  cycleSteps,
  doneInLine,
  joinLine,
  leaveLine,
  lineCount,
  lineIsFresh,
  lineMarksOf,
  lineOf,
  savedLineOf,
  skipInLine,
  stepNamesOf,
  stepsOf,
} from '../lib/line'
import { playCoinTick, playLineCall, playLineDone, playLineJoin } from '../lib/sound'
import { sparkleDesk } from '../lib/sparkle'
import { flyStarsToGoal } from '../lib/starFlight'
import type { ClassData, PointsMode, Student } from '../types'

type Store = ReturnType<typeof useClasses>

interface Options {
  cls: ClassData | undefined
  today: string
  store: Pick<Store, 'changeLine' | 'startLine' | 'adjustPoints' | 'saveLine' | 'deleteLine'>
  pointsMode: PointsMode
  goalLive: boolean
  desksMode: boolean
}

/**
 * The Line (lib/line): a doctor's office for checking work. Its screen - the column on the right
 * of the desks, a desk tap putting its student in line - and its windows ("Start the Line", "get
 * out of line?", "Clear the line?") keep their state here.
 */
export function useLineScreen({ cls, today, store, pointsMode, goalLive, desksMode }: Options) {
  const classId = cls?.id ?? null
  /** The Line is up: a desk tap puts its student in line, and the column on the right holds the teacher's buttons. */
  const [open, setOpen] = useState(false)
  /** Whose "get out of line?" window is open. */
  const [leaveFor, setLeaveFor] = useState<string | null>(null)
  const [clearAsk, setClearAsk] = useState(false)
  /** The last desk tapped in the Line, and when: the board's second touch must not open "get out of line?". */
  const lastTap = useRef({ index: -1, at: 0 })
  /** Desk taps wait until then: the window just closed, and the board's second touch lands on a desk under it. */
  const quietUntil = useRef(0)

  /** Today's line (lib/line), and each student's mark on their desk while the Line is up. */
  const line = useMemo(() => lineOf(cls, today), [cls, today])
  /** How many steps the class's task has (each one checked at the teacher's desk; all of them is Done). */
  const steps = stepsOf(cls)
  const stepNames = useMemo(() => stepNamesOf(cls), [cls])
  const savedLine = savedLineOf(cls)
  /** Change Steps is on: a desk tap moves that student a step, instead of putting them in line. */
  const [changing, setChanging] = useState(false)
  /** "Start the Line" is up: as a fresh line opens, or from the line's name on the column. */
  const [stepsAsk, setStepsAsk] = useState(false)
  if (!open && changing) setChanging(false)
  const marks = useMemo(
    () =>
      open
        ? lineMarksOf(
            line,
            steps,
            (cls?.seating ?? []).filter((id): id is string => Boolean(id)),
            changing,
            stepNames,
          )
        : undefined,
    [open, line, steps, changing, cls, stepNames],
  )
  /**
   * The Line's sounds: the pop as a child joins, the "ding-dong" calling the next, and Done's run
   * of notes. The speaker on its column turns them off for the class (lineSilent).
   */
  const sounds = cls?.lineSilent !== true

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    // A fresh line is a new activity, and so is the first time today with nobody in line (a saved
    // line keeps its steps from yesterday): which line, and how many steps, come first, as "How
    // long?" does for Get Ready!.
    const newDay = cls?.line?.day !== today && lineCount(line) === 0
    if (lineIsFresh(line) || newDay) setStepsAsk(true)
    else setOpen(true)
  }

  function choose(choice: LineChoice) {
    if (classId) store.startLine(classId, today, choice)
    setStepsAsk(false)
    setOpen(true)
  }

  /** Change Steps: one tap, one step on, through Done and back to none. A tick, never a celebration: it is a correction. */
  function cycleStudentSteps(studentId: string) {
    if (!classId) return
    if (sounds) playLineJoin()
    store.changeLine(classId, today, (l) => cycleSteps(l, studentId, steps))
  }

  /** A child tapped their desk: into line, or straight to the teacher if nobody is with them. */
  function join(studentId: string) {
    if (!classId) return
    if (sounds) {
      if (line.now === null) playLineCall()
      else playLineJoin()
    }
    store.changeLine(classId, today, (l) => joinLine(l, studentId))
  }

  /**
   * Done: the work is finished. Done goes on their desk in place of their picture, with a small
   * burst of stars and a run of notes, and the next one is called once those have rung.
   */
  function done() {
    if (!classId || line.now === null) return
    const finished = line.now
    // The last step is All Done: the stars and the run of notes. An earlier step is a soft pop.
    const allDone = checkedOf(line, finished, steps) + 1 >= steps
    if (sounds) {
      if (allDone) playLineDone()
      else playLineJoin()
      if (line.waiting.length > 0) playLineCall(allDone ? 0.75 : 0.3)
    }
    store.changeLine(classId, today, (l) => doneInLine(l, steps))
    // Once the desk has drawn its Done picture.
    if (allDone) requestAnimationFrame(() => requestAnimationFrame(() => sparkleDesk(finished)))
  }

  /** Skip: to the back of the line, and the next one is called. */
  function skip() {
    if (!classId || line.now === null || line.waiting.length === 0) return
    if (sounds) playLineCall()
    store.changeLine(classId, today, skipInLine)
  }

  function leave(studentId: string) {
    if (!classId) return
    if (sounds && line.now === studentId && line.waiting.length > 0) playLineCall()
    store.changeLine(classId, today, (l) => leaveLine(l, studentId))
  }

  /**
   * A star for the student with the teacher: checking their work is the moment to praise it, and
   * a desk tap can't pick them while the Line is up (it is how children get in line). It goes the
   * way a star from the rail does, and in the participation record, since it is one child's.
   */
  function star() {
    if (!classId || line.now === null || pointsMode === 'none') return
    const id = line.now
    if (goalLive && !desksMode) flyStarsToGoal([id])
    store.adjustPoints(classId, [id], 1, today)
    if (desksMode || !goalLive) playCoinTick()
  }

  /**
   * A child's own desk: into line, or, already in line, "get out of line?". Before a pick on the
   * board, which stays up until Unpick All: the children coming to the board don't clear it.
   */
  function tapDesk(index: number, studentId: string | null, absent: boolean) {
    if (!studentId || absent) return
    const now = performance.now()
    if (now < quietUntil.current) return
    const last = lastTap.current
    lastTap.current = { index, at: now }
    // The board's second touch on the desk that just joined would ask them to leave again.
    if (last.index === index && now - last.at < 700) return
    if (changing) {
      cycleStudentSteps(studentId)
      return
    }
    // In line, the one with the teacher included (2026-10-18, the teacher): "get out of line?".
    if (line.now === studentId || line.waiting.includes(studentId)) setLeaveFor(studentId)
    else join(studentId)
  }

  /** A tap on a student's card in the column, during Change Steps. */
  function tapCard(id: string) {
    // The board's second touch on the card, as on a desk.
    const now = performance.now()
    if (lastTap.current.index === -2 && now - lastTap.current.at < 700) return
    lastTap.current = { index: -2, at: now }
    cycleStudentSteps(id)
  }

  function closeLeave(goOut: boolean) {
    if (goOut && leaveFor) leave(leaveFor)
    quietUntil.current = performance.now() + 700
    setLeaveFor(null)
  }

  function clearIt() {
    if (classId) store.changeLine(classId, today, clearLine)
    setClearAsk(false)
  }

  return {
    open,
    setOpen,
    line,
    steps,
    stepNames,
    savedLine,
    marks,
    sounds,
    changing,
    toggleChanging: () => setChanging((v) => !v),
    stepsAsk,
    askSteps: () => setStepsAsk(true),
    closeStepsAsk: () => setStepsAsk(false),
    leaveFor,
    askLeave: setLeaveFor,
    closeLeave,
    clearAsk,
    askClear: () => setClearAsk(true),
    closeClearAsk: () => setClearAsk(false),
    clearIt,
    toggle,
    choose,
    done,
    skip,
    star,
    tapDesk,
    tapCard,
    /** While the Line is closed, how many are still in it today: nobody's place is lost by closing it. */
    waitingWhileClosed: open ? 0 : lineCount(line),
  }
}

export type LineScreen = ReturnType<typeof useLineScreen>

/** The Line's windows: "Start the Line", "get out of line?" and "Clear the line?". */
export function LineWindows({
  lineScreen: l,
  cls,
  studentOf,
  store,
}: {
  lineScreen: LineScreen
  cls: ClassData
  studentOf: (id: string) => Student | null
  store: Pick<Store, 'saveLine' | 'deleteLine'>
}) {
  return (
    <>
      <LineStartModal
        open={l.stepsAsk}
        savedLines={cls.savedLines ?? []}
        activeId={l.savedLine?.id ?? null}
        onChoose={l.choose}
        onSave={(saved, start) => {
          store.saveLine(cls.id, saved)
          if (start) l.choose({ savedId: saved.id })
        }}
        onDelete={(id) => store.deleteLine(cls.id, id)}
        onClose={l.closeStepsAsk}
      />
      <LineLeaveModal
        student={l.leaveFor ? studentOf(l.leaveFor) : null}
        onLeave={() => l.closeLeave(true)}
        onStay={() => l.closeLeave(false)}
      />
      <ConfirmModal
        open={l.clearAsk}
        title="Clear the line?"
        message={
          l.savedLine
            ? `Everyone in line goes back to their seat, and everyone's steps in ${l.savedLine.name} start again.`
            : 'Everyone in line goes back to their seat, and the Done marks come off the desks.'
        }
        confirmLabel="Clear Line"
        onConfirm={l.clearIt}
        onCancel={l.closeClearAsk}
      />
    </>
  )
}
