import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import type { Student } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

export interface PickerSettingsValue {
  allowRepeatsStudents: boolean
  allowRepeatsRows: boolean
  soundEnabled: boolean
}

interface PickerSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: PickerSettingsValue
  onUpdateSettings: (patch: Partial<PickerSettingsValue>) => void
  studentPickCounts: Map<string, number>
  columnPickCounts: Map<number, number>
  studentsById: Map<string, Student>
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
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-neutral-800 dark:text-neutral-100">{label}</Label>
        <p className="mt-0.5 text-sm text-neutral-400 dark:text-neutral-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function PickerSettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  studentPickCounts,
  columnPickCounts,
  studentsById,
  onReset,
}: PickerSettingsModalProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)

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
      <Modal open={open && !confirmingReset} onClose={onClose} title="Random Picker Settings" wide>
        <div className="flex h-full min-h-0 flex-col gap-5">
          <section className="flex shrink-0 flex-col gap-4">
            <ToggleRow
              label="Allow Repeats (Students)"
              description="Off: every student gets picked once before anyone repeats. On: pure random, same student can be picked again right away."
              checked={settings.allowRepeatsStudents}
              onCheckedChange={(checked) => onUpdateSettings({ allowRepeatsStudents: checked })}
            />
            <ToggleRow
              label="Allow Repeats (Rows)"
              description="Off: every row gets picked once before any row repeats. On: pure random, same row can come up again right away."
              checked={settings.allowRepeatsRows}
              onCheckedChange={(checked) => onUpdateSettings({ allowRepeatsRows: checked })}
            />
            <ToggleRow
              label="Picker Sound"
              description="Soft tones play as students or rows flash by during a pick."
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => onUpdateSettings({ soundEnabled: checked })}
            />
          </section>

          <Separator />

          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <Label className="shrink-0">Pick History (this session)</Label>

            {!hasHistory ? (
              <p className="rounded-2xl border border-black/10 p-4 text-center text-neutral-400 dark:border-white/10 dark:text-neutral-500">
                No one's been picked yet.
              </p>
            ) : (
              <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-black/10 p-3 dark:border-white/10">
                <div className="flex flex-col gap-3">
                  {studentEntries.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Students</p>
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
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Rows</p>
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
          </section>

          <section className="shrink-0">
            <TactileButton
              variant="danger"
              disabled={!hasHistory}
              className={!hasHistory ? 'w-full opacity-40' : 'w-full'}
              onClick={() => setConfirmingReset(true)}
            >
              <RotateCcw size={16} /> Reset All Pick Counts
            </TactileButton>
          </section>
        </div>
      </Modal>

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
