import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { loadLocalState, saveLocalState } from '../lib/localStore'
import { getTheme, randomPose, stickerId } from '../lib/stickers'
import { moveStudent } from '../lib/groups'
import {
  DESK_COLUMNS,
  DESK_COUNT,
  DESK_ROWS,
  type ClassData,
  type Gender,
  type GroupPointsMode,
  type GroupStatus,
  type Student,
  type StudentGroup,
} from '../types'

export const MAX_CLASSES = 5

/** Who a bulk avatar assignment applies to. */
export type AvatarScope = 'all' | 'boy' | 'girl'

function genId(): string {
  return crypto.randomUUID()
}

function emptySeating(): (string | null)[] {
  return Array.from({ length: DESK_COUNT }, () => null)
}

function makeClass(name: string): ClassData {
  return {
    id: genId(),
    name,
    students: [],
    seating: emptySeating(),
    updatedAt: new Date().toISOString(),
  }
}

interface SupabaseRow {
  id: string
  name: string
  students: Student[]
  seating: (string | null)[]
  updated_at: string
}

function rowToClass(row: SupabaseRow): ClassData {
  return {
    id: row.id,
    name: row.name,
    students: row.students ?? [],
    seating: row.seating ?? emptySeating(),
    updatedAt: row.updated_at,
  }
}

/**
 * Give every listed student `delta` stars, and move the class goal meter along with them.
 *
 * The meter only ever moves forward - deductions affect a student's own tally but shouldn't
 * undo the whole class's shared progress toward the goal. Stars convert to class points at
 * the teacher's rate, and the leftovers are banked rather than dropped, so awarding one star
 * at a time eventually counts for as much as awarding them all at once.
 */
function awardStars(c: ClassData, studentIds: string[], delta: number): ClassData {
  const ids = new Set(studentIds)
  const students = c.students.map((s) => (ids.has(s.id) ? { ...s, points: Math.max(0, (s.points ?? 0) + delta) } : s))
  if (delta <= 0) return { ...c, students }

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
  const [classes, setClasses] = useState<ClassData[]>(initial?.classes ?? [makeClass('Class 1')])
  const [activeClassId, setActiveClassId] = useState<string | null>(
    initial?.activeClassId ?? initial?.classes?.[0]?.id ?? null,
  )
  const [loadedFromCloud, setLoadedFromCloud] = useState(!isSupabaseConfigured)
  const [saveError, setSaveError] = useState(false)
  const pendingWrites = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const applyingRemote = useRef(false)

  useEffect(() => {
    if (!activeClassId && classes.length > 0) {
      setActiveClassId(classes[0].id)
    }
  }, [activeClassId, classes])

  // Always cache to localStorage so the app works instantly offline / before Supabase is configured.
  useEffect(() => {
    setSaveError(!saveLocalState({ classes, activeClassId }))
  }, [classes, activeClassId])

  // Initial cloud load + realtime subscription.
  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    async function load() {
      const { data, error } = await supabase!.from('classes').select('*').order('updated_at', { ascending: true })
      if (cancelled) return
      if (!error && data && data.length > 0) {
        applyingRemote.current = true
        const cloudClasses = (data as SupabaseRow[]).map(rowToClass)
        setClasses(cloudClasses)
        setActiveClassId((current) => (current && cloudClasses.some((c) => c.id === current) ? current : cloudClasses[0].id))
      } else if (!error) {
        // Cloud is empty (fresh Supabase project): seed it with whatever we have locally.
        for (const cls of classes) {
          await supabase!.from('classes').upsert({
            id: cls.id,
            name: cls.name,
            students: cls.students,
            seating: cls.seating,
          })
        }
      }
      setLoadedFromCloud(true)
    }

    void load()

    const channel = supabase
      .channel('classes-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, (payload) => {
        applyingRemote.current = true
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { id: string }).id
          setClasses((prev) => prev.filter((c) => c.id !== deletedId))
        } else {
          const incoming = rowToClass(payload.new as SupabaseRow)
          setClasses((prev) => {
            const exists = prev.some((c) => c.id === incoming.id)
            return exists ? prev.map((c) => (c.id === incoming.id ? incoming : c)) : [...prev, incoming]
          })
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase!.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pushToCloud = useCallback((cls: ClassData) => {
    if (!supabase) return
    const existingTimer = pendingWrites.current.get(cls.id)
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      void supabase!
        .from('classes')
        .upsert({ id: cls.id, name: cls.name, students: cls.students, seating: cls.seating })
      pendingWrites.current.delete(cls.id)
    }, 400)
    pendingWrites.current.set(cls.id, timer)
  }, [])

  const updateClass = useCallback(
    (id: string, updater: (cls: ClassData) => ClassData) => {
      setClasses((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id) return c
          const updated = { ...updater(c), updatedAt: new Date().toISOString() }
          if (!applyingRemote.current) pushToCloud(updated)
          return updated
        })
        applyingRemote.current = false
        return next
      })
    },
    [pushToCloud],
  )

  const activeClass = classes.find((c) => c.id === activeClassId)

  const createClass = useCallback(
    (name?: string) => {
      if (classes.length >= MAX_CLASSES) return
      const cls = makeClass(name?.trim() || `Class ${classes.length + 1}`)
      setClasses((prev) => [...prev, cls])
      setActiveClassId(cls.id)
      pushToCloud(cls)
    },
    [classes.length, pushToCloud],
  )

  const renameClass = useCallback(
    (id: string, name: string) => updateClass(id, (c) => ({ ...c, name })),
    [updateClass],
  )

  const deleteClass = useCallback(
    (id: string) => {
      setClasses((prev) => {
        const next = prev.filter((c) => c.id !== id)
        return next.length > 0 ? next : [makeClass('Class 1')]
      })
      setActiveClassId((current) => (current === id ? null : current))
      if (supabase) void supabase.from('classes').delete().eq('id', id)
    },
    [],
  )

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
          students: c.students.map((s) =>
            targeted(s) ? { ...s, avatarId: stickerId(theme.id, shared ?? randomPose(theme)) } : s,
          ),
        }
      }),
    [updateClass],
  )

  const deleteStudent = useCallback(
    (classId: string, studentId: string) =>
      updateClass(classId, (c) => ({
        ...c,
        students: c.students.filter((s) => s.id !== studentId),
        seating: c.seating.map((seat) => (seat === studentId ? null : seat)),
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

  const unseatAll = useCallback(
    (classId: string) => updateClass(classId, (c) => ({ ...c, seating: emptySeating() })),
    [updateClass],
  )

  const seatClass = useCallback(
    (classId: string) =>
      updateClass(classId, (c) => {
        const seatedIds = new Set(c.seating.filter((s): s is string => s !== null))
        const unseated = c.students
          .filter((s) => !seatedIds.has(s.id))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

        // Bottom row first, left to right, then moving up row by row.
        const fillOrder: number[] = []
        for (let row = DESK_ROWS - 1; row >= 0; row--) {
          for (let col = 0; col < DESK_COLUMNS; col++) {
            fillOrder.push(row * DESK_COLUMNS + col)
          }
        }
        const emptyDesks = fillOrder.filter((i) => c.seating[i] === null)

        const seating = [...c.seating]
        emptyDesks.forEach((deskIndex, i) => {
          const student = unseated[i]
          if (student) seating[deskIndex] = student.id
        })
        return { ...c, seating }
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
    (classId: string) =>
      updateClass(classId, (c) => ({ ...c, students: c.students.map((s) => ({ ...s, points: 0 })) })),
    [updateClass],
  )

  const setGoalSettings = useCallback(
    (classId: string, goal: number, starsPerClassPoint: number) =>
      updateClass(classId, (c) => ({
        ...c,
        pointsGoal: Math.max(0, Math.round(goal)),
        starsPerClassPoint: Math.max(1, Math.round(starsPerClassPoint)),
      })),
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

  /** Clears the shared meter without touching anyone's stars. */
  const resetClassGoal = useCallback(
    (classId: string) => updateClass(classId, (c) => ({ ...c, classPoints: 0, goalRemainder: 0 })),
    [updateClass],
  )

  // --- Group Activity -------------------------------------------------------------------

  const setGroups = useCallback(
    (classId: string, groups: StudentGroup[]) => updateClass(classId, (c) => ({ ...c, groups })),
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

  const renameGroup = useCallback(
    (classId: string, groupId: string, name: string) =>
      updateClass(classId, (c) => ({
        ...c,
        groups: (c.groups ?? []).map((g) => (g.id === groupId ? { ...g, name: name.trim() || g.name } : g)),
      })),
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
          groups.forEach((g) => {
            if (g.points > 0) next = awardStars(next, g.studentIds, g.points)
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
    setGroupStatus,
    setGroupPointsMode,
    finishGroupActivity,
    isCloudSynced: isSupabaseConfigured,
    loadedFromCloud,
    saveError,
  }
}

export type { Gender }
