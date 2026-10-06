import { type PointerEvent, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Mover } from '../lib/moveExtension'
import { MoveHandIcon } from './MoveHandIcon'

/** A slide under way: where the finger started, and the window's place and size when it did. */
interface Slide {
  pointerId: number
  x: number
  y: number
  /** The window, by the extension's count, once it has answered. */
  id: number | null
  left: number
  top: number
  /** Its size by the extension's count, kept the whole way. */
  width: number
  height: number
  /** Its size as its own page measures it, to see afterwards whether Chrome kept it. */
  outerWidth: number
  outerHeight: number
  dx: number
  dy: number
  /** Where the last move put it. */
  at: [number, number]
  /** The finger has moved since the window last did. */
  pending: boolean
  /** A move is on its way: the next waits for it, so a fast finger never queues up a backlog. */
  busy: boolean
  /** The finger has lifted. */
  done: boolean
}

/** The width the grip takes in the strip, so the strip grows by this when it has one. */
export const GRIP_ROOM = 44

/** The most the size asked for is ever trimmed by, so a wrong measurement can't shrink the window away. */
const MOST_TRIM = 60

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
    return { width: s.width - trim.current.w, height: s.height - trim.current.h }
  }

  function send(s: Slide) {
    if (s.id === null || s.busy) return
    if (!s.pending) {
      if (s.done) settle(s)
      return
    }
    s.pending = false
    s.busy = true
    s.at = onScreen(s.left + s.dx, s.top + s.dy)
    void mover.move(s.id, { left: s.at[0], top: s.at[1], ...sizeFor(s) }).then(() => {
      s.busy = false
      // The finger's last place counts even if it got there while this move was on its way.
      send(s)
    })
  }

  /** After the slide, once the window has settled: if Chrome grew it, put it back and remember by how much. */
  function settle(s: Slide) {
    // The floating window's own clock: the app's page behind the lesson gets about one timer a second.
    win.setTimeout(() => {
      const grewW = win.outerWidth - s.outerWidth
      const grewH = win.outerHeight - s.outerHeight
      if (s.id === null || (Math.abs(grewW) <= 1 && Math.abs(grewH) <= 1)) return
      const keep = (n: number) => Math.max(-MOST_TRIM, Math.min(MOST_TRIM, n))
      trim.current = { w: keep(trim.current.w + grewW), h: keep(trim.current.h + grewH) }
      void mover.move(s.id, { left: s.at[0], top: s.at[1], ...sizeFor(s) })
    }, 250)
  }

  function follow(e: PointerEvent, s: Slide) {
    // Screen positions, not the window's own: the window moves under the finger.
    s.dx = e.screenX - s.x
    s.dy = e.screenY - s.y
    s.pending = true
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
        e.currentTarget.setPointerCapture(e.pointerId)
        const s: Slide = {
          pointerId: e.pointerId,
          x: e.screenX,
          y: e.screenY,
          id: null,
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          outerWidth: win.outerWidth,
          outerHeight: win.outerHeight,
          dx: 0,
          dy: 0,
          at: [0, 0],
          pending: false,
          busy: false,
          done: false,
        }
        slide.current = s
        setSliding(true)
        void mover.find(win).then((w) => {
          if (!w) return
          s.id = w.id
          s.left = w.left
          s.top = w.top
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
