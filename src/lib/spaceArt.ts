import { assetUrl } from './assets'
import { BARS_PER_CELL, TRIP_CELLS } from './quest'

/**
 * The Space Quest's pictures (DECISIONS, "The Space Quest"), drawn as SVG text: the planet the class
 * is on, zoomed in with its curve along the bottom; the map of the whole trip; the fuel cells; the
 * rocket, the flag with the class's mouse on it, the alien's case. The pieces are the teacher's
 * Flaticon space pack (`public/quest/space/`); the cells, the flag, the sky and the beam are drawn
 * here. Everything that moves is CSS or element.animate (index.css, `space-`), which the graphics
 * chip runs ("Smooth on the board"). Sizes come from the box it is drawn in, set by `setSpaceSize`.
 */

export const spaceArtUrl = (name: string) => assetUrl(`/quest/space/${name}.svg`)
const NS = 'http://www.w3.org/2000/svg'

/** Earth and the five planets, near to far. `rad` is the planet's radius inside its picture; `dust` what a landing kicks up. */
export const PLACES = [
  { name: 'Earth', art: 'earth', rad: 0.499, size: 0.85, dust: '#cfe9c8' },
  { name: 'the Moon', art: 'moon', rad: 0.499, size: 0.62, dust: '#e6e6ee' },
  { name: 'Mars', art: 'mars', rad: 0.499, size: 0.78, dust: '#f3a58f' },
  { name: 'the Purple Planet', art: 'planet-2', rad: 0.481, size: 0.9, dust: '#c9c2f2' },
  { name: 'Jupiter', art: 'jupiter-1', rad: 0.489, size: 1.08, dust: '#f6cf8f' },
  { name: 'the Blue Planet', art: 'neptune', rad: 0.499, size: 1.15, dust: '#b9dcff' },
] as const
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** The case the alien brings, trimmed by rank as the Knight's chests are: plain, bronze, silver, gold, and glowing gold. */
const CASES = [{ trim: '#546E7A' }, { trim: '#b5652a' }, { trim: '#8796a3' }, { trim: '#d9a21b' }, { trim: '#d9a21b', glow: true }]

const BAR = '#a8d83a'
const CELL = '#4a4a52'
const LOW = '#f05a4f'
const FLOWN = '#ffd84d'
export const SPACE_BG = '#121736'

let W = 1000
let H = 500
/** The box the Space Quest is drawn in. */
export function setSpaceSize(w: number, h: number) {
  W = w
  H = h
}

export function rng(seed: number) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}
const f1 = (n: number) => n.toFixed(1)
export function imC(name: string, x: number, y: number, size: number, extra = '') {
  return `<image href="${spaceArtUrl(name)}" x="${f1(x - size / 2)}" y="${f1(y - size / 2)}" width="${f1(size)}" height="${f1(size)}" ${extra}/>`
}
/** An image standing on a point: its bottom middle at (x, y). */
export function imB(name: string, x: number, y: number, w: number, h: number, extra = '') {
  return `<image href="${spaceArtUrl(name)}" x="${f1(x - w / 2)}" y="${f1(y - h)}" width="${f1(w)}" height="${f1(h)}" ${extra}/>`
}

/* ---------- the fuel cell, drawn after the teacher's cells ---------- */

/** One cell: a dark body with a cap, four bars from the bottom up, a bolt across them; empty, a thin red strip at the bottom. */
export function cellSVG(x: number, y: number, w: number, h: number, lit: number, glow = false) {
  const capW = w * 0.38
  const capH = h * 0.07
  const by = y + capH
  const bh = h - capH
  const pad = w * 0.14
  const gap = bh * 0.035
  const barH = (bh - pad * 2 - gap * (BARS_PER_CELL - 1)) / BARS_PER_CELL
  let s = `<rect x="${x + (w - capW) / 2}" y="${y}" width="${capW}" height="${capH + 2}" rx="${capW * 0.12}" fill="#7a7a84"/>`
  s += `<rect x="${x}" y="${by}" width="${w}" height="${bh}" rx="${w * 0.1}" fill="${CELL}"/>`
  for (let k = 0; k < BARS_PER_CELL; k++) {
    const yy = by + bh - pad - (k + 1) * barH - k * gap
    s += `<rect class="space-bar" x="${x + pad}" y="${yy}" width="${w - pad * 2}" height="${barH}" rx="${w * 0.03}" fill="${BAR}" style="opacity:${k < lit ? 1 : 0}"/>`
    s += `<rect x="${x + pad}" y="${yy}" width="${w - pad * 2}" height="${barH}" rx="${w * 0.03}" fill="none" stroke="#ffffff22" stroke-width="1"/>`
  }
  if (lit === 0)
    s += `<rect class="space-low" x="${x + pad}" y="${by + bh - pad - barH * 0.35}" width="${w * 0.44}" height="${barH * 0.35}" rx="2" fill="${LOW}"/>`
  const cx = x + w / 2
  const cy = by + bh / 2
  const z = w * 0.28
  s += `<path d="M${cx + z * 0.25} ${cy - z * 1.1} L${cx - z * 0.55} ${cy + z * 0.1} L${cx + z * 0.02} ${cy + z * 0.1} L${cx - z * 0.28} ${cy + z * 1.1} L${cx + z * 0.6} ${cy - z * 0.2} L${cx + z * 0.05} ${cy - z * 0.2} Z" fill="#fff" opacity=".92"/>`
  return `<g class="space-cell${glow ? ' space-glow-cell' : ''}">${s}</g>`
}
/** A trip's cells side by side, filled from the first, as many bars lit as `bars`. */
export function cellsRow(x: number, y: number, w: number, h: number, n: number, bars: number, gapK = 0.28, glow = false) {
  let s = ''
  for (let i = 0; i < n; i++)
    s += cellSVG(x + i * w * (1 + gapK), y, w, h, Math.max(0, Math.min(BARS_PER_CELL, bars - i * BARS_PER_CELL)), glow)
  return s
}
export const rowW = (n: number, w: number, gapK = 0.28) => n * w + (n - 1) * w * gapK

/** The trip's cells small, for the meter's end and the floating window. */
export function miniCellsSVG(trip: number, bars: number) {
  const n = TRIP_CELLS[trip] ?? 1
  const w = 18
  const h = 38
  return `<svg viewBox="-2 -2 ${rowW(n, w, 0.25) + 4} ${h + 4}" xmlns="${NS}">${cellsRow(0, 0, w, h, n, bars, 0.25)}</svg>`
}

/** "More fuel!": the trip's cells big, with the barrel over the cell it fills. Drawn at a fixed size, scaled to fit. */
export function fuelPicture(trip: number, bars: number, barrel: boolean, glow = false) {
  const n = TRIP_CELLS[trip]
  const w = 92
  const h = 170
  const rw = rowW(n, w)
  const top = barrel ? 150 : 0
  const need = n * BARS_PER_CELL
  const cur = Math.min(n - 1, Math.floor(Math.min(bars, need - 1) / BARS_PER_CELL))
  const bx = cur * w * 1.28 + w / 2
  let s = cellsRow(0, top, w, h, n, bars, 0.28, glow)
  if (barrel)
    s += `<g data-space-barrel="" style="transform:translate(${bx - 50}px, 10px)"><image href="${spaceArtUrl('barrel')}" x="0" y="0" width="100" height="100"/></g><g data-space-stream=""></g>`
  return {
    svg: `<svg viewBox="-10 -10 ${rw + 20} ${h + top + 20}" xmlns="${NS}" style="overflow:visible">${s}</svg>`,
    cellX: (c: number) => c * w * 1.28 + w / 2,
  }
}

/* ---------- the sky: each place its own ---------- */

const NEBULAS = [
  ['#2f6fd0', '#2aa39b'],
  ['#5a4fb8', '#7a3f9e'],
  ['#b2453a', '#8a3fa8'],
  ['#6b3fa0', '#c04f8f'],
  ['#c07a2f', '#7a4fb8'],
  ['#1f8fa8', '#3b4fd0'],
  ['#6b3fa0', '#1f6fa8'],
]
const FAR = [
  'saturn',
  'saturn-1',
  'saturn-2',
  'uranus',
  'uranus-2',
  'uranus-3',
  'venus',
  'planet-1',
  'planet-3',
  'planet-4',
  'mars-1',
  'jupiter',
  'planets-1',
  'planet',
  'planets',
]
const FLOAT: [string, string][] = [
  ['satellite', 'space-drift'],
  ['satellite-1', 'space-drift'],
  ['space-station', 'space-drift'],
  ['rocks', 'space-spin'],
  ['asteroids', 'space-spin'],
  ['asteroid', 'space-spin'],
  ['asteroid-1', 'space-spin'],
  ['asteroid-2', 'space-spin'],
  ['astronaut-1', 'space-drift'],
  ['ufo', 'space-hover'],
  ['ufo-1', 'space-hover'],
  ['stars', 'space-twinkle'],
]
const DEEP = ['galaxy', 'nebula', 'space']
/** Which way each comet picture is already heading, in degrees (0 is to the right, 90 straight down). */
const COMETS: [string, number][] = [
  ['comet', 45],
  ['comet-1', 135],
  ['comet-2', 135],
  ['falling-star', 135],
]
/** Where the sky's pieces may go, kept clear of the title, the fuel panel, the flag and the rocket's column. */
const SLOTS = [
  [0.1, 0.2],
  [0.06, 0.48],
  [0.2, 0.3],
  [0.3, 0.12],
  [0.66, 0.2],
  [0.86, 0.64],
  [0.7, 0.48],
  [0.62, 0.34],
]
let skyN = 0
/**
 * Each place has its own sky (the teacher, 2026-10-26: keep it varied): its own nebula colours and
 * stars, two far-off planets, two things drifting by, and comets and shooting stars crossing in their
 * own directions. Seeded by the place, so it is the same sky every time the class is there.
 */
export function skyHTML(place: number | 'map') {
  const w = W
  const h = H
  const key = place === 'map' ? 6 : place
  const R = rng(key * 977 + 31)
  const id = 'sky' + ++skyN
  const m = Math.min(w, h)
  const pick = <T>(arr: T[]) => arr[Math.floor(R() * arr.length)]
  const shuffle = <T>(arr: T[]) =>
    arr
      .map((v) => [R(), v] as const)
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1])
  // The still sky is one picture; everything that moves is a page element of its own, which the graphics
  // chip slides without redrawing the sky (drawn inside the picture, a 4K board redrew the whole sky every frame).
  const at0 = (x: number, y: number, size: number) =>
    `position:absolute;left:${f1(x - size / 2)}px;top:${f1(y - size / 2)}px;width:${f1(size)}px;height:${f1(size)}px;will-change:transform`
  const pic = (name: string) => `<img src="${spaceArtUrl(name)}" alt="" draggable="false" style="display:block;width:100%;height:100%"/>`
  const [c1, c2] = NEBULAS[key]
  let s = `<defs><radialGradient id="${id}a"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}b"><stop offset="0" stop-color="${c2}" stop-opacity=".45"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${w}" height="${h}" fill="${SPACE_BG}"/>`
  let moving = ''
  for (let n = 0; n < 3; n++)
    s += `<ellipse cx="${(R() * w).toFixed(0)}" cy="${(R() * h * 0.7).toFixed(0)}" rx="${(w * (0.25 + R() * 0.25)).toFixed(0)}" ry="${(h * (0.25 + R() * 0.25)).toFixed(0)}" fill="url(#${id}${n % 2 ? 'b' : 'a'})"/>`
  const count = 90 + Math.floor(R() * 120)
  const tint = ['#ffffff', '#fff6d8', '#dfe8ff', '#ffe6f2'][Math.floor(R() * 4)]
  for (let n = 0; n < count; n++) {
    const x = R() * w
    const y = R() * h
    const r = R() < 0.88 ? 0.5 + R() * 1.2 : 1.6 + R() * 1.4
    if (n % 6 === 0)
      moving += `<i class="space-twinkle" style="position:absolute;left:${f1(x - r)}px;top:${f1(y - r)}px;width:${f1(r * 2)}px;height:${f1(r * 2)}px;border-radius:50%;background:${tint};animation-delay:${(R() * 3).toFixed(1)}s;animation-duration:${(2 + R() * 3).toFixed(1)}s"></i>`
    else
      s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${tint}" opacity="${(0.35 + R() * 0.65).toFixed(2)}"/>`
  }
  const slots = shuffle(SLOTS)
  const at = () => slots.shift()!
  {
    const [x, y] = at()
    s += `<g opacity=".32">${imC(pick(DEEP), x * w, y * h, m * (0.2 + R() * 0.12))}</g>`
  }
  const far = shuffle(FAR.filter((f) => typeof place !== 'number' || (f !== PLACES[place].art && f !== PLACES[place + 1]?.art)))
  for (let n = 0; n < 2; n++) {
    const [x, y] = at()
    const style = `animation-duration:${(60 + R() * 60).toFixed(0)}s;${R() < 0.5 ? 'animation-direction:reverse;' : ''}`
    moving += `<div class="space-spin" style="${at0(x * w, y * h, m * (0.07 + R() * 0.07))};${style}">${pic(far[n])}</div>`
  }
  const fl = shuffle(FLOAT)
  for (let n = 0; n < 2; n++) {
    const [x, y] = at()
    const [name, cls] = fl[n]
    const style = `animation-duration:${(cls === 'space-spin' ? 30 + R() * 30 : 6 + R() * 6).toFixed(1)}s;animation-delay:-${(R() * 5).toFixed(1)}s`
    moving += `<div class="${cls}" style="${at0(x * w, y * h, m * (0.06 + R() * 0.05))};${style}">${pic(name)}</div>`
  }
  // Comets crossing the sky, each its own way, turned to face where it is going.
  for (let n = 0; n < 1 + Math.floor(R() * 2); n++) {
    const [name, base] = pick(COMETS)
    const dir = 20 + R() * 140
    const rad = (dir * Math.PI) / 180
    const len = Math.hypot(w, h) * 1.3
    const dx = Math.cos(rad) * len
    const dy = Math.sin(rad) * len
    const x0 = w / 2 - dx / 2 + (R() - 0.5) * w * 0.4
    const y0 = h * 0.3 - dy / 2
    const vars = `--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--t:${(24 + R() * 20).toFixed(0)}s;--d:-${(R() * 20).toFixed(0)}s`
    moving += `<div class="space-travel" style="${at0(x0, y0, m * (0.07 + R() * 0.04))};${vars}"><div style="width:100%;height:100%;transform:rotate(${(dir - base).toFixed(0)}deg)">${pic(name)}</div></div>`
  }
  // Shooting stars, quick streaks in their own directions, now and then.
  for (let n = 0; n < 3 + Math.floor(R() * 3); n++) {
    const dir = R() < 0.5 ? 20 + R() * 50 : 110 + R() * 50
    const rad = (dir * Math.PI) / 180
    const L = m * (0.35 + R() * 0.3)
    const dx = Math.cos(rad) * L
    const dy = Math.sin(rad) * L
    const sx = w * (0.1 + R() * 0.8)
    const sy = h * (0.04 + R() * 0.3)
    const tl = 50 + R() * 30
    const vars = `--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--t:${(6 + R() * 8).toFixed(1)}s;--d:${(R() * 8).toFixed(1)}s`
    moving += `<div class="space-shoot" style="position:absolute;left:${f1(sx)}px;top:${f1(sy)}px;width:0;height:0;will-change:transform,opacity;${vars}">
      <i style="position:absolute;right:0;top:-1.2px;width:${f1(tl)}px;height:2.4px;border-radius:2px;background:linear-gradient(90deg,transparent,#fffc);transform-origin:100% 50%;transform:rotate(${dir.toFixed(0)}deg)"></i>
      <i style="position:absolute;left:-3.2px;top:-3.2px;width:6.4px;height:6.4px;border-radius:50%;background:#fff"></i></div>`
  }
  return `<div data-space-sky="" style="position:absolute;inset:0;overflow:hidden;pointer-events:none"><svg viewBox="0 0 ${w} ${h}" xmlns="${NS}" style="position:absolute;inset:0;width:100%;height:100%">${s}</svg>${moving}</div>`
}

/* ---------- on a planet: zoomed in, its curve along the bottom, space above ---------- */

export interface Ground {
  R: number
  cx: number
  cy: number
  size: number
  y: (x: number) => number
  ang: (x: number) => number
}
/** The planet's circle, its top about a quarter of the way up from the bottom, so the ground is a gentle curve. */
export function ground(p: number): Ground {
  const R = W * 0.85
  const cx = W / 2
  const cy = H * 0.72 + R
  return {
    R,
    cx,
    cy,
    size: R / PLACES[p].rad,
    y: (x) => cy - Math.sqrt(Math.max(0, R * R - (x - cx) ** 2)),
    ang: (x) => (Math.asin((x - cx) / R) * 180) / Math.PI,
  }
}
/** Each thing has its own place on the ground, the same on every planet (2026-10-26, the teacher: less cluttered). */
export const SPOT = { flag: 0.26, astro: 0.34, rocket: 0.5, kase: 0.68 }
export const rocketH = () => H * 0.38
export const view = () => ({ w: W, h: H })

/** The teacher's rocket, standing with its nozzle at (x, y); the flame is drawn under the nozzle, and the astronaut in the window. */
export function rocketSVG(x: number, y: number, { flame = false, face = false, id = 'space-rocket' } = {}) {
  const h = rocketH()
  const w = h
  const f = `<g data-space-flame="" style="opacity:${flame ? 1 : 0}"><g class="space-flame"><path d="M${x - w * 0.09} ${y - h * 0.03} Q${x} ${y + h * 0.45} ${x + w * 0.09} ${y - h * 0.03} Z" fill="#ff9a2e"/><path d="M${x - w * 0.05} ${y - h * 0.03} Q${x} ${y + h * 0.26} ${x + w * 0.05} ${y - h * 0.03} Z" fill="#fff1a8"/></g></g>`
  return `<g data-${id}="">${f}${imB('rocket-ship', x, y + h * 0.015, w, h)}${face ? faceSVG(x, y) : ''}</g>`
}

let faceN = 0
/** The astronaut's helmet in the rocket's round window: he stays in there until the fuel is in (2026-10-26, the teacher). */
export function faceSVG(x: number, y: number) {
  const h = rocketH()
  const cy = y + h * 0.015 - h + (h * 29) / 60
  const r = (h * 6) / 60
  const S = (r * 512) / 150
  const id = 'spwin' + ++faceN
  return `<g data-space-face=""><clipPath id="${id}"><circle cx="${x}" cy="${cy}" r="${r * 0.97}"/></clipPath>
    <g clip-path="url(#${id})"><circle cx="${x}" cy="${cy}" r="${r}" fill="#2c3e66"/><image href="${spaceArtUrl('astronaut')}" x="${x - (S * 289) / 512}" y="${cy - (S * 160) / 512}" width="${S}" height="${S}"/></g>
    <ellipse cx="${x - r * 0.35}" cy="${cy - r * 0.4}" rx="${r * 0.3}" ry="${r * 0.16}" fill="#fff" opacity=".55" transform="rotate(-30 ${x - r * 0.35} ${cy - r * 0.4})"/></g>`
}

/**
 * The class's mouse, face on, in a white circle, for the flag: the timer's mouse is the astronaut,
 * hidden in the suit (the teacher, 2026-10-26). Drawn from the writing mouse's own head (lib/writerTimer).
 */
export function mouseBadge(cx: number, cy: number, r: number) {
  const k = r / 70
  return `<g transform="translate(${cx} ${cy}) scale(${k.toFixed(4)}) translate(-220 -192)">
    <circle cx="220" cy="192" r="70" fill="#fff"/>
    <circle cx="166" cy="150" r="33" fill="#a9abb8"/><circle cx="168" cy="152" r="22" fill="#f4b4c1"/>
    <circle cx="274" cy="150" r="33" fill="#a9abb8"/><circle cx="272" cy="152" r="22" fill="#f4b4c1"/>
    <path d="M 220 146 C 258 146, 278 172, 278 200 C 278 230, 252 248, 220 248 C 188 248, 162 230, 162 200 C 162 172, 182 146, 220 146 Z" fill="#a9abb8"/>
    <ellipse cx="220" cy="220" rx="28" ry="19" fill="#c3c4cf"/>
    <ellipse cx="184" cy="214" rx="9" ry="6" fill="#f39fb2" opacity=".6"/><ellipse cx="256" cy="214" rx="9" ry="6" fill="#f39fb2" opacity=".6"/>
    <ellipse cx="200" cy="192" rx="6.2" ry="8" fill="#23212c"/><circle cx="202" cy="188.6" r="2.3" fill="#fff"/>
    <ellipse cx="240" cy="192" rx="6.2" ry="8" fill="#23212c"/><circle cx="242" cy="188.6" r="2.3" fill="#fff"/>
    <ellipse cx="220" cy="211" rx="7.5" ry="5.8" fill="#e2738c"/><circle cx="217.6" cy="209.2" r="1.8" fill="#fff" opacity=".75"/>
    <path d="M 210 228 Q 220 236, 230 228" stroke="#23212c" stroke-width="3" fill="none" stroke-linecap="round"/></g>`
}

/**
 * The flag: a pole and a cloth that ripples like fabric, more at its loose end (2026-10-26, the
 * teacher: it was too stiff), the mouse riding the wave. `wave` off draws it still, for the map.
 */
export function flagSVG(x: number, y: number, s: number, wave = true) {
  const L = s * 0.74
  const Hh = s * 0.44
  const top = y - s
  const A = s * 0.07
  const N = 10
  const shape = (ph: number) => {
    const edge = (y0: number, k: number) =>
      Array.from({ length: N + 1 }, (_, i) => {
        const t = i / N
        return [x + t * L * (1 - 0.06 * Math.sin(ph + t * 3)), y0 + Math.sin(ph - t * 5.5) * A * t * k + t * s * 0.04]
      })
    const a = edge(top, 1)
    const b = edge(top + Hh, 1.15).reverse()
    return 'M' + [...a, ...b].map(([u, v]) => `${f1(u)} ${f1(v)}`).join(' L') + 'Z'
  }
  const fold = (ph: number) =>
    'M' +
    Array.from({ length: N + 1 }, (_, i) => {
      const t = i / N
      return `${f1(x + t * L * 0.98)} ${f1(top + Hh * 0.55 + Math.sin(ph - t * 5.5) * A * t + t * s * 0.04)}`
    }).join(' L')
  const phases = Array.from({ length: 9 }, (_, i) => (i / 8) * Math.PI * 2)
  const anim = (vals: string[]) =>
    wave ? `<animate attributeName="d" dur="1.6s" repeatCount="indefinite" values="${vals.join(';')}"/>` : ''
  const bob = wave
    ? `<animateTransform attributeName="transform" type="translate" dur="1.6s" repeatCount="indefinite" values="${phases.map((p) => `0 ${f1(Math.sin(p - 2.75) * A * 0.55 + s * 0.02)}`).join(';')}"/>`
    : ''
  return `<g data-space-flag=""><path d="M${x} ${y} v${-s}" stroke="#514c45" stroke-width="${Math.max(3, s * 0.045)}" stroke-linecap="round"/>
    <path d="${shape(0)}" fill="#f33">${anim(phases.map(shape))}</path>
    <path d="${fold(0)}" fill="none" stroke="#d12a2a" stroke-width="${Math.max(2, s * 0.05)}" stroke-linecap="round" opacity=".8">${anim(phases.map(fold))}</path>
    <g transform="translate(0 ${f1(s * 0.02)})">${mouseBadge(x + L * 0.48, top + Hh * 0.52, Hh * 0.36)}${bob}</g></g>`
}

/** The teacher's silver case, its trim in the rank's colour. Opened, the lid swings up on its hinge with the treasure inside. */
export function caseSVG(rank: number, x: number, y: number, s: number, open = false) {
  const c = CASES[rank]
  const h = s * 0.82
  const hy = y - h * 0.5
  let t = ''
  if (c.glow && !open) t += `<ellipse cx="${x}" cy="${y - h * 0.5}" rx="${s * 0.7}" ry="${s * 0.55}" fill="url(#spaceCaseGlow)"/>`
  if (open) {
    t += `<g transform="rotate(-32 ${x - s / 2} ${hy})">${imB('case', x, y, s, h, 'style="clip-path:inset(0 0 50% 0)"')}<rect x="${x - s * 0.42}" y="${hy - h * 0.06}" width="${s * 0.84}" height="${h * 0.05}" fill="${c.trim}"/></g>`
    const R = rng(rank + 9)
    for (let n = 0; n < 7 + rank * 2; n++)
      t += `<circle cx="${f1(x + (R() - 0.5) * s * 0.7)}" cy="${f1(hy - R() * h * 0.12)}" r="${f1(s * 0.055)}" fill="${n % 3 ? '#ffd23f' : '#b6f0ff'}" stroke="#c99212" stroke-width="1"/>`
  }
  t += `<g style="filter:drop-shadow(0 3px 2px #0005)">${imB('case', x, y, s, h, open ? 'style="clip-path:inset(50% 0 0 0)"' : '')}</g>`
  t += `<rect x="${x - s * 0.42}" y="${hy + h * 0.02}" width="${s * 0.84}" height="${h * 0.05}" fill="${c.trim}"/>`
  return `<g>${t}</g>`
}
/** The case sitting on the ground, tilted with its slope (2026-10-26, the teacher: it hung off the planet). */
export const caseOn = (g: Ground, rank: number, x: number, y: number, s: number, open = false) =>
  `<g transform="rotate(${g.ang(x).toFixed(1)} ${x} ${y})">${caseSVG(rank, x, y, s, open)}</g>`
/**
 * The case alone as a picture, to fly in and be the prize wheel's chest (ChestOpening's `jarPicture`).
 * A picture can't fetch the case from inside itself, so the case goes in as data.
 */
export async function casePicture(rank: number): Promise<string> {
  let href = spaceArtUrl('case')
  try {
    const text = await (await fetch(href)).text()
    href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)
  } catch {
    return href
  }
  const inner = caseSVG(rank, 60, 104, 112).replaceAll(spaceArtUrl('case'), href)
  const svg = `<svg xmlns="${NS}" viewBox="0 0 120 110"><defs><radialGradient id="spaceCaseGlow"><stop offset="0" stop-color="#fff3b0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd84d" stop-opacity="0"/></radialGradient></defs>${inner}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/** The fuel panel, top right: where the fuel will take the class, its cells under that, and how full they are. */
export function fuelPanel(p: number, bars: number, full: boolean) {
  const n = TRIP_CELLS[p]
  const ch = 84
  const cw = ch * 0.5
  const rw = rowW(n, cw)
  const need = n * BARS_PER_CELL
  const name = PLACES[p + 1].name
  const pr = 20
  const tw = Math.max(70, name.length * 10.5)
  const pw = Math.max(rw + 40, 18 + pr * 2 + 10 + tw + 18)
  const ph = 16 + pr * 2 + 12 + ch + 34
  const x0 = W - pw - 14
  const y0 = 66
  const cx = x0 + 18 + pr
  const cy = y0 + 16 + pr
  // A big board's sky has room for a bigger panel; it grows from its top-right corner.
  const k = Math.max(1, H / 520)
  return `<g data-space-fuel="" transform="translate(${W - 14} ${y0}) scale(${k.toFixed(3)}) translate(${-(W - 14)} ${-y0})"><rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="20" fill="#ffffffe6"/>
    ${imC(PLACES[p + 1].art, cx, cy, pr * 2)}
    <g font-weight="700"><text x="${cx + pr + 10}" y="${cy - 3}" font-size="14" fill="#5b5480">Fuel for</text><text x="${cx + pr + 10}" y="${cy + 16}" font-size="18" fill="#3b3366">${name}</text></g>
    ${cellsRow(x0 + (pw - rw) / 2, cy + pr + 12, cw, ch, n, bars, 0.28, full)}
    <text data-space-fuel-words="" x="${x0 + pw / 2}" y="${y0 + ph - 12}" text-anchor="middle" font-weight="700" font-size="15" fill="#5b5480">${Math.min(bars, need)} of ${need} bars</text></g>`
}

/**
 * The planet the class is on: the ground, the flag, the rocket with the astronaut in its window, the
 * fuel panel and the title. `arriving` leaves the ground empty for the landing to fill.
 */
export function surfaceSVG(p: number, { arriving = false, bars = 0, full = false } = {}) {
  const g = ground(p)
  const pl = PLACES[p]
  let s = `<defs><radialGradient id="spaceCaseGlow"><stop offset="0" stop-color="#fff3b0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd84d" stop-opacity="0"/></radialGradient>
    <linearGradient id="spaceBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ffc4" stop-opacity=".85"/><stop offset="1" stop-color="#b8ff8a" stop-opacity=".25"/></linearGradient></defs>`
  s += imC(pl.art, g.cx, g.cy, g.size)
  if (!arriving) {
    const fx = W * SPOT.flag
    const rx = W * SPOT.rocket
    if (p > 0) s += flagSVG(fx, g.y(fx) + 4, H * 0.28)
    s += rocketSVG(rx, g.y(rx), { face: true })
  }
  if (p < 5 && !arriving) s += fuelPanel(p, bars, full)
  const label = `${arriving ? 'Landing on' : 'We are on'} ${pl.name}`
  const tw = Math.max(320, label.length * 13 + 50)
  s += `<g font-weight="700" text-anchor="middle"><rect x="${W / 2 - tw / 2}" y="14" width="${tw}" height="44" rx="22" fill="#ffffffe6"/><text x="${W / 2}" y="44" font-size="24" fill="#3b3366">${label}</text></g>`
  return s
}

/* ---------- the map: the whole trip, each one further than the last ---------- */

export type Pt = [number, number]
export type Curve = [Pt, Pt, Pt]
export interface MapPlace {
  x: number
  y: number
  r: number
  img: number
}
/** Earth and the planets left to right, the gaps growing: each trip is further. The view shows the place the class is on and the next. */
export function mapLayout(): MapPlace[] {
  const base = Math.min(W * 0.085, H * 0.2)
  const ys = [0.58, 0.44, 0.6, 0.42, 0.58, 0.46]
  let x = W * 0.2
  return PLACES.map((pl, j) => {
    if (j) x += W * (0.34 + 0.07 * (j - 1))
    return { x, y: ys[j] * H, r: base * pl.size, img: base * pl.size * 2 }
  })
}
export const mapCam = (P: MapPlace[], p: number) => P[Math.min(p, 4)].x - W * 0.2
export function routeOf(P: MapPlace[], i: number): Curve {
  const a = P[i]
  const b = P[i + 1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const bend = i % 2 ? -0.14 : 0.16
  const s: Pt = [a.x + ux * a.r * 1.3, a.y + uy * a.r * 1.3]
  const e: Pt = [b.x - ux * b.r * 1.45, b.y - uy * b.r * 1.45]
  return [s, [(s[0] + e[0]) / 2 - uy * len * bend, (s[1] + e[1]) / 2 + ux * len * bend], e]
}
const lerp = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
export const bez = ([p0, p1, p2]: Curve, t: number) => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t)
export const tangent = ([p0, p1, p2]: Curve, t: number) => {
  const a = lerp(p0, p1, t)
  const b = lerp(p1, p2, t)
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
}
const qd = ([p0, p1, p2]: Curve) => `M${f1(p0[0])} ${f1(p0[1])} Q${f1(p1[0])} ${f1(p1[1])} ${f1(p2[0])} ${f1(p2[1])}`

/** The map: the trips flown in gold, the ones ahead dotted with the cells they need, each planet reached with its flag and its prize. */
export function mapSVG({
  at,
  done = false,
  rocket = true,
  prizes,
  quest,
}: {
  at: number
  done?: boolean
  rocket?: boolean
  prizes: string[]
  quest: number
}) {
  const P = mapLayout()
  let routes = ''
  let places = ''
  let labels = ''
  for (let i = 0; i < 5; i++) {
    const c = routeOf(P, i)
    routes +=
      i < at || done
        ? `<path d="${qd(c)}" fill="none" stroke="${FLOWN}" stroke-width="4" stroke-dasharray="9 8" stroke-linecap="round"/>`
        : `<path d="${qd(c)}" fill="none" stroke="#ffffffaa" stroke-width="3" stroke-dasharray="4 10" stroke-linecap="round"/>`
    if (i >= at && !done) {
      const m = bez(c, 0.5)
      labels += `<g font-weight="700" text-anchor="middle"><rect x="${m[0] - 46}" y="${m[1] - 34}" width="92" height="24" rx="12" fill="#ffffff26"/><text x="${m[0]}" y="${m[1] - 16}" font-size="14" fill="#fff">${TRIP_CELLS[i]} ${TRIP_CELLS[i] > 1 ? 'cells' : 'cell'}</text></g>`
    }
  }
  P.forEach((g, j) => {
    places += imC(PLACES[j].art, g.x, g.y, g.img)
    if (j && (j <= at || done)) places += flagSVG(g.x - g.r * 0.25, g.y - g.r * 0.93, g.r * 0.5, false)
    const label = j === 0 ? 'Earth' : j <= at || done ? (prizes[j - 1] ?? cap(PLACES[j].name)) : cap(PLACES[j].name)
    const lw = Math.max(110, label.length * 9 + 26)
    const ly = g.y + g.r * 1.15
    labels += `<g font-weight="700" text-anchor="middle"><rect x="${g.x - lw / 2}" y="${ly}" width="${lw}" height="26" rx="13" fill="#ffffffe6"/><text x="${g.x}" y="${ly + 19}" font-size="15" fill="#3b3366">${label}</text></g>`
  })
  // The guardian, asleep in its UFO before the last planet.
  const gr = P[0].r * 0.95
  const gx = (P[4].x + P[5].x) / 2
  const gy = H - gr * 0.7
  places += `<g class="space-hover">${imC('ufo-2', gx, gy, gr)}<path d="M${gx - gr * 0.1} ${gy - gr * 0.06} q${gr * 0.1} ${gr * 0.07} ${gr * 0.2} 0" stroke="#2a3540" stroke-width="${gr * 0.035}" fill="#3fc1a4" stroke-linecap="round"/><text class="space-zzz" x="${gx + gr * 0.3}" y="${gy - gr * 0.35}" font-size="${gr * 0.26}" font-weight="700" fill="#fff">z</text></g>`
  const g = P[Math.min(at, 5)]
  const rh = Math.max(34, g.r * 0.7)
  const rk = rocket && !done ? imB('rocket-ship', g.x + g.r * 0.15, g.y - g.r * 0.92, rh, rh) : ''
  const cam = done ? 0 : mapCam(P, at)
  return `<g data-space-world="" style="transform-box:view-box;transform-origin:0 0;transform:translate(${-cam}px,0px)">${routes}${places}${labels}${rk}<g data-space-map-fx=""></g></g>
    <g font-weight="700" text-anchor="middle"><rect x="${W / 2 - 130}" y="14" width="260" height="44" rx="22" fill="#ffffffe6"/><text x="${W / 2}" y="44" font-size="26" fill="#3b3366">Our Quest${quest > 1 ? ' ' + quest : ''}</text></g>`
}

export interface Zoom {
  k: number
  tx: number
  ty: number
  cx: number
  cy: number
}
/** The map's transform that puts place p exactly where the planet view draws it, about the planet's top: so a zoom ends on the ground. */
export function zoomedOn(P: MapPlace[], p: number): Zoom {
  const g = ground(p)
  const m = P[p]
  const k = g.R / PLACES[p].rad / m.img
  return { k, tx: g.cx - k * m.x, ty: g.cy - k * m.y, cx: m.x, cy: m.y - m.img * PLACES[p].rad }
}
/** Frames for a zoom, the scale changing evenly to the eye (by its logarithm), the planet's top gliding between. */
export function zoomFrames(a: Zoom, b: Zoom, n = 24): Keyframe[] {
  const fr: Keyframe[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    const k = Math.exp(Math.log(a.k) * (1 - e) + Math.log(b.k) * e)
    const sx = (a.k * a.cx + a.tx) * (1 - e) + (b.k * b.cx + b.tx) * e
    const sy = (a.k * a.cy + a.ty) * (1 - e) + (b.k * b.cy + b.ty) * e
    fr.push({ transform: `translate(${(sx - k * a.cx).toFixed(2)}px, ${(sy - k * a.cy).toFixed(2)}px) scale(${k.toFixed(4)})` })
  }
  return fr
}
