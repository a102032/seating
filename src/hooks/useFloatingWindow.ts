import { useCallback, useEffect, useState } from 'react'
import { floatDrumsHeight } from '../lib/getReady'
import { keepLongPressMenuOut } from '../lib/noLongPressMenu'

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

/** The floating window's first size: the meter and a +1 big enough to hit on a board. */
export const FLOAT_SIZE = { width: 340, height: 180 }

/**
 * The one-row strip it shrinks to, for when it's covering too much of the lesson. A see-through
 * window was asked for, but Chrome draws this window solid; small is what a web page can do.
 * Chrome won't resize it below 240x62. It was 240 wide until Get Ready!'s star joined the count,
 * +1 and Pick in it; at 240 they didn't fit.
 */
export const FLOAT_STRIP_SIZE = { width: 290, height: 62 }

/**
 * Resize the floating window to this much room inside. resizeTo counts the title bar and
 * edges too, and they differ from one computer to the next, so they're measured first.
 */
export function resizeFloatingWindow(win: Window, size: { width: number; height: number }) {
  const frameWidth = win.outerWidth - win.innerWidth
  const frameHeight = win.outerHeight - win.innerHeight
  try {
    win.resizeTo(size.width + frameWidth, size.height + frameHeight)
  } catch {
    // Refused: it has to come straight from a tap. The teacher can still drag its edges.
  }
}

/**
 * The floating window grows for Get Ready!, in two steps, each from a tap: first a snug
 * rectangle of drums ("How long?"), then, once a drum is chosen, tall enough for the star to
 * read from the back of the room - about three quarters of the screen's height, and wide enough
 * for the star to sit in the middle with Ready!, Stop and the chest beside it. It stays well short
 * of the whole screen, so the lesson's slide - usually the instruction the class is getting ready
 * for ("page 134") - still shows beside it.
 *
 * It grows from where it sits: a page is never allowed to move this kind of window (the browsers'
 * rule, so a site can't park an always-on-top window where it passes for another program's), so
 * only the teacher can, by its title bar. `restore` puts its size back as it was.
 */
export function growForGetReady(win: Window): { toStar: () => void; restore: () => void } {
  const before = { width: win.innerWidth, height: win.innerHeight }
  const starHeight = Math.round(win.screen.availHeight * 0.72)
  const width = Math.round(Math.min(win.screen.availWidth * 0.58, starHeight * 1.45))
  resizeFloatingWindow(win, { width, height: floatDrumsHeight(width) })
  return {
    toStar: () => resizeFloatingWindow(win, { width, height: starHeight }),
    restore: () => resizeFloatingWindow(win, before),
  }
}

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
    // A finger held on +1 or Pick is a right-click on a touch board: no menu over the lesson.
    keepLongPressMenuOut(next.document)
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
