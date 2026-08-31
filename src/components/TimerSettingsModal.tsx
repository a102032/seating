import { Volume2 } from 'lucide-react'
import { ALARM_SOUND_LABELS, playAlarm } from '../lib/sound'
import type { AlarmSound, TimerSettings } from '../types'
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
        <section className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-neutral-800 dark:text-neutral-100">25% Warning</p>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">Turn the clock red for the final quarter of the time.</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...settings, warningEnabled: !settings.warningEnabled })}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              settings.warningEnabled ? 'bg-red-500' : 'bg-black/15 dark:bg-white/15'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                settings.warningEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </section>

        <section>
          <p className="mb-2 font-semibold text-neutral-800 dark:text-neutral-100">Alarm Sound</p>
          <div className="grid grid-cols-2 gap-2">
            {soundOrder.map((sound) => (
              <button
                key={sound}
                type="button"
                onClick={() => onChange({ ...settings, alarmSound: sound })}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 font-semibold transition-colors ${
                  settings.alarmSound === sound
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-black/10 bg-white text-neutral-600 hover:bg-black/[0.03] dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                {ALARM_SOUND_LABELS[sound]}
              </button>
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
