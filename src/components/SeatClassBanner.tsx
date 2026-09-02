import { motion } from 'framer-motion'
import { GraduationCap } from 'lucide-react'

interface SeatClassBannerProps {
  unseatedCount: number
  onSeatClass: () => void
}

export function SeatClassBanner({ unseatedCount, onSeatClass }: SeatClassBannerProps) {
  if (unseatedCount === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center justify-center">
      <motion.button
        type="button"
        onClick={onSeatClass}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 rounded-full bg-primary px-5 py-1.5 font-semibold text-primary-foreground shadow-sm shadow-primary/30"
        style={{ fontSize: 'clamp(0.75rem, 1.5vmin, 1rem)' }}
      >
        <GraduationCap size={16} />
        Seat Class ({unseatedCount} to seat)
      </motion.button>
    </div>
  )
}
