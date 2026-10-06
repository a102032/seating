import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { assetUrl } from '../lib/assets'
import { FLOAT_DRUMS, GET_READY_DRUMS, controlButtonHeight, controlButtonWidth } from '../lib/getReady'
import { primeTaiko } from '../lib/sound'
import { flyStarsFrom } from '../lib/starFlight'
import { SoundButton, StarMoment, type Layout } from './GetReady'

/** The board reads one touch as two: the tap that opened the drums lands again on whatever is under it now. */
const TAP_GUARD_MS = 700
/** Room kept clear round the star, and between the star and the column of Ready!, Stop and the chest. */
const MARGIN = 16
/** Ready! and Stop sit this far in from the window's right edge (their own `right-7`). */
const COLUMN_RIGHT = 28

/**
 * Where the star sits in the floating window. The star's points span about 0.81 of its box across
 * and 0.77 down (the tip at 0.09, the feet at 0.86). It is as big as the window's height allows,
 * in the middle of the window (2026-10-06, the teacher: it sat off to the left), and only when
 * that would run into Ready! and Stop does it shift left and get as big as the room there allows.
 */
function measureFloat(view: Window): Layout {
  const width = view.innerWidth
  const height = view.innerHeight
  const columnLeft = width - COLUMN_RIGHT - controlButtonWidth(height)
  const byHeight = (height - 2 * MARGIN) / 0.77
  const centred = Math.min(byHeight, (columnLeft - MARGIN - width / 2) / 0.406)
  const shifted = Math.min(byHeight, (columnLeft - 2 * MARGIN) / 0.812)
  // Centred unless that costs the star more than a quarter of its size.
  const s = Math.max(100, centred >= 0.75 * shifted ? centred : shifted)
  const cx = centred >= 0.75 * shifted ? width / 2 : Math.max(MARGIN + 0.406 * s, columnLeft - MARGIN - 0.406 * s)
  return { s, top: height / 2 - 0.477 * s, cx, buttonsTop: MARGIN }
}

interface FloatGetReadyProps {
  win: Window
  lastDrum?: number
  prize: number
  silent: boolean
  onSetSilent: (silent: boolean) => void
  onChooseDrum: (seconds: number) => void
  /** A drum was chosen: the window grows from the drums to the star. */
  onStar: () => void
  onAward: (stars: number) => void
  /** Get Ready! is over (or was stopped): the window goes back to its own size. */
  onClose: () => void
}

/**
 * Get Ready! in the floating window, for the moment after an instruction while the lesson is up:
 * "How long?" as a snug rectangle of drums, then the app's own star, drum, prize and sounds in
 * the window grown big, with a treasure chest under Stop for its stars to land in. No class goal
 * meter and no words under the star (2026-10-06, the teacher): the star touched the meter, and
 * the window is all star. Every timer and animation here runs on the floating window's clock,
 * because the app's page behind the lesson gets about one timer a second.
 */
export function FloatGetReady({ win, lastDrum, prize, silent, onSetSilent, onChooseDrum, onStar, onAward, onClose }: FloatGetReadyProps) {
  const [seconds, setSeconds] = useState<number | null>(null)
  // The drum is fetched while the teacher chooses, so the first hit isn't a fallback knock.
  useEffect(() => primeTaiko(), [])

  if (seconds === null) {
    return (
      <HowLong
        win={win}
        lastDrum={lastDrum}
        silent={silent}
        onSetSilent={onSetSilent}
        onChoose={(n) => {
          onStar()
          onChooseDrum(n)
          setSeconds(n)
        }}
        onClose={onClose}
      />
    )
  }
  return (
    <div data-ink="canvas" className="h-full w-full bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]">
      <StarMoment
        seconds={seconds}
        prize={prize}
        silent={silent}
        onAward={onAward}
        onLiftMeter={() => {}}
        onClose={onClose}
        view={win}
        measure={measureFloat}
        fly={(x, y, count, size, options) =>
          flyStarsFrom(x, y, count, size, { ...options, to: win.document.querySelector<HTMLElement>('[data-float-coin]'), tracked: false })
        }
        awardOnLanding
        showWords={false}
        beside={<Chest win={win} />}
      />
    </div>
  )
}

/** The treasure chest under Stop, where the stars fly when Ready! is tapped; it swells as each lands. */
function Chest({ win }: { win: Window }) {
  // Laid out from the window's height the way Ready! and Stop are, and kept in step as it grows.
  const [height, setHeight] = useState(win.innerHeight)
  useEffect(() => {
    const update = () => setHeight(win.innerHeight)
    win.addEventListener('resize', update)
    return () => win.removeEventListener('resize', update)
  }, [win])
  const column = controlButtonWidth(height)
  const size = Math.round(column * 0.62)
  return (
    <img
      src={assetUrl('/treasure/chest-closed.svg')}
      alt=""
      draggable={false}
      data-float-coin=""
      className="pointer-events-none absolute select-none"
      style={{
        width: size,
        height: size,
        right: COLUMN_RIGHT + (column - size) / 2,
        top: MARGIN + 2 * controlButtonHeight(height) + 12 + 18,
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.35))',
      }}
    />
  )
}

/**
 * The five drums as a snug rectangle filling the window, which is made exactly tall enough for
 * them (`floatDrumsHeight` measures with the same `FLOAT_DRUMS` numbers), with a way back out.
 * Sizes come from the window's width, so they follow it as it grows.
 */
function HowLong({
  win,
  lastDrum,
  silent,
  onSetSilent,
  onChoose,
  onClose,
}: {
  win: Window
  lastDrum?: number
  silent: boolean
  onSetSilent: (silent: boolean) => void
  onChoose: (seconds: number) => void
  onClose: () => void
}) {
  const [openedAt] = useState(() => win.performance.now())
  const settled = () => win.performance.now() - openedAt >= TAP_GUARD_MS
  const { pad, gap, titleHeight, imageRatio, imageMax, numberRatio, numberMax } = FLOAT_DRUMS
  const drum = `calc((100vw - ${2 * pad + 4 * gap}px) / 5)`

  return (
    <div data-ink="panel" className="flex h-full w-full flex-col justify-center bg-card" style={{ padding: pad }}>
      <div className="flex shrink-0 items-center justify-between gap-2" style={{ height: titleHeight }}>
        <h2 className="flex-1 text-xl font-bold text-foreground">How long?</h2>
        <SoundButton silent={silent} onTap={() => settled() && onSetSilent(!silent)} className="size-10" />
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
      <div className="mt-2 flex shrink-0" style={{ gap }}>
        {GET_READY_DRUMS.map((n) => (
          <button
            key={n}
            type="button"
            data-drum={n}
            onClick={() => settled() && onChoose(n)}
            className={clsx(
              'flex min-w-0 flex-1 flex-col items-center rounded-2xl border-[3px] pt-3 pb-2.5 transition-transform active:scale-95',
              n === lastDrum ? 'border-primary bg-primary/15' : 'border-transparent bg-primary/5 dark:bg-white/10',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <img
              src={assetUrl('/get-ready/taiko-drum.svg')}
              alt=""
              draggable={false}
              className="block w-auto select-none"
              style={{ height: `min(${imageMax}px, calc(${drum} * ${imageRatio}))` }}
            />
            <span
              className="mt-1.5 block font-bold text-foreground"
              style={{ fontSize: `min(${numberMax}px, calc(${drum} * ${numberRatio}))`, lineHeight: 1 }}
            >
              {n}
            </span>
            <span className="mt-1 block text-sm leading-[18px] font-bold text-muted-foreground">seconds</span>
          </button>
        ))}
      </div>
    </div>
  )
}
