import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  participationDates,
  participationRows,
  pickChances,
  weightedChoice,
  withCount,
  withoutDay,
  withoutStudent,
  withPick,
  withPoints,
} from '../participation'
import { makeClass } from './helpers'

const MON = '2026-10-05'
const TUE = '2026-10-06'

describe('the record', () => {
  it('counts picks and points by day, once each however many stars', () => {
    let c = makeClass(3)
    c = withPick(c, 's0', MON)
    c = withPick(c, 's0', MON)
    c = withPoints(c, ['s0', 's1'], MON)
    c = withPoints(c, [], TUE)
    expect(c.participation).toEqual({ [MON]: { s0: [2, 1], s1: [0, 1] } })
    expect(participationDates(c)).toEqual([MON])
  })

  it('a count set to nothing takes the student, and an empty day, out', () => {
    const record = { [MON]: { s0: [1, 0] as [number, number] } }
    expect(withCount(record, MON, 's0', [0, 0])).toEqual({})
    expect(withCount(record, MON, 's1', [2.4, -1])).toEqual({ [MON]: { s0: [1, 0], s1: [2, 0] } })
    expect(withoutDay({ ...record, [TUE]: { s1: [1, 1] } }, MON)).toEqual({ [TUE]: { s1: [1, 1] } })
    expect(withoutStudent({ [MON]: { s0: [1, 0], s1: [0, 1] } }, 's0')).toEqual({ [MON]: { s1: [0, 1] } })
    expect(withoutStudent(undefined, 's0')).toBeUndefined()
  })
})

describe('participationRows: the export', () => {
  it('the fewest turns first, then each day as picked and points, Away for a day they were away', () => {
    const c = makeClass(3, {
      participation: { [MON]: { s0: [2, 1], s1: [1, 0] }, [TUE]: { s0: [1, 0] } },
      attendance: { [TUE]: ['s2'] },
    })
    const [header, ...rows] = participationRows(c)
    expect(header).toEqual([
      'Homeroom',
      'Name',
      'Times picked',
      'Times given points',
      `${MON} picked`,
      `${MON} points`,
      `${TUE} picked`,
      `${TUE} points`,
    ])
    expect(rows).toEqual([
      ['3', 'Student 2', '0', '0', '0', '0', 'Away', ''],
      ['2', 'Student 1', '1', '0', '1', '0', '0', '0'],
      ['1', 'Student 0', '3', '1', '2', '1', '1', '0'],
    ])
  })
})

describe('pickChances: a better chance for the students picked less often lately', () => {
  it('no record, no change', () => {
    expect(pickChances(makeClass(4), MON).size).toBe(0)
  })

  it('behind gets more than 1, ahead less, within three times either way', () => {
    // Twenty days of picks, all of them Student 0's.
    const participation: Record<string, Record<string, [number, number]>> = {}
    for (let d = 1; d <= 20; d++) participation[`2026-09-${String(d).padStart(2, '0')}`] = { s0: [3, 0] }
    const chances = pickChances(makeClass(4, { participation }), '2026-09-30')
    expect(chances.get('s0')).toBeCloseTo(1 / 3)
    expect(chances.get('s1')).toBeCloseTo(3)
  })

  it('a day away is not owed a pick', () => {
    const c = makeClass(2, {
      participation: { [MON]: { s0: [1, 0] }, [TUE]: { s0: [1, 0] } },
      attendance: { [MON]: ['s1'], [TUE]: ['s1'] },
    })
    // Student 1 was away every day the picker was used: nothing to make up.
    const chances = pickChances(c, TUE)
    expect(chances.get('s1')).toBe(1)
  })

  it('looks back about two months, and not past today', () => {
    const c = makeClass(2, { participation: { '2026-01-05': { s0: [9, 0] }, '2026-12-01': { s0: [9, 0] } } })
    expect(pickChances(c, MON).size).toBe(0)
  })
})

describe('weightedChoice', () => {
  afterEach(() => vi.restoreAllMocks())

  it('as likely as its weight says', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(weightedChoice(['a', 'b', 'c'], (x) => (x === 'b' ? 0 : 1))).toBe('c')
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    expect(weightedChoice(['a', 'b'], (x) => (x === 'a' ? 1 : 9))).toBe('b')
  })

  it('no weights at all is an even choice', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    expect(weightedChoice(['a', 'b'], () => 0)).toBe('b')
  })
})
