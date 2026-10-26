import type { SettingsSection } from '../components/ClassSettingsModal'
import type { ClassData } from '../types'
import { adventureOf } from './marbles'
import { hasClassGoal, pointsModeOf } from './points'

/**
 * The guide through Class Settings (2026-10-11, the teacher: tell the teacher what to do one thing
 * at a time, everything else faded and closed to taps until Next or Skip). It runs two ways:
 * Help's "Guide me through this section" walks the section that is open and finishes there; a new
 * class walks the whole setup, Class to Points, and ends by offering the tour. Next and Skip both
 * move on - Next because it's done, Skip to leave it as it is - and Back goes to the step before
 * (2026-10-12, the teacher: a step read too fast had no way back). Nothing moves on by itself.
 */
export type GuideScope = 'all' | SettingsSection

export interface GuideContext {
  cls: ClassData
  signedIn: boolean
  /** Whether something is on the screen now: the Import menu, the Add a Student row. */
  showing: (selector: string) => boolean
}

export interface GuideStep {
  /** The section it happens in, or null for the last word of a new class's walk. */
  section: SettingsSection | null
  /** What is lit: everything here that is on the screen, together. */
  targets: string[]
  text: string | ((ctx: GuideContext) => string)
  /** A step that doesn't apply to this class is passed by (nothing to seat before the list is in). */
  when?: (ctx: GuideContext) => boolean
  /** Counted in "2 of 5" while still ahead, as it may yet apply (it depends on a choice before it). */
  maybe?: boolean
  /** Only in a new class's whole walk, or only when guiding the one section. */
  only?: 'all' | 'section'
  /** The box that gets the cursor as the step begins. */
  focus?: string
}

const g = (name: string) => `[data-guide="${name}"]`
const hasStudents = ({ cls }: GuideContext) => cls.students.length > 0
const goal = ({ cls }: GuideContext) => hasClassGoal(pointsModeOf(cls))
const plainGoal = ({ cls }: GuideContext) => pointsModeOf(cls) === 'goal'
const quest = ({ cls }: GuideContext) => pointsModeOf(cls) === 'quest'
const knight = (c: GuideContext) => quest(c) && adventureOf(c.cls) === 'knight'
const marbles = (c: GuideContext) => quest(c) && adventureOf(c.cls) === 'marbles'
const pirate = (c: GuideContext) => quest(c) && adventureOf(c.cls) === 'pirate'
const space = (c: GuideContext) => quest(c) && adventureOf(c.cls) === 'space'
const avatarsShown = ({ cls }: GuideContext) => !cls.avatarsOff && cls.students.length > 0
const photosShown = ({ cls }: GuideContext) => cls.photosOn === true && !cls.avatarsOff && cls.students.length > 0
const charactersShown = ({ cls }: GuideContext) => !cls.avatarsOff && !cls.photosOn && cls.students.length > 0

export const GUIDE_STEPS: GuideStep[] = [
  { section: 'class', targets: [g('class-name')], text: 'Type the name of your class.', focus: '#class-name' },
  { section: 'class', targets: [g('class-room')], text: 'Type the number of the classroom it meets in.', focus: '#class-room' },
  { section: 'class', targets: [g('layouts')], text: 'Tap the desk layout that matches your room.' },
  { section: 'class', targets: [g('homerooms')], text: 'Classroom numbers on every desk? Turn this on, or leave it off.' },
  { section: 'class', targets: [g('theme')], text: 'Pick a color theme for this class.' },
  {
    section: 'class',
    targets: [g('delete')],
    text: 'Delete Class removes this class and everything in it. It asks first.',
    only: 'section',
  },
  {
    section: 'class',
    targets: [g('new-class')],
    text: 'New Class, at the bottom of this list, makes another class and walks you through it.',
    only: 'section',
  },

  {
    section: 'students',
    targets: [g('roster')],
    text: ({ cls }) =>
      cls.students.length
        ? 'This is your class list. Tap a pencil to fix a name or a homeroom number.'
        : 'Paste your student list from Excel, or choose the file.',
  },
  {
    section: 'students',
    targets: [g('import'), g('import-menu')],
    text: ({ showing }) =>
      showing(g('import-menu'))
        ? 'Pick where your list comes from. Each choice says where the names are.'
        : 'Import Student List brings in a whole class at once. Tap it to see the ways.',
  },
  {
    section: 'students',
    targets: [g('add'), g('add-row')],
    text: ({ showing }) =>
      showing(g('add-row'))
        ? 'Type the name and homeroom number, pick Boy or Girl, then tap Add.'
        : 'Add a Student is for one student at a time, like a new student who joins later.',
  },
  {
    section: 'students',
    targets: [g('seat')],
    text: ({ cls }) => {
      const seated = new Set(cls.seating.filter(Boolean))
      if (cls.students.some((s) => !seated.has(s.id))) return 'Tap Seat Students to give everyone a desk.'
      return cls.students.length
        ? 'Everyone has a desk, so Seat Students is greyed. It gives anyone new an empty desk.'
        : 'Seat Students gives every student an empty desk, once the list is in.'
    },
  },
  { section: 'students', targets: [g('mixup')], text: 'Mix Up Seats gives everyone a new, random seat.' },
  { section: 'students', targets: [g('unseat')], text: 'Unseat All takes everyone out of their seat, to start the seating plan again.' },
  {
    section: 'students',
    targets: [g('remove-all')],
    text: 'Remove All empties the class list, if the wrong list went in. It asks first.',
    only: 'section',
    when: hasStudents,
  },

  {
    section: 'avatars',
    targets: [g('desk-pictures')],
    text: ({ signedIn }) =>
      signedIn
        ? 'Choose what the desks show: characters, photos, or names only.'
        : 'Choose what the desks show: characters, or names only.',
  },
  {
    section: 'avatars',
    targets: [g('add-photos')],
    text: "Tap Add Photos and choose the class's photos. The app finds each face, then asks who it is.",
    when: photosShown,
    maybe: true,
  },
  {
    section: 'avatars',
    targets: [g('give-character')],
    text: ({ cls }) =>
      cls.photosOn
        ? 'Students with no photo show a character. Tap one to give it to the class, or Skip.'
        : 'Tap a character to give it to the whole class. Or Skip to keep them all different.',
    when: avatarsShown,
    maybe: true,
  },
  {
    section: 'avatars',
    targets: [g('let-choose')],
    text: 'Later, tap Let Students Choose and the children pick their own at the board. Slide the hand at the top of their window to move it lower.',
    when: charactersShown,
    maybe: true,
  },

  { section: 'points', targets: [g('points-choice')], text: 'Choose how your class earns stars.' },
  {
    section: 'points',
    targets: [g('stars-row')],
    text: 'Do stars go straight to the goal, or wait on the desks first?',
    when: goal,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('goal-row')],
    text: 'How many stars fill the chest? Type it, or use − and +.',
    when: plainGoal,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('adventure-row')],
    text: 'Pick an adventure: the Knight, with keys and five chests; the Marble Jar, with a wheel that fills the class jar; the Pirate Quest, sailing to five islands; or the Space Quest, a rocket fuelled to fly to five planets.',
    when: quest,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('goal-row')],
    text: 'How many stars win a key? About a key a week makes a quest last a semester.',
    when: knight,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('goal-row')],
    text: 'How many stars win a spin of the marble wheel? About a spin a week fills a jar in a semester.',
    when: marbles,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('goal-row')],
    text: 'How many stars win a map piece? A quest is 20 pieces, so about one a week takes a semester.',
    when: pirate,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('goal-row')],
    text: 'How many stars pour 2 bars of fuel into the rocket? A quest is 18 goals, so about one a week takes a semester.',
    when: space,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('celebration-row')],
    text: 'Pick a celebration for when the class fills the chest.',
    when: plainGoal,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('prizes-row')],
    text: 'The prizes on the prize wheel, small, medium and big, and the GIF that dances beside a prize.',
    when: quest,
    maybe: true,
  },
  {
    section: 'points',
    targets: [g('meter-row')],
    text: 'If a star was given by mistake, fix the number here, or tap Empty to start the meter again.',
    only: 'section',
    when: goal,
  },
  {
    section: 'points',
    targets: [g('quest-row')],
    text: 'Where the class is on its quest, and how long the last key took. Start Over goes back to the Wood chest.',
    only: 'section',
    when: knight,
  },
  {
    section: 'points',
    targets: [g('quest-row')],
    text: 'How full the jar is, and how long the last spin took. Start Over empties the jar.',
    only: 'section',
    when: marbles,
  },
  {
    section: 'points',
    targets: [g('quest-row')],
    text: 'The island the class is sailing to, its map pieces, and how long the last piece took. Start Over sails back to the first island.',
    only: 'section',
    when: pirate,
  },
  {
    section: 'points',
    targets: [g('quest-row')],
    text: 'The trip the rocket is fuelling for, its bars of fuel, and how long the last 2 bars took. Start Over flies back to Earth.',
    only: 'section',
    when: space,
  },
  {
    section: 'points',
    targets: [g('clear-stars')],
    text: 'Clear All Stars puts every student back to 0, at the end of a week or a term.',
    when: ({ cls }) => pointsModeOf(cls) === 'students',
    maybe: true,
  },

  {
    section: 'tools',
    targets: [g('repeats')],
    text: 'Off: everyone has a turn before anyone is picked twice. On: anyone can be picked again.',
  },
  { section: 'tools', targets: [g('picker-sound')], text: 'Turn the picker’s sound on or off.' },
  { section: 'tools', targets: [g('new-round')], text: 'Start a New Round lets everyone be picked again.' },
  {
    section: 'tools',
    targets: [g('prize')],
    text: 'Choose how many stars a full Get ready! star is worth.',
    when: ({ cls }) => pointsModeOf(cls) !== 'none',
  },
  {
    section: 'tools',
    targets: [g('gifts')],
    text: 'Hide three surprise cards in the flip cards, worth 2 to 5 extra stars.',
    when: ({ cls }) => pointsModeOf(cls) !== 'none',
  },
  { section: 'tools', targets: [g('backs')], text: 'Blue backs for boys and pink for girls, so you can say “pick a blue card”.' },
  { section: 'tools', targets: [g('card-sounds')], text: 'Turn the flip cards’ sounds on or off.' },
  {
    section: 'tools',
    targets: [g('chimes')],
    text: 'A chime when a group taps Help, Ready or Done, so you hear it with your back to the board.',
  },

  { section: 'attendance', targets: ['.cs-list'], text: 'Add students first, in Students.', when: (ctx) => !hasStudents(ctx) },
  { section: 'attendance', targets: [g('month-nav')], text: 'Tap the arrows to see another month.', when: hasStudents },
  {
    section: 'attendance',
    targets: [g('att-grid')],
    text: 'Tap a circle to mark a student away. Tap it again to mark them present.',
    when: hasStudents,
  },
  {
    section: 'attendance',
    targets: [g('att-drive')],
    text: 'Update in Drive keeps a Google Sheet of this class’s attendance up to date.',
    when: (ctx) => hasStudents(ctx) && ctx.signedIn,
  },
  { section: 'attendance', targets: [g('att-export')], text: 'Export saves the attendance as a file for Excel.', when: hasStudents },

  { section: 'participation', targets: ['.cs-list'], text: 'Add students first, in Students.', when: (ctx) => !hasStudents(ctx) },
  { section: 'participation', targets: [g('day-nav')], text: 'Tap the arrows to see another day.', when: hasStudents },
  {
    section: 'participation',
    targets: [g('part-grid')],
    text: 'Students with no picks or points that day are yellow and listed first, so you know who to call on next. Tap a student to fix their numbers.',
    when: hasStudents,
  },
  {
    section: 'participation',
    targets: [g('part-drive')],
    text: 'Update in Drive keeps a Google Sheet of who had a turn up to date.',
    when: (ctx) => hasStudents(ctx) && ctx.signedIn,
  },
  {
    section: 'participation',
    targets: [g('part-export')],
    text: 'Export saves the whole record as a file for Excel.',
    when: hasStudents,
  },
  {
    section: 'participation',
    targets: [g('clear-day')],
    text: 'Clear This Day takes the day out of the record, like after a test lesson.',
    when: hasStudents,
  },
  {
    section: 'participation',
    targets: [g('start-over')],
    text: 'Start Over clears the whole record, at the start of a term.',
    when: hasStudents,
  },

  {
    section: 'google',
    targets: [g('account')],
    text: ({ signedIn }) =>
      signedIn
        ? 'Your Google account. Your classes are saved to it. Switch Teacher lets another teacher use this board.'
        : 'Sign in with Google to keep your classes safe and save to Drive.',
  },
  {
    section: 'google',
    targets: [g('chart')],
    text: 'Save the seating chart as a picture to print, for a substitute or the classroom door, or save it to Drive.',
  },
  {
    section: 'google',
    targets: [g('drive')],
    text: 'Everything the app saves to Drive goes in one folder. Find My Folder opens it.',
    when: ({ signedIn }) => signedIn,
  },

  { section: null, targets: [g('done')], text: 'You’re all set! Want a tour of the app?', only: 'all' },
]

const SETUP: SettingsSection[] = ['class', 'students', 'avatars', 'points']

export function inScope(step: GuideStep, scope: GuideScope): boolean {
  if (scope === 'all') return step.only !== 'section' && (step.section === null || SETUP.includes(step.section))
  return step.section === scope && step.only !== 'all'
}

const holds = (step: GuideStep, ctx: GuideContext) => !step.when || step.when(ctx)

/** The step at or after `from` that applies now, or null past the end. */
export function stepFrom(from: number, scope: GuideScope, ctx: GuideContext): number | null {
  for (let i = from; i < GUIDE_STEPS.length; i++) if (inScope(GUIDE_STEPS[i], scope) && holds(GUIDE_STEPS[i], ctx)) return i
  return null
}

/** The step before `from` that applies now, or null at the start: where Back goes. */
export function stepBefore(from: number, scope: GuideScope, ctx: GuideContext): number | null {
  for (let i = from - 1; i >= 0; i--) if (inScope(GUIDE_STEPS[i], scope) && holds(GUIDE_STEPS[i], ctx)) return i
  return null
}

/** "Students · 2 of 6": where this step is in its section, counting the steps that may still come. */
export function stepPlace(index: number, scope: GuideScope, ctx: GuideContext): { label: string | null; finish: boolean } {
  const step = GUIDE_STEPS[index]
  const counts = (s: GuideStep, i: number) =>
    inScope(s, scope) && (i === index || holds(s, ctx) || (s.maybe === true && i > index && s.section !== step.section))
  const finish = !GUIDE_STEPS.some((s, i) => i > index && counts(s, i))
  if (step.section === null) return { label: null, finish }
  const mine = GUIDE_STEPS.map((s, i) => [s, i] as const).filter(([s, i]) => s.section === step.section && counts(s, i))
  return { label: `${mine.findIndex(([, i]) => i === index) + 1} of ${mine.length}`, finish }
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
    // A board that won't store it may show the guide again; "Stop guide" is one tap.
  }
}

/**
 * Whether a brand-new teacher's first sign-in should start the guide: no class with students yet
 * (read from the classes themselves, so it travels with the account), and not finished or stopped
 * on this board.
 */
export function shouldGuide(uid: string | undefined, classes: ClassData[]): boolean {
  return Boolean(uid) && !guideDone(uid!) && classes.every((c) => c.students.length === 0)
}
