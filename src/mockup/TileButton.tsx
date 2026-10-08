import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TileButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode
  /** One or two short words: a board has no hover, so every icon carries its word. */
  label: ReactNode
  active?: boolean
  /** A small mark in the corner, such as attendance done for today. */
  badge?: ReactNode
  /**
   * In a column of tiles as wide as the column (the rail): the word shrinks to the tile's width,
   * so "Attendance" fits a narrow rail. Every tile in the column passes the same measure, so all
   * their words stay one size.
   */
  fitLabel?: boolean
}

/**
 * The mock-ups' button: an icon over a word, so a row or a rail of them stays narrow and every
 * one still says what it does. It looks like the app's own buttons (TactileButton), pale with
 * the theme's words, filled when on, and presses in under a finger in CSS.
 */
export function TileButton({ icon, label, active, badge, fitLabel, className, disabled, style, ...props }: TileButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-slot="button"
      aria-pressed={active}
      className={cn(
        buttonVariants({ variant: active ? 'default' : 'secondary' }),
        'relative h-auto min-w-0 flex-col gap-[0.2em] rounded-2xl px-1 py-[var(--tile-py,0.45em)] font-semibold leading-tight shadow-sm',
        !disabled && 'transition-[color,background-color,box-shadow,scale] duration-150 hover:scale-[1.03] active:scale-[0.95]',
        disabled && 'cursor-not-allowed',
        fitLabel && '[container-type:inline-size]',
        className,
      )}
      style={{ touchAction: 'manipulation', fontSize: 'var(--tile-font, clamp(0.68rem, 1.55vmin, 0.95rem))', ...style }}
      {...props}
    >
      <span className="flex items-center justify-center [&_svg]:!size-[var(--tile-icon,clamp(18px,3.3vmin,28px))]">{icon}</span>
      <span
        className="max-w-full text-center"
        style={{
          whiteSpace: 'var(--tile-ws, nowrap)' as CSSProperties['whiteSpace'],
          // "Attendance", the longest word in the rail, is about 6.8 times its own type size.
          fontSize: fitLabel ? 'min(1em, calc(100cqw / 6.9))' : undefined,
        }}
      >
        {label}
      </span>
      {badge && <span className="absolute right-1 top-1">{badge}</span>}
    </button>
  )
}
