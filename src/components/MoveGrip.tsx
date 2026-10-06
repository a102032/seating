import { type PointerEvent, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Mover } from '../lib/moveExtension'
import { MoveHandIcon } from './MoveHandIcon'

/** A slide under way: where the finger took hold, and the window's place and size. */
interface Slide {
  pointerId: number
  /** Where the finger took hold, in the window's own page: the grip keeps that spot under the finger. */
  grab: [number, number]
  /** The window, by the extension's count, once it has answered. */
  id: number | null
  /** Its size by the extension's count, kept the whole way. */
  width: number
  height: number
  /** Where the window is: where it was found, then where each move put it. */
  at: [number, number]
  /** The finger's latest place in the window that can be trusted, not yet acted on. */
  finger: [number, number] | null
  /** Readings from before this, on the floating window's clock, may be from where the window was. */
  since: number
  /** Every place and size is a multiple of this, so it lands exactly on the screen's pixels. */
  step: number
  /** A move is on its way: the next waits for it, so a fast finger never queues up a backlog. */
  busy: boolean
  /** The window has been moved at all: a tap on the grip moves nothing, so has nothing to settle. */
  moved: boolean
  /** The finger has lifted. */
  done: boolean
}

/** The width the grip takes in the strip, so the strip grows by this when it has one. */
export const GRIP_ROOM = 44

/** The most the size asked for is ever trimmed by, so a wrong measurement can't shrink the window away. */
const MOST_TRIM = 60

/**
 * The smallest step that lands on whole screen pixels at this scaling: 1 at 100%, 200% or the
 * teacher's board's 300%, 2 at 150%, 4 at 125% or 175%. On a scaled screen Chrome rounds a window's
 * edges to whole pixels, so a window placed between them came out a pixel or two wider at one place
 * than the next: named on every move, the size made the window wobble as it slid (the teacher's
 * laptop at 150%, 2026-10-06), and its buttons shifted with it. On the grid there is nothing to round.
 */
function pixelStep(scale: number) {
  for (let k = 1; k <= 8; k++) if (Math.abs(k * scale - Math.round(k * scale)) < 0.01) return k
  return 1
}

const onStep = (n: number, step: number) => Math.round(n / step) * step

/**
 * The hand grip: a finger slid on it moves the floating window, through the Class? Yes! Move
 * extension (`lib/moveExtension.ts`). It reads the finger as pointer events in the window's own
 * page, so a finger held still first is no right-click (the app keeps that menu out everywhere),
 * which is what the window's title bar, Windows' own, can't do. Shown only when the extension is there.
 */
export function MoveGrip({ win, mover, strip }: { win: Window; mover: Mover; strip: boolean }) {
  const slide = useRef<Slide | null>(null)
  const [sliding, setSliding] = useState(false)
  /**
   * How much smaller than the size it should keep to ask for. On the teacher's laptop Chrome grew
   * the window a little every time it was moved by its place alone, until it was nearly the whole
   * screen, so every move now names the size too; if Chrome still adds to it, that is measured once
   * the window has settled after a slide - never from Chrome's answers mid-slide, which lag behind
   * and, corrected by, shrank the window instead on GitHub's Windows computer.
   */
  const trim = useRef({ w: 0, h: 0 })

  /**
   * Kept wholly on the screen: Chrome refuses a move that leaves less than half the window on it,
   * and a window half off the edge of a board is hard to reach again anyway.
   */
  function onScreen(left: number, top: number): [number, number] {
    const s = win.screen as Screen & { availLeft?: number; availTop?: number }
    const x0 = s.availLeft ?? 0
    const y0 = s.availTop ?? 0
    return [
      Math.max(x0, Math.min(left, x0 + s.availWidth - win.outerWidth)),
      Math.max(y0, Math.min(top, y0 + s.availHeight - win.outerHeight)),
    ]
  }

  function sizeFor(s: Slide) {
    return { width: onStep(s.width - trim.current.w, s.step), height: onStep(s.height - trim.current.h, s.step) }
  }

  /** On the pixel grid and wholly on the screen. */
  function placeFor(s: Slide, left: number, top: number): [number, number] {
    const [onLeft, onTop] = onScreen(left, top)
    const [maxLeft, maxTop] = onScreen(Infinity, Infinity)
    const fit = (n: number, most: number) => {
      const on = onStep(n, s.step)
      return on > most ? on - s.step : on
    }
    return [fit(onLeft, maxLeft), fit(onTop, maxTop)]
  }

  /**
   * The window's contents are held at their size while it slides, so that if Chrome still makes it
   * a pixel bigger or smaller for a moment, nothing inside shifts with it.
   */
  function hold() {
    const root = win.document.documentElement.style
    root.width = `${win.innerWidth}px`
    root.height = `${win.innerHeight}px`
    root.overflow = 'hidden'
  }

  function letGo() {
    const root = win.document.documentElement.style
    root.width = ''
    root.height = ''
    root.overflow = ''
  }

  function send(s: Slide) {
    if (s.id === null || s.busy) return
    const to = s.finger && placeFor(s, s.at[0] + s.finger[0] - s.grab[0], s.at[1] + s.finger[1] - s.grab[1])
    s.finger = null
    if (!to || (to[0] === s.at[0] && to[1] === s.at[1])) {
      if (s.done) {
        if (s.moved) settle(s)
        else letGo()
      }
      return
    }
    s.busy = true
    s.moved = true
    void mover.move(s.id, { left: to[0], top: to[1], ...sizeFor(s) }).then((got) => {
      s.busy = false
      if (got) s.at = [got.left, got.top]
      s.since = win.performance.now()
      // The finger's latest place counts even if it got there while this move was on its way.
      send(s)
    })
  }

  /** After the slide, once the window has settled: if Chrome grew it, put it back and remember by how much. */
  function settle(s: Slide) {
    // The floating window's own clock: the app's page behind the lesson gets about one timer a second.
    win.setTimeout(() => {
      letGo()
      // Against the size the slide asked for, which may be a point or two off the size it began
      // with, so that its first move landed on the pixel grid: that is meant, not growth.
      const asked = sizeFor(s)
      const grewW = win.outerWidth - asked.width
      const grewH = win.outerHeight - asked.height
      if (s.id === null || (Math.abs(grewW) <= 1 && Math.abs(grewH) <= 1)) return
      const keep = (n: number) => Math.max(-MOST_TRIM, Math.min(MOST_TRIM, n))
      trim.current = { w: keep(trim.current.w + grewW), h: keep(trim.current.h + grewH) }
      void mover.move(s.id, { left: s.at[0], top: s.at[1], ...sizeFor(s) })
    }, 250)
  }

  /**
   * Where the finger is in the window's own page, measured from where it took hold: the window
   * goes by that much from where it is. Chrome's screen position for a finger can't be used: on
   * a touch screen, with the window moving under the finger, it jumped back and forth by about
   * the height of the window's title bar, and the window with it (the teacher's laptop,
   * 2026-10-06; a mouse was smooth). A reading taken while a move was on its way may be from
   * where the window was, so only readings made after the last move landed are used.
   */
  function follow(e: PointerEvent, s: Slide) {
    if (!s.busy && e.timeStamp >= s.since) s.finger = [e.clientX, e.clientY]
    send(s)
  }

  return (
    <div
      role="button"
      aria-label="Move"
      title="Slide to move"
      data-move-grip=""
      onPointerDown={(e) => {
        if (slide.current) return
        // A made-up finger in a test can't be captured; a real one always is.
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // Then it follows only while the finger stays on the grip.
        }
        const s: Slide = {
          pointerId: e.pointerId,
          grab: [e.clientX, e.clientY],
          id: null,
          width: 0,
          height: 0,
          at: [0, 0],
          finger: null,
          since: 0,
          step: pixelStep(win.devicePixelRatio || 1),
          busy: false,
          moved: false,
          done: false,
        }
        slide.current = s
        setSliding(true)
        hold()
        void mover.find(win).then((w) => {
          if (!w) {
            letGo()
            return
          }
          s.id = w.id
          s.at = [w.left, w.top]
          s.width = w.width
          s.height = w.height
          send(s)
        })
      }}
      onPointerMove={(e) => {
        const s = slide.current
        if (s && e.pointerId === s.pointerId) follow(e, s)
      }}
      onPointerUp={(e) => {
        const s = slide.current
        if (!s || e.pointerId !== s.pointerId) return
        s.done = true
        follow(e, s)
        slide.current = null
        setSliding(false)
      }}
      onPointerCancel={(e) => {
        const s = slide.current
        if (s?.pointerId !== e.pointerId) return
        s.done = true
        if (s.id === null) letGo()
        send(s)
        slide.current = null
        setSliding(false)
      }}
      className={cn(
        'flex shrink-0 cursor-move select-none items-center justify-center text-muted-foreground transition-colors',
        strip ? 'h-full rounded-xl' : 'size-11 rounded-xl',
        sliding ? 'bg-accent text-foreground' : 'hover:bg-accent/60',
      )}
      // Nothing of the browser's own on a finger here: no scrolling, no zoom - every move is the window's.
      style={{ touchAction: 'none', width: strip ? GRIP_ROOM - 4 : undefined }}
    >
      <MoveHandIcon className={strip ? 'size-7' : 'size-8'} />
    </div>
  )
}
