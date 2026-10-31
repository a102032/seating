import { assetUrl } from './assets'
import {
  DESIGN_COLOUR,
  JAR,
  JAR_PATH,
  MARBLE_COLOURS,
  MEGA_COLOUR,
  POWER_COLOUR,
  RADIUS,
  WEDGES,
  kindOf,
  type MarbleKind,
  type SavedMarble,
  type Season,
  type Wedge,
} from './marbles'

/**
 * The Marble Jar's pictures, drawn in code: the marbles in Toy Theater's flat look the teacher
 * liked (a flat colour, a dark edge and one shine from the top left, with a lighter band inside
 * that turns as it rolls), the glass jar, and the marble wheel. The jar and its marbles are drawn
 * on a canvas, one picture however many marbles there are ("Smooth on the board").
 */

export interface DrawnMarble {
  kind: 'plain' | 'power' | 'mega'
  colour: string
  x: number
  y: number
  angle: number
  r: number
  zapped?: boolean
  /** When it started popping away (emptying the jar), from performance.now(). */
  pop?: number
}

export function colourOf(kind: MarbleKind, index: number, design?: string): string {
  if (design && DESIGN_COLOUR[design]) return DESIGN_COLOUR[design]
  if (kind === 'power') return POWER_COLOUR
  if (kind === 'mega') return MEGA_COLOUR
  if (kind === 'megamega') return DESIGN_COLOUR.megamega
  return MARBLE_COLOURS[index % MARBLE_COLOURS.length]
}

/** A saved marble's colour, its design's if it has one. */
export const savedColour = (m: SavedMarble) => colourOf(kindOf(m), m[1], m[6])
export const isZapped = (m: SavedMarble) => kindOf(m) === 'plain' && m[5] > RADIUS.plain + 0.05

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (s: number) => Math.round(((n >> s) & 255) * k)
  return `rgb(${c(16)},${c(8)},${c(0)})`
}
function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (s: number) => {
    const v = (n >> s) & 255
    return Math.round(v + (255 - v) * k)
  }
  return `rgb(${c(16)},${c(8)},${c(0)})`
}

/**
 * One marble, in the canvas's current units (scale is pixels to a unit, for the edge's least width).
 * turningOnly leaves out what never turns (the glow, the bolt and the shine), for MarbleSprites.
 */
export function drawMarble(ctx: CanvasRenderingContext2D, m: DrawnMarble, scale: number, turningOnly = false) {
  const { x, y, r, angle, colour } = m
  ctx.save()
  ctx.translate(x, y)
  if (!turningOnly && (m.kind === 'power' || m.zapped)) {
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(160, 220, 255, 0.28)'
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = colour
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.ellipse(r * 0.15, 0, r * 0.32, r * 1.1, 0.5, 0, Math.PI * 2)
  ctx.fillStyle = tint(colour, 0.35)
  ctx.globalAlpha = 0.55
  ctx.fill()
  ctx.globalAlpha = 1
  if (m.kind === 'mega') {
    // The Mega's cat's-eye swirl: three petals of gold that turn with it.
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3)
      ctx.beginPath()
      ctx.ellipse(0, -r * 0.42, r * 0.14, r * 0.5, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#ffd84d'
      ctx.fill()
    }
  }
  if (m.kind === 'power' && !turningOnly) {
    // A bolt inside the Power Marble, always upright.
    ctx.rotate(-angle)
    ctx.beginPath()
    ctx.moveTo(r * 0.12, -r * 0.62)
    ctx.lineTo(-r * 0.3, r * 0.08)
    ctx.lineTo(r * 0.02, r * 0.08)
    ctx.lineTo(-r * 0.14, r * 0.62)
    ctx.lineTo(r * 0.32, -r * 0.1)
    ctx.lineTo(0, -r * 0.1)
    ctx.closePath()
    ctx.fillStyle = '#fff6a8'
    ctx.fill()
  }
  ctx.restore()
  // The light comes from the top left, so the shine never turns.
  if (!turningOnly) {
    ctx.beginPath()
    ctx.ellipse(-r * 0.42, -r * 0.46, r * 0.2, r * 0.13, -0.7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-r * 0.15, -r * 0.62, r * 0.06, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.lineWidth = Math.max(1.2 / scale, r * 0.085)
  ctx.strokeStyle = shade(colour, 0.42)
  ctx.stroke()
  ctx.restore()
}

function outline(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  JAR_PATH.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
}

/** The glass behind the marbles, and the dashed fill line: marbles up to here and the jar is full. */
export function drawJarBack(ctx: CanvasRenderingContext2D) {
  const { CX, WALL, FILL_Y } = JAR
  outline(ctx)
  ctx.closePath()
  ctx.fillStyle = 'rgba(210, 240, 255, 0.16)'
  ctx.fill()
  ctx.save()
  outline(ctx)
  ctx.closePath()
  ctx.clip()
  ctx.setLineDash([0.55, 0.45])
  ctx.lineWidth = 0.18
  ctx.strokeStyle = 'rgba(255, 216, 77, 0.95)'
  ctx.beginPath()
  ctx.moveTo(CX - WALL, FILL_Y)
  ctx.lineTo(CX + WALL, FILL_Y)
  ctx.stroke()
  ctx.restore()
}

/** The glass in front: its edge, a shine down each side, and the thick lip of the rim. */
export function drawJarFront(ctx: CanvasRenderingContext2D) {
  const { CX, WALL, SHOULDER, FLOOR, NECK, MOUTH } = JAR
  outline(ctx)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 0.32
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.stroke()
  ctx.lineWidth = 0.12
  ctx.strokeStyle = 'rgba(120, 170, 210, 0.9)'
  ctx.stroke()
  ctx.lineCap = 'round'
  const streak = (x: number, y0: number, y1: number, w: number, a: number) => {
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
    ctx.lineWidth = w
    ctx.strokeStyle = `rgba(255,255,255,${a})`
    ctx.stroke()
  }
  streak(CX - WALL + 0.8, SHOULDER + 1, FLOOR - 2.6, 0.45, 0.55)
  streak(CX - WALL + 1.7, SHOULDER + 1.6, SHOULDER + 4, 0.22, 0.45)
  streak(CX + WALL - 0.6, SHOULDER + 2, FLOOR - 3, 0.18, 0.25)
  ctx.beginPath()
  ctx.roundRect(CX - NECK - 0.55, MOUTH - 0.55, NECK * 2 + 1.1, 0.95, 0.45)
  ctx.fillStyle = 'rgba(235, 248, 255, 0.85)'
  ctx.fill()
  ctx.lineWidth = 0.1
  ctx.strokeStyle = 'rgba(120, 170, 210, 0.9)'
  ctx.stroke()
}

/**
 * The small jar at the meter's end: the class's own marbles, where they settled, drawn small.
 * Drawn once into a canvas whenever the jar changes; nothing in it moves.
 */
export function drawMiniJar(canvas: HTMLCanvasElement, marbles: SavedMarble[], full: boolean, season: Season = 'none') {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const top = 4.6
  const s = canvas.height / (JAR.H - top)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(s, 0, 0, s, (canvas.width - JAR.W * s) / 2, -top * s)
  outline(ctx)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()
  for (const m of marbles) {
    ctx.beginPath()
    ctx.arc(m[2], m[3], m[5], 0, Math.PI * 2)
    ctx.fillStyle = savedColour(m)
    ctx.fill()
  }
  outline(ctx)
  ctx.lineWidth = 0.75
  ctx.lineJoin = 'round'
  ctx.strokeStyle = full ? '#d97706' : '#5b7fa6'
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(JAR.CX - JAR.NECK - 0.6, JAR.MOUTH - 0.8, JAR.NECK * 2 + 1.2, 1.3, 0.5)
  ctx.fillStyle = full ? '#d97706' : '#5b7fa6'
  ctx.fill()
  // The season's touch, as on the jar's own screen: snow on the rim, or the New Year's red ribbon, or an orange rim in October.
  if (season === 'dec' || season === 'lny' || season === 'oct') {
    ctx.beginPath()
    ctx.roundRect(
      JAR.CX - JAR.NECK - 0.6,
      season === 'lny' ? JAR.NECK_TOP - 0.9 : JAR.MOUTH - 1.3,
      JAR.NECK * 2 + 1.2,
      season === 'lny' ? 1 : 1.1,
      0.5,
    )
    ctx.fillStyle = season === 'dec' ? '#f6fbff' : season === 'lny' ? '#d62828' : '#f47a12'
    ctx.fill()
  }
}

/** A marble as a small SVG, for the meter's rider and the wheel's faces. */
export function marbleSVG(colour: string, opts: { r?: number; x?: number; y?: number; bolt?: boolean; swirl?: boolean } = {}): string {
  const { r = 10, x = 0, y = 0 } = opts
  const edge = shade(colour, 0.42)
  const swirl = opts.swirl
    ? [0, 120, 240]
        .map(
          (a) =>
            `<ellipse cx="${x}" cy="${y - r * 0.42}" rx="${r * 0.14}" ry="${r * 0.5}" fill="#ffd84d" transform="rotate(${a} ${x} ${y})"/>`,
        )
        .join('')
    : ''
  const bolt = opts.bolt
    ? `<path transform="translate(${x} ${y}) scale(${r / 10})" d="M1.2 -6.2 L-3 0.8 L0.2 0.8 L-1.4 6.2 L3.2 -1 L0 -1 Z" fill="#fff6a8"/>`
    : ''
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}"/>${swirl}${bolt}<ellipse cx="${x - r * 0.42}" cy="${y - r * 0.46}" rx="${r * 0.2}" ry="${r * 0.13}" fill="#fff" transform="rotate(-40 ${x - r * 0.42} ${y - r * 0.46})"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${edge}" stroke-width="${Math.max(0.8, r * 0.09)}"/>`
}

/** The marble that rides the meter on the Marble Jar, as the knight does on the Knight's quest. */
export const RIDER_SVG = `<svg viewBox="-12 -12 24 24" aria-hidden="true">${marbleSVG('#2b9be0', { r: 11 })}</svg>`

function arc(r: number, a0: number, a1: number): string {
  const p = (a: number) => [Math.sin((a * Math.PI) / 180) * r, -Math.cos((a * Math.PI) / 180) * r]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

const wedgeFill = (w: Wedge, id: string) =>
  w.tier === 'gold'
    ? `url(#${id}gold)`
    : w.id === 'power'
      ? '#7f8ca3'
      : w.id === 'rain'
        ? '#9cc9f5'
        : w.id === 'popcorn'
          ? `url(#${id}stripes)`
          : w.id === 'witch'
            ? '#8b5cf6'
            : w.id === 'santa'
              ? '#e11d2e'
              : w.id === 'envelope'
                ? '#b91c1c'
                : (w.fill ?? '#38bdf8')

/** The little wheel waiting at the meter's end for the goal to fill. */
export function miniWheelSVG(wedges: Wedge[] = WEDGES): string {
  const id = `mm${Math.random().toString(36).slice(2, 7)}`
  const paths = wedges.map((w) => `<path d="${arc(46, w.from, w.to)}" fill="${wedgeFill(w, id)}" stroke="#fff" stroke-width="3"/>`).join('')
  return `<svg viewBox="-50 -50 100 100" aria-hidden="true"><defs><linearGradient id="${id}gold"><stop stop-color="#fbbf24"/></linearGradient><pattern id="${id}stripes" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#fff"/><rect width="7" height="14" fill="#ef4444"/></pattern></defs>${paths}<circle r="47" fill="none" stroke="#8b5cf6" stroke-width="5"/><circle r="9" fill="#8b5cf6"/></svg>`
}

/** Each special wedge's picture (the teacher: a picture, not a word), the Mega drawn by the marble code. */
const WEDGE_ART: Partial<Record<string, string>> = {
  rain: 'rain.svg',
  popcorn: 'popcorn.svg',
  power: 'power.svg',
  witch: 'hatpk.svg',
  santa: 'sled.svg',
  envelope: 'envelope.svg',
}
export const wedgePicture = (wedge: string) => (WEDGE_ART[wedge] ? assetUrl(`/marbles/${WEDGE_ART[wedge]}`) : null)

/**
 * The marble wheel, as the prize wheel is drawn: a number on each plain wedge, a picture on each
 * special one (2026-10-31: the teacher, from the preview), the Power silver and the Mega gold.
 * Only the wedge it lands on stays bright and its face pops.
 */
export function marbleWheelSVG(wedges: Wedge[] = WEDGES): string {
  const id = `mw${Math.random().toString(36).slice(2, 7)}`
  const parts = wedges
    .map((w, i) => {
      const mid = (w.from + w.to) / 2
      const pic = wedgePicture(w.id)
      const face =
        w.id === 'mega'
          ? marbleSVG(MEGA_COLOUR, { r: 17, swirl: true })
          : pic
            ? `<image href="${pic}" x="-19" y="-19" width="38" height="38"/>`
            : `<text text-anchor="middle" dominant-baseline="central" font-family="Andika, sans-serif" font-weight="700" font-size="36" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width="1.5" paint-order="stroke">5</text>`
      return `<g data-slice="${i}" data-wedge="${w.id}"><path d="${arc(94, w.from, w.to)}" fill="${wedgeFill(w, id)}" stroke="rgba(255,255,255,.8)" stroke-width="1.5"/><g data-face="${i}" transform="rotate(${mid.toFixed(2)}) translate(0 -60)"><g data-pop="" style="transform-box:fill-box;transform-origin:center">${face}</g></g></g>`
    })
    .join('')
  const pegs = Array.from({ length: 16 }, (_, i) => {
    const a = ((i * 22.5 + 11.25) * Math.PI) / 180
    return `<circle cx="${(Math.sin(a) * 101).toFixed(1)}" cy="${(-Math.cos(a) * 101).toFixed(1)}" r="3" fill="#ffd84d" stroke="#6b3f00" stroke-width="1"/>`
  }).join('')
  return `<svg viewBox="-112 -112 224 224" aria-hidden="true"><defs><linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#e08a0b"/></linearGradient><pattern id="${id}stripes" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff"/><rect width="6" height="12" fill="#ef4444"/></pattern></defs><circle r="106" fill="#8b5cf6"/><circle r="99" fill="#5b3fa0"/>${parts}${pegs}<circle r="16" fill="#8b5cf6" stroke="#5b3fa0" stroke-width="2"/><circle r="6.5" fill="#ffd84d"/></svg>`
}
