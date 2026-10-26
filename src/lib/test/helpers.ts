import type { ClassData, Student } from '../../types'

/** A class of `count` students seated at desks 0, 1, 2..., as the walkthrough seeds one. */
export function makeClass(count: number, extra: Partial<ClassData> = {}): ClassData {
  const students: Student[] = Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    name: `Student ${i}`,
    homeroom: String(i + 1),
    gender: i % 2 ? 'boy' : 'girl',
  }))
  const seating: (string | null)[] = Array(40).fill(null)
  students.forEach((s, i) => (seating[i] = s.id))
  return { id: 'c1', name: 'Test Class', students, seating, updatedAt: '2026-10-01T00:00:00.000Z', ...extra }
}

/** The same random numbers every run, so a failure can be run again. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
