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
  start: number
  duration: number
  type?: OscillatorType
  peakGain?: number
  detune?: number
}

function playTone(ctx: AudioContext, master: GainNode, { frequency, start, duration, type = 'sine', peakGain = 0.4, detune = 0 }: ToneOptions) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + start)
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
const POP_POOL_SIZE = 6
let popPool: HTMLAudioElement[] = []
let popPoolIndex = 0

function playPop() {
  if (popPool.length === 0) {
    popPool = Array.from({ length: POP_POOL_SIZE }, () => new Audio(assetUrl('/sounds/pop.mp3')))
  }
  const audio = popPool[popPoolIndex]
  popPoolIndex = (popPoolIndex + 1) % popPool.length
  audio.currentTime = 0
  void audio.play().catch(() => {})
}

/** A short, soft blip for a single tick of a picker's flashing animation. `slot` is the desk index or column index currently lit. */
export function playPickerTick() {
  playPop()
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

/** A triumphant rising arpeggio + sparkle burst for reaching the class point goal. */
export function playGoalCelebration() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
  notes.forEach((freq, i) => {
    playTone(ctx, master, { frequency: freq, start: i * 0.09, duration: 0.9 - i * 0.05, type: 'triangle', peakGain: 0.32 })
  })
  playNoiseBurst(ctx, master, 0, 0.4, 0.12)
  playTone(ctx, master, { frequency: 2093, start: 0.45, duration: 0.6, type: 'sine', peakGain: 0.22 })
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
