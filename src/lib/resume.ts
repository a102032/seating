import { dateKey } from './attendance'

/**
 * A refresh goes back to the class that was open, not to the splash (2026-10-11, the teacher).
 * The splash is still how the app opens - a new tab, Chrome started again, the next day - but a
 * refresh mid-lesson is nearly always something gone wrong, or Chrome reloading a tab it cleared
 * to save memory while the lesson's slides were in front, and the splash was one more step then.
 *
 * The note is kept in sessionStorage, which belongs to this one tab: it lasts through a reload
 * and goes when the tab is closed. It names the teacher and the day, so the next day, or another
 * teacher signed in on the board, starts at the splash as before. The class itself is the one
 * the board already remembers.
 */
const KEY = 'seating-chart-in-class-v1'

/** A class is open in this tab, for this teacher, today. */
export function rememberInClass(uid: string | undefined) {
  if (!uid) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ uid, day: dateKey() }))
  } catch {
    // A tab that won't store it just opens at the splash after a refresh, as it always did.
  }
}

/** The board is being handed over: the next load starts at the splash whatever the note says. */
export function forgetInClass() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to forget.
  }
}

/** This load is a refresh of a tab that had this teacher's class open today. */
export function resumesInClass(uid: string | undefined): boolean {
  if (!uid) return false
  try {
    const note = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    return note?.uid === uid && note?.day === dateKey()
  } catch {
    return false
  }
}
