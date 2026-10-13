import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { assetUrl } from '../../lib/assets'
import { chestNow, CHESTS } from '../../lib/quest'
import { playFootstep } from '../../lib/sound'
import type { QuestState } from '../../types'
import { ChestPicture, KeyPips, PrizeIcon } from './QuestPictures'

interface OurQuestProps {
  /** Whose quest: the board remembers where each class last saw its knight. */
  classId: string
  quest: QuestState
  /** The meter as it stands, for how far along the trail the knight is. */
  classPoints: number
  goal: number
  /** The chest is full: a tap on it opens it. */
  onOpenChest: () => void
  onClose: () => void
}

const art = (name: string) => assetUrl(`/quest/${name}`)

/**
 * Where each class last saw its knight on the map, on this board only (the replay is for the class
 * watching, so the teacher looking at it on a laptop doesn't use it up): the quest and how far along
 * the trail, in chests (1.5 is halfway from Wood to Bronze).
 */
const SEEN_KEY = 'seating-chart-quest-seen-v1'
type Seen = Record<string, { quest: number; at: number }>
function readSeen(): Seen {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Seen
  } catch {
    return {}
  }
}
function writeSeen(classId: string, quest: number, at: number) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [classId]: { quest, at } }))
  } catch {
    // A board that can't keep it replays from the start next time; nothing else depends on it.
  }
}
/** The knight's height, in chests: small beside the sleeping dragon (2026-10-13, the teacher: he was a tad too big). */
const KNIGHT = 0.9
/** The share of each chest's stretch, on the replay, that is the walk past the chest to the next stretch. */
const PAST = 0.15
/** Where the class is on the replay's route: the chest it is on and how far along that stretch. */
const routeAt = (chest: number, t: number) => chest + (chest < CHESTS.length - 1 ? t * (1 - PAST) : t)

/** The knight's walking pace on the replay, in the map's pixels a second. */
const PACE = 320

/** Low, high, low, high, and the Mega chest in the middle at the end. */
const ROW = ['low', 'high', 'low', 'high', 'mega'] as const

/** The map's ink: the doodles are drawn in it, faint, so the coloured things on the map are the chests, the knight and the dragon. */
const INK = '#8a5a2b'

/**
 * The map comes alive a little while it is open (2026-10-13, the teacher): the dragon breathes and
 * snores, a gust now and then sways the trees and the reeds, the cottage's chimney smokes and the
 * castle's flags wave. All CSS (index.css, the q- classes), gentle and slow, and only while the map
 * is open; nothing moves with reduced motion on. A gust comes every 14 seconds, the first a few
 * seconds after the map opens, once the knight has walked.
 */
const GUST_START = 4
const GUST_CROSS = 2.4
/** A castle flag, its pole's pennant, in the map's ink. */
const FLAG = `<svg viewBox="0 0 38 21" width="100%" height="100%"><path d="M2 3 C 12 1, 20 6, 35 9 C 22 11, 13 16, 2 18" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`

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
export function OurQuest({ classId, quest, classPoints, goal, onOpenChest, onClose }: OurQuestProps) {
  const now = chestNow(quest)
  const t = walked(now.have, now.need, now.ready, classPoints, goal)
  const trail = useRef<HTMLDivElement>(null)
  const path = useRef<SVGSVGElement>(null)
  const knight = useRef<HTMLImageElement>(null)
  const dragonRef = useRef<HTMLImageElement>(null)
  const doodles = useRef<HTMLDivElement>(null)
  /** Puts the knight on the trail at a place in chests, once the map is drawn (for the replay). */
  const placeKnight = useRef<{ distance: (at: number) => number; place: (d: number) => void } | null>(null)
  const replaying = useRef(false)

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
        const h = u * KNIGHT
        const w = h
        k.style.height = `${h}px`
        const len = seg.getTotalLength()
        const lo = Math.min(0.45, w / 2 / Math.max(1, len))
        const at = len * (lo + t * (1 - 2 * lo))
        const p = seg.getPointAtLength(at)
        // Mid-replay, a redraw (the map settling, the fonts arriving) leaves the walking knight be.
        if (!replaying.current) k.style.transform = `translate(${(p.x - w / 2).toFixed(1)}px, ${(p.y - h * 0.9).toFixed(1)}px)`
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
      // For the replay: the knight anywhere along the whole trail (`routeAt`). Each chest's
      // stretch ends with a short walk straight past the chest to the next stretch's start, so he
      // walks by a chest rather than jumping from one side of it to the other, at one pace all the
      // way (2026-10-13, the teacher).
      placeKnight.current = (() => {
        const paths = svg.querySelectorAll('path')
        const h = u * KNIGHT
        const on = (i: number, f: number) => {
          const sp = paths[i] as SVGPathElement | undefined
          if (!sp) return null
          const len = sp.getTotalLength()
          const lo = Math.min(0.45, h / 2 / Math.max(1, len))
          return sp.getPointAtLength(len * (lo + f * (1 - 2 * lo)))
        }
        // The route as distances, so he walks at one pace along the trail and past each chest.
        const parts: { len: number; at: (f: number) => { x: number; y: number } | null }[] = []
        for (let i = 0; i < CHESTS.length; i++) {
          const sp = paths[i] as SVGPathElement | undefined
          const len = sp ? sp.getTotalLength() : 0
          const lo = Math.min(0.45, h / 2 / Math.max(1, len))
          parts.push({ len: len * (1 - 2 * lo), at: (f) => on(i, f) })
          if (i < CHESTS.length - 1) {
            const a = on(i, 1)
            const b = on(i + 1, 0)
            parts.push({
              len: a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0,
              at: (f) => (a && b ? { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f } : null),
            })
          }
        }
        /** How far along the route a place is: the chest's stretch, then the walk past it. */
        const distance = (v: number) => {
          const i = Math.max(0, Math.min(CHESTS.length - 1, Math.floor(v)))
          const x = Math.max(0, Math.min(1, v - i))
          let d = 0
          for (let j = 0; j < i * 2; j++) d += parts[j].len
          if (i === CHESTS.length - 1) return d + x * parts[i * 2].len
          if (x <= 1 - PAST) return d + (x / (1 - PAST)) * parts[i * 2].len
          return d + parts[i * 2].len + ((x - (1 - PAST)) / PAST) * parts[i * 2 + 1].len
        }
        const place = (d: number) => {
          for (const part of parts) {
            if (d <= part.len || part === parts[parts.length - 1]) {
              const q = part.at(part.len ? Math.min(1, d / part.len) : 1)
              if (k && q) k.style.transform = `translate(${(q.x - h / 2).toFixed(1)}px, ${(q.y - h * 0.9).toFixed(1)}px)`
              return
            }
            d -= part.len
          }
        }
        return { distance, place }
      })()

      // The doodles, placed like a map and in the goal bar's order: the castle and its wall where
      // the quest starts, a dense forest between Wood and Bronze, a pond at its edge, a cottage over
      // Silver and the crossroads on the way to it, a bridge and an orchard on the way to Gold, and
      // the mountains rising to the dragon's own above the Mega chest. Each landmark once (2026-10-13,
      // the teacher: don't overuse any one doodle). Each
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
      const bronzeSilver = point(2, 0.5)
      const silverGold = point(3, 0.5)
      const goldMega = point(4, 0.5)
      const cx = (b: Box) => (b.l + b.r) / 2
      type D = { name: string; x: number; y: number; w: number; h: number; ink?: boolean; life?: 'sway' | 'reeds' }
      const mountainW = u * 1.75
      const mountain = {
        name: 'landmark-mountain-cave.png',
        // To the chest's left, so the dragon has room at its back foot, on the right.
        x: megaCx - mountainW * 0.3,
        // Raised a little, so the dragon can lie low at its foot and still clear the chest below.
        y: stations[4].t - mountainW * 0.55,
        w: mountainW,
        h: mountainW * 0.75,
      }
      // One tree, one size, everywhere (2026-10-13, the teacher: mixed trees looked cluttered).
      const pine = (x: number, y: number): D => ({ name: 'doodle-pine.svg', x, y, w: u * 0.56, h: u * 0.76, life: 'sway' })
      // A dense forest is the same tree, three or four together, in one or two places.
      const clump = (x: number, y: number): D[] => [
        pine(x - u * 0.42, y),
        pine(x + u * 0.07, y - u * 0.25),
        pine(x + u * 0.53, y + u * 0.03),
        pine(x + u * 0.07, y + u * 0.42),
      ]
      const want: D[] = [
        { name: 'landmark-castle-still.png', x: cx(start), y: yOf(start) - u * 0.15, w: u * 1.15, h: u * 1.1 },
        { name: 'doodle-grass.svg', x: cx(start) - u * 0.35, y: start.b + u * 0.45, w: u * 0.5, h: u * 0.36 },
        { name: 'doodle-grass.svg', x: cx(start) + u * 0.35, y: start.b + u * 0.55, w: u * 0.4, h: u * 0.3 },
        { name: 'doodle-pond.svg', x: cx(stations[1]), y: stations[1].b + u * 0.75, w: u * 1.15, h: u * 0.78, life: 'reeds' },
        { name: 'doodle-house-plain.svg', x: cx(stations[2]) + u * 0.1, y: stations[2].t - u * 0.5, w: u * 0.85, h: u * 0.85 },
        { name: 'doodle-crossroads.svg', x: bronzeSilver.x, y: bronzeSilver.y - u * 0.55, w: u * 0.8, h: u * 0.85 },
        { name: 'landmark-bridge.png', x: silverGold.x, y: silverGold.y + u * 0.1, w: u * 1.05, h: u * 0.62 },
        { name: 'doodle-apple.svg', x: cx(stations[3]) - u * 1.1, y: stations[3].t - u * 0.35, w: u * 0.62, h: u * 0.66, life: 'sway' },
        { name: 'doodle-apple.svg', x: cx(stations[3]) - u * 0.5, y: stations[3].t - u * 0.55, w: u * 0.62, h: u * 0.66, life: 'sway' },
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
        // A tree or the reeds sway as a gust passes, the right of the map first, as the wind blows
        // from the right (the gust's wisps cross the map in GUST_CROSS seconds).
        const life = d.life
          ? ` class="q-${d.life}" style="animation-delay:${(GUST_START + (1 - (b.l + d.w / 2) / tb.width) * GUST_CROSS).toFixed(2)}s;`
          : ' style="'
        placed.push(
          `<span${life}position:absolute;left:${b.l.toFixed(1)}px;top:${b.t.toFixed(1)}px;width:${d.w.toFixed(1)}px;height:${d.h.toFixed(1)}px;background:${INK};-webkit-mask:url('${art(d.name)}') center/contain no-repeat;mask:url('${art(d.name)}') center/contain no-repeat"></span>`,
        )
        // The cottage's chimney smokes: three puffs rising and fading, one after another.
        if (d.name === 'doodle-house-plain.svg')
          for (let i = 0; i < 3; i++)
            placed.push(
              `<span class="q-smoke" style="left:${(b.l + d.w * 0.7).toFixed(1)}px;top:${(b.t + d.h * 0.2).toFixed(1)}px;width:${(u * 0.14).toFixed(1)}px;height:${(u * 0.14).toFixed(1)}px;animation-delay:${(i * 1.4).toFixed(1)}s"></span>`,
            )
        return true
      }

      // The dragon's mountain above the Mega chest, and the dragon asleep at its foot, a little in
      // front of it (2026-10-13, the teacher: off by the chest it felt far and removed).
      const mBox = at(mountain)
      place(mountain, true)
      const dragon = dragonRef.current
      if (dragon) {
        // Asleep at the mountain's back foot, curled against its far slope, clear of the cave
        // (the cave is the middle of its foot; 2026-10-13, the teacher).
        const dw = mountainW * 0.8
        const dh = dw * (566 / 1122)
        const l = Math.min(tb.width - dw, mBox.l + mountainW * 0.66)
        const t = mBox.b - dh * 0.6
        dragon.style.width = `${dw}px`
        dragon.style.transform = `translate(${l.toFixed(1)}px, ${t.toFixed(1)}px)`
        taken.push({ l, t, r: l + dw, b: t + dh })
        // Asleep: a zzz rising from its head now and then, and a puff of smoke from its nose once in
        // a while (it breathes in its own CSS, .our-quest-dragon). Its head is at the picture's left.
        for (let i = 0; i < 3; i++)
          placed.push(
            `<span class="q-zzz" style="left:${(l + dw * 0.14).toFixed(1)}px;top:${(t + dh * 0.12).toFixed(1)}px;font-size:${(dh * (0.26 + i * 0.07)).toFixed(1)}px;animation-delay:${(i * 0.9).toFixed(1)}s">z</span>`,
          )
        placed.push(
          `<span class="q-snort" style="left:${(l - dh * 0.12).toFixed(1)}px;top:${(t + dh * 0.5).toFixed(1)}px;width:${(dh * 0.22).toFixed(1)}px;height:${(dh * 0.22).toFixed(1)}px"></span>`,
        )
      }
      place(pine(mBox.l - u * 0.3, mBox.b - u * 0.4))

      // The castle is the start: it stands there whatever is near it. Its flags wave, drawn in code on
      // its towers' poles (the picture's own flags are taken out of landmark-castle-still.png).
      place(want[0], true)
      {
        const c = at(want[0])
        const s = Math.min(want[0].w / 276, want[0].h / 261)
        const ox = c.l + (want[0].w - 276 * s) / 2
        const oy = c.t + (want[0].h - 261 * s) / 2
        for (const fx of [39, 239])
          placed.push(
            `<span class="q-flag" style="left:${(ox + fx * s).toFixed(1)}px;top:${(oy + 1 * s).toFixed(1)}px;width:${(38 * s).toFixed(1)}px;height:${(21 * s).toFixed(1)}px;animation-delay:${fx === 39 ? 0 : -0.7}s">${FLAG}</span>`,
          )
      }
      // A landmark that has no room where it would go first tries the next place on its list.
      const placeOne = (name: string, w: number, h: number, spots: { x: number; y: number }[]) =>
        spots.some((p) => place({ name, x: p.x, y: p.y, w, h }))
      // A second, smaller fort out on its own, well away from the castle (2026-10-13, the teacher).
      placeOne('doodle-wall.svg', u * 0.95, u * 0.8, [
        { x: silverGold.x + u * 0.2, y: silverGold.y + u * 2.2 },
        { x: bronzeSilver.x + u * 0.3, y: bronzeSilver.y - u * 1.9 },
        { x: cx(stations[2]) + u * 1.2, y: stations[2].b + u * 1.4 },
      ])
      placeOne('doodle-mountains.svg', u * 1.5, u * 0.9, [
        { x: goldMega.x, y: goldMega.y + u * 1.0 },
        { x: goldMega.x - u * 0.3, y: goldMega.y + u * 1.6 },
        { x: goldMega.x - u * 0.6, y: goldMega.y - u * 1.1 },
      ])
      for (const d of want.slice(1)) place(d)

      // The two dense forests: four trees together or none, nudged to the nearest open spot.
      // One on the way from the castle to Bronze, one below Gold.
      const placeClump = (x: number, y: number) => {
        for (const [dx, dy] of [
          [0, 0],
          [0, -0.6],
          [0, 0.6],
          [-0.6, 0],
          [0.6, 0],
          [-0.6, -0.6],
          [0.6, 0.6],
          [-0.6, 0.6],
          [0.6, -0.6],
          [0, -1.2],
          [0, 1.2],
        ]) {
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
      const cell = u * 1.45
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
      // Now and then a gust: wisps of wind blowing across the map from the right, as the trees sway.
      for (const [y, d] of [
        [0.3, 0],
        [0.62, 0.5],
      ])
        placed.push(
          `<svg class="q-wisp" viewBox="0 0 120 24" style="top:${(tb.height * y).toFixed(1)}px;width:${(u * 1.6).toFixed(1)}px;--from:${(tb.width + 10).toFixed(0)}px;--to:${(-u * 1.8).toFixed(0)}px;animation-delay:${(GUST_START + d).toFixed(1)}s"><path d="M4 12 C 30 4, 58 20, 88 10 C 102 5, 112 12, 105 17 C 99 21, 92 15, 97 11 M24 19 C 38 15, 50 21, 64 18" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/></svg>`,
        )
      if (doodles.current) doodles.current.innerHTML = placed.join('')
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(box)
    void document.fonts?.ready.then(draw)
    return () => ro.disconnect()
  }, [now.chest, t, quest])

  // The knight walks the trail from where the class last saw him on this board to where they are
  // now (2026-10-13, the teacher), with soft footsteps: a short walk, never more than a few seconds.
  // Read once, as the map opens, before this opening is written down as seen.
  const [seenFrom] = useState(() => {
    const seen = readSeen()[classId]
    return seen && seen.quest === quest.number ? seen.at : 0
  })
  useEffect(() => {
    const to = routeAt(now.chest, t)
    const from = Math.min(seenFrom, to)
    writeSeen(classId, quest.number, to)
    if (to - from < 0.02 || !placeKnight.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const route = placeKnight.current
    const d0 = route.distance(from)
    const d1 = route.distance(to)
    // An even walking pace, as on the goal bar: a short walk takes a second or so, a long one a few.
    const ms = Math.min(4500, Math.max(1200, ((d1 - d0) / PACE) * 1000))
    const start = performance.now() + 450 // once the map has slid in
    let raf = 0
    let steps: ReturnType<typeof setInterval> | undefined
    replaying.current = true
    route.place(d0)
    const frame = (now: number) => {
      const x = Math.min(1, Math.max(0, (now - start) / ms))
      if (x > 0 && !steps) {
        playFootstep()
        steps = setInterval(playFootstep, 420)
      }
      const e = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
      route.place(d0 + (d1 - d0) * e)
      if (x < 1) raf = requestAnimationFrame(frame)
      else {
        clearInterval(steps)
        replaying.current = false
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(steps)
      replaying.current = false
    }
    // Once, as the map opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
