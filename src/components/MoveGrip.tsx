import { type PointerEvent, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Mover } from '../lib/moveExtension'
import { MoveHandIcon } from './MoveHandIcon'

/** A slide under way: where the finger started, and the window's place when it did. */
interface Slide {
  pointerId: number
  x: number
  y: number
  /** The window, by the extension's count, once it has answered. */
  id: number | null
  left: number
  top: number
  dx: number
  dy: number
  /** The finger has moved since the window last did. */
  pending: boolean
  /** A move is on its way: the next waits for it, so a fast finger never queues up a backlog. */
  busy: boolean
}

/** The width the grip takes in the strip, so the strip grows by this when it has one. */
export const GRIP_ROOM = 44

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

  function send(s: Slide) {
    if (s.id === null || s.busy || !s.pending) return
    s.pending = false
    s.busy = true
    const [left, top] = onScreen(s.left + s.dx, s.top + s.dy)
    void mover.move(s.id, left, top).then(() => {
      s.busy = false
      // The finger's last place counts even if it got there while this move was on its way.
      send(s)
    })
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
          dx: 0,
          dy: 0,
          pending: false,
          busy: false,
        }
        slide.current = s
        setSliding(true)
        void mover.find(win).then((w) => {
          if (!w) return
          s.id = w.id
          s.left = w.left
          s.top = w.top
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
        follow(e, s)
        slide.current = null
        setSliding(false)
      }}
      onPointerCancel={(e) => {
        if (slide.current?.pointerId !== e.pointerId) return
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
