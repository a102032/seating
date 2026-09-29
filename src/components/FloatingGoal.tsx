import clsx from 'clsx'
import { PartyPopper } from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
}

const treasure = (name: string) => assetUrl(`/treasure/${name}.svg`)

/** Smart boards read one touch as two; a second +1 this soon after the first is that echo. */
const TAP_GUARD_MS = 700

/** The same fill as the meter on the board, so the two read as one thing. */
const FILL = 'linear-gradient(90deg, #38bdf8, #a3e635, #facc15)'

/**
 * The class goal, floating over the lesson: the meter and one big +1, a marble in the jar.
 * No student list - the class earns it together, which is what lets this be one button
 * rather than a roster to scroll.
 *
 * Every movement here is CSS. This window is drawn by the page behind it, and that page's
 * animation frames stop while the lesson covers it, so a framer-motion animation would
 * freeze halfway in here.
 */
export function FloatingGoal({ win, className, classPoints, goal, waiting, onAdd, onCelebrate }: FloatingGoalProps) {
  const lastAdd = useRef(0)
  const [rises, setRises] = useState(0)
  // Celebrate was tapped, but the app is still behind the lesson.
  const [asked, setAsked] = useState(false)
  if (!waiting && asked) setAsked(false)

  // Held full while the chest waits, as the meter on the board is.
  const shown = waiting ? goal : classPoints
  const pct = goal > 0 ? Math.min(100, (shown / goal) * 100) : 0

  function add() {
    const now = Date.now()
    if (now - lastAdd.current < TAP_GUARD_MS) return
    lastAdd.current = now
    onAdd()
    setRises((n) => n + 1)
  }

  function celebrate() {
    setAsked(true)
    onCelebrate()
  }

  return createPortal(
    <div
      data-ink="canvas"
      className="flex h-full w-full select-none flex-col gap-2 bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)] p-2.5"
    >
      <div data-ink="panel" className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm">
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
        <span key={shown} className="float-count-pop shrink-0 text-lg font-bold tabular-nums text-foreground">
          {shown} / {goal}
        </span>
      </div>

      {waiting ? (
        // The jar is full. The party is the app's, full screen, so this only asks for it -
        // and says where it is if the browser won't bring the app forward by itself.
        <button
          type="button"
          data-slot="button"
          onClick={celebrate}
          className="float-celebrate-glow flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-amber-400 font-extrabold text-amber-950 shadow-sm transition-transform active:scale-[0.97]"
          style={{ touchAction: 'manipulation' }}
        >
          <span className="flex items-center gap-2" style={{ fontSize: 'clamp(1.1rem, 18vh, 2.4rem)' }}>
            <PartyPopper className="h-[1em] w-[1em]" /> Celebrate!
          </span>
          {asked && <span className="text-sm font-bold">Open the app to see it</span>}
        </button>
      ) : (
        <button
          type="button"
          data-slot="button"
          onClick={add}
          title="Add a point to the class goal"
          className={cn(
            buttonVariants({ variant: 'default' }),
            'relative h-auto min-h-0 flex-1 gap-2 rounded-2xl font-extrabold shadow-sm transition-transform active:scale-[0.97]',
          )}
          style={{ touchAction: 'manipulation', fontSize: 'clamp(1.25rem, 24vh, 3rem)' }}
        >
          <img src={treasure('star-coin')} alt="" draggable={false} className="h-[1em] w-[1em] max-w-none" />
          +1
          {rises > 0 && (
            <span key={rises} className="float-plus-rise pointer-events-none absolute right-4 top-1 text-base font-extrabold">
              +1
            </span>
          )}
        </button>
      )}
    </div>,
    win.document.body,
  )
}
