import type { Student } from '../types'

/** "Amy", " amy " and "AMY" are the same name read from the back of the room. */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * The students whose homeroom number shows beside their name on the board: the ones who share
 * a name with someone else in the class. That is the number's job - telling two Amys apart -
 * so a class with no shared names shows none, and a lone number in a desk's corner can't be
 * read as a score. The teacher fills in every homeroom in the roster; the app decides where it
 * is needed. Counted over the whole roster, not just who is seated, so a desk doesn't change
 * when another student is unseated or away. A class can switch on `everyone`
 * (showAllHomerooms) to see every number, as the board did before.
 */
export function homeroomsToShow(students: Iterable<Student>, everyone = false): Set<string> {
  if (everyone) return new Set(Array.from(students, (s) => (s.homeroom.trim() ? s.id : '')).filter(Boolean))
  const byName = new Map<string, Student[]>()
  for (const s of students) {
    const key = nameKey(s.name)
    if (!key) continue
    byName.set(key, [...(byName.get(key) ?? []), s])
  }
  const show = new Set<string>()
  for (const group of byName.values()) {
    if (group.length < 2) continue
    for (const s of group) if (s.homeroom.trim()) show.add(s.id)
  }
  return show
}
