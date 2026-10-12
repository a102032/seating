import clsx from 'clsx'
import { ArrowLeft, Hand, Play, Sparkles, Star, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { describeScheme, schemeLabel, type GroupScheme } from '../lib/groups'
import type { LayoutPlan } from '../lib/layouts'
import type { SavedGroups, Student, StudentGroup } from '../types'
import { Label } from '@/components/ui/label'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface GroupActivityModalProps {
  open: boolean
  onClose: () => void
  /** The seating as today's lesson sees it: absent students' desks count as empty. */
  seating: (string | null)[]
  studentsById: Map<string, Student>
  /** The room: groups are made from where students sit, and a table room offers one group per table. */
  plan: LayoutPlan
  setName: 'row' | 'table'
  /** The saved groups as they stand now - already pruned to who is seated. */
  lastGroups: StudentGroup[]
  /** How they were made, for Continue's label; unset for groups saved before it was kept. */
  lastMadeBy: GroupScheme | undefined
  /** Groups the teacher kept to use again, by the names they typed. */
  savedGroups: SavedGroups[]
  /** "Make them for me": the app makes the groups from where the students sit. */
  onStart: (scheme: GroupScheme) => void
  /** "I'll choose": the teacher taps the names into the groups. */
  onChoose: (scheme: GroupScheme) => void
  onContinue: () => void
  onStartSaved: (savedId: string) => void
  onRemoveSaved: (savedId: string) => void
}

const COUNT_OPTIONS = [2, 3, 4, 5, 6]
/** The board reads one touch as two, and the second question appears under the finger that answered the first. */
const ANSWER_GUARD_MS = 700

/**
 * How to split the class (2026-10-12, the teacher: keep it simple). First what kind of groups:
 * 2 to 6 groups, pairs, boys and girls, or in a room of tables one group per table; then who
 * fills them: "Make them for me", from where the students sit, or "I'll choose", tapping the
 * names in. Above them, the last groups and any the teacher saved. Nothing here is typed. A
 * choice that can't work for this class greys out with the reason in its caption.
 */
export function GroupActivityModal({
  open,
  onClose,
  seating,
  studentsById,
  plan,
  setName,
  lastGroups,
  lastMadeBy,
  savedGroups,
  onStart,
  onChoose,
  onContinue,
  onStartSaved,
  onRemoveSaved,
}: GroupActivityModalProps) {
  const seatedCount = seating.filter(Boolean).length
  const lastPoints = lastGroups.reduce((sum, g) => sum + g.points, 0)
  /** The kind of groups chosen, waiting for "Make them for me" or "I'll choose". */
  const [chosen, setChosen] = useState<{ scheme: GroupScheme; label: string } | null>(null)
  const [removing, setRemoving] = useState<SavedGroups | null>(null)
  const askedAt = useRef(0)
  const answer = (then: () => void) => () => {
    if (performance.now() - askedAt.current < ANSWER_GUARD_MS) return
    then()
    onClose()
  }

  // Every time the window opens it starts at the beginning.
  useEffect(() => {
    if (open) setChosen(null)
  }, [open])

  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  const pick = (scheme: GroupScheme, label: string) => {
    // Boys and girls: the app already knows who is who, so there is nothing to choose.
    if (scheme.kind === 'gender') {
      onStart(scheme)
      onClose()
    } else {
      askedAt.current = performance.now()
      setChosen({ scheme, label })
    }
  }

  const kinds: { scheme: GroupScheme; label: string; unavailable: string }[] = [
    { scheme: { kind: 'size', size: 2 }, label: 'Pairs', unavailable: 'Too few' },
    { scheme: { kind: 'gender' }, label: 'Boys / Girls', unavailable: 'Needs both' },
    ...(setName === 'table' ? [{ scheme: { kind: 'rows' } as GroupScheme, label: 'Tables', unavailable: 'Needs 2+ tables' }] : []),
  ]

  return (
    <Modal open={open} onClose={onClose} title={chosen ? chosen.label : 'Group Activity'}>
      {seatedCount < 2 ? (
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Seat at least two students first - groups are made from whoever is at a desk.
        </p>
      ) : chosen ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <WhoButton
              icon={<Sparkles size={26} />}
              label="Make them for me"
              caption="From where they sit."
              onClick={answer(() => onStart(chosen.scheme))}
            />
            <WhoButton
              icon={<Hand size={26} />}
              label="I'll choose"
              caption="Tap names into groups."
              onClick={answer(() => onChoose(chosen.scheme))}
            />
          </div>
          <button
            type="button"
            onClick={() => setChosen(null)}
            className="flex items-center gap-1.5 self-start rounded-xl px-2 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-secondary"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lastGroups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onContinue()
                onClose()
              }}
              className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/10 px-4 py-1.5 text-left transition-colors hover:bg-primary/15 active:scale-[0.99]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Play size={20} className="ml-0.5 fill-current" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-foreground">Continue with Last Groups</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {/* In the buttons' own words ("Pairs · 13 groups"). A row of coloured dots, one per
                      card, used to sit here and said nothing a teacher could choose by. */}
                  {schemeLabel(lastMadeBy, lastGroups.length, setName)}
                  {lastPoints > 0 && (
                    <span className="flex items-center gap-0.5 font-semibold text-foreground/80">
                      · {lastPoints} <Star size={12} className="fill-amber-500 text-amber-500" strokeWidth={0} /> waiting
                    </span>
                  )}
                </span>
              </span>
            </button>
          )}

          {savedGroups.length > 0 && (
            <section>
              <Label className="mb-1.5">Saved Groups</Label>
              {/* One line each, and only this list scrolls if it must, so New Groups is always in sight. */}
              <div className="grid grid-cols-2 gap-2 overflow-y-auto p-0.5" style={{ maxHeight: 'min(9.5rem, 18vh)' }}>
                {savedGroups.map((saved) => (
                  <div
                    key={saved.id}
                    data-saved-groups={saved.name}
                    className="flex min-w-0 items-stretch rounded-2xl bg-secondary shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onStartSaved(saved.id)
                        onClose()
                      }}
                      className="flex min-h-11 min-w-0 flex-1 items-baseline gap-2 rounded-l-2xl px-3 py-2 text-left text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <span className="min-w-0 truncate font-bold">{saved.name}</span>
                      <span className="shrink-0 text-xs opacity-70">{schemeLabel(saved.madeBy, saved.groups.length, setName)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${saved.name}`}
                      title={`Remove ${saved.name}`}
                      onClick={() => setRemoving(saved)}
                      className="flex w-10 shrink-0 items-center justify-center rounded-r-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <Label className="mb-1.5">New Groups</Label>
            <div className="grid grid-cols-5 gap-2">
              {COUNT_OPTIONS.map((count) => {
                const scheme: GroupScheme = { kind: 'count', count }
                const made = describeScheme(scheme, seating, studentsById, plan)
                return (
                  <SchemeButton
                    key={count}
                    label={String(count)}
                    caption={made?.caption ?? 'Too few'}
                    disabled={!made}
                    onClick={() => pick(scheme, `${count} Groups`)}
                    big
                  />
                )
              })}
            </div>
            <div className={clsx('mt-2 grid gap-2', kinds.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {kinds.map(({ scheme, label, unavailable }) => {
                const made = describeScheme(scheme, seating, studentsById, plan)
                return (
                  <SchemeButton
                    key={label}
                    label={label}
                    caption={made?.caption ?? unavailable}
                    disabled={!made}
                    onClick={() => pick(scheme, label)}
                  />
                )
              })}
            </div>
          </section>
        </div>
      )}

      <ConfirmModal
        open={removing !== null}
        title={`Remove "${removing?.name ?? ''}"?`}
        message="These saved groups go. The class and its students stay as they are."
        confirmLabel="Remove"
        cancelLabel="Keep"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) onRemoveSaved(removing.id)
          setRemoving(null)
        }}
      />
    </Modal>
  )
}

/** The second question, two big buttons: who fills the groups. */
function WhoButton({ icon, label, caption, onClick }: { icon: React.ReactNode; label: string; caption: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-slot="button"
      className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-secondary px-2 py-3 text-secondary-foreground shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
      style={{ touchAction: 'manipulation' }}
    >
      {icon}
      <span className="text-lg font-extrabold leading-tight">{label}</span>
      <span className="text-xs font-medium leading-tight opacity-70">{caption}</span>
    </button>
  )
}

function SchemeButton({
  label,
  caption,
  disabled,
  onClick,
  big,
}: {
  label: string
  caption: string
  disabled: boolean
  onClick: () => void
  big?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-slot="button"
      className={clsx(
        'flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl bg-secondary px-1 py-2 text-secondary-foreground shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary disabled:hover:text-secondary-foreground',
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span className={clsx('font-extrabold leading-none', big ? 'text-2xl' : 'text-base')}>{label}</span>
      <span className="mt-1 text-[0.7rem] font-medium leading-none opacity-70">{caption}</span>
    </button>
  )
}
