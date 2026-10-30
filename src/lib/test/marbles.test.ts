import { describe, expect, it } from 'vitest'
import { CAPACITY, RADIUS, WEDGES, marblesFor, spinLanding, zapCount } from '../marbles'

// The Marble Jar's wheel, every spin a win (DECISIONS, 2026-10-28).
describe('the marble wheel', () => {
  it('is eight equal wedges: six of 5 marbles, one Power Marble, one Mega', () => {
    expect(WEDGES).toHaveLength(8)
    for (const w of WEDGES) expect(w.to - w.from).toBe(45)
    expect(WEDGES.filter((w) => w.id === '5')).toHaveLength(6)
    expect(WEDGES.filter((w) => w.id === 'power').map((w) => w.tier)).toEqual(['silver'])
    expect(WEDGES.filter((w) => w.id === 'mega').map((w) => w.tier)).toEqual(['gold'])
  })

  it('never lands on fewer than 5 marbles', () => {
    for (let i = 0; i < 1000; i++) {
      const { wedge } = spinLanding()
      const id = WEDGES[wedge].id
      expect(id === 'power' || id === 'mega' || marblesFor(id).length === 5).toBe(true)
    }
  })

  it('has the Power Marble zap 4, 5 or 6 marbles', () => {
    expect([0, 0.34, 0.67, 0.999].map((r) => zapCount(() => r))).toEqual([4, 5, 6, 6])
  })

  it('keeps the Mega the biggest win in what it adds to the jar', () => {
    const room = (r: number) => r * r
    const power = room(RADIUS.power) + 5 * (room(RADIUS.power) - room(RADIUS.plain))
    expect(room(RADIUS.mega)).toBeGreaterThan(power)
    expect(room(RADIUS.mega)).toBeGreaterThan(5)
  })

  it('fills a jar in about 10 to 12 spins', () => {
    const room = (r: number) => r * r
    const plain = 5
    const power = room(RADIUS.power) + 5 * (room(RADIUS.power) - room(RADIUS.plain))
    const average = (6 * plain + power + room(RADIUS.mega)) / 8
    expect(CAPACITY / average).toBeGreaterThanOrEqual(9.5)
    expect(CAPACITY / average).toBeLessThanOrEqual(12)
  })
})
