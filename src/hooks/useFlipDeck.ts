import { useCallback, useEffect, useRef, useState } from 'react'
import {
  playBonus,
  playCardDeal,
  playCardFlip,
  playCardReveal,
  playGiftGold,
  playPickerLand,
  playPickerTick,
  playShuffle,
} from '../lib/sound'
import { DESK_COLUMNS, DESK_COUNT, MAX_DESK_COLUMNS, type Gender } from '../types'

/**
 * Nothing about a picked card is ever timed: it stays face up until somebody taps it, and that
 * tap puts it on the discard pile. Flip Back, which turned it face down again for another go in
 * the same round, was taken out (2026-10-05, the teacher: "we don't need it") - every student
 * gets a turn before anyone has a second, and Shuffle starts the next round.
 */
export interface FlipDeckSettings {
  /** Hide Mystery Gifts in the deck (only with the class goal on: their stars go into the chest). */
  bonusCards: boolean
  /** Colour card backs by gender, so the class can be told to pick only blue or only pink. */
  genderColors: boolean
  soundEnabled: boolean
}

/**
 * The one bonus card: the Mystery Gift (2026-10-05, the teacher's call). Everyone +1 (a star for
 * every student, so +30 to the chest in a class of 30), Jackpot +3 (which read as "a jackpot,
 * and three more") and Oops! (a dud) went. A gift is stars for the whole class, straight into
 * the chest, and the surprise is how many.
 */
export type BonusKind = 'gift'

/** Three to a deck: a full round with more gave the chest too much for too little. */
export const GIFTS_PER_DECK = 3

/**
 * What a gift can hold, and how often. Never 1: that is what a student's own star is, so it
 * would feel like nothing. 2 most often and 5 least, so a 5 feels like luck.
 */
export const GIFT_STARS: { stars: number; chance: number }[] = [
  { stars: 2, chance: 0.35 },
  { stars: 3, chance: 0.3 },
  { stars: 4, chance: 0.2 },
  { stars: 5, chance: 0.15 },
]

export function rollGift(random = Math.random): number {
  let r = random()
  for (const { stars, chance } of GIFT_STARS) {
    if (r < chance) return stars
    r -= chance
  }
  return GIFT_STARS[GIFT_STARS.length - 1].stars
}

/** How long the number rolls before it lands. */
export const GIFT_ROLL_MS = 1500
/** How many numbers go past in the roll. */
export const GIFT_REEL_LENGTH = 14
/** The stars leave the card before the card itself goes onto the pile, so the class sees where they came from. */
const GIFT_SEND_MS = 450

/**
 * A gift a student has turned over: wrapped (dancing, waiting to be opened), rolling, open (its
 * stars showing, waiting to be sent), or sent. A gift shown by Reveal All has none: it is shown
 * still, and a tap puts it on the pile unopened - only a student's own flip opens a gift.
 */
export interface GiftState {
  stage: 'wrapped' | 'rolling' | 'open' | 'sent'
  stars: number
}

export interface DeckCard {
  /** The student's id, or a made-up one for a bonus card. The card's identity either way. */
  studentId: string
  bonus?: BonusKind
  gift?: GiftState
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
  bonusCards: false,
  genderColors: true,
  soundEnabled: true,
}

export const DEAL_STAGGER_MS = 45
const DEAL_SETTLE_MS = 420
const SHUFFLE_MS = 950
const WAVE_STEP_MS = 70
/**
 * A card ignores taps while it is still turning over. Smart boards often read one touch as
 * two, and that second tap would throw away the card it had just revealed - or open a gift and
 * send its stars in one touch.
 */
const TAP_GUARD_MS = 700

function loadSettings(): FlipDeckSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    // Older saves also hold the flip mode and the bonus kinds, both gone.
    const saved = JSON.parse(raw)
    return {
      bonusCards: saved.bonusCards ?? DEFAULT_SETTINGS.bonusCards,
      genderColors: saved.genderColors ?? DEFAULT_SETTINGS.genderColors,
      soundEnabled: saved.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
    }
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
 * The column count the cards start from: the seating chart's own, six, or seven once there are
 * more than thirty students - thirty-five on six columns would be six rows, on seven it is five.
 */
function baseColumns(students: number): number {
  return students > DESK_COUNT ? MAX_DESK_COLUMNS : DESK_COLUMNS
}

/**
 * How many gifts, and how many columns. Three gifts (fewer for a very small class), with the
 * column count that leaves the fewest gaps, kept near the seating chart's own and to five rows
 * where it can, since the board is wider than it is tall. Gaps that are left go in the short row
 * at the top, as in any deck.
 */
export function planDeck(students: number, withBonus: boolean): { bonus: number; columns: number } {
  const base = baseColumns(students)
  if (!withBonus || students === 0) return { bonus: 0, columns: base }
  const bonus = Math.min(GIFTS_PER_DECK, Math.max(1, Math.ceil(students / 4)))
  let best = { bonus, columns: base, score: Infinity }
  for (let columns = 5; columns <= 8; columns++) {
    const total = students + bonus
    const gaps = (columns - (total % columns)) % columns
    const rows = Math.ceil(total / columns)
    const score = gaps * 100 + Math.max(0, rows - 5) * 20 + Math.abs(columns - base) * 5
    if (score < best.score) best = { bonus, columns, score }
  }
  return { bonus: best.bonus, columns: best.columns }
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
  /** Gifts only go in a deck dealt while the class goal is on: their stars have nowhere else to go. */
  giftsAllowed: () => boolean
  /** A gift's stars sent to the chest from its card. */
  onGift: (cardId: string, stars: number) => void
  /** A student's card was turned face up by hand: their turn, and a pick for the participation record. */
  onTurned: (studentId: string) => void
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
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  /** When each card last turned over, for the double-tap guard. */
  const lastTurned = useRef(new Map<string, number>())
  const [settings, setSettings] = useState<FlipDeckSettings>(loadSettings)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // A gift's roll and send have their own, so Reveal All or Hide All (which clear the wave's
  // timers) can never leave a gift stuck halfway; only a new deal clears them.
  const giftTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])
  const clearGiftTimers = useCallback(() => {
    giftTimers.current.forEach(clearTimeout)
    giftTimers.current = []
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])
  const giftLater = useCallback((fn: () => void, ms: number) => {
    giftTimers.current.push(setTimeout(fn, ms))
  }, [])

  useEffect(() => clearTimers, [clearTimers])
  useEffect(() => clearGiftTimers, [clearGiftTimers])

  /** `silent` seeds the deck without the deal sound, for when nobody is looking at it. */
  const deal = useCallback(
    (options?: { silent?: boolean }) => {
      clearTimers()
      clearGiftTimers()
      const seated = seatedIdsRef.current
      const { genderOf, giftsAllowed } = hooksRef.current
      const plan = planDeck(seated.length, settingsRef.current.bonusCards && giftsAllowed())
      const fresh = { faceUp: false, setAside: false, spent: false }
      const order = shuffled<DeckCard>([
        ...seated.map((studentId) => ({ studentId, back: genderOf(studentId), ...fresh })),
        ...Array.from({ length: plan.bonus }, (_, i) => ({
          studentId: `gift-${i}`,
          bonus: 'gift' as const,
          back: genderOf(seated[Math.floor(Math.random() * seated.length)]),
          ...fresh,
        })),
      ])
      setCards(order)
      setColumns(plan.bonus > 0 ? plan.columns : baseColumns(seated.length))
      setActiveId(null)
      setPhase('dealing')

      if (!options?.silent && settingsRef.current.soundEnabled) {
        order.forEach((_, i) => playCardDeal((i * DEAL_STAGGER_MS) / 1000))
      }
      later(() => setPhase('ready'), order.length * DEAL_STAGGER_MS + DEAL_SETTLE_MS)
    },
    [clearTimers, clearGiftTimers, later],
  )

  const shuffle = useCallback(() => {
    clearTimers()
    clearGiftTimers()
    setPhase('shuffling')
    setCards((prev) => prev.map((c) => ({ ...c, faceUp: false, setAside: false, spent: false, gift: undefined })))
    setActiveId(null)
    if (settingsRef.current.soundEnabled) playShuffle()
    later(() => deal(), SHUFFLE_MS)
  }, [clearTimers, clearGiftTimers, deal, later])

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

  const setGift = useCallback((cardId: string, gift: GiftState) => {
    setCards((prev) => prev.map((c) => (c.studentId === cardId ? { ...c, gift } : c)))
  }, [])
  const putAway = useCallback((cardId: string) => {
    setCards((prev) => prev.map((c) => (c.studentId === cardId ? { ...c, setAside: true } : c)))
    if (settingsRef.current.soundEnabled) playCardDeal()
  }, [])

  /**
   * A Mystery Gift, one tap a step, every step a student's own tap: turned over, it dances,
   * wrapped; tapped, it opens and the number rolls (the picker's pops) and lands (its chime), a 5
   * turning gold; tapped again, its stars fly into the chest and the card goes onto the pile.
   * A gift is never anybody's turn: the glow stays where it was.
   */
  const tapGift = useCallback(
    (card: DeckCard) => {
      const { soundEnabled } = settingsRef.current
      const id = card.studentId
      if (!card.faceUp) {
        setCards((prev) =>
          prev.map((c) => (c.studentId === id ? { ...c, faceUp: true, spent: false, gift: { stage: 'wrapped', stars: rollGift() } } : c)),
        )
        if (soundEnabled) {
          playCardFlip()
          later(playBonus, 200)
        }
        return
      }
      const gift = card.gift
      // Shown by Reveal All, never turned by a student: it goes on the pile unopened.
      if (!gift) {
        putAway(id)
        return
      }
      if (gift.stage === 'wrapped') {
        setGift(id, { ...gift, stage: 'rolling' })
        if (soundEnabled) {
          // A pop for each number going past, the gaps growing as the reel slows (its easing is
          // a quadratic ease-out: gift-reel in index.css), then the chime as it lands.
          for (let k = 1; k < GIFT_REEL_LENGTH; k++) {
            giftLater(playPickerTick, GIFT_ROLL_MS * (1 - Math.sqrt(1 - k / (GIFT_REEL_LENGTH - 1))) - 30)
          }
        }
        giftLater(() => {
          setGift(id, { ...gift, stage: 'open' })
          // The tap guard runs from the landing, so the board's second touch can't send it unseen.
          lastTurned.current.set(id, Date.now())
          if (soundEnabled) {
            playPickerLand()
            if (gift.stars === 5) playGiftGold()
          }
        }, GIFT_ROLL_MS)
        return
      }
      if (gift.stage === 'open') {
        setGift(id, { ...gift, stage: 'sent' })
        hooksRef.current.onGift(id, gift.stars)
        giftLater(() => putAway(id), GIFT_SEND_MS)
      }
    },
    [giftLater, later, putAway, setGift],
  )

  /**
   * One tap, one meaning per card. Face down: reveal it and hand it the turn. Faded: hand
   * it the turn back (the spelling bee's "you try again"). Either way whoever had the turn
   * fades. Only the glowing card can be put away, onto the discard pile, so a stray touch on a
   * faded card can never throw it away; that takes two deliberate taps.
   */
  const tap = useCallback(
    (studentId: string) => {
      const card = cardsRef.current.find((c) => c.studentId === studentId)
      if (!card || card.setAside) return
      const now = Date.now()
      if (now - (lastTurned.current.get(studentId) ?? 0) < TAP_GUARD_MS) return
      lastTurned.current.set(studentId, now)

      if (card.bonus) {
        tapGift(card)
        return
      }

      const { soundEnabled } = settingsRef.current
      if (studentId !== activeIdRef.current) {
        setCards((prev) =>
          prev.map((c) =>
            c.studentId === studentId ? { ...c, faceUp: true, spent: false } : c.faceUp && !c.bonus ? { ...c, spent: true } : c,
          ),
        )
        setActiveId(studentId)
        // Turned over, not handed back: a faded card given its turn again is the same pick.
        if (!card.faceUp) hooksRef.current.onTurned(studentId)
        if (soundEnabled) {
          if (!card.faceUp) playCardFlip()
          later(playCardReveal, card.faceUp ? 0 : 200)
        }
        return
      }

      setActiveId(null)
      putAway(studentId)
    },
    [later, putAway, tapGift],
  )

  /** Flip every remaining card in a cascade rather than all at once - the wave is the whole point. */
  const flipAll = useCallback(
    (faceUp: boolean) => {
      clearTimers()
      const { soundEnabled } = settingsRef.current
      cardsRef.current
        // A gift a student has turned is theirs to open: neither Reveal All nor Hide All touches it.
        .filter((c) => !c.setAside && c.faceUp !== faceUp && !c.gift)
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
      // Gifts change what's in the deck. Nobody has touched this deal yet, so deal again now
      // rather than making the teacher shuffle to see them; mid-round, the change waits for
      // the next Shuffle instead of pulling cards out from under the class.
      const bonusChanged = 'bonusCards' in patch
      if (bonusChanged && !roundStartedRef.current && visibleRef.current) deal()
    },
    [deal],
  )

  const inPlay = cards.filter((c) => !c.setAside)
  const setAsideCount = cards.length - inPlay.length
  const studentsLeft = inPlay.filter((c) => !c.bonus).length

  return {
    cards,
    columns,
    inPlay,
    setAsideCount,
    studentsLeft,
    roundStarted,
    phase,
    settings,
    updateSettings,
    deal,
    shuffle,
    activeId,
    tap,
    revealAll,
    hideAll,
    // A gift a student is opening stays up through Hide All, so it doesn't count here, or the
    // button would be stuck on Hide All until the gift was sent.
    anyFaceUp: inPlay.some((c) => c.faceUp && !c.gift),
  }
}
