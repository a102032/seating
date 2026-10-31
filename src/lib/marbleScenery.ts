import { artUrl, ART } from './marbleDesigns'
import type { Season } from './marbles'

/**
 * The season's scenery that moves on the Marble Jar's screen (2026-10-31): October's bats, ghost and
 * spider and the cat's blink; December's snow, the tree's lights and its star; Lunar New Year's
 * lanterns and gold glints. Each is a small picture the graphics chip moves by itself
 * (element.animate), never a canvas drawn again: a canvas the width of the board redrawn for the
 * bats made the whole board be put together again on every frame ("Smooth on the board").
 * Slow and rare, so it stays scenery.
 */

export interface Mapping {
  /** The screen's size, in CSS pixels. */
  w: number
  h: number
  /** The jar's world on the screen: x * scale + ox. */
  scale: number
  ox: number
  oy: number
}

/** The things on the shelf whose parts move: where they stand, and their pictures' shapes. */
export interface Placed {
  name: string
  x: number
  w: number
  foot: number
  ground: number
}

const forever = (el: Element, frames: Keyframe[], duration: number, opts: KeyframeAnimationOptions = {}) =>
  el.animate(frames, { duration, iterations: Infinity, ...opts })

function div(parent: HTMLElement, css: string): HTMLDivElement {
  const d = document.createElement('div')
  d.style.cssText = `position:absolute;pointer-events:none;${css}`
  parent.append(d)
  return d
}
function img(parent: HTMLElement, name: string, css: string): HTMLImageElement {
  const i = document.createElement('img')
  i.src = artUrl(name)
  i.alt = ''
  i.draggable = false
  i.style.cssText = `position:absolute;pointer-events:none;max-width:none;${css}`
  parent.append(i)
  return i
}

export class Scenery {
  private root: HTMLDivElement
  private timers: ReturnType<typeof setTimeout>[] = []

  constructor(box: HTMLElement) {
    this.root = div(box, 'inset:0;overflow:hidden')
  }

  /** Builds the season's moving scenery for this screen's size (again whenever it changes). */
  build(season: Season, m: Mapping, decor: { cat?: Placed; tree?: Placed }) {
    this.clear()
    const { w, h } = m
    const u = Math.min(w, h) / 100
    const R = Math.random
    if (season === 'oct') {
      // Bats near and far: the far ones small, faint and slow, the near ones big and quicker.
      ;[0.6, 0.75, 0.95, 1.3, 1.8, 2.3].forEach((k, i) => {
        const size = u * 9 * k
        const lane = div(
          this.root,
          `left:0;top:${(0.07 + ((i * 3) % 6) * 0.06) * h - size / 2}px;width:${size}px;height:${size}px;opacity:${Math.min(1, 0.45 + k * 0.35)}`,
        )
        const v = 0.008 + k * 0.009
        // Across the sky and bobbing, in one animation (two, one inside the other, cost the board more).
        const cross = (1.2 / v) * 1000
        const steps = Math.max(8, Math.round(cross / 475))
        const phase = R() * 6.28
        forever(
          lane,
          Array.from({ length: steps + 1 }, (_, j) => ({
            transform: `translate(${(-0.1 * w + (j / steps) * 1.2 * w).toFixed(1)}px, ${(Math.sin(phase + (j / steps) * (cross / 1900) * 2 * Math.PI) * u * 2).toFixed(1)}px)`,
          })),
          cross,
          { iterationStart: R(), easing: 'linear' },
        )
        const bob = lane
        const bat = img(bob, 'bat', 'inset:0;width:100%;height:100%')
        forever(bat, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.5)' }], (70 + 30 * k) * 3.1, {
          direction: 'alternate',
          easing: 'ease-in-out',
          delay: -R() * 300,
        })
      })
      // The ghost drifts slowly across the sky one way, then back the other, facing the way it goes.
      const gw = u * 14
      const ghost = div(this.root, `left:0;top:${h * 0.32 - gw / 2}px;width:${gw}px;height:${gw}px;opacity:.92`)
      const x0 = -0.08 * w - gw / 2
      const x1 = 1.08 * w - gw / 2
      forever(
        ghost,
        [
          { transform: `translateX(${x0}px) scaleX(1)`, offset: 0 },
          { transform: `translateX(${x1}px) scaleX(1)`, offset: 0.499 },
          { transform: `translateX(${x1}px) scaleX(-1)`, offset: 0.5 },
          { transform: `translateX(${x0}px) scaleX(-1)`, offset: 1 },
        ],
        58000,
        { iterationStart: 0.15 },
      )
      const float = div(ghost, 'inset:0')
      forever(
        float,
        [{ transform: `translateY(${-h * 0.08}px) rotate(-4.5deg)` }, { transform: `translateY(${h * 0.08}px) rotate(4.5deg)` }],
        5300,
        {
          direction: 'alternate',
          easing: 'ease-in-out',
        },
      )
      img(float, 'ghost', 'inset:0;width:100%;height:100%')
      // The spider hangs from the right-hand web; now and then (every 20 to 40 seconds) it lowers, wiggles, and shimmies back up.
      const ax = w - u * 8
      const ay = u * 8
      const sw = u * 9
      const drop = h * 0.32
      const thread = div(
        this.root,
        `left:${ax - 0.5}px;top:${ay}px;width:1px;height:${u * 3 + drop}px;background:rgba(230,225,255,.5);transform-origin:top;transform:scaleY(${u / (u * 3 + drop)})`,
      )
      const spider = div(this.root, `left:${ax - sw / 2}px;top:${ay + u * 3 - sw / 2}px;width:${sw}px;height:${sw}px`)
      img(spider, 'spider', 'inset:0;width:100%;height:100%')
      this.lids(
        spider,
        sw,
        453.54,
        [
          [189.9, 345.5, 25, 25],
          [263.7, 345.5, 25, 25],
        ],
        '#1e222f',
        6100,
      )
      const lower = () => {
        const t = 7500
        thread.animate(
          [
            { transform: `scaleY(${u / (u * 3 + drop)})` },
            { transform: 'scaleY(1)', offset: 0.4 },
            { transform: 'scaleY(1)', offset: 0.6 },
            { transform: `scaleY(${u / (u * 3 + drop)})` },
          ],
          { duration: t, easing: 'ease-in-out' },
        )
        spider.animate(
          [
            { transform: 'translate(0,0)' },
            { transform: `translate(0,${drop}px)`, offset: 0.4 },
            { transform: `translate(${u * 0.7}px,${drop}px) rotate(7deg)`, offset: 0.45 },
            { transform: `translate(${-u * 0.7}px,${drop}px) rotate(-7deg)`, offset: 0.5 },
            { transform: `translate(${u * 0.7}px,${drop}px) rotate(7deg)`, offset: 0.55 },
            { transform: `translate(0,${drop}px)`, offset: 0.6 },
            { transform: 'translate(0,0)' },
          ],
          { duration: t, easing: 'ease-in-out' },
        )
        this.timers.push(setTimeout(lower, t + 20000 + R() * 20000))
      }
      this.timers.push(setTimeout(lower, 5000))
      // The cat blinks now and then.
      const cat = decor.cat
      if (cat) {
        const cw = cat.w * m.scale
        const ch = cw / ART.cat.aspect
        const left = cat.x * m.scale + m.ox - cw / 2
        const top = (cat.ground - (cat.foot - 0.5) * (cat.w / ART.cat.aspect)) * m.scale + m.oy - ch / 2
        const box = div(this.root, `left:${left}px;top:${top}px;width:${cw}px;height:${ch}px`)
        this.lids(
          box,
          cw,
          64,
          [
            [39, 23.4, 5, 3.6],
            [25, 23.4, 5, 3.6],
          ],
          '#3c3c46',
          4700,
        )
      }
    }
    if (season === 'dec') {
      // Fewer flakes falling, with a few faint snowflakes drifting slowly behind them. Each flake is
      // one small piece with one animation (its fall and its sway together): big sheets of snow, or
      // a piece for the fall and another for the sway, cost the board more.
      const fall = (el: HTMLElement, r: number, seconds: number, sway: number) => {
        const steps = 8
        forever(
          el,
          Array.from({ length: steps + 1 }, (_, i) => ({
            transform: `translate(${(Math.sin((i / steps) * Math.PI * 4) * sway).toFixed(1)}px, ${(-0.05 * h - r + (i / steps) * (1.1 * h + r)).toFixed(1)}px)`,
          })),
          seconds * 1000,
          { iterationStart: R(), easing: 'linear' },
        )
      }
      for (let i = 0; i < 6; i++) {
        const r = u * 2.2 * (0.9 + R() * 0.8)
        const flake = div(this.root, `left:${R() * w - r}px;top:0;width:${r * 2}px;height:${r * 2}px`)
        flake.innerHTML = `<svg viewBox="-10 -10 20 20" width="100%" height="100%" style="display:block;transform:rotate(${Math.round(R() * 60)}deg)"><g stroke="rgba(220,235,255,.28)" stroke-width="${(Math.max(1, u * 0.25) / (r / 10)).toFixed(2)}" stroke-linecap="round" fill="none">${[
          0, 60, 120, 180, 240, 300,
        ]
          .map((a) => `<g transform="rotate(${a})"><path d="M0 0V-10M0-6L-2.4-8.4M0-6L2.4-8.4"/></g>`)
          .join('')}</g></svg>`
        fall(flake, r, 1.1 / (0.012 + R() * 0.012), u * 3)
      }
      for (let i = 0; i < 16; i++) {
        const r = (1 + R() * 2.2) * u * 0.28
        const flake = div(
          this.root,
          `left:${R() * w - r}px;top:0;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:rgba(255,255,255,.85)`,
        )
        fall(flake, r, 1.1 / (0.02 + R() * 0.04), u * 2)
      }
      // The tree's own eighteen lights glow and fade slowly, each at its own pace, in turn gold, red, blue and white; the star breathes.
      const tree = decor.tree
      if (tree) {
        const tw = tree.w
        const th = tw / ART.tree.aspect
        const top = tree.ground - (tree.foot - 0.5) * th - th / 2
        const at = (uu: number, vv: number): [number, number] => [
          (tree.x - tw / 2 + ((uu * 2.81 + 1.407) / 256) * tw) * m.scale + m.ox,
          (top + ((vv * 2.81 + 1.407) / 256) * th) * m.scale + m.oy,
        ]
        TREE_LIGHTS.forEach(([lu, lv], i) => {
          const [x, y] = at(lu, lv)
          const r = 0.6 * m.scale
          const c = LIGHT_COLOURS[i % LIGHT_COLOURS.length]
          const light = div(
            this.root,
            `left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:radial-gradient(circle,rgba(${c},1) 0,rgba(${c},1) 16%,rgba(${c},.5) 30%,rgba(${c},0) 70%)`,
          )
          const p = 2 * Math.PI * (520 + (i % 5) * 140)
          forever(
            light,
            [
              { opacity: 0.45, transform: 'scale(.4)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            p / 2,
            {
              direction: 'alternate',
              easing: 'ease-in-out',
              delay: -((i * 1.9) % 6.28) * (p / 6.28),
            },
          )
        })
        const [sx, sy] = at(45, 5.2)
        const g = 2.6 * m.scale
        const glow = div(
          this.root,
          `left:${sx - g}px;top:${sy - g}px;width:${g * 2}px;height:${g * 2}px;border-radius:50%;background:radial-gradient(circle,rgba(255,236,140,.75) 0,rgba(255,236,140,0) 65%)`,
        )
        forever(
          glow,
          [
            { opacity: 0.55, transform: 'scale(.85)' },
            { opacity: 1, transform: 'scale(1.1)' },
          ],
          2800,
          { direction: 'alternate', easing: 'ease-in-out' },
        )
        const rays = div(this.root, `left:${sx - g}px;top:${sy - g}px;width:${g * 2}px;height:${g * 2}px`)
        rays.innerHTML = `<svg viewBox="-2 -2 4 4" width="100%" height="100%"><g stroke="rgba(255,248,200,.7)" stroke-width=".07" stroke-linecap="round"><path d="M-1.7 0H1.7M0-1.7V1.7"/><path d="M-1.1 0H1.1M0-1.1V1.1" transform="rotate(45)"/></g></svg>`
        forever(rays, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], 25000)
      }
      // The snow on the ground glints: thirty sparkles in three groups, each fading in and out in turn.
      const x0 = -m.ox / m.scale
      const x1 = (w - m.ox) / m.scale
      const groups = [0, 1, 2].map((gi) => {
        const g = div(this.root, `left:0;top:${(26 + 1) * m.scale + m.oy}px;width:${w}px;height:${2 * m.scale}px`)
        forever(g, [{ opacity: 0.3 }, { opacity: 1 }], 1400, { direction: 'alternate', easing: 'ease-in-out', delay: -gi * 930 })
        return g
      })
      for (let i = 0; i < 30; i++) {
        const gx = (x0 + ((i * 7.3) % (x1 - x0))) * m.scale + m.ox
        const gy = (0.2 + (i % 3) * 0.6) * m.scale
        const s = Math.max(1, 0.12 * m.scale)
        div(groups[i % 3], `left:${gx}px;top:${gy}px;width:${s}px;height:${s}px;background:#fff`)
      }
    }
    if (season === 'lny') {
      for (const [lx, ph] of [
        [w * 0.06 + m.ox * 0.5, 0],
        [w * 0.94, 1.6],
      ]) {
        const c = lantern(u)
        c.style.cssText = `position:absolute;pointer-events:none;left:${lx - c.width / 2 / (window.devicePixelRatio || 1)}px;top:0;width:${c.width / (window.devicePixelRatio || 1)}px;height:${c.height / (window.devicePixelRatio || 1)}px;transform-origin:50% 0`
        this.root.append(c)
        forever(c, [{ transform: 'rotate(-4.6deg)' }, { transform: 'rotate(4.6deg)' }], 2830, {
          direction: 'alternate',
          easing: 'ease-in-out',
          delay: -ph * 900,
        })
      }
      for (let i = 0; i < 24; i++) {
        const s = u * 1.6
        const star = div(this.root, `left:${R() * w - s / 2}px;top:${R() * h - s / 2}px;width:${s}px;height:${s}px`)
        star.innerHTML = `<svg viewBox="-1 -1 2 2" width="100%" height="100%"><path d="${starPath()}" fill="#ffd23f"/></svg>`
        forever(star, [{ opacity: 0.25 }, { opacity: 0.75 }], 2200, { direction: 'alternate', easing: 'ease-in-out', delay: -R() * 2200 })
      }
    }
  }

  /** Eyelids over a picture's eyes, shutting for a quarter of a second now and then. */
  private lids(box: HTMLElement, w: number, vb: number, eyes: number[][], colour: string, every: number) {
    const k = w / vb
    for (const [cx, cy, rx, ry] of eyes) {
      const lid = div(
        box,
        `left:${(cx - rx) * k}px;top:${(cy - ry) * k}px;width:${rx * 2 * k}px;height:${ry * 2 * k}px;border-radius:50%;background:${colour};transform-origin:top;transform:scaleY(0)`,
      )
      const shut = 260 / every
      forever(
        lid,
        [
          { transform: 'scaleY(0)', offset: 0 },
          { transform: 'scaleY(0)', offset: 1 - shut },
          { transform: 'scaleY(1)', offset: 1 - shut * 0.6 },
          { transform: 'scaleY(1)', offset: 1 - shut * 0.4 },
          { transform: 'scaleY(0)', offset: 1 },
        ],
        every,
        { delay: -Math.random() * every },
      )
    }
  }

  clear() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    for (const el of [...this.root.querySelectorAll('*')]) el.getAnimations().forEach((a) => a.cancel())
    this.root.replaceChildren()
  }
}

function starPath() {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 ? 0.45 : 1
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`
  }
  return d + 'Z'
}

/** A red lantern on its gold string, drawn once into a small canvas that then sways. */
function lantern(u: number): HTMLCanvasElement {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const c = document.createElement('canvas')
  const W = u * 30
  const H = u * 33
  c.width = Math.ceil(W * dpr)
  c.height = Math.ceil(H * dpr)
  const x = c.getContext('2d')!
  x.setTransform(dpr, 0, 0, dpr, (W / 2) * dpr, 0)
  x.strokeStyle = '#ffd23f'
  x.lineWidth = Math.max(1, u * 0.3)
  x.beginPath()
  x.moveTo(0, 0)
  x.lineTo(0, u * 10)
  x.stroke()
  const ly = u * 18
  const lg = x.createRadialGradient(0, ly, u * 2, 0, ly, u * 14)
  lg.addColorStop(0, 'rgba(255,120,60,.45)')
  lg.addColorStop(1, 'rgba(255,120,60,0)')
  x.fillStyle = lg
  x.beginPath()
  x.arc(0, ly, u * 14, 0, Math.PI * 2)
  x.fill()
  x.fillStyle = '#ffd23f'
  x.fillRect(-u * 3, u * 10, u * 6, u * 1.6)
  x.fillRect(-u * 3, ly + u * 6.4, u * 6, u * 1.6)
  x.fillStyle = '#e63946'
  x.beginPath()
  x.ellipse(0, ly, u * 6.5, u * 6.6, 0, 0, Math.PI * 2)
  x.fill()
  x.strokeStyle = '#b5172a'
  x.lineWidth = Math.max(1, u * 0.35)
  for (const k of [0.35, 0.7]) {
    x.beginPath()
    x.ellipse(0, ly, u * 6.5 * k, u * 6.6, 0, 0, Math.PI * 2)
    x.stroke()
  }
  x.strokeStyle = '#ffd23f'
  x.beginPath()
  for (const dx of [-1, 0, 1]) {
    x.moveTo(dx * u, ly + u * 8)
    x.lineTo(dx * u * 1.2, ly + u * 13)
  }
  x.stroke()
  return c
}

/** The tree picture's own eighteen lights (its 90-unit drawing, scaled 2.81 into 256). */
const TREE_LIGHTS = [
  [55.273, 21.573],
  [48.783, 25.123],
  [40.863, 27.073],
  [33.043, 27.493],
  [61.083, 36.203],
  [54.603, 39.743],
  [46.503, 41.703],
  [39.033, 42.473],
  [31.713, 41.533],
  [25.393, 38.513],
  [67.883, 50.583],
  [62.213, 55.323],
  [54.653, 58.823],
  [47.483, 61.033],
  [39.583, 61.533],
  [32.093, 59.983],
  [24.943, 57.413],
  [18.183, 53.633],
]
const LIGHT_COLOURS = ['255,214,90', '255,90,95', '110,180,255', '255,250,235']
