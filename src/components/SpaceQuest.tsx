import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { keysNeeded, BARS_PER_CELL, type QuestState } from '../lib/quest'
import {
  bez,
  caseOn,
  casePicture,
  caseSVG,
  faceSVG,
  flagSVG,
  ground,
  imB,
  imC,
  mapCam,
  mapLayout,
  mapSVG,
  PLACES,
  rocketH,
  rocketSVG,
  routeOf,
  setSpaceSize,
  skyHTML,
  SPACE_BG,
  SPOT,
  surfaceSVG,
  tangent,
  zoomedOn,
  zoomFrames,
  type Ground,
} from '../lib/spaceArt'
import { spaceSound as S } from '../lib/spaceSound'

/**
 * Our Quest on the Space Quest (DECISIONS, "The Space Quest"). Most of the time the class is standing
 * on a planet: zoomed in, its curve along the bottom and space above, the rocket waiting with the
 * astronaut's helmet in its window, the flag with the class's mouse on it, and the fuel panel in the
 * sky's corner, its bars lighting as goals pour fuel in. The rocket can't take off until its cells are
 * full; then Blast off! counts down 3, 2, 1, the rocket lifts off, the view zooms out to the map and
 * follows it on the longer trip to the next planet, zooms in, and it lands. The astronaut climbs out,
 * plants the flag, and the friendly alien's UFO beams down a case, out of which the prize wheel rises
 * (ChestOpening). After the prize the astronaut carries the case back into the rocket, and the class
 * stays on that planet until the next fuel is in. After the fifth planet the view pulls back to show
 * the whole trip.
 *
 * What this screen last showed is kept on it (`seating-chart-space-seen-v1`), so opening Our Quest
 * plays what happened since: the bars poured in with it shut light up when it opens. Drawn as SVG text
 * from lib/spaceArt and moved with element.animate, which the graphics chip runs ("Smooth on the
 * board"). Nothing ends on a clock.
 */

interface Seen {
  quest: number
  place: number
  bars: number
}
const SEEN_KEY = 'seating-chart-space-seen-v1'
function loadSeen(classId: string): Seen | null {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as Record<string, Seen>)[classId] ?? null
  } catch {
    return null
  }
}
function saveSeen(classId: string, seen: Seen) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as Record<string, Seen>
    all[classId] = seen
    localStorage.setItem(SEEN_KEY, JSON.stringify(all))
  } catch {
    // Without storage the screen just plays from where it opened.
  }
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const NS = 'http://www.w3.org/2000/svg'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** What the landing left on the ground, for the astronaut to carry back in after the prize. */
interface Scene {
  quest: number
  place: number
  astro: SVGGElement
  kase: SVGGElement
  rocket: SVGGElement
  kx: number
  ky: number
  cs: number
  ah: number
  g: Ground
}

export function SpaceQuest({
  classId,
  quest,
  blast,
  onCaseDown,
  onClose,
}: {
  classId: string
  quest: QuestState
  /** Blast off once the cells are full (the fuel moment's Blast off!, or the floating window's). */
  blast: boolean
  /** The case is on the ground: the prize wheel rises out of it (ChestOpening), from where it is. */
  onCaseDown: (from: DOMRect, picture: string) => void
  onClose: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'planet' | 'map'>('planet')
  const [count, setCount] = useState<string | null>(null)
  /** The quest whose whole trip is showing, with Start Quest under it. */
  const [finished, setFinished] = useState<number | null>(null)
  const [canBlast, setCanBlast] = useState(false)
  const latest = useRef({ quest, blast, onCaseDown })
  useEffect(() => {
    latest.current = { quest, blast, onCaseDown }
  })
  const running = useRef(false)
  const again = useRef(false)
  const alive = useRef(true)
  const scene = useRef<Scene | null>(null)
  const blasted = useRef(false)
  const shown = useRef<{ place: number; view: 'planet' | 'map' } | null>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const quick = reduceMotion()
  const ms = (n: number) => (quick ? Math.min(n, 200) : n)

  useEffect(() => {
    boxRef.current?.parentElement?.animate([{ transform: 'translateX(104%)' }, { transform: 'none' }], {
      duration: 350,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
  }, [])

  const $ = <T extends Element = SVGElement>(sel: string) => boxRef.current?.querySelector<T>(sel) ?? null
  const size = () => {
    const el = boxRef.current
    const w = el?.offsetWidth ?? 0
    const h = el?.offsetHeight ?? 0
    setSpaceSize(w, h)
    return { w, h }
  }
  const make = (tag: string, attrs: Record<string, string | number>, parent: Element) => {
    const e = document.createElementNS(NS, tag) as SVGElement
    for (const k in attrs) e.setAttribute(k, String(attrs[k]))
    parent.appendChild(e)
    return e as SVGGElement
  }
  const anim = (el: Element, frames: Keyframe[], o: KeyframeAnimationOptions) =>
    el
      .animate(frames, { fill: 'forwards', ...o, duration: ms(Number(o.duration ?? 300)), delay: quick ? 0 : o.delay })
      .finished.catch(() => {})

  const prizesOf = (q: QuestState) => q.opened.map((o) => o.prize.name)

  /** Draws the planet the class is on, at rest, with `bars` lit. */
  function drawPlanet(place: number, bars: number, opts: { arriving?: boolean } = {}) {
    const { w, h } = size()
    const el = boxRef.current
    if (!el || !w || !h) return
    const q = latest.current.quest
    const need = place < 5 ? keysNeeded({ ...q, chest: place }) : 0
    el.innerHTML = `${skyHTML(place)}
      <svg data-space-map="" viewBox="0 0 ${w} ${h}" xmlns="${NS}" style="opacity:0"></svg>
      <svg data-space-surf="" viewBox="0 0 ${w} ${h}" xmlns="${NS}">${surfaceSVG(place, { ...opts, bars, full: place < 5 && bars >= need })}</svg>`
    shown.current = { place, view: 'planet' }
    setView('planet')
  }
  function drawMap(opts: { at: number; done?: boolean; rocket?: boolean; prizes: string[]; number: number }) {
    const { w, h } = size()
    const el = boxRef.current
    if (!el || !w || !h) return
    el.innerHTML = `${skyHTML('map')}
      <svg data-space-map="" viewBox="0 0 ${w} ${h}" xmlns="${NS}">${mapSVG({ at: opts.at, done: opts.done, rocket: opts.rocket, prizes: opts.prizes, quest: opts.number })}</svg>
      <svg data-space-surf="" viewBox="0 0 ${w} ${h}" xmlns="${NS}" style="opacity:0"></svg>`
    shown.current = { place: opts.at, view: 'map' }
    setView('map')
  }
  /** The sky for another place, fading in over the old. */
  function setSky(place: number | 'map') {
    const old = $<HTMLDivElement>('[data-space-sky]')
    if (!old) return
    const t = document.createElement('div')
    t.innerHTML = skyHTML(place)
    const nu = t.firstElementChild as HTMLDivElement
    old.after(nu)
    nu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(700) }).onfinish = () => old.remove()
  }

  /** From the planet out to the map, the planet shrinking back into place among the others. */
  async function zoomOut(place: number, mapOpts: { rocket?: boolean } = {}) {
    size()
    const q = latest.current.quest
    const P = mapLayout()
    const mapEl = $('[data-space-map]')
    const surf = $('[data-space-surf]')
    if (!mapEl || !surf) return
    mapEl.innerHTML = mapSVG({ at: place, rocket: mapOpts.rocket ?? true, prizes: prizesOf(q), quest: q.number })
    const world = mapEl.querySelector('[data-space-world]')!
    S.zoom(false)
    surf.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(300), fill: 'forwards' })
    mapEl.style.opacity = '1'
    setTimeout(() => setSky('map'), ms(500))
    const z = zoomedOn(P, place)
    await anim(world, zoomFrames(z, { k: 1, tx: -mapCam(P, place), ty: 0, cx: z.cx, cy: z.cy }), { duration: 1500, easing: 'linear' })
    shown.current = { place, view: 'map' }
    setView('map')
  }
  /** From the map down to a planet, its curve growing until it fills the bottom of the screen. */
  async function zoomIn(place: number, surfOpts: { arriving?: boolean; bars?: number; full?: boolean } = {}) {
    size()
    const P = mapLayout()
    const mapEl = $('[data-space-map]')
    const surf = $('[data-space-surf]')
    const world = mapEl?.querySelector('[data-space-world]')
    if (!mapEl || !surf || !world) return
    const cur = new DOMMatrix(getComputedStyle(world).transform)
    surf.innerHTML = surfaceSVG(place, surfOpts)
    S.zoom(true)
    const z = zoomedOn(P, place)
    const a = anim(world, zoomFrames({ k: cur.a, tx: cur.e, ty: cur.f, cx: z.cx, cy: z.cy }, z), { duration: 1500, easing: 'linear' })
    setTimeout(() => {
      setSky(place)
      surf.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(350), fill: 'forwards' })
    }, ms(1000))
    await a
    await wait(ms(250))
    mapEl.style.opacity = '0'
    shown.current = { place, view: 'planet' }
    setView('planet')
  }

  /** The bars poured in since this screen last showed them light up in the fuel panel, one by one. */
  async function lightBars(from: number, to: number) {
    const panel = $('[data-space-fuel]')
    if (!panel) return
    const bars = [...panel.querySelectorAll<SVGRectElement>('.space-bar')]
    panel.querySelectorAll('.space-cell').forEach((cell, ci) => ci * BARS_PER_CELL < to && cell.querySelector('.space-low')?.remove())
    for (let b = from; b < to && alive.current; b++) {
      const bar = bars[b]
      if (!bar) break
      bar.style.transformBox = 'fill-box'
      bar.style.transformOrigin = '50% 100%'
      bar.animate(
        [
          { opacity: 0, transform: 'scaleY(.2)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: ms(300), fill: 'forwards' },
      )
      S.bar(b)
      const words = panel.querySelector('[data-space-fuel-words]')
      if (words) words.textContent = words.textContent!.replace(/^\d+/, String(b + 1))
      await wait(ms(380))
    }
  }

  /** 3, 2, 1, blast off: the flame lights, smoke billows, the rocket shakes and lifts off up out of the sky. */
  async function blastOff(place: number) {
    setCanBlast(false)
    const { w, h } = size()
    if (shown.current?.view !== 'planet') drawPlanet(place, keysNeeded(latest.current.quest))
    for (const n of ['3', '2', '1']) {
      setCount(n)
      S.beep(false)
      await wait(ms(900))
      if (!alive.current) return
    }
    setCount('Blast off!')
    S.beep(true)
    const surf = $('[data-space-surf]')!
    const rocket = surf.querySelector('[data-space-rocket]')!
    const g = ground(place)
    const rx = w * SPOT.rocket
    const ry = g.y(rx)
    ;(rocket.querySelector('[data-space-flame]') as SVGElement).style.opacity = '1'
    S.blastoff(3.6)
    for (let i = 0; i < 14 && !quick; i++) {
      const c = make('circle', { cx: rx, cy: ry, r: 10 + Math.random() * 14, fill: '#e9e9f2', opacity: 0.9 }, surf)
      const dx = (i % 2 ? 1 : -1) * (40 + Math.random() * 140)
      c.animate(
        [
          { transform: 'none', opacity: 0.9 },
          { transform: `translate(${dx}px, ${-20 - Math.random() * 40}px) scale(2.2)`, opacity: 0 },
        ],
        { duration: 1600 + Math.random() * 800, delay: 200 + i * 60, easing: 'ease-out', fill: 'forwards' },
      )
    }
    rocket.animate(
      [0, 2, -2, 2, -2, 0].map((d) => ({ transform: `translateX(${d}px)` })),
      { duration: ms(500), iterations: 2 },
    )
    await wait(ms(800))
    await anim(rocket, [{ transform: 'translateY(0)' }, { transform: `translateY(${-h * 1.2}px)` }], {
      duration: 2000,
      easing: 'cubic-bezier(.5,0,.8,.6)',
    })
    setCount(null)
    if (!alive.current) return
    // Out to the map; the rocket leaves the planet and flies the long way to the next one, the view following it.
    await zoomOut(place, { rocket: false })
    if (!alive.current) return
    const P = mapLayout()
    const c = routeOf(P, place)
    const mapEl = $('[data-space-map]')!
    const fx = mapEl.querySelector('[data-space-map-fx]')!
    const world = mapEl.querySelector('[data-space-world]')!
    const rh = Math.max(34, P[place].r * 0.7)
    const rg = make('g', {}, fx)
    rg.innerHTML = `<g class="space-flame"><path d="M${-rh * 0.08} ${rh * 0.45} Q0 ${rh * 0.95} ${rh * 0.08} ${rh * 0.45} Z" fill="#ff9a2e"/></g>${imC('rocket-ship', 0, 0, rh)}`
    const dur = 2600 + place * 700
    const frames: Keyframe[] = []
    for (let i = 0; i <= 30; i++) {
      const t = i / 30
      const [x, y] = bez(c, t)
      frames.push({
        transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(tangent(c, Math.min(t, 0.999)) + 90).toFixed(1)}deg)`,
      })
    }
    S.fly(ms(dur) / 1000)
    world.animate([{ transform: `translate(${-mapCam(P, place)}px,0px)` }, { transform: `translate(${-mapCam(P, place + 1)}px,0px)` }], {
      duration: ms(dur),
      easing: 'ease-in-out',
      fill: 'forwards',
    })
    await anim(rg, frames, { duration: dur, easing: 'ease-in-out' })
    rg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(400), fill: 'forwards' })
    if (!alive.current) return
    await zoomIn(place + 1, { arriving: true })
    if (!alive.current) return
    await land(place + 1)
  }

  /** The landing, the astronaut and the flag, and the alien beaming the case down. */
  async function land(p: number) {
    const { w, h } = size()
    const surf = $('[data-space-surf]')!
    const g = ground(p)
    const rx = w * SPOT.rocket
    const ry = g.y(rx)
    const pos = (x: number): [number, number] => [x, g.y(x) + 4]
    // Down it comes from the top, flame on, slowing as the ground comes up.
    const tmp = make('g', {}, surf)
    tmp.innerHTML = rocketSVG(rx, ry, { flame: true, face: true, id: 'space-landing' })
    const r = tmp.querySelector<SVGGElement>('[data-space-landing]')!
    S.descend(ms(2600) / 1000)
    await anim(
      r,
      [
        { transform: `translateY(${-h * 1.1}px)` },
        { transform: `translateY(${-h * 0.12}px)`, offset: 0.7 },
        { transform: 'translateY(0)' },
      ],
      { duration: 2600, easing: 'cubic-bezier(.2,.7,.4,1)' },
    )
    if (!alive.current) return
    // Touchdown: the flame goes out, dust flies up.
    S.touchdown()
    r.querySelector('[data-space-flame]')!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(600), fill: 'forwards' })
    for (let i = 0; i < 16 && !quick; i++) {
      const c = make('circle', { cx: rx, cy: ry, r: 6 + Math.random() * 9, fill: PLACES[p].dust, opacity: 0.9 }, surf)
      const dx = (i % 2 ? 1 : -1) * (30 + Math.random() * 130)
      c.animate(
        [
          { transform: 'none', opacity: 0.9 },
          { transform: `translate(${dx}px, ${-10 - Math.random() * 30}px) scale(1.8)`, opacity: 0 },
        ],
        { duration: 1300 + Math.random() * 600, easing: 'ease-out', fill: 'forwards' },
      )
    }
    await wait(ms(1200))
    // The astronaut climbs out, bounds along the ground in low gravity, and plants the flag.
    S.hatch()
    r.querySelector('[data-space-face]')!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(300), fill: 'forwards' })
    await wait(ms(350))
    const ah = h * 0.17
    const ax0 = rx - w * 0.02
    const fx = w * SPOT.flag
    const axEnd = w * SPOT.astro
    const astro = make('g', {}, surf)
    astro.innerHTML = imB('astronaut', 0, 0, ah, ah)
    await anim(
      astro,
      [
        { transform: `translate(${ax0}px, ${ry - ah * 0.4}px) scale(.3)`, opacity: 0 },
        { transform: `translate(${ax0}px, ${pos(ax0)[1]}px) scale(1)`, opacity: 1 },
      ],
      { duration: 400 },
    )
    const hops = [ax0, (ax0 + axEnd) / 2 + w * 0.02, axEnd]
    for (let i = 1; i < hops.length && alive.current; i++) {
      const [x0, y0] = pos(hops[i - 1])
      const [x1, y1] = pos(hops[i])
      await anim(
        astro,
        [
          { transform: `translate(${x0}px, ${y0}px)` },
          { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - h * 0.1}px) rotate(-6deg)` },
          { transform: `translate(${x1}px, ${y1}px)` },
        ],
        { duration: 650, easing: 'ease-in-out' },
      )
      S.step()
    }
    await wait(ms(250))
    S.flag()
    const flag = make('g', {}, surf)
    flag.innerHTML = flagSVG(fx, g.y(fx) + 4, h * 0.28)
    await anim(
      flag,
      [
        { transform: `translateY(${-h * 0.12}px)`, opacity: 0 },
        { transform: 'translateY(4px)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 450, easing: 'ease-in' },
    )
    // The pole wobbles where it went in, and settles.
    const pole = flag.querySelector<SVGGElement>('[data-space-flag]')!
    pole.style.transformBox = 'fill-box'
    pole.style.transformOrigin = '0% 100%'
    pole.animate(
      [0, -9, 7, -4, 2, 0].map((d) => ({ transform: `rotate(${d}deg)` })),
      { duration: ms(900), easing: 'ease-out' },
    )
    await wait(ms(1100))
    if (!alive.current) return
    // The friendly alien's UFO swoops down, beams the case onto the ground, and zooms away.
    const kx = w * SPOT.kase
    const ky = g.y(kx) + h * 0.02
    const us = h * 0.2
    const uy = Math.max(us * 0.5, ky - h * 0.42)
    const cs = h * 0.2
    const rank = latest.current.quest.chest
    const ufo = make('g', {}, surf)
    ufo.innerHTML = imC('ufo-3', 0, 0, us)
    S.ufoIn(ms(1400) / 1000)
    await anim(ufo, [{ transform: `translate(${w + us}px, ${-us}px)` }, { transform: `translate(${kx}px, ${uy}px)` }], {
      duration: 1400,
      easing: 'cubic-bezier(.2,.8,.3,1)',
    })
    const hover = ufo.animate([{ transform: `translate(${kx}px, ${uy}px)` }, { transform: `translate(${kx}px, ${uy - 6}px)` }], {
      duration: 1000,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out',
    })
    S.ufoHover(ms(2600) / 1000)
    S.beam(ms(2200) / 1000)
    // The beam reaches right down to the ground, its foot following the planet's curve, with a glow where it touches.
    const bl = kx - cs * 0.75
    const br = kx + cs * 0.75
    const yl = g.y(bl) + 6
    const yr = g.y(br) + 6
    const ym = 2 * (g.y(kx) + 6) - (yl + yr) / 2
    const pool = make(
      'ellipse',
      {
        cx: kx,
        cy: g.y(kx) + 6,
        rx: cs * 0.8,
        ry: cs * 0.13,
        fill: '#e9ffc4',
        opacity: 0,
        transform: `rotate(${g.ang(kx).toFixed(1)} ${kx} ${g.y(kx) + 6})`,
      },
      surf,
    )
    surf.insertBefore(pool, ufo)
    pool.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: ms(500), delay: quick ? 0 : 300, fill: 'forwards' })
    const beam = make(
      'path',
      {
        d: `M${kx - us * 0.14} ${uy + us * 0.22} L${kx + us * 0.14} ${uy + us * 0.22} L${br} ${yr} Q${kx} ${ym} ${bl} ${yl} Z`,
        fill: 'url(#spaceBeam)',
      },
      surf,
    )
    surf.insertBefore(beam, ufo)
    beam.style.transformBox = 'fill-box'
    beam.style.transformOrigin = '50% 0'
    await anim(beam, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 400, easing: 'ease-out' })
    const kase = make('g', {}, surf)
    kase.innerHTML = caseOn(g, rank, kx, ky, cs)
    kase.style.transformBox = 'fill-box'
    kase.style.transformOrigin = '50% 100%'
    await anim(
      kase,
      [
        { transform: `translateY(${uy + us * 0.3 - ky + cs}px) scale(.3)`, opacity: 0.2 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 1600, easing: 'ease-in-out' },
    )
    S.caseDown()
    beam.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(400), fill: 'forwards' })
    pool.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: ms(400), fill: 'forwards' })
    await wait(ms(400))
    hover.cancel()
    S.ufoOut(ms(1000) / 1000)
    void anim(
      ufo,
      [
        { transform: `translate(${kx}px, ${uy}px)` },
        { transform: `translate(${kx}px, ${uy - 14}px)`, offset: 0.25 },
        { transform: `translate(${-us}px, ${-us * 1.5}px)` },
      ],
      { duration: 1000, easing: 'ease-in' },
    )
    await wait(ms(900))
    if (!alive.current) return
    // The case knocks on the ground, then flies up to the middle, where the prize wheel rises out of it.
    const q = latest.current.quest
    scene.current = { quest: q.number, place: p, astro, kase, rocket: r, kx, ky, cs, ah, g }
    const picture = await casePicture(rank)
    if (!alive.current) return
    kase.style.opacity = '0'
    latest.current.onCaseDown(kase.getBoundingClientRect(), picture)
  }

  /**
   * After the prize: the case, opened, back on the ground; the astronaut bounds over to it, it shrinks
   * to a size he can carry, he takes it back into the rocket, and his helmet shows in the window again.
   */
  async function carryBack(sc: Scene) {
    const { w } = size()
    const { astro, kase, kx, ky, cs, ah, g, rocket, place } = sc
    const rank = place - 1
    kase.getAnimations().forEach((a) => a.cancel())
    kase.style.opacity = '1'
    kase.innerHTML = caseOn(g, rank, kx, ky, cs, true)
    kase.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(400) })
    await wait(ms(900))
    const pos = (x: number): [number, number] => [x, g.y(x) + 4]
    const T = (x: number, f = 1) => `translate(${x}px, ${pos(x)[1]}px) scale(${f}, 1)`
    const hopTo = async (x0: number, x1: number, f: number, n: number) => {
      for (let i = 1; i <= n && alive.current; i++) {
        const a = x0 + ((x1 - x0) * (i - 1)) / n
        const b = x0 + ((x1 - x0) * i) / n
        await anim(
          astro,
          [
            { transform: T(a, f) },
            {
              transform: `translate(${(a + b) / 2}px, ${Math.min(pos(a)[1], pos(b)[1]) - sc.ah * 0.47}px) scale(${f}, 1) rotate(${-6 * f}deg)`,
            },
            { transform: T(b, f) },
          ],
          { duration: 600, easing: 'ease-in-out' },
        )
        S.step()
      }
    }
    const ax = w * SPOT.astro
    const standX = kx - cs * 0.55
    const small = 0.38
    await hopTo(ax, standX, 1, 2)
    // The case closes and shrinks to the astronaut's size.
    S.shrink()
    kase.innerHTML = caseOn(g, rank, kx, ky, cs)
    await anim(kase, [{ transform: 'none' }, { transform: `scale(${small})` }], { duration: 650, easing: 'ease-in-out' })
    // He picks it up: it goes into his hand, and comes with him.
    const handX = ah * 0.34
    const handY = -ah * 0.3
    const sz = cs * small
    kase.remove()
    const carried = make('g', {}, astro)
    carried.innerHTML = caseSVG(rank, handX, handY + sz * 0.82, sz)
    S.pickup()
    await anim(carried, [{ transform: `translate(${kx - standX - handX}px, ${-(handY + sz * 0.82)}px)` }, { transform: 'none' }], {
      duration: 400,
      easing: 'ease-out',
    })
    // Back to the rocket, facing the way he goes, and in through the hatch; his helmet appears in the window.
    const rx = w * SPOT.rocket
    const doorX = rx + rocketH() * 0.02
    await hopTo(standX, doorX, -1, 3)
    S.hatch()
    await anim(
      astro,
      [
        { transform: T(doorX, -1) },
        { transform: `translate(${doorX}px, ${pos(doorX)[1] - rocketH() * 0.12}px) scale(-.25, .25)`, opacity: 0 },
      ],
      { duration: 450, easing: 'ease-in' },
    )
    astro.remove()
    const face = make('g', {}, rocket)
    face.innerHTML = faceSVG(rx, pos(rx)[1] - 4)
    face.style.transformBox = 'fill-box'
    face.style.transformOrigin = 'center'
    S.hello()
    await anim(
      face,
      [
        { transform: 'scale(.2)', opacity: 0 },
        { transform: 'scale(1.15)', opacity: 1 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 500, easing: 'ease-out' },
    )
    await wait(ms(500))
  }

  /** The whole trip, the view pulling back to show every planet with its prize. */
  async function finale(number: number, prizes: string[]) {
    drawMap({ at: 5, done: true, prizes, number })
    const { w, h } = size()
    const P = mapLayout()
    const Ww = P[5].x + w * 0.2
    const k = (w / Ww) * 0.95
    const world = $('[data-space-world]')
    if (!world) return
    world.setAttribute('style', `transform-box:view-box;transform-origin:0 0;transform:translate(${-mapCam(P, 4)}px,0px)`)
    S.zoom(false)
    await anim(
      world,
      [
        { transform: `translate(${-mapCam(P, 4)}px,0px)` },
        { transform: `translate(${(w - Ww * k) / 2}px, ${(h * (1 - k)) / 2}px) scale(${k})` },
      ],
      { duration: 2600, easing: 'ease-in-out' },
    )
    if (alive.current) {
      S.full()
      setFinished(number)
    }
  }

  /** Plays whatever happened since this screen last showed the quest, then blasts off if asked. */
  async function run() {
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    setBusy(true)
    try {
      do {
        again.current = false
        await catchUp()
      } while (again.current && alive.current)
    } finally {
      running.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function catchUp() {
    const { quest: q, blast: wantBlast } = latest.current
    if (!size().w) return
    const need = keysNeeded(q)
    const found = Math.min(q.keys, need)
    let seen = loadSeen(classId) ?? { quest: q.number, place: q.chest, bars: 0 }
    if (seen.quest > q.number || (seen.quest === q.number && (seen.place > q.chest || (seen.place === q.chest && seen.bars > found)))) {
      seen = { quest: q.number, place: q.chest, bars: 0 }
    }
    // The prize was won on the planet just landed on: the astronaut carries the case back in first.
    const sc = scene.current
    if (sc && (sc.quest < q.number || sc.place <= q.chest)) {
      scene.current = null
      await carryBack(sc)
      if (!alive.current) return
      const from = seen.place
      seen = sc.quest < q.number ? seen : { quest: q.number, place: q.chest, bars: 0 }
      saveSeen(classId, seen)
      if (sc.quest === q.number && from !== q.chest) {
        // The next trip's empty cells appear, waiting for fuel.
        drawPlanet(q.chest, 0)
        const panel = $<SVGGElement>('[data-space-fuel]')
        if (panel) {
          panel.style.transformBox = 'fill-box'
          panel.style.transformOrigin = '100% 0'
          panel.animate(
            [
              { opacity: 0, scale: '0.3' },
              { opacity: 1, scale: '1.06' },
              { opacity: 1, scale: '1' },
            ],
            { duration: ms(550), easing: 'ease-out' },
          )
        }
        S.bar(0)
      }
    }
    // The case is waiting for its prize: the landing stays on the screen until it is won.
    if (scene.current) return
    // The last quest was finished: the whole trip, then Start Quest.
    if (seen.quest < q.number) {
      await finale(
        seen.quest,
        (q.previous ?? []).map((o) => o.prize.name),
      )
      return
    }
    // A planet reached since, elsewhere: the class is there now.
    if (seen.place < q.chest) {
      seen = { quest: q.number, place: q.chest, bars: 0 }
      saveSeen(classId, seen)
    }
    if (shown.current?.place !== seen.place || shown.current.view !== 'planet' || !$('[data-space-fuel]')) drawPlanet(seen.place, seen.bars)
    if (seen.bars < found && alive.current) {
      await lightBars(seen.bars, found)
      seen = { ...seen, bars: found }
      saveSeen(classId, seen)
      if (found >= need) {
        drawPlanet(seen.place, found)
        S.full()
      }
    }
    if (found >= need && alive.current) {
      if (wantBlast && !blasted.current) {
        blasted.current = true
        await blastOff(seen.place)
      } else setCanBlast(!scene.current)
    } else setCanBlast(false)
  }

  useEffect(() => {
    if (!blast) blasted.current = false
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest.number, quest.chest, quest.keys, blast])

  // Drawn again for a new screen size, unless something is moving.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    let last = `${el.offsetWidth}x${el.offsetHeight}`
    const ro = new ResizeObserver(() => {
      const now = `${el.offsetWidth}x${el.offsetHeight}`
      if (now === last || running.current || scene.current) return
      last = now
      shown.current = null
      void run()
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleMap() {
    if (busy || running.current) return
    running.current = true
    setBusy(true)
    const place = latest.current.quest.chest
    try {
      if (view === 'planet') await zoomOut(place)
      else {
        const q = latest.current.quest
        await zoomIn(place, { bars: Math.min(q.keys, keysNeeded(q)), full: q.keys >= keysNeeded(q) })
      }
    } finally {
      running.current = false
      if (alive.current) setBusy(false)
    }
  }
  function blastNow() {
    if (busy || running.current) return
    blasted.current = true
    running.current = true
    setBusy(true)
    void blastOff(latest.current.quest.chest).finally(() => {
      running.current = false
      if (alive.current) setBusy(false)
    })
  }
  function startNext() {
    saveSeen(classId, { quest: quest.number, place: 0, bars: 0 })
    setFinished(null)
    shown.current = null
    void run()
  }

  const here = PLACES[Math.min(quest.chest, 5)].name
  return (
    <div data-space-quest="" className="absolute inset-0 z-20 overflow-hidden rounded-2xl" style={{ background: SPACE_BG }}>
      <div
        ref={boxRef}
        className="absolute inset-0 [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full [&>svg]:[will-change:transform]"
      />
      {finished === null && (
        <button
          type="button"
          data-space-map-button=""
          onClick={toggleMap}
          disabled={busy}
          className="absolute left-3 top-3 h-11 rounded-full bg-white/90 px-4 text-lg font-bold text-[#3b3366] shadow active:scale-95 disabled:opacity-60"
        >
          {view === 'planet' ? 'Map' : `Back to ${here}`}
        </button>
      )}
      <button
        type="button"
        aria-label="Close Our Quest"
        title="Close"
        onClick={() => !busy && !scene.current && onClose()}
        className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/85 text-[#3b3366] shadow active:scale-90"
      >
        <X className="h-6 w-6" />
      </button>
      {canBlast && !busy && view === 'planet' && finished === null && (
        <button type="button" className="quest-stage-btn quest-spin absolute bottom-[6%] left-1/2 -translate-x-1/2" onClick={blastNow}>
          Blast off!
        </button>
      )}
      {count && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span
            key={count}
            className="space-count font-bold text-white [text-shadow:0_6px_30px_rgba(0,0,0,.6)]"
            style={{ fontSize: count.length > 1 ? 'clamp(3rem, 14vmin, 6rem)' : 'clamp(5rem, 26vmin, 10rem)' }}
          >
            {count}
          </span>
        </div>
      )}
      {finished !== null && (
        <div className="pirate-finale absolute bottom-[7%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3.5">
          <b
            className="whitespace-nowrap text-white [text-shadow:0_3px_10px_rgba(0,0,0,.5)]"
            style={{ fontSize: 'clamp(1.4rem, 5vmin, 2.2rem)' }}
          >
            We explored the whole galaxy!
          </b>
          <button type="button" className="quest-stage-btn quest-spin" onClick={startNext}>
            Start Quest {quest.number}
          </button>
        </div>
      )}
    </div>
  )
}
