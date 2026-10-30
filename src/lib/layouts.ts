import type { ClassData } from '../types'

/**
 * How the desks stand in the room. Rows is the six-by-five grid the app began with, which is
 * how the teacher's own school sets its rooms out; the others are what other schools do: desks
 * pushed together in twos or threes with aisles between, and tables of four or five. A table of
 * five has its fifth desk at one end, above the four or below them.
 *
 * Every layout keeps six desks across. The mock-up that chose these showed why: a name is sized
 * by its desk's width, so six across keeps every name at today's size, and the tables pay in
 * height instead (a sixth row, slightly smaller pictures). Tables of 6 and L-shaped groups of 3
 * were drawn and left out. 7 Rows is the one room seven across, for a room that has seven rows:
 * its names are a seventh narrower, as in a class of 31.
 */
export type RoomLayout = 'rows' | 'rows7' | 'pairs' | 'threes' | 'tables4' | 'tables5-top' | 'tables5-bottom'

export const ROOM_LAYOUTS: RoomLayout[] = ['rows', 'rows7', 'pairs', 'threes', 'tables4', 'tables5-top', 'tables5-bottom']

/** The space after a column or row of desks: the grid's even gap, desks pushed together, or an aisle. */
export type Gap = 'even' | 'touch' | 'aisle'

export interface Seat {
  /** Counting from the left. A table of five's end desk sits halfway across its table: 0.5. */
  column: number
  /** Counting from the top. */
  row: number
  /** The row of desks (Pick Row) or the table (Pick Table) this desk belongs to. */
  set: number
}

export interface LayoutPlan {
  kind: RoomLayout
  columns: number
  rows: number
  /** The space after each column but the last. */
  columnGaps: Gap[]
  /** The space after each row but the last. */
  rowGaps: Gap[]
  /** Seat i is `seating[i]` in the class's data. */
  seats: Seat[]
  setCount: number
  /** What Pick Row calls one set of desks in this room. */
  setName: 'row' | 'table'
  /** Seat numbers in the order a class fills them: back row first, left to right, working up. */
  fillOrder: number[]
  /**
   * The seventh column as side desks, not a big class's extra desks: a class of thirty or fewer
   * with a student moved off to the side of the room (2026-10-14). Its desks stand past an aisle,
   * count with the last row for Pick Row, and are filled last.
   */
  side: boolean
}

/**
 * The most desks any layout draws: tables of five for a class of more than thirty (eight
 * tables). The seating list is always this long, so switching layouts never runs out of room.
 */
export const MAX_SEATS = 40

/** Desks a layout has before a big class needs more. */
const BASE_SEATS: Record<RoomLayout, number> = {
  rows: 30,
  rows7: 35,
  pairs: 30,
  threes: 30,
  tables4: 36,
  'tables5-top': 30,
  'tables5-bottom': 30,
}

function fillOrderOf(seats: Seat[]): number[] {
  return seats
    .map((seat, index) => ({ seat, index }))
    .sort((a, b) => b.seat.row - a.seat.row || a.seat.column - b.seat.column)
    .map((s) => s.index)
}

function plan(
  kind: RoomLayout,
  columns: number,
  rows: number,
  columnGaps: Gap[],
  rowGaps: Gap[],
  seats: Seat[],
  setName: 'row' | 'table',
  side = false,
): LayoutPlan {
  const order = fillOrderOf(seats)
  return {
    side,
    kind,
    columns,
    rows,
    columnGaps,
    rowGaps,
    seats,
    setCount: Math.max(...seats.map((s) => s.set)) + 1,
    setName,
    // Side desks are never filled by Seat Students or Mix Up Seats: a student is put there by hand.
    fillOrder: side ? [...order.filter((i) => seats[i].column < 6), ...order.filter((i) => seats[i].column >= 6)] : order,
  }
}

const repeatGaps = (pattern: Gap[], length: number): Gap[] => Array.from({ length }, (_, i) => pattern[i % pattern.length])

/**
 * The grid layouts: six desks across, five deep. Desks 0-29 go row by row and a big class's
 * seventh column is desks 30-34, top to bottom - the numbering the app has always used, so a
 * seating chart saved before layouts existed is already a Rows chart, and Rows, Pairs and Rows
 * of 3 share their numbers: switching between them moves nobody.
 */
function gridLayout(kind: 'rows' | 'pairs' | 'threes', big: boolean, side: boolean): LayoutPlan {
  const across: Record<typeof kind, Gap[]> = {
    rows: repeatGaps(['even'], 5),
    pairs: ['touch', 'aisle', 'touch', 'aisle', 'touch'],
    threes: ['touch', 'touch', 'aisle', 'touch', 'touch'],
  }
  const seats: Seat[] = []
  const seventh = big || side
  for (let i = 0; i < (seventh ? 35 : 30); i++) {
    const column = i < 30 ? i % 6 : 6
    // A side desk counts with the last row for Pick Row, so the row picker never lands on just
    // the students moved there, and they are picked as often as anyone (the teacher, 2026-10-14).
    seats.push({ column, row: i < 30 ? Math.floor(i / 6) : i - 30, set: side ? Math.min(column, 5) : column })
  }
  // A big class's seventh column stands on its own, past an aisle, in the grouped layouts; side
  // desks stand past an aisle in Rows too, off to the side of the room as they are.
  const columnGaps: Gap[] = seventh ? [...across[kind], kind === 'rows' && !side ? 'even' : 'aisle'] : across[kind]
  return plan(kind, seventh ? 7 : 6, 5, columnGaps, repeatGaps(['even'], 4), seats, 'row', side)
}

/**
 * 7 Rows: seven equal rows, five deep (2026-10-30, the teacher: his room is six rows and a
 * seventh on the left, and the app's side column, on the right, made Pick Row light two rows at
 * once). It numbers its desks as Rows does with the seventh column moved to the left: desks 0-29
 * are the six rows, one column over, and 30-34 the left-hand row. So switching from Rows moves
 * nobody, and the students he seated in the side column become the left-hand row, which is where
 * they sit in his room. Every column is its own row for Pick Row and for groups.
 */
function sevenRows(): LayoutPlan {
  const seats: Seat[] = []
  for (let i = 0; i < 35; i++) {
    const column = i < 30 ? (i % 6) + 1 : 0
    seats.push({ column, row: i < 30 ? Math.floor(i / 6) : i - 30, set: column })
  }
  return plan('rows7', 7, 5, repeatGaps(['even'], 6), repeatGaps(['even'], 4), seats, 'row')
}

/** Nine tables of four, three across and three deep: thirty-six desks, which seats any class. */
function tablesOfFour(): LayoutPlan {
  const seats: Seat[] = []
  for (let row = 0; row < 6; row++) {
    for (let column = 0; column < 6; column++) {
      seats.push({ column, row, set: Math.floor(row / 2) * 3 + Math.floor(column / 2) })
    }
  }
  const gaps = repeatGaps(['touch', 'aisle'], 5)
  return plan('tables4', 6, 6, gaps, gaps, seats, 'table')
}

/**
 * Tables of five: two desks on each side and the fifth at one end, centred. Six tables, three
 * across and two deep, seat thirty; a bigger class gets a fourth column of tables, the way the
 * grid gets its seventh column, and the desks narrow to make room.
 */
function tablesOfFive(kind: 'tables5-top' | 'tables5-bottom', big: boolean): LayoutPlan {
  const shape: [number, number][] =
    kind === 'tables5-bottom'
      ? [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
          [0.5, 2],
        ]
      : [
          [0.5, 0],
          [0, 1],
          [1, 1],
          [0, 2],
          [1, 2],
        ]
  // The first six tables keep their numbers when the extra two arrive, so growing the room
  // for a big class moves nobody already seated.
  const tables: [number, number][] = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    ...(big
      ? ([
          [3, 0],
          [3, 1],
        ] as [number, number][])
      : []),
  ]
  const seats: Seat[] = tables.flatMap(([across, down], set) => shape.map(([x, y]) => ({ column: across * 2 + x, row: down * 3 + y, set })))
  const columns = big ? 8 : 6
  return plan(kind, columns, 6, repeatGaps(['touch', 'aisle'], columns - 1), ['touch', 'touch', 'aisle', 'touch', 'touch'], seats, 'table')
}

/** Rows, 7 Rows, Pairs and Rows of 3 number their desks the same way, so moving between them moves nobody. */
const GRID_LAYOUTS: RoomLayout[] = ['rows', 'rows7', 'pairs', 'threes']
/** The layouts whose seventh column can be side desks: 7 Rows has seven rows of its own. */
const SIDE_DESK_LAYOUTS: RoomLayout[] = ['rows', 'pairs', 'threes']

const plans = new Map<string, LayoutPlan>()

/** A layout's desks. `big` is a class of more than its usual number of desks. */
export function layoutPlan(kind: RoomLayout, big: boolean, side = false): LayoutPlan {
  const key = `${kind}-${big}-${side}`
  let found = plans.get(key)
  if (!found) {
    found =
      kind === 'tables4'
        ? tablesOfFour()
        : kind === 'rows7'
          ? sevenRows()
          : kind === 'tables5-top' || kind === 'tables5-bottom'
            ? tablesOfFive(kind, big)
            : gridLayout(kind, big, side)
    plans.set(key, found)
  }
  return found
}

/** More students than the layout's usual desks, or anyone still sitting past them. */
function needsMoreDesks(kind: RoomLayout, cls: Pick<ClassData, 'students' | 'seating'>): boolean {
  const base = BASE_SEATS[kind]
  return cls.students.length > base || cls.seating.slice(base).some(Boolean)
}

/**
 * The desks this class sees: its layout, grown for a big class. In Rows, Pairs and Rows of 3 a
 * class of thirty or fewer gets the seventh column as side desks while someone sits there, and
 * while Swap Seats is on (`sideDesks`), so a student can be moved off to the side of the room,
 * as teachers do with a student who needs to focus (the beta testers, 2026-10-14).
 */
export function planFor(cls: Pick<ClassData, 'students' | 'seating' | 'layout'> | undefined, opts?: { sideDesks?: boolean }): LayoutPlan {
  if (!cls) return layoutPlan('rows', false)
  const kind = cls.layout ?? 'rows'
  if (SIDE_DESK_LAYOUTS.includes(kind) && cls.students.length <= BASE_SEATS[kind]) {
    const sideTaken = cls.seating.slice(BASE_SEATS[kind]).some(Boolean)
    return layoutPlan(kind, false, sideTaken || opts?.sideDesks === true)
  }
  return layoutPlan(kind, needsMoreDesks(kind, cls))
}

/**
 * The same class in another layout. Between Rows, Pairs and Rows of 3 nobody moves: the desks
 * are numbered alike, so an empty desk left on purpose stays empty. Into or out of tables, the
 * class keeps its order - whoever sat first in the back row sits first in the new back row -
 * and closes up, so the empty desks are together at the front rather than holes in a table.
 */
export function reseatForLayout(cls: Pick<ClassData, 'students' | 'seating' | 'layout'>, to: RoomLayout): (string | null)[] {
  const next: (string | null)[] = Array.from({ length: MAX_SEATS }, () => null)
  const fromKind = cls.layout ?? 'rows'
  if (GRID_LAYOUTS.includes(fromKind) && GRID_LAYOUTS.includes(to)) {
    cls.seating.forEach((id, seat) => {
      if (seat < MAX_SEATS) next[seat] = id
    })
    return next
  }
  const from = planFor(cls)
  const order = from.fillOrder.map((seat) => cls.seating[seat]).filter((id): id is string => Boolean(id))
  // Anyone at a desk the old layout doesn't draw (there shouldn't be) still gets a seat.
  const inPlan = new Set(from.fillOrder)
  cls.seating.forEach((id, seat) => {
    if (id && !inPlan.has(seat)) order.push(id)
  })
  const target = layoutPlan(to, cls.students.length > BASE_SEATS[to] || order.length > BASE_SEATS[to])
  order.forEach((id, k) => {
    if (k < target.fillOrder.length) next[target.fillOrder[k]] = id
  })
  return next
}
