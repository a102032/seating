import { Check } from 'lucide-react'
import clsx from 'clsx'
import { THEME_OPTIONS, type Theme } from '../lib/theme'

interface ThemePickerProps {
  theme: Theme
  onSetTheme: (theme: Theme) => void
}

export function ThemePicker({ theme, onSetTheme }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {THEME_OPTIONS.map((opt) => {
        const active = opt.id === theme
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSetTheme(opt.id)}
            aria-pressed={active}
            className={clsx(
              'flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-colors',
              active ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/60',
            )}
          >
            <span
              className="relative flex h-8 w-full items-center justify-center rounded-lg shadow-inner"
              style={{ background: `linear-gradient(135deg, ${opt.preview.from}, ${opt.preview.to})` }}
            >
              <span className="h-3 w-3 rounded-full shadow" style={{ background: opt.preview.accent }} />
              {active && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="text-center text-[0.65rem] leading-tight font-semibold text-foreground">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
