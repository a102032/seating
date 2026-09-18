import { useCallback, useEffect, useRef, useState } from 'react'
import { playCardDeal, playCardFlip, playCardReveal, playShuffle } from '../lib/sound'

/** What happens to a card once the class has seen who it is. */
export type AfterFlip = 'stay' | 'flipBack' | 'setAside'

export interface FlipDeckSettings {
  afterFlip: AfterFlip
  /** Colour card backs by gender, so the class can be told to pick only blue or only pink. */
  genderColors: boolean
  soundEnabled: boolean
}

export interface DeckCard {
  studentId: string
  faceUp: boolean
  setAside: boolean
}

type DeckPhase = 'shuffling' | 'dealing' | 'ready'

const SETTINGS_KEY = 'seating-chart-flip-deck-settings-v1'

const DEFAULT_SETTINGS: FlipDeckSettings = {
  afterFlip: 'stay',
  genderColors: true,
  soundEnabled: true,
}

export const DEAL_STAGGER_MS = 45
const DEAL_SETTLE_MS = 420
const SHUFFLE_MS = 950
const FLIP_BACK_DELAY_MS = 2200
const SET_ASIDE_DELAY_MS = 1500
const WAVE_STEP_MS = 70

function loadSettings(): FlipDeckSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
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
export function useFlipDeck(seatedIds: string[], classId: string | null) {
  const seatedIdsRef = useRef(seatedIds)
  seatedIdsRef.current = seatedIds

  const [cards, setCards] = useState<DeckCard[]>([])
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const [phase, setPhase] = useState<DeckPhase>('dealing')
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

  const deal = useCallback(() => {
    clearTimers()
    const order = shuffled(seatedIdsRef.current)
    setCards(order.map((studentId) => ({ studentId, faceUp: false, setAside: false })))
    setPhase('dealing')

    if (settingsRef.current.soundEnabled) {
      order.forEach((_, i) => playCardDeal((i * DEAL_STAGGER_MS) / 1000))
    }
    later(() => setPhase('ready'), order.length * DEAL_STAGGER_MS + DEAL_SETTLE_MS)
  }, [clearTimers, later])

  const shuffle = useCallback(() => {
    clearTimers()
    setPhase('shuffling')
    setCards((prev) => prev.map((c) => ({ ...c, faceUp: false, setAside: false })))
    if (settingsRef.current.soundEnabled) playShuffle()
    later(deal, SHUFFLE_MS)
  }, [clearTimers, deal, later])

  // A new class is a new deck entirely.
  useEffect(() => {
    deal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const setFaceUp = useCallback((studentId: string, faceUp: boolean) => {
    setCards((prev) => prev.map((c) => (c.studentId === studentId ? { ...c, faceUp } : c)))
  }, [])

  const flip = useCallback(
    (studentId: string) => {
      const { afterFlip, soundEnabled } = settingsRef.current
      setFaceUp(studentId, true)
      if (soundEnabled) {
        playCardFlip()
        later(playCardReveal, 200)
      }

      if (afterFlip === 'flipBack') {
        later(() => setFaceUp(studentId, false), FLIP_BACK_DELAY_MS)
      } else if (afterFlip === 'setAside') {
        later(() => {
          setCards((prev) => prev.map((c) => (c.studentId === studentId ? { ...c, setAside: true } : c)))
        }, SET_ASIDE_DELAY_MS)
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

  const revealAll = useCallback(() => flipAll(true), [flipAll])
  const hideAll = useCallback(() => flipAll(false), [flipAll])

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
    flip,
    revealAll,
    hideAll,
    anyFaceUp: inPlay.some((c) => c.faceUp),
  }
}
