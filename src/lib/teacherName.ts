/**
 * Words a teacher puts in front of their name. Taiwanese students call a teacher "Teacher
 * Derek", and plenty of teachers' Google names say so: the first word alone greeted them as
 * "Welcome, Teacher!" and asked "Not Teacher?". Tr is the written short form of Teacher there.
 * Kept apart from lib/firebase.ts, which the splash can't import without loading Firebase.
 */
const TITLES = new Set(['teacher', 'tr', 'tchr', 'mr', 'mrs', 'ms', 'miss', 'mx', 'mister', 'dr', 'prof', 'coach', 'sir', 'madam'])

const isTitle = (word: string) => TITLES.has(word.toLowerCase().replace(/\.$/, ''))

/** What the splash greets: the first word of a Google name, with the next one if the first is a title ("Teacher Derek", "Ms. Amy"). */
export function greetingName(fullName: string | null | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  return words.slice(0, isTitle(words[0]) ? 2 : 1).join(' ')
}

/** The letter in a teacher's circle: the name's, not the title's ("Teacher Derek" is D). */
export function initialOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const word = words.length > 1 && isTitle(words[0]) ? words[1] : (words[0] ?? '')
  return Array.from(word)[0]?.toUpperCase() ?? ''
}
