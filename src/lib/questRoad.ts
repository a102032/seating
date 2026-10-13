/**
 * The goal bar as a strip of the quest's map (2026-10-13, the teacher's idea, from the shoebox
 * scrolls he and his brother made as children: a long drawn scene wound past a cut-out character).
 * The whole bar is parchment, and each key is one stretch of road across it. **The land and the
 * trail stay still while the knight walks** along the trail as stars come in; when he reaches the
 * key, the knight, the trail and the land all slide back to the start together, like the scroll's
 * rolls turning, revealing the next stretch (2026-10-13, the teacher: everything moving at once,
 * at three speeds, was too much; it was tried that way first).
 *
 * What the road passes is the map's, in the map's order, each landmark once (the teacher: don't
 * overuse any one doodle): the castle where the quest starts, a wood and the pond on the way to
 * Bronze, a cottage and the crossroads on the way to Silver, a small fort, the bridge, an orchard
 * and a second wood on the way to Gold, and mountains drawing nearer on the way to Mega, ending at
 * the dragon's own. Between them, single trees and grass, spaced out, and now and then an apple
 * tree. An adventure after Knight and Dragon is a new list here and new pictures, not new code.
 */

/**
 * How far the land and the trail slide back while the knight walks one stretch, as a share of his
 * walk: none, so the world stays still under him (the teacher's call). Kept as numbers so a slide
 * can be tried again by changing them.
 */
export const LAND_SPEED = 0
export const TRAIL_SPEED = 0

/** Where the trail runs, from the bar's top: low in the 56px bar, so the doodles stand above it. */
export function trailY(x: number) {
  return 41 + Math.sin(x / 95) * 3.2 + Math.sin(x / 37) * 1.1
}

export function trailPath(from: number, to: number) {
  let d = `M${from.toFixed(0)} ${trailY(from).toFixed(1)}`
  for (let x = from + 8; x <= to; x += 8) d += ` L${x.toFixed(0)} ${trailY(x).toFixed(1)}`
  return d
}

export interface RoadItem {
  /** A line drawing, drawn in the map's ink through a mask, or one of the Flow landmarks as it is. */
  kind: 'ink' | 'img'
  file: string
  /** Left edge, from the start of the knight's walk, in the land's own pixels. */
  x: number
  bottom: number
  w: number
  h: number
  opacity: number
}

type Sized = { file: string; kind: 'ink' | 'img'; w: number; h: number; bottom: number; opacity: number }
const D: Record<string, Sized> = {
  pine: { file: 'doodle-pine.svg', kind: 'ink', w: 26, h: 33, bottom: 17, opacity: 0.7 },
  apple: { file: 'doodle-apple.svg', kind: 'ink', w: 30, h: 32, bottom: 16, opacity: 0.7 },
  grass: { file: 'doodle-grass.svg', kind: 'ink', w: 26, h: 16, bottom: 3, opacity: 0.7 },
  pond: { file: 'doodle-pond.svg', kind: 'ink', w: 66, h: 28, bottom: 0, opacity: 0.6 },
  house: { file: 'doodle-house.svg', kind: 'ink', w: 38, h: 36, bottom: 15, opacity: 0.7 },
  crossroads: { file: 'doodle-crossroads.svg', kind: 'ink', w: 36, h: 38, bottom: 13, opacity: 0.7 },
  wall: { file: 'doodle-wall.svg', kind: 'ink', w: 46, h: 38, bottom: 15, opacity: 0.7 },
  mountains: { file: 'doodle-mountains.svg', kind: 'ink', w: 74, h: 44, bottom: 14, opacity: 0.55 },
  castle: { file: 'landmark-castle.png', kind: 'img', w: 40, h: 38, bottom: 14, opacity: 0.55 },
  bridge: { file: 'landmark-bridge.png', kind: 'img', w: 58, h: 34, bottom: 4, opacity: 0.55 },
  dragon: { file: 'landmark-mountain-cave.png', kind: 'img', w: 56, h: 42, bottom: 12, opacity: 0.55 },
}

/** The landmarks of Knight and Dragon: which stretch (key) of the quest, how far into it, and what. */
const LANDMARKS: [number, number, string][] = [
  [0, 0.12, 'castle'],
  [1, 0.5, 'wood4'],
  [2, 0.35, 'pond'],
  [3, 0.55, 'house'],
  [5, 0.4, 'crossroads'],
  [6, 0.5, 'wall'],
  [7, 0.5, 'bridge'],
  [8, 0.3, 'orchard'],
  [9, 0.6, 'wood3'],
  [10, 0.45, 'mountains'],
  [12, 0.5, 'mountains'],
  [14, 0.4, 'dragon'],
]
const STRETCHES = 15

function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * What stands along one stretch of road (the walk to one key), placed the same way every time.
 * `walk` is the knight's walk across the bar; a stretch of land is longer than that by the land's
 * slide, so one runs on into the next.
 */
export function stretchItems(k: number, walk: number): RoadItem[] {
  const stretch = walk * (1 + LAND_SPEED)
  const start = k * stretch
  const n = ((k % STRETCHES) + STRETCHES) % STRETCHES
  const items: RoadItem[] = []
  const taken: [number, number][] = []
  const put = (name: string, x: number, scale = 1) => {
    const d = D[name]
    items.push({
      kind: d.kind,
      file: d.file,
      x,
      bottom: d.bottom + (name === 'pine' ? Math.round(Math.abs(x)) % 3 : 0),
      w: d.w * scale,
      h: d.h * scale,
      opacity: d.opacity,
    })
    taken.push([x, x + d.w * scale])
  }
  for (const [at, f, what] of LANDMARKS) {
    if (at !== n) continue
    const x = start + f * walk
    if (what === 'wood4' || what === 'wood3') {
      const trees = what === 'wood4' ? 4 : 3
      for (let i = 0; i < trees; i++) put('pine', x + i * 17 + (i % 2) * 3)
      // A wood is trees close together; nothing else squeezes in.
      taken.push([x, x + trees * 17 + 12])
    } else if (what === 'orchard') {
      put('apple', x)
      put('apple', x + 40)
    } else put(what, x, what === 'mountains' && n === 12 ? 1.15 : 1)
  }
  const free = (a: number, b: number) => taken.every(([x, y]) => b < x - 14 || a > y + 14)
  const R = rng(1009 + n * 7919)
  // An apple tree is a treat: on only a few stretches, and the orchard's are its own.
  let appleLeft = n % 4 === 2 ? 1 : 0
  let last = ''
  let run = 0
  for (let x = start + 20 + R() * 40; x < start + stretch - 30; x += 80 + R() * 60) {
    if (!free(x, x + 30)) continue
    const r = R()
    let name = r < 0.55 ? 'pine' : 'grass'
    if (appleLeft > 0 && r > 0.9) {
      name = 'apple'
      appleLeft--
    }
    // Never three of the same in a row.
    if (name === last && ++run >= 2) {
      name = name === 'grass' ? 'pine' : 'grass'
      run = 0
    } else if (name !== last) run = 0
    last = name
    put(name, x)
  }
  return items
}
