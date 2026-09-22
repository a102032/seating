import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { playDeleteCoverOpen } from '../lib/sound'

const AUTO_RECLOSE_MS = 3500

interface DangerCoverProps {
  open: boolean
  onOpen: () => void
  onAutoClose: () => void
  children: ReactNode
  className?: string
  /**
   * Two lines of chalk scrawled above the cover, with an arrow down to it - so a teacher
   * knows what's under the hazard stripes before lifting them. The cover is a mystery
   * until it's tapped, and "tap to unlock" doesn't say unlock what.
   */
  note?: [string, string]
}

/** A hazard-striped safety cover that flips open (like a missile-launch button guard) before its child button becomes tappable, and re-covers itself if left unused. */
export function DangerCover({ open, onOpen, onAutoClose, children, className, note }: DangerCoverProps) {
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(onAutoClose, AUTO_RECLOSE_MS)
    return () => clearTimeout(timer)
  }, [open, onAutoClose])

  function handleOpen() {
    playDeleteCoverOpen()
    onOpen()
  }

  return (
    <div
      className={clsx('relative shrink-0 rounded-2xl p-1', className)}
      style={{
        perspective: 400,
        backgroundImage: 'repeating-linear-gradient(45deg, #facc15 0 7px, #18181b 7px 14px)',
      }}
    >
      {note && (
        // Above and to the left, tilted, the arrow hooking down onto the cover's top edge.
        // In the chalk face the splash uses, in the foreground colour so it reads as pencil
        // on a light theme and chalk on a dark one. Hidden where the toolbar wraps.
        <div className="danger-note pointer-events-none absolute right-[38%] bottom-[calc(100%-4px)] hidden items-end gap-0.5 sm:flex" aria-hidden>
          <div
            className="text-right leading-[1.05] whitespace-nowrap text-foreground/80"
            style={{ fontFamily: "'Cabin Sketch', 'Andika', sans-serif", fontWeight: 700, fontSize: '0.95rem', transform: 'rotate(-9deg)', transformOrigin: 'bottom right' }}
          >
            {note[0]}
            <br />
            {note[1]}
          </div>
          <svg viewBox="0 0 44 46" className="danger-note-arrow h-11 w-11 shrink-0 text-foreground/80" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <filter id="note-rough">
                <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" />
                <feDisplacementMap in="SourceGraphic" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <g filter="url(#note-rough)">
              {/* A hook: out to the right, then down and in to the cover. */}
              <path className="danger-note-line" d="M3 6 C 24 2, 40 10, 33 40" pathLength="1" />
              <path className="danger-note-head" d="M25 32 L33 41 L39 30" pathLength="1" />
            </g>
          </svg>
        </div>
      )}

      <div className="rounded-xl border-2 border-red-600 bg-white p-0.5 dark:bg-neutral-900">{children}</div>

      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={handleOpen}
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
