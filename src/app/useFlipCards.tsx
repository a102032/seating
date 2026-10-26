import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { FlipDeck } from '../components/FlipDeck'
import type { useClasses } from '../hooks/useClasses'
import { useFlipDeck } from '../hooks/useFlipDeck'
import { playCoinTick } from '../lib/sound'
import { flyStarsFrom } from '../lib/starFlight'
import type { PointsMode, Student } from '../types'

type Store = ReturnType<typeof useClasses>

interface Options {
  classId: string | null
  seatedIds: string[]
  studentsById: Map<string, Student>
  pointsMode: PointsMode
  today: string
  store: Pick<Store, 'adjustPoints' | 'addToClassGoal' | 'recordPick'>
  toast: (text: string) => void
}

/** Flip Cards: whether the deck is up over the desks, and the deck itself (hooks/useFlipDeck). */
export function useFlipCards({ classId, seatedIds, studentsById, pointsMode, today, store, toast }: Options) {
  const [open, setOpen] = useState(false)
  const deck = useFlipDeck(seatedIds, classId, open, {
    genderOf: (id) => studentsById.get(id)?.gender ?? 'unspecified',
    giftsAllowed: () => pointsMode !== 'none',
    // A surprise card's stars are the whole class's, so they go in no one's participation record.
    // With a class goal they fly from the card into the chest, one a star, and the meter waits for
    // them to land. With student points every student here gets them (2026-10-11), as with Get
    // Ready!: a surprise card is nobody's turn.
    onGift: (cardId, stars) => {
      if (!classId) return
      if (pointsMode === 'students') {
        store.adjustPoints(classId, seatedIds, stars)
        playCoinTick()
        toast(`Everyone gets ${stars} stars!`)
        return
      }
      const box = document.querySelector(`[data-flip-card="${CSS.escape(cardId)}"]`)?.getBoundingClientRect()
      if (box) flyStarsFrom(box.left + box.width / 2, box.top + box.height / 2, stars, Math.min(56, box.width * 0.3), { loud: false })
      store.addToClassGoal(classId, stars)
    },
    onTurned: (id) => {
      if (classId) store.recordPick(classId, id, today)
    },
  })
  return { open, setOpen, deck }
}

export type FlipCards = ReturnType<typeof useFlipCards>

/**
 * The flip deck slides up over the seating chart and back down on the way out, keeping the side
 * panel's points buttons and the class goal meter in play.
 */
export function FlipCardsBoard({
  flip,
  studentsById,
  showStars,
  showAllHomerooms,
  onOpenSettings,
  onExit,
}: {
  flip: FlipCards
  studentsById: Map<string, Student>
  showStars: boolean
  showAllHomerooms: boolean
  onOpenSettings: () => void
  onExit: () => void
}) {
  return (
    <AnimatePresence>
      {flip.open && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          data-ink="board"
          className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]"
        >
          <FlipDeck
            deck={flip.deck}
            studentsById={studentsById}
            showStars={showStars}
            showAllHomerooms={showAllHomerooms}
            // The cards' settings are with every other tool's, in Class Settings.
            onOpenSettings={onOpenSettings}
            onExit={onExit}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
