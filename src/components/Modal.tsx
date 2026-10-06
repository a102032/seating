import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

export function Modal({ open, title, onClose, children, wide, size, fixedHeight, headerAction }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={clsx(sizeClassNames[size ?? (wide ? 'wide' : 'default')], fixedHeight && 'h-[min(90vh,52rem)]')}
        // The guided setup's bubble sits outside the window it points into: a tap on it is not
        // a tap outside the window, which would close it.
        onPointerDownOutside={keepOpenForGuide}
        onInteractOutside={keepOpenForGuide}
        onFocusOutside={keepOpenForGuide}
      >
        <DialogHeader className={headerAction ? 'flex-row items-center gap-4' : undefined}>
          <DialogTitle>{title}</DialogTitle>
          {headerAction}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  )
}
