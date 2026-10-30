import { useLayoutEffect, useRef, type MouseEvent } from 'react'
import { assetUrl } from '../lib/assets'
import { questIsOn } from '../lib/points'
import type { ClassData } from '../types'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

/** The window opens under the finger that tapped the meter, and the board reads one touch as two. */
const TAP_GUARD_MS = 700

/** The picture the class's meter starts from: the map, or the Marble Jar's handful of marbles (PointsMeter). */
function startPictureOf(cls: ClassData): string {
  return assetUrl(questIsOn(cls) ? '/quest/marbles.svg' : '/treasure/map.svg')
}

const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z'

/**
 * All Stars In!, asked first (2026-10-26, the teacher): the picture at the meter's start sends every
 * star waiting on the desks into the goal, and a stray tap mid-lesson would send them early, past
 * where − can take one back. The picture shows what will happen: stars leaving a desk and drifting
 * into this class's meter, on a loop, in CSS (`.send-star`).
 */
export function SendStarsModal({
  open,
  cls,
  stars,
  onSend,
  onClose,
}: {
  open: boolean
  cls: ClassData
  stars: number
  onSend: () => void
  onClose: () => void
}) {
  const openedAt = useRef(0)
  useLayoutEffect(() => {
    if (open) openedAt.current = performance.now()
  }, [open])
  const shown = useLingerWhileClosing(open)
  if (!shown) return null
  const ready = (e: MouseEvent) => e.timeStamp - openedAt.current >= TAP_GUARD_MS

  return (
    // The board's second touch of the meter lands outside the window as it opens, where a tap closes it.
    <Modal
      open={open}
      onClose={() => performance.now() - openedAt.current >= TAP_GUARD_MS && onClose()}
      title="Send the stars to the goal?"
    >
      <div className="flex flex-col items-center gap-4" data-send-stars="">
        <div className="relative h-[110px] w-[300px] shrink-0" aria-hidden>
          {/* A desk with its stars waiting. */}
          <div className="absolute bottom-2 left-0 flex h-[58px] w-[82px] items-end justify-center rounded-t-xl bg-sky-200 pb-1.5 text-sm font-bold text-sky-950">
            Amy
            <span className="absolute -right-2 -top-2 min-w-6 rounded-full bg-amber-400 px-1.5 text-center text-sm font-bold text-amber-950 shadow">
              ★
            </span>
          </div>
          {/* The dotted way the stars go. */}
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 300 110">
            <path d="M 41 44 Q 150 -25 238 62" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
          </svg>
          {[0, 1, 2].map((i) => (
            <svg key={i} viewBox="0 0 24 24" className="send-star absolute left-0 top-0 h-6 w-6" style={{ animationDelay: `${i * 0.6}s` }}>
              <path d={STAR} fill="#facc15" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          ))}
          {/* This class's meter: the picture it starts from, and the bar filling. */}
          <div className="absolute bottom-5 right-0 flex w-[130px] items-center gap-1.5">
            <img src={startPictureOf(cls)} alt="" className="h-11 w-11 shrink-0" />
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="send-fill h-full rounded-full" style={{ background: 'linear-gradient(90deg, #38bdf8, #a3e635, #facc15)' }} />
            </div>
          </div>
        </div>
        <p className="text-center text-lg">
          {stars === 1 ? '1 star on the desks goes' : `${stars} stars on the desks go`} into the class goal.
        </p>
        <div className="flex w-full gap-3">
          <TactileButton type="button" className="flex-1" onClick={(e) => ready(e) && onClose()}>
            Not now
          </TactileButton>
          <TactileButton type="button" variant="primary" className="flex-1" data-send-stars-yes="" onClick={(e) => ready(e) && onSend()}>
            Send them!
          </TactileButton>
        </div>
      </div>
    </Modal>
  )
}
