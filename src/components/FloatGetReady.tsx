import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { assetUrl } from '../lib/assets'
import { GET_READY_DRUMS, controlButtonWidth } from '../lib/getReady'
import { primeTaiko } from '../lib/sound'
import { flyStarsFrom } from '../lib/starFlight'
import { StarMoment, type Layout } from './GetReady'

/** The board reads one touch as two: the tap that opened the drums lands again on whatever is under it now. */
const TAP_GUARD_MS = 700

/**
 * Where the star sits in the floating window: under the meter (the window's own, which stays
 * on top so the class sees the stars land), left of Ready! and Stop, and as big as the room
 * between them allows.
 */
function measureFloat(view: Window): Layout {
  const header = view.document.querySelector('[data-float-header]')
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0
  const areaLeft = 12
  const areaWidth = Math.max(0, view.innerWidth - 28 - controlButtonWidth(view) - 16 - areaLeft)
  const areaHeight = Math.max(0, view.innerHeight - headerBottom - 12)
  // From the star's tip to the bottom of "Tap the star to start" is about 0.95 of its box.
  const s = Math.max(120, Math.min(areaHeight / 0.95, areaWidth))
  const spare = Math.max(0, areaHeight - 0.95 * s)
  return {
    s,
    top: headerBottom + 6 + spare / 2 - 0.0917 * s,
    cx: areaLeft + areaWidth / 2,
    buttonsTop: headerBottom + 16,
  }
}

interface FloatGetReadyProps {
  win: Window
  lastDrum?: number
  prize: number
  onChooseDrum: (seconds: number) => void
  onAward: (stars: number) => void
  /** Get Ready! is over (or was stopped): the window goes back to its own size. */
  onClose: () => void
}

/**
 * Get Ready! in the floating window, for the moment after an instruction while the lesson is up:
 * "How long?" and then the app's own star, drum, prize and sounds, in the window grown big. Its
 * stars land in the window's chest. Every timer and animation here runs on the floating
 * window's clock, because the app's page behind the lesson gets about one timer a second.
 */
export function FloatGetReady({ win, lastDrum, prize, onChooseDrum, onAward, onClose }: FloatGetReadyProps) {
  const [seconds, setSeconds] = useState<number | null>(null)
  // The drum is fetched while the teacher chooses, so the first hit isn't a fallback knock.
  useEffect(() => primeTaiko(), [])

  if (seconds === null) {
    return (
      <HowLong
        win={win}
        lastDrum={lastDrum}
        onChoose={(n) => {
          onChooseDrum(n)
          setSeconds(n)
        }}
        onClose={onClose}
      />
    )
  }
  return (
    <StarMoment
      seconds={seconds}
      prize={prize}
      onAward={onAward}
      onLiftMeter={() => {}}
      onClose={onClose}
      view={win}
      measure={measureFloat}
      fly={(x, y, count, size) =>
        flyStarsFrom(x, y, count, size, { to: win.document.querySelector<HTMLElement>('[data-float-coin]'), tracked: false })
      }
      awardOnLanding
    />
  )
}

/** The five drums, filling the grown window under its meter, with a way back out. */
function HowLong({
  win,
  lastDrum,
  onChoose,
  onClose,
}: {
  win: Window
  lastDrum?: number
  onChoose: (seconds: number) => void
  onClose: () => void
}) {
  const [openedAt] = useState(() => win.performance.now())
  const settled = () => win.performance.now() - openedAt >= TAP_GUARD_MS

  return (
    <div data-ink="panel" className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-foreground">How long?</h2>
        <button
          type="button"
          onClick={() => settled() && onClose()}
          aria-label="Close"
          title="Close"
          className="rounded-full p-1.5 text-muted-foreground transition-transform hover:bg-accent active:scale-95"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="size-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-[2vw]">
        {GET_READY_DRUMS.map((n) => (
          <button
            key={n}
            type="button"
            data-drum={n}
            onClick={() => settled() && onChoose(n)}
            className={clsx(
              'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border-[3px] px-1 pt-3 pb-2.5 transition-transform active:scale-95',
              n === lastDrum ? 'border-primary bg-primary/15' : 'border-transparent bg-primary/5 dark:bg-white/10',
            )}
            style={{ touchAction: 'manipulation', maxWidth: '9.5rem' }}
          >
            <img
              src={assetUrl('/get-ready/taiko-drum.svg')}
              alt=""
              draggable={false}
              className="mb-1 w-auto select-none"
              style={{ height: 'min(14vh, 6rem)' }}
            />
            <span className="font-bold leading-none text-foreground" style={{ fontSize: 'clamp(1.3rem, 6vh, 2.25rem)' }}>
              {n}
            </span>
            <span className="text-sm font-bold text-muted-foreground">seconds</span>
          </button>
        ))}
      </div>
    </div>
  )
}
