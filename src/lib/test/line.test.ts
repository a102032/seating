import { describe, expect, it } from 'vitest'
import {
  checkedOf,
  clearLine,
  cycleSteps,
  doneInLine,
  joinLine,
  leaveLine,
  lineCount,
  lineIsFresh,
  lineMarksOf,
  lineOf,
  placesInLine,
  skipInLine,
  stepNamesOf,
  stepsOf,
  type ClassLine,
} from '../line'
import { makeClass } from './helpers'

const DAY = '2026-10-15'
const empty: ClassLine = { day: DAY, now: null, waiting: [], checks: {} }
const queue = (...ids: string[]) => ids.reduce(joinLine, empty)

describe('joining and leaving', () => {
  it('into an empty line goes straight to the teacher, then to the back; joining twice changes nothing', () => {
    const line = queue('a', 'b', 'c', 'b')
    expect(line.now).toBe('a')
    expect(line.waiting).toEqual(['b', 'c'])
    expect(lineCount(line)).toBe(3)
  })

  it('the one with the teacher is 1 and the next is 2', () => {
    expect([...placesInLine(queue('a', 'b', 'c'))]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
  })

  it('Done checks a step and calls the next; never past the last step', () => {
    let line = doneInLine(queue('a', 'b'), 2)
    expect(line).toMatchObject({ now: 'b', waiting: [], checks: { a: 1 } })
    line = doneInLine(joinLine(doneInLine(joinLine(line, 'a'), 2), 'a'), 2)
    expect(checkedOf(line, 'a', 2)).toBe(2)
    expect(doneInLine(empty, 2)).toBe(empty)
  })

  it('Skip sends them to the back; alone in line, nothing changes', () => {
    expect(skipInLine(queue('a', 'b', 'c'))).toMatchObject({ now: 'b', waiting: ['c', 'a'] })
    const alone = queue('a')
    expect(skipInLine(alone)).toBe(alone)
  })

  it('Get out: the one with the teacher calls the next; anyone else just leaves', () => {
    expect(leaveLine(queue('a', 'b', 'c'), 'a')).toMatchObject({ now: 'b', waiting: ['c'] })
    expect(leaveLine(queue('a', 'b', 'c'), 'b')).toMatchObject({ now: 'a', waiting: ['c'] })
  })

  it('Clear Line empties it and takes the checks off', () => {
    const cleared = clearLine({ ...queue('a', 'b'), checks: { c: 2 } })
    expect(cleared).toEqual(empty)
    expect(lineIsFresh(cleared)).toBe(true)
    expect(lineIsFresh({ ...empty, checks: { a: 1 } })).toBe(false)
  })

  it('Change Steps goes through Done and back to none', () => {
    let line = empty
    const seen = []
    for (let i = 0; i < 4; i++) {
      line = cycleSteps(line, 'a', 3)
      seen.push(checkedOf(line, 'a', 3))
    }
    expect(seen).toEqual([1, 2, 3, 0])
  })
})

describe('lineOf: the class line today', () => {
  it('a new day starts empty, but a saved line keeps its steps', () => {
    const cls = makeClass(3, {
      line: { day: '2026-10-14', now: 's0', waiting: ['s1'], checks: { s2: 1 } },
      savedLines: [{ id: 'w', name: 'Writing', steps: ['Plan', 'Draft'], checks: { s1: 1, gone: 2, s2: 0 } }],
      lineSavedAs: 'w',
    })
    expect(lineOf(cls, DAY)).toEqual({ day: DAY, now: null, waiting: [], checks: { s1: 1 } })
    expect(lineOf({ ...cls, lineSavedAs: undefined }, DAY)).toEqual(empty)
    expect(lineOf(undefined, DAY)).toEqual(empty)
  })

  it('someone who left the class is out of line, and the next one is called', () => {
    const cls = makeClass(3, { line: { day: DAY, now: 'gone', waiting: ['s1', 'also-gone', 's2'], checks: { gone: 1, s2: 1 } } })
    expect(lineOf(cls, DAY)).toEqual({ day: DAY, now: 's1', waiting: ['s2'], checks: { s2: 1 } })
  })

  it('a line saved before steps had a Done list: all their steps checked', () => {
    const cls = makeClass(2, { line: { day: DAY, now: null, waiting: [], done: ['s0'] } })
    expect(checkedOf(lineOf(cls, DAY), 's0', 5)).toBe(5)
  })

  it('steps: the saved line, else How many steps?, held to 1 to 6', () => {
    expect(stepsOf(makeClass(1))).toBe(1)
    expect(stepsOf(makeClass(1, { lineSteps: 9 }))).toBe(6)
    const saved = makeClass(1, { lineSteps: 2, savedLines: [{ id: 'w', name: 'W', steps: ['A', ' B ', ''] }], lineSavedAs: 'w' })
    expect(stepsOf(saved)).toBe(3)
    expect(stepNamesOf(saved)).toEqual(['A', 'B', ''])
  })
})

describe('lineMarksOf: what each desk shows', () => {
  it('a quick line: places in line, and dots once a step is checked', () => {
    const line = { ...queue('a', 'b'), checks: { b: 1, c: 1, d: 3 } }
    const marks = lineMarksOf(line, 3, ['a', 'b', 'c', 'd', 'e'], false)
    expect(marks.get('a')).toEqual({ place: 1, now: true })
    expect(marks.get('b')).toEqual({ place: 2, now: false, steps: { checked: 1, of: 3, step: '' } })
    expect(marks.get('c')).toEqual({ checked: 1, of: 3, step: '' })
    expect(marks.get('d')).toBe('done')
    expect(marks.has('e')).toBe(false)
  })

  it('named steps show every seated student, the step they are on named', () => {
    const marks = lineMarksOf(empty, 2, ['a', 'b'], false, ['Plan', 'Draft'])
    expect(marks.get('a')).toEqual({ checked: 0, of: 2, step: 'Plan' })
  })

  it('Change Steps shows everyone and no places', () => {
    const marks = lineMarksOf(queue('a'), 2, ['a', 'b'], true)
    expect(marks.get('a')).toEqual({ checked: 0, of: 2, step: '' })
    expect(marks.get('b')).toEqual({ checked: 0, of: 2, step: '' })
  })

  it('one step: Done or nothing', () => {
    const marks = lineMarksOf({ ...empty, checks: { a: 1 } }, 1, ['a', 'b'], true)
    expect(marks.get('a')).toBe('done')
    expect(marks.has('b')).toBe(false)
  })
})
