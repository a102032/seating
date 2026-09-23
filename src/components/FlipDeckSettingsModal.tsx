import type { FlipDeckSettings } from '../hooks/useFlipDeck'
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

export function FlipDeckSettingsModal({ open, onClose, settings, onChange }: FlipDeckSettingsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Flip Card Settings">
      <div className="flex flex-col gap-6">
        <section className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="gender-colors" className="text-foreground">
              Colour Backs by Gender
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Blue backs for boys, pink for girls - so you can tell the class to pick only one colour.
            </p>
          </div>
          <Switch id="gender-colors" checked={settings.genderColors} onCheckedChange={(checked) => onChange({ genderColors: checked })} />
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
