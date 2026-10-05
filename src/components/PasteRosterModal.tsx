import { ClipboardPaste, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parsePastedRoster } from '../lib/csv'
import type { Student } from '../types'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface PasteRosterModalProps {
  open: boolean
  /** Text already pasted (Ctrl+V on the Students tab), or empty to wait for it here. */
  initialText: string
  onClose: () => void
  onAdd: (students: Omit<Student, 'id'>[]) => void
}

/**
 * A class from a list copied out of Excel or a Google Sheet - the school's roster, say - with no
 * file to save: paste it, see the names the app found, and add them. The rushed teacher's way in
 * (lesson one: five minutes before the bell, with the roster in Excel). The list is shown before
 * it is added, so a paste of the wrong thing never fills the class with nonsense.
 */
export function PasteRosterModal({ open, initialText, onClose, onAdd }: PasteRosterModalProps) {
  const [text, setText] = useState(initialText)
  const [clipboardBlocked, setClipboardBlocked] = useState(false)
  // Each opening starts from what was just pasted (or nothing), not the last list.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText(initialText)
      setClipboardBlocked(false)
    }
  }

  const students = useMemo(() => parsePastedRoster(text), [text])
  const hasHomerooms = students.some((s) => s.homeroom)
  const hasGenders = students.some((s) => s.gender !== 'unspecified')
  // A board has no keyboard for Ctrl+V: the button reads what was copied, once the browser allows it.
  const canReadClipboard = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

  async function pasteFromClipboard() {
    try {
      const copied = await navigator.clipboard.readText()
      if (copied.trim()) setText(copied)
    } catch {
      setClipboardBlocked(true)
    }
  }

  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Modal open={open} onClose={onClose} title="Paste Your Student List" wide>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          In Excel or Google Sheets, select the names and homeroom numbers, copy them (Ctrl+C), then paste here (Ctrl+V).
        </p>
        <div className="flex items-start gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            placeholder="Paste here"
            spellCheck={false}
            className="h-24 min-w-0 flex-1 resize-none rounded-xl border border-black/10 bg-card p-2.5 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10"
          />
          {canReadClipboard && (
            <TactileButton onClick={() => void pasteFromClipboard()} className="shrink-0" title="Paste what you copied">
              <ClipboardPaste size={18} /> Paste
            </TactileButton>
          )}
        </div>
        {clipboardBlocked && (
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            The browser didn't allow it. Tap in the box and press Ctrl+V.
          </p>
        )}

        {text.trim() !== '' &&
          (students.length === 0 ? (
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              No names found. Copy a column of names and paste again.
            </p>
          ) : (
            <>
              <p className="font-semibold text-foreground">
                {students.length} {students.length === 1 ? 'student' : 'students'}
                {!hasHomerooms && <span className="font-normal text-muted-foreground"> (no homeroom numbers: you can add them later)</span>}
              </p>
              <ScrollArea className="max-h-[min(14rem,30vh)] rounded-xl border border-black/10 dark:border-white/10">
                <div className="grid grid-cols-2 gap-x-4 px-3 py-1.5 sm:grid-cols-3">
                  {students.map((s, i) => (
                    <div key={i} className="flex min-w-0 items-baseline gap-2 py-0.5 text-sm">
                      <span className="truncate font-semibold text-foreground">{s.name}</span>
                      {hasHomerooms && <span className="shrink-0 text-muted-foreground">{s.homeroom || '-'}</span>}
                      {hasGenders && s.gender !== 'unspecified' && (
                        <span className="shrink-0 text-muted-foreground">{s.gender === 'boy' ? 'Boy' : 'Girl'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ))}

        <div className="flex justify-end">
          <TactileButton variant="primary" disabled={students.length === 0} onClick={() => onAdd(students)}>
            <Plus size={18} />{' '}
            {students.length === 0 ? 'Add Students' : `Add ${students.length} ${students.length === 1 ? 'Student' : 'Students'}`}
          </TactileButton>
        </div>
      </div>
    </Modal>
  )
}
