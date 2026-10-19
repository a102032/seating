/**
 * Where windows a child uses at the board open (2026-10-19, the teacher: a child at a big board
 * can't reach a window high up, so the teacher moves it within reach). One place for all of them,
 * kept on this board, so moving one down once brings every such window down from then on: the
 * avatar picker, "get out of line?", and anything a child taps that comes later.
 *
 * The place is a share of the room round the window, 0 to 1 across and down (0.5, 0.5 is the
 * middle, where windows open until moved), so the window is always wholly on any screen size.
 */
const KEY = 'seating-chart-student-window-v1'

export interface WindowPlace {
  x: number
  y: number
}

export const MIDDLE: WindowPlace = { x: 0.5, y: 0.5 }

const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)

export function loadPlace(): WindowPlace {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return MIDDLE
    const p = JSON.parse(raw) as Partial<WindowPlace>
    return { x: clamp(Number(p.x)), y: clamp(Number(p.y)) }
  } catch {
    return MIDDLE
  }
}

export function savePlace(place: WindowPlace) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ x: clamp(place.x), y: clamp(place.y) }))
  } catch {
    // Storage refused: the window still goes where it was put, for as long as it is open.
  }
}

/** Where a window of this size sits on the screen at this place: left, top and the pull back by its own size. */
export function placeStyle(place: WindowPlace) {
  return {
    left: `${place.x * 100}%`,
    top: `${place.y * 100}%`,
    translate: `${-place.x * 100}% ${-place.y * 100}%`,
  }
}

export { clamp as clampPlace }
