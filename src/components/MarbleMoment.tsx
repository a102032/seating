import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SpinnerName, type SpinnerPick } from './SpinnerName'
import { burst, firework } from '../lib/burst'
import { marbleSVG, marbleWheelSVG, wedgePicture } from '../lib/marbleArt'
import { jarPicture } from '../lib/marbleDesigns'
import { MarbleScene } from '../lib/marbleScene'
import {
  JAR,
  MARBLE_COLOURS,
  MEGA_COLOUR,
  MEGA_MEGA_CHANCE,
  POWER_COLOUR,
  RADIUS,
  WEDGE_WORDS,
  jarIsFull,
  spinLanding,
  type MarbleJarState,
  type MarbleKind,
  type SavedMarble,
  type Season,
  type Wedge,
  type WedgeId,
} from '../lib/marbles'
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
  playFireworkPop,
  playSpinWin,
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

/** The marbles a wedge flies across into the jar: 5 plain ones, or the Power or Mega Marble. The others come by their own way (the cloud, the witch). */
function flownFor(id: WedgeId): MarbleKind[] {
  if (id === 'power') return ['power']
  if (id === 'mega') return ['mega']
  if (id === '5') return Array(5).fill('plain')
  return []
}

/** The marbles a wedge won, small, beside the banner's words; or its picture. */
function winMarbles(id: WedgeId): string {
  const pic = wedgePicture(id)
  if (pic && id !== 'power') return `<img src="${pic}" alt="" style="width:1.3em;height:1.3em">`
  const kinds = flownFor(id)
  return kinds
    .map((kind, n) => {
      const colour = kind === 'power' ? POWER_COLOUR : kind === 'mega' ? MEGA_COLOUR : MARBLE_COLOURS[(n * 3) % MARBLE_COLOURS.length]
      const size = kind === 'mega' ? 1.2 : kind === 'power' ? 1 : 0.75
      return `<svg viewBox="-11 -11 22 22" style="width:${size}em;height:${size}em">${marbleSVG(colour, { r: 10, bolt: kind === 'power', swirl: kind === 'mega' })}</svg>`
    })
    .join('')
}

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
  wedges,
  season,
  popFrom,
  pickSpinner,
  spinnerNames,
  onSpun,
  onOpenPrize,
  onClose,
}: {
  mode: MarbleMode
  jar: MarbleJarState
  /** This class's wheel: its special wedges switched on, and the season's own (lib/marbles, wedgesFor). */
  wedges: Wedge[]
  season: Season
  /** Emptying after the prize: the marbles that were in the full jar, to pop away. */
  popFrom?: SavedMarble[]
  pickSpinner: (different?: boolean) => SpinnerPick | null
  spinnerNames: SpinnerPick[]
  /** A spin spun and its marbles settled: keep them, and spend the spin. */
  onSpun: (marbles: SavedMarble[]) => void
  /** The jar is full, and the teacher taps for the prize wheel; the jar's picture goes with it. */
  onOpenPrize: (jarPicture: string | null) => void
  onClose: () => void
}) {
  // What it opened as, kept: a jar filling to its line on this spin mustn't take the wheel away under the class.
  const [mode] = useState(openedAs)
  const canvasRef = useRef<HTMLDivElement>(null)
  const jarRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<MarbleScene | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const [wheelHtml] = useState(() => ({ __html: marbleWheelSVG(wedges) }))
  /** The Mega Mega Marble's big words, and the board dimmed for it. */
  const [huge, setHuge] = useState<string | null>(null)
  const [dimmed, setDimmed] = useState(false)
  const [pointerHtml] = useState(() => ({ __html: pointerSVG() }))
  const [spinsLeft, setSpinsLeft] = useState(mode === 'spin' ? Math.max(1, jar.spins) : 0)
  const [spun, setSpun] = useState(false)
  /** What the wheel last landed on, shown as a banner until the next spin. */
  const [win, setWin] = useState<WedgeId | null>(null)
  const wheelBoxRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>(() => (mode === 'spin' ? 'ready' : jarIsFull(jar) ? 'full' : 'settled'))
  const [title, setTitle] = useState(() =>
    mode === 'spin' ? 'Spin for marbles!' : mode === 'empty' ? 'A new jar!' : jarIsFull(jar) ? 'Our jar is full!' : 'Our jar',
  )
  const [titleKey, setTitleKey] = useState(0)
  const [spinner, setSpinner] = useState<{ who: SpinnerPick; landed: boolean } | null>(null)
  const shownAt = useRef(performance.now())
  const angle = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))
  const [megaMega, setMegaMega] = useState(false)
  const spunRef = useRef(onSpun)
  useEffect(() => {
    spunRef.current = onSpun
  })

  const say = (t: string) => {
    setTitle(t)
    setTitleKey((k) => k + 1)
  }

  // The jar's side, from the jar as it was kept (or, emptying, as it was full): it runs itself while anything moves.
  useEffect(() => {
    primeMarbles()
    const canvas = canvasRef.current!
    const world = new MarbleScene(canvas, popFrom ?? jar.marbles, season, {
      clink: playMarbleClink,
      thud: playMegaThud,
      zap: playMarbleZap,
      grow: playMarbleGrow,
      pop: playMarblePop,
      shake: () =>
        canvas.animate(
          [0, -0.6, 0.5, -0.4, 0.3, 0].map((d) => ({ transform: `translateX(${d}%)` })),
          { duration: 260 },
        ),
      say: (text, kind) => {
        if (kind === 'huge') {
          setHuge(text)
          setWin('mega')
          setMegaMega(true)
        } else {
          setWin(null)
          say(text)
        }
      },
      dim: setDimmed,
    })
    worldRef.current = world
    const box = jarRef.current!
    const fit = () => world.layout(box.getBoundingClientRect())
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    window.addEventListener('resize', fit)
    if (mode === 'empty') later(() => world.popAll(() => setStep('settled')), 500)
    const pending = timers.current
    return () => {
      world.destroy()
      ro.disconnect()
      window.removeEventListener('resize', fit)
      pending.forEach(clearTimeout)
    }
    // The world is built once, from the jar as the moment opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetFaces() {
    const w = wheelRef.current
    if (!w) return
    w.querySelectorAll('[data-slice]').forEach((s) => s.classList.remove('quest-slice-dim'))
    w.querySelectorAll<SVGGElement>('[data-pop]').forEach((f) => f.getAnimations().forEach((a) => a.cancel()))
  }

  /** Pick a Spinner; once a name has landed, "Pick a different student" until the wheel is spun. */
  function pick() {
    if (step !== 'ready' || performance.now() - shownAt.current < GUARD_MS) return
    const winner = pickSpinner(Boolean(spinner?.landed))
    if (!winner) return
    setStep('picking')
    const steps = reduceMotion() ? 4 : 24
    let at = 0
    for (let s = 0; s < steps; s++) {
      at += 90 + Math.max(0, s - 14) * 18
      const lastOne = s === steps - 1
      later(() => {
        if (lastOne) {
          setSpinner({ who: winner, landed: true })
          playPickerLand()
          later(() => setStep('ready'), 300)
        } else {
          setSpinner({ who: spinnerNames[Math.floor(Math.random() * spinnerNames.length)] ?? winner, landed: false })
          playPickerTick()
        }
      }, at)
    }
  }

  function spin() {
    if (step !== 'ready' || performance.now() - shownAt.current < GUARD_MS) return
    setStep('spinning')
    resetFaces()
    setWin(null)
    setMegaMega(false)
    say('Spinning...')
    const { wedge, at } = spinLanding(Math.random, wedges)
    // About one Mega in four grows into a Mega Mega Marble; decided now, with the landing.
    const grows = wedges[wedge].id === 'mega' && Math.random() < MEGA_MEGA_CHANCE
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
      landed(wedge, grows)
    }
    if (anim) anim.onfinish = land
    else later(land, dur)
  }

  function landed(i: number, grows: boolean) {
    playPickerLand()
    const w = wheelRef.current
    w?.querySelectorAll('[data-slice]').forEach((s) => s.classList.toggle('quest-slice-dim', s.getAttribute('data-slice') !== String(i)))
    const face = w?.querySelector(`[data-face="${i}"] [data-pop]`) ?? null
    face?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1.15)' }], {
      duration: 460,
      easing: 'ease-out',
      fill: 'forwards',
    })
    const id = wedges[i].id
    const kind = id === 'power' || id === 'mega' ? id : 'plain'
    say(WEDGE_WORDS[id])
    setWin(id)
    celebrate(kind)
    const pour = () => {
      setStep('pouring')
      worldRef.current?.play(id, grows, poured)
    }
    // The marbles leap from the wedge across into the jar's mouth, then pour in; the cloud, the popcorn and the season's wedge come their own way.
    const flown = grows ? [] : flownFor(id)
    later(() => (flown.length ? flyToJar(face, flown, pour) : pour()), kind === 'mega' ? 1500 : 900)
  }

  /**
   * The wheel's landing, scaled to how rare it is (2026-10-24, the teacher: it landed flat). Confetti
   * from the wheel for 2, 3 or 4 marbles; gold stars for the Power Marble; fireworks over the wheel
   * and a shake for the Mega. All short of the full jar's prize, which keeps the fanfare and the GIF.
   */
  function celebrate(kind: 'plain' | 'power' | 'mega') {
    playSpinWin(kind)
    const box = wheelBoxRef.current?.getBoundingClientRect()
    if (!box) return
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    wheelBoxRef.current?.animate(
      kind === 'mega'
        ? [0, -1.5, 1.5, -1, 1, 0].map((d, n) => ({ transform: `scale(${n === 0 || n === 5 ? 1 : 1.06}) rotate(${d}deg)` }))
        : [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
      { duration: kind === 'mega' ? 600 : 420, easing: 'ease-out' },
    )
    if (kind === 'plain') return burst(cx, cy, 70, false, 1)
    if (kind === 'power') {
      playMarbleZap()
      return burst(cx, cy, 60, true, 1.1, true)
    }
    burst(cx, cy, 50, false, 1.2)
    const spots: [number, number, string][] = [
      [box.left + box.width * 0.15, box.top + box.height * 0.05, '#f472b6'],
      [box.left + box.width * 0.85, box.top + box.height * 0.1, '#38bdf8'],
      [cx, Math.max(60, box.top - box.height * 0.05), '#fbbf24'],
    ]
    spots.forEach(([tx, ty, colour], n) => later(() => firework(cx, cy, tx, ty, colour, playFireworkPop), 250 + n * 320))
    later(() => burst(cx, cy, 28, true, 1.3, true), 1150)
  }

  /** Copies of the marbles won, flown from the wedge to the jar's mouth, where the world drops them in. */
  function flyToJar(from: Element | null, kinds: MarbleKind[], then: () => void) {
    const mouth = worldRef.current?.toScreen(JAR.CX, JAR.MOUTH - 3.5)
    const start = from?.getBoundingClientRect()
    if (!mouth || !start || reduceMotion()) return then()
    const scale = mouth.unit
    const tx = mouth.x
    const ty = mouth.y
    const sx = start.left + start.width / 2
    const sy = start.top + start.height / 2
    let left = kinds.length
    kinds.forEach((kind, n) => {
      const r = RADIUS[kind] * scale
      const el = document.createElement('div')
      el.className = 'pointer-events-none fixed z-[61]'
      el.style.cssText += `left:${sx - r}px;top:${sy - r}px;width:${r * 2}px;height:${r * 2}px`
      const colour = kind === 'power' ? POWER_COLOUR : kind === 'mega' ? MEGA_COLOUR : MARBLE_COLOURS[n % MARBLE_COLOURS.length]
      el.innerHTML = `<svg viewBox="-11 -11 22 22" width="100%" height="100%">${marbleSVG(colour, { r: 10, bolt: kind === 'power', swirl: kind === 'mega' })}</svg>`
      document.body.append(el)
      const dx = tx - sx
      const dy = ty - sy
      el.animate(
        [
          { transform: 'translate(0,0) scale(.6)' },
          { transform: `translate(${dx * 0.5}px, ${Math.min(dy, 0) - 90}px) scale(1.15)`, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(1)` },
        ],
        { duration: 620, delay: n * 110, easing: 'ease-in-out', fill: 'both' },
      ).onfinish = () => {
        el.remove()
        if (--left === 0) then()
      }
    })
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
      // The full jar takes the title from what was won: it is the bigger news.
      setWin(null)
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
        Math.min(900, (worldRef.current?.toScreen(0, 0).unit ?? 15) * JAR.W * Math.min(2, window.devicePixelRatio || 1)),
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
      className="fixed inset-0 z-[60] grid grid-cols-2 items-center gap-3 bg-[rgb(14,22,44)] px-[max(18px,2vw)] py-3"
    >
      {/* The jar's side: the sky, the shelf right across the board, the jar and everything round it, on one canvas behind. */}
      <div ref={canvasRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
      {huge && (
        <div key={huge} className="marble-huge" data-marble-huge="">
          {huge}
        </div>
      )}
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
      <div
        className="relative flex h-full min-h-0 flex-col items-center justify-center gap-[min(2.4vh,16px)] transition-opacity duration-500"
        style={{ opacity: dimmed ? 0.28 : 1 }}
      >
        {spinner && (
          <div
            data-quest-spinner=""
            className={`whitespace-nowrap rounded-full border-[3px] px-[0.9em] py-[0.1em] font-bold text-white ${spinner.landed ? 'border-amber-400 bg-amber-400/20' : 'border-transparent bg-white/10'}`}
            style={{ fontSize: 'clamp(1.1rem, 4vmin, 2.2rem)' }}
          >
            <SpinnerName who={spinner.who} spin={spinner.landed} />
          </div>
        )}
        <div
          key={titleKey}
          data-marble-title=""
          data-marble-win={win ?? undefined}
          className={
            win
              ? `marble-title marble-win flex items-center gap-[0.35em] whitespace-nowrap rounded-full px-[0.7em] py-[0.1em] font-bold leading-tight ${win === 'power' || win === 'mega' ? 'bg-amber-300 text-amber-950' : 'bg-white text-violet-900'}`
              : 'marble-title text-balance text-center font-bold leading-tight text-white'
          }
          style={{ fontSize: win ? 'clamp(1.6rem, 6.5vmin, 3.4rem)' : 'clamp(1.4rem, 5.5vmin, 3rem)' }}
        >
          {win && <span className="flex gap-[0.08em]" aria-hidden dangerouslySetInnerHTML={{ __html: winMarbles(win) }} />}
          {win === 'mega'
            ? megaMega
              ? 'MEGA MEGA MARBLE!'
              : 'MEGA MARBLE!'
            : win === 'power'
              ? 'POWER MARBLE!'
              : win
                ? WEDGE_WORDS[win]
                : title}
        </div>
        {wheelShown && (
          // The wheel takes no taps: turned, its square's corners reach over the buttons under it, and a tap on Done landed on the wheel.
          <div ref={wheelBoxRef} data-marble-wheel="" className="pointer-events-none relative aspect-square w-[min(54vh,40vw)] max-w-full">
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
          {wheelShown && (step === 'ready' || step === 'picking') && (
            <button
              type="button"
              className="quest-stage-btn"
              disabled={step !== 'ready' || spinnerNames.length === 0 || (spinner?.landed === true && spinnerNames.length < 2)}
              onClick={pick}
            >
              {spinner?.landed ? 'Pick a different student' : 'Pick a Spinner'}
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
      {/* Where the jar stands on the canvas behind: the right half of the board. */}
      <div ref={jarRef} data-marble-jar="" aria-label="Our marble jar" role="img" className="h-full min-h-0 w-full" />
    </div>,
    document.body,
  )
}
