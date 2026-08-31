import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { loadLocalState, saveLocalState } from '../lib/localStore'
import { DESK_COUNT, type ClassData, type Gender, type Student } from '../types'

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

export function useClasses() {
  const initial = useMemo(() => loadLocalState(), [])
  const [classes, setClasses] = useState<ClassData[]>(initial?.classes ?? [makeClass('Class 1')])
  const [activeClassId, setActiveClassId] = useState<string | null>(
    initial?.activeClassId ?? initial?.classes?.[0]?.id ?? null,
  )
  const [loadedFromCloud, setLoadedFromCloud] = useState(!isSupabaseConfigured)
  const pendingWrites = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const applyingRemote = useRef(false)

  useEffect(() => {
    if (!activeClassId && classes.length > 0) {
      setActiveClassId(classes[0].id)
    }
  }, [activeClassId, classes])

  // Always cache to localStorage so the app works instantly offline / before Supabase is configured.
  useEffect(() => {
    saveLocalState({ classes, activeClassId })
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

  const createClass = useCallback((name?: string) => {
    const cls = makeClass(name?.trim() || `Class ${classes.length + 1}`)
    setClasses((prev) => [...prev, cls])
    setActiveClassId(cls.id)
    pushToCloud(cls)
  }, [classes.length, pushToCloud])

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

  const deleteStudent = useCallback(
    (classId: string, studentId: string) =>
      updateClass(classId, (c) => ({
        ...c,
        students: c.students.filter((s) => s.id !== studentId),
        seating: c.seating.map((seat) => (seat === studentId ? null : seat)),
      })),
    [updateClass],
  )

  const assignSeat = useCallback(
    (classId: string, deskIndex: number, studentId: string | null) =>
      updateClass(classId, (c) => {
        const seating = [...c.seating]
        // Clear this student from any other desk first (no duplicates).
        for (let i = 0; i < seating.length; i++) {
          if (seating[i] === studentId) seating[i] = null
        }
        seating[deskIndex] = studentId
        return { ...c, seating }
      }),
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

  const unseatStudent = useCallback(
    (classId: string, studentId: string) =>
      updateClass(classId, (c) => ({
        ...c,
        seating: c.seating.map((seat) => (seat === studentId ? null : seat)),
      })),
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
    deleteStudent,
    assignSeat,
    swapSeats,
    unseatAll,
    unseatStudent,
    unseatedStudents,
    isCloudSynced: isSupabaseConfigured,
    loadedFromCloud,
  }
}

export type { Gender }
