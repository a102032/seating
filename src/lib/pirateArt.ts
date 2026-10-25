import { assetUrl } from './assets'
import { PIRATE_PIECES } from './quest'

/**
 * The Pirate Quest's pictures (DECISIONS, "The Pirate Quest"), drawn as SVG text from the teacher's
 * Flaticon pirate pack (public/quest/pirate) and shapes drawn here: the islands, the puzzle of the
 * island the class is sailing to, the clouds over islands not reached yet, and the sea chart. Only
 * works things out and builds strings; components/PirateMap moves them.
 */

const art = (name: string) => assetUrl(`/quest/pirate/${name}.svg`)
export const pirateArtUrl = art

export const SEA = {
  sea: '#4fa9d9',
  shallow: '#a9ddf2',
  shallow2: '#7fc6e8',
  sand: '#f6d58e',
  sandEdge: '#e9bf6a',
  grass: '#7dc243',
  grassDark: '#5ea832',
  sailed: '#1d4e7a',
}

/* ---------- seeded shapes ---------- */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}
const f = (n: number) => n.toFixed(1)

/** A rounded blob: radii wobble a little round the circle, smoothed into curves. */
export function blob(cx: number, cy: number, r: number, seed: number, squash = 0.78): string {
  const R = rng(seed)
  const n = 11
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 0.82 + R() * 0.32
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash])
  }
  let d = ''
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n],
      p3 = pts[(i + 2) % n]
    if (i === 0) d += `M${f(p1[0])} ${f(p1[1])}`
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

export function im(name: string, x: number, y: number, size: number, extra = ''): string {
  return `<image href="${art(name)}" x="${f(x - size / 2)}" y="${f(y - size / 2)}" width="${f(size)}" height="${f(size)}" ${extra}/>`
}
const circle = (x: number, y: number, r: number, fill: string) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"/>`

/* ---------- the five islands ---------- */
type Land = [name: string, dx: number, dy: number, size: number]
export interface IslandArt {
  name: string
  /** The chest dug up there: the pack has three closed chests, so the last two are the gold one, glowing. */
  chest: string
  glow: number
  size: number
  squash: number
  hill?: boolean
  volcano?: boolean
  land: Land[]
}

/** Each island its own place (2026-10-25, the teacher: the islands were too sparse and too alike). */
export const ISLANDS: IslandArt[] = [
  {
    name: 'Palm Beach',
    chest: 'treasure-chest-2',
    glow: 0,
    size: 0.9,
    squash: 0.74,
    land: [
      ['palm-tree_coconuts', -0.32, -0.52, 0.85],
      ['grass', 0.24, -0.3, 0.34],
      ['pirate-hat', -0.52, 0.2, 0.32],
      ['barrel', 0.6, -0.04, 0.3],
    ],
  },
  {
    name: 'Lookout Hill',
    chest: 'treasure-chest-1',
    glow: 0,
    size: 0.95,
    squash: 0.7,
    hill: true,
    land: [
      ['telescope', -0.08, -0.86, 0.44],
      ['palm-tree_coconuts', -0.64, -0.3, 0.55],
      ['grass', 0.5, -0.26, 0.34],
      ['crab', 0.6, 0.3, 0.28],
    ],
  },
  {
    name: 'Cave Island',
    chest: 'treasure-chest',
    glow: 0,
    size: 1,
    squash: 0.82,
    land: [
      ['granite', -0.52, -0.42, 0.62],
      ['cave', 0.14, -0.5, 0.8],
      ['stone-1', 0.62, -0.16, 0.32],
      ['sign-post', -0.44, 0.12, 0.36],
      ['fish-bone', 0.56, 0.36, 0.26],
    ],
  },
  {
    name: 'Waterfall Island',
    chest: 'treasure-chest',
    glow: 1,
    size: 1.05,
    squash: 0.76,
    land: [
      ['waterfall', -0.15, -0.66, 0.98],
      ['palm-tree_coconuts', 0.52, -0.45, 0.68],
      ['grass', -0.62, -0.12, 0.4],
      ['steering-wheel', 0.58, 0.3, 0.3],
    ],
  },
  {
    name: 'Volcano Island',
    chest: 'treasure-chest',
    glow: 2,
    size: 1.15,
    squash: 0.8,
    volcano: true,
    land: [
      ['volcano-1', 0, -0.62, 1.2],
      ['two_palm-trees', -0.64, -0.2, 0.58],
      ['stone', 0.62, -0.1, 0.34],
    ],
  },
]

/** Where the treasure is: on the sand at the island's front. */
export const xSpot = (cx: number, cy: number, r: number): [number, number] => [cx + r * 0.05, cy + r * 0.5]

/** X marks the spot: small and black, drawn only once the island's puzzle is whole. */
export function markX(x: number, y: number, r: number, cls = 'pirate-x'): string {
  const a = r * 0.085
  return `<g class="${cls}" stroke="#2a2a2a" stroke-width="${f(Math.max(2.5, r * 0.045))}" stroke-linecap="round"><path d="M${f(x - a)} ${f(y - a * 0.8)} L${f(x + a)} ${f(y + a * 0.8)} M${f(x + a)} ${f(y - a * 0.8)} L${f(x - a)} ${f(y + a * 0.8)}"/></g>`
}

/** An opened chest: the lid gone and the treasure on top, as on the Knight's chests. */
export function openChest(i: number, x: number, y: number, size: number): string {
  const isl = ISLANDS[i]
  let s = ''
  if (isl.glow) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(size * (0.55 + isl.glow * 0.12))}" fill="#ffe27a" opacity=".55"/>`
  s += `<image href="${art(isl.chest)}" x="${f(x - size / 2)}" y="${f(y - size / 2)}" width="${f(size)}" height="${f(size)}" style="clip-path:inset(46% 0 0 0)"/>`
  s += im('coins', x, y - size * 0.02, size * 0.62)
  if (isl.glow > 1)
    s += im('coins', x - size * 0.45, y + size * 0.3, size * 0.4) + im('key-1', x + size * 0.5, y + size * 0.25, size * 0.38)
  return s
}

export function islandArt(i: number, cx: number, cy: number, r: number, { opened = false, mark = false, smoke = true } = {}): string {
  const isl = ISLANDS[i]
  const sq = isl.squash
  const sd = 11 + i * 17
  let s = `<path d="${blob(cx, cy, r * 1.34, sd, sq)}" fill="${SEA.shallow2}" opacity=".55"/>`
  s += `<path d="${blob(cx, cy, r * 1.16, sd, sq)}" fill="${SEA.shallow}"/>`
  s += `<path d="${blob(cx, cy, r, sd, sq)}" fill="${SEA.sand}" stroke="${SEA.sandEdge}" stroke-width="${f(Math.max(1.5, r * 0.02))}"/>`
  s += `<path d="${blob(cx - r * 0.08, cy - r * 0.12, r * 0.66, sd + 5, sq)}" fill="${SEA.grass}"/>`
  if (isl.hill) s += `<path d="${blob(cx - r * 0.08, cy - r * 0.42, r * 0.42, sd + 13, 0.72)}" fill="${SEA.grassDark}"/>`
  else s += `<path d="${blob(cx - r * 0.18, cy - r * 0.2, r * 0.34, sd + 9, sq)}" fill="${SEA.grassDark}" opacity=".5"/>`
  isl.land.forEach(([name, dx, dy, sz]) => (s += im(name, cx + dx * r, cy + dy * r, r * sz)))
  // The volcano smokes gently, in CSS, which the graphics chip runs.
  if (isl.volcano && smoke) {
    for (let n = 0; n < 3; n++)
      s += `<circle class="pirate-smoke" style="animation-delay:${n * 1.2}s" cx="${f(cx + r * 0.02)}" cy="${f(cy - r * 1.12)}" r="${f(r * 0.1)}" fill="#eef1f4"/>`
  }
  const [xx, xy] = xSpot(cx, cy, r)
  if (opened) s += openChest(i, xx, xy - r * 0.1, r * 0.55)
  else if (mark) s += markX(xx, xy, r)
  return s
}

/* ---------- the puzzle: the island the class is sailing to, in pieces that fit together ---------- */

/** Every picture of a puzzle is drawn at one size, so a piece on the meter is the same shape as its gap. */
export const PW = 300
export const PH = 220
/** The island's size in the puzzle's picture. */
export const PR = 78
const ROWS: Record<number, number[]> = { 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3] }
const seedOf = (island: number) => island * 31 + 5

/** One edge from a to b: flat, or with the classic jigsaw knob bulging to one side (sign), k across. */
function edge(a: number[], b: number[], sign: number, k: number): string {
  const L = (x: number, y: number) => `L${f(x)} ${f(y)}`
  if (!sign) return L(b[0], b[1])
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    ux = dx / len,
    uy = dy / len
  const nx = -uy * sign,
    ny = ux * sign
  const mx = (a[0] + b[0]) / 2,
    my = (a[1] + b[1]) / 2
  const P = (t: number, v: number) => `${f(mx + ux * t * k + nx * v * k)} ${f(my + uy * t * k + ny * v * k)}`
  return (
    `L${P(-0.45, 0)} C${P(-0.22, 0)} ${P(-0.12, 0.1)} ${P(-0.2, 0.25)} C${P(-0.32, 0.46)} ${P(-0.28, 0.72)} ${P(0, 0.72)} ` +
    `C${P(0.28, 0.72)} ${P(0.32, 0.46)} ${P(0.2, 0.25)} C${P(0.12, 0.1)} ${P(0.22, 0)} ${P(0.45, 0)} ` +
    L(b[0], b[1])
  )
}

export interface Piece {
  d: string
  /** The piece's own part of the picture, without its knobs: where its patch of cloud sits on the map. */
  cell: [number, number, number, number]
  /** The piece with room for its knobs, to draw one alone. */
  box: [number, number, number, number]
}

const jigCache = new Map<string, Piece[]>()
/** An island's puzzle, the same every time: its pieces in reading order, top left first. */
export function jigsaw(island: number, w = PW, h = PH): Piece[] {
  const n = PIRATE_PIECES[island]
  const key = `${island}:${w}:${h}`
  const hit = jigCache.get(key)
  if (hit) return hit
  const R = rng(seedOf(island) + 7)
  const rows = ROWS[n]
  const rh = h / rows.length
  const flip = () => (R() < 0.5 ? 1 : -1)
  const cells: { r: number; j: number; x0: number; x1: number; y0: number; y1: number }[] = []
  rows.forEach((c, r) => {
    for (let j = 0; j < c; j++) cells.push({ r, j, x0: (j * w) / c, x1: ((j + 1) * w) / c, y0: r * rh, y1: (r + 1) * rh })
  })
  // The edges between pieces side by side, and the seam between rows, cut wherever either row is cut.
  const vert = new Map<string, { sign: number; k: number }>()
  cells.forEach((c) => {
    if (c.j < rows[c.r] - 1) vert.set(`${c.r}:${c.j}`, { sign: flip(), k: Math.min(rh, c.x1 - c.x0) * 0.42 })
  })
  const seams: { x0: number; x1: number; sign: number; k: number }[][] = []
  for (let r = 0; r < rows.length - 1; r++) {
    const cuts = [rows[r], rows[r + 1]].flatMap((c) => Array.from({ length: c - 1 }, (_, j) => +(((j + 1) * w) / c).toFixed(3)))
    const xs = [...new Set([0, w, ...cuts])].sort((p, q) => p - q)
    const segs = []
    for (let i = 0; i < xs.length - 1; i++) {
      const L = xs[i + 1] - xs[i]
      segs.push({ x0: xs[i], x1: xs[i + 1], sign: L > w * 0.22 ? flip() : 0, k: Math.min(L, rh) * 0.42 })
    }
    seams.push(segs)
  }
  const within = (c: (typeof cells)[number]) => (g: { x0: number; x1: number }) => g.x0 >= c.x0 - 0.01 && g.x1 <= c.x1 + 0.01
  const pieces = cells.map((c): Piece => {
    let d = `M${f(c.x0)} ${f(c.y0)}`
    if (c.r === 0) d += edge([c.x0, c.y0], [c.x1, c.y0], 0, 0)
    else seams[c.r - 1].filter(within(c)).forEach((g) => (d += edge([g.x0, c.y0], [g.x1, c.y0], g.sign, g.k)))
    const v = vert.get(`${c.r}:${c.j}`)
    d += v ? edge([c.x1, c.y0], [c.x1, c.y1], v.sign, v.k) : edge([], [c.x1, c.y1], 0, 0)
    if (c.r === rows.length - 1) d += edge([], [c.x0, c.y1], 0, 0)
    else
      seams[c.r]
        .filter(within(c))
        .reverse()
        .forEach((g) => (d += edge([g.x1, c.y1], [g.x0, c.y1], -g.sign, g.k)))
    const lv = vert.get(`${c.r}:${c.j - 1}`)
    if (lv) d += edge([c.x0, c.y1], [c.x0, c.y0], -lv.sign, lv.k)
    const m = Math.min(rh, c.x1 - c.x0) * 0.34
    return { d: d + 'Z', cell: [c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0], box: [c.x0 - m, c.y0 - m, c.x1 - c.x0 + 2 * m, c.y1 - c.y0 + 2 * m] }
  })
  jigCache.set(key, pieces)
  return pieces
}

/** The puzzle's picture: the island as it is drawn on the map, on its patch of sea. */
function islandPicture(i: number, w: number, h: number): string {
  const k = w / PW
  const R = rng(i * 7 + 3)
  let waves = ''
  for (let n = 0; n < 9; n++) {
    const x = R() * w,
      y = R() * h
    if (Math.hypot(x - w / 2, (y - h * 0.55) * 1.4) < PR * k * 1.5) continue
    waves += `<path d="M${f(x)} ${f(y)} q ${6 * k} ${-5 * k} ${12 * k} 0 t ${12 * k} 0" fill="none" stroke="#ffffffaa" stroke-width="${2 * k}" stroke-linecap="round"/>`
  }
  return `<rect width="${w}" height="${h}" fill="${SEA.sea}"/>${waves}${islandArt(i, w / 2, h * 0.55, PR * k, { smoke: false })}`
}

let puzzleCount = 0
/**
 * An island's puzzle: the pieces found in their places, the rest dashed gaps. `only` draws one
 * piece alone, cropped to it; `lift` draws that piece hovering over its gap; `mark` puts the X on
 * a whole one.
 */
export function puzzleSVG(island: number, found: number, { only = -1, lift = -1, mark = false, light = false } = {}): string {
  const pieces = jigsaw(island)
  const id = `pz${++puzzleCount}`
  const sw = Math.max(1, Math.min(PW, PH) * 0.012)
  const gap = light ? '#ffffffcc' : '#8a6a43'
  let defs = '',
    body = '',
    top = ''
  pieces.forEach((pc, i) => {
    if (only >= 0 && i !== only) return
    defs += `<clipPath id="${id}c${i}"><path d="${pc.d}"/></clipPath>`
    const pic = `<g clip-path="url(#${id}c${i})">${islandPicture(island, PW, PH)}</g><path d="${pc.d}" fill="none" stroke="#a9834f" stroke-width="${sw}" stroke-linejoin="round"/>`
    if (i === lift) {
      body += `<path data-gap="" d="${pc.d}" fill="#ffffff40" stroke="${gap}" stroke-width="${sw * 1.4}" stroke-dasharray="${sw * 4} ${sw * 3}"/>`
      top = `<g class="pirate-hover"><g data-lift="" style="transform-box:fill-box;transform-origin:center;transform:translate(${f(PW * 0.04)}px,-${f(PH * 0.05)}px) rotate(4deg) scale(1.04);filter:drop-shadow(0 10px 8px rgba(0,0,0,.45))">${pic}</g></g>`
    } else if (only >= 0 || i < found) body += pic
    else body += `<path d="${pc.d}" fill="#ffffff40" stroke="${gap}" stroke-width="${sw * 1.2}" stroke-dasharray="${sw * 4} ${sw * 3}"/>`
  })
  if (mark && only < 0) body += markX(...xSpot(PW / 2, PH * 0.55, PR), PR)
  const vb = only >= 0 ? pieces[only].box : [-4, -4, PW + 8, PH + 8]
  return `<svg viewBox="${vb.map(f).join(' ')}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"><defs>${defs}</defs>${body}${top}</svg>`
}
/** The X drawn onto the puzzle as its last piece clicks in. */
export const puzzleX = () => markX(...xSpot(PW / 2, PH * 0.55, PR), PR, 'pirate-x pirate-x-pop')

/* ---------- the sea chart ---------- */

/**
 * The chart is much wider than the screen: home, then the five islands far apart (2026-10-25, the
 * teacher: the islands were too close together, and seeing the map revealed as they go is part of
 * the fun). The view shows two at a time and glides on as the ship sails.
 */
export const STEP = 0.52
export const PAD = 0.24
export interface Stop {
  x: number
  y: number
  r: number
  base: number
}
/** Home, then the islands, on a chart for a view w by h. */
export function chart(w: number, h: number): Stop[] {
  const base = Math.min(w * 0.1, h * 0.25)
  const ys = [0.6, 0.5, 0.6, 0.46, 0.6, 0.5]
  return ys.map((y, j) => ({ x: (PAD + j * STEP) * w, y: y * h, r: j ? base * ISLANDS[j - 1].size : base * 0.62, base }))
}
export const chartWidth = (w: number) => (PAD * 2 + 5 * STEP) * w
/** The view while the class sails to island i: that island and the one before (or home). */
export const camX = (i: number, w: number) => i * STEP * w

export type Curve = [number[], number[], number[]]
/** The courses bend away from the sea creatures: down, up, down, up, up. */
const BENDS = [0.16, -0.16, 0.16, -0.16, -0.16]
/** The way to island i, from the island before or from home's dock: a gentle curve from shore to shore. */
export function route(P: Stop[], i: number): Curve {
  const a = P[i],
    b = P[i + 1]
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy),
    ux = dx / len,
    uy = dy / len
  const s = i ? [a.x + ux * a.r * 1.45, a.y + uy * a.r * 1.1] : [a.x + a.r * 1.75, a.y + a.r * 0.05]
  const e = [b.x - ux * b.r * 1.5, b.y - uy * b.r * 1.15]
  return [s, [(s[0] + e[0]) / 2 - uy * len * BENDS[i], (s[1] + e[1]) / 2 + ux * len * BENDS[i]], e]
}
const lerp = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
export const bez = ([p0, p1, p2]: Curve, t: number) => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t)
function split([p0, p1, p2]: Curve, t: number): [Curve, Curve] {
  const m = bez([p0, p1, p2], t)
  return [
    [p0, lerp(p0, p1, t), m],
    [m, lerp(p1, p2, t), p2],
  ]
}
const qd = ([p0, p1, p2]: Curve) => `M${f(p0[0])} ${f(p0[1])} Q${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])}`

function compass(x: number, y: number, r: number): string {
  const at = (a: number, l: number) => [Math.cos(a) * l, Math.sin(a) * l]
  let s = `<g transform="translate(${x} ${y})" opacity=".85">`
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 - Math.PI / 2
    const [tx, ty] = at(a, r),
      [lx, ly] = at(a - Math.PI / 4, r * 0.22),
      [rx, ry] = at(a + Math.PI / 4, r * 0.22)
    s += `<path d="M0 0 L${f(lx)} ${f(ly)} L${f(tx)} ${f(ty)} Z" fill="#ffffff"/><path d="M0 0 L${f(rx)} ${f(ry)} L${f(tx)} ${f(ty)} Z" fill="#d7ecf8"/>`
  }
  return (
    s +
    `<circle r="${r * 0.12}" fill="#1d4e7a"/><text y="${-r - 6}" text-anchor="middle" font-size="${r * 0.4}" font-weight="700" fill="#fff">N</text></g>`
  )
}

/** Home: a little beach with a dock, where the ship sets out from. */
function homeArt({ x, y, r }: Stop): string {
  let s = `<path d="${blob(x, y, r * 1.3, 3, 0.7)}" fill="${SEA.shallow}"/><path d="${blob(x, y, r, 3, 0.7)}" fill="${SEA.sand}" stroke="${SEA.sandEdge}" stroke-width="2"/>`
  s += `<path d="${blob(x - r * 0.15, y - r * 0.1, r * 0.55, 8, 0.7)}" fill="${SEA.grass}"/>`
  s += `<rect x="${f(x + r * 0.55)}" y="${f(y - r * 0.13)}" width="${f(r * 1.05)}" height="${f(r * 0.26)}" rx="${f(r * 0.04)}" fill="#c08a4e" stroke="#8a5a2b" stroke-width="2"/>`
  for (let n = 1; n < 5; n++)
    s += `<path d="M${f(x + r * (0.55 + n * 0.21))} ${f(y - r * 0.13)} v${f(r * 0.26)}" stroke="#8a5a2b" stroke-width="1.5"/>`
  return s + im('palm-tree_coconuts', x - r * 0.25, y - r * 0.5, r * 0.9) + im('anchor', x + r * 0.3, y + r * 0.3, r * 0.38)
}

/**
 * Clouds over an island not reached yet, one patch over each puzzle piece's part of it; a piece
 * found clears its patch. Each patch is a small picture of its own, so blowing it away is a move
 * the graphics chip makes, with nothing under it drawn again.
 */
function cloudsFor(j: number, g: Stop, from: number): string {
  const k = g.r / PR
  const ox = g.x - (PW / 2) * k,
    oy = g.y - PH * 0.55 * k
  let out = ''
  jigsaw(j).forEach((pc, n) => {
    if (n < from) return
    const [x0, y0, cw, ch] = pc.cell
    const X = ox + x0 * k,
      Y = oy + y0 * k,
      W = cw * k,
      H = ch * k
    const R = rng(j * 97 + n * 13 + 1)
    const rr = Math.min(W, H) * 0.34
    const cols = Math.max(2, Math.ceil(W / (rr * 1.15))),
      rows = Math.max(2, Math.ceil(H / (rr * 1.15)))
    let low = '',
      high = ''
    let l = Infinity,
      t = Infinity,
      r = -Infinity,
      b = -Infinity
    for (let a = 0; a < rows; a++)
      for (let c = 0; c < cols; c++) {
        const px = X + ((c + 0.5) * W) / cols + (R() - 0.5) * rr * 0.5
        const py = Y + ((a + 0.5) * H) / rows + (R() - 0.5) * rr * 0.5
        if (((px - g.x) / (g.r * 1.75)) ** 2 + ((py - g.y + g.r * 0.1) / (g.r * 1.4)) ** 2 > 1) continue
        const pr = rr * (0.85 + R() * 0.35)
        low += circle(px, py + rr * 0.16, pr, '#cfe0ec')
        high += circle(px, py, pr * 0.94, '#ffffff')
        l = Math.min(l, px - pr)
        r = Math.max(r, px + pr)
        t = Math.min(t, py - pr)
        b = Math.max(b, py + pr + rr * 0.16)
      }
    if (l === Infinity) return
    out += layer(`data-island="${j}" data-piece="${n}"`, [l, t, r - l, b - t], low + high)
  })
  return out
}

/** A picture of its own on the chart, at its place in the chart's own units. */
function layer(attrs: string, [x, y, w, h]: number[], body: string): string {
  return `<svg ${attrs} viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" style="position:absolute;left:${f(x)}px;top:${f(y)}px;width:${f(w)}px;height:${f(h)}px;overflow:visible;pointer-events:none">${body}</svg>`
}

export interface ChartView {
  /** The island the class is sailing to (5 once the whole voyage is done). */
  at: number
  /** Pieces found towards it. */
  pieces: number
  /** How far along the way to it the ship is drawn, 0 to 1. */
  ship: number
  /** Pieces whose clouds have been cleared. */
  cleared: number
  /** What each island held. */
  prizes: string[]
  quest: number
  /** Where the view starts: the left edge of what shows, on the chart. */
  cam: number
}

/** The box round an island, on the chart, that its dig (and its X) is drawn in. */
export function digBox(g: Stop): number[] {
  return [g.x - g.r * 1.6, g.y - g.r * 1.4, g.r * 3.2, g.r * 2.8]
}

/**
 * The whole sea chart for a view w by h, as layers (2026-10-25: one picture of it all was drawn
 * again on every frame the ship sailed, 45 frames a second on the board): the still chart, then a
 * picture each for what moves - the volcano's smoke, the octopus's z's, each patch of cloud, the
 * labels, the ship and the dig - inside one sliding sheet the graphics chip glides as a whole.
 */
export function chartHTML(w: number, h: number, v: ChartView): { html: string; shipSize: number } {
  const P = chart(w, h)
  const base = P[0].base
  const shipSize = Math.max(54, base * 0.62)
  const Ww = chartWidth(w)
  const R = rng(99)
  let waves = ''
  for (let n = 0; n < 150; n++) {
    const x = R() * Ww,
      y = R() * h
    if (P.some((g) => Math.hypot(g.x - x, (g.y - y) * 1.3) < g.r * 1.7)) continue
    waves += `<path d="M${f(x)} ${f(y)} q 6 -5 12 0 t 12 0" fill="none" stroke="#ffffffaa" stroke-width="2.2" stroke-linecap="round"/>`
  }
  // The way sailed in dark ink, the way ahead in white.
  const sailed = (c: Curve) =>
    `<path d="${qd(c)}" fill="none" stroke="${SEA.sailed}" stroke-width="4" stroke-dasharray="9 8" stroke-linecap="round"/>`
  const ahead = (c: Curve) =>
    `<path d="${qd(c)}" fill="none" stroke="#ffffffcc" stroke-width="3" stroke-dasharray="6 9" stroke-linecap="round" opacity=".85"/>`
  let routes = ''
  for (let i = 0; i < 5; i++) {
    const c = route(P, i)
    if (i < v.at) routes += sailed(c)
    else if (i > v.at) routes += ahead(c)
    else {
      const [a, b] = split(c, Math.max(0.001, Math.min(0.999, v.ship)))
      if (v.ship > 0) routes += sailed(a)
      if (v.ship < 1) routes += ahead(b)
    }
  }
  const fs = Math.min(26, Math.max(16, base * 0.13))
  let land = homeArt(P[0]),
    clouds = '',
    labels = '',
    moving = '',
    fx = ''
  for (let j = 0; j < 5; j++) {
    const g = P[j + 1]
    land += islandArt(j, g.x, g.y, g.r, { opened: j < v.at, smoke: false })
    // Plain page elements, not shapes in a picture, so the graphics chip moves them with no drawing.
    if (ISLANDS[j].volcano) {
      const d = g.r * 0.2
      for (let n = 0; n < 3; n++)
        moving += `<div class="pirate-smoke" style="position:absolute;left:${f(g.x + g.r * 0.02 - d / 2)}px;top:${f(g.y - g.r * 1.12 - d / 2)}px;width:${f(d)}px;height:${f(d)}px;border-radius:50%;background:#eef1f4;animation-delay:${n * 1.2}s"></div>`
    }
    if (j >= v.at) clouds += cloudsFor(j, g, j === v.at ? v.cleared : 0)
    // The island being sailed to: its X once the puzzle is whole, and where the shovel digs.
    if (j === v.at) {
      const [xx, xy] = xSpot(g.x, g.y, g.r)
      fx = layer('data-pirate-fx=""', digBox(g), v.pieces >= PIRATE_PIECES[j] ? markX(xx, xy, g.r) : '')
    }
    const n = PIRATE_PIECES[j]
    const label = j < v.at ? (v.prizes[j] ?? ISLANDS[j].name) : j === v.at ? `${Math.min(v.pieces, n)} of ${n} pieces` : `${n} pieces`
    // The words grow with the board, so they read from the back of the room on a big one too.
    const lw = Math.max(fs * 9.4, label.length * fs * 0.6 + fs * 1.9),
      ly = g.y + g.r * 0.95
    labels += `<g font-weight="700" text-anchor="middle"><rect x="${f(g.x - lw / 2)}" y="${f(ly)}" width="${f(lw)}" height="${f(fs * 1.75)}" rx="${f(fs * 0.875)}" fill="#ffffff"/><text x="${f(g.x)}" y="${f(ly + fs * 1.25)}" font-size="${f(fs)}" fill="#3b3366">${escapeXml(label)}</text></g>`
  }
  // The sea's life in the open water between islands, on the side away from the course; nothing in the sea that wouldn't float.
  const sz = base * 0.62
  const mid = (j: number) => (P[j].x + P[j + 1].x) / 2
  let life = im('whale', mid(0) - w * 0.05, h * 0.24, sz) + im('shark', mid(1) + w * 0.04, h * 0.86, sz * 0.8)
  life += im('message-in-a-bottle', mid(1) - w * 0.08, h * 0.9, sz * 0.55)
  life +=
    im('seagull', mid(2) - w * 0.04, h * 0.22, sz * 0.6) +
    im('seagull', mid(2) + w * 0.03, h * 0.17, sz * 0.42) +
    im('kraken', mid(3), h * 0.87, sz * 1.15)
  // The guardian, asleep in the water before the last island.
  const orr = base * 0.8,
    ox = mid(4) + base * 0.3,
    oy = h - orr * 0.5
  life +=
    `${im('octopus', ox, oy, orr)}<rect x="${f(ox - orr * 0.55)}" y="${f(oy + orr * 0.12)}" width="${f(orr * 1.1)}" height="${f(orr * 0.5)}" fill="${SEA.sea}"/>` +
    `<path d="M${f(ox - orr * 0.55)} ${f(oy + orr * 0.14)} q ${f(orr * 0.14)} -9 ${f(orr * 0.28)} 0 t ${f(orr * 0.28)} 0 t ${f(orr * 0.28)} 0 t ${f(orr * 0.28)} 0" fill="none" stroke="#fff" stroke-width="3"/>`
  const z = (x: number, y: number, size: number, delay: string) =>
    `<span class="pirate-zzz" style="position:absolute;left:${f(x)}px;top:${f(y - size)}px;font-size:${f(size)}px;line-height:1;font-weight:700;color:#fff;animation-delay:${delay}">z</span>`
  moving += z(ox + orr * 0.35, oy - orr * 0.3, orr * 0.28, '0s') + z(ox + orr * 0.5, oy - orr * 0.5, orr * 0.22, '.8s')
  const [sx, sy] = bez(route(P, Math.min(v.at, 4)), v.at > 4 ? 1 : v.ship)
  const ship =
    `<div data-pirate-ship="" style="position:absolute;left:${f(-shipSize / 2)}px;top:${f(-shipSize / 2)}px;width:${f(shipSize)}px;height:${f(shipSize)}px;transform:translate(${f(sx)}px,${f(sy - shipSize * 0.22)}px)">` +
    `<img class="pirate-ship" src="${art('galleon')}" alt="" draggable="false" style="display:block;width:100%;height:100%"></div>`
  const tf = Math.min(40, Math.max(28, h * 0.04)),
    tw = tf * 9.3
  const title = `<g font-weight="700" text-anchor="middle"><rect x="${f(w / 2 - tw / 2)}" y="14" width="${f(tw)}" height="${f(tf * 1.65)}" rx="${f(tf * 0.82)}" fill="#ffffffe6"/><text x="${f(w / 2)}" y="${f(14 + tf * 1.15)}" font-size="${f(tf)}" fill="#3b3366">Our Quest${v.quest > 1 ? ' ' + v.quest : ''}</text></g>`
  const full = `viewBox="0 0 ${f(Ww)} ${h}" style="position:absolute;left:0;top:0;width:${f(Ww)}px;height:${h}px;pointer-events:none"`
  const html =
    `<div data-pirate-chart="" style="position:absolute;inset:0;overflow:hidden;background:${SEA.sea};font-family:inherit">` +
    `<div data-pirate-world="" style="position:absolute;left:0;top:0;width:${f(Ww)}px;height:${h}px;transform-origin:0 0;will-change:transform;transform:translate(${f(-v.cam)}px,0px)">` +
    `<svg ${full}>${waves}${routes}${land}${life}</svg>${moving}${clouds}<svg ${full}>${labels}</svg>${fx}${ship}</div>` +
    `<svg viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">${compass(70, 82, 36)}${title}</svg></div>`
  return { html, shipSize }
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
