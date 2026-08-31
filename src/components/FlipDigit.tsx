import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'

interface FlipDigitProps {
  value: string
  warning: boolean
}

export function FlipDigit({ value, warning }: FlipDigitProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg shadow-lg"
      style={{ perspective: 400, width: 'clamp(2.2rem, 9vmin, 6rem)', aspectRatio: '3 / 4' }}
    >
      <div
        className={clsx(
          'absolute inset-0 flex items-center justify-center font-mono font-black tabular-nums transition-colors duration-300',
          warning ? 'bg-rose-600 text-rose-50' : 'bg-neutral-800 text-neutral-50',
        )}
        style={{ fontSize: 'clamp(1.4rem, 6.5vmin, 4.2rem)' }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 90, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            style={{ display: 'inline-block' }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/40" />
    </div>
  )
}
