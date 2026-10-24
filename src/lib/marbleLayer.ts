import { drawMarble, drawStill, type DrawnMarble } from './marbleArt'
import type { Live } from './marblePhysics'
import { JAR, RADIUS } from './marbles'

/**
 * The marbles on the board: each one a small picture, drawn once, that the graphics chip moves and
 * turns ("Smooth on the board"). Drawn on one canvas, every frame of a pour sent the whole jar's
 * picture to the screen again, and on a 4K-like screen with the processor slowed 4x it ran at 16
 * frames a second. A marble at rest isn't touched at all.
 */

/** Two pictures a marble: the glass, its band and the Mega's swirl, which turn as it rolls; and the shine (and the Power Marble's bolt), which never turn. */
interface Sprite {
  turning: string
  still: string
  /** The radius it was drawn at, in the jar's units: a zapped marble growing is this, scaled. */
  base: number
}

interface Node {
  el: HTMLDivElement
  turn: HTMLImageElement
  key: string
  last: string
  popping: boolean
}

const baseOf = (m: DrawnMarble) => (m.kind === 'plain' ? (m.zapped ? RADIUS.power : RADIUS.plain) : RADIUS[m.kind])
/** Room round a marble in its picture, for the Power Marble's glow. */
const ROOM = 1.25

export class MarbleLayer {
  private nodes = new Map<object, Node>()
  private sprites = new Map<string, Sprite>()
  private unit = 0
  private ppu = 0
  private box: HTMLDivElement
  private bolts: SVGSVGElement

  constructor(box: HTMLDivElement, bolts: SVGSVGElement) {
    this.box = box
    this.bolts = bolts
  }

  /** The jar's width on the screen, in CSS pixels. */
  resize(width: number) {
    this.unit = width / JAR.W
    // The pictures are drawn for the screen's own pixels, 2x at most, and only again when the size changes a lot.
    const ppu = Math.round(this.unit * Math.min(2, window.devicePixelRatio || 1))
    if (Math.abs(ppu - this.ppu) > this.ppu * 0.15) {
      this.ppu = ppu
      this.sprites.clear()
      for (const n of this.nodes.values()) n.last = ''
      for (const [m, n] of this.nodes) this.dress(n, m as Live)
    }
    for (const n of this.nodes.values()) n.last = ''
  }

  private sprite(m: DrawnMarble): Sprite {
    const key = `${m.kind}${m.colour}${m.zapped ? 'z' : ''}`
    let s = this.sprites.get(key)
    if (s) return s
    const base = baseOf(m)
    const half = Math.ceil(base * ROOM * this.ppu)
    const draw = (fn: (ctx: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas')
      c.width = c.height = half * 2
      const ctx = c.getContext('2d')!
      ctx.setTransform(half / (base * ROOM), 0, 0, half / (base * ROOM), half, half)
      fn(ctx)
      return c.toDataURL('image/png')
    }
    const at = { ...m, x: 0, y: 0, angle: 0, r: base }
    s = {
      turning: draw((ctx) => drawMarble(ctx, at, this.ppu, true)),
      still: draw((ctx) => drawStill(ctx, at)),
      base,
    }
    this.sprites.set(key, s)
    return s
  }

  private dress(n: Node, m: Live) {
    const s = this.sprite(m)
    const size = s.base * ROOM * 2 * this.unit
    n.el.style.width = n.el.style.height = `${size}px`
    n.turn.src = s.turning
    ;(n.el.lastElementChild as HTMLImageElement).src = s.still
    n.key = `${m.kind}${m.colour}${m.zapped ? 'z' : ''}`
  }

  private make(m: Live): Node {
    const el = document.createElement('div')
    el.className = 'marble-sprite'
    const turn = document.createElement('img')
    const still = document.createElement('img')
    turn.alt = still.alt = ''
    turn.draggable = still.draggable = false
    el.append(turn, still)
    this.box.append(el)
    const n: Node = { el, turn, key: '', last: '', popping: false }
    this.dress(n, m)
    return n
  }

  /** Shows the marbles where they now are; only the ones that moved are touched. */
  update(marbles: Live[], bolts: { from: Live; to: Live }[], now: number) {
    if (!this.unit) return
    const seen = new Set<object>()
    for (const m of marbles) {
      seen.add(m)
      let n = this.nodes.get(m)
      if (!n) {
        n = this.make(m)
        this.nodes.set(m, n)
      }
      if (m.pop !== undefined && now >= m.pop) {
        if (!n.popping) {
          n.popping = true
          const at = n.el.style.transform
          n.el.animate(
            [
              { transform: at, opacity: 1 },
              { transform: `${at} scale(1.35)`, opacity: 0 },
            ],
            { duration: 160, easing: 'ease-out', fill: 'forwards' },
          )
        }
        continue
      }
      const key = `${m.kind}${m.colour}${m.zapped ? 'z' : ''}`
      if (key !== n.key) {
        this.dress(n, m)
        n.last = ''
      }
      const s = this.sprite(m)
      const half = s.base * ROOM * this.unit
      const state = `${m.x.toFixed(3)} ${m.y.toFixed(3)} ${m.angle.toFixed(3)} ${m.r.toFixed(3)}`
      if (state === n.last) continue
      n.last = state
      n.el.style.transform = `translate(${(m.x * this.unit - half).toFixed(1)}px, ${(m.y * this.unit - half).toFixed(1)}px) scale(${(m.r / s.base).toFixed(3)})`
      n.turn.style.transform = `rotate(${m.angle.toFixed(3)}rad)`
    }
    for (const [m, n] of this.nodes) {
      if (seen.has(m)) continue
      n.el.remove()
      this.nodes.delete(m)
    }
    // The Power Marble's lightning, jagged afresh each frame for the half second it lasts.
    if (bolts.length || this.bolts.childElementCount) {
      this.bolts.innerHTML = bolts
        .map(({ from: a, to: c }) => {
          const nx = -(c.y - a.y)
          const ny = c.x - a.x
          const len = Math.hypot(nx, ny) || 1
          const pts = [[a.x, a.y]]
          for (let i = 1; i < 6; i++) {
            const t = i / 6
            const off = (Math.random() - 0.5) * 1.1
            pts.push([a.x + (c.x - a.x) * t + (nx / len) * off, a.y + (c.y - a.y) * t + (ny / len) * off])
          }
          pts.push([c.x, c.y])
          const d = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
          return `<polyline points="${d}" fill="none" stroke="rgba(120,190,255,.45)" stroke-width=".5" stroke-linejoin="round"/><polyline points="${d}" fill="none" stroke="#fff" stroke-width=".16" stroke-linejoin="round"/>`
        })
        .join('')
    }
  }
}
