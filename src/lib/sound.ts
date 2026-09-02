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
const PICKER_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]

/** A short, soft blip for a single tick of a picker's flashing animation. `slot` is the desk index or column index currently lit. */
export function playPickerTick(slot: number) {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  const frequency = PICKER_SCALE[((slot % PICKER_SCALE.length) + PICKER_SCALE.length) % PICKER_SCALE.length]
  playTone(ctx, master, { frequency, start: 0, duration: 0.1, type: 'sine', peakGain: 0.3 })
}

/** The safety cover's plastic snap as it flips open, followed by the recorded voice warning. */
export function playDeleteCoverOpen() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)

  playNoiseBurst(ctx, master, 0, 0.03, 0.5)
  playTone(ctx, master, { frequency: 1800, start: 0, duration: 0.04, type: 'square', peakGain: 0.25 })

  // A plain <audio> element, not the Web Audio fetch/decode pipeline above - some
  // sandboxed preview environments block fetch() of the recorded clip even when
  // it's embedded right in the page, but a normal audio element still plays it.
  window.setTimeout(() => {
    const audio = new Audio('/sounds/delete-warning.mp3')
    void audio.play().catch(() => {
      // The cover still opens fine without the voice line if playback is blocked.
    })
  }, 180)
}

export const ALARM_SOUND_LABELS: Record<AlarmSound, string> = {
  ding: 'Ding',
  chime: 'Chime',
  bell: 'Bell',
  trainWhistle: 'Train Whistle',
  guitar: 'Guitar',
  rooster: 'Rooster',
}
