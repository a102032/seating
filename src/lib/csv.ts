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
  if (['boy', 'b', 'male', 'm'].includes(value)) return 'boy'
  if (['girl', 'g', 'female', 'f'].includes(value)) return 'girl'
  return 'unspecified'
}

/**
 * Parses a roster CSV with columns: Student Name, Homeroom Number, Gender.
 * Tolerates a header row (detected by the first cell not looking like a name
 * followed by data, i.e. containing the word "name").
 */
export function parseRosterCsv(text: string): Omit<Student, 'id'>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  const firstCells = parseCsvLine(lines[0]).map((c) => c.toLowerCase())
  const hasHeader = firstCells.some((c) => c.includes('name') || c.includes('homeroom') || c.includes('gender'))
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines
    .map(parseCsvLine)
    .filter((cells) => cells.some((c) => c.length > 0))
    .map((cells) => ({
      name: cells[0]?.trim() ?? '',
      homeroom: cells[1]?.trim() ?? '',
      gender: normalizeGender(cells[2] ?? ''),
    }))
    .filter((student) => student.name.length > 0)
}

export function studentsToCsv(students: Student[]): string {
  const header = 'Student Name,Homeroom Number,Gender'
  const rows = students.map((s) => `${s.name},${s.homeroom},${s.gender}`)
  return [header, ...rows].join('\n')
}
