import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { drawJarBack, drawJarFront, jarPicture, marbleWheelSVG } from '../lib/marbleArt'
import { MarbleLayer } from '../lib/marbleLayer'
import { MarbleJarWorld } from '../lib/marblePhysics'
import { JAR, WEDGES, WEDGE_WORDS, jarIsFull, marblesFor, spinLanding, type MarbleJarState, type SavedMarble } from '../lib/marbles'
import { pointerSVG } from '../lib/questArt'
import {
  playJarFull,
  playMarbleClink,
  playMarbleGrow,
  playMarblePop,
  playMarbleZap,
  playMegaThud,
  playPickerLand,
  playPickerTick,
  primeMarbles,
} from '../lib/sound'

/**
 * The Marble Jar's moment (DECISIONS, "The Marble Jar"): the marble wheel and the class jar over
 * the board. A goal filled opens it with a spin waiting; the wheel lands on a wedge (only that one
 * turns over), its marbles pour in and settle where real marbles would, and the jar is kept as
 * they came to rest. A jar filled to its line opens the prize wheel. A tap on the meter's jar opens
 * it just to look. Loaded as its own chunk, with the physics, only when a class has the Marble Jar.
 * Every step waits for a tap; nothing ends on a clock.
 */

export type MarbleMode = 'spin' | 'look' | 'empty'

type Step = 'ready' | 'picking' | 'spinning' | 'pouring' | 'settled' | 'full'

const GUARD_MS = 700
const SPIN_MS = 5600
const ease = (t: number) => 1 - Math.pow(1 - t, 3.4)
const unease = (p: number) => 1 - Math.pow(1 - p, 1 / 3.4)
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export default function MarbleMoment({
  mode: openedAs,
  jar,
  popFrom,
  pickSpinner,
  spinnerNames,
  onSpun,
  onOpenPrize,
  onClose,
}: {
  mode: MarbleMode
  jar: MarbleJarState
  /** Emptying after the prize: the marbles that were in the full jar, to pop away. */
  popFrom?: SavedMarble[]
  pickSpinner: () => string | null
  spinnerNames: string[]
  /** A spin spun and its marbles settled: keep them, and spend the spin. */
  onSpun: (marbles: SavedMarble[]) => void
  /** The jar is full, and the teacher taps for the prize wheel; the jar's picture goes with it. */
  onOpenPrize: (jarPicture: string | null) => void
  onClose: () => void
}) {
  // What it opened as, kept: a jar filling to its line on this spin mustn't take the wheel away under the class.
  const [mode] = useState(openedAs)
  const marblesRef = useRef<HTMLDivElement>(null)
  const boltsRef = useRef<SVGSVGElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)
  const jarRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<MarbleJarWorld | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const [wheelHtml] = useState(() => ({ __html: marbleWheelSVG() }))
  const [pointerHtml] = useState(() => ({ __html: pointerSVG() }))
  const [spinsLeft, setSpinsLeft] = useState(mode === 'spin' ? Math.max(1, jar.spins) : 0)
  const [spun, setSpun] = useState(false)
  const [step, setStep] = useState<Step>(() => (mode === 'spin' ? 'ready' : jarIsFull(jar) ? 'full' : 'settled'))
  const [title, setTitle] = useState(() =>
    mode === 'spin' ? 'Spin for marbles!' : mode === 'empty' ? 'A new jar!' : jarIsFull(jar) ? 'Our jar is full!' : 'Our jar',
  )
  const [titleKey, setTitleKey] = useState(0)
  const [spinner, setSpinner] = useState<{ name: string; landed: boolean } | null>(null)
  const shownAt = useRef(performance.now())
  const angle = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))
  const afterSettle = useRef<(() => void) | null>(null)
  const running = useRef(false)
  const wakeRef = useRef<() => void>(() => {})
  const spunRef = useRef(onSpun)
  useEffect(() => {
    spunRef.current = onSpun
  })

  const say = (t: string) => {
    setTitle(t)
    setTitleKey((k) => k + 1)
  }

  // The world, from the jar as it was kept (or, emptying, as it was full), and the loop that runs it while anything moves.
  useEffect(() => {
    primeMarbles()
    const world = new MarbleJarWorld(popFrom ?? jar.marbles, {
      clink: playMarbleClink,
      thud: playMegaThud,
      zap: playMarbleZap,
      grow: playMarbleGrow,
      pop: playMarblePop,
      shake: () =>
        jarRef.current?.animate(
          [0, -0.6, 0.5, -0.4, 0.3, 0].map((d) => ({ transform: `translateX(${d}%)` })),
          { duration: 260 },
        ),
    })
    worldRef.current = world
    const layer = new MarbleLayer(marblesRef.current!, boltsRef.current!)
    const box = jarRef.current!
    const fit = () => {
      const rect = box.getBoundingClientRect()
      // The glass behind and in front: drawn once for this size, never again while the marbles move.
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(10, Math.round(rect.width * dpr))
      const h = Math.max(10, Math.round(rect.height * dpr))
      const scale = w / JAR.W
      for (const [c, fn] of [
        [backRef.current, drawJarBack],
        [frontRef.current, drawJarFront],
      ] as const) {
        if (!c) continue
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) continue
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        fn(ctx)
      }
      layer.resize(rect.width)
      draw(performance.now())
    }
    const draw = (now: number) => {
      const { marbles, bolts } = world.snapshot()
      layer.update(marbles, bolts, now)
    }
    let last = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const moving = world.update(now, (now - last) / 1000)
      last = now
      draw(now)
      if (moving) raf = requestAnimationFrame(frame)
      else {
        running.current = false
        const cb = afterSettle.current
        afterSettle.current = null
        cb?.()
      }
    }
    const wake = () => {
      if (running.current) return
      running.current = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    wakeRef.current = wake
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    if (mode === 'empty') {
      later(() => {
        world.popAll()
        afterSettle.current = () => setStep('settled')
        wake()
      }, 500)
    }
    const pending = timers.current
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      running.current = false
      pending.forEach(clearTimeout)
    }
    // The world is built once, from the jar as the moment opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wake = () => wakeRef.current()

  function resetFaces() {
    const w = wheelRef.current
    if (!w) return
    w.querySelectorAll('[data-slice]').forEach((s) => s.classList.remove('quest-slice-dim'))
    w.querySelectorAll<SVGGElement>('[data-face]').forEach((f) => {
      f.getAnimations().forEach((a) => a.cancel())
      f.style.opacity = ''
    })
    w.querySelectorAll('[data-reveal]').forEach((f) => f.setAttribute('opacity', '0'))
  }

  function pick() {
    if (step !== 'ready' || performance.now() - shownAt.current < GUARD_MS) return
    const winner = pickSpinner()
    if (!winner) return
    setStep('picking')
    const steps = reduceMotion() ? 4 : 24
    let at = 0
    for (let s = 0; s < steps; s++) {
      at += 90 + Math.max(0, s - 14) * 18
      const lastOne = s === steps - 1
      later(() => {
        if (lastOne) {
          setSpinner({ name: winner, landed: true })
          playPickerLand()
          later(() => setStep('ready'), 300)
        } else {
          setSpinner({ name: spinnerNames[Math.floor(Math.random() * spinnerNames.length)] ?? winner, landed: false })
          playPickerTick()
        }
      }, at)
    }
  }

  function spin() {
    if (step !== 'ready' || performance.now() - shownAt.current < GUARD_MS) return
    setStep('spinning')
    resetFaces()
    say('Spinning...')
    const { wedge, at } = spinLanding()
    const start = angle.current
    const target = start - (start % 360) + 360 * 6 + (360 - at)
    const dur = reduceMotion() ? 1500 : SPIN_MS
    const frames = Array.from({ length: 61 }, (_, i) => ({
      transform: `rotate(${start + (target - start) * ease(i / 60)}deg)`,
      offset: i / 60,
    }))
    const wheel = wheelRef.current
    const anim = wheel?.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' })
    // A pop each time the pointer passes a peg, timed from the curve itself.
    for (let peg = Math.ceil((start + 11.25) / 22.5) * 22.5 - 11.25; peg <= target; peg += 22.5) {
      const t = unease((peg - start) / (target - start)) * dur
      later(() => {
        playPickerTick()
        pointerRef.current?.animate([{ transform: 'rotate(-24deg)' }, { transform: 'rotate(0)' }], { duration: 140, easing: 'ease-out' })
      }, t)
    }
    const land = () => {
      angle.current = target
      if (wheel) {
        wheel.style.transform = `rotate(${target}deg)`
        anim?.cancel()
      }
      landed(wedge)
    }
    if (anim) anim.onfinish = land
    else later(land, dur)
  }

  function landed(i: number) {
    playPickerLand()
    const w = wheelRef.current
    w?.querySelectorAll('[data-slice]').forEach((s) => s.classList.toggle('quest-slice-dim', s.getAttribute('data-slice') !== String(i)))
    // Only the wedge it lands on turns over.
    const q = w?.querySelector<SVGGElement>(`[data-face="${i}"]`)
    const r = w?.querySelector(`[data-reveal="${i}"]`)
    q?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' })
    r?.setAttribute('opacity', '1')
    r?.querySelector('[data-pop]')?.animate(
      [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
      { duration: 420, delay: 120, easing: 'ease-out', fill: 'backwards' },
    )
    const id = WEDGES[i].id
    say(WEDGE_WORDS[id])
    later(() => {
      setStep('pouring')
      worldRef.current?.pour(marblesFor(id))
      afterSettle.current = poured
      wake()
    }, 700)
  }

  function poured() {
    const world = worldRef.current
    if (!world) return
    const marbles = world.saved()
    spunRef.current(marbles)
    const left = spinsLeft - 1
    setSpinsLeft(left)
    setSpun(true)
    setSpinner(null)
    shownAt.current = performance.now()
    if (jarIsFull({ ...jar, marbles })) {
      playJarFull()
      say('Our jar is full!')
      setStep('full')
    } else if (left > 0) {
      say(left === 1 ? 'One more spin!' : `${left} more spins!`)
      setStep('ready')
    } else {
      say('Into the jar!')
      setStep('settled')
    }
  }

  function prize() {
    if (step !== 'full' || performance.now() - shownAt.current < GUARD_MS) return
    let picture: string | null = null
    try {
      picture = jarPicture(
        worldRef.current?.saved() ?? jar.marbles,
        Math.min(900, (jarRef.current?.getBoundingClientRect().width ?? 400) * Math.min(2, window.devicePixelRatio || 1)),
      )
    } catch {
      picture = null
    }
    onOpenPrize(picture)
  }

  function done() {
    if (performance.now() - shownAt.current < GUARD_MS) return
    onClose()
  }

  const wheelShown = mode === 'spin'
  const busy = step === 'picking' || step === 'spinning' || step === 'pouring'
  return createPortal(
    <div
      data-marble-moment={mode}
      className="fixed inset-0 z-[60] grid grid-cols-2 items-center gap-3 bg-[rgba(14,22,44,0.95)] px-[max(18px,2vw)] py-3"
    >
      {!busy && (
        <button
          type="button"
          aria-label={step === 'ready' && mode === 'spin' ? 'Not now' : 'Close'}
          title={step === 'ready' && mode === 'spin' ? 'Not now' : 'Close'}
          className="absolute right-[max(1.5vw,12px)] top-[max(1.5vh,12px)] z-[4] grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white active:scale-90"
          onClick={onClose}
        >
          <X className="h-7 w-7" />
        </button>
      )}
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-[min(2.4vh,16px)]">
        {spinner && (
          <div
            data-quest-spinner=""
            className={`whitespace-nowrap rounded-full border-[3px] px-[0.9em] py-[0.1em] font-bold text-white ${spinner.landed ? 'border-amber-400 bg-amber-400/20' : 'border-transparent bg-white/10'}`}
            style={{ fontSize: 'clamp(1.1rem, 4vmin, 2.2rem)' }}
          >
            {spinner.landed ? `${spinner.name}, spin!` : spinner.name}
          </div>
        )}
        <div
          key={titleKey}
          data-marble-title=""
          className="marble-title text-balance text-center font-bold leading-tight text-white"
          style={{ fontSize: 'clamp(1.4rem, 5.5vmin, 3rem)' }}
        >
          {title}
        </div>
        {wheelShown && (
          // The wheel takes no taps: turned, its square's corners reach over the buttons under it, and a tap on Done landed on the wheel.
          <div data-marble-wheel="" className="pointer-events-none relative aspect-square w-[min(54vh,40vw)] max-w-full">
            <div
              ref={pointerRef}
              className="absolute left-1/2 top-[-3.5%] z-[2] -ml-[5.5%] w-[11%] origin-[50%_20%] drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]"
              dangerouslySetInnerHTML={pointerHtml}
            />
            <div
              ref={wheelRef}
              className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:overflow-visible"
              dangerouslySetInnerHTML={wheelHtml}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-[clamp(10px,2vw,28px)]">
          {wheelShown && (step === 'ready' || step === 'picking') && !spinner?.landed && (
            <button type="button" className="quest-stage-btn" disabled={step !== 'ready' || spinnerNames.length === 0} onClick={pick}>
              Pick a Spinner
            </button>
          )}
          {wheelShown && (step === 'ready' || step === 'picking') && (
            <button type="button" className="quest-stage-btn quest-spin" disabled={step !== 'ready'} onClick={spin}>
              Spin!
            </button>
          )}
          {step === 'full' && (
            <button type="button" className="quest-stage-btn quest-spin" onClick={prize}>
              Prize wheel!
            </button>
          )}
          {step === 'settled' && (
            <button type="button" className="quest-stage-btn" onClick={done}>
              Done
            </button>
          )}
          {/* A way out after every spin, in words beside the next thing to tap: spins still waiting, or the prize, are kept for later. */}
          {((step === 'ready' && spun) || step === 'full') && (
            <button type="button" className="quest-stage-btn" onClick={done}>
              Later
            </button>
          )}
        </div>
      </div>
      <div className="relative grid h-full min-h-0 place-items-center">
        {/* The glass behind, drawn once; the marbles, each a picture the graphics chip moves; the lightning; the glass in front, drawn once. */}
        <div ref={jarRef} className="relative h-full max-h-full max-w-full" style={{ aspectRatio: `${JAR.W} / ${JAR.H}` }}>
          <canvas ref={backRef} className="absolute inset-0 h-full w-full" aria-hidden />
          <div ref={marblesRef} data-marble-jar="" aria-label="Our marble jar" className="absolute inset-0 overflow-hidden" />
          <svg
            ref={boltsRef}
            viewBox={`0 0 ${JAR.W} ${JAR.H}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          />
          <canvas ref={frontRef} className="absolute inset-0 h-full w-full" aria-hidden />
        </div>
      </div>
    </div>,
    document.body,
  )
}
