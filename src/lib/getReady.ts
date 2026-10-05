/** Get Ready!'s drums, in seconds: how long the class has. Anything longer is the side panel's timer. */
export const GET_READY_DRUMS = [10, 15, 20, 25, 30]
/** What a full star is worth, the same on every drum (Pickers & Points). */
export const GET_READY_PRIZES = [3, 5, 8, 10]
export const DEFAULT_GET_READY_PRIZE = 5

/** Get Ready!'s Ready! and Stop buttons' width in this window, as their own clamp(7rem, 17vh, 10rem) works it out. */
export function controlButtonWidth(view: Window) {
  return Math.min(160, Math.max(112, 0.17 * view.innerHeight))
}
