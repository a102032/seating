import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { dateKey, takenDays } from '../lib/attendance'
import { lastSaveFailed, loadLocalState, saveLocalState, subscribeSaveFailures } from '../lib/localStore'
import { getTheme, hasNoAvatar, randomPose, stickerId } from '../lib/stickers'
import { moveStudent, type GroupScheme } from '../lib/groups'
import { MAX_SEATS, planFor, reseatForLayout, type RoomLayout } from '../lib/layouts'
import { type DayCount, withCount, withoutDay, withoutStudent, withPick, withPoints } from '../lib/participation'
import { goalIsLive, pointsModeOf, starsWaitOnDesks } from '../lib/points'
import { type ClassData, type Gender, type GroupStatus, type PointsMode, type Student, type StudentGroup } from '../types'
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

/** A new class's goal: on, so the treasure chest is there from the first lesson (2026-10-06, the teacher's call). */
const NEW_CLASS_GOAL = 50

function makeClass(name: string): ClassData {
  const now = new Date().toISOString()
  return {
    id: genId(),
    name,
    students: [],
    seating: emptySeating(),
    pointsGoal: NEW_CLASS_GOAL,
    goalEnabled: true,
    pointsMode: 'goal',
    classPoints: 0,
    updatedAt: now,
    createdAt: now,
  }
}

const firstClass = () => makeClass('Class 1')

/** A class as saved by any version of the app, with everything this version expects. */
function normalizeClass(c: ClassData): ClassData {
  return withAvatarsSwitch(c.seating?.length >= MAX_SEATS ? c : { ...c, seating: withAllDesks(c.seating) })
}

/**
 * Before the Avatars switch, a teacher who wanted names only gave the whole class No Avatar. A
 * class whose students all have it (two or more, so it was the whole class rather than one
 * family's choice) becomes a class with its avatars switched off, and its students are free to
 * have a character again when they are switched back on.
 */
function withAvatarsSwitch(c: ClassData): ClassData {
  if (c.avatarsOff !== undefined || c.students.length < 2 || !c.students.every(hasNoAvatar)) return c
  return { ...c, avatarsOff: true, students: c.students.map((s) => ({ ...s, avatarId: undefined })) }
}

/**
 * Give every listed student `delta` stars, the way the class runs its points.
 *
 * Straight to the goal (the default): the stars go onto the class goal at once, converted at
 * the teacher's rate, and nothing stays on the desk. The meter only ever moves forward, so a
 * minus has nothing to act on - which is why there is no minus button this way.
 *
 * Stars on the desks first: they wait on the desks, where the class can see them, and minus
 * takes one back (floored at 0) - a star still at stake, never one already in the jar. All
 * Stars In! (bankDeskStars) sends them to the goal.
 *
 * With the goal switched off the meter stays where it is. It used to fill out of sight, so
 * switching the goal back on showed a meter the class had never watched move, and a goal
 * could be passed with no celebration.
 */
function awardStars(c: ClassData, studentIds: string[], delta: number): ClassData {
  if (starsWaitOnDesks(c)) {
    const ids = new Set(studentIds)
    return { ...c, students: c.students.map((s) => (ids.has(s.id) ? { ...s, points: Math.max(0, (s.points ?? 0) + delta) } : s)) }
  }
  if (delta <= 0 || !goalIsLive(c)) return c
  return starsToGoal(c, studentIds.length * delta)
}

/**
 * Stars onto the meter at the teacher's rate. The leftovers are banked rather than dropped, so
 * awarding one star at a time eventually counts for as much as awarding them all at once.
 */
function starsToGoal(c: ClassData, stars: number): ClassData {
  if (stars <= 0) return c
  const perClassPoint = Math.max(1, Math.round(c.starsPerClassPoint ?? 1))
  const banked = (c.goalRemainder ?? 0) + stars
  return addClassPoints({ ...c, goalRemainder: banked % perClassPoint }, Math.floor(banked / perClassPoint))
}

/** Every desk's stars onto the goal, and the desks empty for the next lesson. */
function withDeskStarsBanked(c: ClassData): ClassData {
  const waiting = c.students.reduce((n, s) => n + (s.points ?? 0), 0)
  const cleared = { ...c, students: c.students.map((s) => (s.points ? { ...s, points: 0 } : s)) }
  return goalIsLive(c) ? starsToGoal(cleared, waiting) : cleared
}

/** Move the goal meter by whole class points, wrapping back down when the goal is hit. */
function addClassPoints(c: ClassData, amount: number): ClassData {
  if (amount <= 0) return c
  let classPoints = (c.classPoints ?? 0) + amount
  const goal = c.pointsGoal ?? 0
  let goalsReached = c.goalsReached ?? 0
  let goalReachedOn = c.goalReachedOn
  if (goal > 0 && classPoints >= goal) {
    goalsReached += Math.floor(classPoints / goal)
    classPoints %= goal
    goalReachedOn = dateKey()
  }
  return { ...c, classPoints, goalsReached, goalReachedOn }
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

export { goalIsLive, pointsModeOf, starsWaitOnDesks }

/** Every desk's stars back to none. */
function withDesksEmpty(c: ClassData): ClassData {
  return { ...c, students: c.students.map((s) => (s.points ? { ...s, points: 0 } : s)) }
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

  // A newcomer to a class with its avatars switched off shows by name like everyone else; the
  // switch, not their avatar, is what keeps the board names only.
  /** Returns the new students' ids, so an import can be taken back out again exactly. */
  const addStudents = useCallback(
    (classId: string, students: Omit<Student, 'id'>[]): string[] => {
      const added = students.map((s) => ({ ...s, id: genId() }))
      updateClass(classId, (c) => ({ ...c, students: [...c.students, ...added] }))
      return added.map((s) => s.id)
    },
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
        const targeted = (s: Student) => options.scope === 'all' || s.gender === options.scope
        const theme = getTheme(themeId)
        if (!theme) return c

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
   * groups, the participation record, and the attendance record, where a day they were away would otherwise keep a
   * column in the export with nobody in it. The days themselves stay taken.
   */
  /** Students out of the class, and out of everything that remembers them: seats, groups, attendance, who had a turn. */
  const deleteStudents = useCallback(
    (classId: string, studentIds: string[]) => {
      const gone = new Set(studentIds)
      updateClass(classId, (c) => ({
        ...c,
        students: c.students.filter((s) => !gone.has(s.id)),
        seating: c.seating.map((seat) => (seat && gone.has(seat) ? null : seat)),
        groups: c.groups?.map((g) => ({ ...g, studentIds: g.studentIds.filter((id) => !gone.has(id)) })),
        attendance:
          c.attendance && Object.fromEntries(Object.entries(c.attendance).map(([day, ids]) => [day, ids.filter((id) => !gone.has(id))])),
        participation: studentIds.reduce((record, id) => withoutStudent(record, id), c.participation),
        pickRound: c.pickRound && { ...c.pickRound, ids: c.pickRound.ids.filter((id) => !gone.has(id)) },
      }))
    },
    [updateClass],
  )

  const deleteStudent = useCallback((classId: string, studentId: string) => deleteStudents(classId, [studentId]), [deleteStudents])

  /**
   * A new list in place of the class's students (2026-10-06, the teacher): what a teacher does
   * after importing the wrong roster is import the right one, and adding it to the wrong one
   * helped nobody. Everyone on the old list goes, with their seats and records, as if deleted.
   */
  const replaceStudents = useCallback(
    (classId: string, students: Omit<Student, 'id'>[]) => {
      const cls = classes.find((c) => c.id === classId)
      if (cls)
        deleteStudents(
          classId,
          cls.students.map((s) => s.id),
        )
      return addStudents(classId, students)
    },
    [classes, deleteStudents, addStudents],
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

  /**
   * `day`, when given, puts the award in the participation record: a star given to some
   * students, as opposed to the whole class at once, which says nothing about one child.
   */
  const adjustPoints = useCallback(
    (classId: string, studentIds: string[], delta: number, day?: string) =>
      updateClass(classId, (c) => {
        const awarded = awardStars(c, studentIds, delta)
        return day && delta > 0 ? withPoints(awarded, studentIds, day) : awarded
      }),
    [updateClass],
  )

  /** All Stars In!: every desk's stars fly to the goal, and the desks start the next lesson empty. */
  const bankDeskStars = useCallback((classId: string) => updateClass(classId, withDeskStarsBanked), [updateClass])

  /**
   * Straight to the goal, or stars on the desks first. A class starting to put stars on its desks
   * starts them empty: older saves hold a running total from when every class counted stars all
   * term, and those stars went to the goal when they were given. Going back the other way, stars
   * still waiting go to the goal rather than being lost.
   */
  const setStarsOnDesks = useCallback(
    (classId: string, on: boolean) =>
      updateClass(classId, (c) => {
        if ((c.starsOnDesks === true) === on) return c
        if (on) return { ...withDesksEmpty(c), starsOnDesks: true }
        return { ...withDeskStarsBanked(c), starsOnDesks: false }
      }),
    [updateClass],
  )

  /**
   * A student was picked, for the participation record. `round` is Pick Student's round after
   * this pick, for the pickers that keep one with the class (the seating chart's).
   */
  const recordPick = useCallback(
    (classId: string, studentId: string, day: string, round?: string[]) =>
      updateClass(classId, (c) => {
        const next = withPick(c, studentId, day)
        return round ? { ...next, pickRound: { day, ids: round } } : next
      }),
    [updateClass],
  )

  /** Start a New Round: everyone can be picked again. The record of who was picked stays. */
  const startNewRound = useCallback((classId: string) => updateClass(classId, (c) => ({ ...c, pickRound: undefined })), [updateClass])

  // --- Fixing the participation record (the report in Class Settings) ---------------------
  // The teacher tries things out in real lessons, and a test pick or point counts as much as a
  // real one: in the report, and in the picker's better chance for the students picked less
  // often. The round is only ever today's, so whatever takes today's picks back out gives the
  // turns back too: a student whose pick is undone hasn't had their turn.

  /** One student's day, set by hand. */
  const setParticipation = useCallback(
    (classId: string, day: string, studentId: string, count: DayCount) =>
      updateClass(classId, (c) => {
        const round = c.pickRound
        const turnBack = round?.day === day && count[0] <= 0
        return {
          ...c,
          participation: withCount(c.participation, day, studentId, count),
          pickRound: turnBack ? { ...round, ids: round.ids.filter((id) => id !== studentId) } : round,
        }
      }),
    [updateClass],
  )

  /** A whole day out of the record. */
  const clearParticipationDay = useCallback(
    (classId: string, day: string) =>
      updateClass(classId, (c) => ({
        ...c,
        participation: withoutDay(c.participation, day),
        pickRound: c.pickRound?.day === day ? undefined : c.pickRound,
      })),
    [updateClass],
  )

  /** The whole record back to nothing, and everyone's turn with it. */
  const clearParticipation = useCallback(
    (classId: string) => updateClass(classId, (c) => ({ ...c, participation: {}, pickRound: undefined })),
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

  /**
   * A class goal, student points, or none. Stars waiting on the desks for the goal go into it
   * before the goal goes, rather than being lost; any other stars on the desks are cleared, so a
   * new way of running points starts with the desks empty - a student's stars never turn into a
   * class goal's, or the other way round. (The teacher is asked first when that clears students'
   * stars.) The goal keeps its number for when it comes back, and gets one if it never had one.
   */
  const setPointsMode = useCallback(
    (classId: string, mode: PointsMode) =>
      updateClass(classId, (c) => {
        if (pointsModeOf(c) === mode) return c
        const banked = goalIsLive(c) && starsWaitOnDesks(c) ? withDeskStarsBanked(c) : c
        return {
          ...withDesksEmpty(banked),
          pointsMode: mode,
          goalEnabled: mode === 'goal',
          ...(mode === 'goal' && !((c.pointsGoal ?? 0) > 0) && { pointsGoal: NEW_CLASS_GOAL }),
        }
      }),
    [updateClass],
  )

  /** Clear All Stars, with student points: everyone back to 0, when the teacher says a week or a term is over. */
  const clearDeskStars = useCallback((classId: string) => updateClass(classId, withDesksEmpty), [updateClass])

  const setShowAllHomerooms = useCallback(
    (classId: string, show: boolean) => updateClass(classId, (c) => ({ ...c, showAllHomerooms: show })),
    [updateClass],
  )

  const setAvatarsOff = useCallback(
    (classId: string, off: boolean) => updateClass(classId, (c) => ({ ...c, avatarsOff: off })),
    [updateClass],
  )

  const setGetReady = useCallback(
    (classId: string, patch: Partial<Pick<ClassData, 'getReadyPrize' | 'getReadyDrum' | 'getReadySilent'>>) =>
      updateClass(classId, (c) => ({ ...c, ...patch })),
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

  /** Clears the shared meter without touching any stars waiting on the desks. */
  const resetClassGoal = useCallback(
    (classId: string) => updateClass(classId, (c) => ({ ...c, classPoints: 0, goalRemainder: 0 })),
    [updateClass],
  )

  // --- Group Activity -------------------------------------------------------------------

  // A new deal says how it was made; a shuffle, a move or a prune keeps what made them.
  const setGroups = useCallback(
    (classId: string, groups: StudentGroup[], madeBy?: GroupScheme) =>
      updateClass(classId, (c) => ({ ...c, groups, ...(madeBy ? { groupsMadeBy: madeBy } : {}) })),
    [updateClass],
  )

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

  /**
   * The activity is over: the groups' points go out and the cards go back to zero. With a class
   * goal they go onto the goal, one class point each; with student points every student in a
   * group gets its points, onto their desk (stars for each member came back for this way of
   * running points, 2026-10-11). With no points there are none. The groups themselves stay, so
   * the same teams can be picked up again tomorrow. Group points are the whole group's, so they
   * go in no one's participation record.
   */
  const finishGroupActivity = useCallback(
    (classId: string) =>
      updateClass(classId, (c) => {
        const groups = c.groups ?? []
        const total = groups.reduce((sum, g) => sum + g.points, 0)
        let next = c
        if (pointsModeOf(c) === 'goal') next = addClassPoints(c, total)
        else if (pointsModeOf(c) === 'students') {
          const earned = new Map<string, number>()
          groups.forEach((g) => g.studentIds.forEach((id) => earned.set(id, (earned.get(id) ?? 0) + g.points)))
          next = { ...c, students: c.students.map((s) => (earned.get(s.id) ? { ...s, points: (s.points ?? 0) + earned.get(s.id)! } : s)) }
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
    setGoalSettings,
    setPointsMode,
    clearDeskStars,
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
  }
}

export type { Gender }
