import clsx from 'clsx'
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { ClassTitle } from '../components/ClassTitle'
import { FlipTimer } from '../components/FlipTimer'
import { PickRowIcon, PickTableIcon } from '../components/PickerIcons'
import { Star } from 'lucide-react'
import { goalTiles, modeTiles, pickerButtons, PointsRow, SmallControls, type LayoutProps } from './parts'
import { TileButton } from './TileButton'
import { useFitToWidth } from './fit'

interface TeacherShelfProps extends LayoutProps {
  /** The goal meter, with the class's name at its end; null with no goal. */
  meter: ReactNode | null
  /** Where the flip cards and the group cards put their own controls. */
  onShelfSlot: (el: HTMLDivElement | null) => void
}

/**
 * Claude's idea (2026-10-08): every control in one shelf under the goal meter, the clock in the
 * top corner, and the desks the full width of the board.
 *
 * Why: a 2nd grader reaches half the screen's height, and a side panel tall enough to hold
 * everything runs down into that half. The top of the board is out of every child's reach, and
 * it is wide: a shelf there holds more than a side panel, and gives the panel's width back to
 * the desks, whose names are sized by their width. The shelf follows the activity - on the flip
 * cards it holds the deck's own controls, in a group activity the groups' - so the board itself
 * never carries a toolbar.
 */

/** Steps the shelf takes, one at a time, until it fits the board's width. */
const STEPS: CSSProperties[] = [
  {},
  { '--shelf-gap': '0.3rem', '--group-gap': '0.55rem' },
  { '--shelf-gap': '0.25rem', '--group-gap': '0.45rem', '--tile-ws': 'normal' },
  { '--shelf-gap': '0.2rem', '--group-gap': '0.35rem', '--tile-ws': 'normal', '--tile-font': '0.64rem', '--tile-icon': '16px' },
  // The flip cards' and groups' own buttons keep their words and lose their pictures.
  {
    '--shelf-gap': '0.2rem',
    '--group-gap': '0.35rem',
    '--tile-ws': 'normal',
    '--tile-font': '0.64rem',
    '--tile-icon': '16px',
    '--slot-icon': 'none',
  },
  {
    '--shelf-gap': '0.2rem',
    '--group-gap': '0.3rem',
    '--tile-ws': 'normal',
    '--tile-font': '0.64rem',
    '--tile-icon': '16px',
    '--slot-icon': 'none',
    '--slot-font': '0.74rem',
    '--points-box': '6em',
  },
] as CSSProperties[]

function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('flex shrink-0 items-stretch gap-[var(--shelf-gap,0.375rem)]', className)}>{children}</div>
}

export function TeacherShelf(p: TeacherShelfProps) {
  const { onShelfSlot } = p
  const deskMode = p.swapMode || p.attendanceMode || p.choosingAvatars
  const busy = deskMode || p.groupActivityOpen
  const modes = modeTiles(p)
  const goal = goalTiles(p)
  const pickers = pickerButtons(p)

  const shelfRef = useRef<HTMLDivElement>(null)
  const fit = useFitToWidth(
    shelfRef,
    STEPS.length - 1,
    [
      p.flipDeckOpen,
      p.groupActivityOpen,
      Boolean(p.wholeSets),
      p.deskStars !== null,
      Boolean(p.getReady),
      Boolean(p.float),
      p.showMinus,
    ].join(),
  )

  return (
    <div className="grid shrink-0 gap-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
      <div className="flex min-w-0 flex-col gap-2">
        {p.meter ?? (
          <div className="flex h-14 items-center rounded-2xl border border-white/60 bg-card/70 px-3 shadow-sm dark:border-white/10">
            <ClassTitle
              place="bar"
              classes={p.classes}
              activeClassId={p.activeClassId}
              onSelectClass={p.onSelectClass}
              onOpenSettings={p.onOpenSettings}
              disabled={deskMode}
              settingsDisabled={p.groupsLocked}
            />
          </div>
        )}

        <div
          ref={shelfRef}
          data-ink="panel"
          data-fit={fit}
          className="flex min-w-0 items-stretch gap-[var(--group-gap,0.75rem)] overflow-hidden rounded-2xl border border-white/60 bg-card/70 p-1.5 shadow-xl shadow-black/5 dark:border-white/10 dark:shadow-black/20"
          style={{ ...STEPS[fit], height: 'clamp(3.4rem, 9.2vmin, 5.5rem)' }}
        >
          {/* What the board shows, then the two desk modes. */}
          <Group>
            {modes.seats}
            {modes.cards}
            {modes.groups}
          </Group>
          {/* The desk modes act on the desks, so they step aside while cards cover them. */}
          {!p.flipDeckOpen && !p.groupActivityOpen && (
            <Group>
              {modes.attendance}
              {modes.swap}
            </Group>
          )}

          {/* The flip cards' and group cards' own controls land here while they're up. */}
          <div
            ref={onShelfSlot}
            className="flex shrink-0 items-center gap-[var(--shelf-gap,0.375rem)] empty:hidden [&_button]:!px-2.5 [&_button]:!py-1.5 [&_button]:![font-size:var(--slot-font,clamp(0.8rem,1.5vmin,1.05rem))] [&_button>svg]:[display:var(--slot-icon,block)]"
          />

          {/* The pickers stand down on the flip cards (the cards are the picker), so the deck's controls take their place. */}
          {!p.flipDeckOpen && (
            <Group>
              {pickers.studentTile}
              {pickers.rowTile}
            </Group>
          )}

          {/* Points: in a group activity each card has its own, so these give way to the groups' controls. */}
          {!p.groupActivityOpen && (
            <Group>
              {p.flipDeckOpen ? (
                <div className="flex w-[var(--points-box,7.5em)] shrink-0 flex-col items-center justify-center rounded-xl bg-secondary/60 px-1 text-center text-xs leading-tight text-muted-foreground">
                  {p.flipActiveName ? (
                    <>
                      Points go to <span className="max-w-full truncate text-sm font-bold text-foreground">{p.flipActiveName}</span>
                    </>
                  ) : (
                    'Flip a card to give points'
                  )}
                </div>
              ) : (
                <>
                  {p.wholeSets && (
                    <TileButton
                      icon={p.setName === 'table' ? <PickTableIcon /> : <PickRowIcon />}
                      label={`Whole ${p.setName === 'table' ? 'Table' : 'Row'}${p.wholeSets.count > 1 ? 's' : ''}`}
                      onClick={p.wholeSets.onPick}
                      disabled={busy || p.wholeSets.whole}
                      title={`Pick everyone in the ${p.setName}`}
                    />
                  )}
                  {p.deskStars !== null && (
                    <TileButton
                      icon={<Star className="fill-amber-400 text-amber-500" />}
                      label={`All In! ${p.deskStars}`}
                      onClick={p.onAllStarsIn}
                      disabled={busy || p.deskStars === 0}
                      title="Add every star on the desks to the class goal"
                    />
                  )}
                </>
              )}
              <PointsRow
                p={p}
                className={clsx(
                  'h-full',
                  p.flipDeckOpen ? 'w-[clamp(4rem,7vw,6.5rem)] [&>button:first-child]:hidden' : 'w-[clamp(9.5rem,15vw,14rem)]',
                )}
              />
            </Group>
          )}

          {(goal.getReady || goal.float) && (
            <Group>
              {goal.getReady}
              {goal.float}
            </Group>
          )}
        </div>
      </div>

      {/* The clock, as high on the board as it can go: read over the heads of the front row, and
          tapped by the teacher. The Saved mark and the pickers' settings sit in the room under it. */}
      <div className="flex w-[clamp(11rem,18vw,16rem)] flex-col justify-center gap-1">
        <FlipTimer settings={p.timerSettings} onOpenSettings={p.onOpenTimerSettings} disabled={deskMode} />
        <SmallControls p={p} showSideArrow={false} />
      </div>
    </div>
  )
}
