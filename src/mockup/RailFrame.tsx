import clsx from 'clsx'
import { useRef, type CSSProperties } from 'react'
import { ClassTitle } from '../components/ClassTitle'
import { FlipTimer } from '../components/FlipTimer'
import { useFitByFlow } from './fit'
import { AllStarsIn, goalTiles, modeTiles, pickerButtons, PointsRow, PointsStatus, SmallControls, type LayoutProps } from './parts'

/**
 * The teacher's idea (2026-10-08): a narrow rail of icon buttons, and a frame beside the seating
 * chart for the clock and the tools. Together they are exactly as wide as the side panel, so no
 * desk gets narrower.
 *
 * The rail holds what the board is showing - the seating chart, the flip cards, the group cards,
 * and the two desk modes - with the one that's on lit, so a glance says where the lesson is. The
 * frame holds the clock, Get Ready! and Float, and the points.
 *
 * Everything a child shouldn't press sits above half the screen's height, which is as far up as
 * a 2nd grader can reach on the teacher's board. Only the two Pick a Random buttons sit below:
 * a stray pick is the mildest accident there is.
 */

/** The top half, less the page's padding above the panel and the panel's own. */
const TOP_HALF = 'calc(50dvh - var(--above-panel, 0.75rem) - var(--panel-pad, 0.75rem))'

const FRAME_STEPS: CSSProperties[] = [
  {},
  { '--panel-gap': '0.45rem', '--btn-py': '0.5rem', '--tile-py': '0.35em' },
  {
    '--panel-gap': '0.35rem',
    '--btn-py': '0.375rem',
    '--tile-py': '0.25em',
    '--dial-cap': '12vh',
    '--points-row': 'clamp(34px, 6.5vh, 70px)',
  },
  {
    '--panel-gap': '0.25rem',
    '--panel-pad': '0.5rem',
    '--btn-py': '0.25rem',
    '--tile-py': '0.18em',
    '--tile-icon': 'clamp(16px, 2.8vmin, 24px)',
    '--dial-cap': '10.5vh',
    '--points-row': 'clamp(32px, 6vh, 64px)',
  },
] as CSSProperties[]

const RAIL_STEPS: CSSProperties[] = [
  {},
  { '--tile-py': '0.32em', '--rail-gap': '0.3rem' },
  { '--tile-py': '0.2em', '--rail-gap': '0.2rem', '--tile-icon': 'clamp(16px, 2.9vmin, 24px)' },
] as CSSProperties[]

export function RailFrame(p: LayoutProps) {
  const deskMode = p.swapMode || p.attendanceMode || p.choosingAvatars
  const modes = modeTiles(p, true)
  const goal = goalTiles(p)
  const pickers = pickerButtons(p, 'w-full !py-[var(--btn-py,0.55rem)]')

  const railRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const fitKey = [
    p.flipDeckOpen,
    p.pointsSelectedCount > 0,
    Boolean(p.wholeSets),
    p.timerSettings.face,
    p.nameInBar,
    p.deskStars !== null,
    Boolean(p.getReady),
    Boolean(p.float),
    p.classes.length > 1,
  ].join()
  const railFit = useFitByFlow(railRef, RAIL_STEPS.length - 1, 'rail')
  const frameFit = useFitByFlow(topRef, FRAME_STEPS.length - 1, fitKey)

  return (
    // The rail on the screen's edge, whichever side the panel is on.
    <div
      className={clsx('flex h-full w-56 shrink-0 gap-2 sm:w-[clamp(16rem,30vmin,21rem)]', p.side === 'right' && 'flex-row-reverse')}
      style={{ ['--above-panel' as string]: '0.75rem' }}
    >
      <nav
        data-ink="panel"
        aria-label="What the board shows"
        className="flex h-full w-[clamp(4.75rem,8.6vmin,6rem)] shrink-0 flex-col rounded-3xl border border-white/60 bg-card/70 p-1 shadow-xl shadow-black/5 dark:border-white/10 dark:shadow-black/20"
      >
        <div
          ref={railRef}
          data-fit={railFit}
          className="flex flex-col gap-[var(--rail-gap,0.4rem)] overflow-hidden"
          style={{ ...RAIL_STEPS[railFit], maxHeight: 'calc(50dvh - 0.75rem - 0.25rem)' }}
        >
          {modes.seats}
          {modes.cards}
          {modes.groups}
          <div className="mx-2 my-0.5 h-px shrink-0 bg-border" />
          {modes.attendance}
          {modes.swap}
        </div>
      </nav>

      <aside
        data-ink="panel"
        className="flex h-full min-w-0 flex-1 flex-col gap-[var(--panel-gap,0.6rem)] rounded-3xl border border-white/60 bg-card/70 p-[var(--panel-pad,0.75rem)] shadow-xl shadow-black/5 dark:border-white/10 dark:shadow-black/20"
        // The timer's controls open a little wider than the frame, over the edge of the board, rather
        // than stacking into a tall drawer that would cover the pickers.
        style={{ ['--timer-drawer-min' as string]: '14rem', ...FRAME_STEPS[frameFit] }}
      >
        {/* Above the reach line: the teacher's. */}
        <div ref={topRef} data-fit={frameFit} className="flex shrink-0 flex-col gap-[var(--panel-gap,0.6rem)]" style={{ height: TOP_HALF }}>
          {p.nameInBar ? (
            (goal.getReady || goal.float) && (
              <div className="grid shrink-0 gap-1.5" style={{ gridTemplateColumns: goal.float && goal.getReady ? '1fr 1fr' : '1fr' }}>
                {goal.getReady}
                {goal.float}
              </div>
            )
          ) : (
            <ClassTitle
              place="panel"
              classes={p.classes}
              activeClassId={p.activeClassId}
              onSelectClass={p.onSelectClass}
              onOpenSettings={p.onOpenSettings}
              disabled={deskMode}
              settingsDisabled={p.groupsLocked}
            />
          )}
          <div className="shrink-0">
            <FlipTimer settings={p.timerSettings} onOpenSettings={p.onOpenTimerSettings} disabled={deskMode} />
          </div>
          <PointsRow p={p} className="h-[var(--points-row,clamp(38px,7vh_-_7px,76px))] shrink-0" />
          <AllStarsIn p={p} className="w-full shrink-0" />
          <PointsStatus p={p} className="w-full shrink-0" />
          <div className="mt-auto">
            <SmallControls p={p} />
          </div>
        </div>

        {/* Below it: only the pickers, where a stray tap just starts a pick. */}
        <div className="flex min-h-0 flex-col gap-[var(--panel-inner-gap,0.4rem)] pt-[var(--panel-pad,0.75rem)]">
          {pickers.student}
          {pickers.row}
        </div>
      </aside>
    </div>
  )
}
