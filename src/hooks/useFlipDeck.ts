import { useCallback, useEffect, useRef, useState } from 'react'
import { playCardDeal, playCardFlip, playCardReveal, playShuffle } from '../lib/sound'

/**
 * What a tap on a face-up card does. Nothing about a picked card is ever timed: it stays
 * face up until somebody taps it, and the mode only decides where that tap sends it.
 */
export type FlipMode = 'stay' | 'discard'

export interface FlipDeckSettings {
  flipMode: FlipMode
  /** Colour card backs by gender, so the class can be told to pick only blue or only pink. */
  genderColors: boolean
  soundEnabled: boolean
}

export interface DeckCard {
  studentId: string
  faceUp: boolean
  setAside: boolean
  /** Face up, but a later flip has taken the turn - shown dimmed. */
  spent: boolean
}

type DeckPhase = 'shuffling' | 'dealing' | 'ready'

const SETTINGS_KEY = 'seating-chart-flip-deck-settings-v1'

const DEFAULT_SETTINGS: FlipDeckSettings = {
  flipMode: 'stay',
  genderColors: true,
  soundEnabled: true,
}

export const DEAL_STAGGER_MS = 45
const DEAL_SETTLE_MS = 420
const SHUFFLE_MS = 950
const WAVE_STEP_MS = 70
/**
 * A card ignores taps while it is still turning over. Smart boards often read one touch as
 * two, and in Discard mode that second tap would throw away the card it had just revealed.
 */
const TAP_GUARD_MS = 700

function loadSettings(): FlipDeckSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const { afterFlip, ...saved } = JSON.parse(raw)
    // Older saves had a timed "after flip" choice; Set Aside is the one that became Discard.
    const flipMode: FlipMode = saved.flipMode ?? (afterFlip === 'setAside' ? 'discard' : 'stay')
    return { ...DEFAULT_SETTINGS, ...saved, flipMode }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: FlipDeckSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * The deck behind the flip-card picker: seated students only, dealt in a random order,
 * with its own round of picks that is deliberately independent of Pick Student's history -
 * here, setting a card aside *is* the no-repeat mechanism.
 */
export function useFlipDeck(seatedIds: string[], classId: string | null, visible: boolean) {
  const seatedIdsRef = useRef(seatedIds)
  seatedIdsRef.current = seatedIds
  // Read through a ref so toggling the deck open doesn't re-run the deal effect below -
  // opening it already deals explicitly.
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  const [cards, setCards] = useState<DeckCard[]>([])
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const [phase, setPhase] = useState<DeckPhase>('dealing')
  /** The card whose turn it is: the newest one flipped by hand. Points on the side panel go to them. */
  const [activeId, setActiveId] = useState<string | null>(null)
  /** When each card last turned over, for the double-tap guard. */
  const lastTurned = useRef(new Map<string, number>())
  const [settings, setSettings] = useState<FlipDeckSettings>(loadSettings)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  /** `silent` seeds the deck without the deal sound, for when nobody is looking at it. */
  const deal = useCallback(
    (options?: { silent?: boolean }) => {
      clearTimers()
      const order = shuffled(seatedIdsRef.current)
      setCards(order.map((studentId) => ({ studentId, faceUp: false, setAside: false, spent: false })))
      setActiveId(null)
      setPhase('dealing')

      if (!options?.silent && settingsRef.current.soundEnabled) {
        order.forEach((_, i) => playCardDeal((i * DEAL_STAGGER_MS) / 1000))
      }
      later(() => setPhase('ready'), order.length * DEAL_STAGGER_MS + DEAL_SETTLE_MS)
    },
    [clearTimers, later],
  )

  const shuffle = useCallback(() => {
    clearTimers()
    setPhase('shuffling')
    setCards((prev) => prev.map((c) => ({ ...c, faceUp: false, setAside: false, spent: false })))
    setActiveId(null)
    if (settingsRef.current.soundEnabled) playShuffle()
    later(() => deal(), SHUFFLE_MS)
  }, [clearTimers, deal, later])

  // A new class is a new deck entirely. This also seeds the very first deck on mount, which
  // is why it has to stay quiet while the deck is closed - otherwise merely loading the app
  // deals thirty cards at the room.
  useEffect(() => {
    deal({ silent: !visibleRef.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const setFaceUp = useCallback((studentId: string, faceUp: boolean) => {
    setCards((prev) => prev.map((c) => (c.studentId === studentId ? { ...c, faceUp, spent: false } : c)))
  }, [])

  /**
   * One tap, one meaning per card. Face down: reveal it and hand it the turn, dimming
   * whoever had it. Face up: put it away - back over, or onto the discard pile.
   */
  const tap = useCallback(
    (studentId: string) => {
      const card = cardsRef.current.find((c) => c.studentId === studentId)
      if (!card || card.setAside) return
      const now = Date.now()
      if (now - (lastTurned.current.get(studentId) ?? 0) < TAP_GUARD_MS) return
      lastTurned.current.set(studentId, now)

      const { flipMode, soundEnabled } = settingsRef.current
      if (!card.faceUp) {
        setCards((prev) =>
          prev.map((c) => (c.studentId === studentId ? { ...c, faceUp: true, spent: false } : c.faceUp ? { ...c, spent: true } : c)),
        )
        setActiveId(studentId)
        if (soundEnabled) {
          playCardFlip()
          later(playCardReveal, 200)
        }
        return
      }

      setActiveId((prev) => (prev === studentId ? null : prev))
      if (flipMode === 'discard') {
        setCards((prev) => prev.map((c) => (c.studentId === studentId ? { ...c, setAside: true } : c)))
        if (soundEnabled) playCardDeal()
      } else {
        setFaceUp(studentId, false)
        if (soundEnabled) playCardFlip()
      }
    },
    [later, setFaceUp],
  )

  /** Flip every remaining card in a cascade rather than all at once - the wave is the whole point. */
  const flipAll = useCallback(
    (faceUp: boolean) => {
      clearTimers()
      const { soundEnabled } = settingsRef.current
      cardsRef.current
        .filter((c) => !c.setAside && c.faceUp !== faceUp)
        .forEach((card, i) => {
          later(() => {
            setFaceUp(card.studentId, faceUp)
            if (soundEnabled) playCardFlip()
          }, i * WAVE_STEP_MS)
        })
    },
    [clearTimers, later, setFaceUp],
  )

  // Neither one is anybody's turn. Reveal All shows the whole deck at full strength, and
  // Hide All only turns cards over - nothing reaches the discard pile except by a tap.
  const revealAll = useCallback(() => {
    setActiveId(null)
    setCards((prev) => prev.map((c) => ({ ...c, spent: false })))
    flipAll(true)
  }, [flipAll])
  const hideAll = useCallback(() => {
    setActiveId(null)
    flipAll(false)
  }, [flipAll])

  const updateSettings = useCallback((patch: Partial<FlipDeckSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const inPlay = cards.filter((c) => !c.setAside)
  const setAsideCount = cards.length - inPlay.length

  return {
    cards,
    inPlay,
    setAsideCount,
    phase,
    settings,
    updateSettings,
    deal,
    shuffle,
    activeId,
    tap,
    revealAll,
    hideAll,
    anyFaceUp: inPlay.some((c) => c.faceUp),
  }
}
