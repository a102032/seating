import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export type ToastMessage = { id: number; text: string }

/** A short line at the foot of the board ("Saved as Writing."), gone after five seconds or a tap. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  return { toast, show: (text: string) => setToast({ id: Date.now(), text }), clear: () => setToast(null) }
}

export function Toast({ toast, onClear }: { toast: ToastMessage | null; onClear: () => void }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          onClick={onClear}
          className="fixed bottom-5 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-black/10 bg-card px-5 py-3 text-center font-semibold text-card-foreground shadow-2xl dark:border-white/10"
        >
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
