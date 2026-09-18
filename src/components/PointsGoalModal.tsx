import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface PointsGoalModalProps {
  open: boolean
  onClose: () => void
  currentGoal: number
  onSave: (goal: number) => void
}

export function PointsGoalModal({ open, onClose, currentGoal, onSave }: PointsGoalModalProps) {
  const [value, setValue] = useState(String(currentGoal || 50))

  // Re-seed the input from the live goal each time the modal opens, so stale edits never leak in.
  useEffect(() => {
    if (open) setValue(String(currentGoal || 50))
  }, [open, currentGoal])

  function save() {
    const parsed = Math.round(Number(value))
    if (Number.isFinite(parsed) && parsed > 0) onSave(parsed)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Set Class Goal">
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="points-goal" className="text-foreground">
            Points to fill the meter
          </Label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every point awarded to a student also fills the whole class's shared meter. When it reaches this number, the
            class celebrates and the meter starts over.
          </p>
        </div>
        <Input
          id="points-goal"
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoFocus
        />
        <TactileButton active onClick={save} className="justify-center">
          Save Goal
        </TactileButton>
      </div>
    </Modal>
  )
}
