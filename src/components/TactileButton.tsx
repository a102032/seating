import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>

interface TactileButtonProps extends NativeButtonProps {
  children: ReactNode
  active?: boolean
  variant?: 'default' | 'primary' | 'danger'
}

const variants: Record<string, string> = {
  default:
    'bg-black/[0.045] text-neutral-700 hover:bg-black/[0.075] dark:bg-white/[0.06] dark:text-neutral-100 dark:hover:bg-white/[0.1]',
  primary: 'bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-500',
  danger: 'bg-red-500 text-white shadow-sm shadow-red-500/25 hover:bg-red-400',
}

export function TactileButton({ children, active, variant = 'default', className, disabled, ...props }: TactileButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      disabled={disabled}
      className={clsx(
        'flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 font-semibold outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900',
        active ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25' : variants[variant],
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
