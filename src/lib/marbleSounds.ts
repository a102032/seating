import { getContext } from './sound'

/**
 * The Marble Jar's new sounds (2026-10-31, from its preview, chosen by the teacher's ear): a wooden
 * knock for a marble out of the jar, a soft pat in the snow, the rain's tiny tinks, popcorn's pops,
 * the Mega Mega Marble's drum roll and fanfare, and Jingle Bells for Santa. Made in the page, every
 * one kept above 400Hz for a board's speaker, through a gentle limiter so a burst of them never crackles.
 */

let master: GainNode | null = null
let off = false
/** Sounds off, while a jar is rebuilt from where it was kept. */
export function marbleSoundsOff(quiet: boolean) {
  off = quiet
}
function out(): { ac: AudioContext; to: GainNode } | null {
  if (off) return null
  const ac = getContext()
  if (ac.state !== 'running') return null
  if (!master || master.context !== ac) {
    master = ac.createGain()
    master.gain.value = 0.9
    const limit = ac.createDynamicsCompressor()
    limit.threshold.value = -10
    limit.ratio.value = 8
    master.connect(limit).connect(ac.destination)
  }
  return { ac, to: master }
}

function tone(f: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', f2?: number) {
  const o = out()
  if (!o) return
  const t = o.ac.currentTime + at
  const osc = o.ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(f, t)
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur)
  const g = o.ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(o.to)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

let noiseBuf: AudioBuffer | null = null
function noise(at: number, dur: number, gain: number, freq: number, q = 1, f2?: number, am = 0) {
  const o = out()
  if (!o) return
  const a = o.ac
  if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = a.currentTime + at
  const src = a.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(freq, t)
  if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 3))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp).connect(g)
  if (am) {
    // A drum roll: the noise beaten quickly.
    const lfo = a.createOscillator()
    lfo.frequency.value = am
    const depth = a.createGain()
    depth.gain.value = 0.5
    const amp = a.createGain()
    amp.gain.value = 0.5
    lfo.connect(depth).connect(amp.gain)
    g.connect(amp).connect(o.to)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)
  } else g.connect(o.to)
  src.start(t)
  src.stop(t + dur + 0.05)
}

let lastTink = 0
let lastKnock = 0
let lastKernelPop = 0
/** For the checks: how many knocks were asked for. */
export const heard = { knock: 0 }

export const marbleSound = {
  /** A marble landing on wood: a short hollow knock, a little lower for a big one (the teacher: not a glass clink). */
  knock(strength: number, heavy: boolean, tiny = false) {
    heard.knock++
    const now = performance.now()
    if (now - lastKnock < (tiny ? 45 : 90)) return
    lastKnock = now
    const g = tiny ? Math.min(0.03, 0.01 + strength / 300) : Math.min(0.09, 0.025 + strength / 140)
    const f = (heavy ? 440 : tiny ? 900 : 560) * (0.94 + Math.random() * 0.12)
    tone(f, 0, 0.09, g, 'sine', f * 0.8)
    tone(f * 1.52, 0, 0.05, g * 0.5, 'triangle')
    noise(0, 0.035, g * 2.2, heavy ? 1100 : 1500, 1.6)
  },
  /** Landing in snow: a soft, muffled pat. */
  snowPat(strength: number) {
    const now = performance.now()
    if (now - lastKnock < 90) return
    lastKnock = now
    noise(0, 0.08, Math.min(0.06, 0.015 + strength / 200), 900, 0.7)
  },
  /** Rain and kernels in the jar: tiny, high and soft, quieter than the clinks. */
  tink(strength: number) {
    const now = performance.now()
    if (now - lastTink < 55) return
    lastTink = now
    const f = 3000 + Math.random() * 1800
    const g = 0.035 + Math.min(0.05, strength / 120)
    tone(f, 0, 0.12, g, 'sine')
    tone(f * 2.02, 0, 0.06, g * 0.35, 'sine')
  },
  pop() {
    noise(0, 0.07, 0.5, 1900, 1.2)
    tone(1500, 0, 0.09, 0.22, 'triangle', 620)
  },
  drumRoll(dur: number) {
    noise(0, dur, 0.28, 1300, 0.8, 2200, 22)
  },
  rise(dur: number) {
    tone(480, 0, dur, 0.12, 'triangle', 1500)
  },
  fanfare() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.5, 0.16, 'triangle'))
    ;[523, 659, 784, 1047].forEach((f) => tone(f, 0.5, 1.2, 0.09, 'triangle'))
  },
  sparkle() {
    ;[1568, 2093, 2637, 3136].forEach((f, i) => tone(f, i * 0.05, 0.25, 0.05))
  },
  /** Jingle Bells (1857, free to use) on soft bells, with sleigh bells on the beat, the length of the sleigh's flight. */
  jingleBells() {
    const N: Record<string, number> = { C: 1047, D: 1175, E: 1319, F: 1397, G: 1568 }
    const tune: [string, number][] = [
      ['E', 1],
      ['E', 1],
      ['E', 2],
      ['E', 1],
      ['E', 1],
      ['E', 2],
      ['E', 1],
      ['G', 1],
      ['C', 1.5],
      ['D', 0.5],
      ['E', 4],
      ['F', 1],
      ['F', 1],
      ['F', 1.5],
      ['F', 0.5],
      ['F', 1],
      ['E', 1],
      ['E', 1],
      ['E', 0.5],
      ['E', 0.5],
      ['E', 1],
      ['D', 1],
      ['D', 1],
      ['E', 1],
      ['D', 2],
      ['G', 2],
    ]
    const beat = 0.27
    let t = 0.15
    for (const [n, d] of tune) {
      const f = N[n] / 2
      tone(f, t, Math.min(0.9, d * beat * 1.6), 0.07, 'triangle')
      tone(f * 2, t, Math.min(0.5, d * beat), 0.022)
      t += d * beat
    }
    for (let b = 0.15; b < t; b += beat) noise(b, 0.07, 0.05, 7200, 3)
  },
  whoosh() {
    noise(0, 0.7, 0.12, 700, 0.9, 2600)
  },
  crackle() {
    for (let i = 0; i < 12; i++) noise(i * 0.045 + Math.random() * 0.02, 0.03, 0.25, 2500 + Math.random() * 1500, 2)
  },
  kernelPop() {
    const now = performance.now()
    if (now - lastKernelPop < 45) return
    lastKernelPop = now
    noise(0, 0.045, 0.32, 1600 + Math.random() * 900, 1.4)
    tone(1300 + Math.random() * 500, 0, 0.06, 0.1, 'triangle', 700)
  },
}
