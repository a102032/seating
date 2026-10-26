import { describe, expect, it } from 'vitest'
import { parsePastedRoster, parseRosterCsv, rosterFromRows } from '../csv'

const amy = { name: 'Amy Lin', homeroom: '401', gender: 'girl' }
const tony = { name: 'Tony Chen', homeroom: '402', gender: 'boy' }

describe('a heading row', () => {
  it('names its columns in any order, and is skipped', () => {
    expect(rosterFromRows([['Boy or Girl', 'Homeroom', 'Name'], ['G', '401', 'Amy Lin'], ['B', '402', 'Tony Chen']])).toEqual([amy, tony])
  })

  it('in Chinese too', () => {
    expect(rosterFromRows([['姓名', '班級', '性別'], ['Amy Lin', '401', '女'], ['Tony Chen', '402', '男']])).toEqual([amy, tony])
  })

  it('a student called Roomie is a student, not a heading', () => {
    expect(rosterFromRows([['Roomie', '401'], ['Classie', '402']]).map((s) => s.name)).toEqual(['Roomie', 'Classie'])
  })

  it("a heading the app doesn't know is still skipped when it looks out of place", () => {
    expect(rosterFromRows([['學生', '座號'], ['Amy Lin', '401'], ['Tony Chen', '402'], ['Ivy Wu', '403']]).map((s) => s.name)).toEqual([
      'Amy Lin',
      'Tony Chen',
      'Ivy Wu',
    ])
  })
})

describe('no heading row', () => {
  it('works the columns out from what is in them, with others beside them', () => {
    const rows = [
      ['401', '1120345678', 'Amy Lin', 'F'],
      ['402', '1120345679', 'Tony Chen', 'M'],
    ]
    expect(rosterFromRows(rows)).toEqual([amy, tony])
  })

  it('names and homerooms alone, either way round; Boy or Girl can wait', () => {
    expect(rosterFromRows([['05', 'Amy'], ['12', 'Tony']])).toEqual([
      { name: 'Amy', homeroom: '05', gender: 'unspecified' },
      { name: 'Tony', homeroom: '12', gender: 'unspecified' },
    ])
  })

  it('Chinese names alone are still names', () => {
    expect(rosterFromRows([['王小明'], ['林美美']]).map((s) => s.name)).toEqual(['王小明', '林美美'])
  })
})

describe('what is skipped', () => {
  it("blank rows, blank names, and the roster sheet's example rows", () => {
    expect(rosterFromRows([['Name', 'Homeroom'], ['Kevin (example)', '1'], ['', '2'], [' ', ' '], ['Amy Lin', '401']])).toEqual([
      { name: 'Amy Lin', homeroom: '401', gender: 'unspecified' },
    ])
    expect(rosterFromRows([])).toEqual([])
    expect(rosterFromRows([['Name', 'Homeroom']])).toEqual([])
  })
})

describe('a CSV file', () => {
  it('quotes, commas inside them, a byte-order mark and Windows line ends', () => {
    const csv = '﻿Name,Homeroom,Gender\r\n"Lin, Amy",401,girl\r\n"Tony ""T"" Chen",402,boy\r\n\r\n'
    expect(parseRosterCsv(csv)).toEqual([
      { name: 'Lin, Amy', homeroom: '401', gender: 'girl' },
      { name: 'Tony "T" Chen', homeroom: '402', gender: 'boy' },
    ])
  })
})

describe('a pasted list', () => {
  it('cells from Excel or a Sheet come with tabs', () => {
    expect(parsePastedRoster('Amy Lin\t401\tGirl\nTony Chen\t402\tBoy\n')).toEqual([amy, tony])
  })

  it("a CSV's text comes with commas", () => {
    expect(parsePastedRoster('Amy Lin,401\nTony Chen,402')).toEqual([
      { name: 'Amy Lin', homeroom: '401', gender: 'unspecified' },
      { name: 'Tony Chen', homeroom: '402', gender: 'unspecified' },
    ])
  })

  it('a plain list is one name a line', () => {
    expect(parsePastedRoster('Amy\n\nTony\r\nIvy').map((s) => s.name)).toEqual(['Amy', 'Tony', 'Ivy'])
  })
})
