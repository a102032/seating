import { useCallback, useEffect, useRef, useState } from 'react'
import { weightedChoice } from '../lib/participation'
import { playPickerLand, playPickerTick } from '../lib/sound'
import type { StudentGroup } from '../types'

/** The same pace as the desk pickers, so a pick feels like a pick wherever it happens. */
const FLASH_DURATION_MS = 2200
const FLASH_TICK_MS = 90

export type GroupPickKind = 'group' | 'student'

export interface GroupPick {
  kind: GroupPickKind
  /** The id lit right now during the flashing, or null once it has landed. */
  flashId: string | null
  /** The id it landed on, or null while it is still flashing. */
  winnerId: string | null
}

interface Options {
  allowRepeats: boolean
  soundEnabled: boolean
  /** Bumped when the groups are re-dealt: a new deal is a new round. */
  resetKey: number
  /** Each student's chance of being picked, against the rest (lib/participation, pickChances). */
  chanceOf: (studentId: string) => number
  /** A student was picked, for the participation record. A group being picked isn't recorded. */
  onStudentPicked: (studentId: string) => void
}

/**
 * Picking during a group activity: a group, or a student out of the groups.
 *
 * It is deliberately its own thing rather than a branch inside usePicker. That picker works
 * in desk indices and lights up the seating chart, which is behind the group cards and so
 * invisible while this screen is up. Same pace, same sounds, different surface.
 */
export function useGroupPicker(groups: StudentGroup[], options: Options) {
  const [pick, setPick] = useState<GroupPick | null>(null)
  const picked = useRef<Record<GroupPickKind, Set<string>>>({ group: new Set(), student: new Set() })
  /**
   * The group Pick Group landed on. Like Pick Row on the desks, it keeps Pick Student inside
   * that group ("Pick from This Group") until a tap on the board lets it go, a new deal comes,
   * or everyone in it has had a turn.
   */
  const [lockId, setLockId] = useState<string | null>(null)
  const lockRef = useRef(lockId)
  useEffect(() => {
    lockRef.current = lockId
  })
  /** The students picked this round, as state, so the button's label can follow it. */
  const [pickedStudents, setPickedStudents] = useState<ReadonlySet<string>>(new Set())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const optionsRef = useRef(options)
  optionsRef.current = options

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => clear, [clear])

  const dismiss = useCallback(() => {
    clear()
    setPick(null)
    setLockId(null)
  }, [clear])

  // A fresh deal is a fresh round - the old no-repeat lists are about groups that are gone.
  useEffect(() => {
    picked.current = { group: new Set(), student: new Set() }
    setPickedStudents(new Set())
    dismiss()
  }, [options.resetKey, dismiss])

  const run = useCallback(
    (kind: GroupPickKind) => {
      const { allowRepeats, soundEnabled } = optionsRef.current
      const live = groupsRef.current.filter((g) => g.studentIds.length > 0)
      const already = picked.current[kind]
      // A picked group keeps Pick Student inside it while it still has someone to draw; once
      // everyone in it has had a turn, the pick goes back to the whole class and lets it go.
      const locked = kind === 'student' ? live.find((g) => g.id === lockRef.current) : undefined
      const lockedEligible = locked ? locked.studentIds.filter((id) => allowRepeats || !already.has(id)) : []
      const staying = lockedEligible.length > 0
      if (kind === 'student' && !staying) setLockId(null)
      if (kind === 'group') setLockId(null)

      const pool = kind === 'group' ? live.map((g) => g.id) : staying ? locked!.studentIds : live.flatMap((g) => g.studentIds)
      if (pool.length === 0) return

      let eligible = staying ? lockedEligible : allowRepeats ? pool : pool.filter((id) => !already.has(id))
      // Everyone has had a turn: start the round again rather than refusing to pick.
      if (eligible.length === 0) {
        already.clear()
        eligible = pool
      }

      clear()
      setPick({ kind, flashId: null, winnerId: null })
      const startedAt = Date.now()
      timer.current = setInterval(() => {
        // The last pass lands instead of flashing, so the tick and the landing don't fire
        // together and bury one another.
        if (Date.now() - startedAt >= FLASH_DURATION_MS) {
          clear()
          // A student picked less often lately gets a better chance, as on the desks. Groups
          // are all alike to the record, so they are picked evenly.
          const { chanceOf, onStudentPicked } = optionsRef.current
          const winner = kind === 'student' ? weightedChoice(eligible, chanceOf) : eligible[Math.floor(Math.random() * eligible.length)]
          already.add(winner)
          if (kind === 'student') {
            setPickedStudents(new Set(already))
            onStudentPicked(winner)
          } else setLockId(winner)
          setPick({ kind, flashId: null, winnerId: winner })
          if (soundEnabled) playPickerLand()
          return
        }
        // The flashing runs over everyone in play, so it stays lively even when only a few
        // are still eligible. Only the winner comes from the narrower pool.
        setPick({ kind, flashId: pool[Math.floor(Math.random() * pool.length)], winnerId: null })
        if (soundEnabled) playPickerTick()
      }, FLASH_TICK_MS)
    },
    [clear],
  )

  const lockedGroup = lockId ? groups.find((g) => g.id === lockId) : undefined
  return {
    pick,
    /** The group Pick Student is staying in, if any. */
    lockedGroupId: lockedGroup ? lockedGroup.id : null,
    /**
     * Whether the next Pick Student really will stay in the picked group - the same test the
     * pick makes, so the button stops saying "This Group" one pick before it stops meaning it.
     */
    lockBinds: Boolean(lockedGroup?.studentIds.some((id) => options.allowRepeats || !pickedStudents.has(id))),
    run,
    dismiss,
    flashing: pick !== null && pick.winnerId === null,
    hasResult: pick !== null && pick.winnerId !== null,
  }
}
