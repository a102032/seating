import { Check } from 'lucide-react'
import clsx from 'clsx'
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
    <span data-theme-preview={theme} className="relative flex h-[4.75rem] w-full gap-1 overflow-hidden rounded-lg p-1.5">
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
          <span key={dot} data-preview="desk" className="flex flex-col items-center justify-end gap-0.5 rounded-t-[5px] bg-card px-1 pb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
            <span className="h-[3px] w-[70%] rounded-full opacity-70" style={{ background: 'var(--desk-name)' }} />
          </span>
        ))}
      </span>
    </span>
  )
}

export function ThemePicker({ theme, onSetTheme }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {THEME_OPTIONS.map((opt) => {
        const active = opt.id === theme
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSetTheme(opt.id)}
            aria-pressed={active}
            className={clsx(
              'relative flex flex-col items-center gap-1 rounded-xl border-2 p-1 transition-colors active:scale-[0.97]',
              active ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/60',
            )}
          >
            <ThemeThumbnail theme={opt.id} />
            {active && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                <Check size={13} strokeWidth={3} />
              </span>
            )}
            <span className="text-center text-xs leading-tight font-semibold text-foreground">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
