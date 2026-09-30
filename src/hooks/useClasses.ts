import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { absentOn, dateKey, takenDays } from '../lib/attendance'
import { lastSaveFailed, loadLocalState, saveLocalState, subscribeSaveFailures } from '../lib/localStore'
import { getTheme, randomPose, stickerId } from '../lib/stickers'
import { moveStudent } from '../lib/groups'
import { MAX_SEATS, planFor, reseatForLayout, type RoomLayout } from '../lib/layouts'
import { type ClassData, type Gender, type GroupPointsMode, type GroupStatus, type Student, type StudentGroup } from '../types'
import { useCloudSync } from './useCloudSync'

export const MAX_CLASSES = 5

/** Who a bulk avatar assignment applies to. */
export type AvatarScope = 'all' | 'boy' | 'girl'

function genId(): string {
  return crypto.randomUUID()
}

function emptySeating(): (string | null)[] {
  return Array.from({ length: MAX_SEATS }, () => null)
}

/**
 * Saves from before the seventh column hold thirty desks, and from before layouts thirty-five;
 * the rest start empty, so every layout has all its desks.
 */
function withAllDesks(seating: (string | null)[] | undefined): (string | null)[] {
  if (!seating) return emptySeating()
  if (seating.length >= MAX_SEATS) return seating
  return [...seating, ...Array.from({ length: MAX_SEATS - seating.length }, () => null)]
}

function makeClass(name: string): ClassData {
  const now = new Date().toISOString()
  return {
    id: genId(),
    name,
    students: [],
    seating: emptySeating(),
    updatedAt: now,
    createdAt: now,
  }
}

const firstClass = () => makeClass('Class 1')

/** A class as saved by any version of the app, with everything this version expects. */
function normalizeClass(c: ClassData): ClassData {
  return c.seating?.length >= MAX_SEATS ? c : { ...c, seating: withAllDesks(c.seating) }
}

/**
 * Give every listed student `delta` stars, and move the class goal meter along with them.
 *
 * The meter only ever moves forward - deductions affect a student's own tally but shouldn't
 * undo the whole class's shared progress toward the goal. Stars convert to class points at
 * the teacher's rate, and the leftovers are banked rather than dropped, so awarding one star
 * at a time eventually counts for as much as awarding them all at once.
 *
 * With the goal switched off the meter stays where it is. It used to fill out of sight, so
 * switching the goal back on showed a meter the class had never watched move, and a goal
 * could be passed with no celebration.
 */
function awardStars(c: ClassData, studentIds: string[], delta: number): ClassData {
  const ids = new Set(studentIds)
  const students = c.students.map((s) => (ids.has(s.id) ? { ...s, points: Math.max(0, (s.points ?? 0) + delta) } : s))
  if (delta <= 0 || !goalIsLive(c)) return { ...c, students }

  const perClassPoint = Math.max(1, Math.round(c.starsPerClassPoint ?? 1))
  const banked = (c.goalRemainder ?? 0) + studentIds.length * delta
  return addClassPoints({ ...c, students, goalRemainder: banked % perClassPoint }, Math.floor(banked / perClassPoint))
}

/** Move the goal meter by whole class points, wrapping back down when the goal is hit. */
function addClassPoints(c: ClassData, amount: number): ClassData {
  if (amount <= 0) return c
  let classPoints = (c.classPoints ?? 0) + amount
  const goal = c.pointsGoal ?? 0
  let goalsReached = c.goalsReached ?? 0
  if (goal > 0 && classPoints >= goal) {
    goalsReached += Math.floor(classPoints / goal)
    classPoints %= goal
  }
  return { ...c, classPoints, goalsReached }
}

/**
 * The order desks are filled in: bottom row first, left to right, then up row by row, in
 * whatever layout the class has. The extra desks a big class gets are only there for a class
 * of more than thirty, so a smaller class fills as it always did.
 */
function fillOrder(c: ClassData): number[] {
  return planFor(c).fillOrder
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** The day counts as taken. Writes the taken list out in full, so an old save gets one. */
function withDayTaken(c: ClassData, day: string): ClassData {
  if (c.attendanceTaken?.includes(day)) return c
  const taken = takenDays(c)
  return { ...c, attendanceTaken: taken.includes(day) ? taken : [...taken, day].sort() }
}

/** The class goal has to exist and be switched on for group points to have anywhere to go. */
export function goalIsLive(c: ClassData): boolean {
  return (c.pointsGoal ?? 0) > 0 && c.goalEnabled !== false
}

/** The mode a class will actually use: "class goal" falls back to students while there's no goal. */
export function effectiveGroupPointsMode(c: ClassData): GroupPointsMode {
  return c.groupPointsMode === 'goal' && goalIsLive(c) ? 'goal' : 'students'
}

export function useClasses() {
  const initial = useMemo(() => loadLocalState(), [])
  const [classes, setClasses] = useState<ClassData[]>(() => initial?.classes.map(normalizeClass) ?? [firstClass()])
  const [chosenClassId, setActiveClassId] = useState<string | null>(initial?.activeClassId ?? initial?.classes?.[0]?.id ?? null)
  // A class can go away underneath the board (deleted here, or on another computer), so the
  // open class falls back to the first one.
  const activeClassId = classes.some((c) => c.id === chosenClassId) ? chosenClassId : (classes[0]?.id ?? null)
  const saveError = useSyncExternalStore(subscribeSaveFailures, lastSaveFailed)

  // The board's own copy, always: the app opens instantly and works with no internet, signed
  // in or not.
  useEffect(() => {
    saveLocalState({ classes, activeClassId })
  }, [classes, activeClassId])

  const cloud = useCloudSync({
    classes,
    setClasses,
    activeClassId,
    setActiveClassId,
    seed: firstClass,
    normalize: normalizeClass,
    maxClasses: MAX_CLASSES,
  })

  const updateClass = useCallback((id: string, updater: (cls: ClassData) => ClassData) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...updater(c), updatedAt: new Date().toISOString() } : c)))
  }, [])

  const activeClass = classes.find((c) => c.id === activeClassId)

  const createClass = useCallback(
    (name?: string) => {
      if (classes.length >= MAX_CLASSES) return
      const cls = makeClass(name?.trim() || `Class ${classes.length + 1}`)
      setClasses((prev) => [...prev, cls])
      setActiveClassId(cls.id)
    },
    [classes.length],
  )

  const renameClass = useCallback((id: string, name: string) => updateClass(id, (c) => ({ ...c, name })), [updateClass])

  const deleteClass = useCallback((id: string) => {
    setClasses((prev) => {
      const next = prev.filter((c) => c.id !== id)
      return next.length > 0 ? next : [firstClass()]
    })
  }, [])

  const addStudents = useCallback(
    (classId: string, students: Omit<Student, 'id'>[]) =>
      updateClass(classId, (c) => ({
        ...c,
        students: [...c.students, ...students.map((s) => ({ ...s, id: genId() }))],
      })),
    [updateClass],
  )

  const updateStudent = useCallback(
    (classId: string, studentId: string, patch: Partial<Omit<Student, 'id'>>) =>
      updateClass(classId, (c) => ({
        ...c,
        students: c.students.map((s) => (s.id === studentId ? { ...s, ...patch } : s)),
      })),
    [updateClass],
  )

  /**
   * Hand the same character out to a whole class in one tap - setting thirty avatars
   * one at a time is the slowest part of starting a new class.
   */
  const assignAvatars = useCallback(
    (classId: string, themeId: string, options: { scope: AvatarScope; poses: 'mixed' | 'same' }) =>
      updateClass(classId, (c) => {
        const theme = getTheme(themeId)
        if (!theme) return c
        const targeted = (s: Student) => options.scope === 'all' || s.gender === options.scope

        // Re-tapping the character the class already has should visibly re-roll, so in
        // "same" mode steer the single shared draw away from the pose they're wearing.
        const worn = c.students.find(targeted)?.avatarId?.split('/')
        const avoid = worn?.[0] === theme.id ? worn[1] : undefined
        const shared = options.poses === 'same' ? randomPose(theme, avoid) : undefined

        return {
          ...c,
          students: c.students.map((s) => (targeted(s) ? { ...s, avatarId: stickerId(theme.id, shared ?? randomPose(theme)) } : s)),
        }
      }),
    [updateClass],
  )

  /**
   * Gone from the roster means gone from everything: their seat, their team in the last
   * groups, and the attendance record, where a day they were away would otherwise keep a
   * column in the export with nobody in it. The days themselves stay taken.
   */
  const deleteStudent = useCallback(
    (classId: string, studentId: string) =>
      updateClass(classId, (c) => ({
        ...c,
        students: c.students.filter((s) => s.id !== studentId),
        seating: c.seating.map((seat) => (seat === studentId ? null : seat)),
        groups: c.groups?.map((g) => ({ ...g, studentIds: g.studentIds.filter((id) => id !== studentId) })),
        attendance:
          c.attendance && Object.fromEntries(Object.entries(c.attendance).map(([day, ids]) => [day, ids.filter((id) => id !== studentId)])),
      })),
    [updateClass],
  )

  const swapSeats = useCallback(
    (classId: string, deskA: number, deskB: number) =>
      updateClass(classId, (c) => {
        const seating = [...c.seating]
        ;[seating[deskA], seating[deskB]] = [seating[deskB], seating[deskA]]
        return { ...c, seating }
      }),
    [updateClass],
  )

  const unseatAll = useCallback((classId: string) => updateClass(classId, (c) => ({ ...c, seating: emptySeating() })), [updateClass])

  const seatClass = useCallback(
    (classId: string) =>
      updateClass(classId, (c) => {
        const seatedIds = new Set(c.seating.filter((s): s is string => s !== null))
        const unseated = c.students
          .filter((s) => !seatedIds.has(s.id))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

        const emptyDesks = fillOrder(c).filter((i) => c.seating[i] === null)

        const seating = [...c.seating]
        emptyDesks.forEach((deskIndex, i) => {
          const student = unseated[i]
          if (student) seating[deskIndex] = student.id
        })
        return { ...c, seating }
      }),
    [updateClass],
  )

  /**
   * A new seating plan in one tap: everyone on the roster dealt into random seats, back rows
   * first like Seat Students, so the empty desks are left at the front. Before this, a fresh
   * plan meant Unseat All and then placing the class by hand.
   */
  const mixUpSeats = useCallback(
    (classId: string) =>
      updateClass(classId, (c) => {
        const order = fillOrder(c)
        const seating = emptySeating()
        shuffled(c.students.map((s) => s.id)).forEach((id, i) => {
          if (i < order.length) seating[order[i]] = id
        })
        return { ...c, seating }
      }),
    [updateClass],
  )

  /**
   * The room's layout. Between the grid layouts nobody moves; into or out of tables the class
   * keeps its order and closes up (lib/layouts, reseatForLayout).
   */
  const setLayout = useCallback(
    (classId: string, layout: RoomLayout) =>
      updateClass(classId, (c) => ((c.layout ?? 'rows') === layout ? c : { ...c, layout, seating: reseatForLayout(c, layout) })),
    [updateClass],
  )

  /**
   * Attendance mode: a tap marks a student absent for the day, and a second tap brings them
   * back. Anything done in the mode is taking attendance, so the day counts as taken from the
   * first tap - a class left mid-mode keeps its record, as it always did.
   */
  const toggleAbsent = useCallback(
    (classId: string, studentId: string, day: string) =>
      updateClass(classId, (c) => {
        const absent = c.attendance?.[day] ?? []
        const next = absent.includes(studentId) ? absent.filter((id) => id !== studentId) : [...absent, studentId]
        return { ...withDayTaken(c, day), attendance: { ...c.attendance, [day]: next } }
      }),
    [updateClass],
  )

  /** Attendance mode was switched off: the day counts as taken, even with nobody away. */
  const markAttendanceTaken = useCallback(
    (classId: string, day: string) => updateClass(classId, (c) => withDayTaken(c, day)),
    [updateClass],
  )

  /**
   * A tap in the attendance record: fixing a past day, or marking one ahead. Unlike the mode,
   * this is not taking attendance - a student marked away for Friday must not give Friday its
   * check. A day left with nobody away and never taken drops out of the record entirely.
   */
  const toggleAbsentInRecord = useCallback(
    (classId: string, studentId: string, day: string) =>
      updateClass(classId, (c) => {
        const absent = c.attendance?.[day] ?? []
        const next = absent.includes(studentId) ? absent.filter((id) => id !== studentId) : [...absent, studentId]
        const taken = takenDays(c)
        const attendance = { ...c.attendance, [day]: next }
        if (next.length === 0 && !taken.includes(day)) delete attendance[day]
        // The taken list is written out before the record changes: an old save has none, and
        // without it a day marked ahead would read as taken.
        return { ...c, attendanceTaken: taken, attendance }
      }),
    [updateClass],
  )

  const unseatStudent = useCallback(
    (classId: string, studentId: string) =>
      updateClass(classId, (c) => ({
        ...c,
        seating: c.seating.map((seat) => (seat === studentId ? null : seat)),
      })),
    [updateClass],
  )

  const adjustPoints = useCallback(
    (classId: string, studentIds: string[], delta: number) => updateClass(classId, (c) => awardStars(c, studentIds, delta)),
    [updateClass],
  )

  /**
   * Stars only. Clearing the shared meter is a separate decision - a teacher wiping
   * individual tallies at the end of a unit usually doesn't want to destroy the class's
   * progress toward its reward at the same time.
   */
  const resetPoints = useCallback(
    (classId: string) => updateClass(classId, (c) => ({ ...c, students: c.students.map((s) => ({ ...s, points: 0 })) })),
    [updateClass],
  )

  const setGoalSettings = useCallback(
    (classId: string, goal: number, starsPerClassPoint: number) =>
      updateClass(classId, (c) => {
        const pointsGoal = Math.max(0, Math.round(goal))
        return {
          ...c,
          pointsGoal,
          // A goal lowered below what's on the meter leaves it full, not past full: the meter
          // read "40 / 30" until the next point. Full waits for one more point to open the chest.
          classPoints: pointsGoal > 0 ? Math.min(c.classPoints ?? 0, pointsGoal) : c.classPoints,
          starsPerClassPoint: Math.max(1, Math.round(starsPerClassPoint)),
        }
      }),
    [updateClass],
  )

  const setGoalEnabled = useCallback(
    (classId: string, enabled: boolean) => updateClass(classId, (c) => ({ ...c, goalEnabled: enabled })),
    [updateClass],
  )

  const setCelebrationGif = useCallback(
    (classId: string, gifId: string) => updateClass(classId, (c) => ({ ...c, celebrationGifId: gifId })),
    [updateClass],
  )

  /**
   * Set the meter directly - the tucked-away fix for a point that landed by mistake, the way
   * a student's stars can be edited in the roster. Held to the goal, and never a celebration.
   */
  const setClassPoints = useCallback(
    (classId: string, points: number) =>
      updateClass(classId, (c) => {
        const goal = c.pointsGoal ?? 0
        const clamped = Math.max(0, Math.round(points))
        return { ...c, classPoints: goal > 0 ? Math.min(goal, clamped) : clamped }
      }),
    [updateClass],
  )

  /**
   * A class point straight onto the meter, with no student behind it: a marble dropped in the
   * jar. It is what the floating class goal's +1 does, and it fills the goal like any other
   * point would.
   */
  const addToClassGoal = useCallback(
    (classId: string, amount: number) => updateClass(classId, (c) => addClassPoints(c, amount)),
    [updateClass],
  )

  /** Clears the shared meter without touching anyone's stars. */
  const resetClassGoal = useCallback(
    (classId: string) => updateClass(classId, (c) => ({ ...c, classPoints: 0, goalRemainder: 0 })),
    [updateClass],
  )

  // --- Group Activity -------------------------------------------------------------------

  const setGroups = useCallback((classId: string, groups: StudentGroup[]) => updateClass(classId, (c) => ({ ...c, groups })), [updateClass])

  const adjustGroupPoints = useCallback(
    (classId: string, groupId: string, delta: number) =>
      updateClass(classId, (c) => ({
        ...c,
        groups: (c.groups ?? []).map((g) => (g.id === groupId ? { ...g, points: Math.max(0, g.points + delta) } : g)),
      })),
    [updateClass],
  )

  const moveStudentToGroup = useCallback(
    (classId: string, studentId: string, groupId: string) =>
      updateClass(classId, (c) => ({ ...c, groups: moveStudent(c.groups ?? [], studentId, groupId) })),
    [updateClass],
  )

  /** Every group back to zero, for a fresh round of the same activity. */
  const resetGroupPoints = useCallback(
    (classId: string) => updateClass(classId, (c) => ({ ...c, groups: (c.groups ?? []).map((g) => ({ ...g, points: 0 })) })),
    [updateClass],
  )

  const setGroupStatus = useCallback(
    (classId: string, groupId: string, status: GroupStatus) =>
      updateClass(classId, (c) => ({ ...c, groups: (c.groups ?? []).map((g) => (g.id === groupId ? { ...g, status } : g)) })),
    [updateClass],
  )

  const setGroupPointsMode = useCallback(
    (classId: string, mode: GroupPointsMode) => updateClass(classId, (c) => ({ ...c, groupPointsMode: mode })),
    [updateClass],
  )

  /**
   * The activity is over: hand the groups' points out the way the teacher chose, then zero
   * them. The groups themselves stay, so the same teams can be picked up again tomorrow.
   */
  const finishGroupActivity = useCallback(
    (classId: string) =>
      updateClass(classId, (c) => {
        const groups = c.groups ?? []
        let next = c
        if (effectiveGroupPointsMode(c) === 'students') {
          // Nobody earns stars on a day they weren't here, even on a team that did well.
          const absent = absentOn(c, dateKey())
          groups.forEach((g) => {
            const present = g.studentIds.filter((id) => !absent.has(id))
            if (g.points > 0) next = awardStars(next, present, g.points)
          })
        } else {
          next = addClassPoints(
            next,
            groups.reduce((sum, g) => sum + g.points, 0),
          )
        }
        return { ...next, groups: groups.map((g) => ({ ...g, points: 0 })) }
      }),
    [updateClass],
  )

  const seatedStudentIds = useMemo(() => new Set((activeClass?.seating ?? []).filter(Boolean) as string[]), [activeClass])

  const unseatedStudents = useMemo(
    () => (activeClass?.students ?? []).filter((s) => !seatedStudentIds.has(s.id)),
    [activeClass, seatedStudentIds],
  )

  return {
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
    setClassPoints,
    addToClassGoal,
    resetPoints,
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
    setGroupPointsMode,
    finishGroupActivity,
    cloud,
    saveError,
  }
}

export type { Gender }
