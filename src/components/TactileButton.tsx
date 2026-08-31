import { motion } from 'framer-motion'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>

interface TactileButtonProps extends NativeButtonProps {
  children: ReactNode
  active?: boolean
  variant?: 'default' | 'primary' | 'danger'
}

const variantMap = {
  default: 'secondary',
  primary: 'default',
  danger: 'destructive',
} as const

export function TactileButton({ children, active, variant = 'default', className, disabled, ...props }: TactileButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      disabled={disabled}
      className={cn(
        buttonVariants({ variant: active ? 'default' : variantMap[variant] }),
        'h-auto gap-2 rounded-xl px-3.5 py-2.5 font-semibold shadow-sm',
        'focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900',
        disabled && 'cursor-not-allowed',
        className,
      )}
      style={{ touchAction: 'manipulation', fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
