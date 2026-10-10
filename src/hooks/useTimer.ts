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
}

const KEY = 'seating-chart-timer-settings-v1'
// Classroom Screen's starts at 10 minutes, and so does this.
const DEFAULTS: Kept = { seconds: 600, color: 'theme', sound: 'ding', size: 1, pos: null }
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
      JSON.stringify({ seconds: kept.seconds, color: kept.color, alarmSound: kept.sound, size: kept.size, pos: kept.pos }),
    )
  } catch {
    // A board that won't store it starts at the defaults next time.
  }
}

const kept = load()
let state: TimerState = { ...kept, view: 'off', running: false, up: false, left: kept.seconds, settings: false }
const listeners = new Set<() => void>()
let endsAt = 0
let tick: ReturnType<typeof setInterval> | null = null

function set(patch: Partial<TimerState>) {
  const next = { ...state, ...patch }
  const keptChanged = (['seconds', 'color', 'sound', 'size', 'pos'] as const).some((k) => next[k] !== state[k])
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
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  if (left > 0) {
    if (left !== state.left) set({ left })
    return
  }
  stopTicking()
  set({ left: 0, running: false, up: true })
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
    set({ view: 'off', running: false, up: false, left: state.seconds, settings: false })
  },
  start() {
    // Time's up and started again: from the top.
    const left = state.up || state.left <= 0 ? state.seconds : state.left
    endsAt = Date.now() + left * 1000
    stopTicking()
    tick = setInterval(onTick, 250)
    set({ running: true, up: false, left, settings: false })
  },
  pause() {
    stopTicking()
    set({ running: false, left: Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)) })
  },
  /** Again: back to the time set, stopped. Also what a tap on "Time's up!" does. */
  again() {
    stopTicking()
    set({ running: false, up: false, left: state.seconds })
  },
  /** A tap on the stopped face, or − and +: a whole number of minutes, 1 to 60. */
  setMinutes(minutes: number) {
    if (state.running) return
    const seconds = Math.min(60, Math.max(1, Math.round(minutes))) * 60
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
  /** A tap on a sound plays it and picks it. */
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

/** The time as a clock shows it: 9:05, 10:00, 60:00. */
export function timeText(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
