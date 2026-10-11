import type { ClassData } from '../types'

/**
 * The guided first setup (2026-10-06, the teacher's call): the first time a teacher makes a
 * class, the app walks them through it, one thing at a time - everything else faded, a bubble
 * pointing at the one thing to do. Each step moves on when the teacher does the thing, or taps
 * Next; Skip ends it. Nothing moves on by itself on a timer.
 *
 * The order follows where things are: the Class tab (name, room), the Students tab (students,
 * avatars, seats - Seat Students closes the window onto the seated class), then the class goal
 * on the Pickers & Points tab, then the board. Room layout comes before the students so they are seated
 * into the right room. Mid-lesson tips (tapping the timer for its controls and the like) are not
 * here: they belong to the tutorial and video the teacher plans.
 */
export type GuideStepId = 'name' | 'layout' | 'students' | 'avatars' | 'seat' | 'goal' | 'ready'

/** Where a step happens: a tab of Class Settings, or the board itself. */
export type GuidePlace = { settings: 'class' | 'students' | 'points' } | 'board'

export interface GuideStep {
  id: GuideStepId
  place: GuidePlace
  /** What the bubble points at, tried in order; none for the last word, which sits in the middle. */
  targets: string[]
  title: string
  text: string
  /** Steps that have nothing to do for this class are passed by. */
  skip?: (cls: ClassData) => boolean
}

const unseated = (cls: ClassData) => {
  const seated = new Set(cls.seating.filter(Boolean))
  return cls.students.filter((s) => !seated.has(s.id)).length
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'name',
    place: { settings: 'class' },
    targets: ['#class-name'],
    title: 'Name your class',
    text: 'Type the name your class goes by, like 4B English.',
  },
  {
    id: 'layout',
    place: { settings: 'class' },
    targets: ['[data-guide="layout"]'],
    title: 'Pick your room',
    text: 'Choose the one that looks like your classroom.',
  },
  {
    id: 'students',
    place: { settings: 'students' },
    targets: ['[data-guide="students-empty"]', '[data-guide="import"]'],
    title: 'Add your students',
    text: 'Copy your list from Excel and paste it, or choose the file.',
  },
  {
    id: 'avatars',
    place: { settings: 'students' },
    targets: ['[data-guide="avatars"]'],
    title: 'Avatars',
    text: 'Leave them on, or turn them off for names only. Later, the children can choose their own with Students Choose.',
  },
  {
    id: 'seat',
    place: { settings: 'students' },
    targets: ['[data-guide="seat"]'],
    title: 'Seat your students',
    text: 'Tap Seat Students to put everyone at a desk. You can swap seats on the board later.',
    skip: (cls) => unseated(cls) === 0,
  },
  {
    id: 'goal',
    place: { settings: 'points' },
    targets: ['[data-guide="goal"]'],
    title: 'Points',
    text: 'A class goal the whole class fills together, stars for each student, or no points. You can change it any time.',
  },
  {
    id: 'ready',
    place: 'board',
    targets: [],
    title: "You're ready!",
    text: 'Tap a desk, then the star to give a point.',
  },
]

/** The step after this one that has something to do for this class, or null at the end. */
export function nextStep(from: GuideStepId | null, cls: ClassData): GuideStepId | null {
  const start = from === null ? 0 : GUIDE_STEPS.findIndex((s) => s.id === from) + 1
  return GUIDE_STEPS.slice(start).find((s) => !s.skip?.(cls))?.id ?? null
}

const STORE_KEY = 'seating-chart-guide-v1'

function readDone(): Record<string, boolean> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** This teacher finished the guide, or skipped it, on this board. */
export function guideDone(uid: string): boolean {
  return readDone()[uid] === true
}

export function rememberGuideDone(uid: string) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...readDone(), [uid]: true }))
  } catch {
    // A board that won't store it may show the guide again; "Skip" is one tap.
  }
}

/**
 * Whether making a class now should start the guide: a teacher setting up their first class.
 * Read from the classes themselves - no class with students yet - so it travels with the account
 * to another computer; and not if they finished or skipped it on this board.
 */
export function shouldGuide(uid: string | undefined, classes: ClassData[]): boolean {
  return Boolean(uid) && !guideDone(uid!) && classes.every((c) => c.students.length === 0)
}
