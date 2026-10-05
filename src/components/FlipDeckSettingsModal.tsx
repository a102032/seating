import { Gift } from 'lucide-react'
import { type FlipDeckSettings } from '../hooks/useFlipDeck'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface FlipDeckSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: FlipDeckSettings
  onChange: (patch: Partial<FlipDeckSettings>) => void
  /** A card has been turned or discarded this round, so a change to the gifts waits for the next Shuffle. */
  roundStarted: boolean
  /** The class goal is on: a gift's stars go into its chest, so with no goal there are no gifts. */
  goalLive: boolean
}

export function FlipDeckSettingsModal({ open, onClose, settings, onChange, roundStarted, goalLive }: FlipDeckSettingsModalProps) {
  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Modal open={open} onClose={onClose} title="Flip Card Settings">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* The gift as it looks face up, so the teacher knows it when a student turns one. */}
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-black/10 bg-gradient-to-br from-fuchsia-400 to-violet-500 text-white shadow-sm">
                <Gift size={22} strokeWidth={2.25} />
              </span>
              <div>
                <Label htmlFor="bonus-cards" className="text-foreground">
                  Mystery Gifts
                </Label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Three gifts hidden in the deck. A student opens one, and 2, 3, 4 or 5 stars go into the treasure chest.
                </p>
              </div>
            </div>
            <Switch
              id="bonus-cards"
              checked={settings.bonusCards && goalLive}
              disabled={!goalLive}
              onCheckedChange={(checked) => onChange({ bonusCards: checked })}
            />
          </div>
          {!goalLive && (
            <p className="text-sm font-medium text-muted-foreground">
              Turn on the class goal in Pickers &amp; Points first: the stars go into its chest.
            </p>
          )}
          {goalLive && roundStarted && (
            <p className="text-sm font-medium text-muted-foreground">Changes to the gifts start at the next Shuffle.</p>
          )}
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
