import type { ClassData } from '../types'
import { dateKey } from './attendance'

/**
 * What the splash says to a signed-in teacher: "Good morning, Derek!" most of the time, and now
 * and then something that shows the app knows the time, the day, or how their classes are doing
 * (the teacher's idea, from the greetings in the Claude app). Picked once each time the splash
 * opens and never changed while it's up - nothing on a timer.
 *
 * Every greeting has the teacher's name: the board is shared, and the name is how a teacher sees
 * whose classes are up. Short, to stay on one line. Kind, because the class may walk in while
 * the splash is showing: jokes are about the day, never the students, and only class goals,
 * which are on the board anyway, ever come into it - never names, attendance or who had a turn.
 * Nothing about coffee or tea: not every teacher drinks it (the teacher's call).
 */

/**
 * Longer than this, a line could wrap on the splash, so it is left out (the plain greeting always
 * fits). Measured in the chalk face: 49 letters stay on one line at every size from 1024x500 to
 * 2560x1300 and 54 wrap on a big board, so 46 leaves room for wide letters.
 */
const MAX_LENGTH = 46
/** How often the news from the classes is told, when there is some. */
const NEWS_CHANCE = 0.35
/** Of the rest, how often the plain time-of-day greeting is the one. */
const PLAIN_CHANCE = 0.5
/** Away this many days or more is "long time no see" - a holiday, usually. */
const LONG_AWAY_DAYS = 7

export interface GreetingContext {
  /** The teacher's name as the splash greets it ("Derek", "Teacher Derek"). */
  name: string
  now: Date
  /** The last time this teacher was greeted on this board, or undefined the first time. */
  lastHere?: Date
  /** The greeting shown last time, so the same one never comes twice in a row. */
  lastText?: string
  classes: ClassData[]
  random?: () => number
}

type Band = 'night' | 'early' | 'morning' | 'lunch' | 'afternoon' | 'afterSchool' | 'evening'

/** The part of the day, by the computer's own clock. */
function bandOf(now: Date): Band {
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (minutes < 5 * 60) return 'night'
  if (minutes < 7 * 60) return 'early'
  if (minutes < 11 * 60 + 30) return 'morning'
  if (minutes < 13 * 60 + 30) return 'lunch'
  if (minutes < 16 * 60) return 'afternoon'
  if (minutes < 18 * 60) return 'afterSchool'
  if (minutes < 22 * 60) return 'evening'
  return 'night'
}

function plainGreeting(now: Date, name: string): string {
  const hour = now.getHours()
  const words = hour < 5 ? 'Hello' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${words}, ${name}!`
}

/** A line, and whether it only makes sense on a school day ("School's out" on a Sunday doesn't). */
type Line = [text: (name: string) => string, schoolDay?: boolean]

const BY_BAND: Record<Band, Line[]> = {
  early: [[(n) => `Early bird, ${n}!`], [(n) => `Up before the bell, ${n}?`, true], [(n) => `You beat the sun, ${n}!`]],
  morning: [[(n) => `Rise and shine, ${n}!`], [(n) => `Ready to teach, ${n}?`, true]],
  lunch: [[(n) => `Lunch first, ${n}?`], [(n) => `Half the day done, ${n}!`, true]],
  afternoon: [[(n) => `Afternoon push, ${n}!`, true], [(n) => `Hello again, ${n}!`]],
  afterSchool: [
    [(n) => `School's out, ${n}!`, true],
    [(n) => `Still here, ${n}?`, true],
  ],
  evening: [[(n) => `Planning for tomorrow, ${n}?`]],
  night: [[(n) => `Still up, ${n}?`], [(n) => `Burning the midnight oil, ${n}?`], [(n) => `Even the desks are asleep, ${n}!`]],
}

/** By the day of the week, Sunday first as Date counts them. */
const BY_DAY: Line[][] = [
  [[(n) => `Sunday planning, ${n}?`]],
  [[(n) => `Happy Monday, ${n}!`], [(n) => `New week, new stars, ${n}!`]],
  [],
  [[(n) => `Halfway to Friday, ${n}!`]],
  [],
  [[(n) => `Happy Friday, ${n}!`], [(n) => `Friday! You made it, ${n}!`]],
  [[(n) => `Working on a Saturday, ${n}?`]],
]

/**
 * Lunar New Year and the Moon Festival move every year. The browser has a Chinese calendar of its
 * own, but it puts Lunar New Year 2027 a day late, so these are the published dates, checked
 * against it for every other year. Past 2031 the two greetings simply stop until more are added.
 */
const LUNAR_NEW_YEAR = ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-02', '2031-01-23']
const MOON_FESTIVAL = ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12', '2031-10-01']

function daysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

/** A day the whole school knows, by the computer's date. Taiwan's Teachers' Day and Children's Day among them. */
function specialDay(now: Date, name: string): string | null {
  const md = dateKey(now).slice(5)
  if (md === '01-01') return `Happy New Year, ${name}!`
  if (md === '04-04') return `Happy Children's Day, ${name}!`
  if (md === '09-28') return `Happy Teachers' Day, ${name}!`
  if (md === '10-31') return `Happy Halloween, ${name}!`
  if (md === '12-24' || md === '12-25') return `Merry Christmas, ${name}!`
  // The new year is three days of visiting and red envelopes, so the greeting lasts as long.
  if (
    LUNAR_NEW_YEAR.some((day) => {
      const gone = daysBetween(new Date(`${day}T12:00`), now)
      return gone >= 0 && gone < 3
    })
  ) {
    return `Happy Lunar New Year, ${name}!`
  }
  if (MOON_FESTIVAL.includes(dateKey(now))) return `Happy Moon Festival, ${name}!`
  return null
}

/** How the teacher's classes are doing, as far as the board already shows it: the class goals. */
function classNews(classes: ClassData[], now: Date, name: string): string[] {
  const today = dateKey(now)
  const yesterday = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const news: string[] = []
  for (const c of classes) {
    if (c.goalEnabled === false || !c.pointsGoal) continue
    if (c.goalReachedOn === today) news.push(`${name}, ${c.name} opened the chest today!`)
    else if (c.goalReachedOn === yesterday) news.push(`${name}, ${c.name} opened the chest yesterday!`)
    const left = c.pointsGoal - (c.classPoints ?? 0)
    if (left >= 1 && left <= 5) news.push(`${name}, ${c.name} is ${left} ${left === 1 ? 'star' : 'stars'} from the chest!`)
  }
  return news
}

function lastActive(ctx: GreetingContext): Date | undefined {
  // The board's own last greeting, or a change to a class made on another computer since.
  const times = ctx.classes.map((c) => Date.parse(c.updatedAt)).filter((t) => !Number.isNaN(t) && t <= ctx.now.getTime())
  if (ctx.lastHere) times.push(ctx.lastHere.getTime())
  return times.length > 0 ? new Date(Math.max(...times)) : undefined
}

export function chooseGreeting(ctx: GreetingContext): string {
  const { name, now } = ctx
  const random = ctx.random ?? Math.random
  // The first time on this board, the welcome it always had.
  if (!ctx.lastHere) return `Welcome, ${name}!`

  const special = specialDay(now, name)
  if (special) return special

  const last = lastActive(ctx)
  const away = last ? daysBetween(last, now) : 0
  if (away >= LONG_AWAY_DAYS) return `Long time no see, ${name}!`

  const fits = (text: string) => text.length <= MAX_LENGTH && text !== ctx.lastText
  const pick = (choices: string[]) => choices[Math.floor(random() * choices.length)]

  const news = classNews(ctx.classes, now, name).filter(fits)
  if (news.length > 0 && random() < NEWS_CHANCE) return pick(news)

  const plain = plainGreeting(now, name)
  const weekday = now.getDay() !== 0 && now.getDay() !== 6
  const lines = [...BY_BAND[bandOf(now)], ...BY_DAY[now.getDay()]].filter(([, schoolDay]) => weekday || !schoolDay)
  const fun = lines.map(([text]) => text(name))
  if (away === 0) fun.push(`Back again, ${name}?`)
  else if (away < LONG_AWAY_DAYS) fun.push(`${name} returns!`, `Welcome back, ${name}!`)
  const funFits = fun.filter(fits)

  if (plain !== ctx.lastText && (funFits.length === 0 || random() < PLAIN_CHANCE)) return plain
  return funFits.length > 0 ? pick(funFits) : plain
}

const STORE_KEY = 'seating-chart-greeting-v1'

type Seen = Record<string, { text: string; at: string }>

function readSeen(): Seen {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Seen) : {}
  } catch {
    return {}
  }
}

/** The greeting for a teacher opening the splash now, from what this board remembers of them. */
export function greetingFor(teacher: { uid: string; firstName: string }, classes: ClassData[], now = new Date()): string {
  const seen = readSeen()[teacher.uid]
  const lastHere = seen ? new Date(seen.at) : undefined
  return chooseGreeting({
    name: teacher.firstName,
    now,
    lastHere: lastHere && !Number.isNaN(lastHere.getTime()) ? lastHere : undefined,
    lastText: seen?.text,
    classes,
  })
}

/** Kept per teacher, since the board is shared: each one's last greeting, and when. */
export function rememberGreeting(uid: string, text: string, now = new Date()): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...readSeen(), [uid]: { text, at: now.toISOString() } }))
  } catch {
    // A board that won't store it just greets as if for the first time.
  }
}
