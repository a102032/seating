/**
 * The mouse face of the timer (2026-10-20, the teacher, from a phone app's visual timer: a mouse
 * eating its way through apples to the cheese). One apple is one minute, so the whole apples left
 * are the minutes left and a child who can't read 4:53 can count them. Worked out in a preview
 * ("Mouse Timer Preview", a Claude artifact) before it came in.
 *
 * An apple's minute: twelve bites, one every 5 seconds, six from the mouse's side, a run round the
 * back of the apple at half a minute, six from the other side, and the core is left. More minutes
 * are more apples on a grid, eaten along a path that snakes up from the bottom right (right to
 * left, then left to right) and ends at the cheese, where the mouse runs at time's up. One apple
 * has no cheese: the mouse sits back from the core and hops.
 *
 * Everything is drawn from the time into the timer (`timerElapsed`), never from what happened
 * before, so a pause, a reload or a timer opened from the bar halfway shows exactly where it is.
 * The scene is built once into an SVG and changed by setting attributes, not through React, and
 * the face draws it at most 30 times a second (MouseFace.tsx): only the apple being eaten has
 * masks; every other apple is a <use> of a whole apple or a core.
 */

const S = 1.15 // the mouse's size, in a one-apple stage
const GROUND = 236
const AX = 220 // the apple's centre in a one-apple stage (440 x 268)
const AY = 158
/** The face is square: 440 x 440. */
const W = 440
const H = 440
const APPLE =
  'M 0 -58 C 18 -76, 70 -78, 82 -30 C 94 14, 70 70, 38 76 C 22 79, 10 72, 0 70 C -10 72, -22 79, -38 76 C -70 70, -94 14, -82 -30 C -70 -78, -18 -76, 0 -58 Z'
const NS = 'http://www.w3.org/2000/svg'
const SHADOW = 'rgba(30, 20, 60, 0.13)'

type Circle = [number, number, number]
interface Bite {
  c: Circle[]
  /** Skin peeled off the core's front, so the seeds show: the last bite on each side. */
  peel?: [number, number, number, number]
  side: 1 | -1
  teeth: Circle[][]
  cx: number
  cy: number
  /** Where the mouth meets the apple, in the stage. */
  contact: [number, number]
  pose: { X: number; u: number; dir: number }
}

// Six from the right and then six from the left, outside in, so the apple that is left always
// reads as the time that is left.
const RIGHT: Pick<Bite, 'c' | 'peel'>[] = [
  { c: [[104, -4, 30]] },
  { c: [[98, 34, 28]] },
  { c: [[96, -30, 26]] },
  { c: [[74, 4, 30]] },
  {
    c: [
      [68, 40, 28],
      [72, -26, 22],
    ],
  },
  {
    c: [
      [44, 0, 30],
      [48, -32, 24],
      [48, 35, 27],
    ],
    peel: [10, 4, 15, 42],
  },
]
const LEFT: Pick<Bite, 'c' | 'peel'>[] = [
  { c: [[-104, 4, 30]] },
  { c: [[-98, -28, 27]] },
  { c: [[-95, 37, 27]] },
  { c: [[-74, -3, 30]] },
  {
    c: [
      [-68, -30, 26],
      [-72, 30, 22],
    ],
  },
  {
    c: [
      [-44, 2, 30],
      [-48, 35, 25],
      [-48, -31, 26],
    ],
    peel: [-10, 4, 15, 42],
  },
]

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, f: number) => a + (b - a) * f
const deg = (r: number) => (r * 180) / Math.PI
const rot = (p: { x: number; y: number }, a: number) => ({
  x: p.x * Math.cos(a) - p.y * Math.sin(a),
  y: p.x * Math.sin(a) + p.y * Math.cos(a),
})

// The teeth on each bite, worked out once, so every apple's core is the same.
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const BITES: Bite[] = [...RIGHT.map((b) => ({ ...b, side: 1 as const })), ...LEFT.map((b) => ({ ...b, side: -1 as const }))].map((b) => {
  const teeth = b.c.map(([cx, cy, r]) => {
    const toward = Math.atan2(-cy * 0.4, -cx)
    return [-1, -0.5, 0, 0.5, 1].map((f): Circle => {
      const a = toward + f * 1.05 + (rand() - 0.5) * 0.15
      const d = r * (0.9 + rand() * 0.05)
      return [cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.2 + rand() * 0.05)]
    })
  })
  const [cx, cy, r] = b.c[0]
  return { ...b, teeth, cx, cy, contact: [AX + cx - b.side * r * 0.97, AY + cy] as [number, number], pose: { X: 0, u: 0, dir: b.side } }
})
const HALF = BITES.length / 2

// Where the mouse stands for each bite. Its head tilts and its body leans to bring its mouth to the
// bite; reaching down it leans in, reaching up it stretches tall rather than tipping back.
const NECK = { x: -4, y: -58 }
const MOUTH = { x: -40, y: -64 }
const HEAD = 0.6
const LEAN = 0.55
const reach = (u: number) => (u < 0 ? { lean: u * LEAN, stretch: 1 } : { lean: u * 0.1, stretch: 1 + Math.min(0.13, u * 0.28) })
function mouthAt(u: number) {
  const { lean, stretch } = reach(u)
  let m = rot({ x: MOUTH.x - NECK.x, y: MOUTH.y - NECK.y }, u * HEAD)
  m = { x: (m.x + NECK.x) * S, y: (m.y + NECK.y) * S * stretch }
  return rot(m, lean)
}
for (const b of BITES) {
  const tx = b.side === 1 ? b.contact[0] + 3 : 440 - (b.contact[0] - 3)
  const ty = b.contact[1]
  let lo = -0.9
  let hi = 0.9
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (GROUND + mouthAt(mid).y > ty) lo = mid
    else hi = mid
  }
  const u = (lo + hi) / 2
  const X = tx - mouthAt(u).x
  b.pose = { X: b.side === 1 ? X : 440 - X, u, dir: b.side }
}

interface LocalPose {
  X: number
  u: number
  dir: number
  y: number
  lunge: number
  chew: number
  walk: number
  behind: boolean
}

/** One apple's minute, in its own stage: `t` seconds into it, of `min` seconds. */
function poseLocal(t: number, T: number[]): LocalPose {
  const p: LocalPose = { X: BITES[0].pose.X, u: BITES[0].pose.u, dir: 1, y: 0, lunge: 0, chew: 0, walk: -1, behind: false }
  let k = T.findIndex((tk) => tk + 0.25 > t)
  if (k === -1) k = BITES.length
  const prev = k > 0 ? BITES[k - 1].pose : BITES[0].pose
  if (k < BITES.length) {
    const next = BITES[k].pose
    if (k === HALF) {
      // Half a minute: round the back of the apple to the other side.
      const w0 = T[k - 1] + 2.1
      const w1 = T[k] - 0.95
      const up = ease((t - w0) / 0.25)
      const run = clamp01((t - w0 - 0.25) / (w1 - 0.3 - w0 - 0.25))
      const turn = ease((t - (w1 - 0.3)) / 0.3)
      const settle = ease((t - w1) / (T[k] - 0.22 - w1))
      const endX = next.X + 6
      p.X = turn > 0 ? lerp(endX, next.X, settle) : lerp(prev.X, endX, ease(run))
      p.u = settle > 0 ? lerp(0, next.u, settle) : lerp(prev.u, 0, up)
      p.dir = Math.cos(Math.PI * turn)
      if (run > 0 && run < 1) {
        p.walk = run * 7
        p.y = -Math.abs(Math.sin(run * 7 * Math.PI)) * 7
      }
      p.behind = t > w0 + 0.15 && t < w1 - 0.1
    } else {
      const f = ease((t - (T[k] - 0.9)) / 0.65)
      p.X = lerp(prev.X, next.X, f)
      p.u = lerp(prev.u, next.u, f)
      p.dir = next.dir
    }
  } else {
    p.X = prev.X
    p.u = prev.u
    p.dir = prev.dir
  }
  // The lunge into each bite and back, then about two seconds of chewing.
  for (let i = 0; i < BITES.length; i++) {
    const d = t - T[i]
    if (d > -0.22 && d < 0.26) p.lunge = d < 0 ? ease((d + 0.22) / 0.22) : 1 - ease(d / 0.26)
    if (d > 0.25 && d < 2.45) {
      const env = Math.min(1, (d - 0.25) / 0.2, (2.45 - d) / 0.35)
      p.chew = env * (0.5 - 0.5 * Math.cos((d - 0.25) * 2 * Math.PI * 3.2))
    }
  }
  return p
}

interface Slot {
  cx: number
  cy: number
  sx: number
  /** 1 on the rows eaten right to left, -1 on the rows eaten left to right. */
  m: 1 | -1
}
interface AbsPose {
  X: number
  G: number
  ground: number
  dir: number
  u: number
  sc: number
  sx: number
  lunge: number
  chew: number
  walk: number
  behind: boolean
  happy?: boolean
  cheer?: boolean
  /** The ending: how full its tummy is (0 to 1), and the paw patting it. */
  full?: number
  pat?: number
}

/** As many apples as minutes, then the cheese, on a path that snakes up from the bottom right. */
function layout(n: number): { slots: Slot[]; cheese: Slot | null } {
  if (n === 1) return { slots: [{ cx: AX, cy: AY + (H - 268) / 2, sx: 1, m: 1 }], cheese: null }
  const items = n + 1
  let best = { cols: 2, rows: 1, c: 0, empty: 0 }
  for (let cols = 2; cols <= 10; cols++) {
    const rows = Math.ceil(items / cols)
    // Room at the sides for the mouse standing beside the end apples; never so big that a few
    // apples look like a different timer.
    const c = Math.min(W / (cols + 0.9), 412 / rows, 120)
    const empty = cols * rows - items
    if (!best.c || c > best.c * 1.03 || (c > best.c * 0.97 && empty < best.empty)) best = { cols, rows, c, empty }
  }
  const { cols, rows, c } = best
  const x0 = (W - cols * c) / 2
  const sx = (0.78 * c) / 172
  const bottom = (H + rows * c) / 2 - 0.06 * c
  const all: Slot[] = []
  for (let s = 0; s < items; s++) {
    const r = Math.floor(s / cols)
    const pos = s % cols
    const m = r % 2 === 0 ? 1 : -1
    const col = m === 1 ? cols - 1 - pos : pos
    all.push({ cx: x0 + (col + 0.5) * c, cy: bottom - r * c - 78 * sx, sx, m })
  }
  return { slots: all.slice(0, n), cheese: all[n] }
}

/** A one-apple stage put onto a slot, mirrored on the rows eaten left to right. */
const stageOf = (s: Slot) => ({ tx: s.cx - s.m * s.sx * AX, ty: s.cy - s.sx * AY, sx: s.sx, m: s.m })
function toAbs(s: Slot, p: Partial<LocalPose> & { X: number; u: number; dir: number }): AbsPose {
  const st = stageOf(s)
  return {
    X: st.tx + st.m * st.sx * p.X,
    G: st.ty + st.sx * (GROUND + (p.y ?? 0)),
    ground: st.ty + st.sx * GROUND,
    dir: st.m * p.dir,
    u: p.u,
    sc: st.sx * S,
    sx: st.sx,
    lunge: p.lunge ?? 0,
    chew: p.chew ?? 0,
    walk: p.walk ?? -1,
    behind: p.behind ?? false,
  }
}

/** From one place to another: turn round if need be, scamper (or hop up a row), then settle. */
function travel(A: AbsPose, B: AbsPose, e: number, dur: number): AbsPose {
  const p: AbsPose = { ...B, lunge: 0, chew: 0, walk: -1, behind: false }
  const turnNeeded = Math.sign(A.dir) !== Math.sign(B.dir)
  p.dir = turnNeeded ? A.dir * Math.cos(Math.PI * ease(e / 0.3)) : B.dir
  const f = clamp01((e - 0.25) / (dur - 0.6))
  p.X = lerp(A.X, B.X, ease(f))
  p.ground = lerp(A.ground, B.ground, ease(f))
  let hop = 0
  if (Math.abs(B.ground - A.ground) > 1) hop = -Math.sin(Math.PI * f) * (Math.abs(B.ground - A.ground) * 0.45 + 10 * A.sx)
  else if (f > 0 && f < 1) {
    const steps = Math.max(2, Math.round(Math.abs(B.X - A.X) / (34 * A.sx)))
    hop = -Math.abs(Math.sin(f * steps * Math.PI)) * 7 * A.sx
    p.walk = f * steps
  }
  p.G = p.ground + hop
  p.u = e < 0.25 ? lerp(A.u, 0, ease(e / 0.25)) : f >= 1 ? lerp(0, B.u, ease((e - (dur - 0.35)) / 0.35)) : 0
  return p
}

/** Seconds after time's up for the mouse to reach the cheese. */
const ARRIVE = 1.4
/**
 * The ending (2026-10-21, the class, the first day they saw it: "why didn't the mouse eat the
 * cheese?"), in seconds from when the mouse is at the cheese (or, with one apple, beside its core):
 * a happy dance (two hops and a spin), four fast chomps that eat it all, a round tummy patted, and
 * a hiccup. About five seconds, small beside the class goal's celebration; then it sits there full
 * until "Time's up!" is tapped.
 */
const CHOMPS = [1.6, 1.95, 2.3, 2.65]
const FULL = 3.0
const HIC = 4.5
/** Seconds after time's up the ending is over, at most. */
export const MOUSE_ENDING = ARRIVE + HIC + 1

// The drawings, centred on 0,0. An apple can be bitten through three masks (the hole, a little
// bigger for the flesh, bigger again for the skin), so a band of pale flesh and a darker rim show
// round every bite.
const LAYERS: [string, number][] = [
  ['Void', 0],
  ['Flesh', 2.4],
  ['Skin', 7.5],
]
const SKIN_DETAIL = (clip: string) => `
  <g clip-path="url(#${clip})">
    <ellipse cx="58" cy="26" rx="44" ry="70" fill="#a8241c" opacity=".35"/>
    <path d="M -52 -40 C -60 -20, -58 6, -48 22" stroke="#fff" stroke-opacity=".55" stroke-width="9" fill="none" stroke-linecap="round"/>
    <circle cx="-40" cy="-50" r="5" fill="#fff" opacity=".55"/>
    <path d="M -10 -58 C -4 -52, 4 -52, 10 -58" stroke="#9e2219" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M -6 74 C -2 70, 2 70, 6 74" stroke="#9e2219" stroke-opacity=".45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </g>`
const STEM = `
  <path d="M0 -56 C 0 -66, 2 -76, 8 -86" stroke="#6b3f22" stroke-width="6" fill="none" stroke-linecap="round"/>
  <g transform="rotate(-24 10 -78)">
    <path d="M10 -78 C 18 -92, 40 -94, 50 -82 C 40 -72, 20 -70, 10 -78 Z" fill="#62b64a"/>
    <path d="M12 -78 C 24 -82, 36 -83, 48 -82" stroke="#3f8f33" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>`
const FLESH_DETAIL = `
  <path d="M0 -44 C 11 -30, 12 26, 0 48 C -12 26, -11 -30, 0 -44 Z" fill="#f4dc95"/>
  <path d="M0 -40 C 7 -28, 8 22, 0 42 C -8 22, -7 -28, 0 -40 Z" fill="none" stroke="#e6c46d" stroke-width="1.4"/>
  <path d="M-4 -8 c -4 4, -4 12, 0 15 c 4 -3, 4 -11, 0 -15 z" fill="#5b3420" transform="rotate(-12 -4 0)"/>
  <path d="M4 8 c -4 4, -4 12, 0 15 c 4 -3, 4 -11, 0 -15 z" fill="#5b3420" transform="rotate(10 4 15)"/>
  <path d="M-2 -6 c -1 1, -1 4, 0 5" stroke="#8a5a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <circle cx="-26" cy="-12" r="1.3" fill="#f0d590"/><circle cx="24" cy="18" r="1.3" fill="#f0d590"/>
  <circle cx="-34" cy="22" r="1.1" fill="#f0d590"/><circle cx="30" cy="-24" r="1.1" fill="#f0d590"/>`
const CHEESE = `
  <ellipse cx="4" cy="80" rx="86" ry="8" fill="${SHADOW}"/>
  <path d="M -80 6 L -56 -14 L 88 28 L 80 44 Z" fill="#ffe486"/>
  <path d="M 80 44 L 88 28 L 88 66 L 80 78 Z" fill="#eaa628"/>
  <path d="M -80 6 L 80 44 L 80 78 L -80 78 Z" fill="#ffca38"/>
  <ellipse cx="-30" cy="-2" rx="9" ry="3.6" fill="#f4bf3e"/>
  <ellipse cx="30" cy="16" rx="7" ry="3" fill="#f4bf3e"/>
  <ellipse cx="-50" cy="38" rx="11" ry="9" fill="#eaa628"/>
  <ellipse cx="-49" cy="40" rx="9" ry="7" fill="#d98f1c"/>
  <ellipse cx="-6" cy="60" rx="8" ry="7" fill="#eaa628"/>
  <ellipse cx="-5" cy="61.5" rx="6.2" ry="5.4" fill="#d98f1c"/>
  <ellipse cx="38" cy="62" rx="10" ry="8" fill="#eaa628"/>
  <ellipse cx="39" cy="63.5" rx="8" ry="6.4" fill="#d98f1c"/>
  <ellipse cx="-68" cy="66" rx="5" ry="4.4" fill="#eaa628"/>
  <ellipse cx="14" cy="38" rx="5" ry="4.2" fill="#eaa628"/>
  <path d="M -74 12 L 72 46" stroke="#fff3c0" stroke-width="3" stroke-linecap="round" opacity=".7"/>`
/** The mouse, facing left with its feet at 0,0. Chewing moves its own face: the cheek pouch, the
 *  same grey as the head, puffs out past the face's edge; nothing comes away from it. */
const MOUSE = `
  <g data-m="body">
    <path data-m="tail" d="M18 -14 C 44 -10, 58 -26, 52 -44 C 48 -56, 58 -66, 68 -60" stroke="#d29aa6" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <ellipse data-m="footB" cx="10" cy="-3" rx="11" ry="4.6" fill="#f0a3b1"/>
    <path d="M -18 -40 C -20 -64, 8 -72, 22 -58 C 34 -46, 34 -14, 20 -6 C 8 1, -14 0, -20 -12 C -24 -20, -22 -30, -18 -40 Z" fill="#a9abb8"/>
    <path d="M -15 -40 C -15 -52, -4 -55, 2 -47 C 8 -37, 6 -15, -4 -9 C -13 -6, -17 -20, -15 -40 Z" fill="#e8e5f0"/>
    <ellipse data-m="footF" cx="-12" cy="-3" rx="10" ry="4.6" fill="#f0a3b1"/>
  </g>
  <g data-m="head">
    <g><circle cx="-6" cy="-100" r="13" fill="#9c9eac"/><circle cx="-6" cy="-100" r="8" fill="#e59fae"/></g>
    <g data-m="ear"><circle cx="14" cy="-96" r="19" fill="#a9abb8"/><circle cx="14" cy="-95" r="12.5" fill="#f4b4c1"/></g>
    <path d="M 16 -78 C 16 -96, -2 -104, -16 -98 C -28 -92, -36 -84, -44 -77 C -49 -72, -47 -65, -39 -62 C -27 -57, -6 -56, 6 -60 C 13 -63, 16 -70, 16 -78 Z" fill="#a9abb8"/>
    <ellipse data-m="pouch" cx="-19" cy="-63" rx="12.5" ry="7.5" fill="#a9abb8"/>
    <rect x="-39.5" y="-66" width="4" height="5.2" rx="1.2" fill="#fff" stroke="#d6d4df" stroke-width=".8"/>
    <g data-m="cheek"><ellipse cx="-16" cy="-70" rx="7.5" ry="4.8" fill="#f39fb2" opacity=".6"/></g>
    <g data-m="eye">
      <ellipse cx="-21" cy="-82" rx="4.8" ry="6" fill="#23212c"/>
      <circle cx="-19.4" cy="-84.4" r="1.8" fill="#fff"/>
    </g>
    <path data-m="happy" d="M -26 -81 Q -21 -88, -16 -81" stroke="#23212c" stroke-width="2.6" fill="none" stroke-linecap="round" style="display:none"/>
    <g data-m="nose"><circle cx="-46" cy="-73" r="4.8" fill="#e2738c"/><circle cx="-47.4" cy="-74.6" r="1.4" fill="#fff" opacity=".75"/></g>
    <g data-m="whisk" stroke="#6e7080" stroke-width="1.1" stroke-linecap="round" opacity=".7" fill="none">
      <path d="M -38 -71 L -60 -79"/><path d="M -38 -69 L -62 -69"/><path d="M -38 -67 L -58 -59"/>
    </g>
  </g>
  <g data-m="arm">
    <path d="M -4 -46 Q -14 -42 -24 -48" stroke="#9a9cab" stroke-width="7" stroke-linecap="round" fill="none"/>
    <circle cx="-25.5" cy="-49" r="4.4" fill="#f0a3b1"/>
  </g>`

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  return e
}

function biteNode(b: Bite, layer: string, o: number) {
  const g = el('g')
  b.c.forEach(([cx, cy, r], i) => {
    g.appendChild(el('circle', { cx, cy, r: r + o }))
    for (const [x, y, rr] of b.teeth[i]) g.appendChild(el('circle', { cx: x, cy: y, r: rr + o }))
  })
  if (b.peel && layer === 'Skin') {
    const [x, y, rx, ry] = b.peel
    g.appendChild(el('ellipse', { cx: x, cy: y, rx, ry }))
  }
  return g
}

export interface MouseSceneOptions {
  /** A bite lands: the sound, if the timer has one. */
  onBite: () => void
  /** The full mouse's hiccup. */
  onHic: () => void
  /** Fewer crumbs and no rocking, for a computer set to reduce motion. */
  reduceMotion: boolean
}

export class MouseScene {
  private svg: SVGSVGElement
  private id: string
  private opts: MouseSceneOptions
  private defs: SVGDefsElement
  private applesG: SVGGElement
  private liveG: SVGGElement
  private live: SVGGElement
  private liveWob: SVGGElement
  private liveShadow: SVGEllipseElement
  private liveHoles: Record<string, SVGGElement> = {}
  private biteGroups: SVGGElement[][] = []
  private biteShown: number[] = []
  private crumbsG: SVGGElement
  private sparklesG: SVGGElement
  private mouse: SVGGElement
  private mouseShadow: SVGEllipseElement
  private floor: SVGEllipseElement
  private parts: Record<string, SVGElement> = {}
  private uses: SVGUseElement[] = []
  private cheeseUse: SVGUseElement | null = null
  /** The cheese as it is eaten: its bites, and the group that shrinks to nothing at the last chomp. */
  private cheeseHoles: SVGGElement
  private cheeseBites: SVGGElement[] = []
  private cheeseGulp: SVGGElement | null = null
  private n = 0
  private D = 0
  private min = 60
  private T: number[] = []
  private slots: Slot[] = []
  private cheese: Slot | null = null
  private liveIndex = -1
  private isBehind = false
  private last: number | null = null
  /** What each part was last given, so a part that hasn't moved isn't set again (each set restyles it). */
  private given = new WeakMap<Element, string>()

  private put(e: Element, attr: string, value: string) {
    const key = attr + '=' + value
    if (this.given.get(e) === key) return
    this.given.set(e, key)
    e.setAttribute(attr, value)
  }

  constructor(svg: SVGSVGElement, id: string, opts: MouseSceneOptions) {
    this.svg = svg
    this.id = id
    this.opts = opts
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.replaceChildren()
    this.defs = el('defs')
    this.defs.innerHTML = `
      <clipPath id="${id}clip"><path d="${APPLE}"/></clipPath>
      <radialGradient id="${id}skin" cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stop-color="#f4614f"/><stop offset="0.6" stop-color="#e2412f"/><stop offset="1" stop-color="#b92a20"/>
      </radialGradient>
      <radialGradient id="${id}flesh" cx="0.5" cy="0.5" r="0.6">
        <stop offset="0" stop-color="#fff6d6"/><stop offset="1" stop-color="#fbe7ad"/>
      </radialGradient>`
    svg.appendChild(this.defs)

    // The pieces every apple on the grid is drawn from: whole, and eaten to the core from either
    // side (the rows go back and forth, so half the cores are mirrored), and the cheese.
    const whole = el('g', { id: `${id}whole` })
    whole.innerHTML = `<ellipse cx="0" cy="80" rx="80" ry="8" fill="${SHADOW}"/><path d="${APPLE}" fill="url(#${id}skin)"/>${SKIN_DETAIL(id + 'clip')}${STEM}`
    this.defs.appendChild(whole)
    for (const [name, m] of [
      ['coreR', 1],
      ['coreL', -1],
    ] as const) {
      const holes = this.makeMasks(id + name)
      for (const [layer, o] of LAYERS) {
        holes[layer].setAttribute('transform', `scale(${m} 1)`)
        for (const b of BITES) holes[layer].appendChild(biteNode(b, layer, o))
      }
      const g = this.bitableApple(id + name)
      g.id = id + name
      g.querySelector('ellipse')!.setAttribute('rx', '30')
      this.defs.appendChild(g)
    }
    const cheese = el('g', { id: `${id}cheese` })
    cheese.innerHTML = CHEESE
    this.defs.appendChild(cheese)
    const cheeseMask = el('mask', {
      id: `${id}cheeseBite`,
      maskUnits: 'userSpaceOnUse',
      maskContentUnits: 'userSpaceOnUse',
      x: -200,
      y: -200,
      width: 400,
      height: 400,
    })
    cheeseMask.appendChild(el('rect', { x: -200, y: -200, width: 400, height: 400, fill: '#fff' }))
    this.cheeseHoles = el('g', { fill: '#000' })
    cheeseMask.appendChild(this.cheeseHoles)
    this.defs.appendChild(cheeseMask)

    this.floor = el('ellipse', { cx: 220, cy: GROUND + (H - 268) / 2 + 4, rx: 205, ry: 16, fill: 'rgba(30, 20, 60, 0.05)' })
    this.mouseShadow = el('ellipse', { fill: SHADOW })
    this.applesG = el('g')
    this.liveG = el('g')
    this.crumbsG = el('g')
    this.mouse = el('g')
    this.mouse.innerHTML = MOUSE
    this.sparklesG = el('g')
    svg.append(this.floor, this.mouseShadow, this.applesG, this.liveG, this.crumbsG, this.mouse, this.sparklesG)
    this.mouse.querySelectorAll('[data-m]').forEach((e) => {
      this.parts[e.getAttribute('data-m')!] = e as SVGElement
    })

    // The one apple being eaten.
    this.liveHoles = this.makeMasks(id + 'live')
    this.live = this.bitableApple(id + 'live')
    this.liveG.appendChild(this.live)
    this.liveWob = this.live.querySelector('[data-wob]')!
    this.liveWob.style.transformBox = 'fill-box'
    this.liveWob.style.transformOrigin = '50% 100%'
    this.liveShadow = this.live.querySelector('ellipse')!
    this.biteGroups = BITES.map((b) =>
      LAYERS.map(([layer, o]) => {
        const g = biteNode(b, layer, o)
        g.style.display = 'none'
        this.liveHoles[layer].appendChild(g)
        return g
      }),
    )
  }

  private makeMasks(prefix: string) {
    const holes: Record<string, SVGGElement> = {}
    for (const [layer] of LAYERS) {
      const m = el('mask', {
        id: prefix + layer,
        maskUnits: 'userSpaceOnUse',
        maskContentUnits: 'userSpaceOnUse',
        x: -200,
        y: -200,
        width: 400,
        height: 400,
      })
      m.appendChild(el('rect', { x: -200, y: -200, width: 400, height: 400, fill: '#fff' }))
      holes[layer] = el('g', { fill: '#000' })
      m.appendChild(holes[layer])
      this.defs.appendChild(m)
    }
    return holes
  }

  private bitableApple(prefix: string) {
    const id = this.id
    const g = el('g')
    g.innerHTML = `
      <ellipse cx="0" cy="80" rx="80" ry="8" fill="${SHADOW}"/>
      <g data-wob="">
        <g mask="url(#${prefix}Void)"><path d="${APPLE}" fill="#e8c873"/></g>
        <g mask="url(#${prefix}Flesh)"><path d="${APPLE}" fill="url(#${id}flesh)"/>${FLESH_DETAIL}</g>
        <g mask="url(#${prefix}Skin)"><path d="${APPLE}" fill="url(#${id}skin)"/>${SKIN_DETAIL(id + 'clip')}</g>
        ${STEM}
      </g>`
    return g
  }

  /** The time set, in seconds: one apple a minute. */
  setLength(seconds: number) {
    const n = Math.max(1, Math.round(seconds / 60))
    if (n === this.n && seconds === this.D) return
    this.n = n
    this.D = seconds
    this.min = seconds / n
    this.T = BITES.map((_, k) => (this.min * (k + 0.5)) / BITES.length)
    const { slots, cheese } = layout(n)
    this.slots = slots
    this.cheese = cheese
    this.applesG.replaceChildren()
    this.uses = slots.map((s) => {
      const u = el('use', { transform: `translate(${s.cx} ${s.cy}) scale(${s.sx})` })
      this.applesG.appendChild(u)
      return u
    })
    this.floor.style.display = n === 1 ? '' : 'none'
    this.cheeseUse = null
    if (cheese) {
      // A little bigger than an apple, so the prize reads at the back of the room.
      const wrap = el('g', {
        transform: `translate(${cheese.cx} ${cheese.cy + 78 * cheese.sx}) scale(${cheese.sx * 1.2}) translate(0 -78)`,
      })
      this.cheeseUse = el('use', { href: `#${this.id}cheese` })
      this.cheeseUse.style.transformBox = 'fill-box'
      this.cheeseUse.style.transformOrigin = '50% 100%'
      // Bitten from the mouse's side, three bites, then the last of it in one gulp.
      this.cheeseGulp = el('g')
      const bitten = el('g', { mask: `url(#${this.id}cheeseBite)` })
      bitten.appendChild(this.cheeseUse)
      this.cheeseGulp.appendChild(bitten)
      wrap.appendChild(this.cheeseGulp)
      this.applesG.appendChild(wrap)
      const side = cheese.m
      this.cheeseHoles.replaceChildren()
      this.cheeseBites = [0, 1, 2].map((k) => {
        const cx = side * (100 - 34 * k)
        const cy = (side > 0 ? 40 : 20) + [0, 6, -4][k]
        const r = 32
        const g = el('g')
        g.appendChild(el('circle', { cx, cy, r }))
        for (const f of [-1, -0.5, 0, 0.5, 1]) {
          const a = Math.atan2(0, -side) + f * 1.05
          g.appendChild(el('circle', { cx: cx + Math.cos(a) * r * 0.92, cy: cy + Math.sin(a) * r * 0.92, r: r * 0.22 }))
        }
        g.style.display = 'none'
        this.cheeseHoles.appendChild(g)
        return g
      })
    }
    this.liveIndex = -1
    this.last = null
    this.sparklesG.replaceChildren()
    this.crumbsG.replaceChildren()
  }

  private setLive(i: number) {
    this.liveIndex = i
    const s = this.slots[i]
    this.live.setAttribute('transform', `translate(${s.cx} ${s.cy}) scale(${s.sx})`)
    for (const [layer] of LAYERS) this.liveHoles[layer].setAttribute('transform', `scale(${s.m} 1)`)
    this.uses.forEach((u, j) => {
      u.style.display = j === i ? 'none' : ''
      u.setAttribute('href', `#${this.id}${j < i ? (this.slots[j].m === 1 ? 'coreR' : 'coreL') : 'whole'}`)
    })
    this.biteShown = BITES.map(() => -1)
  }

  private poseAt(t: number): AbsPose {
    const { n, D, min, T, slots } = this
    if (t < D) {
      const i = Math.min(n - 1, Math.floor(t / min))
      const L = t - i * min
      if (i > 0 && L < T[0] - 0.22) {
        const A = toAbs(slots[i - 1], poseLocal(min, T))
        const B = toAbs(slots[i], { ...BITES[0].pose, y: 0 })
        return travel(A, B, L, T[0] - 0.22)
      }
      return toAbs(slots[i], poseLocal(L, T))
    }
    const e = t - D
    if (!this.cheese) {
      // One apple: it straightens up beside the core, then eats that.
      const p = poseLocal(min, T)
      p.u = lerp(p.u, 0, ease(e / 0.35))
      return this.ending(toAbs(slots[0], p), e - this.endBase(), false)
    }
    // More apples: off to the cheese, then the cheese.
    const A = toAbs(slots[n - 1], poseLocal(min, T))
    const B = toAbs(this.cheese, { X: BITES[0].pose.X + 30, u: 0, dir: 1, y: 0 })
    if (e < ARRIVE) return travel(A, B, e, ARRIVE)
    return this.ending(B, e - ARRIVE, true)
  }

  /** Seconds after time's up the ending starts: once at the cheese, or straight away by a core. */
  private endBase() {
    return this.cheese ? ARRIVE : 0.35
  }

  /** The ending, `f` seconds in: a happy dance, four chomps, a full tummy patted, and a hiccup. */
  private ending(B: AbsPose, f: number, cheese: boolean): AbsPose {
    const p: AbsPose = { ...B, lunge: 0, chew: 0, walk: -1, behind: false, happy: true }
    const bump = (s0: number, len: number) => {
      const h = (f - s0) / len
      return h > 0 && h < 1 ? Math.sin(h * Math.PI) : 0
    }
    // The dance: two hops, arms up, and a spin.
    let up = bump(0, 0.4) * 16 + bump(0.45, 0.4) * 12
    const spin = ease((f - 0.9) / 0.45)
    if (spin > 0 && spin < 1) p.dir = B.dir * Math.cos(2 * Math.PI * spin)
    p.cheer = f > 0 && f < CHOMPS[0] - 0.15
    // Four fast chomps, stepping in as it goes, chewing hard all the while.
    const facing = Math.sign(B.dir)
    let stepIn = 0
    CHOMPS.forEach((ck, k) => {
      const d = f - ck
      if (d > -0.12 && d < 0.16) p.lunge = d < 0 ? ease((d + 0.12) / 0.12) : 1 - ease(d / 0.16)
      if (k < 3) stepIn += ease(d / 0.2)
    })
    p.X = B.X - facing * B.sx * (cheese ? 34 : 5) * stepIn
    const lean = ease((f - CHOMPS[0] + 0.3) / 0.25) * (1 - ease((f - FULL) / 0.25))
    p.u = lerp(B.u, cheese ? -0.15 : B.u, lean)
    const cd = f - CHOMPS[0] - 0.1
    if (cd > 0 && f < FULL + 0.5) {
      const env = Math.min(1, cd / 0.15, (FULL + 0.5 - f) / 0.3)
      p.chew = env * (0.5 - 0.5 * Math.cos(cd * 2 * Math.PI * 5))
    }
    // Full: a round tummy, patted.
    p.full = ease((f - FULL) / 0.4)
    const pd = f - FULL - 0.3
    p.pat = pd > 0 && pd < 1.2 ? 0.5 - 0.5 * Math.cos(pd * 2 * Math.PI * 2.5) : 0
    // And a hiccup.
    up += bump(HIC, 0.25) * 7
    p.G = B.ground - up * B.sx
    return p
  }

  /** How much of the prize is gone, `f` seconds into the ending: each chomp, as it lands. */
  private eatenAt(f: number) {
    return CHOMPS.map((ck) => clamp01((f - ck) / 0.12))
  }

  /** Draws the moment `t` seconds into the timer; `now` (ms) keeps the mouse breathing while paused. */
  draw(t: number, now: number) {
    if (!this.n) return
    // Only time moving forward by a little is the mouse eating; a jump (Again, a new time, the
    // timer opened from the bar) just shows where things are, with no crunch or crumbs.
    const prev = this.last
    this.last = t
    if (prev !== null && t > prev && t - prev < 1.5) this.events(prev, t)
    // Back to the start: no sparkles left over from the last time's up.
    if (prev !== null && t < prev - 0.5) this.clearEffects()

    const i = t < this.D ? Math.min(this.n - 1, Math.floor(t / this.min)) : this.n - 1
    if (i !== this.liveIndex) this.setLive(i)
    const L = t - i * this.min
    let eaten = 0
    BITES.forEach((b, k) => {
      const g = clamp01((L - this.T[k]) / 0.1)
      if (g > 0) eaten++
      if (this.biteShown[k] === g) return
      this.biteShown[k] = g
      for (const node of this.biteGroups[k]) {
        node.style.display = g > 0 ? '' : 'none'
        if (g < 1) node.setAttribute('transform', `translate(${b.cx} ${b.cy}) scale(${0.55 + 0.45 * g}) translate(${-b.cx} ${-b.cy})`)
        else node.removeAttribute('transform')
      }
    })
    this.put(this.liveShadow, 'rx', String(30 + 50 * (1 - eaten / BITES.length)))

    // The prize being eaten at the end: the cheese bitten and then gulped, or the core shrinking.
    const gone = this.eatenAt(t >= this.D ? t - this.D - this.endBase() : -1)
    if (this.cheese) {
      this.cheeseBites.forEach((g, k) => this.put(g, 'display', gone[k] > 0 ? 'inline' : 'none'))
      if (this.cheeseGulp)
        this.put(this.cheeseGulp, 'transform', `translate(0 78) scale(${(1 - ease(gone[3])).toFixed(3)}) translate(0 -78)`)
      this.put(this.liveG, 'transform', '')
    } else {
      const s0 = this.slots[0]
      const left = 1 - gone.reduce((a, b) => a + b, 0) / 4
      const ax = s0.cx
      const ay = s0.cy + 78 * s0.sx
      this.put(this.liveG, 'transform', `translate(${ax} ${ay}) scale(${left.toFixed(3)}) translate(${-ax} ${-ay})`)
    }

    const p = this.poseAt(t)
    const P = this.parts
    const r = reach(p.u)
    this.put(
      this.mouse,
      'transform',
      `translate(${p.X.toFixed(2)} ${p.G.toFixed(2)}) scale(${p.dir.toFixed(3)} 1) rotate(${deg(r.lean).toFixed(2)}) scale(${p.sc.toFixed(4)} ${(p.sc * r.stretch).toFixed(4)})`,
    )
    const ms = this.mouseShadow
    this.put(ms, 'cx', (p.X - 2 * p.dir * p.sx).toFixed(1))
    this.put(ms, 'cy', (p.ground + 2 * p.sx).toFixed(1))
    this.put(ms, 'rx', (Math.max(8, 30 - ((p.ground - p.G) / p.sx) * 0.8) * p.sx).toFixed(1))
    this.put(ms, 'ry', (6 * p.sx).toFixed(1))
    const N = NECK
    const c = p.chew
    // Chewing: the cheek pouch puffs out, the blush swells with it, the nose and whiskers twitch,
    // and the whole head squashes a touch - one face moving together.
    this.put(
      P.head,
      'transform',
      `translate(${(-9 * p.lunge).toFixed(2)} ${(2 * p.lunge).toFixed(2)}) rotate(${deg(p.u * HEAD).toFixed(2)} ${N.x} ${N.y}) translate(${N.x} ${N.y}) scale(${(1 + 0.02 * c).toFixed(4)} ${(1 - 0.035 * c).toFixed(4)}) translate(${-N.x} ${-N.y})`,
    )
    const armUp = p.cheer ? Math.sin(now / 140) * 1.5 + 3 : 0
    // Full, the paw goes down to the tummy and pats it.
    const full = p.full ?? 0
    const pat = p.pat ?? 0
    this.put(
      P.arm,
      'transform',
      `translate(${(-5 * p.lunge + 3 * full).toFixed(2)} ${(-1 * p.lunge - armUp + 0.6 * c + 10 * full + 2.5 * pat).toFixed(2)})`,
    )
    this.put(
      P.pouch,
      'transform',
      `translate(-19 -66) scale(${(0.86 + 0.34 * c).toFixed(3)} ${(0.8 + 0.42 * c).toFixed(3)}) translate(19 66)`,
    )
    this.put(P.cheek, 'transform', `translate(-16 -68) scale(${(1 + 0.3 * c).toFixed(3)}) translate(16 68)`)
    this.put(P.nose, 'transform', `translate(${(0.5 * c).toFixed(2)} ${(-1.1 * c).toFixed(2)})`)

    // Alive even while paused: breathing, the tail, a blink, an ear and the whiskers.
    const s = now / 1000
    const breathe = 1 + 0.018 * Math.sin((s * 2 * Math.PI) / 1.7)
    this.put(
      P.body,
      'transform',
      `translate(0 -30) scale(${(1 + 0.16 * full).toFixed(4)} ${(breathe * (1 + 0.05 * full)).toFixed(4)}) translate(0 30)`,
    )
    this.put(
      P.tail,
      'transform',
      `rotate(${(Math.sin(s * 1.9) * 7 + (p.walk >= 0 ? Math.sin(p.walk * Math.PI) * 10 : 0)).toFixed(2)} 18 -14)`,
    )
    const step = p.walk >= 0 ? Math.sin(p.walk * Math.PI) * 5 : 0
    this.put(P.footF, 'transform', `translate(${step.toFixed(2)} 0)`)
    this.put(P.footB, 'transform', `translate(${(-step).toFixed(2)} 0)`)
    this.put(P.eye, 'transform', `translate(0 -82) scale(1 ${s % 3.4 < 0.13 ? 0.12 : 1}) translate(0 82)`)
    const earPhase = s % 5.3
    this.put(P.ear, 'transform', earPhase < 0.25 ? `rotate(${(Math.sin((earPhase / 0.25) * Math.PI) * 10).toFixed(2)} 6 -86)` : '')
    this.put(P.whisk, 'transform', `rotate(${(Math.sin(s * 9) * (c > 0 ? 3 : 0.8)).toFixed(2)} -38 -69)`)
    P.eye.style.display = p.happy ? 'none' : ''
    P.happy.style.display = p.happy ? '' : 'none'

    // Behind the apple it is eating while it runs round the back.
    if (p.behind !== this.isBehind) {
      this.isBehind = p.behind
      this.svg.insertBefore(this.mouse, this.isBehind ? this.liveG : this.sparklesG)
    }
  }

  private events(prev: number, t: number) {
    const i0 = Math.floor(prev / this.min)
    const i1 = Math.min(this.n - 1, Math.floor(t / this.min))
    for (let i = i0; i <= i1; i++) {
      this.T.forEach((tk, k) => {
        const at = i * this.min + tk
        if (prev < at && t >= at) {
          this.opts.onBite()
          this.crumbs(i, BITES[k])
        }
      })
    }
    const base = this.D + this.endBase()
    const at = (x: number) => prev < base + x && t >= base + x
    if (at(0)) this.sparkle(t)
    CHOMPS.forEach((ck, k) => {
      if (!at(ck)) return
      this.opts.onBite()
      this.prizeCrumbs(k)
    })
    if (at(HIC)) {
      this.opts.onHic()
      this.hic(t)
    }
  }

  /** Crumbs off the cheese, or the core, at each chomp of the ending. */
  private prizeCrumbs(k: number) {
    if (this.cheese) {
      const c = this.cheese
      const k1 = c.sx * 1.2
      const ground = c.cy + 78 * c.sx
      this.burst(c.cx + c.m * k1 * (72 - 34 * k), ground - k1 * (78 - (c.m > 0 ? 40 : 22)), c.m, c.sx, ground, [
        '#ffca38',
        '#ffe486',
        '#eaa628',
      ])
    } else {
      const s0 = this.slots[0]
      this.burst(s0.cx - 14 * s0.sx, s0.cy, -1, s0.sx, s0.cy + 78 * s0.sx, ['#fff0c2', '#f6dd96', '#e2412f'])
    }
  }

  /** "hic!" floating up from the full mouse. */
  private hic(t: number) {
    const p = this.poseAt(t)
    const k = p.sc / S
    const txt = el('text', {
      x: (p.X - Math.sign(p.dir) * 30 * k).toFixed(1),
      y: (p.ground - 130 * k).toFixed(1),
      'text-anchor': 'middle',
      'font-size': Math.max(15, 34 * k).toFixed(1),
      'font-weight': '700',
      fill: '#5b3fa0',
    })
    txt.textContent = 'hic!'
    this.sparklesG.appendChild(txt)
    txt.animate(
      [
        { transform: 'translateY(0)', opacity: 0 },
        { transform: `translateY(${(-6 * k).toFixed(1)}px)`, opacity: 1, offset: 0.2 },
        { transform: `translateY(${(-18 * k).toFixed(1)}px)`, opacity: 0 },
      ],
      { duration: 1100, easing: 'ease-out' },
    ).onfinish = () => txt.remove()
  }

  /** Crumbs fly off each bite, and the apple rocks a little. */
  private crumbs(i: number, b: Bite) {
    const st = stageOf(this.slots[i])
    const x = st.tx + st.m * st.sx * b.contact[0]
    const y = st.ty + st.sx * b.contact[1]
    const side = st.m * b.side
    this.burst(x, y, side, st.sx, st.ty + st.sx * GROUND, ['#e2412f', '#fff0c2', '#f6dd96'])
    if (!this.opts.reduceMotion) {
      const a = -side * 2.2
      this.liveWob.animate([{ rotate: '0deg' }, { rotate: `${a}deg` }, { rotate: `${-a * 0.45}deg` }, { rotate: '0deg' }], {
        duration: 380,
        easing: 'ease-out',
      })
    }
  }

  /** A few crumbs from a bite at x, y, flung away from the mouse and falling to the ground. */
  private burst(x: number, y: number, side: number, k: number, ground: number, colours: string[]) {
    for (let j = 0; j < (this.opts.reduceMotion ? 3 : 8); j++) {
      const crumb = el('circle', {
        r: Math.max(0.7, (1.4 + Math.random() * 1.9) * k).toFixed(2),
        fill: j % 3 === 0 ? colours[0] : j % 2 ? colours[1] : colours[2],
        cx: x,
        cy: y,
      })
      this.crumbsG.appendChild(crumb)
      const vx = side * (12 + Math.random() * 30) * k
      const vy = -(18 + Math.random() * 26) * k
      const fall = Math.max(10 * k, ground - y - 4 * k)
      const frames: Keyframe[] = []
      for (let f = 0; f <= 8; f++) {
        const tt = f / 8
        const dy = Math.min(fall, vy * tt + 90 * k * tt * tt)
        frames.push({ transform: `translate(${(vx * tt).toFixed(1)}px, ${dy.toFixed(1)}px)`, opacity: tt < 0.75 ? 1 : 1 - (tt - 0.75) * 4 })
      }
      crumb.animate(frames, { duration: 650 + Math.random() * 250, easing: 'linear' }).onfinish = () => crumb.remove()
    }
  }

  /** A few small sparkles round the mouse at the end: small, since the class goal is the big one. */
  private sparkle(t: number) {
    const p = this.poseAt(t)
    const k = p.sc / S
    const star = 'M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z'
    const spots = [
      [-34, -138],
      [10, -150],
      [42, -120],
      [-50, -96],
      [50, -82],
      [-12, -170],
    ]
    spots.forEach(([dx, dy], i) => {
      const g = el('g', {
        transform: `translate(${(p.X + dx * Math.sign(p.dir) * 0.8 * k).toFixed(1)} ${(p.ground + dy * 0.75 * k).toFixed(1)}) scale(${Math.max(0.45, k).toFixed(3)})`,
      })
      const s = el('path', { d: star, fill: i % 2 ? '#ffd84d' : '#ffb938' })
      g.appendChild(s)
      this.sparklesG.appendChild(g)
      s.style.transformBox = 'fill-box'
      s.style.transformOrigin = 'center'
      // They pop, twinkle a moment and fade away (2026-10-21, the teacher: left on, they sat on top of the mouse).
      s.animate(
        [
          { transform: 'scale(0) rotate(0deg)', opacity: 0 },
          { transform: 'scale(1.25) rotate(40deg)', opacity: 1, offset: 0.2 },
          { transform: 'scale(1) rotate(70deg)', opacity: 1, offset: 0.55 },
          { transform: 'scale(0.6) rotate(110deg)', opacity: 0 },
        ],
        { duration: 1300, delay: i * 70, easing: 'ease-out', fill: 'backwards' },
      ).onfinish = () => g.remove()
    })
    if (this.cheeseUse && !this.opts.reduceMotion) {
      this.cheeseUse.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.12, 0.92)' }, { transform: 'scale(0.96, 1.06)' }, { transform: 'scale(1)' }],
        { duration: 520, easing: 'ease-out' },
      )
    }
  }

  /** Back to the start (Again, or a new time): no sparkles or crumbs left over. */
  clearEffects() {
    this.sparklesG.replaceChildren()
    this.crumbsG.replaceChildren()
  }
}
