import { useEffect, useRef, useState } from 'react'
import { FloatingGoal } from '../components/FloatingGoal'
import type { useClasses } from '../hooks/useClasses'
import { useAppInFront, useFloatingWindow } from '../hooks/useFloatingWindow'
import type { usePicker } from '../hooks/usePicker'
import { DEFAULT_GET_READY_PRIZE } from '../lib/getReady'
import { jarIsFull, jarOf, marblesOn } from '../lib/marbles'
import { pointsOnMeter, questIsOn } from '../lib/points'
import { questOf } from '../lib/quest'
import type { ClassData, Student } from '../types'

type Picker = ReturnType<typeof usePicker>

/**
 * The class goal in its own small window over the lesson, so a point doesn't mean switching apps:
 * the window itself, whether the app is in front, a goal filled there that waits for the app, and
 * Get Ready! running in it.
 */
export function useFloat(theme: string, goalLive: boolean, picker: Picker) {
  const { win, open, close } = useFloatingWindow(theme)
  const appInFront = useAppInFront()
  /** A goal filled from the floating window, whose chest is waiting for the app to be in front. */
  const [goalWaiting, setGoalWaiting] = useState(false)
  /** Get Ready! is running in the floating window, so the side panel's stands down. */
  const [readying, setReadying] = useState(false)
  if (!win && readying) setReadying(false)

  // No goal, nothing to float: switching the goal off in Pickers & Points takes the window with it.
  useEffect(() => {
    if (!goalLive) close()
  }, [goalLive, close])

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
    if (!win && pickOnFloatClock.current) {
      pickOnFloatClock.current = false
      dismissPick()
    }
  }, [win, pickMode, dismissPick])

  return {
    win,
    open,
    close,
    appInFront,
    goalWaiting,
    setGoalWaiting,
    readying,
    setReadying,
    /** A pick is starting on the floating window's clock. */
    pickingOnFloatClock: () => {
      pickOnFloatClock.current = true
    },
  }
}

export type Float = ReturnType<typeof useFloat>

type Store = ReturnType<typeof useClasses>

/** The floating window's contents, for this class. */
export function FloatingGoalFor({
  float,
  cls,
  store,
  picker,
  studentsById,
  homerooms,
  canPick,
  onPick,
  canGetReady,
  onOpenChest,
}: {
  float: Float
  cls: ClassData
  store: Pick<Store, 'addToClassGoal' | 'setGetReady'>
  picker: Picker
  studentsById: Map<string, Student>
  homerooms: Set<string>
  canPick: boolean
  onPick: (win: Window) => void
  canGetReady: boolean
  onOpenChest: () => void
}) {
  const win = float.win
  if (!win) return null
  return (
    <FloatingGoal
      win={win}
      className={cls.name}
      classPoints={pointsOnMeter(cls)}
      goal={cls.pointsGoal ?? 0}
      waiting={float.goalWaiting}
      onAdd={() => store.addToClassGoal(cls.id, 1)}
      // The browser may or may not bring the app forward for this. Either way the chest
      // opens only once the app is in front, so the fanfare never plays behind the lesson.
      onCelebrate={() => {
        // On a quest the chest opens once the app is in front; a plain goal's celebration already does.
        if (questIsOn(cls)) onOpenChest()
        window.focus()
      }}
      quest={
        questIsOn(cls)
          ? marblesOn(cls)
            ? {
                chest: 0,
                keys: 0,
                appBehind: !float.appInFront,
                marbles: { spins: jarOf(cls).spins, full: jarIsFull(jarOf(cls)), jar: jarOf(cls).marbles },
              }
            : {
                chest: questOf(cls).chest,
                keys: questOf(cls).keys,
                appBehind: !float.appInFront,
                pirate: questOf(cls).kind === 'pirate',
                space: questOf(cls).kind === 'space',
              }
          : undefined
      }
      pick={
        picker.mode === 'student-flashing' || picker.mode === 'student-result'
          ? (() => {
              const shown = picker.shownStudentId ? studentsById.get(picker.shownStudentId) : undefined
              return {
                name: shown?.name ?? '',
                // The name alone (2026-10-08, the teacher), with the homeroom number after it
                // where two students share the name, as on the desks: the float is the only
                // place the class sees who was picked, so it must tell two Amys apart.
                homeroom: shown && homerooms.has(shown.id) ? shown.homeroom.trim() : '',
                landed: picker.mode === 'student-result',
              }
            })()
          : null
      }
      // Off whenever the side panel's Pick Student would be, or it would pick behind cards.
      canPick={canPick}
      onPick={() => {
        float.pickingOnFloatClock()
        onPick(win)
      }}
      onClearPick={picker.dismiss}
      // The app's own Get Ready!, over the lesson: the same drums and prize, and it stands
      // down whenever the side panel's would.
      getReady={{
        canStart: canGetReady,
        lastDrum: cls.getReadyDrum,
        prize: cls.getReadyPrize ?? DEFAULT_GET_READY_PRIZE,
        silent: cls.getReadySilent === true,
        onSetSilent: (silent) => store.setGetReady(cls.id, { getReadySilent: silent }),
        onChooseDrum: (seconds) => store.setGetReady(cls.id, { getReadyDrum: seconds }),
        onAward: (stars) => store.addToClassGoal(cls.id, stars),
        onActiveChange: float.setReadying,
      }}
    />
  )
}
