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
 * Students from rows of cells - Name, Homeroom Number, Gender - from a CSV file or a Google
 * Sheet. Tolerates a header row (any first cell row mentioning a name, homeroom or gender), and
 * skips the roster sheet's example rows, which say "(example)" until they are typed over.
 */
export function rosterFromRows(rows: string[][]): Omit<Student, 'id'>[] {
  const lines = rows.filter((cells) => cells.some((c) => c?.trim()))
  if (lines.length === 0) return []
  const first = lines[0].map((c) => (c ?? '').toLowerCase())
  const hasHeader = first.some((c) => c.includes('name') || c.includes('homeroom') || c.includes('gender') || c.includes('boy or girl'))
  return (hasHeader ? lines.slice(1) : lines)
    .map((cells) => ({
      name: cells[0]?.trim() ?? '',
      homeroom: cells[1]?.trim() ?? '',
      gender: normalizeGender(cells[2] ?? ''),
    }))
    .filter((student) => student.name.length > 0 && !/\(example\)/i.test(student.name))
}

/** A roster CSV with columns: Student Name, Homeroom Number, Gender. */
export function parseRosterCsv(text: string): Omit<Student, 'id'>[] {
  return rosterFromRows(
    text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map(parseCsvLine),
  )
}
