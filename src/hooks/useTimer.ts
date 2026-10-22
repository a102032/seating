import { useSyncExternalStore } from 'react'
import { playAlarm } from '../lib/sound'
import type { AlarmSound } from '../types'

/**
 * The timer (2026-10-09, the side rail): a 60-minute face that opens big over the board from the
 * rail's hourglass, can be put away as a clock at the start of the goal meter's bar, and is
 * turned off by its X. One timer for the app, whichever class is open.
 *
 * Its state lives here, outside React, and each piece of the app reads only what it shows: the
 * rail's button whether it is open and whether the time is up, the bar's clock and the big face
 * the time. So a running timer redraws a clock once a second and never the desks, which on a
 * board's weak processor is what kept the old one smooth.
 */

export type TimerColor = 'theme' | 'blue' | 'red' | 'green'
export type TimerSound = AlarmSound | 'none'
/** The dial, the mouse eating an apple a minute (2026-10-20, `MouseFace.tsx`), or the mouse writing a page a minute (2026-10-22). */
export type TimerFace = 'dial' | 'mouse' | 'writer'
/** Off; open big over the board; or put away as a clock in the goal meter's bar. */
export type TimerView = 'off' | 'big' | 'bar'

/** The wedge's colours besides the theme's own: Classroom Screen's choice, as the teacher asked. */
export const TIMER_COLORS: Record<Exclude<TimerColor, 'theme'>, string> = {
  blue: '#2563eb',
  red: '#ef4444',
  green: '#16a34a',
}

/** Smallest the card can be made, as a share of the size it opens at (the biggest). */
export const TIMER_MIN_SIZE = 0.45

interface Kept {
  /** The time set, in seconds. The last one set is kept: a class's routine is the same length. */
  seconds: number
  color: TimerColor
  sound: TimerSound
  face: TimerFace
  /**
   * The face's own sounds while it runs are off (the speaker in the strip, 2026-10-22: the class
   * found the mouse's bites distracting during independent work). The alarm at time's up still rings.
   */
  quiet: boolean
  /** The card's size, TIMER_MIN_SIZE to 1. */
  size: number
  /** Where the card was last put, as a share (0 to 1) of the room around it; null is the middle. */
  pos: { x: number; y: number } | null
}

export interface TimerState extends Kept {
  view: TimerView
  running: boolean
  /** The time ran out and nobody has tapped it yet. */
  up: boolean
  /** Whole seconds left, as the clock shows them. */
  left: number
  /** The gear's choices are showing in the face's place. */
  settings: boolean
  /** Tapped off the floating window for this run; it comes back when the time is up or it starts again. */
  floatHidden: boolean
}

const KEY = 'seating-chart-timer-settings-v1'
// Classroom Screen's starts at 10 minutes, and so does this.
const DEFAULTS: Kept = { seconds: 600, color: 'theme', sound: 'ding', face: 'dial', quiet: false, size: 1, pos: null }
const SOUNDS: TimerSound[] = ['ding', 'chime', 'bell', 'trainWhistle', 'guitar', 'rooster', 'none']

function load(): Kept {
  try {
    // The old timer kept its alarm here too (with a face and a warning that went with the flip
    // clock), so a teacher's chosen sound comes across.
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const pos = raw.pos
    return {
      seconds: Number.isInteger(raw.seconds) && raw.seconds >= 60 && raw.seconds <= 3600 ? raw.seconds : DEFAULTS.seconds,
      color: ['theme', 'blue', 'red', 'green'].includes(raw.color) ? raw.color : DEFAULTS.color,
      sound: SOUNDS.includes(raw.alarmSound) ? raw.alarmSound : DEFAULTS.sound,
      face: raw.face === 'mouse' || raw.face === 'writer' ? raw.face : DEFAULTS.face,
      quiet: raw.quiet === true,
      size: typeof raw.size === 'number' ? Math.min(1, Math.max(TIMER_MIN_SIZE, raw.size)) : DEFAULTS.size,
      pos:
        pos && typeof pos.x === 'number' && typeof pos.y === 'number'
          ? { x: Math.min(1, Math.max(0, pos.x)), y: Math.min(1, Math.max(0, pos.y)) }
          : null,
    }
  } catch {
    return DEFAULTS
  }
}

function save(kept: Kept) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        seconds: kept.seconds,
        color: kept.color,
        alarmSound: kept.sound,
        face: kept.face,
        quiet: kept.quiet,
        size: kept.size,
        pos: kept.pos,
      }),
    )
  } catch {
    // A board that won't store it starts at the defaults next time.
  }
}

const kept = load()
let state: TimerState = { ...kept, view: 'off', running: false, up: false, left: kept.seconds, settings: false, floatHidden: false }
const listeners = new Set<() => void>()
let endsAt = 0
/** Paused: the time left to the millisecond, so the mouse never takes back a bite it was shown taking. */
let restMs: number | null = null
/** When the time ran out, for what happens after (the mouse running to its cheese). */
let upAt = 0
let tick: ReturnType<typeof setInterval> | null = null

function set(patch: Partial<TimerState>) {
  const next = { ...state, ...patch }
  const keptChanged = (['seconds', 'color', 'sound', 'face', 'quiet', 'size', 'pos'] as const).some((k) => next[k] !== state[k])
  state = next
  if (keptChanged) save(state)
  listeners.forEach((l) => l())
}

function stopTicking() {
  if (tick) clearInterval(tick)
  tick = null
}

/**
 * Counted on the computer's clock, so a slow board, or a page behind the lesson whose timers
 * Chrome slows to one a second, never drifts. It tells the clocks only when the second changes.
 */
function onTick() {
  // A tick that outlives its clock (stopped a moment ago) must not ring the time's up twice.
  if (!state.running) return
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  if (left > 0) {
    if (left !== state.left) set({ left })
    return
  }
  stopTicking()
  upAt = Date.now()
  // Time's up comes back on the floating window even if it was tapped away, so the class sees it.
  set({ left: 0, running: false, up: true, floatHidden: false })
  if (state.sound !== 'none') playAlarm(state.sound)
}

export const timer = {
  /** The rail's hourglass: opens it big; tapped again, puts it away, or turns it off if it was never started. */
  railTap() {
    if (state.view !== 'big') set({ view: 'big', settings: false })
    else if (!state.running && !state.up && state.left === state.seconds) timer.off()
    else set({ view: 'bar', settings: false })
  },
  /** Opens it big again, from the clock in the bar. */
  open() {
    set({ view: 'big', settings: false })
  },
  /** The minimise button: away into the bar, still running. */
  minimise() {
    set({ view: 'bar', settings: false })
  },
  /** X: it stops, goes back to the time set and closes. */
  off() {
    stopTicking()
    restMs = null
    set({ view: 'off', running: false, up: false, left: state.seconds, settings: false })
  },
  start() {
    // Time's up and started again: from the top.
    const fromTop = state.up || state.left <= 0
    const left = fromTop ? state.seconds : state.left
    endsAt = Date.now() + (!fromTop && restMs !== null ? restMs : left * 1000)
    restMs = null
    stopTicking()
    tick = setInterval(onTick, 250)
    set({ running: true, up: false, left, settings: false, floatHidden: false })
  },
  /**
   * The floating window's own clock calls this as well: the app's page behind the lesson gets
   * about one timer a second, and after a few minutes hidden Chrome may hold it to one a minute,
   * so the time shown over the lesson, and the alarm, keep to the window that can be seen.
   */
  tick() {
    if (state.running) onTick()
  },
  /** A tap on the time in the floating window takes it off there; the clock carries on in the app. */
  hideInFloat() {
    set({ floatHidden: true })
  },
  pause() {
    stopTicking()
    restMs = Math.max(1, endsAt - Date.now())
    set({ running: false, left: Math.ceil(restMs / 1000) })
  },
  /** Again: back to the time set, stopped. Also what a tap on "Time's up!" does. */
  again() {
    stopTicking()
    restMs = null
    set({ running: false, up: false, left: state.seconds })
  },
  /** A tap on the stopped face, or − and +: a whole number of minutes, 1 to 60. */
  setMinutes(minutes: number) {
    if (state.running) return
    const seconds = Math.min(60, Math.max(1, Math.round(minutes))) * 60
    restMs = null
    set({ seconds, left: seconds, up: false })
  },
  /** − and +, a minute at a time from what is showing. */
  step(by: 1 | -1) {
    timer.setMinutes(Math.round(state.left / 60) + by)
  },
  toggleSettings() {
    set({ settings: !state.settings })
  },
  setColor(color: TimerColor) {
    set({ color })
  },
  setFace(face: TimerFace) {
    set({ face })
  },
  /** A tap on a sound plays it and picks it. */
  /** The strip's speaker: the face's sounds on or off. */
  toggleQuiet() {
    set({ quiet: !state.quiet })
  },
  setSound(sound: TimerSound) {
    set({ sound })
    if (sound !== 'none') playAlarm(sound)
  },
  /** Where the card was put down, and how big it was made. */
  place(pos: { x: number; y: number }, size: number) {
    set({ pos, size })
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reads part of the timer; the component draws again only when that part changes. */
export function useTimer<T>(select: (s: TimerState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}

/** The timer as it is now, for a drawing loop outside React (the mouse face). */
export const timerNow = (): TimerState => state

/**
 * How far into the time set the timer is, to the millisecond, past the end once the time is up.
 * The mouse face draws from this on every frame; `left` changes only once a second.
 */
export function timerElapsed(): number {
  if (state.running) return state.seconds - Math.max(0, endsAt - Date.now()) / 1000
  if (state.up) return state.seconds + (Date.now() - upAt) / 1000
  if (restMs !== null) return state.seconds - restMs / 1000
  return state.seconds - state.left
}

/** Whether the floating window shows the clock: set and started in the app, and not tapped away. */
export const floatClockShown = (s: TimerState) => !s.floatHidden && s.view !== 'off' && (s.running || s.up || s.left < s.seconds)

/** The time as a clock shows it: 9:05, 10:00, 60:00. */
export function timeText(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
