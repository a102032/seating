import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>

interface TactileButtonProps extends NativeButtonProps {
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
  active?: boolean
  variant?: 'default' | 'primary' | 'danger'
}

const variantMap = {
  default: 'secondary',
  primary: 'default',
  danger: 'destructive',
} as const

/**
 * The app's everyday button. It grows a touch under a mouse and presses in under a finger -
 * in CSS, so the graphics chip runs it: this was framer's whileHover/whileTap, a spring
 * the main processor drove frame by frame on every tap of every button. Tailwind's hover:
 * only applies where there is a real hover, so a tap on the board doesn't leave it grown.
 */
export function TactileButton({ children, active, variant = 'default', className, disabled, ...props }: TactileButtonProps) {
  return (
    <button
      disabled={disabled}
      data-slot="button"
      className={cn(
        buttonVariants({ variant: active ? 'default' : variantMap[variant] }),
        'h-auto gap-2 rounded-xl px-3.5 py-2.5 font-semibold shadow-sm',
        !disabled &&
          'transition-[color,background-color,border-color,box-shadow,scale] duration-150 hover:scale-[1.03] active:scale-[0.96]',
        'focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900',
        disabled && 'cursor-not-allowed',
        className,
      )}
      style={{ touchAction: 'manipulation', fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
      {...props}
    >
      {children}
    </button>
  )
}
