import { motion } from 'framer-motion'
import { Sparkle } from 'lucide-react'

interface SparkleSpec {
  angle: number
  radius: number
  size: number
  delay: number
}

const SPARKLES: SparkleSpec[] = [
  { angle: 15, radius: 0.75, size: 15, delay: 0 },
  { angle: 95, radius: 0.6, size: 11, delay: 0.35 },
  { angle: 150, radius: 0.78, size: 13, delay: 0.7 },
  { angle: 205, radius: 0.65, size: 16, delay: 0.15 },
  { angle: 270, radius: 0.75, size: 11, delay: 0.55 },
  { angle: 325, radius: 0.58, size: 14, delay: 0.9 },
]

/** A ring of twinkling sparkles that slowly swirls around its parent - the parent content itself never moves. */
export function AvatarSparkles() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
    >
      {SPARKLES.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180
        const x = 50 + Math.cos(rad) * s.radius * 50
        const y = 50 + Math.sin(rad) * s.radius * 50
        return (
          <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, marginLeft: -s.size / 2, marginTop: -s.size / 2 }}>
            <motion.span
              className="block text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.9)] dark:text-amber-300"
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1.15, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
            >
              <Sparkle size={s.size} fill="currentColor" strokeWidth={0} />
            </motion.span>
          </div>
        )
      })}
    </motion.div>
  )
}
