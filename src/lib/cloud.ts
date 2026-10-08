import { MOCKUP } from '../mockup/mockup'
import type { ClassData } from '../types'
import type { Account } from './firebase'

export type { Account }

/**
 * Firebase, loaded the first time it's needed. It is most of the size of the app, so a teacher
 * who never signs in never downloads it; the splash starts fetching it in the background so a
 * tap on Sign in doesn't wait for it.
 */
let loading: Promise<typeof import('./firebase')> | null = null

export function loadCloud(): Promise<typeof import('./firebase')> {
  // The layout preview has no Google behind it: its example class stays on the page.
  if (MOCKUP) return Promise.reject(new Error('The layout preview has no account'))
  loading ??= import('./firebase').catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

/**
 * Whose classes are on this board, kept beside them in localStorage. It is what lets the splash
 * say "Welcome, Derek!" the moment the app opens, before Firebase has loaded or with no
 * internet at all.
 *
 * `dirty` is every class changed here that the account hasn't confirmed yet, and `deleted`
 * every class removed here whose removal hasn't reached it. Firestore queues its own writes
 * on the device too, but a class changed in the second before the board was switched off
 * never got as far as Firestore; this list is how the next start knows to send it.
 */
export interface SavedAccount extends Account {
  dirty: string[]
  deleted: string[]
}

const ACCOUNT_KEY = 'seating-chart-account-v1'
/** The board's own classes, put aside while a teacher is signed in without them (see stashBoard). */
const BOARD_KEY = 'seating-chart-board-classes-v1'

export function loadAccount(): SavedAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedAccount
    if (!parsed.uid) return null
    return { ...parsed, dirty: parsed.dirty ?? [], deleted: parsed.deleted ?? [] }
  } catch {
    return null
  }
}

export function saveAccount(account: SavedAccount | null): void {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // Storage refusing writes is already shown as "Not saving".
  }
}

export interface BoardStash {
  classes: ClassData[]
  activeClassId: string | null
}

/**
 * A teacher signed in on a board that had classes of its own and chose not to add them to their
 * account. They wait here, and come back when that teacher switches out.
 */
export function stashBoard(stash: BoardStash): void {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(stash))
  } catch {
    // ignore
  }
}

export function takeBoardStash(): BoardStash | null {
  try {
    const raw = localStorage.getItem(BOARD_KEY)
    localStorage.removeItem(BOARD_KEY)
    return raw ? (JSON.parse(raw) as BoardStash) : null
  } catch {
    return null
  }
}

/**
 * What went wrong signing in, in words for the teacher, or null when there is nothing to say:
 * closing Google's window is changing your mind, not an error.
 */
export function signInProblem(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code ?? ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null
    case 'auth/popup-blocked':
      return 'The sign-in window was blocked. Allow pop-ups for this site, then try again.'
    case 'auth/network-request-failed':
    case 'unavailable':
      return "Can't reach Google right now. Check the internet, then try again."
    case 'auth/unauthorized-domain':
      return "This web address isn't allowed to sign in yet."
    case 'auth/operation-not-allowed':
      return "Google sign-in isn't switched on for this app yet."
    case 'permission-denied':
      return "Your classes couldn't be opened. Try again later."
    default:
      // A failed download of the sign-in code itself is a TypeError with no code.
      if (!code) return "Can't reach Google right now. Check the internet, then try again."
      return "Sign-in didn't work. Try again."
  }
}
