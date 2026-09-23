import clsx from 'clsx'
import { BONUS_KINDS, type BonusKind, type FlipDeckSettings } from '../hooks/useFlipDeck'
import { BONUS_FACES } from '../lib/bonusCards'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface FlipDeckSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: FlipDeckSettings
  onChange: (patch: Partial<FlipDeckSettings>) => void
  /** A card has been turned or discarded this round, so bonus changes wait for the next Shuffle. */
  roundStarted: boolean
}

export function FlipDeckSettingsModal({ open, onClose, settings, onChange, roundStarted }: FlipDeckSettingsModalProps) {
  function toggleKind(kind: BonusKind) {
    const on = settings.bonusKinds.includes(kind)
    onChange({
      bonusKinds: on
        ? settings.bonusKinds.filter((k) => k !== kind)
        : BONUS_KINDS.filter((k) => k === kind || settings.bonusKinds.includes(k)),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Flip Card Settings">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="bonus-cards" className="text-foreground">
                Bonus Cards
              </Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                A few surprise cards hidden in the deck. The app picks how many, so the rows stay even.
              </p>
            </div>
            <Switch id="bonus-cards" checked={settings.bonusCards} onCheckedChange={(checked) => onChange({ bonusCards: checked })} />
          </div>
          {settings.bonusCards && (
            <div className="flex gap-2">
              {BONUS_KINDS.map((kind) => {
                const { label, icon: Icon, face, fill } = BONUS_FACES[kind]
                const on = settings.bonusKinds.includes(kind)
                // The last one can't be switched off - that's what the Bonus Cards switch is for.
                const last = on && settings.bonusKinds.length === 1
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={on}
                    disabled={last}
                    onClick={() => toggleKind(kind)}
                    className={clsx(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-sm font-bold transition-all active:scale-95',
                      on
                        ? clsx('border-black/10 bg-gradient-to-br shadow-sm', face)
                        : 'border-dashed border-border bg-transparent text-muted-foreground opacity-70',
                    )}
                  >
                    <Icon size={16} className={clsx('shrink-0', fill && on && 'fill-current')} strokeWidth={fill && on ? 0 : 2.25} />
                    {label}
                  </button>
                )
              })}
            </div>
          )}
          {settings.bonusCards && roundStarted && (
            <p className="text-sm font-medium text-muted-foreground">Changes to bonus cards start at the next Shuffle.</p>
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
