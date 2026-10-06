/** Get Ready!'s drums, in seconds: how long the class has. Anything longer is the side panel's timer. */
export const GET_READY_DRUMS = [10, 15, 20, 25, 30]
/** The star stays full this long after the tap on every drum, then shrinks on every beat. */
export const GET_READY_FULL_SECONDS = 5
/** What a full star is worth, the same on every drum (Pickers & Points). */
export const GET_READY_PRIZES = [3, 5, 8, 10]
export const DEFAULT_GET_READY_PRIZE = 5

/** Get Ready!'s Ready! and Stop buttons' width in a window this tall, as their own clamp(7rem, 17vh, 10rem) works it out. */
export function controlButtonWidth(windowHeight: number) {
  return Math.min(160, Math.max(112, 0.17 * windowHeight))
}

/** Ready! and Stop's height in a window this tall, as their own clamp(2.75rem, 7vh, 4rem) works it out. */
export function controlButtonHeight(windowHeight: number) {
  return Math.min(64, Math.max(44, 0.07 * windowHeight))
}

/**
 * The floating window's "How long?": a snug rectangle of five drums, sized from its width so the
 * window can be made exactly tall enough for it (2026-10-06, the teacher: no space above and
 * below the drums). The same numbers lay it out (`FloatGetReady.tsx`) and size the window.
 */
export const FLOAT_DRUMS = { pad: 12, gap: 10, titleHeight: 40, imageRatio: 0.62, imageMax: 96, numberRatio: 0.26, numberMax: 36 }

/** The width of one drum in a window this wide. */
function floatDrumWidth(width: number) {
  return (width - 2 * FLOAT_DRUMS.pad - 4 * FLOAT_DRUMS.gap) / 5
}

/**
 * How tall the window must be for the drums: its padding, the title row, and a drum - its
 * padding (12 and 10), border (3 each side), picture, number and "seconds" (18) with the gaps
 * between them (6 and 4).
 */
export function floatDrumsHeight(width: number) {
  const drum = floatDrumWidth(width)
  const image = Math.min(FLOAT_DRUMS.imageMax, drum * FLOAT_DRUMS.imageRatio)
  const number = Math.min(FLOAT_DRUMS.numberMax, drum * FLOAT_DRUMS.numberRatio)
  const button = 12 + 3 + image + 6 + number + 4 + 18 + 10 + 3
  return Math.ceil(2 * FLOAT_DRUMS.pad + FLOAT_DRUMS.titleHeight + 8 + button) + 2
}

// --- The taps between the beats ------------------------------------------------------------------

/** The taiko's rim ("ka") or the bamboo ("ko"). */
export type TapVoice = 'rim' | 'bamboo'
/** A tap: how far into the second after a big beat it falls (0.5 is halfway to the next), its voice, and its pitch (1 as recorded). */
export type Tap = [at: number, voice: TapVoice, rate: number]

const ka = (at: number): Tap => [at, 'rim', 1]
/** The rim again, a shade higher: the second of a quick "ka-ra". */
const ra = (at: number): Tap => [at, 'rim', 1.06]
const ko = (at: number): Tap => [at, 'bamboo', 1]
/** The bamboo a little higher, like the second of a pair of clappers. */
const ki = (at: number): Tap => [at, 'bamboo', 1.18]
/** A run of taps an eighth of a second apart. */
const run = (from: number, voices: ((at: number) => Tap)[]) => voices.map((voice, i) => voice(from + i * 0.125))

export interface Rhythm {
  name: string
  /** While the star is full: gentle. */
  calm: (gap: number) => Tap[]
  /** While it shrinks: a two-beat phrase that answers itself. */
  phrase: (gap: number) => Tap[]
  /** The last three seconds, quickening into the time-up. */
  roll: [Tap[], Tap[], Tap[]]
}

/**
 * The four rhythms (2026-10-06, chosen by the teacher on a listening page, "Drum Taps", a Claude
 * artifact). Used every day, one beat a second got boring, so soft taps now go between the big
 * beats, the way a taiko group's rim and wooden clappers answer each other while one drummer keeps
 * the base beat steady. The big beat stays exactly as it was: it is the clock the class counts by.
 * The taps never land on a beat, so every hit is still heard on its own.
 */
export const RHYTHMS: Rhythm[] = [
  {
    // Festival drums: the rim answers with a quick "ka-ra", and the bamboo replies.
    name: 'Matsuri',
    calm: (gap) => (gap % 2 ? [ka(0.5), ra(0.625)] : [ka(0.5)]),
    phrase: (gap) => (gap % 2 ? [ko(0.25), ka(0.5), ka(0.75)] : [ka(0.5), ra(0.625), ko(0.875)]),
    roll: [
      [ko(0.25), ka(0.5), ra(0.625), ko(0.75)],
      [ka(0.25), ko(0.375), ka(0.5), ko(0.625), ka(0.75)],
      run(0.125, [ka, ra, ko, ka, ra, ko, ki]),
    ],
  },
  {
    // After the folk dance played on two bamboo clappers: the bamboo leads, high and low.
    name: 'Kokiriko',
    calm: (gap) => (gap % 2 ? [ko(0.5), ki(0.75)] : [ko(0.5)]),
    phrase: (gap) => (gap % 2 ? [ko(0.25), ki(0.375), ka(0.5)] : [ko(0.5), ki(0.75)]),
    roll: [[ko(0.25), ki(0.5), ka(0.75)], [ko(0.25), ki(0.375), ko(0.5), ki(0.625), ka(0.75)], run(0.125, [ko, ki, ko, ki, ko, ki, ka])],
  },
  {
    // The summer festival dance: bouncy and swung, in sixths of a second.
    name: 'Bon Odori',
    calm: (gap) => (gap % 2 ? [ko(2 / 3)] : [ka(2 / 3)]),
    phrase: (gap) => (gap % 2 ? [ko(2 / 6), ka(4 / 6), ra(5 / 6)] : [ka(2 / 6), ko(4 / 6)]),
    roll: [
      [ka(1 / 3), ko(2 / 3)],
      [ka(2 / 6), ko(3 / 6), ka(4 / 6), ko(5 / 6)],
      [ka(1 / 6), ko(2 / 6), ka(3 / 6), ra(4 / 6), ki(5 / 6)],
    ],
  },
  {
    // The wooden clappers that start a kabuki play, speeding up before the curtain opens: three
    // claps a second, then four, then seven.
    name: 'Hyoshigi',
    calm: (gap) => (gap % 2 ? [ko(0.5), ki(0.75)] : [ko(0.5)]),
    phrase: (gap) => (gap % 2 ? [ko(0.25), ko(0.5), ka(0.75)] : [ko(0.5), ka(0.75)]),
    roll: [[ko(1 / 3), ki(2 / 3)], [ko(0.25), ki(0.5), ko(0.75)], run(0.125, [ko, ki, ko, ki, ko, ki, ka])],
  },
]

/**
 * The taps for the second after big beat number `gap` (0 is the tap that starts it), on a drum
 * of `seconds`. None after the last beat, which is the time-up.
 */
export function tapsAfterBeat(rhythm: Rhythm, gap: number, seconds: number): Tap[] {
  if (gap >= seconds) return []
  if (gap < GET_READY_FULL_SECONDS) return rhythm.calm(gap)
  const fromEnd = gap - (seconds - 3)
  if (fromEnd >= 0) return rhythm.roll[fromEnd]
  return rhythm.phrase(gap - GET_READY_FULL_SECONDS)
}

const RHYTHM_KEY = 'seating-chart-get-ready-rhythms-v1'

/**
 * The next rhythm: all four take turns in a random order before any comes round again, and a new
 * round never starts with the one that just played - the same idea as Pick Student giving everyone
 * a turn before anyone has a second. Kept on this board, so a reload carries on the round.
 */
export function nextRhythm(random = Math.random): Rhythm {
  let left: string[] = []
  let last = ''
  try {
    const saved = JSON.parse(localStorage.getItem(RHYTHM_KEY) ?? '{}')
    if (Array.isArray(saved.left)) left = saved.left.filter((n: unknown) => RHYTHMS.some((r) => r.name === n))
    if (typeof saved.last === 'string') last = saved.last
  } catch {
    // A board that won't store it starts a fresh round each time.
  }
  if (left.length === 0) {
    left = RHYTHMS.map((r) => r.name)
    for (let i = left.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[left[i], left[j]] = [left[j], left[i]]
    }
    // The one that just played never opens the new round.
    if (left[0] === last) {
      const j = 1 + Math.floor(random() * (left.length - 1))
      ;[left[0], left[j]] = [left[j], left[0]]
    }
  }
  const name = left.shift()!
  try {
    localStorage.setItem(RHYTHM_KEY, JSON.stringify({ left, last: name }))
  } catch {
    // As above.
  }
  return RHYTHMS.find((r) => r.name === name)!
}
