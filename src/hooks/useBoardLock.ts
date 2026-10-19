import { useCallback, useRef, useState, type RefObject } from 'react'

/**
 * Lock the board (2026-10-19, the teacher: children come in, see the seating chart up and touch it
 * before they reach their desks). One tap on the lock in the top bar's far corner and the board
 * looks exactly as it did but answers no touch; one tap on the lock opens it again. The corner is
 * high on a wall-mounted board, out of a small child's reach, so one tap is enough to unlock.
 *
 * It is this board's alone (kept on the computer, never synced: the laptop with the same class
 * open isn't locked), it stays until tapped open - never on a timer - and a refresh keeps it.
 */
const KEY = 'seating-chart-board-lock-v1'

/** The board reads one touch as two: the second must not undo the first. */
const GUARD_MS = 700

function readLocked(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function writeLocked(locked: boolean) {
  try {
    if (locked) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage refused: the lock still holds for as long as the page is open.
  }
}

export interface BoardLock {
  locked: boolean
  toggle: () => void
  /** The lock in the top bar: the shield lets a tap on it through, and wiggles it at any other tap. */
  buttonRef: RefObject<HTMLButtonElement | null>
}

export function useBoardLock(): BoardLock {
  const [locked, setLocked] = useState(readLocked)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const changedAt = useRef(0)
  const toggle = useCallback(() => {
    const now = performance.now()
    if (now - changedAt.current < GUARD_MS) return
    changedAt.current = now
    setLocked((was) => {
      writeLocked(!was)
      return !was
    })
  }, [])
  return { locked, toggle, buttonRef }
}
