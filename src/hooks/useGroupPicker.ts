import { useCallback, useEffect, useRef, useState } from 'react'
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
  }, [clear])

  // A fresh deal is a fresh round - the old no-repeat lists are about groups that are gone.
  useEffect(() => {
    picked.current = { group: new Set(), student: new Set() }
    dismiss()
  }, [options.resetKey, dismiss])

  const run = useCallback(
    (kind: GroupPickKind) => {
      const { allowRepeats, soundEnabled } = optionsRef.current
      const live = groupsRef.current.filter((g) => g.studentIds.length > 0)
      const pool = kind === 'group' ? live.map((g) => g.id) : live.flatMap((g) => g.studentIds)
      if (pool.length === 0) return

      const already = picked.current[kind]
      let eligible = allowRepeats ? pool : pool.filter((id) => !already.has(id))
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
          const winner = eligible[Math.floor(Math.random() * eligible.length)]
          already.add(winner)
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

  return {
    pick,
    run,
    dismiss,
    flashing: pick !== null && pick.winnerId === null,
    hasResult: pick !== null && pick.winnerId !== null,
  }
}
