import { Volume2 } from 'lucide-react'
import { ALARM_SOUND_LABELS, playAlarm } from '../lib/sound'
import type { AlarmSound, TimerFace, TimerSettings } from '../types'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { TimerDial } from './TimerDial'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface TimerSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: TimerSettings
  onChange: (settings: TimerSettings) => void
}

const soundOrder: AlarmSound[] = ['ding', 'chime', 'bell', 'trainWhistle', 'guitar', 'rooster']

/** Pictures rather than a switch: a switch reads as on and off, and this is one timer or the other. */
const faces: { face: TimerFace; label: string }[] = [
  { face: 'flip', label: 'Flip Clock' },
  { face: 'dial', label: 'Dial' },
]

export function TimerSettingsModal({ open, onClose, settings, onChange }: TimerSettingsModalProps) {
  const dial = settings.face === 'dial'
  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Modal open={open} onClose={onClose} title="Timer Settings">
      <div className="flex flex-col gap-6">
        <section>
          <Label className="mb-2">Timer Style</Label>
          <div className="grid grid-cols-2 gap-2">
            {faces.map(({ face, label }) => (
              <TactileButton
                key={face}
                active={settings.face === face}
                onClick={() => onChange({ ...settings, face })}
                className="flex-col py-3"
              >
                {face === 'flip' ? (
                  <FlipPicture />
                ) : (
                  <TimerDial configuredSeconds={300} remainingSeconds={200} endsAt={null} timesUp={false} className="size-12" />
                )}
                {label}
              </TactileButton>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between gap-4">
          <div className={dial ? 'opacity-50' : undefined}>
            <Label htmlFor="warning-toggle" className="text-foreground">
              25% Warning
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {dial
                ? 'Only on the flip clock. The dial shows time running out already.'
                : 'Turn the clock red for the final quarter of the time.'}
            </p>
          </div>
          <Switch
            id="warning-toggle"
            checked={settings.warningEnabled}
            disabled={dial}
            onCheckedChange={(checked) => onChange({ ...settings, warningEnabled: checked })}
          />
        </section>

        <section>
          <Label className="mb-2">Alarm Sound</Label>
          <div className="grid grid-cols-2 gap-2">
            {soundOrder.map((sound) => (
              <TactileButton
                key={sound}
                active={settings.alarmSound === sound}
                onClick={() => onChange({ ...settings, alarmSound: sound })}
              >
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

/** A small flip clock for the picker: four white cards reading 05:00. */
function FlipPicture() {
  return (
    <span className="flex h-12 items-center gap-0.5" aria-hidden>
      {['0', '5', ':', '0', '0'].map((c, i) =>
        c === ':' ? (
          <span key={i} className="px-px text-base font-black">
            :
          </span>
        ) : (
          <span
            key={i}
            className="flex h-9 w-6 items-center justify-center rounded-md bg-card font-mono text-lg font-black text-card-foreground shadow-sm"
          >
            {c}
          </span>
        ),
      )}
    </span>
  )
}
