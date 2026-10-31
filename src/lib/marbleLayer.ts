import { drawStillPart, drawTurning, type Ball } from './marbleDesigns'

/**
 * The marbles on the board: each one a small picture, drawn once for its kind, that the graphics
 * chip moves and turns ("Smooth on the board"). Drawn on one canvas, every frame of a pour sent the
 * whole jar's picture to the screen again; drawn on a canvas the board's width (2026-10-31), it
 * copied the whole board's picture every frame, and a pour ran at 18 frames a second on a board's
 * slow processor. A marble at rest isn't touched at all.
 */

/** Two pictures a marble: what turns as it rolls (its colour, band or design and edge), and its shine, which doesn't. */
interface Sprite {
  turning: string
  still: string
  /** The radius it was drawn at: a marble growing (a kernel popping, one zapped) is this, scaled. */
  base: number
}

interface Node {
  el: HTMLDivElement
  turn: HTMLImageElement
  still: HTMLImageElement
  key: string
  last: string
  popping: boolean
}

export interface Shown {
  ball: Ball
  x: number
  y: number
  angle: number
  /** Popping away as the jar empties: 0 to 1. */
  vanish?: number
}

/** Room round a marble in its picture, for the Power Marble's glow and the Mega Mega's light. */
const ROOM = 1.6
const baseOf = (m: Ball) =>
  m.kind === 'megamega' ? 3.3 : m.kind === 'mega' ? 2.7 : m.kind === 'power' || m.zapped ? 1.4 : m.kind === 'drop' ? 0.42 : 1
const keyOf = (m: Ball) => `${m.kind}|${m.colour}|${m.design ?? ''}|${m.zapped ? 'z' : ''}`

export class MarbleLayer {
  private nodes = new Map<object, Node>()
  private sprites = new Map<string, Sprite>()
  private unit = 0
  private ppu = 0
  private box: HTMLDivElement

  constructor(box: HTMLDivElement) {
    this.box = box
  }

  /** The world's unit on the screen, in CSS pixels. */
  resize(unit: number) {
    this.unit = unit
    // The pictures are drawn for the screen's own pixels, 2x at most, and only again when the size changes a lot.
    const ppu = Math.round(unit * Math.min(2, window.devicePixelRatio || 1))
    if (Math.abs(ppu - this.ppu) > this.ppu * 0.15) {
      this.ppu = ppu
      this.redraw()
    }
    for (const n of this.nodes.values()) n.last = ''
  }

  /** Every picture drawn again (a picture a design uses has just arrived). */
  redraw() {
    this.sprites.clear()
    for (const n of this.nodes.values()) {
      n.key = ''
      n.last = ''
    }
  }

  private sprite(m: Ball): Sprite {
    const key = keyOf(m)
    let s = this.sprites.get(key)
    if (s) return s
    const base = baseOf(m)
    const half = Math.max(4, Math.ceil(base * ROOM * this.ppu))
    const draw = (fn: (ctx: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas')
      c.width = c.height = half * 2
      const ctx = c.getContext('2d')!
      ctx.setTransform(half / (base * ROOM), 0, 0, half / (base * ROOM), half, half)
      fn(ctx)
      return c.toDataURL('image/png')
    }
    const at = { ...m, r: base }
    s = { turning: draw((ctx) => drawTurning(ctx, at, this.ppu)), still: draw((ctx) => drawStillPart(ctx, at)), base }
    this.sprites.set(key, s)
    return s
  }

  private dress(n: Node, m: Ball) {
    const s = this.sprite(m)
    const size = s.base * ROOM * 2 * this.unit
    n.el.style.width = n.el.style.height = `${size}px`
    n.turn.src = s.turning
    n.still.src = s.still
    n.key = keyOf(m)
  }

  private make(m: Ball): Node {
    const el = document.createElement('div')
    el.className = 'marble-sprite'
    const turn = document.createElement('img')
    const still = document.createElement('img')
    turn.alt = still.alt = ''
    turn.draggable = still.draggable = false
    el.append(turn, still)
    this.box.append(el)
    const n: Node = { el, turn, still, key: '', last: '', popping: false }
    this.dress(n, m)
    return n
  }

  /** Shows the marbles where they now are, in the world's units from the screen's (ox, oy); only the ones that moved are touched. */
  update(marbles: Shown[], ox: number, oy: number) {
    if (!this.unit) return
    const seen = new Set<object>()
    for (const sh of marbles) {
      const m = sh.ball
      seen.add(m)
      let n = this.nodes.get(m)
      if (!n) {
        n = this.make(m)
        this.nodes.set(m, n)
      }
      if (keyOf(m) !== n.key) {
        this.dress(n, m)
        n.last = ''
      }
      const s = this.sprite(m)
      const half = s.base * ROOM * this.unit
      const grow = sh.vanish ? 1 + 0.35 * sh.vanish : 1
      const state = `${sh.x.toFixed(3)} ${sh.y.toFixed(3)} ${sh.angle.toFixed(3)} ${m.r.toFixed(3)} ${sh.vanish ?? 0}`
      if (state === n.last) continue
      n.last = state
      n.el.style.transform = `translate(${(ox + sh.x * this.unit - half).toFixed(1)}px, ${(oy + sh.y * this.unit - half).toFixed(1)}px) scale(${((m.r / s.base) * grow).toFixed(3)})`
      n.turn.style.transform = `rotate(${sh.angle.toFixed(3)}rad)`
      if (sh.vanish) n.el.style.opacity = String(Math.max(0, 1 - sh.vanish))
    }
    for (const [m, n] of this.nodes) {
      if (seen.has(m)) continue
      n.el.remove()
      this.nodes.delete(m)
    }
  }

  clear() {
    this.box.replaceChildren()
    this.nodes.clear()
  }
}
