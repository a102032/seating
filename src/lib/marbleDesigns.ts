import { assetUrl } from './assets'
import { drawJarBack, drawJarFront, drawMarble, isZapped, savedColour } from './marbleArt'
import { JAR, kindOf, type MarbleKind, type SavedMarble } from './marbles'

/**
 * The Marble Jar's pictures beyond the plain marbles (2026-10-31, the students' ideas, worked out in
 * the "Marble Jar Ideas" preview): the teacher's own Flaticon pictures (public/marbles, tidied copies
 * of design/marbles), the seasons' marble designs, popcorn and the Mega Mega Marble, drawn in code.
 */

/** The teacher's pictures, and each one's shape (width over height). */
export const ART: Record<string, { file: string; aspect: number }> = {
  pk1: { file: 'pk1.svg', aspect: 1.0333 },
  pk2: { file: 'pk2.svg', aspect: 1.0333 },
  pk3: { file: 'pk3.svg', aspect: 1.0333 },
  pk4: { file: 'pk4.svg', aspect: 1.0333 },
  pk5: { file: 'pk5.svg', aspect: 1.0333 },
  lolly: { file: 'lolly.svg', aspect: 1 },
  hatpk: { file: 'hatpk.svg', aspect: 0.8572 },
  cat: { file: 'cat.svg', aspect: 1 },
  spider: { file: 'spider.svg', aspect: 1 },
  bat: { file: 'bat.svg', aspect: 1 },
  ghost: { file: 'ghost.svg', aspect: 1 },
  orn1: { file: 'orn1.svg', aspect: 1 },
  orn2: { file: 'orn2.svg', aspect: 1 },
  orn3: { file: 'orn3.svg', aspect: 1 },
  tree: { file: 'tree.svg', aspect: 1 },
  mistletoe: { file: 'mistletoe.svg', aspect: 1 },
  sled: { file: 'sled.svg', aspect: 1 },
  envelope: { file: 'envelope.svg', aspect: 1 },
  basket: { file: 'basket.svg', aspect: 1 },
  popcorn: { file: 'popcorn.svg', aspect: 1 },
  rain: { file: 'rain.svg', aspect: 1 },
  snowman: { file: 'snowman.svg', aspect: 1 },
  power: { file: 'power.svg', aspect: 1 },
  bucket: { file: 'bucket.svg', aspect: 1 },
  // The teacher's witch, made in Gemini and cut out of its white (design/marbles/witch/cutout.py).
  witch: { file: 'witch.webp', aspect: 0.7468 },
}
export const artUrl = (name: string) => assetUrl(`/marbles/${ART[name].file}`)

const IMG: Record<string, HTMLImageElement> = {}
const waiting = new Set<() => void>()
/** A picture, loading the first time it is asked for; whoever is listening hears when any arrives. */
export function picture(name: string): HTMLImageElement | null {
  if (!ART[name]) return null
  let im = IMG[name]
  if (!im) {
    im = new Image()
    im.decoding = 'async'
    im.onload = () => waiting.forEach((fn) => fn())
    im.src = artUrl(name)
    IMG[name] = im
  }
  return im.complete && im.naturalWidth ? im : null
}
export function onPicture(fn: () => void): () => void {
  waiting.add(fn)
  return () => waiting.delete(fn)
}
export function loadPictures(names: string[]) {
  for (const n of names) picture(n)
}

/**
 * Each picture turned into a bitmap once for the size it is drawn at (to the nearest 16 pixels):
 * a board redrawing an SVG picture for every bat on every frame was most of its work.
 */
const RASTER = new Map<string, HTMLCanvasElement>()
function raster(name: string, im: HTMLImageElement, px: number): HTMLCanvasElement | HTMLImageElement {
  const w = Math.max(16, Math.min(2048, Math.ceil(px / 16) * 16))
  const key = `${name}|${w}`
  let c = RASTER.get(key)
  if (!c) {
    c = document.createElement('canvas')
    c.width = w
    c.height = Math.max(1, Math.round(w / ART[name].aspect))
    try {
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
    } catch {
      return im
    }
    if (RASTER.size > 120) RASTER.clear()
    RASTER.set(key, c)
  }
  return c
}

/** One of the pictures, its middle at (x, y), w wide (its own shape kept). A picture this browser can't draw is left out, never the whole jar. */
export function drawArt(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, angle = 0, sy = 1, sx = 1) {
  const im = picture(name)
  if (!im) return
  const h = w / ART[name].aspect
  const t = ctx.getTransform()
  const bitmap = raster(name, im, Math.hypot(t.a, t.b) * w)
  ctx.save()
  ctx.translate(x, y)
  if (angle) ctx.rotate(angle)
  if (sy !== 1 || sx !== 1) ctx.scale(sx, sy)
  try {
    ctx.drawImage(bitmap, -w / 2, -h / 2, w, h)
  } catch {
    // left out
  }
  ctx.restore()
}

/**
 * A picture as a marble's face: its round part (centre cx, cy as shares of the picture; d the round
 * part's width as a share) filling the marble, anything outside it (a stem, a hanger) cut off.
 */
const FACE: Record<string, { cx: number; cy: number; d: number }> = {
  pk1: { cx: 0.5, cy: 0.55, d: 0.88 },
  pk2: { cx: 0.5, cy: 0.55, d: 0.88 },
  pk3: { cx: 0.5, cy: 0.55, d: 0.88 },
  pk4: { cx: 0.5, cy: 0.55, d: 0.88 },
  pk5: { cx: 0.5, cy: 0.55, d: 0.88 },
  lolly: { cx: 0.5, cy: 0.5, d: 0.98 },
  orn1: { cx: 0.5, cy: 0.565, d: 0.83 },
  orn2: { cx: 0.5, cy: 0.57, d: 0.83 },
  orn3: { cx: 0.5, cy: 0.565, d: 0.83 },
}
export const RAINBOW = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#5cbf4a', '#2b9be0', '#9b6ef3']

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (s: number) => Math.round(((n >> s) & 255) * k)
  return `rgb(${c(16)},${c(8)},${c(0)})`
}

/** A design painted on a marble, drawn at the origin, turned with it, inside its edge. */
function paint(ctx: CanvasRenderingContext2D, design: string, r: number) {
  const dot = (x: number, y: number, rx: number, ry: number, fill: string) => {
    ctx.beginPath()
    ctx.ellipse(x * r, y * r, rx * r, ry * r, 0, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
  }
  const band = (y0: number, y1: number, fill: string) => {
    ctx.fillStyle = fill
    ctx.fillRect(-r, y0 * r, 2 * r, (y1 - y0) * r)
  }
  const face = FACE[design]
  if (face) {
    const im = picture(design)
    if (!im) return
    const w = (2 * r * 1.04) / face.d
    const h = w / ART[design].aspect
    ctx.drawImage(im, -face.cx * w, -face.cy * h, w, h)
    return
  }
  switch (design) {
    case 'ghost':
      dot(-0.3, -0.12, 0.12, 0.19, '#1d1d2b')
      dot(0.3, -0.12, 0.12, 0.19, '#1d1d2b')
      dot(0, 0.32, 0.13, 0.16, '#1d1d2b')
      dot(-0.55, 0.15, 0.12, 0.07, 'rgba(255,140,170,.6)')
      dot(0.55, 0.15, 0.12, 0.07, 'rgba(255,140,170,.6)')
      break
    case 'franken':
      ctx.fillStyle = '#1e1e1e'
      ctx.beginPath()
      ctx.moveTo(-r, -r)
      ctx.lineTo(r, -r)
      ctx.lineTo(r, -0.42 * r)
      ;[0.6, 0.3, 0, -0.3, -0.6].forEach((x, i) => ctx.lineTo(x * r, (i % 2 ? -0.42 : -0.3) * r))
      ctx.lineTo(-r, -0.42 * r)
      ctx.fill()
      dot(-0.3, 0.02, 0.1, 0.1, '#1e1e1e')
      dot(0.3, 0.02, 0.1, 0.1, '#1e1e1e')
      ctx.strokeStyle = '#1e1e1e'
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.moveTo(-0.3 * r, 0.42 * r)
      ctx.lineTo(0.3 * r, 0.42 * r)
      for (const x of [-0.15, 0.05, 0.22]) {
        ctx.moveTo(x * r, 0.34 * r)
        ctx.lineTo(x * r, 0.5 * r)
      }
      ctx.stroke()
      ctx.fillStyle = '#9aa3ad'
      ctx.fillRect(-1.0 * r, 0.05 * r, 0.22 * r, 0.22 * r)
      ctx.fillRect(0.78 * r, 0.05 * r, 0.22 * r, 0.22 * r)
      break
    case 'bat':
      ctx.fillStyle = '#1c1030'
      ctx.beginPath()
      ctx.moveTo(0, -0.18 * r)
      ctx.quadraticCurveTo(0.35 * r, -0.5 * r, 0.85 * r, -0.3 * r)
      ctx.quadraticCurveTo(0.7 * r, 0, 0.78 * r, 0.25 * r)
      ctx.quadraticCurveTo(0.5 * r, 0.05 * r, 0.32 * r, 0.25 * r)
      ctx.quadraticCurveTo(0.18 * r, 0.08 * r, 0, 0.3 * r)
      ctx.quadraticCurveTo(-0.18 * r, 0.08 * r, -0.32 * r, 0.25 * r)
      ctx.quadraticCurveTo(-0.5 * r, 0.05 * r, -0.78 * r, 0.25 * r)
      ctx.quadraticCurveTo(-0.7 * r, 0, -0.85 * r, -0.3 * r)
      ctx.quadraticCurveTo(-0.35 * r, -0.5 * r, 0, -0.18 * r)
      ctx.fill()
      dot(0, -0.05, 0.16, 0.2, '#1c1030')
      dot(-0.06, -0.1, 0.035, 0.035, '#ffd23f')
      dot(0.06, -0.1, 0.035, 0.035, '#ffd23f')
      break
    case 'snowflake': {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = r * 0.09
      ctx.lineCap = 'round'
      for (let i = 0; i < 6; i++) {
        ctx.save()
        ctx.rotate((i * Math.PI) / 3)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, -0.7 * r)
        ctx.moveTo(0, -0.42 * r)
        ctx.lineTo(0.16 * r, -0.56 * r)
        ctx.moveTo(0, -0.42 * r)
        ctx.lineTo(-0.16 * r, -0.56 * r)
        ctx.stroke()
        ctx.restore()
      }
      break
    }
    case 'peppermint':
      ctx.fillStyle = '#e11d2e'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, r, (i * Math.PI) / 3, (i * Math.PI) / 3 + Math.PI / 6)
        ctx.closePath()
        ctx.fill()
      }
      dot(0, 0, 0.22, 0.22, '#fff')
      break
    case 'candycane':
      ctx.save()
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = '#e11d2e'
      for (let x = -1.2; x < 1.2; x += 0.5) ctx.fillRect(x * r, -1.5 * r, 0.22 * r, 3 * r)
      ctx.fillStyle = '#2a9d5c'
      for (let x = -0.95; x < 1.2; x += 1) ctx.fillRect(x * r, -1.5 * r, 0.07 * r, 3 * r)
      ctx.restore()
      break
    case 'snowball':
      for (const [x, y] of [
        [-0.4, -0.2],
        [0.3, 0.3],
        [0.1, -0.5],
        [-0.2, 0.5],
        [0.55, -0.15],
      ])
        dot(x, y, 0.08, 0.08, '#bfe0ff')
      break
    case 'fu':
      // 福, the same in Traditional and Simplified; it turns as the marble rolls, so some land upside down, the lucky 倒福.
      ctx.strokeStyle = '#ffd23f'
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.arc(0, 0, 0.68 * r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#ffd23f'
      ctx.font = `bold ${r * 0.85}px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('福', 0, r * 0.05)
      break
    case 'coin':
      ctx.strokeStyle = '#c99510'
      ctx.lineWidth = r * 0.1
      ctx.beginPath()
      ctx.arc(0, 0, 0.72 * r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#7a5600'
      ctx.fillRect(-0.2 * r, -0.2 * r, 0.4 * r, 0.4 * r)
      break
    case 'lantern':
      band(-1, -0.68, '#ffd23f')
      band(0.68, 1, '#ffd23f')
      ctx.strokeStyle = '#b5172a'
      ctx.lineWidth = r * 0.08
      for (const w of [0.35, 0.7]) {
        ctx.beginPath()
        ctx.ellipse(0, 0, w * r, 0.7 * r, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    case 'mandarin':
      for (const [x, y] of [
        [-0.3, -0.1],
        [0.2, 0.3],
        [0.35, -0.3],
        [-0.15, 0.45],
        [0, 0],
      ])
        dot(x, y, 0.05, 0.05, '#e5800d')
      ctx.fillStyle = '#3f8f2f'
      ctx.beginPath()
      ctx.ellipse(0.2 * r, -0.85 * r, 0.3 * r, 0.12 * r, -0.5, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'puffed':
    case 'puffedButter': {
      // Popped corn: lumpy puffs, white with butter yellow or the other way round.
      const other = design === 'puffed' ? '#ffd65a' : '#fffaf0'
      for (const [x, y, rr] of [
        [-0.45, -0.35, 0.36],
        [0.35, -0.45, 0.3],
        [0.5, 0.25, 0.34],
        [-0.2, 0.5, 0.3],
        [0.02, 0.02, 0.26],
      ])
        dot(x, y, rr, rr * 0.9, other)
      ctx.strokeStyle = 'rgba(180,130,40,.35)'
      ctx.lineWidth = r * 0.05
      for (const [x, y, rr] of [
        [-0.45, -0.35, 0.36],
        [0.5, 0.25, 0.34],
      ]) {
        ctx.beginPath()
        ctx.arc(x * r, y * r, rr * r, 0.4, 2.6)
        ctx.stroke()
      }
      break
    }
    case 'popcorn':
      ctx.fillStyle = '#e11d2e'
      for (let x = -1; x < 1; x += 0.5) ctx.fillRect(x * r, -r, 0.25 * r, 2 * r)
      ctx.fillStyle = '#ffe27a'
      ctx.fillRect(-r, -0.16 * r, 2 * r, 0.32 * r)
      break
    case 'megamega': {
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3)
        ctx.beginPath()
        ctx.ellipse(0, -0.45 * r, 0.16 * r, 0.52 * r, 0.35, 0, Math.PI * 2)
        ctx.fillStyle = RAINBOW[i]
        ctx.fill()
      }
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39
        const d = 0.25 + ((i * 37) % 10) / 14
        dot(Math.cos(a) * d * 0.9, Math.sin(a) * d * 0.9, 0.035, 0.035, '#fff')
      }
      dot(0, 0, 0.16, 0.16, '#fff8d6')
      break
    }
  }
}

export interface Ball {
  kind: MarbleKind | 'kernel' | 'popcorn' | 'present' | 'envelope'
  colour: string
  design?: string
  r: number
  zapped?: boolean
}

const edgeOf = (colour: string) =>
  colour === '#fffaf0' ? '#c9a45a' : colour === '#ffffff' || colour === '#f4f6ff' || colour === '#f2f8ff' ? '#9aa6c0' : shade(colour, 0.42)

/** The part of a marble that turns as it rolls: its colour, its band or design, and its edge. */
export function drawTurning(ctx: CanvasRenderingContext2D, m: Ball, scale: number) {
  const { r, colour } = m
  if ((m.kind === 'plain' || m.kind === 'power' || m.kind === 'mega' || m.kind === 'drop' || m.kind === 'kernel') && !m.design) {
    drawMarble(
      ctx,
      { kind: m.kind === 'power' || m.kind === 'mega' ? m.kind : 'plain', colour, x: 0, y: 0, angle: 0, r, zapped: m.zapped },
      scale,
      true,
    )
    return
  }
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = colour
  ctx.fill()
  ctx.save()
  ctx.clip()
  if (m.design) paint(ctx, m.design, r)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.lineWidth = Math.max(1.2 / scale, r * 0.085)
  ctx.strokeStyle = edgeOf(colour)
  ctx.stroke()
}

/** What never turns on a marble: the glow of a Power Marble (and the Mega Mega's), its bolt, and the shine from the top left. */
export function drawStillPart(ctx: CanvasRenderingContext2D, m: Ball) {
  const { r } = m
  if (m.kind === 'megamega') {
    const g = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.5)
    g.addColorStop(0, 'rgba(255,230,120,.55)')
    g.addColorStop(1, 'rgba(255,230,120,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2)
    ctx.arc(0, 0, r, 0, Math.PI * 2, true)
    ctx.fill()
  }
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
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-r * 0.15, -r * 0.62, r * 0.06, 0, Math.PI * 2)
  ctx.fill()
}

/** A whole marble, drawn straight (the jar's picture for the prize wheel, the Mega Mega rising). */
export function drawBall(ctx: CanvasRenderingContext2D, m: Ball, x: number, y: number, angle: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.save()
  ctx.rotate(angle)
  drawTurning(ctx, m, scale)
  ctx.restore()
  drawStillPart(ctx, m)
  ctx.restore()
}

/**
 * Each kind of marble drawn once into two small pictures (what turns, and what doesn't), then
 * stamped where it is every frame: a few hundred stamps a frame cost the board far less than
 * drawing each marble's shapes again ("Smooth on the board").
 */
const ROOM = 1.6
export class BallSprites {
  private cache = new Map<string, { turn: HTMLCanvasElement; still: HTMLCanvasElement; base: number }>()
  private ppu = 0

  /** Pixels to a unit on the screen; drawn again only when the size changes a lot. */
  setScale(ppu: number) {
    if (Math.abs(ppu - this.ppu) > this.ppu * 0.15) {
      this.ppu = ppu
      this.cache.clear()
    }
  }
  clear() {
    this.cache.clear()
  }

  draw(ctx: CanvasRenderingContext2D, m: Ball, x: number, y: number, angle: number, alpha = 1, grow = 1) {
    const key = `${m.kind}|${m.colour}|${m.design ?? ''}|${m.zapped ? 'z' : ''}`
    let s = this.cache.get(key)
    if (!s) {
      const base = Math.max(
        0.42,
        m.kind === 'megamega' ? 3.3 : m.kind === 'mega' ? 2.7 : m.kind === 'power' || m.zapped ? 1.4 : m.kind === 'drop' ? 0.42 : 1,
      )
      const half = Math.max(4, Math.ceil(base * ROOM * this.ppu))
      const make = (fn: (c: CanvasRenderingContext2D) => void) => {
        const c = document.createElement('canvas')
        c.width = c.height = half * 2
        const cx = c.getContext('2d')!
        cx.setTransform(half / (base * ROOM), 0, 0, half / (base * ROOM), half, half)
        fn(cx)
        return c
      }
      const at = { ...m, r: base }
      s = { turn: make((c) => drawTurning(c, at, this.ppu)), still: make((c) => drawStillPart(c, at)), base }
      this.cache.set(key, s)
    }
    const size = s.base * ROOM * 2 * (m.r / s.base) * grow
    ctx.save()
    if (alpha !== 1) ctx.globalAlpha = alpha
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.drawImage(s.turn, -size / 2, -size / 2, size, size)
    ctx.rotate(-angle)
    ctx.drawImage(s.still, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
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
  for (const m of marbles)
    drawBall(ctx, { kind: kindOf(m), colour: savedColour(m), design: m[6], r: m[5], zapped: isZapped(m) }, m[2], m[3], m[4], scale)
  drawJarFront(ctx)
  try {
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}
