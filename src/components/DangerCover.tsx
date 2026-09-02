import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'

interface DangerCoverProps {
  open: boolean
  onOpen: () => void
  children: ReactNode
  className?: string
}

/** A hazard-striped safety cover that flips open (like a missile-launch button guard) before its child button becomes tappable. */
export function DangerCover({ open, onOpen, children, className }: DangerCoverProps) {
  return (
    <div
      className={clsx('relative shrink-0 rounded-2xl p-1', className)}
      style={{
        perspective: 400,
        backgroundImage: 'repeating-linear-gradient(45deg, #facc15 0 7px, #18181b 7px 14px)',
      }}
    >
      <div className="rounded-xl border-2 border-red-600 bg-white p-0.5 dark:bg-neutral-900">{children}</div>

      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={onOpen}
            aria-label="Lift the safety cover to reveal Delete Class"
            title="Lift the safety cover to access Delete Class"
            initial={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -115, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeIn' }}
            style={{ transformOrigin: 'top', transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            className="absolute inset-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/50 bg-white/30 text-xs font-bold text-neutral-800 shadow-inner backdrop-blur-md dark:bg-white/10 dark:text-neutral-100"
          >
            <Lock size={14} /> Tap to unlock
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
