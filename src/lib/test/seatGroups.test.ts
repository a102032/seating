import { describe, expect, it } from 'vitest'
import { layoutPlan, ROOM_LAYOUTS, type LayoutPlan } from '../layouts'
import { neighbourGroups, neighbourhoods, placeGroups, type Placed } from '../seatGroups'
import { seeded } from './helpers'

/** Students at these desks of the plan, each named by their desk's number. */
const at = (plan: LayoutPlan, desks: number[]): Placed[] => desks.map((d) => ({ id: String(d), seat: plan.seats[d] }))
const fullRoom = (plan: LayoutPlan, count = 30) => at(plan, plan.fillOrder.slice(0, count))
/** Each group as its desks, in the order the groups and their chips come. */
const shape = (groups: Placed[][]) => groups.map((g) => g.map((s) => Number(s.id)))

const rows = layoutPlan('rows', false)

describe('groups from where the students sit, on six across and five deep', () => {
  it('pairs are the two desks side by side', () => {
    const pairs = shape(neighbourGroups(fullRoom(rows), rows, 2))
    expect(pairs).toEqual(Array.from({ length: 15 }, (_, i) => [i * 2, i * 2 + 1]))
  })

  it('threes are the three side by side', () => {
    expect(shape(neighbourGroups(fullRoom(rows), rows, 3))).toEqual(Array.from({ length: 10 }, (_, i) => [i * 3, i * 3 + 1, i * 3 + 2]))
  })

  it('fours are squares, the short front line making a seventh group', () => {
    const fours = shape(neighbourGroups(fullRoom(rows), rows, 4))
    expect(fours.length).toBe(7)
    expect(fours).toContainEqual([6, 7, 12, 13])
    expect(fours).toContainEqual([22, 23, 28, 29])
    expect(fours.every((g) => g.length === 4 || g.length === 5)).toBe(true)
  })

  it('fives are each row front to back', () => {
    expect(shape(neighbourGroups(fullRoom(rows), rows, 5))).toEqual(Array.from({ length: 6 }, (_, c) => [c, c + 6, c + 12, c + 18, c + 24]))
  })

  it('how many groups cuts the room on its own lines', () => {
    const cut = (n: number) => shape(neighbourhoods(fullRoom(rows), rows, n))
    // Six are the rows, five the lines across, two the halves, three two rows each.
    expect(cut(6)).toEqual(Array.from({ length: 6 }, (_, c) => [c, c + 6, c + 12, c + 18, c + 24]))
    expect(cut(5)).toEqual(Array.from({ length: 5 }, (_, r) => [0, 1, 2, 3, 4, 5].map((c) => r * 6 + c)))
    expect(cut(2).map((g) => g.every((d) => d % 6 < 3) || g.every((d) => d % 6 >= 3))).toEqual([true, true])
    expect(cut(3).map((g) => new Set(g.map((d) => Math.floor((d % 6) / 2))).size)).toEqual([1, 1, 1])
    // Four are the corners, as even as they can be.
    expect(cut(4).map((g) => g.length)).toEqual([7, 7, 8, 8])
  })

  it('the same choice gives the same groups every time', () => {
    const students = fullRoom(rows, 23)
    expect(shape(neighbourGroups(students, rows, 2))).toEqual(shape(neighbourGroups([...students].reverse(), rows, 2)))
    expect(shape(neighbourhoods(students, rows, 4))).toEqual(shape(neighbourhoods([...students].reverse(), rows, 4)))
  })

  it('a pair whose partner is away pairs with the nearest other student on their own', () => {
    // Desks 1 and 28 are away: 0 and 29 are left on their own, at opposite ends of the room.
    const desks = Array.from({ length: 30 }, (_, i) => i).filter((d) => d !== 1 && d !== 28)
    const pairs = shape(neighbourGroups(at(rows, desks), rows, 2))
    expect(pairs).toContainEqual([0, 29])
    expect(pairs.every((g) => g.length === 2)).toBe(true)
  })
})

describe('in a room of tables', () => {
  it('fours at tables of four are the tables', () => {
    const plan = layoutPlan('tables4', false)
    const groups = neighbourGroups(at(plan, plan.seats.map((_, i) => i)), plan, 4)
    expect(groups.length).toBe(9)
    expect(groups.every((g) => new Set(g.map((s) => s.seat.set)).size === 1)).toBe(true)
  })

  it('fives at tables of five are the tables', () => {
    const plan = layoutPlan('tables5-top', false)
    const groups = neighbourGroups(at(plan, plan.seats.map((_, i) => i)), plan, 5)
    expect(groups.length).toBe(6)
    expect(groups.every((g) => g.length === 5 && new Set(g.map((s) => s.seat.set)).size === 1)).toBe(true)
  })
})

/**
 * Random classes in every layout with about one in eight away (DECISIONS: "10,000 random classes"
 * - a thousand here, so the tests stay quick): nobody missing, doubled or alone, and how many
 * groups always as even as it can be.
 */
describe('random classes', () => {
  const random = seeded(2026)
  for (const kind of ROOM_LAYOUTS) {
    it(kind, () => {
      for (let trial = 0; trial < 170; trial++) {
        const count = 6 + Math.floor(random() * 30)
        const plan = layoutPlan(kind, count > (kind === 'tables4' ? 36 : 30))
        const desks = plan.fillOrder.slice(0, count).filter(() => random() > 0.125)
        if (desks.length < 2) continue
        const students = at(plan, desks)
        const ids = students.map((s) => s.id).sort()
        for (const size of [2, 3, 4, 5]) {
          const groups = neighbourGroups(students, plan, size)
          expect(groups.flat().map((s) => s.id).sort()).toEqual(ids)
          expect(groups.some((g) => g.length < 2)).toBe(false)
        }
        for (const n of [2, 3, 4, 5, 6]) {
          if (n > students.length) continue
          const groups = neighbourhoods(students, plan, n)
          expect(groups.flat().map((s) => s.id).sort()).toEqual(ids)
          const sizes = groups.map((g) => g.length)
          expect(groups.length).toBe(n)
          expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
        }
      }
    })
  }
})

describe('placeGroups: cards sit where the groups sit', () => {
  it('six rows of desks are six cards side by side, numbered left to right', () => {
    const { groups, places } = placeGroups(neighbourhoods(fullRoom(rows), rows, 6))
    expect(places).toEqual([0, 1, 2, 3, 4, 5].map((column) => ({ column, row: 0, across: 1 })))
    expect(groups.map((g) => Number(g[0].id))).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('pairs are a grid of pairs, front of the room first', () => {
    const { groups, places } = placeGroups(neighbourGroups(fullRoom(rows), rows, 2))
    expect(places?.length).toBe(15)
    expect(places?.[0]).toEqual({ column: 0, row: 0, across: 2 })
    expect(groups[0].map((s) => s.id)).toEqual(['0', '1'])
  })

  it('a row whose front desk is empty is still numbered where it sits', () => {
    const desks = Array.from({ length: 30 }, (_, i) => i).filter((d) => d !== 0)
    const { groups } = placeGroups(neighbourhoods(at(rows, desks), rows, 6))
    expect(groups[0].every((s) => s.seat.column === 0)).toBe(true)
  })

  it('groups that would share a place get none, and the usual grid', () => {
    const scattered = [at(rows, [0, 29]), at(rows, [5, 24])]
    expect(placeGroups(scattered).places).toBeNull()
    expect(placeGroups([]).places).toBeNull()
  })
})
