import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

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
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle size={18} />
          </span>
          <p className="pt-1.5 text-neutral-600 dark:text-neutral-300">{message}</p>
        </div>

        {requireTypedText && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              Type <span className="font-bold text-neutral-700 dark:text-neutral-200">{requireTypedText}</span> to confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <TactileButton onClick={onCancel}>{cancelLabel}</TactileButton>
          <TactileButton variant="danger" disabled={!canConfirm} className={!canConfirm ? 'opacity-40' : ''} onClick={onConfirm}>
            {confirmLabel}
          </TactileButton>
        </div>
      </div>
    </Modal>
  )
}
