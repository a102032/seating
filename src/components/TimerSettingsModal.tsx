import { Volume2 } from 'lucide-react'
import { ALARM_SOUND_LABELS, playAlarm } from '../lib/sound'
import type { AlarmSound, TimerSettings } from '../types'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface TimerSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: TimerSettings
  onChange: (settings: TimerSettings) => void
}

const soundOrder: AlarmSound[] = ['ding', 'chime', 'bell', 'trainWhistle', 'guitar', 'rooster']

export function TimerSettingsModal({ open, onClose, settings, onChange }: TimerSettingsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Timer Settings">
      <div className="flex flex-col gap-6">
        <section className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="warning-toggle" className="text-foreground">
              25% Warning
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">Turn the clock red for the final quarter of the time.</p>
          </div>
          <Switch
            id="warning-toggle"
            checked={settings.warningEnabled}
            onCheckedChange={(checked) => onChange({ ...settings, warningEnabled: checked })}
          />
        </section>

        <section>
          <Label className="mb-2">Alarm Sound</Label>
          <div className="grid grid-cols-2 gap-2">
            {soundOrder.map((sound) => (
              <TactileButton key={sound} active={settings.alarmSound === sound} onClick={() => onChange({ ...settings, alarmSound: sound })}>
                {ALARM_SOUND_LABELS[sound]}
              </TactileButton>
            ))}
          </div>
          <TactileButton className="mt-3" onClick={() => playAlarm(settings.alarmSound)}>
            <Volume2 size={18} /> Preview Sound
          </TactileButton>
        </section>
      </div>
    </Modal>
  )
}
