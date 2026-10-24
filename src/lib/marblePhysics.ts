import { Chain, Circle, Vec2, World, type Body } from 'planck'
import { colourOf, type DrawnMarble } from './marbleArt'
import { JAR, JAR_PATH, RADIUS, kindCode, kindOf, zapCount, type MarbleKind, type SavedMarble } from './marbles'

/**
 * The marbles falling into the jar, as real marbles do: Planck, a modern Box2D, the engine Toy
 * Theater's marble jar uses (the teacher liked how its marbles move). It runs only while something
 * moves and stops once they settle, and it is loaded only when the jar first opens (MarbleMoment
 * is a lazy chunk), so a class on the Knight's quest never downloads it.
 */

export interface Live extends DrawnMarble {
  body: Body
  colourIndex: number
  fired?: boolean
  thudded?: boolean
  grow?: { from: number; to: number; t: number }
  popped?: boolean
}

export interface JarSounds {
  clink(size: number, strength: number): void
  thud(): void
  /** The jar gives a little shake as the Mega lands (drawn by whoever holds the jar's picture). */
  shake(): void
  zap(): void
  grow(): void
  pop(): void
}

/** How long a popping marble takes to go, and how far apart they go. */
export const POP_MS = 160
const POP_GAP_MS = 28
const STEP = 1 / 60

export class MarbleJarWorld {
  private world = new World({ gravity: Vec2(0, 34) })
  private glass: Body
  private marbles: Live[] = []
  private pending: MarbleKind[] = []
  private nextDrop = 0
  private acc = 0
  private quiet = 0
  private bolts: { from: Live; to: Live; until: number }[] = []
  private nextColour = 0
  private sounds: JarSounds
  /** Only once the class can hear: a jar rebuilt from where it was saved makes no sound as it does. */
  soundOn = true

  constructor(saved: SavedMarble[], sounds: JarSounds) {
    this.sounds = sounds
    this.glass = this.world.createBody()
    this.glass.createFixture(
      Chain(
        JAR_PATH.map(([x, y]) => Vec2(x, y)),
        false,
      ),
      { friction: 0.5, restitution: 0.25 },
    )
    for (const m of saved) {
      const live = this.add(kindOf(m), m[2], m[3], m[1], m[5], m[4])
      live.fired = true
      live.thudded = true
      live.zapped = live.kind === 'plain' && m[5] > RADIUS.plain + 0.05
      live.body.setAwake(false)
    }
    this.nextColour = saved.reduce((n, m) => Math.max(n, m[1] + 1), 0)
    this.world.on('begin-contact', (contact) => this.contact(contact.getFixtureA().getBody(), contact.getFixtureB().getBody()))
  }

  private add(kind: MarbleKind, x: number, y: number, colourIndex: number, r = RADIUS[kind], angle = 0): Live {
    const body = this.world.createBody({ type: 'dynamic', position: Vec2(x, y), angle, allowSleep: true, angularDamping: 0.05 })
    body.createFixture(Circle(r), { density: 1, friction: 0.45, restitution: 0.32 })
    const live: Live = { body, kind, colourIndex, colour: colourOf(kind, colourIndex), x, y, angle, r }
    body.setUserData(live)
    this.marbles.push(live)
    return live
  }

  /**
   * A clink only when two things meet at speed, and only down inside the jar: a marble resting on
   * the pile or sliding against its neighbour is silent, and so are two brushing as they fall in
   * (2026-10-24, the teacher: some clinked before they had hit anything).
   */
  private contact(A: Body, B: Body) {
    const a = A.getUserData() as Live | null
    const b = B.getUserData() as Live | null
    if (!a && !b) return
    // The Power Marble zaps the first time it touches anything in the jar, however softly.
    const power = a?.kind === 'power' && !a.fired ? a : b?.kind === 'power' && !b.fired ? b : null
    if (power && power.body.getPosition().y > JAR.MOUTH + 1) setTimeout(() => this.zap(power), 0)
    if (!this.soundOn) return
    const pa = A.getPosition()
    const pb = B.getPosition()
    const va = A.getLinearVelocity()
    const vb = B.getLinearVelocity()
    let nx = pb.x - pa.x
    let ny = pb.y - pa.y
    if (!a || !b) {
      nx = 0
      ny = 1
    }
    const len = Math.hypot(nx, ny) || 1
    const speed = Math.abs(((vb.x - va.x) * nx + (vb.y - va.y) * ny) / len)
    if (speed < 3.5) return
    const low = (m: Live | null, body: Body) => !m || body.getPosition().y > JAR.SHOULDER
    if (!low(a, A) || !low(b, B)) return
    const mega = a?.kind === 'mega' ? a : b?.kind === 'mega' ? b : null
    if (mega && !mega.thudded && speed > 6) {
      mega.thudded = true
      this.sounds.thud()
      this.sounds.shake()
      return
    }
    this.sounds.clink(Math.max(a?.r ?? 1, b?.r ?? 1), Math.min(8, speed / 2))
  }

  /** Lightning to the 2, 3 or 4 plain marbles nearest the Power Marble, and they swell to its size. */
  private zap(p: Live) {
    if (p.fired) return
    p.fired = true
    const pos = p.body.getPosition()
    const near = this.marbles
      .filter((m) => m.kind === 'plain' && !m.zapped && !m.pop)
      .map((m) => ({ m, d: Math.hypot(m.body.getPosition().x - pos.x, m.body.getPosition().y - pos.y) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, zapCount())
      .map((n) => n.m)
    setTimeout(() => {
      if (!near.length) return
      if (this.soundOn) this.sounds.zap()
      const until = performance.now() + 520
      for (const m of near) {
        this.bolts.push({ from: p, to: m, until })
        m.zapped = true
      }
      setTimeout(() => {
        if (this.soundOn) this.sounds.grow()
        for (const m of near) m.grow = { from: m.r, to: RADIUS.power, t: 0 }
      }, 420)
    }, 250)
  }

  /** Marbles poured in from above the mouth, one after another. */
  pour(kinds: MarbleKind[]) {
    this.pending.push(...kinds)
    this.nextDrop = Math.min(this.nextDrop, performance.now())
  }

  /** Every marble pops away, quickly and in no order. */
  popAll() {
    const order = [...this.marbles].sort(() => Math.random() - 0.5)
    const now = performance.now()
    order.forEach((m, i) => {
      m.pop = now + i * POP_GAP_MS
    })
  }

  get count() {
    return this.marbles.length
  }

  /** Moves the world on to this moment. True while anything still moves. */
  update(now: number, dt: number): boolean {
    if (this.pending.length && now >= this.nextDrop) {
      const kind = this.pending.shift()!
      const r = RADIUS[kind]
      const m = this.add(kind, JAR.CX + (Math.random() - 0.5) * 2.4, JAR.MOUTH - 3.2 - r, kind === 'plain' ? this.nextColour++ : 0)
      m.body.setAngularVelocity((Math.random() - 0.5) * 6)
      this.nextDrop = now + 260 + Math.random() * 120
    }
    this.acc += Math.min(0.05, dt)
    while (this.acc >= STEP) {
      this.growStep()
      this.world.step(STEP, 8, 3)
      this.acc -= STEP
    }
    // Popped marbles go from the world as they finish, and the rest settle into the gaps.
    for (let i = this.marbles.length - 1; i >= 0; i--) {
      const m = this.marbles[i]
      if (m.pop !== undefined && now - m.pop > POP_MS) {
        this.world.destroyBody(m.body)
        this.marbles.splice(i, 1)
      } else if (m.pop !== undefined && now >= m.pop && !m.popped) {
        m.popped = true
        if (this.soundOn && i % 2) this.sounds.pop()
      }
    }
    this.bolts = this.bolts.filter((b) => b.until > now)
    let moving = this.pending.length > 0 || this.bolts.length > 0 || this.marbles.some((m) => m.grow || m.pop !== undefined)
    if (!moving)
      for (const m of this.marbles) {
        const v = m.body.getLinearVelocity()
        if (m.body.isAwake() && v.x * v.x + v.y * v.y > 0.02) {
          moving = true
          break
        }
      }
    this.quiet = moving ? 0 : this.quiet + 1
    if (this.quiet > 40) {
      for (const m of this.marbles) m.body.setAwake(false)
      return false
    }
    return true
  }

  private growStep() {
    for (const m of this.marbles) {
      if (!m.grow) continue
      m.grow.t = Math.min(1, m.grow.t + 1 / 36)
      const e = 1 - Math.pow(1 - m.grow.t, 3)
      m.r = m.grow.from + (m.grow.to - m.grow.from) * e
      const shape = m.body.getFixtureList()?.getShape() as unknown as { m_radius: number } | undefined
      if (shape) shape.m_radius = m.r
      m.body.resetMassData()
      m.body.setAwake(true)
      if (m.grow.t >= 1) m.grow = undefined
    }
  }

  /** The jar as it now stands, to keep with the class. */
  saved(): SavedMarble[] {
    const r2 = (n: number) => Math.round(n * 100) / 100
    return this.marbles
      .filter((m) => m.pop === undefined && m.body.getPosition().y < JAR.H)
      .map((m) => {
        const p = m.body.getPosition()
        return [kindCode(m.kind), m.colourIndex, r2(p.x), r2(p.y), r2(m.body.getAngle() % (Math.PI * 2)), r2(m.r)] as SavedMarble
      })
  }

  /**
   * The marbles as they now stand, for MarbleLayer to show (and the Power Marble's lightning).
   * The world only moves them; the pictures are the board's own, moved by the graphics chip.
   */
  snapshot(): { marbles: Live[]; bolts: { from: Live; to: Live }[] } {
    for (const m of this.marbles) {
      const p = m.body.getPosition()
      m.x = p.x
      m.y = p.y
      m.angle = m.body.getAngle()
    }
    return { marbles: this.marbles, bolts: this.bolts }
  }
}
