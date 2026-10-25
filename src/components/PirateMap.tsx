import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { keysNeeded, type QuestState } from '../lib/quest'
import { bez, camX, chart, chartHTML, chartWidth, ISLANDS, pirateArtUrl, route, xSpot, type ChartView, type Curve } from '../lib/pirateArt'
import { burst } from '../lib/burst'
import { playChestKnocks, playPickerTick } from '../lib/sound'

/**
 * Our Quest on the Pirate Quest (DECISIONS, "The Pirate Quest"): a sea chart much wider than the
 * board, seen two islands at a time. The ship sails with the stars, a share of the way for each
 * piece and for each star towards the next; the island ahead is under clouds, each piece found
 * clearing its own patch; when the puzzle is whole a small black X shows on the sand, and the
 * teacher's shovel digs there once the ship has arrived. After the prize the ship sails on and the
 * view glides to the next pair of islands; after the fifth, it pulls back to show the whole voyage.
 *
 * What this screen last showed is kept on it (`seating-chart-pirate-seen-v1`), so opening the map
 * plays whatever happened since: stars given with the map shut are sailed when it opens. The chart
 * is drawn as SVG text from lib/pirateArt and moved with element.animate, which the graphics chip
 * runs ("Smooth on the board"); nothing ends on a clock.
 */

interface Seen {
  quest: number
  island: number
  ship: number
  cleared: number
}
const SEEN_KEY = 'seating-chart-pirate-seen-v1'
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
    // Without storage the map just plays from where it opened.
  }
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const NS = 'http://www.w3.org/2000/svg'

export function PirateMap({
  classId,
  quest,
  share,
  dig,
  onDug,
  onClose,
}: {
  classId: string
  quest: QuestState
  /** How far the meter is towards the next piece, 0 to 1: the ship sails with the parrot. */
  share: number
  /** Dig for the treasure once the ship has arrived (Sail and dig!, or the floating window's Dig for treasure). */
  dig: boolean
  /** The chest is up out of the sand: the prize wheel rises out of it (ChestOpening), from where it is. */
  onDug: (from: DOMRect, picture: string) => void
  onClose: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  /** The quest whose whole voyage is showing, with Start Quest under it. */
  const [finished, setFinished] = useState<number | null>(null)
  const latest = useRef({ quest, share, dig, onDug })
  useEffect(() => {
    latest.current = { quest, share, dig, onDug }
  })
  const running = useRef(false)
  const again = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    boxRef.current?.parentElement?.animate([{ transform: 'translateX(104%)' }, { transform: 'none' }], {
      duration: 350,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
  }, [])

  const quick = reduceMotion()
  const view = () => {
    const el = boxRef.current
    return { el, w: el?.offsetWidth ?? 0, h: el?.offsetHeight ?? 0 }
  }
  const shipSize = useRef(60)
  function render(v: ChartView) {
    const { el, w, h } = view()
    if (!el || !w || !h) return
    const out = chartHTML(w, h, v)
    shipSize.current = out.shipSize
    el.innerHTML = out.html
  }
  const world = () => boxRef.current?.querySelector<HTMLElement>('[data-pirate-world]')
  const shipFrames = (curve: Curve, t0: number, t1: number) =>
    Array.from({ length: 25 }, (_, i) => {
      const [x, y] = bez(curve, t0 + ((t1 - t0) * i) / 24)
      return { transform: `translate(${x.toFixed(1)}px,${(y - shipSize.current * 0.22).toFixed(1)}px)` }
    })
  async function sail(curve: Curve, t0: number, t1: number) {
    const ship = boxRef.current?.querySelector('[data-pirate-ship]')
    if (!ship) return
    await ship.animate(shipFrames(curve, t0, t1), {
      duration: quick ? 300 : 900 + (t1 - t0) * 1800,
      easing: 'ease-in-out',
      fill: 'forwards',
    }).finished
  }
  async function glide(from: number, to: number) {
    const g = world()
    if (!g) return
    await g.animate([{ transform: `translate(${-from}px,0px)` }, { transform: `translate(${-to}px,0px)` }], {
      duration: quick ? 300 : 2000,
      easing: 'ease-in-out',
      fill: 'forwards',
    }).finished
  }
  async function clearClouds(island: number, from: number, to: number) {
    const els = [...(boxRef.current?.querySelectorAll<SVGSVGElement>(`[data-island="${island}"]`) ?? [])].filter(
      (e) => +e.dataset.piece! >= from && +e.dataset.piece! < to,
    )
    await Promise.all(
      els.map(
        (e, n) =>
          e.animate(
            [
              { opacity: 1, transform: 'none' },
              { opacity: 0, transform: `translate(${n % 2 ? 90 : -90}px, -40px) scale(1.25)` },
            ],
            { duration: quick ? 250 : 1400, delay: quick ? 0 : n * 250, easing: 'ease-in', fill: 'forwards' },
          ).finished,
      ),
    )
  }

  /** The shovel digs where the X is, three times, and the chest comes up out of the hole. */
  async function digUp(island: number) {
    const { el, w, h } = view()
    const fx = el?.querySelector('[data-pirate-fx]')
    if (!el || !fx) return
    const g = chart(w, h)[island + 1]
    // The dig is drawn in the island's own layer, in the chart's units.
    const [xx, xy] = xSpot(g.x, g.y, g.r)
    const S = g.r * 0.72
    const size = Math.max(60, g.r * 0.7)
    const make = (tag: string, attrs: Record<string, string | number>, parent: Element = fx) => {
      const e = document.createElementNS(NS, tag)
      for (const k in attrs) e.setAttribute(k, String(attrs[k]))
      parent.appendChild(e)
      return e as SVGElement
    }
    const hole = make('ellipse', { cx: xx, cy: xy, rx: 0, ry: 0, fill: '#b8873f' })
    const mound = make('ellipse', {
      cx: xx + S * 0.42,
      cy: xy + S * 0.04,
      rx: 0,
      ry: 0,
      fill: '#efc670',
      stroke: '#d9a94e',
      'stroke-width': 2,
    })
    // The teacher's shovel, the tip of its blade on the X: pushed in, levered back to scoop, lifted out.
    const shovel = make('g', {})
    make('image', { href: pirateArtUrl('shovel'), x: -0.06 * S, y: -0.94 * S, width: S, height: S }, shovel)
    shovel.style.transformBox = 'view-box'
    shovel.style.transformOrigin = '0 0'
    const T = (dy: number, a: number, offset?: number) => ({
      transform: `translate(${xx}px, ${xy + dy}px) rotate(${a}deg)`,
      ...(offset != null && { offset }),
    })
    const scoop = () => {
      el.querySelector('[data-pirate-world] .pirate-x')?.remove()
      playPickerTick()
      for (let q = 0; q < 7; q++) {
        const c = make('circle', { cx: xx, cy: xy, r: 2.5 + Math.random() * 3.5, fill: '#e9bf6a' })
        const dx = S * (0.2 + Math.random() * 0.35),
          dy = -S * (0.15 + Math.random() * 0.25)
        c.animate(
          [
            { transform: 'none', opacity: 1 },
            { transform: `translate(${dx * 0.5}px, ${dy}px)`, offset: 0.5 },
            { transform: `translate(${dx}px, ${S * 0.02}px)`, opacity: 0.2 },
          ],
          { duration: 650, easing: 'ease-out', fill: 'forwards' },
        ).onfinish = () => c.remove()
      }
    }
    for (let n = 0; n < 3; n++) {
      if (!quick) {
        const a = shovel.animate(
          [T(-S * 0.34, -36), T(S * 0.03, -36, 0.32), T(S * 0.03, -58, 0.52), T(-S * 0.4, -50, 0.78), T(-S * 0.34, -36)],
          {
            duration: 950,
            easing: 'ease-in-out',
          },
        )
        await new Promise((r) => setTimeout(r, 480))
        if (!alive.current) return
        scoop()
        await a.finished
      } else scoop()
      hole.setAttribute('rx', String(S * 0.13 * (n + 1)))
      hole.setAttribute('ry', String(S * 0.045 * (n + 1)))
      mound.setAttribute('rx', String(S * 0.07 * (n + 1)))
      mound.setAttribute('ry', String(S * 0.035 * (n + 1)))
    }
    shovel.remove()
    // The chest comes up out of the hole and knocks; then it flies to the middle and the wheel rises out of it.
    const isl = ISLANDS[island]
    const chest = make('image', { href: pirateArtUrl(isl.chest), x: xx - size / 2, y: xy - size * 0.72, width: size, height: size })
    chest.style.transformBox = 'fill-box'
    chest.style.transformOrigin = '50% 100%'
    await chest.animate(
      [
        { transform: 'translateY(40%) scale(.3)', opacity: 0 },
        { transform: 'translateY(-8%) scale(1.1)', opacity: 1 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: quick ? 200 : 650, easing: 'ease-out' },
    ).finished
    if (!alive.current) return
    playChestKnocks()
    await chest.animate(
      [0, -7, 6, -5, 4, 0].map((d) => ({ transform: `rotate(${d}deg)` })),
      { duration: quick ? 150 : 600 },
    ).finished
    if (!alive.current) return
    const r = chest.getBoundingClientRect()
    if (!quick) burst(r.left + r.width / 2, r.top + r.height * 0.4, 40, isl.glow > 0)
    latest.current.onDug(r, pirateArtUrl(isl.chest))
  }

  /** Plays whatever happened since this screen last showed the map, then digs if asked. */
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
    const { quest: q, share: s, dig: wantDig } = latest.current
    const { w } = view()
    if (!w) return
    const need = keysNeeded(q)
    const found = Math.min(q.keys, need)
    const progress = found >= need ? 1 : Math.min(1, (found + s) / need)
    const prizes = q.opened.map((o) => o.prize.name)
    let seen = loadSeen(classId) ?? { quest: q.number, island: q.chest, ship: 0, cleared: 0 }
    // A quest started over, or a place this screen never saw: start from where the class is.
    if (
      seen.quest > q.number ||
      (seen.quest === q.number && (seen.island > q.chest || (seen.island === q.chest && seen.cleared > found)))
    ) {
      seen = { quest: q.number, island: q.chest, ship: 0, cleared: 0 }
    }
    const show = (extra: Partial<ChartView>) =>
      render({
        at: seen.island,
        pieces: found,
        ship: seen.ship,
        cleared: seen.cleared,
        prizes,
        quest: q.number,
        cam: camX(seen.island, w),
        ...extra,
      })

    // The last quest was finished: the whole voyage, then Start Quest.
    if (seen.quest < q.number) {
      render({
        at: 5,
        pieces: 0,
        ship: 1,
        cleared: 0,
        prizes: (q.previous ?? []).map((o) => o.prize.name),
        quest: seen.quest,
        cam: camX(4, w),
      })
      const { h } = view()
      const k = (w / chartWidth(w)) * 0.96
      const end = `translate(${((w - chartWidth(w) * k) / 2).toFixed(1)}px, ${((h - h * k) / 2 + 10).toFixed(1)}px) scale(${k.toFixed(3)})`
      await world()?.animate([{ transform: `translate(${-camX(4, w)}px,0px)` }, { transform: end }], {
        duration: quick ? 300 : 2600,
        easing: 'ease-in-out',
        fill: 'forwards',
      }).finished
      if (alive.current) setFinished(seen.quest)
      return
    }

    // An island opened since: round on to the next, the view gliding to the next pair of islands.
    while (seen.island < q.chest && alive.current) {
      const i = seen.island
      render({ at: i + 1, pieces: 0, ship: 0, cleared: 0, prizes, quest: q.number, cam: camX(i, w) })
      await glide(camX(i, w), camX(i + 1, w))
      seen = { ...seen, island: i + 1, ship: 0, cleared: 0 }
      saveSeen(classId, seen)
    }
    if (!alive.current) return
    show({})
    // The ship sails on with the stars given since.
    if (seen.ship < progress - 0.001) {
      const { h } = view()
      await sail(route(chart(w, h), seen.island), seen.ship, progress)
      seen = { ...seen, ship: progress }
      saveSeen(classId, seen)
      show({})
    } else if (seen.ship > progress) {
      seen = { ...seen, ship: progress }
      saveSeen(classId, seen)
      show({})
    }
    // The clouds over each piece found blow away; the puzzle whole, the X shows on the sand.
    if (seen.cleared < found && alive.current) {
      await clearClouds(seen.island, seen.cleared, found)
      seen = { ...seen, cleared: found }
      saveSeen(classId, seen)
      show({})
      if (found >= need) boxRef.current?.querySelector('[data-pirate-world] .pirate-x')?.classList.add('pirate-x-pop')
    }
    if (wantDig && found >= need && alive.current) await digUp(seen.island)
  }

  useEffect(() => {
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest.number, quest.chest, quest.keys, share, dig])

  // Drawn again for a new screen size, unless something is moving.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    let last = `${el.offsetWidth}x${el.offsetHeight}`
    const ro = new ResizeObserver(() => {
      const now = `${el.offsetWidth}x${el.offsetHeight}`
      if (now === last || running.current) return
      last = now
      void run()
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startNext() {
    saveSeen(classId, { quest: quest.number, island: 0, ship: 0, cleared: 0 })
    setFinished(null)
    void run()
  }

  return (
    <div data-pirate-map="" className="absolute inset-0 z-20 overflow-hidden rounded-2xl shadow-[-6px_0_24px_rgba(30,42,68,0.15)]">
      <div ref={boxRef} className="absolute inset-0" />
      <button
        type="button"
        aria-label="Close Our Quest"
        title="Close"
        onClick={() => !busy && onClose()}
        className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/85 text-[#3b3366] shadow active:scale-90"
      >
        <X className="h-6 w-6" />
      </button>
      {finished !== null && (
        <div className="pirate-finale absolute bottom-[7%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3.5">
          <b
            className="whitespace-nowrap text-white [text-shadow:0_3px_10px_rgba(0,0,0,.5)]"
            style={{ fontSize: 'clamp(1.4rem, 5vmin, 2.2rem)' }}
          >
            We sailed the whole sea!
          </b>
          <button type="button" className="quest-stage-btn quest-spin" onClick={startNext}>
            Start Quest {quest.number}
          </button>
        </div>
      )}
    </div>
  )
}
