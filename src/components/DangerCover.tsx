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
        // To the left of the cover, on the same row, the arrow pointing into its edge. The
        // first cut hung the note above the cover and placed it by the cover's width, so on
        // a narrower modal it slid onto the button and the arrow drifted from the words.
        // Here the words and the arrow are one line of flex, centred on the cover, and the
        // arrow's tip lands at the cover's edge whatever the width. Warm orange so it reads
        // on a white modal and a dark one alike, and looks like it belongs to the hazard
        // stripes. Hidden below md, where the toolbar wraps and there's no room beside it.
        <div
          className="danger-note pointer-events-none absolute top-1/2 right-full hidden -translate-y-1/2 items-center gap-1 pr-1.5 text-orange-600 md:flex dark:text-orange-400"
          aria-hidden
        >
          <div
            className="text-right leading-[1.05] whitespace-nowrap"
            style={{ fontFamily: "'Cabin Sketch', 'Andika', sans-serif", fontWeight: 700, fontSize: '0.95rem', transform: 'rotate(-6deg)' }}
          >
            {note[0]}
            <br />
            {note[1]}
          </div>
          <svg viewBox="0 0 40 30" className="danger-note-arrow h-8 w-10 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <filter id="note-rough">
                <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" />
                <feDisplacementMap in="SourceGraphic" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <g filter="url(#note-rough)">
              {/* Out from the words, curving into the cover. */}
              <path className="danger-note-line" d="M2 9 C 12 2, 24 5, 36 17" pathLength="1" />
              <path className="danger-note-head" d="M28 18 L37 17 L33 9" pathLength="1" />
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
