/** Get Ready!'s drums, in seconds: how long the class has. Anything longer is the side panel's timer. */
export const GET_READY_DRUMS = [10, 15, 20, 25, 30]
/** What a full star is worth, the same on every drum (Pickers & Points). */
export const GET_READY_PRIZES = [3, 5, 8, 10]
export const DEFAULT_GET_READY_PRIZE = 5

/** Get Ready!'s Ready! and Stop buttons' width in a window this tall, as their own clamp(7rem, 17vh, 10rem) works it out. */
export function controlButtonWidth(windowHeight: number) {
  return Math.min(160, Math.max(112, 0.17 * windowHeight))
}

/** Ready! and Stop's height in a window this tall, as their own clamp(2.75rem, 7vh, 4rem) works it out. */
export function controlButtonHeight(windowHeight: number) {
  return Math.min(64, Math.max(44, 0.07 * windowHeight))
}

/**
 * The floating window's "How long?": a snug rectangle of five drums, sized from its width so the
 * window can be made exactly tall enough for it (2026-10-06, the teacher: no space above and
 * below the drums). The same numbers lay it out (`FloatGetReady.tsx`) and size the window.
 */
export const FLOAT_DRUMS = { pad: 12, gap: 10, titleHeight: 40, imageRatio: 0.62, imageMax: 96, numberRatio: 0.26, numberMax: 36 }

/** The width of one drum in a window this wide. */
function floatDrumWidth(width: number) {
  return (width - 2 * FLOAT_DRUMS.pad - 4 * FLOAT_DRUMS.gap) / 5
}

/**
 * How tall the window must be for the drums: its padding, the title row, and a drum - its
 * padding (12 and 10), border (3 each side), picture, number and "seconds" (18) with the gaps
 * between them (6 and 4).
 */
export function floatDrumsHeight(width: number) {
  const drum = floatDrumWidth(width)
  const image = Math.min(FLOAT_DRUMS.imageMax, drum * FLOAT_DRUMS.imageRatio)
  const number = Math.min(FLOAT_DRUMS.numberMax, drum * FLOAT_DRUMS.numberRatio)
  const button = 12 + 3 + image + 6 + number + 4 + 18 + 10 + 3
  return Math.ceil(2 * FLOAT_DRUMS.pad + FLOAT_DRUMS.titleHeight + 8 + button) + 2
}
