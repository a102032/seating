import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PIRATE_PIECES } from '../lib/quest'
import { puzzleSVG } from '../lib/pirateArt'
import { playKeyClick, playKeyJingle } from '../lib/sound'

/** The board reads one touch as two: a step that has just appeared ignores taps this long. */
const GUARD_MS = 700
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * A goal filled on the Pirate Quest (DECISIONS, "The Pirate Quest"): "You found a map piece!" over
 * a light dim, the puzzle of the island the class is sailing to with the new piece hovering over
 * its gap. A tap, a student's, puts it in with a click; then a tap sails on (the map opens, the
 * ship sails and that piece's clouds blow away). The last piece makes the island whole: the X
 * shows where to dig, with Sail and dig! and Later. `whole` shows a whole puzzle straight away, as
 * a tap on the meter's puzzle does. Nothing ends on a clock.
 */
export function PieceMoment({
  island,
  from,
  to,
  whole = false,
  onClose,
  onSail,
  onDig,
}: {
  island: number
  /** Pieces already in the puzzle. */
  from: number
  /** Pieces in it once the ones just won are put in. */
  to: number
  whole?: boolean
  /** The moment put away (the meter empties for the next goal). */
  onClose: () => void
  onSail: () => void
  onDig: () => void
}) {
  const need = PIRATE_PIECES[island]
  const [placed, setPlaced] = useState(whole ? need : from)
  const [moving, setMoving] = useState(false)
  const shownAt = useRef(Infinity)
  const puzzleRef = useRef<HTMLDivElement>(null)
  const justWhole = useRef(false)
  const done = placed >= need
  const lifting = !whole && placed < to

  useEffect(() => {
    shownAt.current = performance.now()
    if (!whole) playKeyJingle()
  }, [whole])

  // Drawn by hand, not through React, so the piece's own animation isn't redrawn under it.
  useLayoutEffect(() => {
    const el = puzzleRef.current
    if (!el) return
    el.innerHTML = puzzleSVG(island, placed, { lift: lifting ? placed : -1, light: true, mark: done })
    if (justWhole.current) el.querySelector('.pirate-x')?.classList.add('pirate-x-pop')
    justWhole.current = false
  }, [island, placed, lifting, done])

  function tap() {
    if (moving || performance.now() - shownAt.current < GUARD_MS) return
    if (lifting) {
      const pc = puzzleRef.current?.querySelector<SVGGElement>('[data-lift]')
      setMoving(true)
      const put = () => {
        playKeyClick()
        justWhole.current = placed + 1 >= need
        setPlaced(placed + 1)
        setMoving(false)
        shownAt.current = performance.now()
        puzzleRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 300 })
      }
      if (!pc || reduceMotion()) return put()
      pc.parentElement?.classList.remove('pirate-hover')
      pc.animate([{ transform: pc.style.transform }, { transform: 'translate(0,0) rotate(0) scale(1)' }], {
        duration: 520,
        easing: 'cubic-bezier(.3,1.3,.5,1)',
        fill: 'forwards',
      }).onfinish = put
      return
    }
    if (!done) {
      onClose()
      onSail()
    }
  }

  const won = to - from
  const title =
    whole || done
      ? 'The map is whole!'
      : lifting && placed === from
        ? won > 1
          ? `You found ${won} map pieces!`
          : 'You found a map piece!'
        : `${placed} of ${need} pieces!`
  const say = done ? `X marks the spot on island ${island + 1}.` : lifting ? 'Tap to put it in.' : 'Tap to sail on.'
  return createPortal(
    <div
      data-quest-moment="piece"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[2.4vh]"
      onPointerDown={tap}
    >
      <div className="absolute inset-0 bg-[rgba(14,22,44,0.82)]" />
      <div className="relative text-center font-bold text-white" style={{ fontSize: 'clamp(1.6rem, 7vmin, 3.4rem)' }}>
        {title}
      </div>
      <div
        ref={puzzleRef}
        data-pirate-puzzle=""
        className="relative mt-[2vh] w-[min(52vh,62vw)] drop-shadow-[0_10px_18px_rgba(0,0,0,0.4)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      />
      <div className="relative text-center font-bold text-[#cfe3f5]" style={{ fontSize: 'clamp(1rem, 3.6vmin, 1.6rem)' }}>
        {say}
      </div>
      {done && (
        <div className="relative flex gap-4">
          <button
            type="button"
            className="quest-stage-btn quest-spin"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (performance.now() - shownAt.current < GUARD_MS) return
              onClose()
              onDig()
            }}
          >
            Sail and dig!
          </button>
          <button
            type="button"
            className="quest-stage-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => performance.now() - shownAt.current >= GUARD_MS && onClose()}
          >
            Later
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
