import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { assetUrl } from '../../lib/assets'
import { chestNow, CHESTS } from '../../lib/quest'
import type { QuestState } from '../../types'
import { ChestPicture, KeyPips, PrizeIcon } from './QuestPictures'

interface OurQuestProps {
  quest: QuestState
  /** The meter as it stands, for how far along the trail the knight is. */
  classPoints: number
  goal: number
  /** The chest is full: a tap on it opens it. */
  onOpenChest: () => void
  onClose: () => void
}

const art = (name: string) => assetUrl(`/quest/${name}`)

/** Low, high, low, high, and the Mega chest in the middle at the end. */
const ROW = ['low', 'high', 'low', 'high', 'mega'] as const

/** The map's ink: the doodles are drawn in it, faint, so the coloured things on the map are the chests, the knight and the dragon. */
const INK = '#8a5a2b'

type Box = { l: number; t: number; r: number; b: number }
const overlaps = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

/**
 * How far the knight has walked toward the chest the class is on: the keys already in its locks
 * and the meter on its way to the next one, as a share of the keys it needs (2026-10-13, the
 * teacher). With 1 of Silver's 3 keys in and the meter at 27 of 30, that is 1.9 of 3. It reaches
 * the chest only when every lock is gold.
 */
export function walked(have: number, need: number, ready: boolean, classPoints: number, goal: number): number {
  if (ready) return 1
  const meter = goal > 0 ? Math.min(1, Math.max(0, classPoints / goal)) : 0
  return Math.min(1, (have + meter) / need)
}

/**
 * Our Quest (DECISIONS, "Treasure Quest"): a tap on the meter's chest slides the quest over the
 * board, on an old treasure map - the castle where every quest starts, the chests opened so far
 * with what was inside, the one now with its keys, and the Mega chest at the end, with the dragon
 * asleep by its mountain. The chests zigzag and a dotted trail winds between them, dark ink for
 * the way walked and faint ahead, and the knight stands on the trail as far along as the class
 * has got. It never scrolls: everything is placed from where the chests really are, and a doodle
 * that would touch a chest, a label or the knight is left out. It stays until it is tapped closed.
 */
export function OurQuest({ quest, classPoints, goal, onOpenChest, onClose }: OurQuestProps) {
  const now = chestNow(quest)
  const t = walked(now.have, now.need, now.ready, classPoints, goal)
  const trail = useRef<HTMLDivElement>(null)
  const path = useRef<SVGSVGElement>(null)
  const knight = useRef<HTMLImageElement>(null)
  const dragonRef = useRef<HTMLImageElement>(null)
  const doodles = useRef<HTMLDivElement>(null)

  // Drawn from where the chests really are, so again whenever the map changes size.
  useLayoutEffect(() => {
    const box = trail.current
    const svg = path.current
    if (!box || !svg) return
    const draw = () => {
      const tb = box.getBoundingClientRect()
      if (!tb.width) return
      const rel = (r: DOMRect): Box => ({ l: r.left - tb.left, t: r.top - tb.top, r: r.right - tb.left, b: r.bottom - tb.top })
      const start = rel(box.querySelector('[data-quest-start]')!.getBoundingClientRect())
      const chests = [...box.querySelectorAll('[data-quest-station] .quest-sc')].map((e) => rel(e.getBoundingClientRect()))
      const stations = [...box.querySelectorAll('[data-quest-station]')].map((e) => rel(e.getBoundingClientRect()))
      const u = chests[0].r - chests[0].l
      const gap = Math.max(8, tb.width * 0.012)
      const ends = [start, ...chests]
      const yOf = (b: Box) => b.t + (b.b - b.t) * 0.55

      // One segment from each place to the next: the castle to Wood, Wood to Bronze, and on.
      svg.setAttribute('viewBox', `0 0 ${tb.width} ${tb.height}`)
      const segs = ends.slice(1).map((b, i) => {
        const a = ends[i]
        const x1 = a.r + gap
        const x2 = b.l - gap
        const dx = Math.max(0, x2 - x1) * 0.5
        return `M${x1.toFixed(1)} ${yOf(a).toFixed(1)} C${(x1 + dx).toFixed(1)} ${yOf(a).toFixed(1)} ${(x2 - dx).toFixed(1)} ${yOf(b).toFixed(1)} ${x2.toFixed(1)} ${yOf(b).toFixed(1)}`
      })
      const dot = (d: string, ink: string) =>
        `<path d="${d}" fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round"/>`
      svg.innerHTML = segs.map((d, i) => dot(d, i < now.chest ? '#7a4a1f' : '#cfb07a')).join('')

      // The knight, on the segment toward the chest the class is on, its feet on the trail. It
      // walks between the two chests' edges, so it never stands on either.
      const k = knight.current
      let knightBox: Box | null = null
      const seg = svg.querySelectorAll('path')[now.chest] as SVGPathElement | undefined
      if (k && seg) {
        const h = u * 1.25
        const w = h
        k.style.height = `${h}px`
        const len = seg.getTotalLength()
        const lo = Math.min(0.45, w / 2 / Math.max(1, len))
        const at = len * (lo + t * (1 - 2 * lo))
        const p = seg.getPointAtLength(at)
        k.style.transform = `translate(${(p.x - w / 2).toFixed(1)}px, ${(p.y - h * 0.9).toFixed(1)}px)`
        knightBox = { l: p.x - w / 2, t: p.y - h * 0.9, r: p.x + w / 2, b: p.y + h * 0.1 }
        // The way walked so far on this segment is dark too.
        if (at > 0) {
          const pts: string[] = []
          for (let s = 0; s <= 24; s++) {
            const q = seg.getPointAtLength((at * s) / 24)
            pts.push(`${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
          }
          svg.insertAdjacentHTML('beforeend', dot(`M${pts.join(' L')}`, '#7a4a1f'))
        }
      }

      // The doodles, placed like a map: grass where the quest starts, a dense forest the trail
      // runs through between Wood and Bronze, a pond at its edge, hills over Silver, a bridge on
      // the way to Gold, and the dragon's mountain above the Mega chest, pines on its slopes. Each
      // is a size in chests (u) and a centre; one that would touch a chest, a label, the knight,
      // the dragon or another doodle, or leave the map, is left out.
      const point = (i: number, f: number) => {
        const sp = svg.querySelectorAll('path')[i] as SVGPathElement | undefined
        if (!sp) return { x: 0, y: 0 }
        const q = sp.getPointAtLength(sp.getTotalLength() * f)
        return { x: q.x, y: q.y }
      }
      const mega = chests[4]
      const megaCx = (mega.l + mega.r) / 2
      const woodBronze = point(1, 0.5)
      const silverGold = point(3, 0.5)
      const cx = (b: Box) => (b.l + b.r) / 2
      type D = { name: string; x: number; y: number; w: number; h: number; ink?: boolean }
      const mountainW = u * 1.75
      const mountain = {
        name: 'landmark-mountain-cave.png',
        x: megaCx,
        y: stations[4].t - mountainW * 0.38,
        w: mountainW,
        h: mountainW * 0.75,
      }
      // One tree, one size, everywhere (2026-10-13, the teacher: mixed trees looked cluttered).
      const pine = (x: number, y: number): D => ({ name: 'doodle-pine.svg', x, y, w: u * 0.4, h: u * 0.55 })
      // A dense forest is the same tree, three or four together, in one or two places.
      const clump = (x: number, y: number): D[] => [pine(x - u * 0.3, y), pine(x + u * 0.05, y - u * 0.18), pine(x + u * 0.38, y + u * 0.02), pine(x + u * 0.05, y + u * 0.3)]
      const want: D[] = [
        { name: 'landmark-castle.png', x: cx(start), y: yOf(start) - u * 0.15, w: u * 1.15, h: u * 1.1 },
        { name: 'doodle-grass.svg', x: cx(start) - u * 0.35, y: start.b + u * 0.45, w: u * 0.5, h: u * 0.36 },
        { name: 'doodle-grass.svg', x: cx(start) + u * 0.35, y: start.b + u * 0.55, w: u * 0.4, h: u * 0.3 },
        { name: 'doodle-pond.svg', x: cx(stations[1]), y: stations[1].b + u * 0.75, w: u * 1.15, h: u * 0.78 },
        { name: 'landmark-hills.png', x: cx(stations[2]), y: stations[2].t - u * 0.45, w: u * 1.3, h: u * 0.6 },
        { name: 'landmark-bridge.png', x: silverGold.x, y: silverGold.y + u * 0.1, w: u * 1.05, h: u * 0.62 },
      ]
      const taken: Box[] = [...stations, ...(knightBox ? [knightBox] : [])]
      const head = box.parentElement?.querySelector('[data-quest-head]')?.getBoundingClientRect()
      const top = head ? head.bottom - tb.top : 0
      const placed: string[] = []
      /** Where a doodle lands: kept on the map, a landmark near an edge moving in rather than going. */
      const at = (d: D): Box => {
        const x = Math.min(tb.width - d.w / 2, Math.max(d.w / 2, d.x))
        const y = Math.min(tb.height - d.h / 2, Math.max(top + d.h / 2, d.y))
        return { l: x - d.w / 2, t: y - d.h / 2, r: x + d.w / 2, b: y + d.h / 2 }
      }
      const place = (d: D, force = false) => {
        const b = at(d)
        if (!force && taken.some((o) => overlaps(o, b))) return false
        taken.push(b)
        placed.push(
          `<span style="position:absolute;left:${b.l.toFixed(1)}px;top:${b.t.toFixed(1)}px;width:${d.w.toFixed(1)}px;height:${d.h.toFixed(1)}px;background:${INK};-webkit-mask:url('${art(d.name)}') center/contain no-repeat;mask:url('${art(d.name)}') center/contain no-repeat"></span>`,
        )
        return true
      }

      // The dragon's mountain above the Mega chest, and the dragon asleep at its foot, a little in
      // front of it (2026-10-13, the teacher: off by the chest it felt far and removed).
      const mBox = at(mountain)
      place(mountain, true)
      const dragon = dragonRef.current
      if (dragon) {
        const dw = mountainW * 0.95
        const dh = dw * (566 / 1122)
        const l = Math.max(0, mBox.l - dw * 0.35)
        const t = mBox.b - dh * 0.95
        dragon.style.width = `${dw}px`
        dragon.style.transform = `translate(${l.toFixed(1)}px, ${t.toFixed(1)}px)`
        taken.push({ l, t, r: l + dw, b: t + dh })
      }
      place(pine(mBox.r + u * 0.1, mBox.b - u * 0.35))

      // The castle is the start: it stands there whatever is near it.
      for (const d of want) place(d, d.name === 'landmark-castle.png')

      // The two dense forests: four trees together or none, nudged to the nearest open spot.
      // One on the way from the castle to Bronze, one below Gold.
      const placeClump = (x: number, y: number) => {
        for (const [dx, dy] of [[0, 0], [0, -0.6], [0, 0.6], [-0.6, 0], [0.6, 0], [-0.6, -0.6], [0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [0, -1.2], [0, 1.2]]) {
          const ds = clump(x + dx * u, y + dy * u)
          const boxes = ds.map(at)
          if (boxes.some((b) => taken.some((o) => overlaps(o, b)))) continue
          ds.forEach((d) => place(d, true))
          return
        }
      }
      placeClump(woodBronze.x - u * 0.6, woodBronze.y - u * 1.1)
      placeClump(cx(stations[3]), stations[3].b + u * 0.9)

      // Then single trees scattered evenly over the rest of the map, with a tuft of grass here and
      // there: a loose grid, every other cell, placed the same way every time (from the cell), so
      // the map doesn't change from one opening to the next.
      const cell = u * 1.2
      const cols = Math.ceil(tb.width / cell)
      const rows = Math.ceil((tb.height - top) / cell)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2) continue
          const seed = Math.abs(Math.sin((r + 1) * 12.9898 + (c + 1) * 78.233) * 43758.5453) % 1
          const x = (c + 0.5) * cell + (seed - 0.5) * cell * 0.5
          const y = top + (r + 0.5) * cell + (((seed * 7) % 1) - 0.5) * cell * 0.4
          place(seed < 0.7 ? pine(x, y) : { name: 'doodle-grass.svg', x, y, w: u * 0.42, h: u * 0.3 })
        }
      }
      if (doodles.current) doodles.current.innerHTML = placed.join('')
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(box)
    void document.fonts?.ready.then(draw)
    return () => ro.disconnect()
  }, [now.chest, t, quest])

  // Slides in from the side, as the flip cards do.
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    sheet.current?.animate([{ transform: 'translateX(104%)' }, { transform: 'none' }], {
      duration: 350,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
  }, [])

  return (
    <div
      ref={sheet}
      data-our-quest=""
      className="our-quest absolute inset-0 z-[20] flex flex-col overflow-hidden rounded-[22px] px-[18px] pb-[14px] pt-3 text-[#3b2410] shadow-[-6px_0_24px_rgba(30,42,68,0.15)]"
      onClick={onClose}
    >
      <div data-quest-head="" className="relative z-[1] flex items-center gap-3">
        <h2 className="m-0 font-bold" style={{ fontSize: 'clamp(1.1rem, 3vmin, 1.7rem)' }}>
          {quest.number > 1 ? `Our Quest ${quest.number}` : 'Our Quest'}
        </h2>
        <button
          type="button"
          aria-label="Close Our Quest"
          title="Close"
          className="ml-auto flex items-center gap-1 rounded-xl border border-[#c9a46a] bg-[#fff8e6] px-3 py-1.5 font-bold text-[#6b4a2b]"
          onClick={onClose}
        >
          <X className="size-5" /> Close
        </button>
      </div>
      <div ref={trail} className="our-quest-trail relative flex min-h-0 flex-1 items-center justify-between gap-[0.6vw] px-[0.6vw]">
        <div ref={doodles} className="pointer-events-none absolute inset-0 z-0 opacity-55" aria-hidden />
        <svg ref={path} className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden />
        {/* Where every quest starts: the castle (drawn with the doodles), an empty place here. */}
        <div data-quest-start="" className="our-quest-start relative shrink-0" aria-hidden />
        {CHESTS.map((tier, i) => {
          const done = i < now.chest
          const here = i === now.chest
          const opened = quest.opened[i]
          const ready = here && now.ready
          return (
            <div
              key={i}
              data-quest-station={i}
              className={clsx(
                'our-quest-station relative z-[1] flex min-w-0 flex-col items-center gap-[0.35em] text-center',
                ROW[i],
                done ? 'done' : here ? 'now' : 'future',
              )}
            >
              <div className="quest-sc relative">
                {ready ? (
                  <button
                    type="button"
                    title={`Open the ${tier.name} chest`}
                    className="meter-chest-rattle block w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenChest()
                    }}
                  >
                    <ChestPicture chest={i} keys={tier.keys} className="[&>svg]:h-auto [&>svg]:w-full" />
                  </button>
                ) : (
                  <ChestPicture
                    chest={i}
                    keys={done ? tier.keys : here ? now.have : 0}
                    open={done}
                    className="[&>svg]:h-auto [&>svg]:w-full"
                  />
                )}
              </div>
              <div className="font-bold" style={{ fontSize: 'clamp(0.85rem, 2vmin, 1.15rem)' }}>
                {tier.name}
              </div>
              {done && opened ? (
                <span className={clsx('our-quest-chip', `size-${opened.prize.size}`)}>
                  <PrizeIcon name={opened.prize.name} size={16} />
                  {opened.prize.name}
                </span>
              ) : here ? (
                <>
                  <KeyPips need={tier.keys} have={now.have} className="our-quest-pips" />
                  <span className="our-quest-note">{ready ? 'Tap to open!' : `${now.have} of ${tier.keys} keys`}</span>
                </>
              ) : (
                <span className="our-quest-note">{tier.keys} keys</span>
              )}
            </div>
          )
        })}
        {/* The dragon, asleep at the foot of its mountain (placed with the doodles). */}
        <img
          ref={dragonRef}
          src={art('dragon-asleep.svg')}
          alt=""
          draggable={false}
          className="our-quest-dragon pointer-events-none absolute left-0 top-0 z-[2] h-auto max-w-none select-none"
        />
        {/* The class, walking the trail. */}
        <img
          ref={knight}
          src={art('knight.svg')}
          alt=""
          draggable={false}
          data-quest-knight=""
          className="our-quest-knight pointer-events-none absolute left-0 top-0 z-[2] w-auto max-w-none select-none"
        />
      </div>
    </div>
  )
}
