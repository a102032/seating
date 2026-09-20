import { useEffect, useState } from 'react'
import { RotateCcw, StarOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import type { ClassData, Student } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

export interface PickerSettingsValue {
  allowRepeats: boolean
  soundEnabled: boolean
}

interface PickersPointsModalProps {
  open: boolean
  onClose: () => void
  settings: PickerSettingsValue
  onUpdateSettings: (patch: Partial<PickerSettingsValue>) => void
  studentPickCounts: Map<string, number>
  columnPickCounts: Map<number, number>
  studentsById: Map<string, Student>
  activeClass: ClassData
  onSaveGoal: (goal: number, starsPerClassPoint: number) => void
  onResetClassGoal: () => void
  onResetStars: () => void
  onReset: () => void
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-1 items-start justify-between gap-3 rounded-2xl border border-black/10 p-3 dark:border-white/10">
      <div className="min-w-0">
        <Label className="text-foreground">{label}</Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </div>
  )
}

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex-1">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        className="mt-1"
      />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function PickersPointsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  studentPickCounts,
  columnPickCounts,
  studentsById,
  activeClass,
  onSaveGoal,
  onResetClassGoal,
  onResetStars,
  onReset,
}: PickersPointsModalProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [confirmingResetGoal, setConfirmingResetGoal] = useState(false)
  const [confirmingResetStars, setConfirmingResetStars] = useState(false)
  const [goal, setGoal] = useState('')
  const [starsPer, setStarsPer] = useState('')

  // Re-seed from the live class each time it opens, so a half-typed edit never leaks back in.
  useEffect(() => {
    if (!open) return
    setGoal(String(activeClass.pointsGoal || 50))
    setStarsPer(String(activeClass.starsPerClassPoint || 1))
  }, [open, activeClass.pointsGoal, activeClass.starsPerClassPoint])

  const totalStars = activeClass.students.reduce((sum, st) => sum + (st.points ?? 0), 0)
  const goalNum = Math.max(1, Number(goal) || 1)
  const perNum = Math.max(1, Number(starsPer) || 1)

  function commitGoal() {
    onSaveGoal(goalNum, perNum)
  }

  const studentEntries = Array.from(studentPickCounts.entries())
    .map(([id, count]) => ({ id, count, name: studentsById.get(id)?.name }))
    .filter((e): e is { id: string; count: number; name: string } => Boolean(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const rowEntries = Array.from(columnPickCounts.entries())
    .map(([column, count]) => ({ column, count }))
    .sort((a, b) => a.column - b.column)

  const hasHistory = studentEntries.length > 0 || rowEntries.length > 0

  return (
    <>
      <Modal
        open={open && !confirmingReset && !confirmingResetGoal && !confirmingResetStars}
        onClose={onClose}
        title="Pickers &amp; Points"
        wide
      >
        {/* No h-full here: the dialog body is the scroller, and forcing this to its height
            made the sections fight over the space and spill their text over each other. */}
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <ToggleRow
                label="Allow Repeats"
                description="Off: everyone gets picked once before anyone repeats, and the same for rows."
                checked={settings.allowRepeats}
                onCheckedChange={(checked) => onUpdateSettings({ allowRepeats: checked })}
              />
              <ToggleRow
                label="Picker Sound"
                description="A sound plays as students or rows flash by during a pick."
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => onUpdateSettings({ soundEnabled: checked })}
              />
            </div>

            <Label>Pick History (this session)</Label>
            {!hasHistory ? (
              <p className="rounded-2xl border border-black/10 p-4 text-center text-muted-foreground dark:border-white/10">
                No one&apos;s been picked yet.
              </p>
            ) : (
              <ScrollArea className="max-h-44 rounded-2xl border border-black/10 dark:border-white/10">
                <div className="flex flex-col gap-3 p-3">
                  {studentEntries.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Students</p>
                      <div className="flex flex-wrap gap-1.5">
                        {studentEntries.map((e) => (
                          <Badge key={e.id} variant="secondary">
                            {e.name} &times;{e.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {rowEntries.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Rows</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rowEntries.map((e) => (
                          <Badge key={e.column} variant="secondary">
                            Row {e.column + 1} &times;{e.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            <TactileButton
              variant="danger"
              disabled={!hasHistory}
              className="w-full justify-center"
              onClick={() => setConfirmingReset(true)}
            >
              <RotateCcw size={16} /> Reset All Pick Counts
            </TactileButton>
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <div>
              <Label className="text-foreground">Class Goal</Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Stars students earn fill the class meter together. Leftovers carry over, so nothing is lost.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <NumberField
                id="stars-per"
                label="Stars for 1 class point"
                hint={perNum === 1 ? 'Every star moves the meter.' : `${perNum} stars = 1 class point.`}
                value={starsPer}
                onChange={setStarsPer}
              />
              <NumberField
                id="goal"
                label="Class points to fill the goal"
                hint={`${goalNum * perNum} stars for a full meter.`}
                value={goal}
                onChange={setGoal}
              />
            </div>
            <TactileButton active onClick={commitGoal} className="justify-center">
              Save Class Goal
            </TactileButton>
            <div className="flex flex-col gap-1.5 sm:flex-row">
              <TactileButton
                variant="danger"
                disabled={(activeClass.classPoints ?? 0) === 0 && (activeClass.goalRemainder ?? 0) === 0}
                className="flex-1 justify-center"
                onClick={() => setConfirmingResetGoal(true)}
              >
                <RotateCcw size={16} /> Reset Class Goal
              </TactileButton>
              <TactileButton
                variant="danger"
                disabled={totalStars === 0}
                className="flex-1 justify-center"
                onClick={() => setConfirmingResetStars(true)}
              >
                <StarOff size={16} /> Reset All Stars
              </TactileButton>
            </div>
          </section>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmingResetGoal}
        title="Reset the class goal meter?"
        message={`This empties "${activeClass.name}"'s shared meter back to 0. Each student keeps their own stars.`}
        confirmLabel="Yes, Reset Meter"
        cancelLabel="No"
        onCancel={() => setConfirmingResetGoal(false)}
        onConfirm={() => {
          onResetClassGoal()
          setConfirmingResetGoal(false)
        }}
      />

      <ConfirmModal
        open={confirmingResetStars}
        title="Reset everyone's stars?"
        message={`This sets every student in "${activeClass.name}" back to 0 stars. The class goal meter is left where it is.`}
        confirmLabel="Yes, Reset Stars"
        cancelLabel="No"
        onCancel={() => setConfirmingResetStars(false)}
        onConfirm={() => {
          onResetStars()
          setConfirmingResetStars(false)
        }}
      />

      <ConfirmModal
        open={confirmingReset}
        title="Reset All Pick Counts?"
        message="This puts every student and row back to being picked zero times this session. This can't be undone."
        confirmLabel="Yes, Reset"
        cancelLabel="No"
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          onReset()
          setConfirmingReset(false)
        }}
      />
    </>
  )
}
