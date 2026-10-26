import { getContext } from './sound'

/**
 * The Space Quest's sounds (DECISIONS, "The Space Quest"), made in the browser, each shaped for its
 * moment rather than a beep (the teacher, 2026-10-26: "actual sounds that make sense"): fuel
 * pouring, bars charging, the countdown, the engine catching and roaring away, the flight, the
 * landing and the flame going out, footsteps, the flag going in, the UFO and its beam, the case.
 * Board speakers have no bass, so each sound has its body above about 400Hz, with a little low end
 * for speakers that have it. All of it goes through one level, turned down by half after the teacher
 * heard the first version.
 */

let out: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
function bus(): { c: AudioContext; out: GainNode; noise: AudioBuffer } {
  const c = getContext()
  if (!out || out.context !== c) {
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    out = c.createGain()
    out.gain.value = 0.45
    out.connect(comp).connect(c.destination)
    noiseBuf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return { c, out, noise: noiseBuf! }
}

type Points = [number, number][]
/** A burst of noise through a filter, its loudness shaped by [time, gain] points and its filter by [time, Hz]. */
function noise({
  at = 0,
  dur,
  type = 'bandpass',
  q = 1,
  freq = [[0, 1000]],
  gain = [[0, 0.3]],
}: {
  at?: number
  dur: number
  type?: BiquadFilterType
  q?: number
  freq?: Points
  gain?: Points
}) {
  const { c, out, noise } = bus()
  const t0 = c.currentTime + at
  const src = c.createBufferSource()
  src.buffer = noise
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = q
  const g = c.createGain()
  f.frequency.setValueAtTime(freq[0][1], t0)
  freq.slice(1).forEach(([t, v]) => f.frequency.exponentialRampToValueAtTime(v, t0 + t))
  g.gain.setValueAtTime(0, t0)
  gain.forEach(([t, v]) => g.gain.linearRampToValueAtTime(v, t0 + t))
  src.connect(f).connect(g).connect(out)
  src.start(t0, Math.random() * 3)
  src.stop(t0 + dur + 0.05)
}
/** One note: its pitch shaped by [time, Hz], its loudness by [time, gain]; `vib` wobbles the pitch [rate, depth]. */
function tone({
  at = 0,
  dur,
  type = 'sine',
  freq = [[0, 440]],
  gain = [[0, 0.2]],
  vib,
}: {
  at?: number
  dur: number
  type?: OscillatorType
  freq?: Points
  gain?: Points
  vib?: [number, number]
}) {
  const { c, out } = bus()
  const t0 = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq[0][1], t0)
  freq.slice(1).forEach(([t, v]) => o.frequency.exponentialRampToValueAtTime(v, t0 + t))
  if (vib) {
    const l = c.createOscillator()
    const lg = c.createGain()
    l.frequency.value = vib[0]
    lg.gain.value = vib[1]
    l.connect(lg).connect(o.frequency)
    l.start(t0)
    l.stop(t0 + dur + 0.05)
  }
  g.gain.setValueAtTime(0, t0)
  gain.forEach(([t, v]) => g.gain.linearRampToValueAtTime(v, t0 + t))
  o.connect(g).connect(out)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

export const spaceSound = {
  /** Fuel pouring from the barrel: a liquid rush with glugs bubbling up through it. */
  pour() {
    noise({
      dur: 1.3,
      freq: [
        [0, 900],
        [0.6, 1600],
        [1.3, 1100],
      ],
      q: 1.4,
      gain: [
        [0, 0],
        [0.12, 0.16],
        [1.1, 0.14],
        [1.3, 0],
      ],
    })
    for (let i = 0; i < 7; i++) {
      const a = 0.08 + i * 0.15 + Math.random() * 0.05
      const f = 380 + Math.random() * 220
      tone({
        at: a,
        dur: 0.11,
        freq: [
          [0, f],
          [0.09, f * 2.6],
        ],
        gain: [
          [0, 0],
          [0.01, 0.22],
          [0.1, 0],
        ],
      })
    }
  },
  /** A bar of fuel lights: a short electric charge-up, higher for each bar. */
  bar(k: number) {
    const f = 520 * Math.pow(1.122, k % 12)
    tone({
      dur: 0.32,
      type: 'triangle',
      freq: [
        [0, f],
        [0.25, f * 2],
      ],
      gain: [
        [0, 0],
        [0.02, 0.16],
        [0.3, 0],
      ],
    })
    tone({
      dur: 0.32,
      type: 'square',
      freq: [
        [0, f * 1.005],
        [0.25, f * 2.01],
      ],
      gain: [
        [0, 0],
        [0.02, 0.035],
        [0.3, 0],
      ],
    })
    tone({
      at: 0.24,
      dur: 0.5,
      freq: [[0, f * 3]],
      gain: [
        [0, 0],
        [0.01, 0.1],
        [0.5, 0],
      ],
    })
  },
  /** The cells are full: a bright rising power-up with a shimmer. */
  full() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone({
        at: i * 0.09,
        dur: 0.6,
        type: 'triangle',
        freq: [[0, f]],
        gain: [
          [0, 0],
          [0.02, 0.17],
          [0.6, 0],
        ],
      }),
    )
    noise({
      at: 0.2,
      dur: 1,
      type: 'highpass',
      freq: [[0, 5000]],
      gain: [
        [0, 0],
        [0.2, 0.05],
        [1, 0],
      ],
    })
  },
  /** Mission control's countdown beeps, and the higher one on "Blast off!". */
  beep(go: boolean) {
    tone({
      dur: go ? 0.5 : 0.16,
      type: 'square',
      freq: [[0, go ? 1320 : 880]],
      gain: [
        [0, 0],
        [0.005, 0.09],
        [go ? 0.45 : 0.14, 0.08],
        [go ? 0.5 : 0.16, 0],
      ],
    })
  },
  /** Ignition and lift-off: the engine catches with a crackle, roars up, then fades as the rocket climbs away. */
  blastoff(dur = 3.6) {
    noise({
      dur: 0.5,
      freq: [[0, 3000]],
      q: 0.7,
      gain: [
        [0, 0.5],
        [0.08, 0],
      ],
    })
    noise({
      dur,
      type: 'lowpass',
      q: 0.6,
      freq: [
        [0, 400],
        [0.6, 2600],
        [dur * 0.7, 1800],
        [dur, 600],
      ],
      gain: [
        [0, 0],
        [0.35, 0.7],
        [dur * 0.55, 0.6],
        [dur, 0],
      ],
    })
    noise({
      dur,
      q: 0.8,
      freq: [
        [0, 600],
        [dur, 500],
      ],
      gain: [
        [0, 0],
        [0.3, 0.35],
        [dur * 0.6, 0.3],
        [dur, 0],
      ],
    })
    tone({
      dur,
      freq: [
        [0, 70],
        [dur, 50],
      ],
      gain: [
        [0, 0],
        [0.3, 0.35],
        [dur, 0],
      ],
    })
    for (let i = 0; i < 26; i++)
      noise({
        at: 0.1 + Math.random() * dur * 0.7,
        dur: 0.03,
        freq: [[0, 2500 + Math.random() * 2500]],
        q: 3,
        gain: [
          [0, 0.22],
          [0.03, 0],
        ],
      })
  },
  /** Flying through space: a long airy rush that swells and passes. */
  fly(dur: number) {
    noise({
      dur,
      freq: [
        [0, 500],
        [dur * 0.5, 2200],
        [dur, 700],
      ],
      q: 1.6,
      gain: [
        [0, 0],
        [dur * 0.3, 0.14],
        [dur * 0.7, 0.14],
        [dur, 0],
      ],
    })
  },
  /** The view zooming: a quick swoosh, rising as it zooms out, falling as it zooms in. */
  zoom(inward: boolean) {
    noise({
      dur: 1,
      freq: inward
        ? [
            [0, 3000],
            [1, 500],
          ]
        : [
            [0, 500],
            [1, 3000],
          ],
      q: 2,
      gain: [
        [0, 0],
        [0.4, 0.16],
        [1, 0],
      ],
    })
  },
  /** Coming in to land: the thrusters getting louder as the ground comes up. */
  descend(dur: number) {
    noise({
      dur,
      type: 'lowpass',
      q: 0.7,
      freq: [
        [0, 900],
        [dur, 2200],
      ],
      gain: [
        [0, 0],
        [dur * 0.4, 0.25],
        [dur, 0.45],
      ],
    })
    tone({
      dur,
      freq: [[0, 60]],
      gain: [
        [0, 0],
        [dur, 0.25],
      ],
    })
  },
  /** Touchdown: a thump, the metal legs taking the weight, then the flame going out with a long hiss. */
  touchdown() {
    tone({
      dur: 0.35,
      freq: [
        [0, 180],
        [0.3, 60],
      ],
      gain: [
        [0, 0.7],
        [0.35, 0],
      ],
    })
    noise({
      dur: 0.25,
      type: 'lowpass',
      freq: [[0, 1200]],
      gain: [
        [0, 0.5],
        [0.25, 0],
      ],
    })
    ;[1180, 1770].forEach((f) =>
      tone({
        at: 0.04,
        dur: 0.35,
        freq: [[0, f]],
        gain: [
          [0, 0.07],
          [0.35, 0],
        ],
      }),
    )
    noise({
      at: 0.1,
      dur: 1.6,
      type: 'highpass',
      freq: [
        [0, 2500],
        [1.6, 5000],
      ],
      gain: [
        [0, 0],
        [0.05, 0.28],
        [1.6, 0],
      ],
    })
  },
  /** The hatch opening: a hiss and a clunk. */
  hatch() {
    noise({
      dur: 0.4,
      type: 'highpass',
      freq: [[0, 3000]],
      gain: [
        [0, 0.2],
        [0.4, 0],
      ],
    })
    tone({
      at: 0.3,
      dur: 0.15,
      freq: [
        [0, 600],
        [0.12, 300],
      ],
      gain: [
        [0, 0.3],
        [0.15, 0],
      ],
    })
  },
  /** A bouncy low-gravity step: a soft crunch of dust and a little boing. */
  step() {
    noise({
      dur: 0.12,
      type: 'lowpass',
      freq: [[0, 1400]],
      gain: [
        [0, 0.3],
        [0.12, 0],
      ],
    })
    tone({
      dur: 0.22,
      freq: [
        [0, 420],
        [0.2, 700],
      ],
      gain: [
        [0, 0],
        [0.02, 0.07],
        [0.22, 0],
      ],
    })
  },
  /** Planting the flag: a swish down, a firm thunk into the ground, then the cloth flapping. */
  flag() {
    noise({
      dur: 0.22,
      freq: [
        [0, 3000],
        [0.2, 900],
      ],
      q: 1.2,
      gain: [
        [0, 0],
        [0.1, 0.2],
        [0.22, 0],
      ],
    })
    tone({
      at: 0.2,
      dur: 0.2,
      freq: [
        [0, 520],
        [0.18, 160],
      ],
      gain: [
        [0, 0.45],
        [0.2, 0],
      ],
    })
    noise({
      at: 0.2,
      dur: 0.08,
      type: 'lowpass',
      freq: [[0, 1600]],
      gain: [
        [0, 0.4],
        [0.08, 0],
      ],
    })
    for (let i = 0; i < 6; i++)
      noise({
        at: 0.45 + i * 0.11,
        dur: 0.08,
        freq: [[0, 1800]],
        q: 2,
        gain: [
          [0, 0],
          [0.03, 0.08],
          [0.08, 0],
        ],
      })
    ;[784, 1047].forEach((f, i) =>
      tone({
        at: 0.5 + i * 0.12,
        dur: 0.4,
        type: 'triangle',
        freq: [[0, f]],
        gain: [
          [0, 0],
          [0.02, 0.1],
          [0.4, 0],
        ],
      }),
    )
  },
  /** The UFO: the classic warbling hum, sliding down in pitch as it arrives. */
  ufoIn(dur: number) {
    tone({
      dur,
      freq: [
        [0, 1300],
        [dur, 620],
      ],
      vib: [7, 70],
      gain: [
        [0, 0],
        [dur * 0.5, 0.1],
        [dur, 0.12],
      ],
    })
    tone({
      dur,
      freq: [
        [0, 1950],
        [dur, 930],
      ],
      vib: [7.3, 90],
      gain: [
        [0, 0],
        [dur * 0.5, 0.05],
        [dur, 0.06],
      ],
    })
  },
  ufoHover(dur: number) {
    tone({
      dur,
      freq: [[0, 620]],
      vib: [7, 60],
      gain: [
        [0, 0.12],
        [dur, 0.1],
      ],
    })
    tone({
      dur,
      freq: [[0, 930]],
      vib: [7.3, 80],
      gain: [
        [0, 0.06],
        [dur, 0.05],
      ],
    })
  },
  ufoOut(dur: number) {
    tone({
      dur,
      freq: [
        [0, 620],
        [dur, 1600],
      ],
      vib: [8, 80],
      gain: [
        [0, 0.12],
        [dur, 0],
      ],
    })
  },
  /** The tractor beam: a shimmering chord with a sparkle in it. */
  beam(dur: number) {
    ;[1047, 1319, 1568, 2093].forEach((f, i) =>
      tone({
        dur,
        freq: [
          [0, f * 0.9],
          [dur, f],
        ],
        vib: [18 + i * 3, f * 0.01],
        gain: [
          [0, 0],
          [0.3, 0.045],
          [dur, 0],
        ],
      }),
    )
    noise({
      dur,
      type: 'highpass',
      freq: [[0, 6000]],
      gain: [
        [0, 0],
        [0.3, 0.05],
        [dur, 0],
      ],
    })
  },
  /** The case settling on the ground: a soft thump and a metal clank. */
  caseDown() {
    tone({
      dur: 0.25,
      freq: [
        [0, 260],
        [0.2, 110],
      ],
      gain: [
        [0, 0.4],
        [0.25, 0],
      ],
    })
    ;[940, 1410, 2010].forEach((f) =>
      tone({
        dur: 0.4,
        freq: [[0, f]],
        gain: [
          [0, 0.05],
          [0.4, 0],
        ],
      }),
    )
  },
  /** The case shrinking to carry size: a quick falling whoop. */
  shrink() {
    tone({
      dur: 0.5,
      type: 'triangle',
      freq: [
        [0, 1400],
        [0.45, 500],
      ],
      gain: [
        [0, 0],
        [0.03, 0.14],
        [0.5, 0],
      ],
    })
  },
  /** Picking it up: a light handle click and a little lift. */
  pickup() {
    noise({
      dur: 0.04,
      freq: [[0, 3000]],
      q: 2,
      gain: [
        [0, 0.3],
        [0.04, 0],
      ],
    })
    tone({
      at: 0.03,
      dur: 0.25,
      freq: [
        [0, 600],
        [0.2, 900],
      ],
      gain: [
        [0, 0],
        [0.02, 0.12],
        [0.25, 0],
      ],
    })
  },
  /** His helmet in the window: a happy two-note hello. */
  hello() {
    ;[784, 1175].forEach((f, i) =>
      tone({
        at: i * 0.13,
        dur: 0.3,
        type: 'triangle',
        freq: [[0, f]],
        gain: [
          [0, 0],
          [0.02, 0.16],
          [0.3, 0],
        ],
      }),
    )
  },
}
