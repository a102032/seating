import { X } from 'lucide-react'
import { useState } from 'react'

/**
 * One quiet line above the desks, in the slot Seat Class and Choose Your Avatar use. While Swap
 * Seats or Attendance is on it says what a desk tap does now, with Done (2026-10-14, the teacher:
 * a teacher new to the app saw only a lit button, and side desks appearing with no word of why).
 */
export function ModeHint({ mode, onDone }: { mode: 'swap' | 'attendance'; onDone: () => void }) {
  return (
    <HintBar>
      <span className="min-w-0 truncate font-bold">
        {mode === 'swap' ? 'Tap two desks to swap them.' : 'Tap a desk to mark a student away.'}
      </span>
      <button type="button" onClick={onDone} className="hint-button shrink-0">
        Done
      </button>
    </HintBar>
  )
}

const OFFER_KEY = 'seating-chart-tour-offer-v1'

/**
 * The tour, offered once on a board (2026-10-14, the teacher: other teachers are trying the app,
 * the rail has no words, and the tour was two taps deep in Class Settings' Help). It goes when
 * either button is tapped, and never on a timer; a board where a tour was ever started doesn't
 * offer it.
 */
export function useTourOffer(): [boolean, () => void] {
  const [shown, setShown] = useState(() => {
    try {
      return !localStorage.getItem(OFFER_KEY) && !localStorage.getItem('seating-chart-tour-v1')
    } catch {
      // A board that can't store it would offer it every time, so it doesn't offer it at all.
      return false
    }
  })
  const dismiss = () => {
    try {
      localStorage.setItem(OFFER_KEY, 'true')
    } catch {
      // Gone for this visit at least.
    }
    setShown(false)
  }
  return [shown, dismiss]
}

export function TourOffer({ onTour, onDismiss }: { onTour: () => void; onDismiss: () => void }) {
  return (
    <HintBar>
      <span className="min-w-0 truncate font-bold">New here? Take a tour of the app.</span>
      <button
        type="button"
        onClick={() => {
          onDismiss()
          onTour()
        }}
        className="hint-button shrink-0"
      >
        Take the tour
      </button>
      <button type="button" onClick={onDismiss} aria-label="No thanks" title="No thanks" className="hint-button shrink-0 !px-2">
        <X className="size-4" />
      </button>
    </HintBar>
  )
}

function HintBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-board-hint=""
      className="mx-auto flex h-9 max-w-full shrink-0 items-center justify-center gap-3 rounded-2xl border border-border bg-card/80 px-4 text-card-foreground shadow-sm"
      style={{ fontSize: 'clamp(0.85rem, 1.9vmin, 1.15rem)' }}
    >
      {children}
    </div>
  )
}
