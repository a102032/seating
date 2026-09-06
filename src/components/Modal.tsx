import type { ReactNode } from 'react'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  size?: 'default' | 'wide' | 'xl'
}

const sizeClassNames = {
  default: 'max-w-lg',
  wide: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export function Modal({ open, title, onClose, children, wide, size }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={sizeClassNames[size ?? (wide ? 'wide' : 'default')]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  )
}
