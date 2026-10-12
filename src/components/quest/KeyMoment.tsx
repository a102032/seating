import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playKeyClick, playKeyJingle } from '../../lib/sound'
import { KeyPicture } from './QuestPictures'

interface KeyMomentProps {
  /** Keys won at once: almost always one. */
  count: number
  /** The chest at the meter's end, where the key flies. */
  target: () => HTMLElement | null
  /** The key is in the lock. */
  onLanded: () => void
}

/** The board reads one touch as two: the tap that filled the goal mustn't send the key on its way. */
const TAP_GUARD_MS = 700

/**
 * A goal filled: a key. A medium moment (DECISIONS, "The plan, agreed"): a big key comes to the
 * middle of the board over a light dim, with "You got a key!" and a short jingle, no GIF and no
 * fanfare. It waits for a tap, which a student can make ("Who wants to put the key in?"), then
 * flies into the chest at the meter's end; a click, and one lock turns gold. Nothing here is on
 * a timer: the key waits as long as the teacher wants.
 */
export function KeyMoment({ count, target, onLanded }: KeyMomentProps) {
  const keyRef = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  const shownAt = useRef(0)
  const [flying, setFlying] = useState(false)
  const landedRef = useRef(onLanded)
  useEffect(() => {
    landedRef.current = onLanded
  })

  useEffect(() => {
    shownAt.current = performance.now()
    playKeyJingle()
    keyRef.current?.animate(
      [
        { transform: 'scale(0.2) rotate(-40deg)', opacity: 0 },
        { transform: 'scale(1.12) rotate(6deg)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 600, easing: 'cubic-bezier(.3,1.2,.5,1)' },
    )
  }, [])

  function send() {
    if (flying || performance.now() - shownAt.current < TAP_GUARD_MS) return
    const key = keyRef.current
    const to = target()?.getBoundingClientRect()
    if (!key || !to) {
      playKeyClick()
      landedRef.current()
      return
    }
    setFlying(true)
    const from = key.getBoundingClientRect()
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const scale = Math.max(0.12, (to.width * 0.6) / from.width)
    dimRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' })
    key
      .animate(
        [
          { transform: 'none' },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 40}px) scale(${0.6 + scale * 0.4}) rotate(-20deg)`, offset: 0.4 },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)` },
        ],
        { duration: 800, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' },
      )
      .finished.then(() => {
        playKeyClick()
        landedRef.current()
      })
  }

  return createPortal(
    <div className="fixed inset-0 z-[58] flex items-center justify-center" onPointerDown={send} data-key-moment="">
      <div ref={dimRef} className="absolute inset-0 bg-black/35" />
      <div className="relative flex flex-col items-center gap-[3vh]">
        <div
          className="rounded-full bg-white px-[1.1em] py-[0.3em] text-center font-bold text-[#3b2410] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
          style={{ fontSize: 'clamp(1.6rem, 6vmin, 3.6rem)', opacity: flying ? 0 : 1, transition: 'opacity 0.25s' }}
        >
          {count > 1 ? `You got ${count} keys!` : 'You got a key!'}
        </div>
        <div ref={keyRef} style={{ width: 'min(46vmin, 30rem)', aspectRatio: '2 / 1' }}>
          <KeyPicture
            className={flying ? '' : 'quest-key-float'}
            style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 10px 18px rgba(180,83,9,0.45))' }}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
