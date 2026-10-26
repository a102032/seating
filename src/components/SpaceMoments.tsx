import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BARS_PER_CELL, TRIP_CELLS } from '../lib/quest'
import { cap, fuelPicture, PLACES } from '../lib/spaceArt'
import { spaceSound as S } from '../lib/spaceSound'

/** The board reads one touch as two: a step that has just appeared ignores taps this long. */
const GUARD_MS = 700
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * A goal filled on the Space Quest (DECISIONS, "The Space Quest"): "More fuel!" over a dim, the
 * trip's fuel cells big with the barrel over the one it fills. A tap, a student's, tips the barrel:
 * the fuel pours in and two bars light. A tap then shows the rocket (Our Quest). The cells full:
 * "The fuel cells are full!" with Blast off! and Later. `whole` shows full cells straight away, as a
 * tap on the meter's cells does. Nothing ends on a clock.
 */
export function FuelMoment({
  trip,
  from,
  to,
  whole = false,
  onClose,
  onSee,
  onBlast,
}: {
  trip: number
  /** Bars already in the cells. */
  from: number
  /** Bars in them once this goal's fuel is poured in. */
  to: number
  whole?: boolean
  /** The moment put away (the meter empties for the next goal). */
  onClose: () => void
  onSee: () => void
  onBlast: () => void
}) {
  const need = TRIP_CELLS[trip] * BARS_PER_CELL
  const [bars, setBars] = useState(whole ? need : from)
  const [step, setStep] = useState<'ready' | 'pouring' | 'poured' | 'full'>(whole ? 'full' : 'ready')
  const shownAt = useRef(Infinity)
  const artRef = useRef<HTMLDivElement>(null)
  const pic = useRef(fuelPicture(trip, whole ? need : from, !whole, whole))

  useEffect(() => {
    shownAt.current = performance.now()
    if (whole) S.full()
  }, [whole])

  // Drawn by hand, not through React, so the pour's own animation isn't redrawn under it.
  useEffect(() => {
    if (artRef.current) artRef.current.innerHTML = pic.current.svg
  }, [])

  async function pour() {
    const svg = artRef.current?.querySelector('svg')
    const barrel = svg?.querySelector<SVGGElement>('[data-space-barrel]')
    if (!svg || !barrel) return
    setStep('pouring')
    const quick = reduceMotion()
    const cx = pic.current.cellX(Math.floor(from / BARS_PER_CELL))
    // The barrel tips, the fuel pours in a stream of drops, and the bars light one by one.
    barrel.style.transformBox = 'fill-box'
    barrel.style.transformOrigin = 'center'
    await barrel.animate(
      [{ transform: `translate(${cx - 50}px, 10px) rotate(0deg)` }, { transform: `translate(${cx - 20}px, 0px) rotate(115deg)` }],
      { duration: quick ? 150 : 450, easing: 'ease-out', fill: 'forwards' },
    ).finished
    S.pour()
    const stream = svg.querySelector('[data-space-stream]')!
    for (let i = 0; i < 30 && !quick; i++) {
      const d = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      d.setAttribute('cx', String(cx - 10 + Math.random() * 10))
      d.setAttribute('cy', '95')
      d.setAttribute('r', String(5 + Math.random() * 4))
      d.setAttribute('fill', i % 3 ? '#b6e84f' : '#8ac9fe')
      d.style.opacity = '0'
      stream.appendChild(d)
      // Each drop falls into the cell's cap and is gone, so nothing is left lying on top (2026-10-26, the teacher).
      d.animate(
        [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(40px)', opacity: 1, offset: 0.7 },
          { transform: 'translateY(56px)', opacity: 0 },
        ],
        { duration: 380, delay: i * 35, easing: 'ease-in' },
      ).onfinish = () => d.remove()
    }
    const cells = svg.querySelectorAll('.space-cell')
    for (let b = from; b < to; b++) {
      await wait(quick ? 50 : b === from ? 450 : 380)
      const cell = cells[Math.floor(b / BARS_PER_CELL)]
      cell?.querySelector('.space-low')?.remove()
      const bar = cell?.querySelectorAll<SVGRectElement>('.space-bar')[b % BARS_PER_CELL]
      if (bar) {
        bar.style.transformBox = 'fill-box'
        bar.style.transformOrigin = '50% 100%'
        bar.animate(
          [
            { opacity: 0, transform: 'scaleY(.2)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 300, fill: 'forwards' },
        )
      }
      S.bar(b)
      setBars(b + 1)
    }
    await wait(quick ? 50 : 350)
    barrel.animate(
      [
        { transform: `translate(${cx - 20}px, 0px) rotate(115deg)` },
        { transform: `translate(${cx - 50}px, -40px) rotate(0deg)`, opacity: 0 },
      ],
      { duration: 400, fill: 'forwards' },
    )
    shownAt.current = performance.now()
    if (to >= need) {
      await wait(300)
      svg.querySelectorAll('.space-cell').forEach((c) => c.classList.add('space-glow-cell'))
      S.full()
      setStep('full')
    } else setStep('poured')
  }

  function tap() {
    if (performance.now() - shownAt.current < GUARD_MS) return
    if (step === 'ready') void pour()
    else if (step === 'poured') {
      onClose()
      onSee()
    }
  }

  const next = PLACES[trip + 1]?.name ?? ''
  const title = step === 'full' ? 'The fuel cells are full!' : step === 'poured' ? `${bars} of ${need} bars!` : 'More fuel!'
  const say =
    step === 'full'
      ? `Next stop: ${cap(next)}.`
      : step === 'poured'
        ? 'Tap to see the rocket.'
        : step === 'ready'
          ? 'Tap to pour it in.'
          : ''
  return createPortal(
    <div
      data-quest-moment="fuel"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[2.4vh]"
      onPointerDown={tap}
    >
      <div className="absolute inset-0 bg-[rgba(12,14,40,0.86)]" />
      <div className="relative text-center font-bold text-white" style={{ fontSize: 'clamp(1.6rem, 7vmin, 3.4rem)' }}>
        {title}
      </div>
      <div
        ref={artRef}
        data-space-fuel-art=""
        className="relative drop-shadow-[0_10px_18px_rgba(0,0,0,0.4)] [&>svg]:block [&>svg]:h-full [&>svg]:w-auto"
        style={{ height: whole ? 'min(34vh, 260px)' : 'min(52vh, 420px)' }}
      />
      <div className="relative min-h-[1.5em] text-center font-bold text-[#d2d8ff]" style={{ fontSize: 'clamp(1rem, 3.6vmin, 1.6rem)' }}>
        {say}
      </div>
      {step === 'full' && (
        <div className="relative flex gap-4">
          <button
            type="button"
            className="quest-stage-btn quest-spin"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (performance.now() - shownAt.current < GUARD_MS) return
              onClose()
              onBlast()
            }}
          >
            Blast off!
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
