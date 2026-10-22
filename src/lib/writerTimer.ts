/**
 * The timer's writing face (2026-10-22, the class: they love the mouse timer and asked for more;
 * their idea, an animal at a desk working alongside them while they work). Worked out in a
 * preview ("Writing Mouse Timer", a Claude artifact) over several rounds with the teacher.
 *
 * The mouse sits behind its desk at home doing homework, facing the class, and writes a page a
 * minute: the blank pages on the desk are the minutes left, which a child can count, and each
 * finished page is held up and sent to hang on a line above. The page lies turned to the mouse,
 * so it writes left to right as it sees it. Now and then, one or two to a minute and never the
 * same pattern twice running, a small moment: it stops to think (pencil at its chin, a cloud of
 * dots), has an idea (a light bulb), sharpens its pencil (the shavings land on the desk, and it
 * notices and wipes them away), or rubs out the end of a line and writes it again. The pencil
 * wears down a little a page and more at each sharpen; too short to hold, the mouse looks at the
 * stub, puzzled, and takes a new one from its pencil case. At time's up it puts the pencil down,
 * throws both arms up and says "Done!". It makes no sound while it works.
 *
 * As the mouse face does, everything is drawn from the time into the timer (`timerElapsed`),
 * never from what happened before, so a pause, a reload or a timer opened from the bar halfway
 * shows exactly where it is; the minute's story comes from a seed, the same every time. Built
 * once into an SVG and changed by setting attributes, not through React.
 */

const NS = 'http://www.w3.org/2000/svg'
const W = 440
const H = 440

interface Pt {
  x: number
  y: number
}
type Kind = 'think' | 'aha' | 'sharpen' | 'tidy' | 'erase' | 'newpencil'
interface Moment {
  kind: Kind
  at: number
  dur: number
}
interface Plan {
  index: number
  events: Moment[]
  rate: number
  widths: number[]
  seed: number
  /** How long the pencil is at the start of this minute, and at its end (1 is new). */
  prevEnd: number
  startWear: number
  endWear: number
}
type Act = Kind | 'take' | 'write' | 'hang' | 'end'
interface State {
  written: number
  act: Act
  f: number
  P: Plan
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, f: number) => a + (b - a) * f
const rot = (p: Pt, a: number): Pt => {
  const r = (a * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
const mix = (a: Pt, b: Pt, f: number): Pt => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) })
const f1 = (n: number) => n.toFixed(1)
function rng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/* The scene's places, in a 440 x 440 face. */
const LINE_Y = 30
const LINE_X0 = 24
const LINE_X1 = 416
const SAG = 16
/** Its shoulders: its right (our left) and its left. */
const SR = { x: 185, y: 272 }
const SL = { x: 255, y: 272 }
/** Where its paws rest: its right beside the page, its left holding the page's edge. */
const REST_R = { x: 168, y: 314 }
const REST_L = { x: 274, y: 314 }
/** The page's corners: back is nearer the mouse. */
const PG = { bl: { x: 183, y: 290 }, br: { x: 257, y: 290 }, fl: { x: 175, y: 331 }, fr: { x: 265, y: 331 } }
/** A point on the page as the mouse reads it: mu across from its left, mv down from its top (the front edge). */
const pagePt = (mu: number, mv: number) => mix(mix(PG.fr, PG.fl, mu), mix(PG.br, PG.bl, mu), mv)
const LINES = 5
const lineV = (i: number) => (i + 0.9) / (LINES + 0.5)
const PILE = { x: 340, y: 324 }

/* One minute's story: take a page (TAKE seconds), write it with a moment or two, hang it up from HANG_AT. */
const TAKE = 1.5
const HANG_AT = 58.2
const PATTERNS: Moment[][] = [
  [
    { kind: 'think', at: 20, dur: 4.5 },
    { kind: 'aha', at: 24.5, dur: 2.4 },
    { kind: 'sharpen', at: 44, dur: 4.4 },
    { kind: 'tidy', at: 48.4, dur: 2.8 },
  ],
  [
    { kind: 'erase', at: 17, dur: 3.6 },
    { kind: 'think', at: 39, dur: 4.6 },
  ],
  [
    { kind: 'sharpen', at: 14, dur: 4.4 },
    { kind: 'tidy', at: 18.4, dur: 2.8 },
    { kind: 'think', at: 36, dur: 4.2 },
    { kind: 'aha', at: 40.2, dur: 2.4 },
  ],
  [{ kind: 'erase', at: 29, dur: 3.6 }],
  [
    { kind: 'think', at: 12, dur: 4.4 },
    { kind: 'erase', at: 41, dur: 3.6 },
  ],
]
/** Of a line, rubbed out and written again. */
const ERASED = 0.4
/** The pencil wears down a little a page and more at each sharpen; under STUB it is too short to hold. */
const PAGE_WEAR = 0.07
const SHARPEN_WEAR = 0.24
const STUB = 0.3
/** When, in the new-pencil moment, the stub is in the case and the new pencil comes out. */
const SWAP = 0.6

/** After time's up, how long the ending moves (the pencil down, the arms up, the hops). */
export const WRITER_ENDING = 3

const plans: Plan[] = []
function plan(k: number): Plan {
  if (plans[k]) return plans[k]
  const r = rng(k + 7)
  let p = Math.floor(r() * PATTERNS.length)
  if (k > 0 && plan(k - 1).index === p) p = (p + 1 + Math.floor(r() * (PATTERNS.length - 1))) % PATTERNS.length
  const prevEnd = k > 0 ? plan(k - 1).endWear : 1
  // A minute that starts with a stub starts with a new pencil.
  const renew = k > 0 && prevEnd < STUB
  const events: Moment[] = renew ? [{ kind: 'newpencil', at: TAKE, dur: 5 }, ...PATTERNS[p]] : PATTERNS[p]
  const startWear = renew ? 1 : prevEnd
  const endWear = startWear - PAGE_WEAR - SHARPEN_WEAR * events.filter((e) => e.kind === 'sharpen').length
  const busy = events.reduce((n, e) => n + e.dur, 0)
  const erases = events.filter((e) => e.kind === 'erase').length
  const rate = (LINES + erases * ERASED) / (HANG_AT - TAKE - busy)
  const widths = Array.from({ length: LINES }, (_, i) => (i === LINES - 1 ? 0.45 + r() * 0.2 : 0.8 + r() * 0.18))
  return (plans[k] = { index: p, events, rate, widths, seed: k * 13 + 3, prevEnd, startWear, endWear })
}

/** How long the pencil is at s seconds into a minute. */
function wearAt(P: Plan, s: number) {
  const np = P.events.find((e) => e.kind === 'newpencil')
  if (np && s < np.at + np.dur * SWAP) return P.prevEnd
  let w = P.startWear - PAGE_WEAR * clamp01((s - TAKE) / (HANG_AT - TAKE))
  for (const e of P.events) if (e.kind === 'sharpen') w -= SHARPEN_WEAR * clamp01((s - e.at - e.dur * 0.22) / (e.dur * 0.56))
  return w
}

/** What the mouse is doing s seconds into minute k, and how many lines it has written. */
function minuteState(k: number, s: number): State {
  const P = plan(k)
  if (s < TAKE) return { written: 0, act: 'take', f: s / TAKE, P }
  if (s >= HANG_AT) return { written: LINES, act: 'hang', f: (s - HANG_AT) / (60 - HANG_AT), P }
  let tt = TAKE
  let written = 0
  for (const e of P.events) {
    if (s < e.at) return { written: written + (s - tt) * P.rate, act: 'write', f: 0, P }
    written += (e.at - tt) * P.rate
    const f = (s - e.at) / e.dur
    if (f < 1) {
      if (e.kind === 'erase') return { written: written - ERASED * clamp01((f - 0.2) / 0.65), act: 'erase', f, P }
      return { written, act: e.kind, f, P }
    }
    if (e.kind === 'erase') written -= ERASED
    tt = e.at + e.dur
  }
  return { written: Math.min(LINES, written + (s - tt) * P.rate), act: 'write', f: 0, P }
}

/** The pencil at a length (1 new), its point at 0,0 and drawn upwards: the painted part wears away. */
function pencilMarkup(L: number) {
  const b = Math.max(3, 31.5 * L)
  const top = 9.5 + b
  return `
  <path d="M0 0 L -3.6 -9.5 L 3.6 -9.5 Z" fill="#f2d3a6"/>
  <path d="M0 0 L -1.4 -3.6 L 1.4 -3.6 Z" fill="#3a3550"/>
  <rect x="-3.6" y="${-top}" width="7.2" height="${b}" fill="#ffc531"/>
  <rect x="-1.1" y="${-top}" width="2.2" height="${b}" fill="#f2a917"/>
  <rect x="-3.8" y="${-(top + 4.5)}" width="7.6" height="4.8" fill="#c9cbd6"/>
  <path d="M -3.6 ${-(top + 4.5)} L -3.6 ${-(top + 8)} Q 0 ${-(top + 11.5)} 3.6 ${-(top + 8)} L 3.6 ${-(top + 4.5)} Z" fill="#f48aa0"/>`
}
const pencilLen = (L: number) => Math.max(3, 31.5 * L) + 19.5

const GREY = '#a9abb8'
const ARM = '#9a9cab'
const PINK = '#f0a3b1'
const INK = '#6d4fd6'

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent: Element,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  parent.appendChild(e)
  return e
}

interface Word {
  path: SVGPathElement
  len: number
  start: Pt
  end: Pt
}
type Part = { word: Word; len: number } | { from: Pt; to: Pt; len: number }

export interface WriterSceneOptions {
  /** No sparkles, crumbs or hops, for a computer set to reduce motion. */
  reduceMotion: boolean
}

export class WriterScene {
  private reduce: boolean
  private hung: SVGGElement
  private body: SVGGElement
  private tail: SVGPathElement
  private head: SVGGElement
  private earL: SVGGElement
  private earR: SVGGElement
  private face: SVGGElement
  private eyes: SVGGElement
  private eyeOpen: SVGGElement
  private eyeHappy: SVGPathElement
  private eyeShut: SVGPathElement
  private brows: SVGPathElement
  private mouthW: SVGPathElement
  private mouthO: SVGEllipseElement
  private mouthBig: SVGPathElement
  private caseOpen: SVGEllipseElement
  private pile: SVGGElement
  private page: SVGGElement
  private inkG: SVGGElement
  private newSheet: SVGPathElement
  private dropped: SVGGElement
  private shavings: SVGGElement[] = []
  private flyer: SVGUseElement
  private pencil: SVGGElement
  private sharpener: SVGGElement
  private armL: SVGPathElement
  private pawL: SVGCircleElement
  private armR: SVGPathElement
  private pawR: SVGCircleElement
  private thought: SVGGElement
  private dots: SVGCircleElement[] = []
  private query: SVGTextElement
  private bulb: SVGGElement
  private rays: SVGGElement
  private fx: SVGGElement
  private done: SVGGElement
  private pageRef: string
  private length = 600
  private last: number | null = null
  private pileN: number | null = null
  private hungN: number | null = null
  private penL = -1
  private inkFor = -1
  private lines: { parts: Part[]; total: number }[] = []
  /** What each part was last given, so a part that hasn't moved isn't set again (each set restyles it). */
  private given = new WeakMap<Element, Record<string, string>>()

  private put(e: Element, attr: string, value: string) {
    let g = this.given.get(e)
    if (!g) this.given.set(e, (g = {}))
    if (g[attr] === value) return
    g[attr] = value
    e.setAttribute(attr, value)
  }
  private show(e: SVGElement, on: boolean) {
    this.put(e, 'display', on ? 'inline' : 'none')
  }

  constructor(svg: SVGSVGElement, id: string, opts: WriterSceneOptions) {
    this.reduce = opts.reduceMotion
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.replaceChildren()
    const defs = el('defs', {}, svg)
    // A finished page, as it hangs on the line.
    this.pageRef = `#${id}page`
    const pg = el('g', { transform: 'scale(1.45)' }, el('g', { id: `${id}page` }, defs))
    el('rect', { x: -14, y: 0, width: 28, height: 36, rx: 2, fill: '#fffdf6', stroke: '#d9d3c4', 'stroke-width': 1 }, pg)
    for (let i = 0; i < 5; i++)
      el(
        'path',
        {
          d: `M -9 ${8 + i * 5.6} q 3 -2 4.5 0 t 4.5 0 t 4.5 0 ${i < 4 ? 't 4.5 0' : ''}`,
          stroke: '#7d78a8',
          'stroke-width': 1.1,
          fill: 'none',
          'stroke-linecap': 'round',
        },
        pg,
      )
    el('rect', { x: -3, y: -4, width: 6, height: 8, rx: 1.5, fill: '#e6a64b' }, pg)

    // The floor and the washing line.
    el('rect', { x: 0, y: 404, width: W, height: 36, fill: 'rgba(120,100,180,.07)' }, svg)
    el(
      'path',
      { d: `M ${LINE_X0} ${LINE_Y} Q 220 ${LINE_Y + SAG * 2} ${LINE_X1} ${LINE_Y}`, stroke: '#b9a993', 'stroke-width': 2, fill: 'none' },
      svg,
    )
    el('circle', { cx: LINE_X0, cy: LINE_Y, r: 4, fill: '#a58f74' }, svg)
    el('circle', { cx: LINE_X1, cy: LINE_Y, r: 4, fill: '#a58f74' }, svg)
    this.hung = el('g', {}, svg)

    // The mouse behind its desk, facing the class: tail, body, head.
    this.body = el('g', {}, svg)
    this.tail = el(
      'path',
      {
        d: 'M 262 300 C 312 304, 334 268, 316 246 C 306 234, 318 222, 330 230',
        stroke: '#d29aa6',
        'stroke-width': 4.5,
        fill: 'none',
        'stroke-linecap': 'round',
      },
      this.body,
    )
    el('ellipse', { cx: 220, cy: 300, rx: 52, ry: 54, fill: GREY }, this.body)
    el('ellipse', { cx: 220, cy: 308, rx: 32, ry: 42, fill: '#e8e5f0' }, this.body)

    this.head = el('g', {}, svg)
    this.earL = el('g', {}, this.head)
    el('circle', { cx: 166, cy: 150, r: 33, fill: GREY }, this.earL)
    el('circle', { cx: 168, cy: 152, r: 22, fill: '#f4b4c1' }, this.earL)
    this.earR = el('g', {}, this.head)
    el('circle', { cx: 274, cy: 150, r: 33, fill: GREY }, this.earR)
    el('circle', { cx: 272, cy: 152, r: 22, fill: '#f4b4c1' }, this.earR)
    el(
      'path',
      {
        d: 'M 220 146 C 258 146, 278 172, 278 200 C 278 230, 252 248, 220 248 C 188 248, 162 230, 162 200 C 162 172, 182 146, 220 146 Z',
        fill: GREY,
      },
      this.head,
    )
    this.face = el('g', {}, this.head)
    el('ellipse', { cx: 220, cy: 220, rx: 28, ry: 19, fill: '#c3c4cf' }, this.face)
    el('ellipse', { cx: 184, cy: 214, rx: 9, ry: 6, fill: '#f39fb2', opacity: 0.6 }, this.face)
    el('ellipse', { cx: 256, cy: 214, rx: 9, ry: 6, fill: '#f39fb2', opacity: 0.6 }, this.face)
    this.eyes = el('g', {}, this.face)
    this.eyeOpen = el('g', {}, this.eyes)
    for (const x of [200, 240]) {
      el('ellipse', { cx: x, cy: 192, rx: 6.2, ry: 8, fill: '#23212c' }, this.eyeOpen)
      el('circle', { cx: x + 2, cy: 188.6, r: 2.3, fill: '#fff' }, this.eyeOpen)
    }
    const stroke = { stroke: '#23212c', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }
    this.eyeHappy = el('path', { d: 'M 193 193 Q 200 184, 207 193 M 233 193 Q 240 184, 247 193', ...stroke }, this.face)
    this.eyeShut = el('path', { d: 'M 193 192 L 207 192 M 233 192 L 247 192', ...stroke }, this.face)
    this.brows = el(
      'path',
      {
        d: 'M 192 176 Q 199 172, 206 175 M 234 172 Q 241 168, 248 172',
        stroke: '#6e7080',
        'stroke-width': 2.4,
        fill: 'none',
        'stroke-linecap': 'round',
      },
      this.face,
    )
    el('ellipse', { cx: 220, cy: 211, rx: 7.5, ry: 5.8, fill: '#e2738c' }, this.face)
    el('circle', { cx: 217.6, cy: 209.2, r: 1.8, fill: '#fff', opacity: 0.75 }, this.face)
    this.mouthW = el('path', { d: 'M 211 220 Q 215.5 226, 220 220 Q 224.5 226, 229 220', ...stroke, 'stroke-width': 2 }, this.face)
    this.mouthO = el('ellipse', { cx: 220, cy: 225, rx: 4.5, ry: 5.5, fill: '#8a3550' }, this.face)
    this.mouthBig = el(
      'path',
      { d: 'M 208 220 Q 220 238, 232 220 Z', fill: '#8a3550', stroke: '#23212c', 'stroke-width': 1.6, 'stroke-linejoin': 'round' },
      this.face,
    )
    const wh = el('g', { stroke: '#6e7080', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.7, fill: 'none' }, this.face)
    for (const [y1, y2] of [
      [214, 206],
      [218, 218],
      [222, 230],
    ]) {
      el('path', { d: `M 204 ${y1} L 176 ${y2}` }, wh)
      el('path', { d: `M 236 ${y1} L 264 ${y2}` }, wh)
    }

    // The desk.
    el('rect', { x: 52, y: 350, width: 13, height: 56, rx: 3, fill: '#a96f3a' }, svg)
    el('rect', { x: 375, y: 350, width: 13, height: 56, rx: 3, fill: '#a96f3a' }, svg)
    el('path', { d: 'M 64 284 L 376 284 L 398 338 L 42 338 Z', fill: '#e2a866' }, svg)
    el('path', { d: 'M 72 290 L 368 290', stroke: '#eebd83', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg)
    el('path', { d: 'M 42 338 L 398 338 L 398 354 L 42 354 Z', fill: '#c98a4e' }, svg)

    // At home doing homework: three books and a pencil case on the desk.
    const book = (x: number, y: number, w: number, h: number, c: string) => {
      el('path', { d: `M ${x} ${y} L ${x + w} ${y} L ${x + w - 4} ${y - h} L ${x + 4} ${y - h} Z`, fill: c }, svg)
      el('rect', { x, y, width: w, height: 7, rx: 1.5, fill: c }, svg)
      el('rect', { x: x + 3, y: y + 1.6, width: w - 6, height: 3.8, rx: 1, fill: '#fbf6e8' }, svg)
    }
    el('ellipse', { cx: 110, cy: 314, rx: 42, ry: 5, fill: 'rgba(120,70,20,.18)' }, svg)
    book(72, 303, 76, 10, '#3f7fd9')
    book(76, 292, 68, 9, '#e8585a')
    book(80, 282, 60, 9, '#3fae7a')
    el('ellipse', { cx: 118, cy: 334, rx: 38, ry: 4, fill: 'rgba(120,70,20,.18)' }, svg)
    el('rect', { x: 80, y: 316, width: 76, height: 18, rx: 9, fill: '#9b6fe0' }, svg)
    el('path', { d: 'M 88 320 L 148 320', stroke: '#7a4fc4', 'stroke-width': 2, 'stroke-dasharray': '3 2' }, svg)
    el('circle', { cx: 150, cy: 320, r: 3, fill: '#ffd34d' }, svg)
    this.caseOpen = el('ellipse', { cx: 118, cy: 319, rx: 27, ry: 3.4, fill: '#4b2a86', display: 'none' }, svg)
    el('path', { d: 'M 150 322 L 154 330', stroke: '#ffd34d', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg)

    // The blank pile, the page being written and a new sheet sliding over: all on the desk, behind the backpack.
    this.pile = el('g', {}, svg)
    this.page = el('g', {}, svg)
    el(
      'path',
      {
        d: `M ${PG.bl.x} ${PG.bl.y} L ${PG.br.x} ${PG.br.y} L ${PG.fr.x} ${PG.fr.y} L ${PG.fl.x} ${PG.fl.y} Z`,
        fill: '#fff',
        stroke: '#b5a98f',
        'stroke-width': 1.2,
      },
      this.page,
    )
    for (let i = 0; i < LINES; i++) {
      const a = pagePt(0.06, lineV(i))
      const b = pagePt(0.94, lineV(i))
      el('path', { d: `M ${f1(a.x)} ${f1(a.y)} L ${f1(b.x)} ${f1(b.y)}`, stroke: '#cfe0f3', 'stroke-width': 0.9 }, this.page)
    }
    this.inkG = el(
      'g',
      { stroke: '#5d5794', 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      this.page,
    )
    this.newSheet = el('path', { display: 'none', fill: '#fff', stroke: '#b5a98f', 'stroke-width': 1.2 }, svg)
    this.dropped = el('g', { display: 'none' }, svg)
    for (let i = 0; i < 8; i++) {
      const g = el('g', { display: 'none' }, svg)
      el('path', { d: 'M -4 0 q 4 -4.5 8 0 q -4 5 -8 0', fill: '#f2d3a6', stroke: '#d9893a', 'stroke-width': 1.1 }, g)
      this.shavings.push(g)
    }

    // The backpack on the floor in front of the desk, half unzipped: a ruler, a book and a sheet of paper peeking out.
    const bp = el('g', {}, svg)
    el('ellipse', { cx: 334, cy: 411, rx: 44, ry: 5.5, fill: 'rgba(60,40,90,.16)' }, bp)
    el('rect', { x: 314, y: 312, width: 9, height: 44, rx: 2, fill: '#ffcf33', transform: 'rotate(-16 318 356)' }, bp)
    for (let i = 0; i < 6; i++)
      el('path', { d: `M 316 ${318 + i * 6} l 4 0`, stroke: '#b38a10', 'stroke-width': 1.2, transform: 'rotate(-16 318 356)' }, bp)
    el(
      'rect',
      {
        x: 326,
        y: 318,
        width: 24,
        height: 34,
        rx: 2,
        fill: '#fff',
        stroke: '#b5a98f',
        'stroke-width': 1.2,
        transform: 'rotate(6 338 352)',
      },
      bp,
    )
    el(
      'path',
      {
        d: 'M 331 326 l 14 1.5 M 330.5 332 l 14 1.5 M 330 338 l 11 1.2',
        stroke: '#9b96bf',
        'stroke-width': 1.2,
        'stroke-linecap': 'round',
      },
      bp,
    )
    el('rect', { x: 340, y: 322, width: 20, height: 32, rx: 2, fill: '#e8585a', transform: 'rotate(18 350 354)' }, bp)
    el('rect', { x: 343, y: 324, width: 4, height: 28, fill: '#c23f42', transform: 'rotate(18 350 354)' }, bp)
    el('path', { d: 'M 322 344 Q 334 326 346 344', stroke: '#1d6f73', 'stroke-width': 4.5, fill: 'none', 'stroke-linecap': 'round' }, bp)
    el(
      'path',
      {
        d: 'M 298 408 L 298 372 Q 298 340 334 340 Q 370 340 370 372 L 370 408 Q 370 412 366 412 L 302 412 Q 298 412 298 408 Z',
        fill: '#2fa3a8',
      },
      bp,
    )
    el('path', { d: 'M 306 356 Q 312 346 324 344', stroke: '#5cc2c6', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, bp)
    el('path', { d: 'M 314 349 Q 334 341 356 349 Q 334 353 314 349 Z', fill: '#134e51' }, bp)
    const zip = { stroke: '#e9e2c7', 'stroke-width': 1.6, 'stroke-dasharray': '2.5 2', fill: 'none' }
    el('path', { d: 'M 303 360 Q 306 349 314 349 M 356 349 Q 364 352 366 362', ...zip }, bp)
    el('circle', { cx: 357, cy: 351, r: 2.6, fill: '#ffd34d' }, bp)
    el('path', { d: 'M 357 353 l 1.5 7', stroke: '#ffd34d', 'stroke-width': 2, 'stroke-linecap': 'round' }, bp)
    el('path', { d: 'M 301 366 Q 296 388 302 410', stroke: '#1d7f84', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, bp)
    el('path', { d: 'M 367 366 Q 372 388 366 410', stroke: '#1d7f84', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, bp)
    el('rect', { x: 310, y: 378, width: 48, height: 28, rx: 9, fill: '#26898d' }, bp)
    el('path', { d: 'M 315 384 L 353 384', ...zip }, bp)
    el('circle', { cx: 334, cy: 384, r: 2.6, fill: '#ffd34d' }, bp)
    el('path', { d: 'M 334 386 l 0 6', stroke: '#ffd34d', 'stroke-width': 2, 'stroke-linecap': 'round' }, bp)

    // What the paws hold, then the arms over everything on the desk.
    this.flyer = el('use', { href: this.pageRef, display: 'none' }, svg)
    this.pencil = el('g', {}, svg)
    this.sharpener = el('g', { display: 'none' }, svg)
    el('rect', { x: -7, y: -6, width: 14, height: 12, rx: 3, fill: '#4f8ef0' }, this.sharpener)
    el('rect', { x: -7, y: -2, width: 14, height: 3, fill: '#2f6fd0' }, this.sharpener)
    const arm = () => el('path', { stroke: ARM, 'stroke-width': 13, 'stroke-linecap': 'round', fill: 'none' }, svg)
    this.armL = arm()
    this.pawL = el('circle', { r: 8, fill: PINK }, svg)
    this.armR = arm()
    this.pawR = el('circle', { r: 8, fill: PINK }, svg)

    // A thought, a puzzle, an idea.
    this.thought = el('g', { display: 'none', transform: 'translate(312 162)' }, svg)
    const cloud = { fill: '#fff', stroke: '#cfc8e8', 'stroke-width': 1.5 }
    el('circle', { cx: 0, cy: 0, r: 4, ...cloud }, this.thought)
    el('circle', { cx: 10, cy: -12, r: 6, ...cloud }, this.thought)
    el('ellipse', { cx: 40, cy: -38, rx: 32, ry: 21, ...cloud }, this.thought)
    for (let i = 0; i < 3; i++) this.dots.push(el('circle', { cx: 27 + i * 13, cy: -38, r: 3.8, fill: '#8f88b8' }, this.thought))
    this.query = el(
      'text',
      { 'text-anchor': 'middle', 'font-family': 'Andika, sans-serif', 'font-weight': 700, 'font-size': 40, fill: INK, display: 'none' },
      svg,
    )
    this.query.textContent = '?'
    this.bulb = el('g', { display: 'none' }, svg)
    this.rays = el('g', { stroke: '#ffcf33', 'stroke-width': 3, 'stroke-linecap': 'round' }, this.bulb)
    for (let i = 0; i < 7; i++) {
      const a = -90 + (i - 3) * 30
      const p1 = rot({ x: 20, y: 0 }, a)
      const p2 = rot({ x: 28, y: 0 }, a)
      el('path', { d: `M ${f1(p1.x)} ${f1(p1.y)} L ${f1(p2.x)} ${f1(p2.y)}` }, this.rays)
    }
    el('circle', { cx: 0, cy: 0, r: 13, fill: '#ffe066' }, this.bulb)
    el('circle', { cx: -4, cy: -4.5, r: 3.6, fill: '#fff8c9' }, this.bulb)
    el('rect', { x: -6, y: 11, width: 12, height: 8, rx: 2, fill: '#b8bccb' }, this.bulb)

    this.fx = el('g', {}, svg)
    this.done = el('g', { display: 'none' }, svg)
    el(
      'path',
      {
        d: 'M -46 -26 H 46 A 14 14 0 0 1 60 -12 V 10 A 14 14 0 0 1 46 24 H -12 L -30 40 L -26 24 H -46 A 14 14 0 0 1 -60 10 V -12 A 14 14 0 0 1 -46 -26 Z',
        fill: '#fff',
        stroke: INK,
        'stroke-width': 3,
      },
      this.done,
    )
    const tx = el(
      'text',
      { x: 0, y: 9, 'text-anchor': 'middle', 'font-family': 'Andika, sans-serif', 'font-weight': 700, 'font-size': 28, fill: INK },
      this.done,
    )
    tx.textContent = 'Done!'
  }

  /** The time set, in seconds: a page a minute. */
  setLength(seconds: number) {
    this.length = seconds
    this.pileN = this.hungN = null
  }

  /** Back to the start: no crumbs or sparkles left over. */
  clearEffects() {
    this.fx.replaceChildren()
  }

  /** Eraser crumbs: they fly up a little and fade by themselves. */
  private crumbs(p: Pt) {
    if (this.reduce) return
    for (let i = 0; i < 3; i++) {
      const g = el('g', {}, this.fx)
      el('circle', { r: 1.5 + Math.random() * 1.1, fill: '#f6b7c4' }, g)
      const dx = (Math.random() - 0.5) * 20
      const dy = -6 - Math.random() * 6
      g.animate(
        [
          { transform: `translate(${p.x}px, ${p.y}px)`, opacity: 1 },
          { transform: `translate(${p.x + dx}px, ${p.y + dy}px)`, opacity: 0 },
        ],
        { duration: 600, easing: 'ease-out', fill: 'forwards' },
      ).onfinish = () => g.remove()
    }
  }

  /** A small star that pops and fades away again (left on, the "Done!" sparkles sat on the mouse). */
  private sparkle(p: Pt, delay: number) {
    if (this.reduce) return
    const g = el('g', { opacity: 0 }, this.fx)
    el('path', { d: 'M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z', fill: '#ffcf33' }, g)
    g.animate(
      [
        { transform: `translate(${p.x}px,${p.y}px) scale(.2)`, opacity: 0 },
        { transform: `translate(${p.x}px,${p.y - 6}px) scale(1.2)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${p.x}px,${p.y - 14}px) scale(.9)`, opacity: 0 },
      ],
      { duration: 1300, delay, fill: 'backwards' },
    ).onfinish = () => g.remove()
  }

  /** The page's handwriting for minute k: a path a word, measured, so the pencil's point is always where the ink is. */
  private buildInk(k: number) {
    if (this.inkFor === k) return
    this.inkFor = k
    this.inkG.replaceChildren()
    const P = plan(k)
    const r = rng(P.seed)
    this.lines = []
    for (let i = 0; i < LINES; i++) {
      const v = lineV(i)
      const end = 0.08 + P.widths[i] * 0.84
      const words: Word[] = []
      let u = 0.08
      while (u < end - 0.04) {
        const stop = Math.min(end, u + 0.1 + r() * 0.14)
        const a = pagePt(u, v)
        let d = `M ${f1(a.x)} ${f1(a.y)}`
        while (u < stop) {
          const step = 0.02 + r() * 0.014
          const h = 0.035 + r() * 0.06
          // Letters rise towards the top of the page as the mouse reads it: towards the class.
          const top = pagePt(u + step / 2, v - h)
          const next = pagePt(u + step, v)
          d += ` Q ${f1(top.x)} ${f1(top.y)} ${f1(next.x)} ${f1(next.y)}`
          u += step
        }
        const path = el('path', { d, display: 'none' }, this.inkG)
        words.push({ path, len: path.getTotalLength(), start: a, end: pagePt(u, v) })
        u += 0.05
      }
      let total = 0
      const parts: Part[] = []
      words.forEach((w, j) => {
        if (j > 0) {
          const from = words[j - 1].end
          const len = Math.hypot(w.start.x - from.x, w.start.y - from.y)
          parts.push({ from, to: w.start, len })
          total += len
        }
        parts.push({ word: w, len: w.len })
        total += w.len
      })
      this.lines.push({ parts, total })
    }
  }

  /** The ink up to `written` lines; the pencil's point there, and how far it is lifted between words. */
  private inkTo(written: number): { tip: Pt; lift: number } {
    let tip: Pt | null = null
    let lift = 0
    this.lines.forEach((line, i) => {
      let left = clamp01(written - i) * line.total
      const writing = written >= i && written < i + 1
      for (const p of line.parts) {
        if ('word' in p) {
          const shown = Math.min(p.len, Math.max(0, left))
          const path = p.word.path
          this.show(path, shown > 0.05)
          if (shown > 0.05) this.put(path, 'stroke-dasharray', `${shown.toFixed(1)} ${(p.len + 2).toFixed(1)}`)
          if (writing && left >= 0 && left <= p.len) {
            const q = path.getPointAtLength(shown)
            tip = { x: q.x, y: q.y }
          }
        } else if (writing && left >= 0 && left <= p.len) {
          const f = left / p.len
          tip = mix(p.from, p.to, f)
          lift = Math.sin(f * Math.PI) * 5
        }
        left -= p.len
      }
    })
    if (!tip) {
      // Between lines, or finished: the end of the last line written.
      const i = Math.max(0, Math.min(LINES - 1, Math.ceil(written) - 1))
      const parts = this.lines[i].parts
      const last = (parts[parts.length - 1] as { word: Word }).word
      const first = (this.lines[0].parts[0] as { word: Word }).word
      const q = written <= 0 ? first.start : last.path.getPointAtLength(last.len)
      tip = { x: q.x, y: q.y }
      lift = written <= 0 || written >= LINES ? 6 : 0
    }
    return { tip, lift }
  }

  /** Draw the moment t seconds into the timer; `now` (ms) only moves the breathing, blinks and wiggles. */
  draw(t: number, now: number) {
    const T = this.length
    const pages = Math.max(1, Math.round(T / 60))
    const ended = t >= T
    const k = ended ? pages - 1 : Math.min(pages - 1, Math.floor(t / 60))
    const s = ended ? 60 : t - k * 60
    const st: State = ended ? { written: LINES, act: 'end', f: 0, P: plan(k) } : minuteState(k, s)
    const end = ended ? t - T : -1
    const prev = this.last
    this.last = t
    // Things that happen once (crumbs, sparkles) only as time runs forward, never on a jump.
    const forward = prev != null && t > prev && t - prev < 1.5
    if (prev != null && t < prev) this.clearEffects()

    // The blank pile: the minutes after this one, spread out while few enough to count.
    const left = ended ? 0 : pages - k - 1 + (st.act === 'take' && st.f < 0.15 ? 1 : 0)
    if (this.pileN !== left) {
      this.pileN = left
      this.pile.replaceChildren()
      const gap = left <= 10 ? 5 : Math.max(0.8, 48 / left)
      if (left) el('ellipse', { cx: PILE.x, cy: PILE.y + 4, rx: 38, ry: 4.5, fill: 'rgba(120,70,20,.22)' }, this.pile)
      for (let i = 0; i < left; i++) {
        const y = PILE.y - i * gap
        el(
          'path',
          {
            d: `M ${PILE.x - 32} ${y} L ${PILE.x + 32} ${y} L ${PILE.x + 27} ${y - 26} L ${PILE.x - 27} ${y - 26} Z`,
            fill: '#fff',
            stroke: '#a3977d',
            'stroke-width': 1.2,
          },
          this.pile,
        )
        el(
          'path',
          {
            d: `M ${PILE.x - 32} ${y} L ${PILE.x + 32} ${y} L ${PILE.x + 32} ${y + 2.2} L ${PILE.x - 32} ${y + 2.2} Z`,
            fill: '#d6cbb2',
            stroke: '#a3977d',
            'stroke-width': 0.8,
          },
          this.pile,
        )
      }
    }

    // The washing line: the pages already hung, spread along it.
    const spotAt = (i: number): Pt => {
      const span = LINE_X1 - LINE_X0 - 40
      const x = LINE_X0 + 20 + (pages === 1 ? span / 2 : (span * i) / (pages - 1))
      const tt = (x - LINE_X0) / (LINE_X1 - LINE_X0)
      return { x, y: LINE_Y + 2 * (1 - tt) * tt * SAG * 2 - 2 }
    }
    const hungN = ended ? pages : k
    if (this.hungN !== hungN) {
      this.hungN = hungN
      this.hung.replaceChildren()
      for (let i = 0; i < hungN; i++) {
        const p = spotAt(i)
        el('use', { href: this.pageRef, transform: `translate(${f1(p.x)} ${f1(p.y)}) rotate(${((i * 37) % 7) - 3})` }, this.hung)
      }
    }

    /* What the mouse does. */
    this.buildInk(k)
    const ink = this.inkTo(st.written)
    let tip: Pt | null = { x: ink.tip.x, y: ink.tip.y - ink.lift }
    let angle = -16 + (st.act === 'write' ? Math.sin(now / 160) * 2.5 : 0)
    const wear = ended ? st.P.endWear : wearAt(st.P, s)
    const L = Math.round(Math.max(0.06, wear) * 40) / 40
    if (this.penL !== L) {
      this.penL = L
      this.pencil.innerHTML = this.dropped.innerHTML = pencilMarkup(L)
    }
    const penLen = pencilLen(L)
    let hold = Math.min(19, penLen - 6)
    let flip = false
    let pawL = REST_L
    let pawR: Pt | null = null
    let look = { x: (tip.x - 220) / 18, y: 3.2 }
    let tilt = (220 - tip.x) / 14
    let bob = 3
    let face: 'open' | 'wide' | 'happy' = 'open'
    let mouth: 'w' | 'o' | 'smile' | 'big' = 'w'
    let brows = false
    let hop = 0
    let earOut = 0
    let pageShown = true
    let pageDx = 0
    let pencilShown = true
    let armsUp = 0
    let thought = false
    let query = false
    let bulb = false
    let sharpener = false
    let caseOpen = false
    let flyer = false
    let dropped: string | null = null
    let done = false

    if (st.act === 'take') {
      // A new sheet slides over from the pile; its left paw pulls it the last bit of the way.
      const f = ease(st.f)
      pageDx = (1 - f) * (PILE.x - 220)
      pawL = { x: Math.min(268 + pageDx, 300), y: 306 }
      tip = { x: tip.x, y: tip.y - 6 }
      look = { x: lerp(3, 0, f), y: 2.5 }
      tilt = 0
    } else if (st.act === 'hang') {
      // The pencil put down, the page picked up in both paws and shown off, then sent up to the line.
      const f = st.f
      const lifted = ease(f / 0.35)
      const away = ease((f - 0.4) / 0.6)
      pageShown = false
      pencilShown = false
      dropped = 'translate(198 320) rotate(-100)'
      const held = { x: 220, y: lerp(312, 266, lifted) }
      const p = mix(held, spotAt(k), away)
      flyer = true
      this.put(
        this.flyer,
        'transform',
        `translate(${f1(p.x)} ${f1(p.y - 18 * (1 - away) - Math.sin(away * Math.PI) * 30)}) rotate(${f1(Math.sin(away * Math.PI) * -16)}) scale(${f1(lerp(1.03, 1, away))})`,
      )
      const hands = away > 0 ? 1 - ease((f - 0.4) / 0.25) : 1
      pawL = mix(REST_L, { x: held.x + 24, y: held.y + 8 }, hands * lifted)
      pawR = mix(REST_R, { x: held.x - 24, y: held.y + 8 }, hands * lifted)
      tip = null
      look = { x: 0, y: lerp(3, -2, lifted) }
      tilt = 0
      bob = 0
      mouth = lifted > 0.5 ? 'smile' : 'w'
      face = lifted > 0.5 ? 'happy' : 'open'
    } else if (st.act === 'think') {
      // The pencil's eraser to its chin, eyes up, a cloud of dots.
      const f = st.f
      const on = ease(f / 0.15) - ease((f - 0.85) / 0.15)
      tip = mix(tip, { x: 199, y: 290 }, on)
      angle = lerp(angle, 24, on)
      hold = lerp(hold, 40, on)
      look = mix(look, { x: 3, y: -4 }, on)
      tilt = lerp(tilt, -7, on) + Math.sin(now / 520) * 2 * on
      bob = lerp(3, 0, on)
      brows = f > 0.12 && f < 0.88
      if (f > 0.12 && f < 0.9) {
        thought = true
        const g = (f - 0.12) / 0.78
        this.dots.forEach((d, i) => this.put(d, 'opacity', g > 0.15 + i * 0.22 ? '1' : '0.15'))
        this.put(this.thought, 'opacity', f1(Math.min(1, (f - 0.12) * 12, (0.9 - f) * 12)))
      }
    } else if (st.act === 'aha') {
      // An idea: eyes wide, ears up, a hop, a light bulb, and straight back to writing.
      const f = st.f
      const up = Math.sin((Math.min(1, f / 0.2) * Math.PI) / 2) * (1 - ease((f - 0.8) / 0.2))
      tip = { x: tip.x, y: tip.y - 12 * up }
      look = { x: 0, y: -1.5 }
      tilt = 0
      bob = 0
      face = 'wide'
      mouth = f < 0.7 ? 'o' : 'smile'
      hop = this.reduce ? 0 : Math.sin(Math.min(1, f / 0.3) * Math.PI) * 6
      earOut = up
      if (f < 0.92) {
        bulb = true
        const pop = f < 0.15 ? ease(f / 0.15) * 1.15 : f < 0.25 ? lerp(1.15, 1, (f - 0.15) / 0.1) : 1
        this.put(this.bulb, 'transform', `translate(220 ${f1(108 - hop)}) scale(${f1(pop * 0.9)})`)
        this.put(this.bulb, 'opacity', f1(Math.min(1, (0.92 - f) * 8)))
        this.put(this.rays, 'opacity', f1(0.55 + 0.45 * Math.sin(now / 90)))
      }
    } else if (st.act === 'sharpen') {
      // The pencil held up, point upwards, and the sharpener twisted round it in the other paw.
      const f = st.f
      const on = ease(f / 0.18) - ease((f - 0.82) / 0.18)
      const twist = f > 0.2 && f < 0.8 ? Math.sin(f * 70) : 0
      tip = mix(tip, { x: 214, y: 254 }, on)
      angle = lerp(angle, 180, on) + twist * 4 * on
      hold = lerp(hold, 30, on)
      look = mix(look, { x: -0.6, y: 4.5 }, on)
      tilt = lerp(tilt, 0, on)
      bob = lerp(3, 4, on)
      if (on > 0.6) {
        sharpener = true
        const sp = { x: tip.x, y: tip.y - 3 }
        this.put(this.sharpener, 'transform', `translate(${f1(sp.x)} ${f1(sp.y)}) rotate(${f1(twist * 28)})`)
        pawL = { x: sp.x + 12, y: sp.y + 1 }
      } else pawL = mix(REST_L, { x: tip.x + 12, y: tip.y - 2 }, on)
    } else if (st.act === 'tidy') {
      // It notices the shavings ("oh!"), wipes them off the desk with its paw, and smiles.
      const f = st.f
      const sweep = ease(clamp01((f - 0.3) / 0.45))
      const reach = ease(f / 0.3) - ease((f - 0.75) / 0.25)
      pawL =
        f < 0.3
          ? mix(REST_L, { x: 222, y: 310 }, ease(f / 0.3))
          : f < 0.75
            ? { x: lerp(222, 300, sweep), y: 312 + Math.sin(sweep * Math.PI) * 2 }
            : mix({ x: 300, y: 312 }, REST_L, ease((f - 0.75) / 0.25))
      look = { x: f > 0.3 ? (pawL.x - 220) / 16 : 1, y: 4.5 }
      tilt = -reach * 4
      mouth = f < 0.3 ? 'o' : f > 0.75 ? 'smile' : 'w'
    } else if (st.act === 'newpencil') {
      // Too short to write with: it looks at the stub, puzzled, puts it in the pencil case and takes out a new one.
      const f = st.f
      const write = tip
      const looking = { x: 150, y: 236 }
      const inCase = { x: 128, y: 318 }
      const stubHold = penLen - 2 // pinched at its very end, so the stub shows
      let paw: Pt | null = null
      if (f < 0.14) tip = { x: write.x + Math.sin(now / 45) * 2, y: write.y }
      else if (f < 0.46) {
        const g = ease((f - 0.14) / 0.1)
        paw = mix(add(write, rot({ x: 0, y: -hold }, angle)), looking, g)
        angle = lerp(angle, 180, g) + Math.sin(now / 260) * 8
        hold = lerp(hold, stubHold, g)
        look = { x: -5, y: 1.5 }
        tilt = 4 + Math.sin(now / 420) * 7
        brows = true
        mouth = 'o'
        if (f > 0.2) {
          query = true
          this.put(this.query, 'transform', `translate(222 ${f1(122 - Math.sin(now / 300) * 3)}) scale(${f1(Math.min(1, (f - 0.2) * 12))})`)
        }
      } else if (f < SWAP) {
        const g = ease((f - 0.46) / (SWAP - 0.46 - 0.02))
        paw = mix(looking, inCase, g)
        angle = lerp(180, 200, g)
        hold = stubHold
        look = { x: -4, y: 4.5 }
        tilt = 5
        caseOpen = f > 0.52
        pencilShown = f < SWAP - 0.03
      } else if (f < 0.8) {
        const out = ease((f - SWAP) / (0.8 - SWAP))
        paw = mix(inCase, { x: 200, y: 268 }, out)
        angle = lerp(200, 180, out)
        look = { x: -2, y: 2 }
        tilt = 0
        mouth = out > 0.5 ? 'smile' : 'w'
        caseOpen = f < 0.7
      } else {
        const back = ease((f - 0.8) / 0.2)
        paw = mix({ x: 200, y: 268 }, add(write, rot({ x: 0, y: -hold }, -16)), back)
        angle = lerp(180, -16, back)
        mouth = 'smile'
      }
      if (paw) tip = add(paw, rot({ x: 0, y: hold }, angle))
    } else if (st.act === 'erase') {
      // Turned over, the eraser rubbing out the end of the line, crumbs, then turned back.
      const f = st.f
      const on = ease(f / 0.2) - ease((f - 0.85) / 0.15)
      const rub = f > 0.2 && f < 0.85 ? Math.sin(now / 55) * 4 : 0
      const at = ink.tip
      const E = { x: at.x - 4 + rub, y: at.y + 1 }
      const a = lerp(angle, 165, on)
      const endV = rot({ x: 0, y: -penLen }, a)
      tip = mix(at, { x: E.x - endV.x, y: E.y - endV.y }, on)
      angle = a
      flip = on > 0.5
      look = { x: (E.x - 220) / 18, y: 4 }
      tilt = (220 - E.x) / 14
      if (forward && prev != null && f > 0.22 && f < 0.85 && Math.floor(prev * 6) !== Math.floor(t * 6)) this.crumbs(E)
    } else if (st.act === 'end') {
      // Time's up: the pencil down, both arms up, "Done!".
      pageShown = false
      pencilShown = false
      const down = ease(end / 0.5)
      armsUp = ease((end - 0.5) / 0.5)
      dropped = `translate(${f1(lerp(214, 236, down))} ${f1(lerp(312, 326, down))}) rotate(${f1(lerp(-16, -100, down))})`
      face = end > 0.6 ? 'happy' : 'open'
      mouth = end > 0.6 ? 'big' : 'w'
      look = { x: 0, y: 0 }
      tilt = Math.sin(now / 600) * 3 * armsUp
      bob = 0
      hop = !this.reduce && end > 1 && end < 2.6 ? Math.abs(Math.sin(((end - 1) * Math.PI * 2) / 0.8)) * 9 : 0
      if (end > 0.75) {
        done = true
        const pop = end < 1 ? ease((end - 0.75) / 0.25) * 1.15 : end < 1.15 ? lerp(1.15, 1, (end - 1) / 0.15) : 1
        this.put(this.done, 'transform', `translate(356 ${f1(112 - hop)}) scale(${f1(pop)}) rotate(${f1(Math.sin(now / 600) * 2)})`)
      }
      if (forward && prev != null && prev < T + 0.9 && t >= T + 0.9)
        for (let i = 0; i < 6; i++) this.sparkle({ x: 130 + i * 36, y: 120 + (i % 2) * 26 }, i * 130)
      pawR = mix(REST_R, { x: 150 + Math.sin(now / 260) * 4, y: 176 - hop }, armsUp)
      pawL = mix(REST_L, { x: 290 + Math.cos(now / 260) * 4, y: 176 - hop }, armsUp)
    }

    this.show(this.thought, thought)
    this.show(this.query, query)
    this.show(this.bulb, bulb)
    this.show(this.sharpener, sharpener)
    this.show(this.caseOpen, caseOpen)
    this.show(this.flyer, flyer)
    this.show(this.done, done)
    this.show(this.dropped, dropped != null)
    if (dropped) this.put(this.dropped, 'transform', dropped)

    // Shavings: from each twist they drop onto the desk and stay there until the paw sweeps them off.
    const sh = ended ? undefined : st.P.events.find((e) => e.kind === 'sharpen')
    const td = ended ? undefined : st.P.events.find((e) => e.kind === 'tidy')
    const sr = rng(st.P.seed + 5)
    this.shavings.forEach((g, j) => {
      const land = { x: 226 + sr() * 30, y: 298 + sr() * 18 }
      const spin = sr() * 300
      const te = sh ? sh.at + sh.dur * 0.22 + j / 3 : 0
      if (!sh || s < te || te > sh.at + sh.dur * 0.8 || (td && s >= td.at + td.dur)) {
        this.show(g, false)
        return
      }
      const p = clamp01((s - te) / 0.8)
      let x = lerp(216, land.x, p)
      const y = lerp(258, land.y, p * p)
      let op = 1
      if (td && s >= td.at) {
        const pawX = lerp(222, 300, ease(clamp01(((s - td.at) / td.dur - 0.3) / 0.45)))
        if (pawX + 8 > x) x = pawX + 8 + (land.y - 306) * 0.3
        if (x > 286) op = clamp01(1 - (x - 286) / 18)
      }
      this.show(g, op > 0)
      this.put(g, 'opacity', f1(op))
      this.put(g, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(spin * p)})`)
    })

    // The page on the desk, or a new sheet sliding over to where it goes.
    this.show(this.page, pageShown && st.act !== 'take')
    this.show(this.newSheet, st.act === 'take')
    if (st.act === 'take')
      this.put(
        this.newSheet,
        'd',
        `M ${f1(PG.bl.x + pageDx)} ${PG.bl.y} L ${f1(PG.br.x + pageDx)} ${PG.br.y} L ${f1(PG.fr.x + pageDx)} ${PG.fr.y} L ${f1(PG.fl.x + pageDx)} ${PG.fl.y} Z`,
      )

    // The mouse itself: breathing, a blink now and then, the tail swaying with a slow swish every few seconds.
    const breathe = this.reduce ? 0 : Math.sin(now / 700) * 1.2
    const blink = face === 'open' && now % 4100 < 140
    const swish = (now % 7300) / 1600
    const tail = this.reduce
      ? 0
      : Math.sin(now / 900) * 4 + (swish < 1 ? Math.sin(swish * Math.PI * 2) * 16 * Math.sin(swish * Math.PI) : 0)
    this.put(this.body, 'transform', `translate(0 ${f1(-hop - breathe * 0.4)})`)
    this.put(this.tail, 'transform', `rotate(${f1(tail)} 262 300)`)
    this.put(this.head, 'transform', `translate(0 ${f1(bob - hop - breathe * 0.6)}) rotate(${f1(tilt)} 220 246)`)
    this.put(this.face, 'transform', `translate(${f1(look.x * 0.6)} ${f1(look.y * 0.4)})`)
    this.put(
      this.eyes,
      'transform',
      `translate(${f1(look.x * 0.5)} ${f1(look.y * 0.5)})` +
        (face === 'wide' ? ' translate(220 192) scale(1.22) translate(-220 -192)' : ''),
    )
    this.put(this.earL, 'transform', `rotate(${f1(-10 * earOut)} 190 175)`)
    this.put(this.earR, 'transform', `rotate(${f1(10 * earOut)} 250 175)`)
    this.show(this.eyeOpen, face !== 'happy' && !blink)
    this.show(this.eyeShut, blink)
    this.show(this.eyeHappy, face === 'happy')
    this.show(this.brows, brows)
    this.show(this.mouthW, mouth === 'w')
    this.show(this.mouthO, mouth === 'o')
    this.show(this.mouthBig, mouth === 'big' || mouth === 'smile')
    this.put(this.mouthBig, 'transform', mouth === 'smile' ? 'translate(220 220) scale(.7 .55) translate(-220 -220)' : '')

    // The pencil, and the paw that holds it.
    const lift = { x: 0, y: -hop - breathe * 0.4 }
    if (!pawR) pawR = tip ? add(tip, rot({ x: 0, y: -(flip ? penLen - 18 : hold) }, angle)) : REST_R
    this.show(this.pencil, pencilShown && tip != null)
    if (tip) this.put(this.pencil, 'transform', `translate(${f1(tip.x)} ${f1(tip.y)}) rotate(${f1(angle)})`)
    this.arm(this.armR, this.pawR, add(SR, lift), pawR, -1)
    this.arm(this.armL, this.pawL, add(SL, lift), pawL, 1)
  }

  /** A soft arm: one curve from the shoulder to the paw, bowing outwards more the nearer the paw is
   *  (an elbow folding), so it never looks like a stick or stretches. */
  private arm(path: SVGPathElement, paw: SVGCircleElement, S: Pt, P: Pt, side: number) {
    const d = Math.hypot(P.x - S.x, P.y - S.y) || 1
    const n = { x: -(P.y - S.y) / d, y: (P.x - S.x) / d }
    const sign = n.x * side > 0 ? 1 : -1
    const bend = Math.max(8, (96 - d) * 0.42)
    const c = { x: (S.x + P.x) / 2 + n.x * bend * sign, y: (S.y + P.y) / 2 + n.y * bend * sign + 4 }
    this.put(path, 'd', `M ${f1(S.x)} ${f1(S.y)} Q ${f1(c.x)} ${f1(c.y)} ${f1(P.x)} ${f1(P.y)}`)
    this.put(paw, 'cx', f1(P.x))
    this.put(paw, 'cy', f1(P.y))
  }
}
