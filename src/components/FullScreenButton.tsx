import { Maximize, Minimize } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Full screen, one tap in, one tap out (2026-10-14, the teacher: the browser's tabs, address bar
 * and bookmarks take a strip off every screen, and a teacher at a board has no F11). It is the
 * browser's own full screen, asked for from the tap, as a browser requires; Esc or the tap again
 * leaves it. The app fits whatever it is given, so the rail and the board simply grow into the
 * room. Hidden where the browser can't do it (an iPad's Safari).
 */
function useFullScreen(): [boolean, (() => void) | null] {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  useEffect(() => {
    const update = () => setOn(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return [on, null]
  const toggle = () => {
    // A refusal (a frame that may not, a second request in flight) leaves things as they are.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
  }
  return [on, toggle]
}

export function FullScreenButton({ className, size = 16, disabled }: { className?: string; size?: number; disabled?: boolean }) {
  const [on, toggle] = useFullScreen()
  if (!toggle) return null
  const label = on ? 'Leave Full Screen' : 'Full Screen'
  return (
    <button type="button" onClick={toggle} disabled={disabled} aria-label={label} title={label} className={className}>
      {on ? <Minimize size={size} /> : <Maximize size={size} />}
    </button>
  )
}
