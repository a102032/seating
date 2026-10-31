import { describe, expect, it } from 'vitest'
import { CAPACITY, RADIUS, WEDGES, seasonOn, spinLanding, wedgesFor, zapCount } from '../marbles'

// The Marble Jar's wheel, every spin a win (DECISIONS, 2026-10-28), with the students' wedges (2026-10-31).
describe('the marble wheel', () => {
  it('is eight equal wedges: four of 5 marbles, rain, popcorn, a Power Marble and a Mega', () => {
    expect(WEDGES).toHaveLength(8)
    for (const w of WEDGES) expect(w.to - w.from).toBe(45)
    expect(WEDGES.map((w) => w.id)).toEqual(['5', 'rain', 'power', '5', 'popcorn', '5', 'mega', '5'])
    expect(WEDGES.filter((w) => w.id === 'power').map((w) => w.tier)).toEqual(['silver'])
    expect(WEDGES.filter((w) => w.id === 'mega').map((w) => w.tier)).toEqual(['gold'])
  })

  it('keeps the Power and the Mega opposite each other', () => {
    const at = (id: string) => WEDGES.findIndex((w) => w.id === id)
    expect(Math.abs(at('mega') - at('power'))).toBe(4)
  })

  it('makes a wedge switched off 5 marbles, so the pace stays', () => {
    const all = wedgesFor({ rain: false, popcorn: false, power: false, mega: false })
    expect(all.map((w) => w.id)).toEqual(Array(8).fill('5'))
    expect(wedgesFor({ popcorn: false }).filter((w) => w.id === '5')).toHaveLength(5)
  })

  it("gives each season its own wedge in one plain wedge's place", () => {
    expect(wedgesFor({}, 'oct').map((w) => w.id)).toEqual(['5', 'rain', 'power', '5', 'popcorn', 'witch', 'mega', '5'])
    expect(wedgesFor({}, 'dec')[5].id).toBe('santa')
    expect(wedgesFor({}, 'lny')[5].id).toBe('envelope')
  })

  it('lands anywhere round the wheel, each wedge as likely as its width', () => {
    const n = WEDGES.map(() => 0)
    for (let i = 0; i < 8000; i++) n[spinLanding().wedge]++
    for (const c of n) expect(c).toBeGreaterThan(800)
  })

  it('has the Power Marble zap 4, 5 or 6 marbles', () => {
    expect([0, 0.34, 0.67, 0.999].map((r) => zapCount(() => r))).toEqual([4, 5, 6, 6])
  })

  it('keeps the Mega the biggest win in what it adds to the jar, and the Mega Mega bigger still', () => {
    const room = (r: number) => r * r
    const power = room(RADIUS.power) + 5 * (room(RADIUS.power) - room(RADIUS.plain))
    expect(room(RADIUS.mega)).toBeGreaterThan(power)
    expect(room(RADIUS.megamega)).toBeGreaterThan(room(RADIUS.mega))
  })

  it('fills a jar in about 10 to 12 spins, each new wedge adding about what 5 marbles do', () => {
    const room = (r: number) => r * r
    const plain = 5
    const power = room(RADIUS.power) + 5 * (room(RADIUS.power) - room(RADIUS.plain))
    // The rain cloud and popcorn were measured in the preview at about 5 and 6 marbles' worth.
    const average = (4 * plain + 5 + 6 + power + room(RADIUS.mega)) / 8
    expect(CAPACITY / average).toBeGreaterThanOrEqual(9.5)
    expect(CAPACITY / average).toBeLessThanOrEqual(12)
  })
})

describe('the seasons', () => {
  it('follow the calendar', () => {
    expect(seasonOn('2026-10-31')).toBe('oct')
    expect(seasonOn('2026-11-15')).toBe('none')
    expect(seasonOn('2026-12-01')).toBe('dec')
    // Lunar New Year 2027 is 6 February: from four weeks before it, and a fortnight after.
    expect(seasonOn('2027-01-08')).toBe('none')
    expect(seasonOn('2027-01-09')).toBe('lny')
    expect(seasonOn('2027-02-20')).toBe('lny')
    expect(seasonOn('2027-02-21')).toBe('none')
    // In 2028 it is 26 January, so December keeps December.
    expect(seasonOn('2027-12-30')).toBe('dec')
    expect(seasonOn('2028-01-01')).toBe('lny')
  })
})
