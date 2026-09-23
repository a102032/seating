import { useCallback, useEffect, useRef, useState } from 'react'
import { playBonus, playCardDeal, playCardFlip, playCardReveal, playOops, playShuffle } from '../lib/sound'
import { DESK_COLUMNS, type Gender } from '../types'

/**
 * What a tap on a face-up card does. Nothing about a picked card is ever timed: it stays
 * face up until somebody taps it, and the mode only decides where that tap sends it.
 */
export type FlipMode = 'stay' | 'discard'

export interface FlipDeckSettings {
  flipMode: FlipMode
  /** Shuffle bonus cards in among the students. */
  bonusCards: boolean
  /** Which kinds go in the deck when bonus cards are on. */
  bonusKinds: BonusKind[]
  /** Colour card backs by gender, so the class can be told to pick only blue or only pink. */
  genderColors: boolean
  soundEnabled: boolean
}

/**
 * Bonus cards. Everyone +1 gives every seated student a point; Jackpot +3 waits on the
 * toolbar and lands on the next student flipped; Oops! does nothing at all - the one
 * "bad" card is a dud, because a flip is luck and losing points to luck isn't fair.
 */
export type BonusKind = 'everyone' | 'jackpot' | 'oops'
export const BONUS_KINDS: BonusKind[] = ['everyone', 'jackpot', 'oops']
export const JACKPOT_POINTS = 3

/** The order bonus cards are added in: one of each first, then Jackpots and Oops, so a big deck isn't mostly class-wide points. */
const BONUS_SEQUENCE: BonusKind[] = ['jackpot', 'oops', 'everyone', 'oops', 'jackpot', 'oops']

export interface DeckCard {
  /** The student's id, or a made-up one for a bonus card. The card's identity either way. */
  studentId: string
  bonus?: BonusKind
  /** Whose colour its back takes when backs are coloured by gender. A bonus card borrows one, so it can't be spotted face down. */
  back: Gender
  faceUp: boolean
  setAside: boolean
  /** Face up, but a later flip has taken the turn - shown dimmed. */
  spent: boolean
}

type DeckPhase = 'shuffling' | 'dealing' | 'ready'

const SETTINGS_KEY = 'seating-chart-flip-deck-settings-v1'

const DEFAULT_SETTINGS: FlipDeckSettings = {
  flipMode: 'stay',
  bonusCards: false,
  bonusKinds: BONUS_KINDS,
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
    const bonusKinds: BonusKind[] = Array.isArray(saved.bonusKinds)
      ? saved.bonusKinds.filter((k: string) => (BONUS_KINDS as string[]).includes(k))
      : BONUS_KINDS
    return { ...DEFAULT_SETTINGS, ...saved, flipMode, bonusKinds }
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

/**
 * How many bonus cards, and how many columns, so the board comes out as full rows. A few
 * bonus cards (3-6, fewer for a small class), with columns kept near the seating chart's six
 * and rows kept to five where it can, since the board is wider than it is tall. A class
 * size no mix makes even gets the closest one.
 */
export function planDeck(students: number, withBonus: boolean): { bonus: number; columns: number } {
  if (!withBonus || students === 0) return { bonus: 0, columns: DESK_COLUMNS }
  const most = Math.min(6, Math.max(1, Math.ceil(students / 4)))
  const least = Math.min(3, most)
  let best = { bonus: least, columns: DESK_COLUMNS, score: Infinity }
  for (let bonus = least; bonus <= most; bonus++) {
    for (let columns = 5; columns <= 8; columns++) {
      const total = students + bonus
      const gaps = (columns - (total % columns)) % columns
      const rows = Math.ceil(total / columns)
      const score = gaps * 100 + Math.max(0, rows - 5) * 20 + Math.abs(columns - DESK_COLUMNS) * 5 + Math.abs(bonus - 5) * 3
      if (score < best.score) best = { bonus, columns, score }
    }
  }
  return { bonus: best.bonus, columns: best.columns }
}

function bonusKindsFor(count: number, enabled: BonusKind[]): BonusKind[] {
  const pool = BONUS_SEQUENCE.filter((k) => enabled.includes(k))
  if (pool.length === 0) return []
  return Array.from({ length: count }, (_, i) => pool[i % pool.length])
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

interface FlipDeckHooks {
  genderOf: (studentId: string) => Gender
  /** Everyone +1 was turned over. */
  onEveryone: () => void
  /** A student was turned over with a jackpot waiting. */
  onJackpot: (studentId: string, points: number) => void
}

/**
 * The deck behind the flip-card picker: seated students (plus any bonus cards), dealt in a random order,
 * with its own round of picks that is deliberately independent of Pick Student's history -
 * here, setting a card aside *is* the no-repeat mechanism.
 */
export function useFlipDeck(seatedIds: string[], classId: string | null, visible: boolean, hooks: FlipDeckHooks) {
  const seatedIdsRef = useRef(seatedIds)
  seatedIdsRef.current = seatedIds
  const hooksRef = useRef(hooks)
  hooksRef.current = hooks
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
  const [columns, setColumns] = useState(DESK_COLUMNS)
  /** Jackpot points waiting for the next student flipped. Two jackpots before a student add up. */
  const [jackpot, setJackpot] = useState(0)
  const jackpotRef = useRef(jackpot)
  jackpotRef.current = jackpot
  /** The last jackpot to land, for the card to show it. The tick replays it for the same student. */
  const [jackpotHit, setJackpotHit] = useState<{ studentId: string; points: number; tick: number } | null>(null)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
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
      const seated = seatedIdsRef.current
      const { genderOf } = hooksRef.current
      const { bonusCards, bonusKinds } = settingsRef.current
      const plan = planDeck(seated.length, bonusCards)
      const bonuses = bonusKindsFor(plan.bonus, bonusKinds)
      const fresh = { faceUp: false, setAside: false, spent: false }
      const order = shuffled<DeckCard>([
        ...seated.map((studentId) => ({ studentId, back: genderOf(studentId), ...fresh })),
        ...bonuses.map((bonus, i) => ({
          studentId: `bonus-${i}`,
          bonus,
          back: genderOf(seated[Math.floor(Math.random() * seated.length)]),
          ...fresh,
        })),
      ])
      setCards(order)
      setColumns(bonuses.length > 0 ? plan.columns : DESK_COLUMNS)
      setActiveId(null)
      setJackpot(0)
      setJackpotHit(null)
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
   * One tap, one meaning per card. Face down: reveal it and hand it the turn. Faded: hand
   * it the turn back (the spelling bee's "you try again"). Either way whoever had the turn
   * fades. Only the glowing card can be put away - back over, or onto the discard pile - so a
   * stray touch on a faded card can never throw it away; that takes two deliberate taps.
   */
  const tap = useCallback(
    (studentId: string) => {
      const card = cardsRef.current.find((c) => c.studentId === studentId)
      if (!card || card.setAside) return
      const now = Date.now()
      if (now - (lastTurned.current.get(studentId) ?? 0) < TAP_GUARD_MS) return
      lastTurned.current.set(studentId, now)

      const { flipMode, soundEnabled } = settingsRef.current
      const putAway = () => {
        if (flipMode === 'discard') {
          setCards((prev) => prev.map((c) => (c.studentId === studentId ? { ...c, setAside: true } : c)))
          if (soundEnabled) playCardDeal()
        } else {
          setFaceUp(studentId, false)
          if (soundEnabled) playCardFlip()
        }
      }

      // A bonus card is never anybody's turn: it turns over, does its thing, and leaves
      // the glow where it was. Face up, one tap puts it away - there's no turn to give back.
      if (card.bonus) {
        if (card.faceUp) {
          putAway()
          return
        }
        setFaceUp(studentId, true)
        if (card.bonus === 'everyone') hooksRef.current.onEveryone()
        if (card.bonus === 'jackpot') setJackpot((j) => j + JACKPOT_POINTS)
        if (soundEnabled) {
          playCardFlip()
          later(card.bonus === 'oops' ? playOops : playBonus, 200)
        }
        return
      }

      if (studentId !== activeIdRef.current) {
        setCards((prev) =>
          prev.map((c) => (c.studentId === studentId ? { ...c, faceUp: true, spent: false } : c.faceUp ? { ...c, spent: true } : c)),
        )
        setActiveId(studentId)
        const waiting = card.faceUp ? 0 : jackpotRef.current
        if (waiting > 0) {
          hooksRef.current.onJackpot(studentId, waiting)
          setJackpot(0)
          setJackpotHit((prev) => ({ studentId, points: waiting, tick: (prev?.tick ?? 0) + 1 }))
        }
        if (soundEnabled) {
          if (!card.faceUp) playCardFlip()
          later(waiting > 0 ? playBonus : playCardReveal, card.faceUp ? 0 : 200)
        }
        return
      }

      setActiveId(null)
      putAway()
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

  const roundStarted = cards.some((c) => c.faceUp || c.setAside)
  const roundStartedRef = useRef(roundStarted)
  roundStartedRef.current = roundStarted

  const updateSettings = useCallback(
    (patch: Partial<FlipDeckSettings>) => {
      const next = { ...settingsRef.current, ...patch }
      settingsRef.current = next
      setSettings(next)
      saveSettings(next)
      // Bonus cards change what's in the deck. Nobody has touched this deal yet, so deal
      // again now rather than making the teacher shuffle to see them; mid-round, the
      // change waits for the next Shuffle instead of pulling cards out from under the class.
      const bonusChanged = 'bonusCards' in patch || 'bonusKinds' in patch
      if (bonusChanged && !roundStartedRef.current && visibleRef.current) deal()
    },
    [deal],
  )

  const inPlay = cards.filter((c) => !c.setAside)
  const setAsideCount = cards.length - inPlay.length
  const studentsLeft = inPlay.filter((c) => !c.bonus).length
  const studentsDone = cards.filter((c) => c.setAside && !c.bonus).length

  return {
    cards,
    columns,
    inPlay,
    setAsideCount,
    studentsLeft,
    studentsDone,
    roundStarted,
    jackpot,
    jackpotHit,
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
