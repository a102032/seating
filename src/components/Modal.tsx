import clsx from 'clsx'
import { useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { clampPlace, loadPlace, MIDDLE, placeStyle, savePlace, type WindowPlace } from '../lib/studentWindow'
import { MoveHandIcon } from './MoveHandIcon'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  size?: 'default' | 'wide' | 'xl'
  /** Hold one height whatever is inside, for a modal with tabs: switching must not resize it. */
  fixedHeight?: boolean
  /** A button beside the title, for an action that belongs to the whole window rather than one tab. */
  headerAction?: ReactNode
  /**
   * A window a child uses at the board (the avatar picker, "get out of line?"): its title strip
   * has the hand, and a finger held on it moves the window, so the teacher can bring it within a
   * small child's reach. Every such window opens where the last one was put (`lib/studentWindow`).
   * Anything new a child taps in a window should set this.
   */
  studentWindow?: boolean
}

const sizeClassNames = {
  default: 'max-w-lg',
  wide: 'max-w-3xl',
  // Held a margin off the screen's edges: at 1024 wide it filled the width exactly, and its
  // frame (and Chalkboard's wooden one) ran off both sides.
  xl: 'max-w-[min(64rem,calc(100vw-2rem))]',
}

function keepOpenForGuide(e: Event) {
  if ((e.target as Element | null)?.closest?.('[data-guide-bubble]')) e.preventDefault()
}

export function Modal({ open, title, onClose, children, wide, size, fixedHeight, headerAction, studentWindow }: ModalProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const move = useMoveStrip(studentWindow === true, open, windowRef)
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        ref={studentWindow ? windowRef : undefined}
        style={move.style}
        className={clsx(sizeClassNames[size ?? (wide ? 'wide' : 'default')], fixedHeight && 'h-[min(90vh,52rem)]')}
        // The guided setup's bubble sits outside the window it points into: a tap on it is not
        // a tap outside the window, which would close it.
        onPointerDownOutside={keepOpenForGuide}
        onInteractOutside={keepOpenForGuide}
        onFocusOutside={keepOpenForGuide}
      >
        <DialogHeader
          className={clsx(
            (headerAction || studentWindow) && 'flex-row items-center gap-4',
            // touch-none: a finger sliding on the strip moves the window rather than scrolling.
            studentWindow && 'cursor-grab touch-none select-none gap-3 pr-14',
          )}
          data-move-strip={studentWindow ? '' : undefined}
          {...move.handlers}
        >
          {studentWindow && (
            <span className="shrink-0 text-muted-foreground" title="Hold and slide to move it">
              <MoveHandIcon className="size-7" />
            </span>
          )}
          <DialogTitle>{title}</DialogTitle>
          {headerAction}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The title strip of a child's window moves it, as the timer's strip does: a finger held on it
 * moves the window at once, only the first finger counts (the board's second touch can't pull it),
 * the window never goes past the screen's edge, and where it is let go is kept for next time. The
 * slide goes straight onto the window, not through React: it is many moves a second.
 */
function useMoveStrip(on: boolean, open: boolean, ref: RefObject<HTMLDivElement | null>) {
  // Where the last child's window was put, read afresh each time one opens (a window may stay
  // mounted between children).
  const [place, setPlace] = useState<WindowPlace>(() => (on ? loadPlace() : MIDDLE))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && on) setPlace(loadPlace())
  }
  const slide = useRef<{ id: number; x0: number; y0: number; from: WindowPlace; to: WindowPlace } | null>(null)
  if (!on) return { style: undefined, handlers: {} }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (slide.current || !e.isPrimary || e.button > 0) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const freeW = window.innerWidth - r.width
    const freeH = window.innerHeight - r.height
    const from = { x: freeW > 0 ? clampPlace(r.left / freeW) : 0.5, y: freeH > 0 ? clampPlace(r.top / freeH) : 0.5 }
    slide.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from, to: from }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Already let go.
    }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = slide.current
    const el = ref.current
    if (!s || !el || e.pointerId !== s.id) return
    const freeW = window.innerWidth - el.offsetWidth
    const freeH = window.innerHeight - el.offsetHeight
    s.to = {
      x: freeW > 0 ? clampPlace(s.from.x + (e.clientX - s.x0) / freeW) : 0.5,
      y: freeH > 0 ? clampPlace(s.from.y + (e.clientY - s.y0) / freeH) : 0.5,
    }
    Object.assign(el.style, placeStyle(s.to))
  }
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const s = slide.current
    if (!s || e.pointerId !== s.id) return
    slide.current = null
    if (s.to === s.from) return
    savePlace(s.to)
    setPlace(s.to)
  }
  return {
    style: placeStyle(place),
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  }
}
