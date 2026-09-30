import clsx from 'clsx'
import { Maximize2, Minimize2, PartyPopper, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FLOAT_SIZE, FLOAT_STRIP_SIZE, resizeFloatingWindow } from '../hooks/useFloatingWindow'
import { assetUrl } from '../lib/assets'

interface FloatingGoalProps {
  /** The floating window to draw into. */
  win: Window
  className: string
  classPoints: number
  goal: number
  /** The goal was filled from here and its celebration is waiting for the app to be in front. */
  waiting: boolean
  onAdd: () => void
  /** Ask for the app to come to the front, where the chest opens. */
  onCelebrate: () => void
  /** Pick Student as it stands: the name flashing past, then the one it landed on. */
  pick: { name: string; landed: boolean } | null
  /** False while the app is using the desks for something else (Flip Cards, groups, Swap Seats, Attendance). */
  canPick: boolean
  onPick: () => void
  onClearPick: () => void
}

const treasure = (name: string) => assetUrl(`/treasure/${name}.svg`)

/**
 * Smart boards read one touch as two. Any tap this soon after the last one is that echo -
 * for every button here, since clearing a name puts +1 and Pick back under the same finger.
 */
const TAP_GUARD_MS = 700

/**
 * Shorter than this, the window is the one-row strip. Going by the window's own height means
 * the strip shows whether it was the shrink button or the teacher dragging an edge.
 */
const STRIP_BELOW = 120

/**
 * One size for the name, as big as the window allows: the height caps a short name, and a
 * long one is held to the width (a bold Andika letter is about half its size wide).
 */
function nameSize(name: string, strip: boolean) {
  return `min(${strip ? 55 : 26}vh, ${Math.round((strip ? 130 : 160) / Math.max(5, name.length))}vw)`
}

/** The same fill as the meter on the board, so the two read as one thing. */
const FILL = 'linear-gradient(90deg, #38bdf8, #a3e635, #facc15)'

const pressable = 'transition-transform active:scale-[0.97]'

/**
 * The class goal, floating over the lesson: the meter and one big +1, a marble in the jar,
 * with Pick beside it. No student list - the class earns it together, which is what lets
 * this be one button rather than a roster to scroll.
 *
 * It comes in two sizes: the full window, and a one-row strip for when it's covering too much
 * of the lesson - one tap each way. The strip keeps the count, +1 and Pick; the class name,
 * the fill and the chest are what give way.
 *
 * Every movement here is CSS. This window is drawn by the page behind it, and that page's
 * animation frames stop while the lesson covers it, so a framer-motion animation would
 * freeze halfway in here.
 */
export function FloatingGoal({
  win,
  className,
  classPoints,
  goal,
  waiting,
  onAdd,
  onCelebrate,
  pick,
  canPick,
  onPick,
  onClearPick,
}: FloatingGoalProps) {
  const lastTap = useRef(0)
  // Celebrate was tapped, but the app is still behind the lesson.
  const [asked, setAsked] = useState(false)
  if (!waiting && asked) setAsked(false)

  const [strip, setStrip] = useState(() => win.innerHeight < STRIP_BELOW)
  useEffect(() => {
    const update = () => setStrip(win.innerHeight < STRIP_BELOW)
    win.addEventListener('resize', update)
    return () => win.removeEventListener('resize', update)
  }, [win])
  /** The size to grow back to: whatever the full window was before it shrank. */
  const fullSize = useRef(FLOAT_SIZE)

  // Held full while the chest waits, as the meter on the board is.
  const shown = waiting ? goal : classPoints
  const pct = goal > 0 ? Math.min(100, (shown / goal) * 100) : 0

  function tap(action: () => void) {
    const now = Date.now()
    if (now - lastTap.current < TAP_GUARD_MS) return
    lastTap.current = now
    action()
  }


  function celebrate() {
    setAsked(true)
    onCelebrate()
  }

  function shrink() {
    fullSize.current = { width: win.innerWidth, height: win.innerHeight }
    resizeFloatingWindow(win, FLOAT_STRIP_SIZE)
  }

  function grow() {
    resizeFloatingWindow(win, fullSize.current)
  }

  const count = (
    <span
      key={shown}
      className={cn('float-count-pop shrink-0 font-bold tabular-nums text-foreground', strip ? 'px-1 text-base' : 'text-lg')}
    >
      {strip ? `${shown}/${goal}` : `${shown} / ${goal}`}
    </span>
  )

  const sizeButton = (
    <button
      type="button"
      onClick={() => tap(strip ? grow : shrink)}
      title={strip ? 'Make it big again' : 'Make it small'}
      aria-label={strip ? 'Make it big again' : 'Make it small'}
      className={cn('shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent', pressable)}
      style={{ touchAction: 'manipulation' }}
    >
      {strip ? <Maximize2 className="size-5" /> : <Minimize2 className="size-5" />}
    </button>
  )

  // The jar is full. The party is the app's, full screen, so this only asks for it - and says
  // where it is if the browser won't bring the app forward by itself.
  const celebrateButton = (
    <button
      type="button"
      data-slot="button"
      onClick={() => tap(celebrate)}
      className={cn(
        'float-celebrate-glow flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-amber-400 font-extrabold text-amber-950 shadow-sm',
        strip && 'h-full rounded-xl',
        pressable,
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span className="flex items-center gap-2" style={{ fontSize: strip ? '1.05rem' : 'clamp(1.1rem, 18vh, 2.4rem)' }}>
        <PartyPopper className="size-[1em]" /> {strip && asked ? 'Open the app' : 'Celebrate!'}
      </span>
      {!strip && asked && <span className="text-sm font-bold">Open the app to see it</span>}
    </button>
  )

  // The desks are behind the lesson, so the pick is a name here: flashing past, then landed
  // and ringed in the picker's amber. It stays until a tap - nothing timed.
  const pickName = pick && (
    <button
      type="button"
      onClick={() => pick.landed && tap(onClearPick)}
      title={pick.landed ? 'Tap to go back' : undefined}
      className={clsx(
        'flex min-h-0 min-w-0 flex-1 items-center justify-center border border-border bg-card px-3 shadow-sm',
        strip ? 'h-full rounded-xl' : 'rounded-2xl',
        pick.landed && (strip ? 'ring-[3px] ring-amber-400' : 'ring-4 ring-amber-400'),
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span
        key={pick.landed ? 'landed' : 'flashing'}
        className={clsx('truncate font-extrabold', pick.landed ? 'float-count-pop text-foreground' : 'text-muted-foreground')}
        style={{ fontSize: nameSize(pick.name, strip) }}
      >
        {pick.name || ' '}
      </span>
    </button>
  )

  const addButton = (
    <button
      type="button"
      data-slot="button"
      // Just the point: the count pops and the coin sound plays. A "+1" also rose off this
      // button; it went with the one on the board's goal bar, as more than the moment needed.
      onClick={() => tap(onAdd)}
      title="Add a point to the class goal"
      className={cn(
        buttonVariants({ variant: 'default' }),
        'relative h-auto min-h-0 min-w-0 font-extrabold shadow-sm',
        strip ? 'h-full flex-[1.4] gap-1 rounded-xl px-2' : 'flex-[2] gap-2 rounded-2xl',
        pressable,
      )}
      style={{ touchAction: 'manipulation', fontSize: strip ? '1.3rem' : 'clamp(1.25rem, 24vh, 3rem)' }}
    >
      <img src={treasure('star-coin')} alt="" draggable={false} className="size-[1em] max-w-none" />
      +1
    </button>
  )

  // The app's own Pick Student - same pace, same sounds, same Allow Repeats, and it skips
  // anyone away today. It stands down while the app is using the desks.
  const pickButton = (
    <button
      type="button"
      data-slot="button"
      onClick={() => tap(onPick)}
      disabled={!canPick}
      title={canPick ? 'Pick a student' : 'Pick is off while the app is busy with the desks'}
      className={cn(
        buttonVariants({ variant: 'secondary' }),
        'h-auto min-h-0 min-w-0 flex-1 font-extrabold shadow-sm',
        strip ? 'h-full rounded-xl px-2' : 'flex-col gap-1 rounded-2xl',
        !canPick && 'opacity-40',
        pressable,
      )}
      style={{ touchAction: 'manipulation', fontSize: strip ? '1rem' : 'clamp(1rem, 11vh, 1.5rem)' }}
    >
      {/* No room for the icon in the strip; the word carries it. */}
      {!strip && <User className="size-[1.2em]" />}
      Pick
    </button>
  )

  const canvas = 'flex h-full w-full select-none bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]'

  return createPortal(
    strip ? (
      <div data-ink="canvas" className={cn(canvas, 'items-center gap-1 p-1.5')}>
        {waiting ? (
          celebrateButton
        ) : pick ? (
          pickName
        ) : (
          <>
            {count}
            {addButton}
            {pickButton}
          </>
        )}
        {sizeButton}
      </div>
    ) : (
      <div data-ink="canvas" className={cn(canvas, 'flex-col gap-2 p-2.5')}>
        <div
          data-ink="panel"
          className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-muted-foreground">{className}</div>
            <div className="mt-1 h-3.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%`, background: FILL, backgroundSize: '200% 100%', backgroundPositionX: `${100 - pct}%` }}
              />
            </div>
          </div>
          <img
            src={treasure('chest-closed')}
            alt=""
            draggable={false}
            className={clsx('h-8 w-8 shrink-0', waiting && 'float-chest-rattle')}
          />
          {count}
          {sizeButton}
        </div>

        {waiting ? (
          celebrateButton
        ) : pick ? (
          pickName
        ) : (
          <div className="flex min-h-0 flex-1 gap-2">
            {addButton}
            {pickButton}
          </div>
        )}
      </div>
    ),
    win.document.body,
  )
}
