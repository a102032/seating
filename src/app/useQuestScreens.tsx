import { useState, type ComponentProps } from 'react'
import type { PointsMeter } from '../components/PointsMeter'
import type { useClasses } from '../hooks/useClasses'
import { jarOf } from '../lib/marbles'
import { questIsOn } from '../lib/points'
import { prizesOf } from '../lib/quest'
import type { ClassData } from '../types'
import type { SpinnerPick } from '../components/SpinnerName'

type Store = ReturnType<typeof useClasses>
type MeterQuest = NonNullable<ComponentProps<typeof PointsMeter>['quest']>

/**
 * The Marble Jar's part of the goal meter, and a spin or full jar the floating window asked to open.
 * (The Knight's, Pirate and Space quests, with their maps, were retired on 2026-10-30.)
 */
export function useQuestScreens() {
  /** Spin the wheel or Open the jar was tapped in the floating window: it opens once the app is in front. */
  const [chestOpenRequested, setChestOpenRequested] = useState(false)

  /** What the goal meter needs for a class with the Marble Jar. */
  function meterQuest(
    cls: ClassData,
    store: Pick<Store, 'spendMarbleSpin' | 'fillMarbleJar'>,
    pickSpinner: (different?: boolean) => SpinnerPick | null,
    spinnerNames: SpinnerPick[],
  ): MeterQuest | undefined {
    if (!questIsOn(cls)) return undefined
    return {
      prizes: prizesOf(cls),
      pickSpinner,
      spinnerNames,
      openRequested: chestOpenRequested,
      onOpenRequestDone: () => setChestOpenRequested(false),
      marbles: {
        jar: jarOf(cls),
        onSpun: (marbles) => store.spendMarbleSpin(cls.id, marbles),
        onJarFilled: (prize) => store.fillMarbleJar(cls.id, prize),
      },
    }
  }

  return {
    meterQuest,
    /** The floating window's Spin the wheel or Open the jar: it opens once the app is in front. */
    requestChestOpen: () => setChestOpenRequested(true),
  }
}
