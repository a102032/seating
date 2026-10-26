import { describe, expect, it } from 'vitest'
import { layoutPlan, MAX_SEATS, planFor, reseatForLayout, ROOM_LAYOUTS, type RoomLayout } from '../layouts'
import { makeClass } from './helpers'

const seatedIds = (seating: (string | null)[]) => seating.filter((id): id is string => Boolean(id))

describe('every layout', () => {
  for (const kind of ROOM_LAYOUTS) {
    for (const big of [false, true]) {
      it(`${kind}${big ? ' (big class)' : ''}: fill order is every desk once, back row first`, () => {
        const plan = layoutPlan(kind, big)
        expect(plan.seats.length).toBeLessThanOrEqual(MAX_SEATS)
        expect([...plan.fillOrder].sort((a, b) => a - b)).toEqual(plan.seats.map((_, i) => i))
        const rows = plan.fillOrder.map((i) => plan.seats[i].row)
        // Never goes back down a row: bottom row first, working up.
        rows.forEach((row, k) => k > 0 && expect(row).toBeLessThanOrEqual(rows[k - 1]))
        expect(plan.columnGaps.length).toBe(plan.columns - 1)
        expect(plan.rowGaps.length).toBe(plan.rows - 1)
        expect(plan.setCount).toBe(new Set(plan.seats.map((s) => s.set)).size)
      })
    }
  }

  it('keeps six desks across, and the tables pay in height', () => {
    for (const kind of ROOM_LAYOUTS) expect(layoutPlan(kind, false).columns).toBe(6)
    expect(layoutPlan('rows', false).rows).toBe(5)
    expect(layoutPlan('tables4', false).rows).toBe(6)
  })
})

describe('Rows', () => {
  it('numbers desks the way the app always has: 0-29 six wide, 30-34 the seventh column', () => {
    const plan = layoutPlan('rows', true)
    for (let i = 0; i < 30; i++) expect(plan.seats[i]).toMatchObject({ column: i % 6, row: Math.floor(i / 6), set: i % 6 })
    for (let i = 30; i < 35; i++) expect(plan.seats[i]).toMatchObject({ column: 6, row: i - 30, set: 6 })
  })

  it('Rows, Pairs and Rows of 3 share their numbers', () => {
    const rows = layoutPlan('rows', true).seats
    for (const kind of ['pairs', 'threes'] as RoomLayout[]) expect(layoutPlan(kind, true).seats).toEqual(rows)
  })

  it('Pick Row sets are the six rows front to back (columns on the board)', () => {
    expect(layoutPlan('rows', false).setCount).toBe(6)
    expect(layoutPlan('rows', false).setName).toBe('row')
  })
})

describe('planFor', () => {
  it('a missing class is plain Rows', () => {
    expect(planFor(undefined).kind).toBe('rows')
  })

  it('a class of thirty is six across; thirty-one grows the seventh column', () => {
    expect(planFor(makeClass(30)).columns).toBe(6)
    expect(planFor(makeClass(30)).side).toBe(false)
    const big = planFor(makeClass(31))
    expect(big.columns).toBe(7)
    expect(big.side).toBe(false)
  })

  it('side desks: while someone sits there, or while Swap Seats is on', () => {
    const cls = makeClass(20)
    expect(planFor(cls).side).toBe(false)
    expect(planFor(cls, { sideDesks: true }).side).toBe(true)
    const moved = { ...cls, seating: [...cls.seating] }
    moved.seating[32] = moved.seating[0]
    moved.seating[0] = null
    const plan = planFor(moved)
    expect(plan.side).toBe(true)
    expect(plan.columns).toBe(7)
    // A side desk counts with the last row for Pick Row, and is filled last.
    expect(plan.seats[32].set).toBe(5)
    expect(plan.fillOrder.slice(-5).every((i) => plan.seats[i].column === 6)).toBe(true)
  })

  it('tables have no side desks; a big class gets more tables', () => {
    expect(planFor(makeClass(20, { layout: 'tables4' }), { sideDesks: true }).side).toBe(false)
    expect(planFor(makeClass(30, { layout: 'tables5-top' })).columns).toBe(6)
    expect(planFor(makeClass(31, { layout: 'tables5-top' })).columns).toBe(8)
    expect(planFor(makeClass(35, { layout: 'tables4' })).seats.length).toBe(36)
  })
})

describe('reseatForLayout', () => {
  it('between Rows, Pairs and Rows of 3 nobody moves, and an empty desk stays empty', () => {
    const cls = makeClass(25)
    cls.seating[3] = null
    expect(reseatForLayout(cls, 'pairs')).toEqual(cls.seating.slice(0, MAX_SEATS))
    expect(reseatForLayout({ ...cls, layout: 'pairs' }, 'threes')).toEqual(cls.seating.slice(0, MAX_SEATS))
  })

  for (const to of ['tables4', 'tables5-top', 'tables5-bottom'] as RoomLayout[]) {
    for (const count of [12, 30, 35]) {
      it(`Rows into ${to} with ${count}: everyone kept once, the back filled first`, () => {
        const cls = makeClass(count)
        const next = reseatForLayout(cls, to)
        expect(next.length).toBe(MAX_SEATS)
        expect(seatedIds(next).sort()).toEqual(cls.students.map((s) => s.id).sort())
        // Closed up: the class fills the new room's fill order from the start, with no holes.
        const plan = planFor({ ...cls, layout: to, seating: next })
        expect(plan.fillOrder.slice(0, count).every((seat) => next[seat])).toBe(true)
      })
    }
  }

  it('the back row keeps its order going into tables and back', () => {
    const cls = makeClass(30)
    const firstBack = layoutPlan('rows', false).fillOrder.map((i) => cls.seating[i])[0]
    const tables = reseatForLayout(cls, 'tables4')
    expect(tables[layoutPlan('tables4', false).fillOrder[0]]).toBe(firstBack)
    const back = reseatForLayout({ ...cls, layout: 'tables4', seating: tables }, 'rows')
    expect(back[layoutPlan('rows', false).fillOrder[0]]).toBe(firstBack)
    expect(seatedIds(back).length).toBe(30)
  })
})
