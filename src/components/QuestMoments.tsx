import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildWheel, CHESTS, MEGA, type QuestPrize, type Slice } from '../lib/quest'
import { chestSVG, keySVG, pointerSVG, prizeIconSVG, sliceFaceSVG, wheelSVG } from '../lib/questArt'
import { playChestBurst, playChestKnocks, playGoalCelebration, playKeyJingle, playPickerLand, playPickerTick } from '../lib/sound'
import { burst } from '../lib/burst'
import { GoalCelebration } from './GoalCelebration'

/**
 * The Quest's two moments (DECISIONS, "Treasure Quest"). Everything that moves is element.animate
 * or CSS, which the board's graphics chip runs ("Smooth on the board"), and every step waits for a
 * tap: nothing here ends on a clock.
 */

/** The board reads one touch as two: a moment that has just appeared ignores taps this long. */
const GUARD_MS = 700
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** The meter's chest, where a key flies and where the chest flies from. */
function questChestRect(): DOMRect | null {
  return document.querySelector('[data-quest-chest]')?.getBoundingClientRect() ?? null
}

/**
 * A goal filled on a quest: a big key comes to the middle of the board over a light dim, "You got
 * a key!" with a short jingle, and it waits for a tap a student can make ("Who wants to put the key
 * in?"). Then it flies into the chest at the meter's end, and onLanded clicks one lock gold.
 */
export function KeyMoment({ keys, onLanded }: { keys: number; onLanded: () => void }) {
  const keyRef = useRef<HTMLDivElement>(null)
  const shownAt = useRef(Infinity)
  const [flying, setFlying] = useState(false)
  const landed = useRef(onLanded)
  useEffect(() => {
    landed.current = onLanded
  })

  useEffect(() => {
    shownAt.current = performance.now()
    playKeyJingle()
    const el = keyRef.current
    if (el && !reduceMotion()) {
      el.animate(
        [
          { transform: 'scale(.2) rotate(-40deg)', opacity: 0 },
          { transform: 'scale(1.12) rotate(6deg)', opacity: 1, offset: 0.7 },
          { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        ],
        { duration: 650, easing: 'cubic-bezier(.3,1.25,.5,1)' },
      )
    }
  }, [])

  function tap() {
    if (flying || performance.now() - shownAt.current < GUARD_MS) return
    setFlying(true)
    const el = keyRef.current
    const to = questChestRect()
    if (!el || !to) return landed.current()
    const from = el.getBoundingClientRect()
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const k = Math.max(0.08, (to.width * 0.5) / from.width)
    el.classList.remove('quest-key-bob')
    el.animate(
      [
        { transform: 'translate(0,0) scale(1) rotate(0deg)' },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 + 60}px) scale(1.15) rotate(-20deg)`, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(0deg)` },
      ],
      { duration: reduceMotion() ? 250 : 900, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' },
    ).onfinish = () => landed.current()
  }

  return createPortal(
    <div data-quest-moment="key" className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[3vh]" onPointerDown={tap}>
      <div className={`absolute inset-0 bg-black/35 transition-opacity duration-500 ${flying ? 'opacity-0' : 'opacity-100'}`} />
      <div ref={keyRef} className="quest-key-bob relative w-[min(46vmin,30rem)] drop-shadow-[0_10px_18px_rgba(180,83,9,0.45)]">
        <div className="aspect-[2/1] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: keySVG() }} />
        {keys > 1 && (
          <span className="absolute -right-[4%] -top-[14%] grid h-[28%] aspect-square place-items-center rounded-full bg-white text-[min(7vmin,3.5rem)] font-bold text-amber-700 shadow-lg">
            {keys}
          </span>
        )}
      </div>
      <div
        className={`relative rounded-full bg-white px-[1.2em] py-[0.35em] text-center font-bold text-amber-900 shadow-xl transition-opacity duration-300 ${flying ? 'opacity-0' : 'opacity-100'}`}
        style={{ fontSize: 'clamp(1.6rem, 7vmin, 4.2rem)' }}
      >
        {keys > 1 ? `You got ${keys} keys!` : 'You got a key!'}
      </div>
    </div>,
    document.body,
  )
}

type Step = 'arriving' | 'wheel' | 'picking' | 'spinning' | 'landed' | 'prize'

/** The wheel's turn: about six seconds, crawling through the last two so the class can cheer it on. */
const SPIN_MS = 6000
/** Ease-out cubic: in the last third of the time it covers about 4% of the way, a slice or two. */
const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const unease = (p: number) => 1 - Math.pow(1 - p, 1 / 3)

/**
 * A chest with all its keys, opened on the teacher's tap: the big moment. The board fades, the
 * chest flies to the middle and strains at its locks, bursts open and a wheel rises out of it.
 * Pick a Spinner chooses a student (or the teacher taps Spin); a tap spins it; only the slice it
 * lands on turns over, then the prize fills the screen with the class's celebration GIF beside it
 * (2026-10-24, the teacher), until tapped.
 */
export function ChestOpening({
  chest,
  jarPicture,
  fromRect,
  prizes,
  gifUrl,
  pickSpinner,
  spinnerNames,
  onDone,
  onNotNow,
}: {
  chest: number
  /**
   * The Marble Jar's full jar, as a picture: it flies in and bursts as a chest does, and the prize
   * wheel (the Gold chest's) rises out of it. Empty when the picture couldn't be taken; the chest is drawn then.
   */
  jarPicture?: string
  /** Where the chest flies in from, when not the meter's: the Pirate Quest's, dug up on the map. */
  fromRect?: DOMRect
  prizes: QuestPrize[]
  /** The class's celebration GIF, loaded; null shows the prize alone. */
  gifUrl: string | null
  /** Picks the student who spins (and counts it as their turn). Null when nobody is here. */
  pickSpinner: () => string | null
  /** The names a pick flickers through. */
  spinnerNames: string[]
  /** The prize is won: the chest goes on the map and the class walks on. */
  onDone: (prize: QuestPrize) => void
  /** Put back before the wheel has spun: the chest waits, full, for later. */
  onNotNow: () => void
}) {
  const [step, setStep] = useState<Step>('arriving')
  const [slices] = useState<Slice[]>(() => buildWheel(chest, prizes))
  // Drawn once: a redraw would put back every question mark the landed slice turned over.
  // (React sets innerHTML again whenever the {__html} object is new, so each is kept, not remade.)
  const [wheelHtml] = useState(() => ({ __html: wheelSVG(chest, slices) }))
  const [pointerHtml] = useState(() => ({ __html: pointerSVG() }))
  const [open, setOpen] = useState(false)
  const [spinner, setSpinner] = useState<{ name: string; landed: boolean } | null>(null)
  const [won, setWon] = useState<Slice | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  const wheelWrapRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const dimRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const stopFanfare = useRef<(() => void) | null>(null)
  const prizeAt = useRef(0)
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      stopFanfare.current?.()
    },
    [],
  )

  // The chest flies in from the meter, strains at its locks, and bursts open; the wheel rises out of it.
  useEffect(() => {
    const el = chestRef.current
    const quick = reduceMotion()
    dimRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 })
    let cancelled = false
    ;(async () => {
      if (el) {
        const m = fromRect ?? questChestRect()
        const c = el.getBoundingClientRect()
        if (m && c.width) {
          await el.animate(
            [
              {
                transform: `translate(${m.left + m.width / 2 - (c.left + c.width / 2)}px, ${m.top + m.height / 2 - (c.top + c.height / 2)}px) scale(${m.width / c.width})`,
              },
              { transform: 'none' },
            ],
            { duration: quick ? 200 : 850, easing: 'cubic-bezier(.3,1.25,.5,1)' },
          ).finished
        }
        if (cancelled) return
        playChestKnocks()
        await el.animate(
          [0, -7, 6, -8, 7, -5, 4, 0].map((d, i) => ({ transform: `rotate(${d}deg) scale(${1 + i * 0.012})` })),
          { duration: quick ? 150 : 950 },
        ).finished
      }
      if (cancelled) return
      setOpen(true)
      playChestBurst(chest === MEGA)
      const r = el?.getBoundingClientRect()
      if (r && !quick) burst(r.left + r.width / 2, r.top + r.height * 0.35, chest === MEGA ? 140 : 80, chest >= 3)
      setStep('wheel')
      const w = wheelWrapRef.current
      w?.animate(
        [
          { transform: 'translateY(55%) scale(.1)', opacity: 0 },
          { transform: 'translateY(-4%) scale(1.04)', opacity: 1, offset: 0.75 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: quick ? 200 : 950, easing: 'cubic-bezier(.3,.9,.4,1)' },
      )
    })()
    return () => {
      cancelled = true
    }
  }, [chest])

  function pick() {
    if (step !== 'wheel') return
    const winner = pickSpinner()
    if (!winner) return
    setStep('picking')
    const steps = reduceMotion() ? 4 : 24
    let at = 0
    for (let s = 0; s < steps; s++) {
      at += 90 + Math.max(0, s - 14) * 18
      const last = s === steps - 1
      later(() => {
        if (last) {
          setSpinner({ name: winner, landed: true })
          playPickerLand()
          later(() => setStep('wheel'), 300)
        } else {
          setSpinner({ name: spinnerNames[Math.floor(Math.random() * spinnerNames.length)] ?? winner, landed: false })
          playPickerTick()
        }
      }, at)
    }
  }

  function spin() {
    if (step !== 'wheel') return
    setStep('spinning')
    const win = Math.floor(Math.random() * 8)
    const jitter = (Math.random() - 0.5) * 28
    const turns = 5 + Math.floor(Math.random() * 2)
    const base = (((-win * 45) % 360) + 360) % 360
    const target = turns * 360 + base + jitter
    const dur = reduceMotion() ? 1500 : SPIN_MS
    const frames = Array.from({ length: 61 }, (_, i) => ({ transform: `rotate(${target * ease(i / 60)}deg)`, offset: i / 60 }))
    const wheel = wheelRef.current
    const anim = wheel?.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' })
    // A pop each time the pointer passes a peg between slices, timed from the curve itself.
    for (let k = 1; 45 * k - 22.5 <= target; k++) {
      const t = unease((45 * k - 22.5) / target) * dur
      later(() => {
        playPickerTick()
        pointerRef.current?.animate([{ transform: 'rotate(-24deg)' }, { transform: 'rotate(0)' }], { duration: 140, easing: 'ease-out' })
      }, t)
    }
    const land = () => {
      if (wheel) {
        wheel.style.transform = `rotate(${target}deg)`
        anim?.cancel()
      }
      playPickerLand()
      setWon(slices[win])
      setStep('landed')
      const face = wheel?.querySelector(`[data-face="${win}"]`)
      wheel
        ?.querySelectorAll('[data-slice]')
        .forEach((g) => g.classList.toggle('quest-slice-dim', g.getAttribute('data-slice') !== String(win)))
      if (face) {
        face.innerHTML = sliceFaceSVG(slices[win], win)
        face.animate(
          [
            { opacity: 0, transform: 'scale(.6)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 350, easing: 'cubic-bezier(.34,1.56,.64,1)' },
        )
      }
      later(() => {
        setStep('prize')
        prizeAt.current = performance.now()
        stopFanfare.current = playGoalCelebration()
      }, 1100)
    }
    if (anim) anim.onfinish = land
    else later(land, dur)
  }

  function finish() {
    if (!won || performance.now() - prizeAt.current < GUARD_MS) return
    stopFanfare.current?.()
    stopFanfare.current = null
    onDone({ name: won.name, size: won.size })
  }

  const T = CHESTS[chest]
  const chestHtml = useMemo(() => ({ __html: chestSVG(chest, { open, keys: T.keys }) }), [chest, open, T.keys])
  const ready = step === 'wheel'
  return createPortal(
    <div data-quest-moment="chest" className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden">
      <div ref={dimRef} className="absolute inset-0 bg-[rgba(17,12,44,0.88)]" />
      {open && (
        <div className="quest-rays pointer-events-none absolute left-1/2 top-[46%] h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      )}

      {spinner && (
        <div
          data-quest-spinner=""
          className={`absolute left-1/2 top-[max(1.5vh,8px)] z-[3] -translate-x-1/2 whitespace-nowrap rounded-full border-[3px] px-[0.9em] py-[0.1em] font-bold text-white ${spinner.landed ? 'border-amber-400 bg-amber-400/20' : 'border-transparent bg-white/10'}`}
          style={{ fontSize: 'clamp(1.2rem, 5vmin, 2.8rem)' }}
        >
          {spinner.landed ? `${spinner.name}, spin!` : spinner.name}
        </div>
      )}

      {(step === 'arriving' || step === 'wheel') && !spinner?.landed && (
        <button
          type="button"
          aria-label="Not now"
          title="Not now"
          className="absolute right-[max(1.5vw,12px)] top-[max(1.5vh,12px)] z-[4] grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white active:scale-90"
          onClick={onNotNow}
        >
          <X className="h-7 w-7" />
        </button>
      )}

      {/* Behind the prize card the wheel and chest step aside: drawn under a full-screen card they cost the board frames for nothing. */}
      <div className={`relative flex flex-col items-center ${step === 'prize' ? 'invisible' : ''}`}>
        <div
          ref={wheelWrapRef}
          data-quest-wheel=""
          className={`relative z-[1] aspect-square w-[min(54vh,78vw)] ${step === 'arriving' ? 'opacity-0' : ''}`}
        >
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
        <div className="relative z-[2] -mt-[4vh] flex items-end justify-center gap-[clamp(12px,3vw,48px)]">
          <button
            type="button"
            className={`quest-stage-btn mb-[2vh] ${ready && !spinner?.landed ? '' : 'invisible'}`}
            disabled={!ready || spinnerNames.length === 0}
            onClick={pick}
          >
            Pick a Spinner
          </button>
          {jarPicture ? (
            <div ref={chestRef} className="w-[min(22vh,30vw)]">
              <img src={jarPicture} alt="" draggable={false} className="block h-auto w-full select-none" />
            </div>
          ) : (
            <div
              ref={chestRef}
              className="w-[min(26vh,34vw)] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:overflow-visible"
              dangerouslySetInnerHTML={chestHtml}
            />
          )}
          <button
            type="button"
            className={`quest-stage-btn quest-spin mb-[2vh] ${ready ? '' : 'invisible'}`}
            disabled={!ready}
            onClick={spin}
          >
            Spin!
          </button>
        </div>
      </div>

      {step === 'prize' && won && (
        <GoalCelebration origin={null} gifUrl={null} onDone={finish}>
          <PrizeCard prize={won} gifUrl={gifUrl} />
        </GoalCelebration>
      )}
    </div>,
    document.body,
  )
}

/** The prize, big: its picture, its name, and the class's GIF dancing beside it. */
function PrizeCard({ prize, gifUrl }: { prize: Slice; gifUrl: string | null }) {
  const tone = prize.slot === 'b' ? 'text-amber-600' : prize.slot === 'm' ? 'text-slate-600' : 'text-violet-600'
  return (
    <div data-quest-prize={prize.name} className="relative flex w-full items-center justify-center gap-[clamp(12px,3vw,32px)]">
      <div className="flex min-w-0 flex-col items-center gap-3">
        <span
          className={`grid aspect-square w-[clamp(80px,20vh,160px)] place-items-center rounded-full bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.6)] ${tone}`}
        >
          <span className="block w-[58%] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: prizeIconSVG(prize.name) }} />
        </span>
        <span
          className="text-balance text-center font-extrabold leading-[1.05] text-amber-950"
          style={{ fontSize: 'clamp(1.8rem, 7.5vmin, 4rem)' }}
        >
          {prize.name}!
        </span>
      </div>
      {gifUrl && (
        <img
          src={gifUrl}
          alt=""
          className="max-h-[40vh] w-auto max-w-[45%] rounded-2xl border-4 border-amber-100 object-contain shadow-lg"
        />
      )}
    </div>
  )
}
