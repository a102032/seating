export type Theme = 'light' | 'dark' | 'school' | 'sky' | 'vibrant'

const THEME_KEY = 'seating-chart-theme-v1'
const THEMES: Theme[] = ['light', 'dark', 'school', 'sky', 'vibrant']

export interface ThemeOption {
  id: Theme
  label: string
  /** Small preview swatch colors, shown on the picker itself - not necessarily identical to the CSS tokens. */
  preview: { from: string; to: string; accent: string }
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light', preview: { from: '#f5f5f7', to: '#eef1f6', accent: '#2563eb' } },
  { id: 'dark', label: 'Dark', preview: { from: '#1c1c1e', to: '#232326', accent: '#3b82f6' } },
  { id: 'school', label: 'School Colors', preview: { from: '#fff6ec', to: '#fdebd3', accent: '#e2650e' } },
  { id: 'sky', label: 'Calm Sky Blue', preview: { from: '#eff8ff', to: '#def0fe', accent: '#3aa9e0' } },
  { id: 'vibrant', label: 'Vibrant Elementary', preview: { from: '#6bd9f7', to: '#38bdf8', accent: '#8b5cf6' } },
]

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (THEMES.includes(stored as Theme)) return stored as Theme
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}
