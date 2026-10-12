import { useEffect, useState } from 'react'
import { MAX_SAVED_GROUPS } from '../lib/groups'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface SaveGroupsModalProps {
  open: boolean
  onClose: () => void
  /** The name of the saved groups these came from, kept in the box, or empty for new ones. */
  savedName: string | null
  /** The class already keeps the most saved groups, and these are new ones. */
  full: boolean
  onSave: (name: string) => void
}

/**
 * Save the groups on the board to use again, under a name the teacher types (2026-10-12, the
 * teacher: a name is needed to find them again, and a board brings up its own keyboard; groups
 * are mostly made ahead at a laptop anyway). Groups that came from saved ones are saved back
 * into them, under the name in the box.
 */
export function SaveGroupsModal({ open, onClose, savedName, full, onSave }: SaveGroupsModalProps) {
  const [name, setName] = useState('')
  useEffect(() => {
    if (open) setName(savedName ?? '')
  }, [open, savedName])

  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  const blocked = full && savedName === null
  const canSave = name.trim().length > 0 && !blocked
  const save = () => {
    if (!canSave) return
    onSave(name.trim())
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={savedName === null ? 'Save These Groups' : `Save "${savedName}"`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {blocked ? (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
            A class can keep {MAX_SAVED_GROUPS} saved groups. Remove one in Group Activity first.
          </p>
        ) : (
          <div>
            <Label htmlFor="saved-groups-name" className="mb-2">
              Name
            </Label>
            <Input
              id="saved-groups-name"
              value={name}
              maxLength={40}
              autoFocus
              autoComplete="off"
              placeholder="Writing groups"
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-lg"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {savedName === null ? 'Who is in each group is kept. Points are not.' : 'Your changes are kept in these groups.'}
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <TactileButton type="button" onClick={onClose}>
            Cancel
          </TactileButton>
          {!blocked && (
            <TactileButton type="submit" active={canSave} disabled={!canSave}>
              Save
            </TactileButton>
          )}
        </div>
      </form>
    </Modal>
  )
}
