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
  default: 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50',
  primary: 'bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-500',
  danger: 'bg-rose-600 border-rose-700 text-white hover:bg-rose-500',
}

export function TactileButton({ children, active, variant = 'default', className, ...props }: TactileButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={clsx(
        'flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 font-bold shadow-sm outline-none transition-colors',
        'focus-visible:ring-4 focus-visible:ring-indigo-300',
        active ? 'bg-emerald-500 border-emerald-600 text-white' : variants[variant],
        className,
      )}
      style={{ touchAction: 'manipulation', fontSize: 'clamp(0.75rem, 1.5vmin, 1.05rem)' }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
