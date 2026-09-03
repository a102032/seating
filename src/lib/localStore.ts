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

/** Returns false if the save failed (storage full or unavailable, e.g. private browsing) so callers can warn the teacher instead of silently losing changes. */
export function saveLocalState(state: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
