import { ArrowRight, Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { GuideContext, GuideStep } from '../lib/setupGuide'

interface SetupGuideProps {
  step: GuideStep
  /** "Students · 2 of 6", or "All done" on a new class's last word. */
  where: string
  /** The last step of the section being guided: Next says Finish. */
  finish: boolean
  context: Omit<GuideContext, 'showing'>
  onNext: () => void
  onSkip: () => void
  onStop: () => void
  /** The last word of a new class's walk: Show me starts the tour. */
  onTour: () => void
}

type Box = { left: number; top: number; right: number; bottom: number }

/** Room round the lit thing, so its edge isn't cut by the hole. */
const PAD = 6
const GAP = 10
/** The bubble keeps this far from the window's edges. */
const EDGE = 8
/**
 * The helper's own colours, the same in every theme (2026-10-06, the teacher): a soft sky blue with
 * navy words, and the strong blue only on Next, the one thing to tap to go on. The windows are
 * white, so a white bubble read as one more place to do something.
 */
const GUIDE = { sky: '#dcefff', navy: '#0c2d57', blue: '#0b74c4' }

/**
 * The part of an element that shows: inside a list that scrolls (the roster), the rest is hidden,
 * and a hole round all of it would light whatever sits below the list.
 */
function visiblePart(el: Element): Box {
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
  return { left, top, right, bottom }
}

/** Whether nothing but the guide itself is over this element: a window opened on top hides the guide. */
function uncovered(el: Element, box: Box): boolean {
  const x = Math.min(innerWidth - 1, Math.max(0, (box.left + box.right) / 2))
  const y = Math.min(innerHeight - 1, Math.max(0, box.top + Math.min((box.bottom - box.top) / 2, 20)))
  const hit = document.elementsFromPoint(x, y).find((e) => !e.closest('[data-guide-layer]'))
  return Boolean(hit && (el === hit || el.contains(hit) || hit.closest('[data-radix-popper-content-wrapper]')))
}

/**
 * Everything the step lights that is on the screen, as one box, with any menu or list opened from
 * it (the Import menu, Boy or Girl), so what it opens can be used too. 'covered' when a window is
 * open over it; 'missing' when it isn't on the screen at all.
 */
function findTargets(selectors: string[]): Box | 'covered' | 'missing' {
  const boxes: Box[] = []
  let covered = false
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      const b = visiblePart(el)
      if (b.right - b.left < 4 || b.bottom - b.top < 4) return
      if (!uncovered(el, b)) covered = true
      else boxes.push(b)
    })
  }
  if (boxes.length === 0) return covered ? 'covered' : 'missing'
  document.querySelectorAll('[data-radix-popper-content-wrapper]').forEach((el) => {
    if (el.closest('[data-help-menu]')) return
    const b = el.getBoundingClientRect()
    if (b.width > 4 && b.height > 4) boxes.push({ left: b.left, top: b.top, right: b.right, bottom: b.bottom })
  })
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    top: Math.min(...boxes.map((b) => b.top)),
    right: Math.max(...boxes.map((b) => b.right)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  }
}

/** Class Settings' window, which the fade and the bubble stay inside, as in the preview. */
function windowBox(): Box {
  const win = document.querySelector('[data-slot="dialog-content"] .cs-main')?.closest('[data-slot="dialog-content"]')
  const r = win?.getBoundingClientRect()
  return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
}

/**
 * Under the lit thing if it fits, else over it, else beside it (a tall menu), else wherever covers
 * least of it (the whole student list): always inside the window.
 */
function place(hole: Box, win: Box, w: number, h: number): { left: number; top: number } {
  const clampX = (x: number) => Math.min(Math.max(win.left + EDGE, x), win.right - w - EDGE)
  const sideTop = Math.min(Math.max(win.top + EDGE, hole.top), win.bottom - h - EDGE)
  const left = clampX(hole.left)
  if (hole.bottom + GAP + h <= win.bottom - EDGE) return { left, top: hole.bottom + GAP }
  if (hole.top - GAP - h >= win.top + EDGE) return { left, top: hole.top - GAP - h }
  if (hole.left - GAP - w >= win.left + EDGE) return { left: hole.left - GAP - w, top: sideTop }
  if (hole.right + GAP + w <= win.right - EDGE) return { left: hole.right + GAP, top: sideTop }
  const below = Math.min(hole.bottom + GAP, win.bottom - h - EDGE)
  const above = Math.max(win.top + EDGE, hole.top - GAP - h)
  const covers = (t: number) => Math.max(0, Math.min(t + h, hole.bottom) - Math.max(t, hole.top))
  return { left, top: covers(below) <= covers(above) ? below : above }
}

/**
 * The guide, drawn over Class Settings: one thing lit with an amber ring, the rest of the window
 * faded and closed to taps, and a sky-blue bubble beside it saying what to do, with Skip and Next.
 * The lit thing is used as it is. It follows its target as menus open and the list scrolls, reading
 * where it is once a frame while the guide is up: setup happens at a desk, not mid-lesson, so that
 * small cost is fine here.
 */
export function SetupGuide({ step, where, finish, context, onNext, onSkip, onStop, onTour }: SetupGuideProps) {
  const [frame, setFrame] = useState<{ hole: Box | 'covered' | 'missing'; win: Box; text: string } | null>(null)
  const [bubbleSize, setBubbleSize] = useState({ w: 384, h: 140 })
  const bubbleRef = useRef<HTMLDivElement>(null)
  const lastKey = useRef('')
  const ctxRef = useRef(context)
  useLayoutEffect(() => {
    ctxRef.current = context
  })

  useLayoutEffect(() => {
    let raf = 0
    const read = () => {
      const hole = findTargets(step.targets)
      const win = windowBox()
      const ctx: GuideContext = { ...ctxRef.current, showing: (sel) => document.querySelector(sel) !== null }
      const text = typeof step.text === 'function' ? step.text(ctx) : step.text
      const key = JSON.stringify([
        typeof hole === 'string' ? hole : Object.values(hole).map(Math.round),
        Object.values(win).map(Math.round),
        text,
      ])
      if (key !== lastKey.current) {
        lastKey.current = key
        setFrame({ hole, win, text })
      }
      const el = bubbleRef.current
      if (el)
        setBubbleSize((old) =>
          Math.abs(old.w - el.offsetWidth) > 1 || Math.abs(old.h - el.offsetHeight) > 1 ? { w: el.offsetWidth, h: el.offsetHeight } : old,
        )
      raf = requestAnimationFrame(read)
    }
    read()
    return () => cancelAnimationFrame(raf)
  }, [step])

  // The step's box gets the cursor, so "Type the name of your class" can be typed straight away.
  useEffect(() => {
    if (!step.focus) return
    const id = requestAnimationFrame(() => document.querySelector<HTMLElement>(step.focus!)?.focus())
    return () => cancelAnimationFrame(id)
  }, [step])

  if (!frame) return null
  const { win, text } = frame
  // A window opened over the lit thing (the pasted list, a question) hides the guide until it closes.
  if (frame.hole === 'covered') return null
  // Nothing to light (it shouldn't happen): the whole window faded, the bubble in its middle, so
  // Next and Stop are always there.
  const found = frame.hole !== 'missing' ? frame.hole : null
  const hole = found
    ? {
        left: Math.max(win.left + 4, found.left - PAD),
        top: Math.max(win.top + 4, found.top - PAD),
        right: Math.min(win.right - 4, found.right + PAD),
        bottom: Math.min(win.bottom - 4, found.bottom + PAD),
      }
    : {
        left: (win.left + win.right) / 2,
        top: (win.top + win.bottom) / 2,
        right: (win.left + win.right) / 2,
        bottom: (win.top + win.bottom) / 2,
      }
  const at = found
    ? place(hole, win, bubbleSize.w, bubbleSize.h)
    : { left: (win.left + win.right - bubbleSize.w) / 2, top: (win.top + win.bottom - bubbleSize.h) / 2 }
  const last = step.section === null
  const block = (style: CSSProperties) => <div className="pointer-events-auto absolute" style={style} />

  return createPortal(
    <div data-guide-layer="" className="pointer-events-none fixed inset-0 z-[100]">
      {/* Taps anywhere but the lit thing and the bubble go nowhere. */}
      {block({ left: 0, top: 0, right: 0, height: hole.top })}
      {block({ left: 0, top: hole.bottom, right: 0, bottom: 0 })}
      {block({ left: 0, top: hole.top, width: hole.left, height: hole.bottom - hole.top })}
      {block({ left: hole.right, top: hole.top, right: 0, height: hole.bottom - hole.top })}
      {/* The fade is the hole's own shadow, kept inside the window. */}
      <div
        className="absolute overflow-hidden rounded-3xl"
        style={{ left: win.left, top: win.top, width: win.right - win.left, height: win.bottom - win.top }}
      >
        <div
          data-guide-hole=""
          className="absolute rounded-[14px] transition-[left,top,width,height] duration-200"
          style={{
            left: hole.left - win.left,
            top: hole.top - win.top,
            width: hole.right - hole.left,
            height: hole.bottom - hole.top,
            // Faded toward the window's own colour: white in the light themes, as in the preview, and
            // dark in Dark and Chalkboard, where a white wash left the words glaring.
            boxShadow: `${found ? '0 0 0 3px #f59e0b, ' : ''}0 0 0 4000px color-mix(in srgb, var(--card) 74%, transparent)`,
          }}
        />
      </div>
      <div
        ref={bubbleRef}
        data-guide-bubble=""
        role="dialog"
        aria-label="Guide"
        className="pointer-events-auto absolute flex flex-col gap-1.5 rounded-2xl px-3.5 py-2.5 shadow-xl [@media(max-height:540px)]:gap-1 [@media(max-height:540px)]:py-2"
        style={{ left: at.left, top: at.top, width: Math.min(384, win.right - win.left - 16), background: GUIDE.sky, color: GUIDE.navy }}
      >
        <div className="flex items-center justify-between gap-2 text-[13px] font-bold" style={{ color: GUIDE.blue }}>
          <span>{where}</span>
          <button
            type="button"
            onClick={onStop}
            data-guide-stop=""
            className="rounded-lg px-2 py-0.5 opacity-75 hover:bg-white/60 hover:opacity-100"
            style={{ color: GUIDE.navy }}
          >
            Stop guide
          </button>
        </div>
        <p className="m-0 text-base font-bold leading-snug [@media(max-height:540px)]:text-[15px]">{text}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={last ? onStop : onSkip}
            data-guide-skip=""
            className="rounded-xl px-3.5 py-1.5 font-bold hover:bg-white/60"
            style={{ color: GUIDE.navy, touchAction: 'manipulation' }}
          >
            {last ? 'Not now' : 'Skip'}
          </button>
          {/* A plain button, so no theme restyles it. */}
          <button
            type="button"
            onClick={last ? onTour : onNext}
            data-guide-next=""
            className="inline-flex items-center gap-1 rounded-xl px-[18px] py-1.5 font-bold text-white transition-[scale] duration-150 active:scale-[0.96]"
            style={{ background: GUIDE.blue, touchAction: 'manipulation' }}
          >
            {last ? (
              <>
                Show me <ArrowRight size={18} />
              </>
            ) : finish ? (
              <>
                Finish <Check size={18} />
              </>
            ) : (
              <>
                Next <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
