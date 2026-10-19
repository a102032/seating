import RECTS from './tourRects.json'

/**
 * The tour of the app (2026-10-11, the teacher: in Class Settings, not always on screen; a tour of
 * every screen that pauses between screens to say what comes next and asks whether to go on).
 * Seven parts, one per screen. Each stop lights one thing in a picture of that screen, taken in the
 * real app at the teacher's board size (1280x559) by scripts/tour-shots.mjs, which also records
 * where each thing is (tourRects.json). It only shows: nothing is picked, no stars are given, no
 * sound plays, and the board underneath is left as it was. Take the pictures again whenever one
 * of these screens changes.
 */
export type TourShot = 'board' | 'flip' | 'chooser' | 'who' | 'builder' | 'groups' | 'line' | 'timer' | 'howlong' | 'star'

export interface TourStop {
  /** The picture: one of the screens, or 'slides', the floating class goal drawn over a lesson slide. */
  shot: TourShot | 'slides'
  /** What is lit: a place recorded in the picture, or a part of the drawn floating window. */
  at: string
  text: string
  /** A small picture in the bubble of the floating class goal over a lesson. */
  example?: boolean
}

export interface TourPart {
  title: string
  intro: string
  stops: TourStop[]
}

export const SHOT_W = 1280
export const SHOT_H = 559

type Rect = [number, number, number, number]
export const TOUR_RECTS = RECTS as unknown as Record<TourShot, Record<string, Rect>>

export const TOUR: TourPart[] = [
  {
    title: 'The board',
    intro: 'The buttons down the side, the class goal along the top, and the desks.',
    stops: [
      {
        shot: 'board',
        at: 'float',
        example: true,
        text: 'Float shrinks the app down to a small tool that floats over the screen, letting you teach your lesson and still pick random students, award stars, and more without getting in the way!',
      },
      { shot: 'board', at: 'getready', text: 'Get Ready!: a star that shrinks while the class gets ready. It has its own part later.' },
      { shot: 'board', at: 'timer', text: 'The timer opens big over the board. It has its own part later.' },
      {
        shot: 'board',
        at: 'attendance',
        text: 'Attendance: tap it, then tap the desk of anyone who is away. Tap it again when you are done.',
      },
      {
        shot: 'board',
        at: 'swap',
        text: 'Swap Seats: tap two desks to swap the students in them. Desks at the side show too, for a student who sits apart.',
      },
      {
        shot: 'board',
        at: 'pickStudent',
        text: 'Pick a Random Student flashes through the class and lands on one. Students picked less often get a better chance.',
      },
      { shot: 'board', at: 'pickRow', text: 'Pick a Random Row lands on a whole row (a table, in a table layout).' },
      { shot: 'board', at: 'pickAll', text: 'Pick All picks the whole class. Once anyone is picked, it becomes Unpick All.' },
      { shot: 'board', at: 'flip', text: 'Flip Cards: students turn over a card to take a turn. Its part comes next.' },
      { shot: 'board', at: 'groups', text: 'Group Activity: groups made for you, or chosen by you. It has its own part too.' },
      { shot: 'board', at: 'line', text: 'The Line: students wait at their desks for you to check their work. It has its own part.' },
      { shot: 'board', at: 'star', text: 'The star gives a point to everyone picked.' },
      {
        shot: 'board',
        at: 'desk',
        text: 'Tap a desk to pick that student, then the star to give a point. Tap the desk again to let them go.',
      },
      { shot: 'board', at: 'meter', text: 'The class goal fills as the class earns stars. When it is full, the treasure chest opens.' },
      { shot: 'board', at: 'chest', text: 'Tap the chest to change the goal.' },
      { shot: 'board', at: 'fullscreen', text: 'Full screen: the app fills the whole screen. Tap it again to leave.' },
      { shot: 'board', at: 'lock', text: 'The lock: tap it before the class comes in, and touches do nothing. Tap it again to open it.' },
      { shot: 'board', at: 'tab', text: 'Your class. Tap the arrow to switch to another class, or make a new one.' },
      { shot: 'board', at: 'gear', text: 'Class Settings: everything about this class. Help, and this tour, are in there.' },
      { shot: 'board', at: 'saved', text: 'Whether your classes are saved to your Google account. A cloud with a tick means they are.' },
      { shot: 'board', at: 'side', text: 'Moves the side buttons to the other side of the screen.' },
    ],
  },
  {
    title: 'Flip Cards',
    intro: 'Students come up to the board and turn over a card to take a turn.',
    stops: [
      { shot: 'flip', at: 'deck', text: 'Every student has a card. A student comes up and taps one: whoever it shows has the turn.' },
      { shot: 'flip', at: 'card', text: 'The glowing card has the turn. Tap it again to put it away.' },
      { shot: 'flip', at: 'star', text: 'The star gives the glowing student a point.' },
      { shot: 'flip', at: 'pileStack', text: 'Cards put away go on this pile.' },
      { shot: 'flip', at: 'pile', text: 'How many cards are still in play.' },
      { shot: 'flip', at: 'shuffle', text: 'Shuffle starts a new round with every card.' },
      { shot: 'flip', at: 'reveal', text: 'Reveal All shows every card. Hide All turns them back over.' },
      { shot: 'flip', at: 'settings', text: 'Flip card settings: the same switches as in Tools.' },
      { shot: 'flip', at: 'exit', text: 'Back to the seating chart.' },
    ],
  },
  {
    title: 'Group Activity',
    intro: 'Groups made for you or chosen by you, each with its own card and points.',
    stops: [
      { shot: 'chooser', at: 'window', text: 'Tap Group Activity, then choose the groups.' },
      { shot: 'chooser', at: 'saved', text: 'Groups you saved. Tap one to use it again.' },
      { shot: 'chooser', at: 'count', text: 'How many groups.' },
      { shot: 'chooser', at: 'kinds', text: 'Or pairs, or boys and girls.' },
      { shot: 'who', at: 'make', text: 'Make them for me: groups from where students sit.' },
      { shot: 'who', at: 'choose', text: "I'll choose: you put the students in the groups." },
      { shot: 'builder', at: 'lit', text: 'Tap a group to fill it.' },
      { shot: 'builder', at: 'chart', text: 'Then tap its students. Their names move into the group.' },
      { shot: 'builder', at: 'start', text: 'Start when everyone has a group.' },
      { shot: 'groups', at: 'card', text: 'Each group gets a card in its own color.' },
      { shot: 'groups', at: 'status', text: 'A group taps here to say Working, Help, Ready or Done. Help turns the card red.' },
      { shot: 'groups', at: 'name', text: 'Tap a name, then tap another group to move that student.' },
      { shot: 'groups', at: 'plus', text: 'Give the group a point. Group points go to the class goal.' },
      { shot: 'groups', at: 'pickGroup', text: 'While groups are up, this picker picks a group.' },
      { shot: 'groups', at: 'new', text: 'New Groups: choose again.' },
      { shot: 'groups', at: 'shuffle', text: 'Shuffle mixes everyone into new groups.' },
      { shot: 'groups', at: 'save', text: 'Save keeps these groups, with a name, to use again.' },
      { shot: 'groups', at: 'reset', text: 'Reset Points puts every group back to 0.' },
      { shot: 'groups', at: 'lock', text: 'Lock freezes the names, so students can come up and tap their own status.' },
      { shot: 'groups', at: 'exit', text: 'Back to the desks. The groups are kept for next time.' },
    ],
  },
  {
    title: 'The Line',
    intro: 'Students wait at their own desks for you to check their work, instead of crowding round you.',
    stops: [
      { shot: 'line', at: 'rail', text: 'The ticket opens the Line. Choose one of your lines, or make a new one with its steps.' },
      { shot: 'line', at: 'steps', text: 'The line in use. Tap it to choose another, or to edit, delete or make a line (four at most).' },
      { shot: 'line', at: 'hint', text: 'A student who is ready taps their own desk to get in line.' },
      { shot: 'line', at: 'number', text: 'Their place in line shows on their desk, so they can see it from their seat.' },
      { shot: 'line', at: 'now', text: 'Who is with you, big for the class. They are number 1 until you finish with them.' },
      { shot: 'line', at: 'list', text: 'Who is waiting, in order. Tap a name to send that student back to their seat.' },
      { shot: 'line', at: 'sound', text: 'No sound, for a quiet room.' },
      { shot: 'line', at: 'skip', text: 'Skip sends the student with you to the back of the line.' },
      { shot: 'line', at: 'star', text: 'A star for the student with you.' },
      {
        shot: 'line',
        at: 'done',
        text: 'Done checks the step they brought, and the next student is called. On the last step it says All Done.',
      },
      { shot: 'line', at: 'dots', text: 'The dots: green for steps done, amber for the step they are on, with its name beside them.' },
      { shot: 'line', at: 'doneDesk', text: 'All the steps checked: Done.' },
      { shot: 'line', at: 'change', text: 'Change Steps: then tap a desk to move a student a step. For two steps at once, or a mistake.' },
      { shot: 'line', at: 'clear', text: 'Clear Line empties the line and takes the dots and Done marks off.' },
    ],
  },
  {
    title: 'The timer',
    intro: 'A big timer over the board, for work time.',
    stops: [
      { shot: 'timer', at: 'rail', text: 'The hourglass opens the timer.' },
      { shot: 'timer', at: 'face', text: 'Tap the face to set the time, to the nearest minute.' },
      { shot: 'timer', at: 'minusplus', text: 'Or a minute less or more.' },
      { shot: 'timer', at: 'start', text: 'Start, and pause.' },
      { shot: 'timer', at: 'again', text: 'Again starts it over.' },
      { shot: 'timer', at: 'grip', text: 'Hold here and slide to move it.' },
      { shot: 'timer', at: 'size', text: 'Slide this corner to make it smaller.' },
      { shot: 'timer', at: 'gear', text: 'Its color and its time’s-up sound.' },
      { shot: 'timer', at: 'minimise', text: 'Put it away: it becomes a small clock along the top, still counting.' },
      { shot: 'timer', at: 'off', text: 'Turn it off.' },
    ],
  },
  {
    title: 'Get Ready!',
    intro: 'A star that shrinks while the class gets ready. The faster they are, the more stars they keep.',
    stops: [
      { shot: 'howlong', at: 'drums', text: 'Pick how long the class has: 20 seconds up to a minute and a half.' },
      { shot: 'howlong', at: 'speaker', text: 'No sound, for a quiet room.' },
      { shot: 'star', at: 'star', text: 'Explain the job, then tap the star. A drum beats and the star shrinks.' },
      { shot: 'star', at: 'ready', text: 'Tap Ready! when the class is ready. What is left of the star goes into the class goal.' },
      { shot: 'star', at: 'stop', text: 'Stop ends it with no prize.' },
    ],
  },
  {
    title: 'The floating class goal',
    intro: 'The class goal in a small window that stays on top of your slides and videos. It works in Chrome and Edge.',
    stops: [
      { shot: 'board', at: 'float', text: 'Tap Float to open the floating class goal.' },
      { shot: 'slides', at: 'window', text: 'It stays on top of your lesson, so you never have to leave your slides.' },
      { shot: 'slides', at: 'plus', text: '+1 adds a point to the class goal.' },
      { shot: 'slides', at: 'pick', text: 'Pick picks a random student and shows their name.' },
      { shot: 'slides', at: 'ready', text: 'Get Ready!, right over your slides.' },
      { shot: 'slides', at: 'shrink', text: 'Make it a thin strip, or big again.' },
    ],
  },
]

/** Where a stopped tour picks up: the part it was in, or the one it was about to start. */
const RESUME_KEY = 'seating-chart-tour-v1'

export function loadTourResume(): number | null {
  try {
    const n = JSON.parse(localStorage.getItem(RESUME_KEY) ?? 'null')?.resume
    return typeof n === 'number' && n >= 0 && n < TOUR.length ? n : null
  } catch {
    return null
  }
}

export function saveTourResume(part: number | null) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ resume: part }))
  } catch {
    // A board that won't store it starts the next tour from the beginning.
  }
}
