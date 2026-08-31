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

export function saveLocalState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable (private browsing) - fail silently, in-memory state still works.
  }
}
