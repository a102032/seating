export type Theme = 'light' | 'dark' | 'chalk' | 'vibrant' | 'comic'

const THEME_KEY = 'seating-chart-theme-v1'
/**
 * Set only when a teacher picks a theme themselves. THEME_KEY alone can't be trusted as a
 * choice: applyTheme used to write it on every paint, so the OS's dark-mode default from a
 * first visit sits in storage looking exactly like a pick. Without this flag, a teacher who
 * never touched the picker would open the board to Dark.
 */
const CHOSEN_KEY = 'seating-chart-theme-chosen-v1'
const THEMES: Theme[] = ['light', 'dark', 'chalk', 'vibrant', 'comic']

export interface ThemeOption {
  id: Theme
  label: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'chalk', label: 'Chalkboard' },
  { id: 'vibrant', label: 'Elementary' },
  { id: 'comic', label: 'Comic Book' },
]

/** Vibrant Elementary until a teacher actually picks something else - not the OS's light/dark
    preference, which used to decide it. A phone or tablet set to dark mode was landing every
    new class on the Dark theme with no say in it; Vibrant is the theme the app is designed
    to show off first. */
export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    const chosen = localStorage.getItem(CHOSEN_KEY) === '1'
    if (chosen && THEMES.includes(stored as Theme)) return stored as Theme
  } catch {
    // ignore
  }
  return 'vibrant'
}

/** Paint the theme. Saves nothing - only a teacher's own pick is remembered, via chooseTheme. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

/** The teacher picked this one. Remember it, and remember that it was a pick. */
export function chooseTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
    localStorage.setItem(CHOSEN_KEY, '1')
  } catch {
    // ignore
  }
}
