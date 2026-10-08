import { planFor } from '../lib/layouts'
import type { ClassData, Student } from '../types'

/**
 * The layout mock-ups (2026-10-08): the same app with its controls arranged three ways, so the
 * teacher can try each on the board before one is built properly. Only a build made with
 * VITE_MOCKUP=1 has them (the preview page); the live app never sees any of this.
 */
export const MOCKUP = import.meta.env.VITE_MOCKUP === '1'

/**
 * today: the side panel as it is.
 * rail: the teacher's idea - a narrow rail of the board's modes, and a frame for the clock and points.
 * shelf: every control in one shelf under the goal meter, the clock in the top corner, desks full width.
 */
export type MockLayout = 'today' | 'rail' | 'shelf'

const LAYOUT_KEY = 'seating-chart-mockup-layout-v1'
const LINE_KEY = 'seating-chart-mockup-reach-line-v1'

export function loadMockLayout(): MockLayout {
  try {
    const v = localStorage.getItem(LAYOUT_KEY)
    return v === 'rail' || v === 'shelf' ? v : 'today'
  } catch {
    return 'today'
  }
}

export function saveMockLayout(layout: MockLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, layout)
  } catch {
    // A preview with no storage just forgets the choice on reload.
  }
}

export function loadReachLine(): boolean {
  try {
    return localStorage.getItem(LINE_KEY) !== '0'
  } catch {
    return true
  }
}

export function saveReachLine(on: boolean) {
  try {
    localStorage.setItem(LINE_KEY, on ? '1' : '0')
  } catch {
    // As above.
  }
}

/** A class of 28 with two students called Amy, as a real class has, seated as Seat Class would. */
function exampleClass(id: string, name: string, names: string[], points: number): ClassData {
  const students: Student[] = names.map((n, i) => ({
    id: `${id}-s${i}`,
    name: n,
    homeroom: String(3 + ((i * 7) % 28)),
    gender: i % 2 ? 'boy' : 'girl',
  }))
  const cls: ClassData = {
    id,
    name,
    students,
    seating: Array(40).fill(null),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    pointsGoal: 50,
    classPoints: points,
    goalEnabled: true,
  }
  const order = planFor(cls).fillOrder
  students.forEach((s, i) => (cls.seating[order[i]] = s.id))
  return cls
}

/**
 * The preview opens on an example class, as if a teacher were signed in, so the splash offers it
 * straight away. Only when the preview has nothing of its own yet: a class changed while trying it
 * stays changed on that browser.
 */
export function seedMockup() {
  try {
    if (localStorage.getItem('seating-chart-state-v1')) return
    const four = exampleClass(
      'mock-4b',
      '4B English',
      'Amy,Ben,Chloe,Daniel,Emma,Felix,Grace,Henry,Ivy,Jack,Kevin,Lily,Mia,Noah,Olivia,Peter,Queenie,Ryan,Sophie,Tom,Una,Victor,Wendy,Xavier,Yuki,Zoe,Mulan,Amy'.split(
        ',',
      ),
      30,
    )
    const two = exampleClass(
      'mock-2a',
      '2A Phonics',
      'Andy,Bella,Cindy,Doris,Eric,Fiona,Gary,Hannah,Ian,Judy,Kelly,Louis,Mandy,Nick,Oscar,Penny,Rita,Sam,Tina,Vicky,Will,Yoyo'.split(','),
      12,
    )
    localStorage.setItem('seating-chart-state-v1', JSON.stringify({ classes: [four, two], activeClassId: four.id }))
    localStorage.setItem(
      'seating-chart-account-v1',
      JSON.stringify({ uid: 'mockup-teacher', firstName: 'Derek', email: 'teacher@example.com', dirty: [], deleted: [] }),
    )
  } catch {
    // No storage: the app starts as a fresh board would.
  }
}
