import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { GUIDE_STEPS, type GuideStepId } from '../lib/setupGuide'

interface SetupGuideProps {
  step: GuideStepId
  onNext: () => void
  onSkip: () => void
  /** Words for this class in place of the step's own: the last word, for a class with no points. */
  text?: string
}

type Box = { left: number; top: number; width: number; height: number }

/** Room round the lit thing, so its edge isn't cut by the hole. */
const PAD = 8
const BUBBLE_WIDTH = 340
const GAP = 14
/**
 * The helper's own colours, the same in every theme: a soft sky blue with navy words (about 10:1),
 * and the stronger blue only on Next, the one thing to tap to go on. A full-strength blue bubble
 * was too loud on the board (2026-10-06, the teacher).
 */
const GUIDE = { sky: '#dbeafe', navy: '#1e3a8a', ink: '#1e40af', blue: '#2563eb' }
/** The bubble keeps this far from the screen's edges. */
const EDGE = 12
/** The narrowest the bubble goes to fit beside the lit thing. */
const SIDE_WIDTH = 260

/**
 * Where the bubble goes: under the lit thing, or over it, or beside it, whichever it fits in
 * first - below reads most naturally, and a tall thing (the class goal in its window) leaves
 * room only at the side on a short screen. If it fits nowhere it sits at the bottom of the
 * screen, inside it, even if that covers part of the lit thing: a bubble cut off by the screen's
 * edge can't be read or tapped at all.
 */
function place(box: Box, width: number, height: number): { left: number; top: number; width: number } {
  const clampX = (x: number) => Math.max(EDGE, Math.min(innerWidth - width - EDGE, x))
  const clampY = (y: number) => Math.max(EDGE, Math.min(innerHeight - height - EDGE, y))
  const centreX = clampX(box.left + box.width / 2 - width / 2)
  const centreY = clampY(box.top + box.height / 2 - height / 2)
  const below = box.top + box.height + PAD + GAP
  if (below + height <= innerHeight - EDGE) return { left: centreX, top: below, width }
  const above = box.top - PAD - GAP - height
  if (above >= EDGE) return { left: centreX, top: above, width }
  // Beside it the bubble may be a little narrower, rather than cover what it points at.
  const right = box.left + box.width + PAD + GAP
  const roomRight = Math.min(width, innerWidth - EDGE - right)
  if (roomRight >= SIDE_WIDTH) return { left: right, top: centreY, width: roomRight }
  const roomLeft = Math.min(width, box.left - PAD - GAP - EDGE)
  if (roomLeft >= SIDE_WIDTH) return { left: box.left - PAD - GAP - roomLeft, top: centreY, width: roomLeft }
  return { left: centreX, top: innerHeight - height - EDGE, width }
}

/** The little point on the bubble's edge nearest the lit thing, or none if they overlap. */
function arrowFor(box: Box, { left, top }: { left: number; top: number }, width: number, height: number): CSSProperties | null {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  if (top >= box.top + box.height) return { left: clamp(box.left + box.width / 2, left + 20, left + width - 20) - left - 9, top: -9 }
  if (top + height <= box.top) return { left: clamp(box.left + box.width / 2, left + 20, left + width - 20) - left - 9, bottom: -9 }
  const y = clamp(box.top + box.height / 2, top + 20, top + height - 20) - top - 9
  if (left >= box.left + box.width) return { left: -9, top: y }
  if (left + width <= box.left) return { right: -9, top: y }
  return null
}

/**
 * The part of an element that shows: inside a list that scrolls (the roster on a short screen),
 * the rest is hidden, and a hole round all of it would light whatever sits below the list.
 */
function visiblePart(el: HTMLElement): Box {
  const r = el.getBoundingClientRect()
  let { left, top, right, bottom } = r
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const style = getComputedStyle(p)
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
    const c = p.getBoundingClientRect()
    left = Math.max(left, c.left)
    top = Math.max(top, c.top)
    right = Math.min(right, c.right)
    bottom = Math.min(bottom, c.bottom)
  }
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

/**
 * Finds the thing a step points at, if it is on the screen and nothing covers it: a window opened
 * on top (the pasted list, the avatar picker) hides the guide until it closes, and a step whose
 * window is closing shows nothing rather than a hole over empty space.
 */
function findTarget(selectors: string[]): Box | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) continue
    const r = visiblePart(el)
    if (r.width < 4 || r.height < 4) continue
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2))
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 20)))
    const hit = document.elementFromPoint(x, y)
    if (!hit || !(el === hit || el.contains(hit))) continue
    return r
  }
  return null
}

/**
 * The guided first setup, drawn over everything: the screen faded but for a lit hole round the
 * one thing to do, and a bubble beside it saying what to do, with Next and Skip. The fade lets
 * taps through, so the lit thing is used as it is; only the bubble takes taps of its own (and the
 * window under it is told not to close for them - see `Modal`). It follows its target as windows
 * open and move, reading where it is once a frame while the guide is up: setup happens at a desk,
 * not mid-lesson, so that small cost is fine here.
 */
export function SetupGuide({ step, onNext, onSkip, text }: SetupGuideProps) {
  const def = GUIDE_STEPS.find((s) => s.id === step)!
  const shown = GUIDE_STEPS.filter((s) => s.id !== 'ready')
  const number = shown.findIndex((s) => s.id === step) + 1
  const [box, setBox] = useState<Box | null>(null)
  const [bubbleHeight, setBubbleHeight] = useState(160)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const last = useRef('')

  useLayoutEffect(() => {
    let frame = 0
    const read = () => {
      const next = def.targets.length ? findTarget(def.targets) : null
      const key = next ? `${Math.round(next.left)},${Math.round(next.top)},${Math.round(next.width)},${Math.round(next.height)}` : 'none'
      if (key !== last.current) {
        last.current = key
        setBox(next)
      }
      const h = bubbleRef.current?.offsetHeight
      if (h) setBubbleHeight((old) => (Math.abs(old - h) > 1 ? h : old))
      frame = requestAnimationFrame(read)
    }
    read()
    return () => cancelAnimationFrame(frame)
  }, [def])

  // The thing to do may be lower down in a window that scrolls inside (the class goal).
  useEffect(() => {
    for (const selector of def.targets) {
      const el = document.querySelector<HTMLElement>(selector)
      if (el) {
        el.scrollIntoView({ block: 'nearest' })
        break
      }
    }
  }, [def])

  const centred = def.targets.length === 0
  // A step with a target waits for it: nothing is drawn while its window opens or is covered.
  if (!centred && !box) return null

  let width = Math.min(BUBBLE_WIDTH, innerWidth - 2 * EDGE)
  let bubble: CSSProperties
  let arrow: CSSProperties | null = null
  if (centred || !box) {
    bubble = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  } else {
    const at = place(box, width, bubbleHeight)
    width = at.width
    bubble = { left: at.left, top: at.top }
    arrow = arrowFor(box, at, width, bubbleHeight)
  }

  return createPortal(
    <div data-guide-layer="" className="pointer-events-none fixed inset-0 z-[100]">
      {centred ? (
        <div className="absolute inset-0 bg-slate-950/55" />
      ) : (
        box && (
          // The fade is the hole's own shadow: everything but the lit thing goes dark, and taps
          // still reach the lit thing through it.
          <div
            data-guide-hole=""
            className="absolute rounded-2xl transition-[left,top,width,height] duration-200"
            style={{
              left: box.left - PAD,
              top: box.top - PAD,
              width: box.width + 2 * PAD,
              height: box.height + 2 * PAD,
              // An amber ring, then the fade (a ring class would be lost under this inline shadow).
              boxShadow: '0 0 0 4px #fbbf24, 0 0 0 9999px rgba(2, 6, 23, 0.55)',
            }}
          />
        )
      )}
      {/* The bubble is blue in every theme (2026-10-06, the teacher): the windows are white, so a
          white bubble read as one more place to do something. Sky blue says it is the helper. */}
      <div
        data-guide-bubble=""
        role="dialog"
        aria-label={def.title}
        ref={bubbleRef}
        className="pointer-events-auto absolute rounded-2xl p-4 shadow-2xl"
        style={{ ...bubble, width, background: GUIDE.sky, color: GUIDE.navy }}
      >
        {arrow && <span className="absolute size-[18px] rotate-45" style={{ ...arrow, background: GUIDE.sky }} aria-hidden />}
        {!centred && <p className="text-xs font-bold" style={{ color: GUIDE.blue }}>{`Step ${number} of ${shown.length}`}</p>}
        <p className="mt-0.5 text-lg font-bold">{def.title}</p>
        <p className="mt-1 text-sm" style={{ color: GUIDE.ink }}>
          {text ?? def.text}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          {centred ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onSkip}
              data-guide-skip=""
              className="rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-blue-200/60"
              style={{ color: GUIDE.ink }}
            >
              Skip
            </button>
          )}
          {/* A plain button, so no theme restyles it. */}
          <button
            type="button"
            onClick={centred ? onSkip : onNext}
            data-guide-next=""
            className="rounded-xl px-4 py-2 font-bold text-white shadow-sm transition-[scale] duration-150 active:scale-[0.96]"
            style={{ background: GUIDE.blue, touchAction: 'manipulation' }}
          >
            {centred ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
