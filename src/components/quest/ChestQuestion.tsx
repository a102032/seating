import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CHESTS } from '../../lib/quest'
import { playChestReady } from '../../lib/sound'
import { ChestPicture } from './QuestPictures'

/** The board reads one touch as two: the tap that won the last key mustn't answer the question. */
const TAP_GUARD_MS = 700

/**
 * Every lock is gold: the chest comes to the middle of the board and asks (2026-10-13, the
 * teacher: a chest left rattling at the bar's end could be forgotten while the stars went on
 * adding up). Open it now is the chest opening; Later puts it back at the bar's end, rattling,
 * where a tap opens it, and the question comes back the next time the class is opened.
 */
export function ChestQuestion({ chest, onOpen, onLater }: { chest: number; onOpen: () => void; onLater: () => void }) {
  const shownAt = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    shownAt.current = performance.now()
    playChestReady()
    boxRef.current?.animate(
      [
        { transform: 'scale(0.3)', opacity: 0 },
        { transform: 'scale(1.08)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 600, easing: 'cubic-bezier(.3,1.2,.5,1)' },
    )
  }, [])
  const guarded = (fn: () => void) => () => {
    if (performance.now() - shownAt.current < TAP_GUARD_MS) return
    fn()
  }
  const tier = CHESTS[chest]

  return createPortal(
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/60" data-chest-question="">
      <div ref={boxRef} className="flex flex-col items-center gap-[2.5vh] px-4 text-center">
        <div className="meter-chest-rattle" style={{ width: 'min(34vmin, 15rem)', filter: 'drop-shadow(0 0 26px rgba(251,191,36,0.85))' }}>
          <ChestPicture chest={chest} keys={tier.keys} className="aspect-[120/104] w-full" />
        </div>
        <div className="font-bold text-white [text-shadow:0_3px_0_rgba(0,0,0,0.35)]" style={{ fontSize: 'clamp(1.6rem, 6vmin, 3.4rem)' }}>
          You have all the keys!
        </div>
        <div className="font-bold text-amber-200" style={{ fontSize: 'clamp(1.1rem, 3.4vmin, 1.9rem)' }}>
          Open the {tier.name} chest?
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={guarded(onOpen)}
            className="rounded-2xl bg-amber-400 px-[1.4em] py-[0.5em] font-bold text-amber-950 shadow-[0_5px_0_#b45309] active:translate-y-[3px] active:shadow-[0_2px_0_#b45309]"
            style={{ fontSize: 'clamp(1.1rem, 3.6vmin, 1.8rem)' }}
          >
            Open it now
          </button>
          <button
            type="button"
            onClick={guarded(onLater)}
            className="rounded-2xl bg-white px-[1.4em] py-[0.5em] font-bold text-[#3b2a75] shadow-[0_5px_0_#b9acd9] active:translate-y-[3px] active:shadow-[0_2px_0_#b9acd9]"
            style={{ fontSize: 'clamp(1.1rem, 3.6vmin, 1.8rem)' }}
          >
            Later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
