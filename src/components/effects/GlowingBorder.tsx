import { motion } from 'framer-motion'

interface GlowingBorderProps {
  /** 'flashing' = fast cool-toned spin while a pick is in progress; 'winner' = slow warm pulse on reveal. */
  variant: 'flashing' | 'winner'
}

/**
 * Aceternity-style animated glow: a blurred conic-gradient ring that spins behind the
 * element it wraps, bleeding out past the edges like a halo. Built with the same
 * Framer Motion + Tailwind approach Aceternity's own components use (ui.aceternity.com
 * wasn't reachable to pull their exact snippet in this build environment).
 */
export function GlowingBorder({ variant }: GlowingBorderProps) {
  const gradient =
    variant === 'winner'
      ? 'conic-gradient(from 0deg, #fbbf24, #f59e0b, #fde047, #fb923c, #fbbf24)'
      : 'conic-gradient(from 0deg, #60a5fa, #818cf8, #38bdf8, #a78bfa, #60a5fa)'

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute -inset-1.5 rounded-[1.4rem]"
      style={{ background: gradient, filter: 'blur(10px)' }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: variant === 'winner' ? [0.65, 1, 0.65] : 0.85,
        rotate: 360,
      }}
      exit={{ opacity: 0 }}
      transition={{
        rotate: { duration: variant === 'winner' ? 3 : 0.9, repeat: Infinity, ease: 'linear' },
        opacity:
          variant === 'winner'
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.15 },
      }}
    />
  )
}
