import { useCallback, useEffect, useState } from 'react'

/**
 * Chrome and Edge's always-on-top window (Document Picture-in-Picture): a small window of our
 * own that floats over every other app, the lesson included, and can be moved and resized.
 * TypeScript's DOM types don't have it yet.
 */
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
  readonly window: Window | null
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

/** Firefox and Safari have no floating window, so the Float button isn't offered there. */
export const canFloat = typeof window !== 'undefined' && 'documentPictureInPicture' in window

/**
 * The floating window starts as a blank page, so it gets a copy of this one's styles: the
 * theme's colours, the keyframes and the fonts. A stylesheet from another site (Google Fonts)
 * can't be read, only linked, which loads the same fonts.
 */
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement('style')
      style.textContent = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      target.head.appendChild(style)
    } catch {
      if (!sheet.href) continue
      const link = target.createElement('link')
      link.rel = 'stylesheet'
      link.href = sheet.href
      target.head.appendChild(link)
    }
  }
}

/**
 * Opens and closes the floating window. What goes in it is rendered by the page, through a
 * portal, so it is the same app with the same class - a point given there lands here.
 */
export function useFloatingWindow(theme: string) {
  const [win, setWin] = useState<Window | null>(null)

  const open = useCallback(async (size: { width: number; height: number }) => {
    const api = window.documentPictureInPicture
    if (!api) return
    let next: Window
    try {
      next = await api.requestWindow(size)
    } catch {
      // Refused (it has to come straight from a tap), or switched off by the school's browser policy.
      return
    }
    next.document.documentElement.lang = 'en'
    next.document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') ?? '')
    next.document.title = 'Class Goal'
    copyStyles(next.document)
    // However it closes - its own close button, its back-to-tab button, or ours - this is the
    // one place that hears about it.
    next.addEventListener('pagehide', () => setWin((current) => (current === next ? null : current)))
    setWin(next)
  }, [])

  const close = useCallback(() => {
    win?.close()
  }, [win])

  useEffect(() => {
    win?.document.documentElement.setAttribute('data-theme', theme)
  }, [win, theme])

  return { win, open, close }
}

function readInFront() {
  return document.visibilityState === 'visible' && document.hasFocus()
}

/**
 * Whether the app is the thing in front of the class: showing, and the window last tapped.
 * A tap in the floating window takes the focus with it, so while the teacher is giving points
 * from there over a lesson, this is false - which is what holds the goal's celebration back
 * until the app itself is showing.
 */
export function useAppInFront() {
  const [inFront, setInFront] = useState(readInFront)
  useEffect(() => {
    const update = () => setInFront(readInFront())
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return inFront
}
