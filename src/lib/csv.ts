import type { Gender, Student } from '../types'

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function normalizeGender(raw: string): Gender {
  const value = raw.trim().toLowerCase()
  if (['boy', 'b', 'male', 'm', '男'].includes(value)) return 'boy'
  if (['girl', 'g', 'female', 'f', '女'].includes(value)) return 'girl'
  return 'unspecified'
}

type Role = 'name' | 'homeroom' | 'gender'

/**
 * What a heading says its column holds. Matched from the start of the cell, word by word, so a
 * student called Roomie or Classie is a student, not a heading.
 */
function headingRole(cell: string): Role | null {
  const c = cell.toLowerCase().trim()
  if (/^(boy or girl|gender|sex)\b|^性別/.test(c)) return 'gender'
  if (/^(home ?room|class|room)\b|^班/.test(c)) return 'homeroom'
  if (/^((student|english|first|full)\s*)?name\b|^student\b|^姓名|^名字/.test(c)) return 'name'
  return null
}

const isGenderish = (v: string) => normalizeGender(v) !== 'unspecified'
/** A homeroom: short, and starting with a digit - "401", "05", "4-2", "4B". */
const isNumberish = (v: string) => /^\d[\w\-./]{0,7}$/.test(v)

/**
 * Which column holds what, from what is in them, for a list with no heading row - or a heading
 * the app doesn't know, such as a school's own. Names are the column with the most words in
 * English letters (any letters, if none has English ones), homerooms the column that is mostly
 * short numbers, and Boy or Girl the column that is mostly B and G (or boy and girl, M and F, 男
 * and 女).
 */
function guessColumns(rows: string[][], known: Partial<Record<Role, number>>): Partial<Record<Role, number>> {
  const width = Math.max(...rows.map((r) => r.length))
  const taken = new Set(Object.values(known))
  const columns = Array.from({ length: width }, (_, col) => {
    const cells = rows.map((r) => (r[col] ?? '').trim()).filter(Boolean)
    const words = cells.filter((v) => !isGenderish(v))
    return {
      col,
      filled: cells.length,
      latin: words.filter((v) => /[A-Za-z]/.test(v) && !isNumberish(v)).length,
      letters: words.filter((v) => /\p{L}/u.test(v) && !isNumberish(v)).length,
      numbers: cells.filter(isNumberish).length,
      genders: cells.filter(isGenderish).length,
    }
  })
  const free = () => columns.filter((c) => !taken.has(c.col) && c.filled > 0)
  const best = (pick: (c: (typeof columns)[number]) => number) => free().sort((a, b) => pick(b) - pick(a) || a.col - b.col)[0]
  const roles = { ...known }

  if (roles.name === undefined) {
    const byLatin = best((c) => c.latin)
    const byLetters = best((c) => c.letters)
    const name = byLatin && byLatin.latin > 0 ? byLatin : byLetters && byLetters.letters > 0 ? byLetters : undefined
    if (name) {
      roles.name = name.col
      taken.add(name.col)
    }
  }
  if (roles.gender === undefined) {
    const gender = best((c) => c.genders / c.filled)
    if (gender && gender.genders / gender.filled >= 0.6) {
      roles.gender = gender.col
      taken.add(gender.col)
    }
  }
  if (roles.homeroom === undefined) {
    const homeroom = best((c) => c.numbers / c.filled)
    if (homeroom && homeroom.numbers / homeroom.filled >= 0.6) roles.homeroom = homeroom.col
  }
  return roles
}

/**
 * Students from rows of cells: a CSV or Excel file, a Google Sheet, or a list pasted from any of
 * them. A heading row is used when it names its columns (Name, Homeroom, Boy or Girl, in any
 * order, in English or Chinese) and skipped either way; columns it doesn't name are worked out
 * from what is in them, so a teacher can copy just the two columns they need - names and
 * homerooms, in either order - from the school's own roster. The roster sheet's example rows,
 * which say "(example)" until they are typed over, are skipped.
 */
export function rosterFromRows(rows: string[][]): Omit<Student, 'id'>[] {
  let lines = rows.map((r) => r.map((c) => (c ?? '').trim())).filter((cells) => cells.some(Boolean))
  if (lines.length === 0) return []

  const heading = lines[0].map(headingRole)
  const named: Partial<Record<Role, number>> = {}
  heading.forEach((role, col) => {
    if (role && named[role] === undefined) named[role] = col
  })
  const hasHeading = Object.keys(named).length > 0
  if (hasHeading) lines = lines.slice(1)
  if (lines.length === 0) return []

  const roles = guessColumns(lines, named)
  // A heading the app couldn't read (a school's own words) still looks out of place in its
  // columns: a homeroom cell that isn't a number, or a Boy or Girl cell that isn't one.
  if (!hasHeading && lines.length > 1) {
    const [first, ...rest] = lines
    const odd = (role: Role, test: (v: string) => boolean) => {
      const col = roles[role]
      return col !== undefined && !test(first[col] ?? '') && rest.filter((r) => test(r[col] ?? '')).length >= rest.length * 0.6
    }
    if (odd('homeroom', isNumberish) || odd('gender', isGenderish)) lines = rest
  }

  const cell = (cells: string[], role: Role) => (roles[role] === undefined ? '' : (cells[roles[role]] ?? ''))
  return lines
    .map((cells) => ({
      name: cell(cells, 'name'),
      homeroom: cell(cells, 'homeroom'),
      gender: normalizeGender(cell(cells, 'gender')),
    }))
    .filter((student) => student.name.length > 0 && !/\(example\)/i.test(student.name))
}

/** A roster CSV: names and homerooms, and Boy or Girl if it has them, in any order. */
export function parseRosterCsv(text: string): Omit<Student, 'id'>[] {
  return rosterFromRows(
    text
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map(parseCsvLine),
  )
}

/**
 * A list pasted in: cells copied from Excel or a Google Sheet arrive with a tab between them, a
 * CSV's lines with commas, and a plain list of names one to a line.
 */
export function parsePastedRoster(text: string): Omit<Student, 'id'>[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  if (lines.some((line) => line.includes('\t'))) return rosterFromRows(lines.map((line) => line.split('\t')))
  if (lines.some((line) => line.includes(','))) return rosterFromRows(lines.map(parseCsvLine))
  return rosterFromRows(lines.map((line) => [line]))
}
