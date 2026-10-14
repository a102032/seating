import { Check } from 'lucide-react'
import { THEME_OPTIONS, type Theme } from '../lib/theme'

interface ThemePickerProps {
  theme: Theme
  onSetTheme: (theme: Theme) => void
}

/** Stand-ins for the sticker avatars: the same in every theme, like the stickers themselves. */
const AVATAR_DOTS = ['#f59e0b', '#22c55e', '#ec4899', '#3b82f6', '#a855f7', '#f97316']

/**
 * A small board in the theme's own colours: a strip of side panel and six desks. Drawn from
 * the theme's tokens (index.css applies them under [data-theme-preview]), so a change to a
 * theme shows up here by itself - a picture of it would have gone out of date.
 */
function ThemeThumbnail({ theme }: { theme: Theme }) {
  return (
    <span data-theme-preview={theme} className="cs-pic-art relative !flex gap-1 p-1.5">
      <span
        data-preview="panel"
        className="flex w-[24%] shrink-0 flex-col gap-1 rounded-md p-1"
        style={{ background: 'color-mix(in srgb, var(--card) 75%, transparent)' }}
      >
        <span className="h-3 rounded-sm" style={{ background: 'var(--clock-bg)' }} />
        <span className="h-1.5 rounded-sm bg-secondary" />
        <span className="h-1.5 rounded-sm bg-secondary" />
        <span className="h-1.5 rounded-sm bg-primary" />
      </span>
      <span className="grid flex-1 grid-cols-3 grid-rows-2 gap-1">
        {AVATAR_DOTS.map((dot) => (
          <span key={dot} data-preview="desk" className="flex flex-col items-center justify-end gap-0.5 rounded-t-[5px] px-1 pb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
            <span className="h-[3px] w-[70%] rounded-full opacity-70" style={{ background: 'var(--desk-name)' }} />
          </span>
        ))}
      </span>
    </span>
  )
}

/** This class's own colours (2026-10-11, the teacher: "Pick a color theme for this class"). */
export function ThemePicker({ theme, onSetTheme }: ThemePickerProps) {
  return (
    <div className="cs-pics cs-themes cs-fill">
      {THEME_OPTIONS.map((opt) => {
        const active = opt.id === theme
        return (
          <button key={opt.id} type="button" className="cs-pic" onClick={() => onSetTheme(opt.id)} aria-pressed={active}>
            <ThemeThumbnail theme={opt.id} />
            {active && (
              <span className="cs-tick">
                <Check strokeWidth={3.5} />
              </span>
            )}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
