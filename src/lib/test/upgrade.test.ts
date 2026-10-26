import { describe, expect, it } from 'vitest'
import { GROUP_COLORS } from '../groups'
import { MAX_SEATS } from '../layouts'
import { lineOf } from '../line'
import { pointsModeOf } from '../points'
import { upgradeClass } from '../upgrade'
import type { ClassData } from '../../types'
import { makeClass } from './helpers'

/** A class in today's shape: what a new class looks like once it has been used a little. */
const current = (): ClassData =>
  makeClass(3, { pointsMode: 'goal', goalEnabled: true, pointsGoal: 50, attendance: { '2026-10-05': ['s1'] }, attendanceTaken: ['2026-10-05'] })

describe('a class already in today’s shape', () => {
  it('comes back as the same object, so it is not counted as a change and sent', () => {
    const c = current()
    expect(upgradeClass(c)).toBe(c)
  })

  it('upgrading twice is the same as once', () => {
    const old = makeClass(3, { seating: ['s0', 's1', 's2'], starsPerClassPoint: 5, classPoints: 3, goalRemainder: 2, pointsGoal: 10 })
    const once = upgradeClass(old)
    expect(upgradeClass(once)).toBe(once)
  })
})

describe('desks', () => {
  it('saves of thirty or thirty-five desks get all forty, the rest empty', () => {
    for (const length of [30, 35]) {
      const c = makeClass(3, { seating: ['s0', null, 's2', ...Array(length - 3).fill(null)] })
      const seating = upgradeClass(c).seating
      expect(seating.length).toBe(MAX_SEATS)
      expect(seating.slice(0, 3)).toEqual(['s0', null, 's2'])
      expect(seating.slice(3).every((d) => d === null)).toBe(true)
    }
  })
})

describe('attendance taken', () => {
  it('before the list, every day in the record was a taken day', () => {
    const c = makeClass(3, { attendance: { '2026-10-06': [], '2026-10-05': ['s1'] } })
    expect(upgradeClass(c).attendanceTaken).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('a class with no record gets no list', () => {
    expect(upgradeClass(makeClass(3)).attendanceTaken).toBeUndefined()
  })
})

describe('the Avatars switch', () => {
  it('a whole class given No Avatar has its avatars switched off, and its students free again', () => {
    const c = makeClass(3)
    c.students.forEach((s) => (s.avatarId = 'none'))
    const up = upgradeClass(c)
    expect(up.avatarsOff).toBe(true)
    expect(up.students.every((s) => s.avatarId === undefined)).toBe(true)
  })

  it("one family's No Avatar stays theirs", () => {
    const c = makeClass(3)
    c.students[0].avatarId = 'none'
    expect(upgradeClass(c).students[0].avatarId).toBe('none')
    expect(upgradeClass(c).avatarsOff).toBeUndefined()
  })
})

describe('stars for 1 class point', () => {
  it('a rate above 1 multiplies the goal and the meter, the banked stars added on', () => {
    const up = upgradeClass(makeClass(3, { starsPerClassPoint: 10, goalRemainder: 4, classPoints: 5, pointsGoal: 8 }))
    expect(up).toMatchObject({ pointsGoal: 80, classPoints: 54 })
    expect('starsPerClassPoint' in up || 'goalRemainder' in up).toBe(false)
  })

  it('a rate of 1 just goes', () => {
    const up = upgradeClass(makeClass(3, { starsPerClassPoint: 1, classPoints: 5, pointsGoal: 8 }))
    expect(up).toMatchObject({ pointsGoal: 8, classPoints: 5 })
    expect('starsPerClassPoint' in up).toBe(false)
  })
})

describe('how a class runs points', () => {
  it('from the old Class Goal switch: on is a class goal, off (or no goal) is none', () => {
    expect(upgradeClass(makeClass(1, { pointsGoal: 30 })).pointsMode).toBe('goal')
    expect(upgradeClass(makeClass(1, { pointsGoal: 30, goalEnabled: true })).pointsMode).toBe('goal')
    expect(upgradeClass(makeClass(1, { pointsGoal: 30, goalEnabled: false })).pointsMode).toBe('none')
    expect(upgradeClass(makeClass(1)).pointsMode).toBe('none')
  })

  it('a rate folded in first still counts as a goal', () => {
    expect(pointsModeOf(upgradeClass(makeClass(1, { pointsGoal: 3, starsPerClassPoint: 4 })))).toBe('goal')
  })

  it('a choice already made stays', () => {
    expect(upgradeClass(makeClass(1, { pointsMode: 'students', goalEnabled: false })).pointsMode).toBe('students')
  })
})

describe('group colours', () => {
  it('groups kept in a status colour are coloured afresh by position, Boys and Girls in theirs', () => {
    const c = makeClass(4, {
      groups: [
        { id: 'a', name: 'Group 1', color: '#ef4444', studentIds: ['s0'], points: 2 },
        { id: 'b', name: 'Group 2', color: '#3b82f6', studentIds: ['s1'], points: 0 },
        { id: 'c', name: 'Girls', color: '#f43f5e', studentIds: ['s2'], points: 0 },
      ],
    })
    const groups = upgradeClass(c).groups!
    expect(groups.map((g) => g.color)).toEqual([GROUP_COLORS[0].bg, GROUP_COLORS[1].bg, '#ec4899'])
    expect(groups[0].points).toBe(2)
  })

  it('groups in today’s colours are left alone', () => {
    const c = makeClass(2, { groups: [{ id: 'a', name: 'Group 1', color: GROUP_COLORS[3].bg, studentIds: ['s0'], points: 0 }] })
    expect(upgradeClass(c).groups).toBe(c.groups)
  })
})

describe('the Line before steps', () => {
  it('a Done list becomes all their steps checked', () => {
    const c = makeClass(3, { line: { day: '2026-10-15', now: 's1', waiting: [], done: ['s0'] } })
    const up = upgradeClass(c)
    expect(up.line).toEqual({ day: '2026-10-15', now: 's1', waiting: [], checks: { s0: 99 } })
    expect(lineOf(up, '2026-10-15').checks).toEqual({ s0: 99 })
  })

  it('checks win over a stray Done list', () => {
    const up = upgradeClass(makeClass(3, { line: { day: 'd', now: null, waiting: [], checks: { s1: 1 }, done: ['s0'] } }))
    expect(up.line).toEqual({ day: 'd', now: null, waiting: [], checks: { s1: 1 } })
  })
})
