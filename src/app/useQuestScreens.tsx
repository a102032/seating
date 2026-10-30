import { useState, type ComponentProps } from 'react'
import { OurQuest } from '../components/OurQuest'
import { PirateMap } from '../components/PirateMap'
import type { PointsMeter } from '../components/PointsMeter'
import { SpaceQuest } from '../components/SpaceQuest'
import type { useClasses } from '../hooks/useClasses'
import { jarOf, marblesOn } from '../lib/marbles'
import { questIsOn } from '../lib/points'
import { prizesOf, questOf } from '../lib/quest'
import type { ClassData } from '../types'
import type { SpinnerPick } from '../components/SpinnerName'

type Store = ReturnType<typeof useClasses>
type MeterQuest = NonNullable<ComponentProps<typeof PointsMeter>['quest']>

/**
 * The Class Quest's screens over the board: Our Quest (the map), the pirates' dig and the space
 * case beamed down, and a chest the floating window asked to open. Their state is kept here.
 */
export function useQuestScreens() {
  /** Our Quest, the map, over the board (a tap on the meter's chest while it still needs keys). */
  const [mapOpen, setMapOpen] = useState(false)
  /** Open the chest was tapped in the floating window: the chest opens once the app is in front. */
  const [chestOpenRequested, setChestOpenRequested] = useState(false)
  /**
   * On the Pirate Quest: dig for the treasure once the map has played what happened, and the chest once it is dug up.
   * On the Space Quest the same flag blasts off once the fuel is in, and `spaceCase` is the case beamed down on the planet.
   */
  const [dig, setDig] = useState(false)
  const [dug, setDug] = useState<{ from: DOMRect; picture: string } | null>(null)
  const [spaceCase, setSpaceCase] = useState<{ from: DOMRect; picture: string } | null>(null)

  /** What the goal meter needs for a class on a quest. */
  function meterQuest(
    cls: ClassData,
    store: Pick<Store, 'openQuestChest' | 'spendMarbleSpin' | 'fillMarbleJar'>,
    pickSpinner: (different?: boolean) => SpinnerPick | null,
    spinnerNames: SpinnerPick[],
  ): MeterQuest | undefined {
    if (!questIsOn(cls)) return undefined
    return {
      state: questOf(cls),
      prizes: prizesOf(cls),
      onOpenMap: (andDig) => {
        setMapOpen(true)
        setDig(!!andDig)
      },
      onOpened: (prize) => {
        store.openQuestChest(cls.id, prize)
        setDug(null)
        setSpaceCase(null)
        setDig(false)
      },
      pickSpinner,
      spinnerNames,
      openRequested: chestOpenRequested,
      onOpenRequestDone: () => setChestOpenRequested(false),
      marbles: marblesOn(cls)
        ? {
            jar: jarOf(cls),
            onSpun: (marbles) => store.spendMarbleSpin(cls.id, marbles),
            onJarFilled: (prize) => store.fillMarbleJar(cls.id, prize),
          }
        : undefined,
      pirate: {
        dug,
        onNotNow: () => {
          setDug(null)
          setDig(false)
          setMapOpen(false)
        },
      },
      space: {
        caseDown: spaceCase,
        onNotNow: () => {
          setSpaceCase(null)
          setDig(false)
          setMapOpen(false)
        },
      },
    }
  }

  return {
    mapOpen,
    dig,
    meterQuest,
    /** The floating window's Open the chest (Dig for treasure, Blast off!): it opens once the app is in front. */
    requestChestOpen: () => setChestOpenRequested(true),
    closeMap: () => {
      setMapOpen(false)
      setDig(false)
    },
    /** The Knight's map closes with nothing to dig. */
    closeOurQuest: () => setMapOpen(false),
    /** The pirates' chest is dug up, or the space case beamed down: the chest opening takes it from there. */
    chestFound: (which: 'pirate' | 'space', from: DOMRect, picture: string) => {
      setDig(false)
      if (which === 'pirate') setDug({ from, picture })
      else setSpaceCase({ from, picture })
      setChestOpenRequested(true)
    },
  }
}

export type QuestScreens = ReturnType<typeof useQuestScreens>

/** The quest's map over the board: Our Quest, the pirates' sea chart, or the Space Quest's planet. */
export function QuestMap({ screens: q, cls }: { screens: QuestScreens; cls: ClassData }) {
  if (!q.mapOpen || !questIsOn(cls)) return null
  const quest = questOf(cls)
  if (quest.kind === 'space')
    return (
      <SpaceQuest
        key={cls.id}
        classId={cls.id}
        quest={quest}
        blast={q.dig}
        onCaseDown={(from, picture) => q.chestFound('space', from, picture)}
        onClose={q.closeMap}
      />
    )
  if (quest.kind === 'pirate')
    return (
      <PirateMap
        key={cls.id}
        classId={cls.id}
        quest={quest}
        share={(cls.pointsGoal ?? 0) > 0 ? Math.min(1, (cls.classPoints ?? 0) / cls.pointsGoal!) : 0}
        dig={q.dig}
        onDug={(from, picture) => q.chestFound('pirate', from, picture)}
        onClose={q.closeMap}
      />
    )
  return <OurQuest quest={quest} onClose={q.closeOurQuest} />
}
