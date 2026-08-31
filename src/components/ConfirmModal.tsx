import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  /** If set, the confirm button stays disabled until the teacher types this text exactly. */
  requireTypedText?: string
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  requireTypedText,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const canConfirm = !requireTypedText || typed === requireTypedText

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle size={18} />
            </span>
            <div className="flex flex-col gap-2 pt-1">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{message}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {requireTypedText && (
          <div className="pl-12">
            <Label htmlFor="confirm-typed-text" className="mb-1.5">
              Type <span className="font-bold text-neutral-700 dark:text-neutral-200">{requireTypedText}</span> to confirm
            </Label>
            <Input id="confirm-typed-text" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction disabled={!canConfirm} className={!canConfirm ? 'opacity-40' : ''} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
