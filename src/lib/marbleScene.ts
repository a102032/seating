import { Box, Chain, Circle, Edge, Vec2, World, type Body } from 'planck'
import { drawJarBack, drawJarFront } from './marbleArt'
import { ART, RAINBOW, drawArt, drawBall, loadPictures, onPicture, type Ball } from './marbleDesigns'
import { MarbleLayer, type Shown } from './marbleLayer'
import { Scenery } from './marbleScenery'
import { marbleSound as sound } from './marbleSounds'
import {
  DESIGN_COLOUR,
  JAR,
  JAR_PATH,
  MARBLE_COLOURS,
  MEGA_COLOUR,
  POWER_COLOUR,
  RADIUS,
  SEASON_DESIGNS,
  kindCode,
  kindOf,
  zapCount,
  type MarbleKind,
  type SavedMarble,
  type Season,
  type WedgeId,
} from './marbles'

/**
 * The Marble Jar's screen, its jar side (2026-10-31, built from the "Marble Jar Ideas" preview the
 * teacher worked through with his class's ideas): the jar standing on a shelf (snow in December, a
 * red table at Lunar New Year) right across the board, the season's things round it, and every
 * wedge's marbles: 5 plain ones, the rain cloud, popcorn, the Power Marble, the Mega and the rare
 * Mega Mega, and the season's own (the witch, Santa's sleigh, the red envelope).
 *
 * The marbles fall as real marbles do (Planck, a modern Box2D). Marbles that miss the jar land on
 * the shelf in front of the things standing there, roll and stop; they never count, and are gone
 * when the screen closes. Only marbles inside the glass are kept with the class.
 *
 * Smooth on the board: one canvas, drawn at no more than 1.5 pixels a point; what never moves (the
 * sky, the shelf, the cat, the glass) is drawn once into two layers and stamped every frame; each
 * kind of marble is two small pictures stamped where it is (BallSprites). With nothing moving it
 * stops drawing; with only the season's scenery moving it draws 30 times a second.
 */

type Kind = MarbleKind | 'popcorn' | 'kernel' | 'present' | 'envelope'

interface M extends Ball {
  body: Body
  kind: Kind
  colourIndex: number
  born: number
  grow?: { from: number; to: number; t: number }
  landed?: number
  popAt?: number
  ghost?: number
  bigPop?: boolean
  openAt?: number
  fired?: boolean
  thudded?: boolean
  index?: number
  slowed?: boolean
  soak?: boolean
  /** Emptying: when it starts popping away. */
  vanish?: number
  vanished?: boolean
}

export interface SceneHooks {
  clink(size: number, strength: number): void
  thud(): void
  zap(): void
  grow(): void
  pop(): void
  shake(): void
  /** Words from the jar's side: "Wait..." as the Mega shakes, and the Mega Mega's own big words. */
  say(text: string, kind: 'small' | 'huge'): void
  /** The board dims for the Mega Mega Marble. */
  dim(on: boolean): void
}

/** What the jar stands on: marbles out of the jar land and roll on it. */
export const GROUND = JAR.FLOOR + 0.4
/** The part of the world fitted into the jar's side of the screen. */
const VIEW = { x0: -13, x1: 33, y0: -15, y1: 28.6 }
const DPR_CAP = 1.5
const STEP = 1 / 60
const POP_MS = 160
const STAR_PATH =
  Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 ? 0.45 : 1
    return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`
  }).join('') + 'Z'
const KERNELS = [4, 3]
/** Santa's present, a third bigger than first drawn (the teacher). */
const PRESENT = 1.35
/** Where the witch's pumpkin bucket hangs on her broom, from her middle. */
const BUCKET = { x: -3.9, y: 0.4 }
const DECOR = {
  cat: { x: JAR.CX - JAR.WALL - 5.6, w: 9.5 },
  hatpk: { x: JAR.CX + JAR.WALL + 5.4, w: 8.6 },
  tree: { x: JAR.CX - JAR.WALL - 6.4, w: 13 },
  snowman: { x: JAR.CX + JAR.WALL + 5.6, w: 9.6 },
  basket: { x: JAR.CX + JAR.WALL + 5.6, w: 9 },
}
const SEASON_PICTURES: Record<Season, string[]> = {
  none: [],
  oct: ['cat', 'hatpk', 'spider', 'bat', 'ghost', 'witch', 'bucket', 'pk1', 'pk2', 'pk3', 'pk4', 'pk5', 'lolly'],
  dec: ['tree', 'snowman', 'mistletoe', 'sled', 'orn1', 'orn2', 'orn3'],
  lny: ['basket', 'envelope'],
}
function insideJar(x: number, y: number): boolean {
  if (y < JAR.MOUTH) return false
  let c = false
  for (let i = 0, j = JAR_PATH.length - 1; i < JAR_PATH.length; j = i++) {
    const [xi, yi] = JAR_PATH[i]
    const [xj, yj] = JAR_PATH[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

export class MarbleScene {
  private world = new World({ gravity: Vec2(0, 34) })
  private ms: M[] = []
  private back: HTMLCanvasElement | null = null
  private dpr = 1
  private scale = 1
  private ox = 0
  private oy = 0
  private nextColour = 0
  private bolts: { from: M; to: M; until: number }[] = []
  private cloud: { x: number; y: number; glow: number; flashes: number; nextFlash: number; nextDrop: number } | null = null
  private flyer: {
    kind: 'witch' | 'santa'
    x: number
    y: number
    dir: number
    poured: number
    nextPour: number
    tip: number
    dropped: boolean
    bubbleUntil: number
  } | null = null
  private gift: { kind: 'present' | 'envelope'; x: number; y: number; t: number; startX: number } | null = null
  private chute: { x: number; y: number; a: number } | null = null
  private lid: { x: number; y: number; vx: number; vy: number; a: number; kind: Kind; life: number } | null = null
  private hover: (Ball & { x: number; y: number; shake: number; rays: number }) | null = null
  private dim = 0
  private dimTarget = 0
  private popOrder = 0
  private bigPlan = [1, 0]
  private busyUntil = 0
  private pending: { kind: Kind; r: number; o?: Partial<M>; at: number }[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  private raf = 0
  private last = 0
  private acc = 0
  private quiet = 0
  private lastEvent = 0
  private settled: (() => void) | null = null
  private stopPictures: () => void
  private groundBody: Body
  /** Only once the class can hear: a jar rebuilt from where it was saved makes no sound as it does. */
  soundOn = true
  private dead = false

  private box: HTMLElement
  /** The screen's width, measured at layout: reading it every frame made the page be laid out again for every marble. */
  private boxWidth = 0
  private backCanvas: HTMLCanvasElement
  private frontCanvas: HTMLCanvasElement
  private backImg: HTMLImageElement
  private frontImg: HTMLImageElement
  private urls: string[] = []
  private sceneryLayer: Scenery
  private marbleLayer: MarbleLayer
  /** The wedges' shows over the jar: each thing a small picture drawn once and moved (the cloud, the witch, a present). */
  private fx: HTMLDivElement
  private boltsSvg: SVGSVGElement
  private dimEl: HTMLDivElement
  private top: HTMLDivElement
  private stamps = new Map<string, { el: HTMLElement; w: number; h: number }>()
  private ids = new WeakMap<M, number>()
  private nextId = 0
  private actionDrawn = false
  private season: Season
  private hooks: SceneHooks

  /**
   * Layers, one over the other, so the board only ever draws what changed: what never moves (the
   * sky, the shelf, the things on it, the glass behind), drawn once; the season's scenery, moved
   * by the graphics chip; the marbles, each a small picture it moves; the glass in front, drawn
   * once; and every wedge's show, each a small picture moved. A canvas the board's width redrawn
   * for a pour made the board copy its whole picture every frame (18 frames a second).
   */
  constructor(box: HTMLElement, saved: SavedMarble[], season: Season, hooks: SceneHooks) {
    this.box = box
    const make = () => {
      const c = document.createElement('canvas')
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
      box.append(c)
      return c
    }
    // What never changes is shown as a still picture once drawn: a canvas the size of the board,
    // even one that never changes, cost the board about 13 frames a second while marbles fell.
    const still = () => {
      const i = document.createElement('img')
      i.alt = ''
      i.draggable = false
      i.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;max-width:none;pointer-events:none'
      box.append(i)
      return i
    }
    const layer = (css = '') => {
      const d = document.createElement('div')
      d.style.cssText = `position:absolute;inset:0;overflow:hidden;pointer-events:none;${css}`
      box.append(d)
      return d
    }
    this.backCanvas = make()
    this.backImg = still()
    this.sceneryLayer = new Scenery(box)
    this.marbleLayer = new MarbleLayer(layer())
    this.frontCanvas = make()
    this.frontImg = still()
    this.fx = layer()
    this.boltsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.boltsSvg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible'
    this.fx.append(this.boltsSvg)
    this.dimEl = layer('background:rgb(4,6,14);opacity:0')
    this.top = layer()
    this.season = season
    this.hooks = hooks
    const glass = this.world.createBody()
    glass.createFixture(
      Chain(
        JAR_PATH.map(([x, y]) => Vec2(x, y)),
        false,
      ),
      { friction: 0.5, restitution: 0.25 },
    )
    this.groundBody = this.world.createBody()
    this.groundBody.createFixture(Edge(Vec2(-200, GROUND), Vec2(200, GROUND)), { friction: 0.6, restitution: 0.2 })
    for (const m of saved) {
      const kind = kindOf(m)
      const design = m[6]
      const live = this.add(
        kind,
        m[2],
        m[3],
        m[5],
        { design, colourIndex: m[1], colour: this.colourFor(kind, m[1], design), landed: 1 },
        m[4],
      )
      live.fired = true
      live.thudded = true
      live.zapped = kind === 'plain' && m[5] > RADIUS.plain + 0.05
      live.body.setAwake(false)
    }
    this.nextColour = saved.reduce((n, m) => Math.max(n, m[1] + 1), 0)
    this.world.on('begin-contact', (c) =>
      this.contact(c.getFixtureA().getBody(), c.getFixtureB().getBody(), c.getFixtureA().isSensor() || c.getFixtureB().isSensor()),
    )
    loadPictures(SEASON_PICTURES[season])
    this.stopPictures = onPicture(() => {
      this.marbleLayer.redraw()
      this.clearStamps()
      this.back = null
      this.actionDrawn = false
      this.wake()
    })
  }

  private colourFor(kind: MarbleKind, index: number, design?: string) {
    if (design && DESIGN_COLOUR[design]) return DESIGN_COLOUR[design]
    if (kind === 'power') return POWER_COLOUR
    if (kind === 'mega') return MEGA_COLOUR
    if (kind === 'megamega') return DESIGN_COLOUR.megamega
    return MARBLE_COLOURS[index % MARBLE_COLOURS.length]
  }

  private add(kind: Kind, x: number, y: number, r: number, o: Partial<M> = {}, angle = Math.random() * 6): M {
    const body = this.world.createBody({ type: 'dynamic', position: Vec2(x, y), angle, allowSleep: true, angularDamping: 0.05 })
    if (kind === 'present' || kind === 'envelope') {
      const hw = kind === 'present' ? 0.95 * PRESENT : 2.25
      const hh = kind === 'present' ? 0.85 * PRESENT : 3.25
      body.createFixture(Box(hw, hh), { density: 0.6, friction: 0.5, restitution: 0.15 })
      body.setAngle(0)
    } else body.createFixture(Circle(r), { density: 1, friction: 0.45, restitution: kind === 'drop' ? 0.4 : 0.32 })
    const colourIndex = o.colourIndex ?? this.nextColour++
    const m: M = { body, kind, r, born: performance.now(), colourIndex, colour: MARBLE_COLOURS[colourIndex % MARBLE_COLOURS.length], ...o }
    body.setUserData(m)
    this.ms.push(m)
    this.lastEvent = performance.now()
    return m
  }

  private remove(m: M) {
    this.world.destroyBody(m.body)
    this.ms = this.ms.filter((x) => x !== m)
  }

  private setRadius(m: M, r: number) {
    m.r = r
    const shape = m.body.getFixtureList()?.getShape() as unknown as { m_radius: number } | undefined
    if (shape) shape.m_radius = r
    m.body.resetMassData()
    m.body.setAwake(true)
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(
      setTimeout(() => {
        if (this.dead) return
        fn()
        this.wake()
      }, ms),
    )
  }

  private contact(A: Body, B: Body, sensor: boolean) {
    if (sensor) return
    const a = A.getUserData() as M | null
    const b = B.getUserData() as M | null
    const now = performance.now()
    for (const m of [a, b]) {
      if (!m) continue
      const y = m.body.getPosition().y
      if (y > JAR.MOUTH + 0.5 && !m.landed) m.landed = now
      if (m.kind === 'power' && !m.fired && y > JAR.MOUTH + 1) setTimeout(() => this.zap(m), 0)
    }
    if (!this.soundOn) return
    const va = A.getLinearVelocity()
    const vb = B.getLinearVelocity()
    const pa = A.getPosition()
    const pb = B.getPosition()
    let nx = pb.x - pa.x
    let ny = pb.y - pa.y
    if (!a || !b) {
      nx = 0
      ny = 1
    }
    const len = Math.hypot(nx, ny) || 1
    const speed = Math.abs(((vb.x - va.x) * nx + (vb.y - va.y) * ny) / len)
    const onGround = A === this.groundBody || B === this.groundBody
    const drop = a?.kind === 'drop' ? a : b?.kind === 'drop' ? b : null
    if (onGround && drop) {
      // A rain marble on the shelf: a tiny knock (a tiny pat in snow), and it soaks in.
      drop.soak = true
      if (this.season === 'dec') sound.snowPat(speed * 0.4)
      else sound.knock(speed * 0.35, false, true)
      return
    }
    if (onGround) {
      // A marble on the shelf or the table: wood, not glass (the teacher); in snow, a soft pat.
      if (speed < 2.5) return
      const m = a ?? b
      const heavy = !!m && (m.r > 1.2 || m.kind === 'mega' || m.kind === 'megamega')
      if (this.season === 'dec') sound.snowPat(speed)
      else sound.knock(speed, heavy)
      return
    }
    if (drop || a?.kind === 'kernel' || b?.kind === 'kernel') {
      if (speed > 2) sound.tink(speed)
      return
    }
    if (speed < 3.5) return
    const big = [a, b].find((m) => m && (m.kind === 'mega' || m.kind === 'megamega') && !m.thudded)
    if (big && speed > 5) {
      big.thudded = true
      this.hooks.thud()
      this.hooks.shake()
      if (big.kind === 'megamega') this.burst(big.body.getPosition().x, big.body.getPosition().y - 2, 40, RAINBOW, 14)
      return
    }
    this.hooks.clink(Math.max(a?.r ?? 1, b?.r ?? 1), Math.min(8, speed / 2))
  }

  // --- The wedges -------------------------------------------------------------------------------

  private design(force = false): Partial<M> {
    const set = SEASON_DESIGNS[this.season]
    if (!set.length || (!force && Math.random() < 0.5)) return {}
    const design = set[Math.floor(Math.random() * set.length)]
    return { design, colour: DESIGN_COLOUR[design], colourIndex: 0 }
  }

  private pour(list: { kind: Kind; r: number; o?: Partial<M> }[], gap = 300) {
    const now = performance.now()
    list.forEach((p, i) => this.pending.push({ ...p, at: now + i * gap }))
  }

  /** What the wheel landed on, played out in the jar; then, once everything has come to rest, settled. */
  play(id: WedgeId, megaMega: boolean, settled: () => void) {
    this.settled = settled
    this.quiet = 0
    this.lastEvent = performance.now()
    const busy = (ms: number) => (this.busyUntil = performance.now() + ms)
    if (id === '5') this.pour(Array.from({ length: 5 }, () => ({ kind: 'plain' as Kind, r: 1, o: this.design() })))
    if (id === 'power') this.pour([{ kind: 'power', r: RADIUS.power, o: { colour: POWER_COLOUR, colourIndex: 0 } }])
    if (id === 'mega' && !megaMega) this.pour([{ kind: 'mega', r: RADIUS.mega, o: { colour: MEGA_COLOUR, colourIndex: 0 } }])
    if (id === 'mega' && megaMega) {
      busy(8000)
      this.megaMega()
    }
    if (id === 'rain') {
      // The rain cloud drifts over, glows softly twice (never a flash across the screen), and rains tiny marbles.
      this.cloud = { x: Math.min(-17, this.viewLeft() - 6), y: -8.6, glow: 0, flashes: 0, nextFlash: 0, nextDrop: 0 }
      sound.whoosh()
    }
    if (id === 'popcorn') {
      busy(10000)
      this.popOrder = 0
      this.bigPlan = [1, Math.random() < 0.5 ? 1 : 0]
      for (let i = 0; i < 2; i++)
        this.later(() => {
          const m = this.add('popcorn', JAR.CX + (Math.random() - 0.5) * 2, JAR.MOUTH - 3.6, 1, {
            colour: '#ffffff',
            design: 'popcorn',
            index: i,
            colourIndex: 0,
          })
          m.body.setAngularVelocity((Math.random() - 0.5) * 4)
        }, i * 420)
    }
    if (id === 'witch') {
      this.flyer = {
        kind: 'witch',
        x: Math.max(40, this.viewRight() + 7),
        y: -5.6,
        dir: -1,
        poured: 0,
        nextPour: 0,
        tip: 0,
        dropped: false,
        bubbleUntil: 0,
      }
      sound.whoosh()
    }
    if (id === 'santa') {
      this.flyer = {
        kind: 'santa',
        x: Math.min(-22, this.viewLeft() - 12),
        y: -8,
        dir: 1,
        poured: 0,
        nextPour: 0,
        tip: 0,
        dropped: false,
        bubbleUntil: 0,
      }
      sound.jingleBells()
    }
    if (id === 'envelope') {
      this.gift = { kind: 'envelope', x: JAR.CX + 6, y: VIEW.y0 + 1, t: 0, startX: JAR.CX + 6 }
      sound.sparkle()
    }
    this.wake()
  }

  /** Mega Mega: the Mega comes as always, then shakes, grows, and the board says so. */
  private megaMega() {
    this.hover = { x: JAR.CX, y: -4.6, r: RADIUS.mega, kind: 'mega', colour: MEGA_COLOUR, shake: 0, rays: 0 }
    this.later(() => {
      this.hooks.say('Wait...', 'small')
      if (this.hover) this.hover.shake = 0.12
      sound.drumRoll(1.7)
    }, 1300)
    this.later(() => {
      this.dimTarget = 0.72
      this.hooks.dim(true)
      if (this.hover) this.hover.shake = 0.25
      sound.rise(1.1)
      const t0 = performance.now()
      const grow = () => {
        if (!this.hover || this.dead) return
        const k = Math.min(1, (performance.now() - t0) / 1100)
        this.hover.r = RADIUS.mega + (RADIUS.megamega - RADIUS.mega) * (1 - Math.pow(1 - k, 3))
        if (k < 1) this.timers.push(setTimeout(grow, 16))
      }
      grow()
    }, 3000)
    this.later(() => {
      if (!this.hover) return
      this.hover = { ...this.hover, kind: 'megamega', colour: DESIGN_COLOUR.megamega, design: 'megamega', shake: 0, rays: 1 }
      this.hooks.say('MEGA MEGA MARBLE!', 'huge')
      sound.fanfare()
      this.burst(this.hover.x, this.hover.y, 36, RAINBOW, 16)
    }, 4100)
    this.later(() => {
      const h = this.hover
      this.hover = null
      if (h) this.add('megamega', h.x, h.y, RADIUS.megamega, { colour: h.colour, design: 'megamega', colourIndex: 0 })
      this.dimTarget = 0
      this.hooks.dim(false)
    }, 6300)
  }

  private zap(p: M) {
    if (p.fired) return
    p.fired = true
    const pos = p.body.getPosition()
    const near = this.ms
      .filter((m) => m.kind === 'plain' && !m.zapped && m.vanish === undefined && insideJar(m.body.getPosition().x, m.body.getPosition().y))
      .map((m) => ({ m, d: Math.hypot(m.body.getPosition().x - pos.x, m.body.getPosition().y - pos.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, zapCount())
      .map((n) => n.m)
    this.later(() => {
      if (!near.length) return
      if (this.soundOn) this.hooks.zap()
      const until = performance.now() + 520
      for (const m of near) {
        this.bolts.push({ from: p, to: m, until })
        m.zapped = true
      }
      this.later(() => {
        if (this.soundOn) this.hooks.grow()
        for (const m of near) m.grow = { from: m.r, to: RADIUS.power, t: 0 }
      }, 420)
    }, 250)
  }

  private popBox(m: M) {
    // Popcorn, the teacher's way: the striped box bursts, spilling tiny kernels that sizzle on the pile, then pop.
    const p = m.body.getPosition()
    sound.pop()
    this.burst(p.x, p.y, 14, ['#fffaf0', '#ffe27a', '#ffffff'], 7, false)
    this.remove(m)
    const now = performance.now()
    const sizzleEnd = now + 1500 + Math.random() * 300
    const box = m.index ?? 0
    for (let i = 0; i < KERNELS[box]; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
      const s = 4 + Math.random() * 5
      const k = this.add('kernel', p.x + Math.cos(a) * 0.35, p.y + Math.sin(a) * 0.35, 0.27, { colour: '#e8a33d', colourIndex: 0 })
      k.body.setLinearVelocity(Vec2(Math.cos(a) * s, Math.sin(a) * s))
      // Real popcorn: a few early, a flurry in the middle, a few stragglers.
      k.popAt = sizzleEnd + ((Math.random() + Math.random()) / 2) * 2600
      // One or two pops a spin shoot out of the jar (the teacher: a few is the fun of it).
      k.bigPop = i < this.bigPlan[box]
    }
  }

  private openGift(m: M) {
    const p = m.body.getPosition()
    const envelope = m.kind === 'envelope'
    this.remove(m)
    if (envelope) sound.crackle()
    else sound.pop()
    sound.sparkle()
    this.burst(p.x, p.y - 0.5, 24, envelope ? ['#ffd23f', '#ff5a5f', '#fff4c2'] : ['#ffd23f', '#e5383b', '#2a9d5c', '#fff'], 9)
    this.lid = { x: p.x, y: p.y - 1, vx: (Math.random() - 0.5) * 4, vy: -12, a: 0, kind: m.kind, life: 0 }
    for (let i = 0; i < 6; i++) {
      const k = this.add('plain', p.x + (Math.random() - 0.5) * 1.2, p.y - 0.6 - Math.random(), 1, this.design(true))
      k.body.setLinearVelocity(Vec2((Math.random() - 0.5) * 5, -9 - Math.random() * 5))
    }
  }

  /** Every marble in the jar pops away, quickly and in no order, after its prize. */
  popAll(done: () => void) {
    this.settled = done
    const now = performance.now()
    ;[...this.ms].sort(() => Math.random() - 0.5).forEach((m, i) => (m.vanish = now + 300 + i * 28))
    this.lastEvent = now
    this.quiet = 0
    this.wake()
  }

  /** A burst of little stars or crumbs, each a small piece the graphics chip flies along its arc and fades. */
  private burst(x: number, y: number, n: number, colours: string[], speed = 10, star = true) {
    if (this.dead || !this.scale) return
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = speed * (0.4 + Math.random() * 0.8)
      const vx = Math.cos(a) * sp
      const vy = Math.sin(a) * sp - speed * 0.3
      const life = 0.8 + Math.random() * 0.6
      const size = (0.18 + Math.random() * 0.2) * (star ? 3.6 : 2.8) * this.scale
      const el = document.createElement('div')
      const colour = colours[i % colours.length]
      el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;${star ? '' : `border-radius:50%;background:${colour}`}`
      if (star) el.innerHTML = `<svg viewBox="-1 -1 2 2" width="100%" height="100%"><path d="${STAR_PATH}" fill="${colour}"/></svg>`
      const at = (t: number) =>
        `translate(${this.ox + (x + vx * t) * this.scale - size / 2}px, ${this.oy + (y + vy * t + 7 * t * t) * this.scale - size / 2}px)`
      this.fx.append(el)
      el.animate(
        [0, 0.25, 0.5, 0.75, 1].map((k) => ({ transform: at(k * life), opacity: 1 - k })),
        { duration: life * 1000, easing: 'linear', fill: 'forwards' },
      ).onfinish = () => el.remove()
    }
  }

  // --- Where things are -------------------------------------------------------------------------

  private viewLeft() {
    return -this.ox / this.scale
  }
  private viewRight() {
    return (this.boxWidth - this.ox) / this.scale
  }

  /** Fits the jar's part of the world into its side of the screen; the canvas covers the whole screen. */
  layout(area: { left: number; top: number; width: number; height: number }) {
    const rect = this.box.getBoundingClientRect()
    this.boxWidth = rect.width
    this.dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
    for (const c of [this.frontCanvas, this.backCanvas]) {
      c.width = Math.max(10, Math.round(rect.width * this.dpr))
      c.height = Math.max(10, Math.round(rect.height * this.dpr))
    }
    const vw = VIEW.x1 - VIEW.x0
    const vh = VIEW.y1 - VIEW.y0
    this.scale = Math.max(1, Math.min(area.width / vw, area.height / vh))
    this.ox = area.left - rect.left + (area.width - vw * this.scale) / 2 - VIEW.x0 * this.scale
    this.oy = area.top - rect.top + (area.height - vh * this.scale) / 2 - VIEW.y0 * this.scale
    this.marbleLayer.resize(this.scale)
    this.clearStamps()
    this.back = null
    this.actionDrawn = false
    this.sceneryLayer.build(
      this.season,
      { w: rect.width, h: rect.height, scale: this.scale, ox: this.ox, oy: this.oy },
      {
        cat: { name: 'cat', x: DECOR.cat.x, w: DECOR.cat.w, foot: 0.95, ground: GROUND },
        tree: { name: 'tree', x: DECOR.tree.x, w: DECOR.tree.w, foot: 0.99, ground: GROUND },
      },
    )
    this.draw(performance.now(), true)
    this.wake()
  }

  /** A place in the jar's world, on the screen (for the marbles flown from the wheel into the jar's mouth). */
  toScreen(x: number, y: number): { x: number; y: number; unit: number } {
    const rect = this.box.getBoundingClientRect()
    return { x: rect.left + this.ox + x * this.scale, y: rect.top + this.oy + y * this.scale, unit: this.scale }
  }

  /** The jar as it now stands, to keep with the class: only what is in the glass, never what fell on the shelf. */
  saved(): SavedMarble[] {
    const r2 = (n: number) => Math.round(n * 100) / 100
    return this.ms
      .filter((m) => {
        const p = m.body.getPosition()
        return (
          (m.kind === 'plain' || m.kind === 'power' || m.kind === 'mega' || m.kind === 'megamega' || m.kind === 'drop') &&
          m.vanish === undefined &&
          insideJar(p.x, p.y)
        )
      })
      .map((m) => {
        const p = m.body.getPosition()
        const s: SavedMarble = [
          kindCode(m.kind as MarbleKind),
          m.design ? 0 : m.colourIndex,
          r2(p.x),
          r2(p.y),
          r2(m.body.getAngle() % (Math.PI * 2)),
          r2(m.r),
        ]
        if (m.design) s.push(m.design)
        return s
      })
  }

  // --- The loop ---------------------------------------------------------------------------------

  private wake() {
    if (this.raf || this.dead) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  private frame = (now: number) => {
    this.raf = 0
    if (this.dead) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    let busy = false
    try {
      busy = this.step(now, dt)
    } catch (e) {
      console.error(e)
    }
    // The witch, the sleigh or the cloud drifting off after the jar has settled still move.
    if (this.flyer || this.cloud) busy = true
    try {
      this.draw(now, busy)
    } catch (e) {
      console.error(e)
    }
    if (busy) this.raf = requestAnimationFrame(this.frame)
  }

  private effectsActive(now: number) {
    return (
      // The witch or the sleigh flying off after their gift doesn't hold the moment open.
      !!(this.gift || this.hover || this.chute || this.lid) ||
      (!!this.cloud && this.cloud.x < 24) ||
      (!!this.flyer && (this.flyer.kind === 'witch' ? this.flyer.poured < 6 : !this.flyer.dropped)) ||
      this.pending.length > 0 ||
      this.bolts.length > 0 ||
      now < this.busyUntil ||
      this.ms.some(
        (m) =>
          m.grow ||
          m.vanish !== undefined ||
          m.kind === 'popcorn' ||
          m.kind === 'kernel' ||
          m.kind === 'present' ||
          m.kind === 'envelope' ||
          m.ghost,
      )
    )
  }

  /** Moves the world on to this moment. True while anything still moves. */
  private step(now: number, dt: number): boolean {
    while (this.pending.length && now >= this.pending[0].at) {
      const p = this.pending.shift()!
      const m = this.add(p.kind, JAR.CX + (Math.random() - 0.5) * 2.4, JAR.MOUTH - 3.2 - p.r, p.r, p.o)
      m.body.setAngularVelocity((Math.random() - 0.5) * 6)
    }
    const c = this.cloud
    if (c) {
      const over = Math.abs(c.x - JAR.CX) < 7
      // It comes in quickly from the board's far side, slows over the jar, and drifts off.
      c.x += (over ? 3 : c.x < -8 ? 32 : 9) * dt
      if (c.x > JAR.CX - 5 && c.flashes < 2 && now > c.nextFlash) {
        c.glow = 1
        c.flashes++
        c.nextFlash = now + 900
      }
      c.glow = Math.max(0, c.glow - dt * 3.2)
      if (c.x > -3 && c.x < 23 && now > c.nextDrop) {
        this.busyUntil = now + 1500
        c.nextDrop = now + 95
        const d = this.add('drop', c.x + (Math.random() - 0.5) * 6.2, c.y + 2.4, RADIUS.drop)
        d.body.setLinearVelocity(Vec2(0, 4))
      }
      if (c.x > Math.max(40, this.viewRight() + 8)) {
        this.cloud = null
      }
    }
    const f = this.flyer
    if (f) {
      const near = Math.abs(f.x - (f.kind === 'witch' ? -BUCKET.x : 0) - JAR.CX) < 3.2
      // Quickly across the board's far side, slowly over the jar.
      const far = f.dir > 0 ? f.x < -10 : f.x > 30
      const slow = near && f.kind === 'witch' && f.poured < 6 ? 1.3 : f.kind === 'santa' && near ? 4 : 0
      f.x += f.dir * (slow || (far && !f.dropped && f.poured === 0 ? 18 : 8)) * dt
      if (f.kind === 'witch' && !f.bubbleUntil && f.x < this.viewRight() - 4) f.bubbleUntil = now + 3200
      if (f.kind === 'witch' && Math.abs(f.x + BUCKET.x - JAR.CX) < 2.6 && f.poured < 6) {
        f.tip = Math.min(1, f.tip + dt * 3)
        if (now > f.nextPour && f.tip > 0.6) {
          f.nextPour = now + 210
          f.poured++
          const bx = f.x + BUCKET.x
          this.add('plain', Math.max(JAR.CX - 2.6, Math.min(JAR.CX + 2.6, bx)), f.y + 3.6, 1, this.design(true)).body.setLinearVelocity(
            Vec2(0, 3),
          )
          if (f.poured === 1) sound.sparkle()
        }
      } else f.tip = Math.max(0, f.tip - dt * 2)
      if (f.kind === 'santa' && !f.dropped && f.x >= JAR.CX - 2) {
        f.dropped = true
        this.gift = { kind: 'present', x: f.x - 1.2, y: f.y + 1.6, t: 0, startX: f.x - 1.2 }
      }
      // Gone once it is off the screen the way it is flying.
      if ((f.dir < 0 && f.x < Math.min(-26, this.viewLeft() - 14)) || (f.dir > 0 && f.x > Math.max(44, this.viewRight() + 14))) {
        if (f.kind === 'witch') this.busyUntil = now + 1200
        this.flyer = null
      }
    }
    const g = this.gift
    if (g) {
      // A present on its parachute, or a red envelope floating down like a leaf.
      g.t += dt
      if (g.kind === 'present') {
        g.y += 3.1 * dt
        g.x = g.startX + (JAR.CX - g.startX) * Math.min(1, g.t / 2.4) + Math.sin(g.t * 2.4) * 0.6 * Math.max(0, 1 - g.t / 3)
      } else {
        g.y += 7 * dt
        g.x = JAR.CX + (g.startX - JAR.CX) * Math.max(0, 1 - g.t / 2.4) * Math.cos(g.t * 2.6)
      }
      if (g.y >= JAR.MOUTH - (g.kind === 'envelope' ? 3.8 : 2.2)) {
        const m = this.add(g.kind, Math.max(JAR.CX - 1.5, Math.min(JAR.CX + 1.5, g.x)), g.y, 1, {
          colour: g.kind === 'present' ? '#d62839' : '#d62828',
          colourIndex: 0,
        })
        m.body.setLinearVelocity(Vec2(0, 3))
        if (g.kind === 'present') this.chute = { x: g.x, y: g.y - 2.6 * PRESENT, a: 1 }
        this.gift = null
      }
    }
    if (this.chute) {
      this.chute.y -= 3 * dt
      this.chute.a -= dt * 0.8
      if (this.chute.a <= 0) this.chute = null
    }
    if (this.lid) {
      const l = this.lid
      l.life += dt
      l.vy += 30 * dt
      l.x += l.vx * dt
      l.y += l.vy * dt
      l.a += dt * 6
      if (l.life > 1.4) this.lid = null
    }

    this.acc += dt
    while (this.acc >= STEP) {
      for (const m of this.ms) {
        if (!m.grow) continue
        m.grow.t = Math.min(1, m.grow.t + (m.design?.startsWith('puffed') ? 1 / 7 : 1 / 36))
        this.setRadius(m, m.grow.from + (m.grow.to - m.grow.from) * (1 - Math.pow(1 - m.grow.t, 3)))
        if (m.grow.t >= 1) m.grow = undefined
      }
      this.world.step(STEP, 8, 3)
      this.acc -= STEP
    }

    const x0 = this.viewLeft() - 3
    const x1 = this.viewRight() + 3
    let popped = 0
    for (const m of [...this.ms]) {
      const p = m.body.getPosition()
      if (m.vanish !== undefined && now >= m.vanish) {
        if (!m.vanished) {
          m.vanished = true
          if (this.soundOn && popped++ % 2 === 0) this.hooks.pop()
        }
        if (now - m.vanish > POP_MS) this.remove(m)
        continue
      }
      if (p.y > 40 || p.x < x0 || p.x > x1) {
        this.remove(m)
        continue
      }
      if (p.y > GROUND - 4 && !m.slowed && !insideJar(p.x, p.y)) {
        // Out of the jar on the shelf: it rolls, then comes to rest, as a real marble does.
        m.slowed = true
        m.body.setLinearDamping(0.9)
        m.body.setAngularDamping(1.4)
      }
      if (m.soak) {
        this.burst(p.x, p.y, 3, ['#bfe3ff', '#e8f6ff'], 3, false)
        this.remove(m)
        continue
      }
      if (m.kind === 'popcorn') {
        if (!m.popAt && (m.landed || now - m.born > 3500)) m.popAt = now + 900 + this.popOrder++ * 450
        if (m.popAt) {
          const left = m.popAt - now
          if (left < 900 && left > 0) {
            const k = 1 - left / 900
            if (Math.random() < 0.25 + k * 0.5)
              m.body.applyLinearImpulse(Vec2((Math.random() - 0.5) * 2.2 * k, -Math.random() * 2.4 * k), m.body.getWorldCenter(), true)
          }
          if (left <= 0) this.popBox(m)
        }
      }
      if (m.ghost && (p.y < JAR.MOUTH - 1.5 || now > m.ghost)) {
        m.ghost = undefined
        m.body.getFixtureList()?.setSensor(false)
      }
      if (m.kind === 'kernel' && m.popAt) {
        if (now < m.popAt) {
          // The sizzle: little hops, as in a hot pan.
          if (Math.random() < 0.18)
            m.body.applyLinearImpulse(Vec2((Math.random() - 0.5) * 0.12, -Math.random() * 0.22), m.body.getWorldCenter(), true)
        } else {
          m.popAt = undefined
          m.kind = 'plain'
          m.design = Math.random() < 0.6 ? 'puffed' : 'puffedButter'
          m.colour = DESIGN_COLOUR[m.design]
          m.grow = { from: m.r, to: 1, t: 0 }
          if (m.bigPop) {
            // A big pop: up through the mouth and over the rim, out of the jar, through the pile in a blink.
            const side = p.x < JAR.CX ? -1 : 1
            const dx = JAR.CX + side * 1.5 - p.x
            const dy = JAR.MOUTH - 1 - p.y
            const d = Math.hypot(dx, dy) || 1
            const sp = 40 + Math.random() * 8
            m.body.setLinearVelocity(Vec2((dx / d) * sp + side * (4 + Math.random() * 3), (dy / d) * sp))
            m.body.getFixtureList()?.setSensor(true)
            m.ghost = now + 900
          } else m.body.setLinearVelocity(Vec2((Math.random() - 0.5) * 5, -(7 + Math.random() * 7)))
          if (this.soundOn) sound.kernelPop()
          this.burst(p.x, p.y, 5, ['#fffaf0', '#ffe27a'], 4, false)
          this.lastEvent = now
        }
      }
      if ((m.kind === 'present' || m.kind === 'envelope') && m.landed && !m.openAt) m.openAt = m.landed + 1000
      if (m.openAt && now > m.openAt) this.openGift(m)
    }

    this.bolts = this.bolts.filter((b) => b.until > now && this.ms.includes(b.from) && this.ms.includes(b.to))
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 4)

    // Still?
    const effects = this.effectsActive(now)
    let moving = effects || Math.abs(this.dim - this.dimTarget) > 0.01
    if (!moving)
      for (const m of this.ms) {
        const v = m.body.getLinearVelocity()
        if (m.body.isAwake() && v.x * v.x + v.y * v.y > 0.02) {
          moving = true
          break
        }
      }
    if (now - this.lastEvent < 400) moving = true
    this.quiet = moving ? 0 : this.quiet + 1
    // A marble left creeping on the pile must never hold the moment open: 5 s after the last thing
    // happened, with nothing else going on, the jar counts as settled (the teacher found no way out after a spin).
    if (this.quiet > 40 || (!effects && now - this.lastEvent > 5000)) {
      for (const m of this.ms) m.body.setAwake(false)
      const cb = this.settled
      this.settled = null
      cb?.()
      return false
    }
    return true
  }

  // --- Drawing ----------------------------------------------------------------------------------

  private toWorld(c: CanvasRenderingContext2D) {
    c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy)
  }

  /** What never moves, drawn once: the sky, the moon and cobwebs, the shelf, the things on it, the glass behind. */
  private buildBack(c: CanvasRenderingContext2D) {
    const s = this.season
    const w = this.backCanvas.width / this.dpr
    const h = this.backCanvas.height / this.dpr
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const g = c.createLinearGradient(0, 0, 0, h)
    const [top, bottom] =
      s === 'oct'
        ? ['#1d1033', '#341b52']
        : s === 'dec'
          ? ['#0c2142', '#1b3f6e']
          : s === 'lny'
            ? ['#4a0b0b', '#7c1616']
            : ['#10151f', '#1a2233']
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const u = Math.min(w, h) / 100
    if (s === 'oct') {
      const mx = w * 0.06 + this.ox * 0.6
      const mg = c.createRadialGradient(mx, h * 0.2, u * 4, mx, h * 0.2, u * 14)
      mg.addColorStop(0, 'rgba(255,240,180,.35)')
      mg.addColorStop(1, 'rgba(255,240,180,0)')
      c.fillStyle = mg
      c.fillRect(mx - u * 14, h * 0.2 - u * 14, u * 28, u * 28)
      c.fillStyle = '#fff1b8'
      c.beginPath()
      c.arc(mx, h * 0.2, u * 6, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgba(220,200,140,.5)'
      c.beginPath()
      c.arc(mx - u * 1.6, h * 0.19, u * 1.1, 0, Math.PI * 2)
      c.arc(mx + u * 1.4, h * 0.23, u * 0.7, 0, Math.PI * 2)
      c.fill()
      for (const [cx, sx] of [
        [0, 1],
        [w, -1],
      ]) {
        c.strokeStyle = 'rgba(230,225,255,.35)'
        c.lineWidth = Math.max(1, u * 0.18)
        const R = u * 16
        for (let i = 0; i <= 5; i++) {
          const a = (i / 5) * (Math.PI / 2)
          c.beginPath()
          c.moveTo(cx, 0)
          c.lineTo(cx + sx * Math.cos(a) * R, Math.sin(a) * R)
          c.stroke()
        }
        for (const k of [0.35, 0.62, 0.88]) {
          c.beginPath()
          for (let i = 0; i <= 5; i++) {
            const a = (i / 5) * (Math.PI / 2)
            const x = cx + sx * Math.cos(a) * R * k
            const y = Math.sin(a) * R * k
            if (i) c.quadraticCurveTo(cx + sx * Math.cos(a - 0.16) * R * k * 0.88, Math.sin(a - 0.16) * R * k * 0.88, x, y)
            else c.moveTo(x, y)
          }
          c.stroke()
        }
      }
    }
    this.toWorld(c)
    this.ground(c)
    c.fillStyle = 'rgba(0,0,0,.3)'
    c.beginPath()
    c.ellipse(JAR.CX, GROUND, JAR.WALL + 1.2, 0.55, 0, 0, Math.PI * 2)
    c.fill()
    const stand = (name: string, x: number, w: number, foot = 1) => drawArt(c, name, x, GROUND - (foot - 0.5) * (w / ART[name].aspect), w)
    if (s === 'oct') {
      stand('cat', DECOR.cat.x, DECOR.cat.w, 0.95)
      stand('hatpk', DECOR.hatpk.x, DECOR.hatpk.w)
    }
    if (s === 'dec') {
      stand('tree', DECOR.tree.x, DECOR.tree.w, 0.99)
      stand('snowman', DECOR.snowman.x, DECOR.snowman.w, 0.99)
    }
    if (s === 'lny') stand('basket', DECOR.basket.x, DECOR.basket.w, 0.935)
    drawJarBack(c)
    if (s === 'dec') {
      // Frosted glass: white mist round the inside of the glass, thickest at the edge.
      c.save()
      c.beginPath()
      JAR_PATH.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
      c.closePath()
      c.clip()
      c.lineJoin = 'round'
      for (const [wdt, a] of [
        [2.4, 0.1],
        [1.3, 0.14],
        [0.6, 0.2],
      ]) {
        c.beginPath()
        JAR_PATH.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
        c.strokeStyle = `rgba(235,246,255,${a})`
        c.lineWidth = wdt
        c.stroke()
      }
      c.restore()
    }
  }

  /** What the jar stands on, right across the screen (the teacher: it seemed to float). */
  private ground(c: CanvasRenderingContext2D) {
    const x0 = this.viewLeft() - 1
    const x1 = this.viewRight() + 1
    const y1 = (this.backCanvas.height / this.dpr - this.oy) / this.scale + 1
    const G = GROUND
    if (this.season === 'dec') {
      c.fillStyle = '#e6f1ff'
      c.beginPath()
      c.moveTo(x0, y1)
      for (let x = x0; x <= x1 + 1; x += 1) c.lineTo(x, G - 0.25 - Math.sin(x * 0.55) * 0.18 - Math.sin(x * 0.21 + 1) * 0.22)
      c.lineTo(x1 + 1, y1)
      c.fill()
      c.fillStyle = '#f9fcff'
      c.fillRect(x0, G + 0.4, x1 - x0, y1 - G)
      c.fillStyle = 'rgba(150,185,230,.35)'
      c.fillRect(x0, G + 0.35, x1 - x0, 0.3)
      return
    }
    const lny = this.season === 'lny'
    c.fillStyle = lny ? '#c0392b' : '#8a5a34'
    c.fillRect(x0, G - 0.15, x1 - x0, 0.9)
    c.fillStyle = lny ? '#ffcf4a' : '#a8723f'
    c.fillRect(x0, G - 0.15, x1 - x0, 0.14)
    const g = c.createLinearGradient(0, G + 0.75, 0, y1)
    g.addColorStop(0, lny ? '#8e1b1b' : '#5e3b20')
    g.addColorStop(1, lny ? '#5a0e0e' : '#3a2412')
    c.fillStyle = g
    c.fillRect(x0, G + 0.75, x1 - x0, y1 - G)
    c.fillStyle = lny ? '#ffcf4a' : 'rgba(0,0,0,.25)'
    c.fillRect(x0, G + 0.75, x1 - x0, lny ? 0.1 : 0.12)
    if (!lny) {
      c.strokeStyle = 'rgba(0,0,0,.18)'
      c.lineWidth = 0.08
      for (let x = Math.ceil(x0 / 9) * 9; x < x1; x += 9) {
        c.beginPath()
        c.moveTo(x, G - 0.15)
        c.lineTo(x + 0.4, G + 0.75)
        c.stroke()
      }
    }
  }

  /** The glass in front, drawn once, with December's snow on the rim and the New Year's ribbon. */
  private buildFront(c: CanvasRenderingContext2D) {
    this.toWorld(c)
    drawJarFront(c)
    const { CX, NECK, MOUTH, WALL, SHOULDER, NECK_TOP } = JAR
    if (this.season === 'dec') {
      c.fillStyle = '#f6fbff'
      for (let x = CX - NECK - 0.6; x <= CX + NECK + 0.6; x += 0.9) {
        c.beginPath()
        c.arc(x, MOUTH - 0.55 + Math.sin(x * 3) * 0.1, 0.55 + Math.abs(Math.sin(x * 1.7)) * 0.25, 0, Math.PI * 2)
        c.fill()
      }
      for (const s of [-1, 1])
        for (let i = 0; i < 4; i++) {
          const t = (i + 0.5) / 4
          const x = CX + s * (NECK + (WALL - NECK) * Math.sin((t * Math.PI) / 2))
          const y = NECK_TOP + (SHOULDER - NECK_TOP) * (1 - Math.cos((t * Math.PI) / 2)) - 0.35
          c.beginPath()
          c.arc(x, y, 0.42, 0, Math.PI * 2)
          c.fill()
        }
      drawArt(c, 'mistletoe', CX - NECK + 0.2, NECK_TOP - 0.1, 3.4)
    }
    if (this.season === 'lny') {
      c.fillStyle = '#d62828'
      c.fillRect(CX - NECK - 0.15, NECK_TOP - 0.9, 2 * NECK + 0.3, 0.7)
      c.fillStyle = '#ffd23f'
      c.fillRect(CX - NECK - 0.15, NECK_TOP - 0.62, 2 * NECK + 0.3, 0.14)
      c.fillStyle = '#d62828'
      c.beginPath()
      c.ellipse(CX + NECK - 0.6, NECK_TOP - 0.55, 0.9, 0.45, 0.5, 0, Math.PI * 2)
      c.ellipse(CX + NECK + 0.5, NECK_TOP - 0.55, 0.9, 0.45, -0.5, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#ffd23f'
      c.beginPath()
      c.arc(CX + NECK, NECK_TOP - 0.55, 0.28, 0, Math.PI * 2)
      c.fill()
    }
  }

  private clearStamps() {
    for (const st of this.stamps.values()) st.el.remove()
    this.stamps.clear()
  }

  /**
   * A thing of the show, drawn once into a small canvas (w by h in the world's units, its middle at
   * the canvas's middle) and placed where it now is by a transform, which the graphics chip does.
   */
  private place(
    key: string,
    w: number,
    h: number,
    draw: (c: CanvasRenderingContext2D) => void,
    x: number,
    y: number,
    angle = 0,
    opacity = 1,
    into = this.fx,
  ) {
    let st = this.stamps.get(key)
    if (!st) {
      const px = Math.min(2, window.devicePixelRatio || 1) * this.scale
      const c = document.createElement('canvas')
      c.width = Math.max(2, Math.ceil(w * px))
      c.height = Math.max(2, Math.ceil(h * px))
      c.style.cssText = `position:absolute;left:0;top:0;width:${w * this.scale}px;height:${h * this.scale}px;transform-origin:center;will-change:transform`
      const ctx = c.getContext('2d')!
      ctx.setTransform(px, 0, 0, px, (w * px) / 2, (h * px) / 2)
      try {
        draw(ctx)
      } catch {
        // left out
      }
      into.append(c)
      st = { el: c, w: w * this.scale, h: h * this.scale }
      this.stamps.set(key, st)
    }
    st.el.style.transform = `translate(${(this.ox + x * this.scale - st.w / 2).toFixed(1)}px, ${(this.oy + y * this.scale - st.h / 2).toFixed(1)}px) rotate(${angle.toFixed(3)}rad)`
    st.el.style.opacity = opacity === 1 ? '' : String(Math.max(0, opacity))
    st.el.style.display = ''
    return st.el
  }

  /** A layer drawn on its canvas, swapped for a still picture of it as soon as the picture is ready. */
  private freeze(c: HTMLCanvasElement, img: HTMLImageElement) {
    c.style.display = 'block'
    img.style.display = 'none'
    c.toBlob((blob) => {
      if (!blob || this.dead) return
      const url = URL.createObjectURL(blob)
      this.urls.push(url)
      img.onload = () => {
        if (this.dead) return
        img.style.display = 'block'
        c.style.display = 'none'
      }
      img.src = url
    })
  }

  private draw(now: number, busy: boolean) {
    if (!this.back) {
      const b = this.backCanvas.getContext('2d')!
      b.setTransform(1, 0, 0, 1, 0, 0)
      b.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height)
      this.buildBack(b)
      this.back = this.backCanvas
      const f = this.frontCanvas.getContext('2d')!
      f.setTransform(1, 0, 0, 1, 0, 0)
      f.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height)
      this.buildFront(f)
      this.freeze(this.backCanvas, this.backImg)
      this.freeze(this.frontCanvas, this.frontImg)
    }
    // The marbles and the wedges' shows: only while something moves, and once more when it stops.
    if (!busy && this.actionDrawn) return
    this.actionDrawn = !busy
    const shown: Shown[] = []
    const used = new Set<string>()
    for (const m of this.ms) {
      const p = m.body.getPosition()
      let x = p.x
      let y = p.y
      if (m.kind === 'popcorn' && m.popAt) {
        const left = m.popAt - now
        if (left < 1600 && left > 0) {
          const k = 1 - left / 1600
          x += Math.sin(now / 28) * 0.12 * k
          y += Math.cos(now / 33) * 0.08 * k
        }
      }
      if (m.kind === 'present' || m.kind === 'envelope') {
        let id = this.ids.get(m)
        if (id === undefined) this.ids.set(m, (id = this.nextId++))
        const key = `body${id}`
        used.add(key)
        if (m.kind === 'present')
          this.place(key, 3.2 * PRESENT, 3.2 * PRESENT, (c) => this.drawPresent(c, 0, 0, 0, false), x, y, m.body.getAngle())
        else this.place(key, 4.8, 4.8 / ART.envelope.aspect + 0.2, (c) => drawArt(c, 'envelope', 0, 0, 4.6), x, y, m.body.getAngle())
        continue
      }
      shown.push({
        ball: m,
        x,
        y,
        angle: m.body.getAngle(),
        vanish: m.vanish !== undefined && now >= m.vanish ? Math.min(1, (now - m.vanish) / POP_MS) : undefined,
      })
    }
    this.marbleLayer.update(shown, this.ox, this.oy)
    const cl = this.cloud
    if (cl) {
      used.add('cloud').add('glow')
      this.place('cloud', 14, 9, (c) => this.drawCloud(c, { ...cl, x: 0, y: 0, glow: 0 }), cl.x, cl.y)
      this.place('glow', 19, 19, (c) => this.drawCloud(c, { ...cl, x: 0, y: 0, glow: 1 }), cl.x, cl.y, 0, cl.glow)
    }
    const f = this.flyer
    if (f) {
      const bob = Math.sin(now / (f.kind === 'witch' ? 260 : 300)) * (f.kind === 'witch' ? 0.25 : 0.3)
      if (f.kind === 'santa') {
        used.add('sled')
        // The teacher's sleigh: Santa at the back, his reindeer pulling ahead.
        this.place('sled', 19, 19, (c) => drawArt(c, 'sled', 0, 0, 19), f.x + 5.4, f.y + bob, Math.sin(now / 500) * 0.03)
      } else {
        used.add('witch').add('bucket')
        // The teacher's witch, flying left, her pumpkin candy bucket hanging from the front of her broom, tipping as she pours.
        const tilt = Math.sin(now / 420) * 0.03
        this.place('witch', 10, 10 / ART.witch.aspect, (c) => drawArt(c, 'witch', 0, 0, 10), f.x, f.y + bob, tilt)
        // The bucket hangs by its handle, so it turns about the handle's top.
        const hx = f.x + BUCKET.x
        const hy = f.y + bob + BUCKET.y
        const t = -f.tip * 1.3
        this.place('bucket', 3.2, 3.2, (c) => drawArt(c, 'bucket', 0, 0, 3), hx - Math.sin(t) * 1.45, hy + Math.cos(t) * 1.45, t)
        if (now < f.bubbleUntil) {
          used.add('bubble')
          this.place('bubble', 9, 4, (c) => this.bubble(c, 0, 1, 'Hee hee!'), f.x + 5.6, f.y - 3.2 + bob - 1)
        }
      }
    }
    const g = this.gift
    if (g) {
      if (g.kind === 'present') {
        used.add('gift')
        this.place('gift', 6.8, 8.4, (c) => this.drawPresent(c, 0, 2.7, 0, true), g.x, g.y - 2.7, Math.sin(g.t * 2.4) * 0.12)
      } else {
        used.add('envelope')
        this.place(
          'envelope',
          4.8,
          4.8 / ART.envelope.aspect + 0.2,
          (c) => drawArt(c, 'envelope', 0, 0, 4.6),
          g.x,
          g.y,
          Math.sin(g.t * 2.6 + 1.5) * 0.4,
        )
      }
    }
    if (this.chute) {
      used.add('chute')
      this.place(
        'chute',
        5 * PRESENT,
        2.6 * PRESENT,
        (c) => {
          c.scale(PRESENT, PRESENT)
          this.drawChute(c, 0, 1.1, 1)
        },
        this.chute.x,
        this.chute.y - 1.1 * PRESENT,
        0,
        this.chute.a,
      )
    }
    const l = this.lid
    if (l) {
      used.add(`lid${l.kind}`)
      this.place(
        `lid${l.kind}`,
        4,
        4,
        (c) => {
          const k = l.kind === 'present' ? PRESENT : 1.7
          c.scale(k, k)
          c.fillStyle = l.kind === 'present' ? '#d62839' : '#d62828'
          c.fillRect(-1.05, -0.3, 2.1, 0.6)
          c.fillStyle = l.kind === 'present' ? '#2a9d5c' : '#ffd23f'
          c.fillRect(-0.18, -0.3, 0.36, 0.6)
        },
        l.x,
        l.y,
        l.a,
        1 - l.life / 1.4,
      )
    }
    // The Power Marble's lightning, jagged afresh each frame for the half second it lasts.
    if (this.bolts.length || this.boltsSvg.childElementCount) {
      this.boltsSvg.innerHTML = this.bolts.length
        ? `<g transform="matrix(${this.scale},0,0,${this.scale},${this.ox},${this.oy})">${this.bolts
            .map(({ from, to }) => {
              const a = from.body.getPosition()
              const e = to.body.getPosition()
              const nx = -(e.y - a.y)
              const ny = e.x - a.x
              const len = Math.hypot(nx, ny) || 1
              const pts = [[a.x, a.y]]
              for (let i = 1; i < 6; i++) {
                const off = (Math.random() - 0.5) * 1.1
                pts.push([a.x + ((e.x - a.x) * i) / 6 + (nx / len) * off, a.y + ((e.y - a.y) * i) / 6 + (ny / len) * off])
              }
              pts.push([e.x, e.y])
              const d = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
              return `<polyline points="${d}" fill="none" stroke="rgba(120,190,255,.45)" stroke-width=".5" stroke-linejoin="round"/><polyline points="${d}" fill="none" stroke="#fff" stroke-width=".16" stroke-linejoin="round"/>`
            })
            .join('')}</g>`
        : ''
    }
    // The Mega Mega Marble's dim and its light: the dim over the whole board, the marble above it.
    this.dimEl.style.opacity = this.dim > 0.01 ? this.dim.toFixed(3) : '0'
    const hv = this.hover
    if (hv) {
      const hx = hv.x + (hv.shake ? (Math.random() - 0.5) * hv.shake * 2 : 0)
      const hy = hv.y + (hv.shake ? (Math.random() - 0.5) * hv.shake * 2 : 0)
      if (hv.rays) {
        used.add('rays')
        const el = this.place(
          'rays',
          27,
          27,
          (c) => {
            for (let i = 0; i < 12; i++) {
              c.rotate(Math.PI / 6)
              const gr = c.createLinearGradient(0, 0, 0, -13)
              gr.addColorStop(0, 'rgba(255,220,90,.55)')
              gr.addColorStop(1, 'rgba(255,220,90,0)')
              c.fillStyle = gr
              c.beginPath()
              c.moveTo(0, 0)
              c.lineTo(-1.3, -13)
              c.lineTo(1.3, -13)
              c.closePath()
              c.fill()
            }
          },
          hv.x,
          hv.y,
          now / 1800,
          1,
          this.top,
        )
        el.style.zIndex = '0'
      }
      const key = `hover${hv.kind}`
      used.add(key)
      const el = this.place(
        key,
        3.3 * 3.2,
        3.3 * 3.2,
        (c) => drawBall(c, { ...hv, r: 3.3 }, 0, 0, 0, this.scale * 2),
        hx,
        hy,
        now / 900,
        1,
        this.top,
      )
      el.style.transform += ` scale(${(hv.r / 3.3).toFixed(3)})`
    }
    for (const [key, st] of this.stamps) if (!used.has(key)) st.el.style.display = 'none'
  }

  private drawCloud(c: CanvasRenderingContext2D, cl: NonNullable<MarbleScene['cloud']>) {
    const puffs: [number, number, number][] = [
      [-3.2, 0.6, 1.9],
      [-1.4, -0.4, 2.5],
      [0.9, -0.8, 2.8],
      [3, 0.2, 2.1],
      [1.2, 1, 2],
      [-1, 1.1, 1.8],
    ]
    if (cl.glow > 0) {
      // Lightning is a soft glow inside the cloud and the sky just round it, never a flash across the screen.
      const g = c.createRadialGradient(cl.x, cl.y, 1, cl.x, cl.y, 9)
      g.addColorStop(0, `rgba(255,250,210,${0.55 * cl.glow})`)
      g.addColorStop(1, 'rgba(255,250,210,0)')
      c.fillStyle = g
      c.beginPath()
      c.arc(cl.x, cl.y, 9, 0, Math.PI * 2)
      c.fill()
    }
    c.fillStyle = '#aeb6c8'
    for (const [x, y, r] of puffs) {
      c.beginPath()
      c.arc(cl.x + x, cl.y + y + 0.35, r, 0, Math.PI * 2)
      c.fill()
    }
    c.fillStyle = cl.glow > 0 ? `rgb(${215 + 40 * cl.glow},${220 + 35 * cl.glow},${232 + 23 * cl.glow})` : '#d7dce8'
    for (const [x, y, r] of puffs) {
      c.beginPath()
      c.arc(cl.x + x, cl.y + y, r, 0, Math.PI * 2)
      c.fill()
    }
    if (cl.glow > 0.4) {
      c.strokeStyle = `rgba(255,236,120,${cl.glow})`
      c.lineWidth = 0.28
      c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(cl.x + 0.4, cl.y - 0.6)
      c.lineTo(cl.x - 0.5, cl.y + 0.7)
      c.lineTo(cl.x + 0.3, cl.y + 0.7)
      c.lineTo(cl.x - 0.4, cl.y + 2)
      c.stroke()
    }
    // A face, so it reads as a friendly cloud to a young class.
    c.fillStyle = '#566178'
    c.beginPath()
    c.arc(cl.x - 0.8, cl.y + 0.2, 0.2, 0, Math.PI * 2)
    c.arc(cl.x + 0.9, cl.y + 0.2, 0.2, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#566178'
    c.lineWidth = 0.14
    c.beginPath()
    c.arc(cl.x + 0.05, cl.y + 0.55, 0.45, 0.2, Math.PI - 0.2)
    c.stroke()
  }

  private bubble(c: CanvasRenderingContext2D, x: number, y: number, text: string) {
    c.font = 'bold 1.25px Andika, sans-serif'
    const w = c.measureText(text).width + 1.4
    const h = 2
    c.fillStyle = '#fff'
    c.strokeStyle = '#1b1b2a'
    c.lineWidth = 0.1
    c.beginPath()
    c.roundRect(x - w / 2, y - h, w, h, 0.7)
    c.fill()
    c.stroke()
    c.beginPath()
    c.moveTo(x - 0.3, y - 0.05)
    c.lineTo(x + 0.4, y + 0.7)
    c.lineTo(x + 0.4, y - 0.05)
    c.fill()
    c.fillStyle = '#1b1b2a'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, x, y - h / 2 + 0.05)
  }

  private drawPresent(c: CanvasRenderingContext2D, x: number, y: number, angle: number, withChute: boolean) {
    c.save()
    c.translate(x, y)
    c.scale(PRESENT, PRESENT)
    if (withChute) {
      c.strokeStyle = 'rgba(255,255,255,.8)'
      c.lineWidth = 0.07
      c.beginPath()
      c.moveTo(-0.9, -0.85)
      c.lineTo(-2.2, -2.6)
      c.moveTo(0.9, -0.85)
      c.lineTo(2.2, -2.6)
      c.moveTo(0, -0.85)
      c.lineTo(0, -2.9)
      c.stroke()
      this.drawChute(c, 0, -2.6, 1)
    }
    c.rotate(angle)
    c.fillStyle = '#d62839'
    c.fillRect(-0.95, -0.85, 1.9, 1.7)
    c.fillStyle = '#2a9d5c'
    c.fillRect(-0.18, -0.85, 0.36, 1.7)
    c.fillRect(-0.95, -0.18, 1.9, 0.36)
    c.beginPath()
    c.ellipse(-0.35, -1.05, 0.38, 0.22, 0.4, 0, Math.PI * 2)
    c.ellipse(0.35, -1.05, 0.38, 0.22, -0.4, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  private drawChute(c: CanvasRenderingContext2D, x: number, y: number, a: number) {
    c.globalAlpha = a
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#ffffff' : '#e5383b'
      c.beginPath()
      c.moveTo(x, y)
      c.arc(x, y, 2.3, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6)
      c.closePath()
      c.fill()
    }
    c.globalAlpha = 1
  }

  destroy() {
    this.dead = true
    cancelAnimationFrame(this.raf)
    this.timers.forEach(clearTimeout)
    this.stopPictures()
    this.sceneryLayer.clear()
    this.marbleLayer.clear()
    this.urls.forEach((u) => URL.revokeObjectURL(u))
  }
}
