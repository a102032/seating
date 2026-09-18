import type { AfterFlip, FlipDeckSettings } from '../hooks/useFlipDeck'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface FlipDeckSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: FlipDeckSettings
  onChange: (patch: Partial<FlipDeckSettings>) => void
}

const AFTER_FLIP_OPTIONS: { id: AfterFlip; label: string; help: string }[] = [
  { id: 'stay', label: 'Leave Face Up', help: 'Picked cards stay showing until you shuffle.' },
  { id: 'flipBack', label: 'Flip Back Over', help: 'The card turns back down a couple of seconds later, so they can be picked again.' },
  { id: 'setAside', label: 'Set Aside', help: 'The card flies to the discard pile and the rest close up the gap.' },
]

export function FlipDeckSettingsModal({ open, onClose, settings, onChange }: FlipDeckSettingsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Flip Card Settings">
      <div className="flex flex-col gap-6">
        <section>
          <Label className="mb-2">After a Card Is Picked</Label>
          <div className="flex flex-col gap-2">
            {AFTER_FLIP_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange({ afterFlip: option.id })}
                className={
                  settings.afterFlip === option.id
                    ? 'rounded-xl border-2 border-primary bg-primary/10 px-3 py-2 text-left'
                    : 'rounded-xl border-2 border-transparent bg-secondary px-3 py-2 text-left hover:bg-accent'
                }
              >
                <span className="font-semibold text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{option.help}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="gender-colors" className="text-foreground">
              Colour Backs by Gender
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Blue backs for boys, pink for girls - so you can tell the class to pick only one colour.
            </p>
          </div>
          <Switch
            id="gender-colors"
            checked={settings.genderColors}
            onCheckedChange={(checked) => onChange({ genderColors: checked })}
          />
        </section>

        <section className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="flip-sound" className="text-foreground">
              Card Sounds
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">Shuffling, dealing and flipping sound effects.</p>
          </div>
          <Switch id="flip-sound" checked={settings.soundEnabled} onCheckedChange={(checked) => onChange({ soundEnabled: checked })} />
        </section>

        <TactileButton active onClick={onClose} className="justify-center">
          Done
        </TactileButton>
      </div>
    </Modal>
  )
}
