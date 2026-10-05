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
  /** Seconds to fade in. The default is near-instant; a slower one takes the edge off a note. */
  attack?: number
}

function playTone(
  ctx: AudioContext,
  master: GainNode,
  { frequency, endFrequency, start, duration, type = 'sine', peakGain = 0.4, detune = 0, attack }: ToneOptions,
) {
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
  gain.gain.linearRampToValueAtTime(peakGain, t0 + (attack ?? Math.min(0.02, duration / 4)))
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

/** `volume` is 0 to 1; `from` skips silence at the start of a file, in seconds. */
function playSample(file: string, size = 6, onFailure?: () => void, { volume = 1, from = 0 } = {}) {
  let entry = samplePools.get(file)
  if (!entry) {
    entry = { pool: Array.from({ length: size }, () => new Audio(assetUrl(file))), next: 0 }
    samplePools.set(file, entry)
  }
  const audio = entry.pool[entry.next]
  entry.next = (entry.next + 1) % entry.pool.length
  audio.volume = volume
  audio.currentTime = from
  void audio.play().catch(() => onFailure?.())
}

/** Pickers flash every 90ms; a gap this long between sounds means one on every other flash. */
const PICKER_TICK_GAP_MS = 150
let lastPickerTick = 0

/**
 * A picker's flash: Pick Student, Pick Row, the group pickers and the floating class goal.
 *
 * A soft pop (pop.mp3, centred near 500Hz), only on every other flash: the desk or name still
 * changes every 90ms, but the room hears half as many sounds. It replaced a dry 3.5kHz tick on
 * every flash at full volume, which the teacher found too jarring on the board; he chose this
 * by ear from three candidates played side by side. It first went in at a third of full
 * volume, and on the board he had to turn the speakers all the way up to hear it - 500Hz is
 * near the bottom of what a classroom speaker does - so it plays at 80%. pop.mp3 carries 53ms
 * of silence before its attack, skipped so the pop lands with the flash, not after it.
 */
export function playPickerTick() {
  const now = performance.now()
  if (now - lastPickerTick < PICKER_TICK_GAP_MS) return
  lastPickerTick = now
  playSample('/sounds/pop.mp3', 4, undefined, { volume: 0.8, from: 0.053 })
}

/**
 * The picker landing on its winner, after the pops stop: a gentle chime, three notes of a major
 * chord (G, C, E) rolled upward, each fading in over 40ms and ringing out for about a second,
 * with a faint octave above each for a bell's shimmer. It replaced a single pure ding at
 * 1.3kHz with a near-instant start, which on the board came out "loud and abrupt" - that pitch
 * is where a classroom speaker is strongest, and it followed pops that were too quiet. Small
 * on purpose: it fires on every pick, many times a lesson, and the fanfare belongs to the
 * class goal. Nothing goes below 400Hz - a classroom tablet can't reproduce the bottom end.
 */
export function playPickerLand() {
  const ctx = getContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  ;[783.99, 1046.5, 1318.5].forEach((frequency, i) => {
    const start = i * 0.07
    playTone(ctx, master, { frequency, start, duration: 1, type: 'sine', peakGain: 0.075, attack: 0.04 })
    playTone(ctx, master, { frequency: frequency * 2, start, duration: 0.5, type: 'sine', peakGain: 0.015, attack: 0.04 })
  })
}

/**
 * A point being taken away: "Negative reverberate", one low note that drops and fades. The
 * teacher's own pick, from recordings he found and sent.
 *
 * The recording before it played at full scale, about 14 dB louder than the coin, and the room
 * heard it as a blast. This one plays at 43%, which puts it about 1.3 dB under the coin to the
 * ear (A-weighted: the ear hears a low note as quieter, so it gets more raw level than the coin
 * does), and skips the 71ms of silence at the front of the file so it lands with the tap.
 *
 * Nearly all of it sits at 280-400Hz, under the line this file otherwise keeps to, and it was
 * chosen by ear anyway. The trap to remember: a synthesised 233Hz -> 156Hz fall once went
 * missing in a room while measuring louder than the coin, because a small speaker can't move
 * that low. If this one goes quiet on the board, the volume here is the first knob.
 */
export function playPointDeduct() {
  playSample('/sounds/negative-reverberate.mp3', 2, playSynthPointDeduct, { volume: 0.43, from: 0.071 })
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
  // Level with the recording it stands in for; at full it was 6 dB louder, the old blast again.
  master.gain.value = 0.48
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

/**
 * A point landing: an arcade coin, the one sound for every point - the class goal meter
 * moving up (a point from the desks, +1 in the floating window, a Mystery Gift) and +1 on a group
 * card. A short G, then a C that rings, in a triangle wave with a faint octave on top.
 *
 * It replaced two quick sine pings (E6 and B6, and a group card's C6 and G6) that the teacher
 * found jarring on the board: the top note sat near 2kHz, where a board's speaker is at its
 * sharpest. He asked for a coin "like in Mario" and chose this one by ear on a listening page
 * of four at matched loudness. It is a coin in spirit, not Nintendo's: a console's square wave
 * is buzzy, which is its own kind of jarring, so this is the rounder triangle and sits lower.
 */
export function playCoinTick(loud = false) {
  const ctx = getContext()
  // Get Ready!'s stars landing ring it at 2.2 times, through a limiter: the teacher found the win
  // too quiet after a drum the class had heard every second, and the drum is loud on a board.
  const master = loud ? limitedMaster(ctx) : ctx.createGain()
  if (!loud) master.connect(ctx.destination)
  const k = loud ? 2.2 : 1
  playTone(ctx, master, { frequency: 783.99, start: 0, duration: 0.09, type: 'triangle', peakGain: 0.16 * k, attack: 0.004 })
  playTone(ctx, master, { frequency: 1046.5, start: 0.07, duration: 0.5, type: 'triangle', peakGain: 0.16 * k, attack: 0.004 })
  playTone(ctx, master, { frequency: 2093, start: 0.07, duration: 0.22, type: 'sine', peakGain: 0.016 * k, attack: 0.004 })
}

/**
 * A master through a limiter, for Get Ready!'s endings: turned well up so they stand out over the
 * drum, without the notes stacked on a double hit clipping into a crackle.
 */
function limitedMaster(ctx: AudioContext): GainNode {
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.002
  limiter.release.value = 0.2
  limiter.connect(ctx.destination)
  const master = ctx.createGain()
  master.connect(limiter)
  return master
}

// --- Get Ready! --------------------------------------------------------------------------------

/**
 * The drum: the teacher's own taiko recording, reworked for a board's speaker. Almost all of a
 * taiko is bass (strongest at 60-90Hz), and the part above 400Hz - all a board speaker plays -
 * was about 16 times quieter, so the bass below 70Hz is cut, the skin lifted 12 dB above 600Hz,
 * and it is levelled so what a board plays matches the bamboo it replaced; the boom is still
 * there on speakers that have it. Trimmed from 1.2 s to 0.6 s, so a hit a second stays a hit a
 * second. Decoded into a buffer rather than played through <audio>, because each stick plays it
 * at its own pitch and the time-up plays two at once.
 */
let taikoBuffer: AudioBuffer | null = null
let taikoPending: Promise<void> | null = null

/** Fetch and decode the drum ahead, while the teacher is choosing how long. */
export function primeTaiko(): void {
  if (taikoBuffer || taikoPending) return
  taikoPending = fetch(assetUrl('/sounds/taiko-hit.wav'))
    .then((r) => r.arrayBuffer())
    .then((buf) => getContext().decodeAudioData(buf))
    .then((decoded) => {
      taikoBuffer = decoded
    })
    .catch(() => {
      taikoBuffer = null
      taikoPending = null
    })
}

function playTaikoBuffer(ctx: AudioContext, to: AudioNode, rate: number, at = 0) {
  if (!taikoBuffer) return false
  const source = ctx.createBufferSource()
  source.buffer = taikoBuffer
  source.playbackRate.value = rate
  source.connect(to)
  source.start(ctx.currentTime + at)
  return true
}

/** The stick meeting the skin: a short, quiet clack around 1.8kHz, where small speakers are strong, so the hit carries across a room. */
function playStickClack(ctx: AudioContext, to: AudioNode) {
  const length = Math.floor(ctx.sampleRate * 0.03)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
  const source = ctx.createBufferSource()
  const band = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  source.buffer = buffer
  band.type = 'bandpass'
  band.frequency.value = 1800
  band.Q.value = 1.2
  gain.gain.value = 0.25
  source.connect(band).connect(gain).connect(to)
  source.start()
}

/**
 * One drum hit, once a second from the tap that starts Get Ready! to the end. The two sticks are
 * a shade apart in pitch, as two real hits are, so a beat a second doesn't sound like a machine.
 */
export function playTaikoHit(rightStick: boolean) {
  const ctx = getContext()
  if (!playTaikoBuffer(ctx, ctx.destination, rightStick ? 0.96 : 1)) {
    // Until the recording is decoded: a short knock.
    const master = ctx.createGain()
    master.connect(ctx.destination)
    playTone(ctx, master, { frequency: 700, endFrequency: 560, start: 0, duration: 0.09, type: 'triangle', peakGain: 0.12, attack: 0.003 })
  }
  playStickClack(ctx, ctx.destination)
}

/**
 * Time ran out: both sticks at once, deeper, then three notes falling (G, E, C) - a fall, not a
 * buzzer, so the class hears they missed it rather than that they're in trouble. The teacher
 * asked twice for it louder: measured for what a board's speaker plays (above 400Hz, loudest
 * 50ms), the notes are about 10 dB over a drum hit, with a brighter octave a small speaker carries.
 */
export function playGetReadyTimeUp() {
  const ctx = getContext()
  const master = limitedMaster(ctx)
  playTaikoBuffer(ctx, master, 0.86)
  playTaikoBuffer(ctx, master, 0.92, 0.012)
  playStickClack(ctx, master)
  ;[
    [783.99, 0.35, 0.3],
    [659.25, 0.6, 0.3],
    [523.25, 0.85, 1.0],
  ].forEach(([frequency, start, duration]) => {
    playTone(ctx, master, { frequency, start, duration, type: 'triangle', peakGain: 0.55, attack: 0.01 })
    playTone(ctx, master, { frequency: frequency * 2, start, duration: duration * 0.6, type: 'triangle', peakGain: 0.16, attack: 0.01 })
  })
}

/** Ready!: a rising pair as the stars set off for the jar, well above a drum hit, so it sounds like a win. */
export function playGetReadyGo() {
  const ctx = getContext()
  const master = limitedMaster(ctx)
  playTone(ctx, master, { frequency: 783.99, start: 0, duration: 0.18, type: 'triangle', peakGain: 0.42, attack: 0.01 })
  playTone(ctx, master, { frequency: 1174.66, start: 0.1, duration: 0.36, type: 'triangle', peakGain: 0.42, attack: 0.01 })
  playTone(ctx, master, { frequency: 2349.32, start: 0.1, duration: 0.2, type: 'sine', peakGain: 0.03, attack: 0.01 })
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

/**
 * A Mystery Gift turning over: a quick rising sparkle. Deliberately small - the class goal owns
 * the one big celebration in this app, and a fanfare for every lucky card would wear it down.
 */
export function playBonus() {
  const { ctx, master } = cardContext()
  playTone(ctx, master, { frequency: 1046.5, start: 0, duration: 0.14, type: 'triangle', peakGain: 0.26 })
  playTone(ctx, master, { frequency: 1318.5, start: 0.07, duration: 0.14, type: 'triangle', peakGain: 0.26 })
  playTone(ctx, master, { frequency: 1567.98, start: 0.14, duration: 0.18, type: 'triangle', peakGain: 0.28 })
  playTone(ctx, master, { frequency: 2093, start: 0.21, duration: 0.4, type: 'sine', peakGain: 0.18 })
}

/**
 * A gift landing on 5, the rare one, on top of the picker's chime: a longer run up five notes
 * with a ringing top. Bigger than a 2, 3 or 4 and still far short of the chest's fanfare.
 */
export function playGiftGold() {
  const { ctx, master } = cardContext()
  ;[1046.5, 1318.5, 1567.98, 2093, 2637].forEach((frequency, i) => {
    playTone(ctx, master, { frequency, start: 0.12 + i * 0.06, duration: 0.2 + i * 0.04, type: 'triangle', peakGain: 0.24 })
  })
  playTone(ctx, master, { frequency: 3136, start: 0.42, duration: 0.7, type: 'sine', peakGain: 0.12 })
}
