import {
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
} from './marbles'

/**
 * The Marble Jar's pictures, drawn in code: the marbles in Toy Theater's flat look the teacher
 * liked (a flat colour, a dark edge and one shine from the top left, with a lighter band inside
 * that turns as it rolls), the glass jar, and the marble wheel. The jar and its marbles are drawn
 * on a canvas, one picture however many marbles there are ("Smooth on the board").
 */

export interface DrawnMarble {
  kind: MarbleKind
  colour: string
  x: number
  y: number
  angle: number
  r: number
  zapped?: boolean
  /** When it started popping away (emptying the jar), from performance.now(). */
  pop?: number
}

export function colourOf(kind: MarbleKind, index: number): string {
  if (kind === 'power') return POWER_COLOUR
  if (kind === 'mega') return MEGA_COLOUR
  return MARBLE_COLOURS[index % MARBLE_COLOURS.length]
}

export function fromSaved(m: SavedMarble): DrawnMarble {
  const kind = kindOf(m)
  return {
    kind,
    colour: colourOf(kind, m[1]),
    x: m[2],
    y: m[3],
    angle: m[4],
    r: m[5],
    zapped: kind === 'plain' && m[5] > RADIUS.plain + 0.05,
  }
}

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

/** A marble popping away as the jar empties: it swells a touch and goes, with a ring and a few bits of its colour. */
export function drawPop(ctx: CanvasRenderingContext2D, m: DrawnMarble, k: number) {
  ctx.save()
  ctx.globalAlpha = 1 - k
  ctx.beginPath()
  ctx.arc(m.x, m.y, m.r * (1 + 0.3 * k), 0, Math.PI * 2)
  ctx.fillStyle = m.colour
  ctx.fill()
  ctx.beginPath()
  ctx.arc(m.x, m.y, m.r * (1 + 0.8 * k), 0, Math.PI * 2)
  ctx.lineWidth = 0.12
  ctx.strokeStyle = '#fff'
  ctx.stroke()
  for (let d = 0; d < 6; d++) {
    const a = (d / 6) * Math.PI * 2 + m.r
    ctx.beginPath()
    ctx.arc(m.x + Math.cos(a) * m.r * (1.1 + k), m.y + Math.sin(a) * m.r * (1.1 + k), m.r * 0.14, 0, Math.PI * 2)
    ctx.fillStyle = m.colour
    ctx.fill()
  }
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
export function drawMiniJar(canvas: HTMLCanvasElement, marbles: SavedMarble[], full: boolean) {
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
    ctx.fillStyle = colourOf(kindOf(m), m[1])
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

/** The little wheel waiting at the meter's end for the goal to fill. */
export function miniWheelSVG(): string {
  const paths = WEDGES.map(
    (w) =>
      `<path d="${arc(46, w.from, w.to)}" fill="${w.tier === 'gold' ? '#fbbf24' : w.tier === 'silver' ? '#cbd5e1' : w.fill}" stroke="#fff" stroke-width="3"/>`,
  ).join('')
  return `<svg viewBox="-50 -50 100 100" aria-hidden="true">${paths}<circle r="47" fill="none" stroke="#8b5cf6" stroke-width="5"/><circle r="9" fill="#8b5cf6"/></svg>`
}

/**
 * The marble wheel, as the prize wheel is drawn: plain, silver and gold wedges, a ? on each while it
 * spins, and under each, hidden, what it pours in, shown only on the wedge it lands on.
 */
export function marbleWheelSVG(): string {
  const id = `mw${Math.random().toString(36).slice(2, 7)}`
  const wedges = WEDGES.map((w, i) => {
    const fill = w.tier === 'gold' ? `url(#${id}gold)` : w.tier === 'silver' ? `url(#${id}silver)` : w.fill
    const mid = (w.from + w.to) / 2
    const fit = Math.min(1, (w.to - w.from) / 40)
    const ink = w.tier === 'gold' ? '#7c2d12' : w.tier === 'silver' ? '#334155' : '#fff'
    const star =
      w.tier === 'gold'
        ? `<path transform="translate(0 -24) scale(.42)" d="M0 -12 L3.5 -3.7 L12 -3.7 L5 1.6 L7.6 10.4 L0 5 L-7.6 10.4 L-5 1.6 L-12 -3.7 L-3.5 -3.7 Z" fill="#fff7cf"/>`
        : ''
    let reveal = ''
    if (w.id === 'mega') reveal = marbleSVG(MEGA_COLOUR, { r: 16, y: -2, swirl: true })
    else if (w.id === 'power') reveal = marbleSVG(POWER_COLOUR, { r: 12, y: -2, bolt: true })
    else {
      const n = Number(w.id)
      reveal = Array.from({ length: n }, (_, k) =>
        marbleSVG(MARBLE_COLOURS[(k * 3 + i) % MARBLE_COLOURS.length], { r: 5.4, x: (k - (n - 1) / 2) * 8, y: -4 + (k % 2) * 6 }),
      ).join('')
    }
    return `<g data-slice="${i}"><path d="${arc(94, w.from, w.to)}" fill="${fill}" stroke="rgba(255,255,255,.8)" stroke-width="1.5"/><g data-face="${i}" transform="rotate(${mid.toFixed(2)}) translate(0 -62) scale(${fit.toFixed(3)})"><text text-anchor="middle" dominant-baseline="central" font-family="Andika, sans-serif" font-weight="700" font-size="34" fill="${ink}">?</text>${star}</g><g data-reveal="${i}" opacity="0" transform="rotate(${mid.toFixed(2)}) translate(0 -64) scale(${fit.toFixed(3)})"><g data-pop="" style="transform-box:fill-box;transform-origin:center">${reveal}</g></g></g>`
  }).join('')
  const pegs = Array.from({ length: 16 }, (_, i) => {
    const a = ((i * 22.5 + 11.25) * Math.PI) / 180
    return `<circle cx="${(Math.sin(a) * 101).toFixed(1)}" cy="${(-Math.cos(a) * 101).toFixed(1)}" r="3" fill="#ffd84d" stroke="#6b3f00" stroke-width="1"/>`
  }).join('')
  return `<svg viewBox="-112 -112 224 224" aria-hidden="true"><defs><linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#e08a0b"/></linearGradient><linearGradient id="${id}silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset=".5" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/></linearGradient></defs><circle r="106" fill="#8b5cf6"/><circle r="99" fill="#5b3fa0"/>${wedges}${pegs}<circle r="16" fill="#8b5cf6" stroke="#5b3fa0" stroke-width="2"/><circle r="6.5" fill="#ffd84d"/></svg>`
}

/** What doesn't turn on a marble: the Power Marble's glow (and a zapped one's), the shine, and the bolt. */
export function drawStill(ctx: CanvasRenderingContext2D, m: DrawnMarble) {
  const { r } = m
  if (m.kind === 'power' || m.zapped) {
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2)
    ctx.arc(0, 0, r, 0, Math.PI * 2, true)
    ctx.fillStyle = 'rgba(160, 220, 255, 0.28)'
    ctx.fill()
  }
  if (m.kind === 'power') {
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
  ctx.beginPath()
  ctx.ellipse(-r * 0.42, -r * 0.46, r * 0.2, r * 0.13, -0.7, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-r * 0.15, -r * 0.62, r * 0.06, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * The jar with its marbles as one picture, for the prize wheel to rise out of: drawn from where the
 * marbles were kept, at the size asked.
 */
export function jarPicture(marbles: SavedMarble[], widthPx: number): string | null {
  const c = document.createElement('canvas')
  const scale = widthPx / JAR.W
  c.width = Math.round(widthPx)
  c.height = Math.round(JAR.H * scale)
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  drawJarBack(ctx)
  for (const m of marbles) drawMarble(ctx, fromSaved(m), scale)
  drawJarFront(ctx)
  try {
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}
