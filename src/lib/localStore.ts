import type { ClassData } from '../types'

const STORAGE_KEY = 'seating-chart-state-v1'

export interface PersistedState {
  classes: ClassData[]
  activeClassId: string | null
}

export function loadLocalState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!Array.isArray(parsed.classes)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Set once the board is being handed to the next teacher: the page is about to reload, and a
 * save landing in between would put the last teacher's classes back.
 */
let frozen = false

/** Returns false if the save failed (storage full or unavailable, e.g. private browsing) so callers can warn the teacher instead of silently losing changes. */
export function saveLocalState(state: PersistedState): boolean {
  if (frozen) return true
  let ok = true
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    ok = false
  }
  if (ok === failing) {
    failing = !ok
    listeners.forEach((listener) => listener())
  }
  return ok
}

let failing = false
const listeners = new Set<() => void>()

/** For useSyncExternalStore: whether the last save failed, so the side panel can say "Not saving". */
export function subscribeSaveFailures(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const lastSaveFailed = () => failing

/** What the board holds from now on (or nothing, for a fresh start), and no more saves until the reload. */
export function replaceLocalState(state: PersistedState | null): void {
  frozen = true
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
