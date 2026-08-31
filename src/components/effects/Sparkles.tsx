import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
  repeatDelay: number
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 0.6,
    duration: 0.7 + Math.random() * 0.7,
    repeatDelay: Math.random() * 1.4,
  }))
}

/**
 * Aceternity-style "Sparkles" particle burst: a handful of small twinkling dots that
 * fade and scale in and out at random. Reimplemented here with Framer Motion (no
 * canvas/tsParticles dependency) since ui.aceternity.com's registry wasn't reachable
 * to pull the original component in this build environment.
 */
export function Sparkles({ count = 16 }: { count?: number }) {
  const particles = useMemo(() => makeParticles(count), [count])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-yellow-200"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            boxShadow: '0 0 6px 2px rgba(253, 224, 71, 0.9)',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: p.repeatDelay,
          }}
        />
      ))}
    </div>
  )
}
