import clsx from 'clsx'
import { Play, Star } from 'lucide-react'
import { describeScheme, type GroupScheme, type SetOf } from '../lib/groups'
import type { Student, StudentGroup } from '../types'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Modal } from './Modal'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface GroupActivityModalProps {
  open: boolean
  onClose: () => void
  /** The seating as today's lesson sees it: absent students' desks count as empty. */
  seating: (string | null)[]
  studentsById: Map<string, Student>
  /** Which row of desks, or table, a desk is in: Split By Rows is Split By Tables in a table layout. */
  setOf: SetOf
  setName: 'row' | 'table'
  /** The saved groups as they stand now - already pruned to who is seated. */
  lastGroups: StudentGroup[]
  onStart: (scheme: GroupScheme) => void
  onContinue: () => void
  chimes: boolean
  onSetChimes: (on: boolean) => void
}

const COUNT_OPTIONS = [2, 3, 4, 5, 6]
const SIZE_OPTIONS: { size: number; label: string }[] = [
  { size: 2, label: 'Pairs' },
  { size: 3, label: '3s' },
  { size: 4, label: '4s' },
  { size: 5, label: '5s' },
]

/**
 * How to split the class, in one tap. Nothing here is typed: every way of grouping is a
 * button, and the caption under each says what it would make of *this* class today, so the
 * teacher knows before they commit. A button that can't work for this class - six groups
 * from four students, boys and girls from a class with no girls seated - greys out with the
 * reason in its caption rather than vanishing.
 */
export function GroupActivityModal({
  open,
  onClose,
  seating,
  studentsById,
  setOf,
  setName,
  lastGroups,
  onStart,
  onContinue,
  chimes,
  onSetChimes,
}: GroupActivityModalProps) {
  const seatedCount = seating.filter(Boolean).length
  const lastPoints = lastGroups.reduce((sum, g) => sum + g.points, 0)

  function start(scheme: GroupScheme) {
    onStart(scheme)
    onClose()
  }

  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Modal open={open} onClose={onClose} title="Group Activity">
      {seatedCount < 2 ? (
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Seat at least two students first - groups are made from whoever is at a desk.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {lastGroups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onContinue()
                onClose()
              }}
              className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/15 active:scale-[0.99]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Play size={20} className="ml-0.5 fill-current" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-foreground">Continue with Last Groups</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  {lastGroups.length} {lastGroups.length === 1 ? 'group' : 'groups'}
                  <GroupDots groups={lastGroups} />
                  {lastPoints > 0 && (
                    <span className="flex items-center gap-0.5 font-semibold text-foreground/80">
                      · {lastPoints} <Star size={12} className="fill-amber-500 text-amber-500" strokeWidth={0} /> waiting
                    </span>
                  )}
                </span>
              </span>
            </button>
          )}

          <section>
            <Label className="mb-2">How Many Groups?</Label>
            <div className="grid grid-cols-5 gap-2">
              {COUNT_OPTIONS.map((count) => {
                const scheme: GroupScheme = { kind: 'count', count }
                const plan = describeScheme(scheme, seating, studentsById, setOf)
                return (
                  <SchemeButton
                    key={count}
                    label={String(count)}
                    caption={plan?.caption ?? 'Too few'}
                    disabled={!plan}
                    onClick={() => start(scheme)}
                    big
                  />
                )
              })}
            </div>
          </section>

          <section>
            <Label className="mb-2">Or Groups Of…</Label>
            <div className="grid grid-cols-4 gap-2">
              {SIZE_OPTIONS.map(({ size, label }) => {
                const scheme: GroupScheme = { kind: 'size', size }
                const plan = describeScheme(scheme, seating, studentsById, setOf)
                return (
                  <SchemeButton
                    key={size}
                    label={label}
                    caption={plan?.caption ?? 'Too few'}
                    disabled={!plan}
                    onClick={() => start(scheme)}
                  />
                )
              })}
            </div>
          </section>

          <section>
            <Label className="mb-2">Or Split By…</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    scheme: { kind: 'gender' } as GroupScheme,
                    label: 'Boys / Girls',
                    unavailable: 'Needs both',
                  },
                  {
                    scheme: { kind: 'rows' } as GroupScheme,
                    label: setName === 'table' ? 'Tables' : 'Rows',
                    unavailable: setName === 'table' ? 'Needs 2+ tables' : 'Needs 2+ rows',
                  },
                ] as const
              ).map(({ scheme, label, unavailable }) => {
                const plan = describeScheme(scheme, seating, studentsById, setOf)
                return (
                  <SchemeButton
                    key={scheme.kind}
                    label={label}
                    caption={plan?.caption ?? unavailable}
                    disabled={!plan}
                    onClick={() => start(scheme)}
                  />
                )
              })}
            </div>
          </section>

          <section className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 p-3 dark:border-white/10">
            <div className="min-w-0">
              <Label htmlFor="status-chimes" className="text-foreground">
                Status Chimes
              </Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {chimes
                  ? 'On: a soft chime when a group taps Help, Ready or Done - so you hear it with your back to the board.'
                  : 'Off: the cards change colour silently.'}
              </p>
            </div>
            <Switch id="status-chimes" checked={chimes} onCheckedChange={onSetChimes} className="shrink-0" />
          </section>
        </div>
      )}
    </Modal>
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

function GroupDots({ groups }: { groups: StudentGroup[] }) {
  return (
    <span className="flex items-center gap-0.5">
      {groups.slice(0, 8).map((g) => (
        <span key={g.id} className="size-2.5 rounded-full" style={{ background: g.color }} />
      ))}
    </span>
  )
}
