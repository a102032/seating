import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, GraduationCap } from 'lucide-react'

interface SeatClassBannerProps {
  totalStudents: number
  unseatedCount: number
  onSeatClass: () => void
}

export function SeatClassBanner({ totalStudents, unseatedCount, onSeatClass }: SeatClassBannerProps) {
  if (totalStudents === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {unseatedCount > 0 ? (
          <motion.button
            key="seat"
            type="button"
            onClick={onSeatClass}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-1.5 font-semibold text-white shadow-sm shadow-blue-600/30 dark:bg-blue-500"
            style={{ fontSize: 'clamp(0.75rem, 1.5vmin, 1rem)' }}
          >
            <GraduationCap size={16} />
            Seat Class ({unseatedCount} to seat)
          </motion.button>
        ) : (
          <motion.div
            key="seated"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-1.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            style={{ fontSize: 'clamp(0.7rem, 1.3vmin, 0.9rem)' }}
          >
            <CheckCircle2 size={15} />
            Class Seated
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
