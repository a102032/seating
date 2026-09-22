import { assetUrl } from './assets'
import type { AlarmSound } from '../types'

let sharedContext: AudioContext | null = null

function getContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext()
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume()
  }
  return sharedContext
}

interface ToneOptions {
  frequency: number
  /** Glide to this pitch across the tone. A fast rise is what turns a blip into a pop. */
  endFrequency?: number
  start: number
  duration: number
  type?: OscillatorType
  peakGain?: number
  detune?: number
}

function playTone(ctx: AudioContext, master: GainNode, { frequency, endFrequency, start, duration, type = 'sine', peakGain = 0.4, detune = 0 }: ToneOptions) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + start)
  if (endFrequency !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + start + duration)
  }
  osc.detune.setValueAtTime(detune, ctx.currentTime + start)

  const t0 = ctx.currentTime + start
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.02, duration / 4))
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

  osc.connect(gain)
  gain.connect(master)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

function playNoiseBurst(ctx: AudioContext, master: GainNode, start: number, duration: number, peakGain = 0.3) {
  const bufferSize = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  const t0 = ctx.currentTime + start
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

  source.connect(gain)
  gain.connect(master)
  source.start(t0)
  source.stop(t0 + duration + 0.05)
}

function playDing(ctx: AudioContext, master: GainNode) {
  playTone(ctx, master, { frequency: 1568, start: 0, duration: 1.2, type: 'sine', peakGain: 0.5 })
  playTone(ctx, master, { frequency: 3136, start: 0, duration: 0.8, type: 'sine', peakGain: 0.15 })
}

function playChime(ctx: AudioContext, master: GainNode) {
  const notes = [1046.5, 1318.5, 1568, 2093]
  notes.forEach((freq, i) => {
    playTone(ctx, master, { frequency: freq, start: i * 0.18, duration: 1.1, type: 'sine', peakGain: 0.35 })
  })
}

function playBell(ctx: AudioContext, master: GainNode) {
  const fundamental = 660
  const partials = [1, 2.01, 3.0, 4.2, 5.4]
  partials.forEach((mult, i) => {
    playTone(ctx, master, {
      frequency: fundamental * mult,
      start: 0,
      duration: 1.8 - i * 0.15,
      type: 'sine',
      peakGain: 0.3 / (i + 1),
    })
  })
}

function playTrainWhistle(ctx: AudioContext, master: GainNode) {
  ;[440, 554.37].forEach((freq) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    const t0 = ctx.currentTime
    osc.frequency.setValueAtTime(freq * 0.7, t0)
    osc.frequency.linearRampToValueAtTime(freq, t0 + 0.3)
    osc.frequency.setValueAtTime(freq, t0 + 1.4)
    osc.frequency.linearRampToValueAtTime(freq * 0.6, t0 + 1.9)

    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.25)
    gain.gain.setValueAtTime(0.18, t0 + 1.4)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 2)

    osc.connect(gain)
    gain.connect(master)
    osc.start(t0)
    osc.stop(t0 + 2.1)
  })
}

function playGuitar(ctx: AudioContext, master: GainNode) {
  const chord = [196, 246.94, 293.66, 392]
  chord.forEach((freq, i) => {
    playTone(ctx, master, {
      frequency: freq,
      start: i * 0.04,
      duration: 1.5,
      type: 'sawtooth',
      peakGain: 0.14,
      detune: i % 2 === 0 ? -4 : 4,
    })
  })
}

function playRooster(ctx: AudioContext, master: GainNode) {
  const segments: Array<[number, number, number]> = [
    [520, 0, 0.12],
    [900, 0.1, 0.22],
    [700, 0.3, 0.18],
    [1200, 0.46, 0.35],
    [600, 0.8, 0.25],
  ]
  segments.forEach(([freq, start, duration]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    const t0 = ctx.currentTime + start
    osc.frequency.setValueAtTime(freq * 0.6, t0)
    osc.frequency.exponentialRampToValueAtTime(freq, t0 + duration * 0.4)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, t0 + duration)

    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.3, t0 + duration * 0.2)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

    osc.connect(gain)
    gain.connect(master)
    osc.start(t0)
    osc.stop(t0 + duration + 0.05)
  })
  playNoiseBurst(ctx, master, 0, 0.05, 0.05)
}

const players: Record<AlarmSound, (ctx: AudioContext, master: GainNode) => void> = {
  ding: playDing,
  chime: playChime,
  bell: playBell,
  trainWhistle: playTrainWhistle,
  guitar: playGuitar,
  rooster: playRooster,
}

export function playAlarm(sound: AlarmSound) {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  players[sound](ctx, master)
}

/** Call from a click/tap handler once to unlock audio on Smartboard browsers. */
export function primeAudio() {
  getContext()
}

// Pentatonic-ish run so consecutive random slots never clash, even played rapidly.


// A small round-robin pool of <audio> elements so rapid ticks (every 90ms) can overlap
// cleanly instead of one tick cutting the previous one's tail off.
/**
 * Recorded one-shots, each backed by a small ring of <audio> elements.
 *
 * One element per sound would cut itself off: the picker fires a tick every 90ms and a tick
 * is 115ms long, so a single element would be rewound mid-sound on every other tick. The ring
 * hands each call the next element, so they overlap the way the real sound does.
 */
const samplePools = new Map<string, { pool: HTMLAudioElement[]; next: number }>()

function playSample(file: string, size = 6, onFailure?: () => void) {
  let entry = samplePools.get(file)
  if (!entry) {
    entry = { pool: Array.from({ length: size }, () => new Audio(assetUrl(file))), next: 0 }
    samplePools.set(file, entry)
  }
  const audio = entry.pool[entry.next]
  entry.next = (entry.next + 1) % entry.pool.length
  audio.currentTime = 0
  void audio.play().catch(() => onFailure?.())
}

/**
 * A single tick of a picker's flashing animation.
 *
 * pop.mp3 is the previous sound and is kept in the repo on purpose: this one is a trial, and
 * going back is a one-word edit. The two are within 0.4 LUFS of each other, so swapping them
 * changes the character and not the volume - the old one is a soft pop centred near 500Hz,
 * this one is a dry tick with nearly all its energy at 3.5kHz. It also starts 47ms sooner,
 * since pop.mp3 carries 53ms of silence before its attack and this is trimmed to 6ms, so the
 * tick lands with the desk lighting up rather than after it.
 */
export function playPickerTick() {
  playSample('/sounds/tick.mp3')
}

/**
 * The picker landing on its winner, after the ticks stop.
 *
 * The ticks are deliberately flat and dry - two dozen of the same dead sound - so the landing
 * only has to do one thing to register: have pitch, and rise. It's a pop (a sine gliding up
 * fast, which is what a pop is) with a bright two-note sparkle on top of it, all over inside
 * 300ms. Small on purpose: this fires on every pick, many times a lesson, so it's a full stop
 * rather than a fanfare - the fanfare belongs to the class goal and shouldn't have a rival.
 *
 * Nothing here goes below 400Hz, which is the lesson the deduct sound taught: a classroom
 * tablet cannot reproduce the bottom end, so anything that matters lives above it.
 */
export function playPickerLand() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  // The pop: a fast glide up, with a noise transient to give it an edge.
  playNoiseBurst(ctx, master, 0, 0.02, 0.3)
  playTone(ctx, master, { frequency: 420, endFrequency: 880, start: 0, duration: 0.075, type: 'sine', peakGain: 0.72 })
  // The sparkle: two notes up, the second ringing on as the tail.
  playTone(ctx, master, { frequency: 1046.5, start: 0.06, duration: 0.1, type: 'triangle', peakGain: 0.46 })
  playTone(ctx, master, { frequency: 1567.98, start: 0.115, duration: 0.22, type: 'triangle', peakGain: 0.4 })
}

/** A bright, snappy two-note blip for a point landing on the class goal meter. */
export function playPointAward() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  playTone(ctx, master, { frequency: 1046.5, start: 0, duration: 0.12, type: 'sine', peakGain: 0.35 })
  playTone(ctx, master, { frequency: 1568, start: 0.06, duration: 0.16, type: 'sine', peakGain: 0.3 })
}

/**
 * A point being taken away: a recording, chosen by the teacher who uses this.
 *
 * It sits at -16.5 LUFS with its energy centred on 330-500Hz, which is the range a tablet or
 * laptop speaker can actually reproduce - the trap the synthesised version fell into, where a
 * 233Hz -> 156Hz fall measured louder than the coin tick and was still inaudible in a room
 * because almost all of it was below what the speaker could move.
 */
export function playPointDeduct() {
  playSample('/sounds/point-down.mp3', 2, playSynthPointDeduct)
}

/**
 * The synthesised deduct sound, kept as the fallback for when the recording won't play.
 *
 * This one is worth a fallback rather than silence: a teacher pressing minus and hearing
 * nothing is the exact complaint that put a sound here in the first place.
 */
function playSynthPointDeduct() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  // The tick. Broadband noise survives a small speaker better than any single tone.
  playNoiseBurst(ctx, master, 0, 0.035, 0.4)
  playTone(ctx, master, { frequency: 523.25, start: 0, duration: 0.11, type: 'square', peakGain: 0.34 })
  playTone(ctx, master, { frequency: 349.23, start: 0.085, duration: 0.3, type: 'square', peakGain: 0.32 })
  playTone(ctx, master, { frequency: 174.61, start: 0.085, duration: 0.3, type: 'triangle', peakGain: 0.28 })
}

/** A triumphant rising arpeggio + sparkle burst for reaching the class point goal. */
/** The recorded fanfare, decoded once and kept. Null until it's fetched, or if it fails. */
let fanfareBuffer: AudioBuffer | null = null
let fanfarePending: Promise<void> | null = null

/**
 * Fetch and decode the fanfare ahead of time. Called when a class goal exists, so the sound
 * is ready in memory rather than starting a 150KB download at the moment the chest opens.
 */
export function primeGoalFanfare(): void {
  if (fanfareBuffer || fanfarePending) return
  fanfarePending = fetch(assetUrl('/sounds/goal-fanfare.mp3'))
    .then((r) => r.arrayBuffer())
    .then((buf) => getContext().decodeAudioData(buf))
    .then((decoded) => {
      fanfareBuffer = decoded
    })
    .catch(() => {
      // Left null on purpose - playGoalCelebration falls back to the synthesised version.
      fanfareBuffer = null
    })
}

/** How long the celebration should run, in ms - the recording's length once it's decoded. */
export function goalFanfareDurationMs(): number {
  return fanfareBuffer ? fanfareBuffer.duration * 1000 : 9600
}

/** The synthesised fanfare, kept as the fallback for when the recording isn't available. */
function playSynthFanfare(ctx: AudioContext, master: GainNode) {
  const notes: { freq: number; start: number; dur: number }[] = [
    { freq: 392.0, start: 0, dur: 0.16 },
    { freq: 523.25, start: 0.14, dur: 0.16 },
    { freq: 659.25, start: 0.28, dur: 0.16 },
    { freq: 783.99, start: 0.42, dur: 0.7 },
  ]
  notes.forEach(({ freq, start, dur }) => {
    playTone(ctx, master, { frequency: freq, start, duration: dur, type: 'sawtooth', peakGain: 0.16 })
    playTone(ctx, master, { frequency: freq * 1.5, start, duration: dur, type: 'triangle', peakGain: 0.1 })
    playTone(ctx, master, { frequency: freq / 2, start, duration: dur, type: 'triangle', peakGain: 0.12 })
  })
  playNoiseBurst(ctx, master, 0.38, 0.22, 0.1)
  const shimmer = [1567.98, 2093.0, 2637.02, 1975.53, 3135.96, 2349.32]
  shimmer.forEach((freq, i) => {
    playTone(ctx, master, {
      frequency: freq,
      start: 0.55 + i * 0.11 + Math.random() * 0.05,
      duration: 0.5,
      type: 'sine',
      peakGain: 0.13,
    })
  })
}

/**
 * The chest opening. Returns a function that cuts the sound off, because the celebration
 * now waits for the teacher - a ten second fanfare still blaring after they've closed it
 * would be worse than no fanfare.
 */
export function playGoalCelebration(): () => void {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)

  if (!fanfareBuffer) {
    playSynthFanfare(ctx, master)
    return () => {}
  }

  const source = ctx.createBufferSource()
  source.buffer = fanfareBuffer
  source.connect(master)
  source.start()
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    // A short fade rather than a hard stop, which clicks.
    const now = ctx.currentTime
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    try {
      source.stop(now + 0.2)
    } catch {
      // already finished
    }
  }
}

/** A single coin landing - used when the meter ticks up. */
export function playCoinTick() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  playTone(ctx, master, { frequency: 1318.51, start: 0, duration: 0.14, type: 'sine', peakGain: 0.16 })
  playTone(ctx, master, { frequency: 1975.53, start: 0.04, duration: 0.16, type: 'sine', peakGain: 0.12 })
}

function cardContext(): { ctx: AudioContext; master: GainNode } {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  return { ctx, master }
}

/** Cards riffling together - a run of short, dry noise bursts. */
export function playShuffle() {
  const { ctx, master } = cardContext()
  for (let i = 0; i < 14; i++) {
    playNoiseBurst(ctx, master, i * 0.035 + Math.random() * 0.012, 0.03, 0.09)
  }
}

/** One card sliding off the deck onto the table. `delay` schedules it ahead on the audio clock, for dealing a whole hand in one call. */
export function playCardDeal(delay = 0) {
  const { ctx, master } = cardContext()
  playNoiseBurst(ctx, master, delay, 0.055, 0.07)
}

/** The snap of a card turning over, with a rising tone through the turn. */
export function playCardFlip() {
  const { ctx, master } = cardContext()
  playNoiseBurst(ctx, master, 0, 0.04, 0.12)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  const t0 = ctx.currentTime
  osc.frequency.setValueAtTime(420, t0)
  osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.22)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.16, t0 + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26)
  osc.connect(gain)
  gain.connect(master)
  osc.start(t0)
  osc.stop(t0 + 0.3)
}

/** The bright little payoff the instant a card's face lands. */
export function playCardReveal() {
  const { ctx, master } = cardContext()
  playTone(ctx, master, { frequency: 1318.5, start: 0, duration: 0.4, type: 'sine', peakGain: 0.3 })
  playTone(ctx, master, { frequency: 1975.5, start: 0.07, duration: 0.5, type: 'sine', peakGain: 0.18 })
}

/**
 * The group activity finishing and its points going out: a short rising three-note run, so
 * "Done" sounds like a full stop rather than a click. Kept above 500Hz for the same reason as
 * every other cue here - a classroom tablet has no bottom end.
 */
export function playGroupsDone() {
  const { ctx, master } = cardContext()
  playTone(ctx, master, { frequency: 783.99, start: 0, duration: 0.16, type: 'triangle', peakGain: 0.34 })
  playTone(ctx, master, { frequency: 1046.5, start: 0.11, duration: 0.16, type: 'triangle', peakGain: 0.34 })
  playTone(ctx, master, { frequency: 1567.98, start: 0.22, duration: 0.42, type: 'triangle', peakGain: 0.36 })
  playTone(ctx, master, { frequency: 2093, start: 0.26, duration: 0.4, type: 'sine', peakGain: 0.16 })
}

/**
 * A group asking for the teacher. Two soft notes, the second lower: "excuse me", not an
 * alarm. The teacher is usually bent over another group with their back to the board, and
 * this is how they find out without anyone shouting.
 */
export function playStatusHelp() {
  const { ctx, master } = cardContext()
  playTone(ctx, master, { frequency: 987.77, start: 0, duration: 0.22, type: 'sine', peakGain: 0.32 })
  playTone(ctx, master, { frequency: 783.99, start: 0.2, duration: 0.36, type: 'sine', peakGain: 0.32 })
}

/** A group ready to be checked: the same two notes the other way up. */
export function playStatusReady() {
  const { ctx, master } = cardContext()
  playTone(ctx, master, { frequency: 783.99, start: 0, duration: 0.22, type: 'sine', peakGain: 0.32 })
  playTone(ctx, master, { frequency: 987.77, start: 0.2, duration: 0.36, type: 'sine', peakGain: 0.32 })
}

/** A group finishing: one bright ding, the students' small reward for tapping it. */
export function playStatusDone() {
  const { ctx, master } = cardContext()
  playTone(ctx, master, { frequency: 1318.5, start: 0, duration: 0.4, type: 'sine', peakGain: 0.3 })
  playTone(ctx, master, { frequency: 1975.5, start: 0.07, duration: 0.5, type: 'sine', peakGain: 0.18 })
}

/** The safety cover's plastic snap as it flips open. */
export function playDeleteCoverOpen() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)

  playNoiseBurst(ctx, master, 0, 0.03, 0.5)
  playTone(ctx, master, { frequency: 1800, start: 0, duration: 0.04, type: 'square', peakGain: 0.25 })
}

export const ALARM_SOUND_LABELS: Record<AlarmSound, string> = {
  ding: 'Ding',
  chime: 'Chime',
  bell: 'Bell',
  trainWhistle: 'Train Whistle',
  guitar: 'Guitar',
  rooster: 'Rooster',
}
