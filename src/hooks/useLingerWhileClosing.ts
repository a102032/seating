import { useEffect, useState } from 'react'

/** A touch longer than the dialogs' 200ms fade and zoom out (ui/dialog.tsx). */
const CLOSE_ANIMATION_MS = 300

/**
 * Whether a modal's contents need building: while it's open, and for the moment after it
 * closes so its fade-out still has something in it.
 *
 * The app keeps every modal mounted and passes `open`, and a component builds its whole body
 * on every render whether or not it's showing - Class Settings built the roster and a month
 * of attendance on every desk tap. A modal returns null once this goes false, after its hooks.
 */
export function useLingerWhileClosing(open: boolean): boolean {
  const [lingering, setLingering] = useState(false)
  // Adjusted during render, so the close and the linger land in the same frame.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setLingering(!open)
  }
  useEffect(() => {
    if (!lingering) return
    const timer = setTimeout(() => setLingering(false), CLOSE_ANIMATION_MS)
    return () => clearTimeout(timer)
  }, [lingering])
  return open || lingering
}
