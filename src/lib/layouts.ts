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
 * were drawn and left out.
 */
export type RoomLayout = 'rows' | 'pairs' | 'threes' | 'tables4' | 'tables5-top' | 'tables5-bottom'

export const ROOM_LAYOUTS: RoomLayout[] = ['rows', 'pairs', 'threes', 'tables4', 'tables5-top', 'tables5-bottom']

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
}

/**
 * The most desks any layout draws: tables of five for a class of more than thirty (eight
 * tables). The seating list is always this long, so switching layouts never runs out of room.
 */
export const MAX_SEATS = 40

/** Desks a layout has before a big class needs more. */
const BASE_SEATS: Record<RoomLayout, number> = {
  rows: 30,
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
): LayoutPlan {
  return {
    kind,
    columns,
    rows,
    columnGaps,
    rowGaps,
    seats,
    setCount: Math.max(...seats.map((s) => s.set)) + 1,
    setName,
    fillOrder: fillOrderOf(seats),
  }
}

const repeatGaps = (pattern: Gap[], length: number): Gap[] => Array.from({ length }, (_, i) => pattern[i % pattern.length])

/**
 * The grid layouts: six desks across, five deep. Desks 0-29 go row by row and a big class's
 * seventh column is desks 30-34, top to bottom - the numbering the app has always used, so a
 * seating chart saved before layouts existed is already a Rows chart, and Rows, Pairs and Rows
 * of 3 share their numbers: switching between them moves nobody.
 */
function gridLayout(kind: 'rows' | 'pairs' | 'threes', big: boolean): LayoutPlan {
  const across: Record<typeof kind, Gap[]> = {
    rows: repeatGaps(['even'], 5),
    pairs: ['touch', 'aisle', 'touch', 'aisle', 'touch'],
    threes: ['touch', 'touch', 'aisle', 'touch', 'touch'],
  }
  const seats: Seat[] = []
  for (let i = 0; i < (big ? 35 : 30); i++) {
    const column = i < 30 ? i % 6 : 6
    seats.push({ column, row: i < 30 ? Math.floor(i / 6) : i - 30, set: column })
  }
  // A big class's seventh column stands on its own, past an aisle, in the grouped layouts.
  const columnGaps: Gap[] = big ? [...across[kind], kind === 'rows' ? 'even' : 'aisle'] : across[kind]
  return plan(kind, big ? 7 : 6, 5, columnGaps, repeatGaps(['even'], 4), seats, 'row')
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

const plans = new Map<string, LayoutPlan>()

/** A layout's desks. `big` is a class of more than its usual number of desks. */
export function layoutPlan(kind: RoomLayout, big: boolean): LayoutPlan {
  const key = `${kind}-${big}`
  let found = plans.get(key)
  if (!found) {
    found =
      kind === 'tables4'
        ? tablesOfFour()
        : kind === 'tables5-top' || kind === 'tables5-bottom'
          ? tablesOfFive(kind, big)
          : gridLayout(kind, big)
    plans.set(key, found)
  }
  return found
}

/** More students than the layout's usual desks, or anyone still sitting past them. */
function needsMoreDesks(kind: RoomLayout, cls: Pick<ClassData, 'students' | 'seating'>): boolean {
  const base = BASE_SEATS[kind]
  return cls.students.length > base || cls.seating.slice(base).some(Boolean)
}

/** The desks this class sees: its layout, grown for a big class. */
export function planFor(cls: Pick<ClassData, 'students' | 'seating' | 'layout'> | undefined): LayoutPlan {
  if (!cls) return layoutPlan('rows', false)
  const kind = cls.layout ?? 'rows'
  return layoutPlan(kind, needsMoreDesks(kind, cls))
}

/** Rows, Pairs and Rows of 3 number their desks the same way, so moving between them moves nobody. */
const GRID_LAYOUTS: RoomLayout[] = ['rows', 'pairs', 'threes']

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
