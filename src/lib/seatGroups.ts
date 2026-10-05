import type { LayoutPlan, Seat } from './layouts'

/**
 * Groups made from where the students sit, so nobody has to carry a chair across the room (the
 * teacher's call, 2026-10-05): pairs are the two desks side by side, threes the three side by
 * side, fours two side by side and the two behind them, and "how many groups" cuts the room into
 * that many neighbourhoods. Shuffle is the way to mix them up (lib/groups).
 *
 * Everything here works from the room's own plan (lib/layouts), so tables and desks pushed
 * together are what decide, and from the seats rather than the order of the roster.
 */

export interface Placed {
  id: string
  seat: Seat
}

/**
 * Desks apart, side by side counting a hair less than front to back, so a tie goes to the
 * neighbour in the same line, which is the one a child can turn to without getting up.
 */
function apart(a: Seat, b: Seat): number {
  return Math.hypot(a.column - b.column, (a.row - b.row) * 1.01)
}

function groupsApart(a: Placed[], b: Placed[]): number {
  let best = Infinity
  for (const x of a) for (const y of b) best = Math.min(best, apart(x.seat, y.seat))
  return best
}

/** Front of the room first, left to right: the order chips sit in on a card, and groups are numbered in. */
function byReading(a: Placed, b: Placed): number {
  return a.seat.row - b.seat.row || a.seat.column - b.seat.column
}

function inReadingOrder(groups: Placed[][]): Placed[][] {
  return groups
    .filter((g) => g.length > 0)
    .map((g) => [...g].sort(byReading))
    .sort((a, b) => byReading(a[0], b[0]))
}

/**
 * A block of desks this many across and this many deep - within one table (`local`) or across
 * the room - or a whole table.
 */
type Shape = { across: number; deep: number; local: boolean } | 'table'

/**
 * The shapes a group of this size can take, the one a teacher would pick first coming first:
 * a whole table that is the right size, then blocks within a table, then blocks across the room
 * (threes in a room of tables of four have to reach over to the next table).
 */
function shapesFor(size: number, plan: LayoutPlan): Shape[] {
  const blocks: Record<number, [number, number][]> = {
    2: [
      [2, 1],
      [1, 2],
    ],
    3: [
      [3, 1],
      [1, 3],
    ],
    4: [
      [2, 2],
      [4, 1],
      [1, 4],
    ],
    5: [
      [1, 5],
      [5, 1],
    ],
  }
  const sizes = blocks[size] ?? [[size, 1]]
  const room: Shape[] = sizes.map(([across, deep]) => ({ across, deep, local: false }))
  if (plan.setName !== 'table') return room
  const tableSize = plan.seats.filter((seat) => seat.set === 0).length
  return [...(tableSize === size ? ['table' as const] : []), ...sizes.map(([across, deep]) => ({ across, deep, local: true })), ...room]
}

/**
 * Which block a desk is in. Blocks are counted from the back of the room, because a class fills
 * its desks from the back: the line that comes up short is the front one, where the empty desks
 * are. In a table layout blocks never cross from one table to the next.
 */
function blockOf(seat: Seat, shape: Shape, plan: LayoutPlan, tableCorner: Map<number, { column: number; back: number }>): string {
  if (shape === 'table') return `t${seat.set}`
  const corner = shape.local ? tableCorner.get(seat.set) : undefined
  const column = Math.floor(seat.column) - (corner?.column ?? 0)
  const fromBack = (corner?.back ?? plan.rows - 1) - seat.row
  return `${corner ? seat.set : ''}:${Math.floor(column / shape.across)}:${Math.floor(fromBack / shape.deep)}`
}

function tableCorners(plan: LayoutPlan): Map<number, { column: number; back: number }> {
  const corners = new Map<number, { column: number; back: number }>()
  if (plan.setName !== 'table') return corners
  for (const seat of plan.seats) {
    const c = corners.get(seat.set)
    corners.set(seat.set, {
      column: Math.min(c?.column ?? Infinity, Math.floor(seat.column)),
      back: Math.max(c?.back ?? -Infinity, seat.row),
    })
  }
  return corners
}

/**
 * The shape for this room: the one that makes the most whole groups out of its desks. A room's
 * desks decide it, not who is in today, so a student away doesn't change the shape everyone
 * else sits in. On six across and five deep, fives are the rows front to back and fours are
 * squares.
 */
function shapeForRoom(size: number, plan: LayoutPlan, corners: Map<number, { column: number; back: number }>): Shape {
  let best: Shape | null = null
  let bestWhole = -1
  for (const shape of shapesFor(size, plan)) {
    const counts = new Map<string, number>()
    for (const seat of plan.seats) {
      const key = blockOf(seat, shape, plan, corners)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const whole = [...counts.values()].filter((n) => n === size).length
    if (whole > bestWhole) {
      best = shape
      bestWhole = whole
    }
  }
  return best ?? { across: size, deep: 1, local: false }
}

/** Bits of short blocks only join up if they sit this close: next door, or one desk over and one back. */
const NEAR_ENOUGH = 2.3

/**
 * Groups of about `size`, from who sits next to whom. A block of desks with everyone in it is a
 * group just as it sits. Only a block with a gap changes: one short by a student stays as it is
 * (a square of three is fine; pulling someone across the room to fill it would defeat the point);
 * at a table, what's left of a block joins the rest of its own table; a student whose partner is
 * away pairs with the nearest other student left on their own, however far (the teacher's rule);
 * other short blocks join a short block close by; and anyone still on their own goes to the
 * nearest group with room, so nobody is ever a group of one.
 */
export function neighbourGroups(students: Placed[], plan: LayoutPlan, size: number): Placed[][] {
  if (students.length === 0) return []
  const corners = tableCorners(plan)
  const shape = shapeForRoom(size, plan, corners)
  const blocks = new Map<string, Placed[]>()
  for (const s of students) {
    const key = blockOf(s.seat, shape, plan, corners)
    blocks.set(key, [...(blocks.get(key) ?? []), s])
  }
  const most = size + 1
  const keep = size <= 2 ? 2 : size - 1
  // Back of the room first, as the class fills it, so the same room always comes out the same way.
  const fromBack = (g: Placed[]) => Math.max(...g.map((s) => s.seat.row * 100 - s.seat.column))
  let groups = [...blocks.values()].sort((a, b) => fromBack(b) - fromBack(a))
  const short = (g: Placed[]) => g.length < keep

  // Short blocks close to each other join up, while together they're no bigger than a group can be.
  const joinShort = (within: number) => {
    for (let joined = true; joined; ) {
      joined = false
      for (const g of groups) {
        if (!short(g)) continue
        let partner: Placed[] | null = null
        let partnerApart = Infinity
        for (const other of groups) {
          if (other === g || !short(other) || g.length + other.length > most) continue
          const d = groupsApart(g, other)
          if (d <= within && d < partnerApart) {
            partner = other
            partnerApart = d
          }
        }
        if (partner) {
          const both = [...g, ...partner]
          groups = [...groups.filter((x) => x !== g && x !== partner), both]
          joined = true
          break
        }
      }
    }
  }
  // At a table, the desk a block left over (a table of five's end desk, when pairs are asked
  // for) stays at its own table.
  if (plan.setName === 'table') {
    for (const g of groups.filter(short)) {
      const table = g[0].seat.set
      const home = groups.find((other) => other !== g && !short(other) && other[0].seat.set === table && other.length + g.length <= most)
      if (home) {
        home.push(...g)
        groups = groups.filter((x) => x !== g)
      }
    }
  }
  if (size <= 2) joinShort(Infinity)
  else {
    joinShort(NEAR_ENOUGH)
    // Students scattered so thinly that no block filled: they join up however far apart they
    // are, since there is no group nearby to join instead.
    if (!groups.some((g) => !short(g))) joinShort(Infinity)
  }

  // Whoever is still in a short block goes, one at a time, to the nearest group with room - or,
  // if every group is full, the nearest group of all.
  const settled = groups.filter((g) => !short(g))
  const leftOver = groups.filter(short).flat()
  if (settled.length === 0) return inReadingOrder([leftOver])
  for (const s of leftOver) {
    const ranked = [...settled].sort((a, b) => groupsApart([s], a) - groupsApart([s], b))
    const home = ranked.find((g) => g.length < most) ?? ranked[0]
    home.push(s)
  }
  return inReadingOrder(settled)
}

/**
 * The room cut into this many neighbourhoods, as even as they can be. The cut follows the
 * room's own lines where it can: on six across and five deep, six groups are the rows, three are
 * two rows each, two are the halves, five are the lines across, and four are the corners. Tables
 * stay whole where the numbers allow.
 */
export function neighbourhoods(students: Placed[], plan: LayoutPlan, count: number): Placed[][] {
  if (students.length === 0 || count < 1) return []
  const width = plan.columns
  const depth = plan.rows
  // Across x deep, preferring cuts that fall on the room's lines, then the squarest pieces.
  let across = count
  let deep = 1
  let bestScore = Infinity
  for (let a = 1; a <= count; a++) {
    if (count % a !== 0) continue
    const b = count / a
    const uneven = (width % a === 0 ? 0 : 1) + (depth % b === 0 ? 0 : 1)
    const score = uneven * 100 + Math.abs(width / a - depth / b)
    if (score < bestScore) {
      bestScore = score
      across = a
      deep = b
    }
  }
  const pieceWidth = width / across
  const pieceDepth = depth / deep

  // Where each student counts as sitting: a table's middle, so a table stays together, or their
  // own desk. Nudged a hair up and left, so a table exactly on a cut goes the same way every time.
  const middles = new Map<number, { x: number; y: number }>()
  if (plan.setName === 'table') {
    const sums = new Map<number, { x: number; y: number; n: number }>()
    for (const seat of plan.seats) {
      const s = sums.get(seat.set) ?? { x: 0, y: 0, n: 0 }
      sums.set(seat.set, { x: s.x + seat.column + 0.5, y: s.y + seat.row + 0.5, n: s.n + 1 })
    }
    sums.forEach((s, set) => middles.set(set, { x: s.x / s.n - 0.01, y: s.y / s.n - 0.01 }))
  }
  const at = (s: Placed) => middles.get(s.seat.set) ?? { x: s.seat.column + 0.5, y: s.seat.row + 0.5 }

  // As even as they can be: every piece gets its share, one more for the pieces the room already
  // gives the most students (the back, where a class fills from).
  const strip = (p: Placed) => Math.min(across - 1, Math.floor(at(p).x / pieceWidth))
  const band = (p: Placed) => Math.min(deep - 1, Math.floor(at(p).y / pieceDepth))
  const natural = Array.from({ length: count }, () => 0)
  for (const p of students) natural[band(p) * across + strip(p)]++
  const share = Math.floor(students.length / count)
  const room = natural.map(() => share)
  natural
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, students.length % count)
    .forEach(({ i }) => room[i]++)

  // The room walked in one unbroken line, piece by piece: down the first strip from the front,
  // back up the next, each line of desks the other way from the one before. Cutting that walk
  // into the shares keeps every group one patch of the room, and where absences or a short front
  // line make a piece too big or too small, the cut just slides along the walk.
  const line = (p: Placed) => Math.floor(at(p).y)
  const walk = [...students].sort((a, b) => {
    const sa = strip(a)
    if (sa !== strip(b)) return sa - strip(b)
    const down = sa % 2 === 0 ? 1 : -1
    if (line(a) !== line(b)) return (line(a) - line(b)) * down
    const way = line(a) % 2 === 0 ? 1 : -1
    return (at(a).x - at(b).x) * way || byReading(a, b)
  })
  const order: number[] = []
  for (let st = 0; st < across; st++) {
    for (let k = 0; k < deep; k++) order.push((st % 2 === 0 ? k : deep - 1 - k) * across + st)
  }
  const pieces: Placed[][] = []
  let next = 0
  for (const piece of order) {
    pieces.push(walk.slice(next, next + room[piece]))
    next += room[piece]
  }
  return inReadingOrder(mendStrays(pieces))
}

/** Next to someone in the group: beside, behind or on the diagonal. */
const besideSomeone = (s: Placed, group: Placed[]) => group.some((o) => o !== s && apart(o.seat, s.seat) <= 1.5)

/**
 * A student the cut left on their own, away from the rest of their group - where students away
 * today emptied the end of a strip, the walk jumps to the far end of the next - trades places
 * with a student of a group they sit beside, one who sits beside theirs. Sizes stay as they are.
 */
function mendStrays(groups: Placed[][]): Placed[][] {
  const strays = (gs: Placed[][]) => gs.reduce((n, g) => n + (g.length > 1 ? g.filter((s) => !besideSomeone(s, g)).length : 0), 0)
  let current = groups.map((g) => [...g])
  for (let tries = 0; tries < 40; tries++) {
    const before = strays(current)
    if (before === 0) break
    let mended: Placed[][] | null = null
    search: for (let gi = 0; gi < current.length; gi++) {
      const g = current[gi]
      for (const s of g) {
        if (g.length < 2 || besideSomeone(s, g)) continue
        for (let hi = 0; hi < current.length; hi++) {
          if (hi === gi || !besideSomeone(s, [...current[hi], s])) continue
          for (const t of current[hi]) {
            if (!besideSomeone(t, [...g, t])) continue
            const trial = current.map((x, i) =>
              i === gi ? [...x.filter((y) => y !== s), t] : i === hi ? [...x.filter((y) => y !== t), s] : x,
            )
            if (strays(trial) < before) {
              mended = trial
              break search
            }
          }
        }
      }
    }
    if (!mended) break
    current = mended
  }
  return current
}
