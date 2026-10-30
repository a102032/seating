import { useMemo, useState } from 'react'
import type { useClasses } from '../hooks/useClasses'
import type { usePicker } from '../hooks/usePicker'
import type { LayoutPlan } from '../lib/layouts'
import { playCoinTick, playPointDeduct } from '../lib/sound'
import { flyStarsToGoal } from '../lib/starFlight'
import type { Student } from '../types'

/**
 * Desks picked by hand for a point. Keyed by student id, not desk index, so a desk and a revealed
 * flip card select the same way. Only the state is kept here, so anything that clears the board
 * can let it go; what the rail's star, −, Pick All and Pick Whole Row do with it is
 * `usePointButtons`.
 */
export function usePointsSelection() {
  const [selection, setSelection] = useState<Set<string>>(new Set())
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

  function reset() {
    setSelection(new Set())
    setSpentDelta(null)
    setStaggerWiggle(false)
    setLandedTick(0)
  }

  function toggle(studentId: string) {
    setStaggerWiggle(false)
    if (spentDelta !== null) {
      // The round is over - start a fresh one on the desk that was just tapped.
      setSpentDelta(null)
      setLandedTick(0)
      setSelection(new Set([studentId]))
      return
    }
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  /** These students, as a fresh selection. `wiggle` ripples it across the grid (Pick All). */
  function selectOnly(ids: string[], wiggle: boolean) {
    setSpentDelta(null)
    setLandedTick(0)
    setStaggerWiggle(wiggle)
    setSelection(new Set(ids))
  }

  /** A point landed on the selection: the desks pop, and the next desk tap starts a new round. */
  function awarded(delta: number) {
    setStaggerWiggle(false)
    setLandedTick((t) => t + 1)
    setSpentDelta(delta)
  }

  return { selection, spentDelta, staggerWiggle, landedTick, reset, toggle, selectOnly, awarded }
}

type Selection = ReturnType<typeof usePointsSelection>

interface Options {
  selection: Selection
  picker: ReturnType<typeof usePicker>
  /** The flip cards are up: whoever was flipped last has the turn, and the points. */
  flipDeckOpen: boolean
  flipActiveId: string | null
  groupActivityOpen: boolean
  presentSeating: (string | null)[]
  seatedIds: string[]
  plan: LayoutPlan
  studentsById: Map<string, Student>
  classId: string | null
  goalLive: boolean
  desksMode: boolean
  today: string
  adjustPoints: ReturnType<typeof useClasses>['adjustPoints']
}

/** The rail's star and −, Pick All and Pick Whole Row, working on the selection, a pick, or the flip card with the turn. */
export function usePointButtons(o: Options) {
  const { selection: sel, picker } = o
  const picked = sel.selection

  /**
   * A picker result *is* a points selection - the board is already pointing at those
   * students, so the +/- buttons should act on them without the teacher re-tapping each
   * desk. It stays derived rather than copied into state so there's nothing to keep in sync.
   * The flip cards work the same way: whoever was flipped last has the turn, and the points.
   */
  const activeSelection = useMemo(() => {
    if (o.flipDeckOpen) return new Set(o.flipActiveId ? [o.flipActiveId] : [])
    return picker.hasResult ? new Set(picker.winnerStudentIds) : picked
  }, [o.flipDeckOpen, o.flipActiveId, picker.hasResult, picker.winnerStudentIds, picked])

  function toggleSelectAll() {
    // Unpick All whenever anyone is picked, not only everyone (2026-10-08, the teacher): a few
    // students tapped all over the board took a tap each to let go of. A pick still showing is
    // let go of the same way (the side rail, 2026-10-09); it used to be taken over by Pick All.
    if (picked.size > 0) {
      sel.reset()
      return
    }
    if (picker.hasResult) {
      picker.dismiss()
      return
    }
    // Selecting everyone is the one case where nothing dims, so the ripple is the only
    // confirmation the board gives. Deselecting needs none - the dimming lifts.
    sel.selectOnly(o.seatedIds, true)
  }

  /**
   * Pick Whole Row: everyone here today in the rows (or at the tables) of the students picked by
   * hand, so a row that did a good job is one desk and one tap rather than a tap a desk
   * (2026-10-08, the teacher). The rows are Pick Row's, from the room's plan. Null when nobody
   * is picked by hand, or the desks are covered.
   */
  function wholeSetsOfSelection() {
    if (o.flipDeckOpen || o.groupActivityOpen || picker.hasResult || picked.size === 0) return null
    const sets = new Set<number>()
    o.presentSeating.forEach((id, i) => {
      const seat = o.plan.seats[i]
      if (id && seat && picked.has(id)) sets.add(seat.set)
    })
    const ids = o.presentSeating.filter(
      (id, i): id is string => Boolean(id) && o.plan.seats[i] !== undefined && sets.has(o.plan.seats[i].set),
    )
    return { ids, count: sets.size, whole: ids.every((id) => picked.has(id)) }
  }
  const wholeSets = wholeSetsOfSelection()

  function pickWholeSets() {
    if (!wholeSets || wholeSets.whole) return
    sel.selectOnly(wholeSets.ids, false)
  }

  /**
   * A pick takes the board over, so it replaces whatever was selected by hand rather than
   * hiding it. Without this, dismissing the pick handed the board back to a stale selection
   * the teacher had forgotten about - and the next award would have gone to them too.
   */
  function startPick(run: () => void) {
    if (picker.isPicking) return
    sel.reset()
    run()
  }

  // Minus is only for stars waiting on the desks - one already in the jar never comes out - and
  // stars are floored at 0, so it only means something when someone selected has one.
  const canDeductPoint = o.desksMode && Array.from(activeSelection).some((id) => (o.studentsById.get(id)?.points ?? 0) > 0)

  function applyPointsDelta(delta: number) {
    if (!o.classId || activeSelection.size === 0) return
    // No sound of a point going when there was nothing to take.
    if (delta < 0 && !canDeductPoint) return
    const ids = Array.from(activeSelection)
    // Straight to the goal: a star flies from each desk into the jar, and the meter moves as it
    // lands. Only while there is a jar on the board to fly to. On the desks, the star stays put.
    if (delta > 0 && o.goalLive && !o.desksMode) flyStarsToGoal(ids)
    // Everyone selected is the whole class (Pick All), which says nothing about one child, so
    // only a star given to some students goes in the participation record.
    const wholeClass = o.seatedIds.length > 1 && o.seatedIds.every((id) => activeSelection.has(id))
    o.adjustPoints(o.classId, ids, delta, wholeClass ? undefined : o.today)
    // Awards straight to the goal already sound: the coin ticks when the meter moves. A star
    // that stays on a desk, or lands with no goal on, moves no meter, so it ticks here. Taking
    // a point away never moves the meter by design, so without this the minus button was
    // silent - the teacher pressed it and nothing said it had landed.
    if (delta < 0) playPointDeduct()
    else if (o.desksMode || !o.goalLive) playCoinTick()
    // Awarding deliberately changes nothing about what the board is showing: a pick stays a
    // pick, a selection stays selected. Only the desks react, and only for a moment. The
    // dimmed board is the record of what is selected, so it doesn't need a timer to expire -
    // the next thing the teacher does ends the round.
    sel.awarded(delta)
  }

  return { activeSelection, toggleSelectAll, wholeSets, pickWholeSets, startPick, canDeductPoint, applyPointsDelta }
}
