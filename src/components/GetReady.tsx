import clsx from 'clsx'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type Ref } from 'react'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { assetUrl } from '../lib/assets'
import { playGetReadyGo, playGetReadyTimeUp, playTaikoHit, primeTaiko } from '../lib/sound'
import { GET_READY_DRUMS } from '../lib/getReady'
import { flyStarsFrom } from '../lib/starFlight'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

/** The star stays full this long after the tap on every drum, then shrinks on every beat. */
const FULL_SECONDS = 5
/** The board reads one touch as two: a tap that changes what is under the finger ignores the second. */
const TAP_GUARD_MS = 700
/** Ready! does nothing for this long after the star is tapped, so the tap that started it can't end it. */
const READY_AFTER_MS = 1000
/** A stick starts down this long before the second, so the hit lands on it. */
const SWING_MS = 110
const RAISED = 'rotate(-62deg)'
const ON_THE_DRUM = 'rotate(32deg)'
const STAR_PATH = 'M12 2.2l2.95 6.2 6.8.85-4.98 4.7 1.26 6.75L12 17.4l-6.03 3.3 1.26-6.75L2.25 9.25l6.8-.85z'

interface GetReadyProps {
  /** "How long?" is being asked, or the star is up. */
  open: boolean
  /** The drum used last time, outlined so the same job is the same tap. */
  lastDrum?: number
  /** What a full star is worth. */
  prize: number
  onChooseDrum: (seconds: number) => void
  /** Ready! was tapped with this many stars left: they are on their way to the jar. */
  onAward: (stars: number) => void
  /** The meter comes up above the faded board while the stars land in it. */
  onLiftMeter: (lifted: boolean) => void
  onClose: () => void
}

/**
 * Get Ready!: the teacher's handful of marbles, for the moment after an instruction ("Books out,
 * page 134, go"). "How long?" first - five drums, 10 to 30 seconds - then the board fades back
 * and one big star waits, still and silent, while the teacher explains. A tap on it starts a
 * taiko drum beating once a second, all the way to the end; the star stays full for five
 * seconds, then gets a little smaller on every beat until it is gone at the drum's end. Ready!
 * sends what is left into the jar. A full star is the same prize on every drum, so a faster
 * class keeps more of it, and a job moved to a shorter drum is harder without being worth less.
 */
export function GetReady({ open, lastDrum, prize, onChooseDrum, onAward, onLiftMeter, onClose }: GetReadyProps) {
  const [seconds, setSeconds] = useState<number | null>(null)
  // Each opening starts at "How long?".
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSeconds(null)
  }

  useEffect(() => {
    // The drum is fetched while the teacher chooses, so the first hit isn't a fallback knock.
    if (open) primeTaiko()
  }, [open])

  return (
    <>
      <HowLong
        open={open && seconds === null}
        lastDrum={lastDrum}
        onChoose={(n) => {
          onChooseDrum(n)
          setSeconds(n)
        }}
        onClose={onClose}
      />
      {open && seconds !== null && (
        <StarMoment seconds={seconds} prize={prize} onAward={onAward} onLiftMeter={onLiftMeter} onClose={onClose} />
      )}
    </>
  )
}

/**
 * Five drums in a row; a tap on one brings up the star. A tap outside closes it, but not in the
 * moment after it opens: the second touch of the tap on Get Ready! lands where Get Ready! was,
 * outside the window.
 */
function HowLong({
  open,
  lastDrum,
  onChoose,
  onClose,
}: {
  open: boolean
  lastDrum?: number
  onChoose: (seconds: number) => void
  onClose: () => void
}) {
  const openedAt = useRef(0)
  useEffect(() => {
    if (open) openedAt.current = performance.now()
  }, [open])
  const tooSoon = (e: Event) => {
    if (performance.now() - openedAt.current < TAP_GUARD_MS) e.preventDefault()
  }
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[min(54rem,calc(100vw-2rem))]" onPointerDownOutside={tooSoon} onInteractOutside={tooSoon}>
        <DialogHeader>
          <DialogTitle>How long?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex justify-center gap-[clamp(0.5rem,1.4vw,1rem)]">
            {GET_READY_DRUMS.map((n) => (
              <button
                key={n}
                type="button"
                data-drum={n}
                onClick={() => onChoose(n)}
                className={clsx(
                  'flex w-[clamp(6.5rem,13vw,9.5rem)] flex-col items-center gap-1 rounded-2xl border-[3px] px-2 pt-3 pb-2.5 transition-transform active:scale-95',
                  n === lastDrum ? 'border-primary bg-primary/15' : 'border-transparent bg-primary/5 dark:bg-white/10',
                )}
              >
                <img
                  src={assetUrl('/get-ready/taiko-drum.svg')}
                  alt=""
                  draggable={false}
                  className="mb-1 h-[clamp(4rem,12vh,6rem)] w-auto select-none"
                />
                <span className="font-bold leading-none text-foreground" style={{ fontSize: 'clamp(1.6rem, 4.6vh, 2.25rem)' }}>
                  {n}
                </span>
                <span className="text-sm font-bold text-muted-foreground">seconds</span>
              </button>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

/** Where everything sits, from the star's size `s`: the preview's 780px star on a 1280x800 board. */
interface Layout {
  s: number
  top: number
  meterBottom: number
}

function measure(): Layout {
  const meter = document.querySelector('[data-goal-coin]')?.closest('[data-ink="panel"]')
  const meterBottom = meter ? meter.getBoundingClientRect().bottom : 0
  // The star's tip sits just under the meter and "Tap the star to start" just above the bottom
  // edge; on a wide screen it is held to 70% of the width, so it never reaches the buttons.
  const s = Math.max(200, Math.min((innerHeight - meterBottom + 4) / 0.948, innerWidth * 0.7))
  return { s, top: meterBottom - 8 - 0.0917 * s, meterBottom }
}

type Ending = { words: string; earned?: number }

function StarMoment({
  seconds,
  prize,
  onAward,
  onLiftMeter,
  onClose,
}: {
  seconds: number
  prize: number
  onAward: (stars: number) => void
  onLiftMeter: (lifted: boolean) => void
  onClose: () => void
}) {
  const [layout, setLayout] = useState<Layout>(measure)
  const [shown, setShown] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [started, setStarted] = useState(false)
  const [readyLive, setReadyLive] = useState(false)
  /** What is left of the star, 1 to 0. */
  const [share, setShare] = useState(1)
  /** Ready! was tapped: the star has gone into the jar. */
  const [sent, setSent] = useState(false)
  const [ending, setEnding] = useState<Ending | null>(null)

  const run = useRef({ mountedAt: 0, startedAt: 0, beats: 0, over: false, left: prize, endingAt: 0 })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))
  const starRef = useRef<HTMLDivElement>(null)
  const pulseRef = useRef<HTMLDivElement>(null)
  const drumRef = useRef<HTMLDivElement>(null)
  const leftStick = useRef<HTMLDivElement>(null)
  const rightStick = useRef<HTMLDivElement>(null)
  const reduceMotion = useRef(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const onLift = useRef(onLiftMeter)
  useEffect(() => {
    onLift.current = onLiftMeter
  })

  useLayoutEffect(() => {
    run.current.mountedAt = performance.now()
    const fit = () => setLayout(measure())
    addEventListener('resize', fit)
    const frame = requestAnimationFrame(() => setShown(true))
    return () => {
      removeEventListener('resize', fit)
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      onLift.current(false)
    },
    [],
  )

  function close() {
    if (leaving) return
    timers.current.forEach(clearTimeout)
    run.current.over = true
    setLeaving(true)
    onLiftMeter(false)
    later(onClose, 450)
  }

  /** One beat: a stick swings down, and as it meets the skin the hit sounds, the drum gives a little and the star throbs once. */
  function beat(onHit?: () => void, both = false) {
    const right = run.current.beats % 2 === 1
    run.current.beats += 1
    const sticks = both ? [leftStick, rightStick] : [right ? rightStick : leftStick]
    if (!reduceMotion.current) {
      for (const stick of sticks) {
        stick.current?.animate(
          [
            { transform: RAISED, easing: 'cubic-bezier(0.5, 0, 1, 1)' },
            { transform: ON_THE_DRUM, offset: 0.25, easing: 'cubic-bezier(0, 0, 0.3, 1)' },
            { transform: RAISED },
          ],
          { duration: 440 },
        )
      }
    }
    later(
      () => {
        if (run.current.over) return
        if (both) playGetReadyTimeUp()
        else playTaikoHit(right)
        if (!reduceMotion.current) {
          drumRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05, 0.92)' }, { transform: 'scale(1)' }], {
            duration: 220,
            easing: 'ease-out',
          })
          pulseRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: 0.3 }, { transform: 'scale(1)' }], {
            duration: 380,
            easing: 'ease-out',
          })
        }
        onHit?.()
      },
      reduceMotion.current ? 0 : SWING_MS,
    )
  }

  function shrinkTo(next: number) {
    if (run.current.over) return
    // Any star still showing counts for at least one point.
    run.current.left = Math.ceil(prize * next - 1e-9)
    setShare(next)
    if (next > 0) return
    run.current.over = true
    later(() => showEnding({ words: 'We can do better!' }), 1300)
  }

  /**
   * The star is tapped: the drum beats once a second to the end, the first hit on the tap itself.
   * Timed by the tap's own time stamp, on the same clock as performance.now().
   */
  function start(e: MouseEvent) {
    if (started || e.timeStamp - run.current.mountedAt < TAP_GUARD_MS) return
    run.current.startedAt = e.timeStamp
    setStarted(true)
    later(() => setReadyLive(true), READY_AFTER_MS)
    const shrinking = seconds - FULL_SECONDS
    for (let b = 0; b <= seconds; b++) {
      const k = b - FULL_SECONDS
      later(
        () => {
          if (run.current.over) return
          if (k <= 0) beat()
          else if (k < shrinking) beat(() => shrinkTo(1 - k / shrinking))
          else beat(() => shrinkTo(0), true)
        },
        Math.max(0, b * 1000 - SWING_MS),
      )
    }
  }

  /** Ready!: what is left flies into the jar, one star a point, and the meter comes up to catch them. */
  function ready(e: MouseEvent) {
    const r = run.current
    if (!r.startedAt || e.timeStamp - r.startedAt < READY_AFTER_MS || r.over) return
    r.over = true
    timers.current.forEach(clearTimeout)
    timers.current = []
    const n = r.left
    playGetReadyGo()
    const box = starRef.current?.getBoundingClientRect()
    onLiftMeter(true)
    const lands = box ? flyStarsFrom(box.left + box.width / 2, box.top + box.height * 0.525, n, layout.s * 0.09) : 0
    onAward(n)
    setSent(true)
    later(() => showEnding({ words: 'Great Job!', earned: n }), Math.max(500, lands))
  }

  /** The last word stays until it is tapped: nothing here ends on a timer. */
  function showEnding(next: Ending) {
    run.current.endingAt = performance.now()
    setEnding(next)
  }

  const { s, top, meterBottom } = layout
  const cue = (f: number) => `${f * s}px`
  const box: CSSProperties = { position: 'absolute', left: `calc(50% - ${s / 2}px)`, top, width: s, height: s }
  const words: CSSProperties = { fontSize: cue(0.0974), textShadow: '0 3px 12px rgba(0,0,0,0.35)' }

  return (
    <div
      data-get-ready=""
      className={clsx(
        'fixed inset-0 z-[55] overflow-hidden bg-slate-900/80 text-white transition-opacity',
        shown && !leaving ? 'opacity-100 duration-300' : 'opacity-0 duration-[450ms]',
      )}
      onClick={() => {
        if (ending && performance.now() - run.current.endingAt > 600) close()
      }}
    >
      {!ending && (
        <>
          {/* Ready! and Stop are the teacher's: stacked at the top right, out of a child's reach, the
              same size and look, told apart by a light green and a light red outline. */}
          <div
            className={clsx('absolute right-7 flex flex-col gap-3 transition-opacity', sent && 'opacity-0')}
            style={{ top: meterBottom + 28 }}
          >
            <ControlButton label="Ready!" ring="border-green-300" live={readyLive} onTap={ready} />
            <ControlButton label="Stop" ring="border-red-300" live onTap={() => close()} />
          </div>

          <button
            type="button"
            aria-label="Start"
            onClick={start}
            className={clsx('border-none bg-transparent p-0', started ? 'cursor-default' : 'cursor-pointer')}
            style={box}
          >
            <div ref={pulseRef} className="absolute inset-0">
              <div
                ref={starRef}
                className="absolute inset-0 transition-transform duration-[450ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
                style={{
                  transformOrigin: '50% 52.5%',
                  // Never smaller than about a third while any of it is left, so the last of it is still a star the class can see.
                  transform: `scale(${sent || share <= 0 ? 0 : 0.32 + 0.68 * share})`,
                }}
              >
                <BigStar />
                {/* The drum and its sticks sit on the star, inside it so they shrink with it. */}
                <div className="pointer-events-none absolute" style={{ left: '16.67%', top: '17.44%', width: '66.67%', height: '66.67%' }}>
                  <div
                    ref={drumRef}
                    className="absolute"
                    style={{
                      left: '29.8%',
                      top: '33.65%',
                      width: '40.38%',
                      height: '40.38%',
                      transformOrigin: '50% 100%',
                      filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.25))',
                    }}
                  >
                    <img src={assetUrl('/get-ready/taiko-drum.svg')} alt="" draggable={false} className="h-full w-full select-none" />
                  </div>
                  <div className="absolute inset-0">
                    <Stick ref={leftStick} />
                  </div>
                  <div className="absolute inset-0 -scale-x-100">
                    <Stick ref={rightStick} />
                  </div>
                </div>
              </div>
            </div>
          </button>

          <p
            className={clsx('absolute inset-x-0 m-0 text-center font-bold transition-opacity', sent && 'opacity-0')}
            style={{ ...words, top: top + 0.864 * s }}
          >
            Get Ready!
          </p>
          <p
            className={clsx('absolute inset-x-0 m-0 text-center opacity-75', started && 'invisible')}
            style={{ fontSize: cue(0.0308), top: top + 0.979 * s }}
          >
            Tap the star to start
          </p>
        </>
      )}

      {ending && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center font-bold"
          style={{ ...words, fontSize: cue(0.082) }}
        >
          {ending.words}
          {/* How many stars the class earned, in gold, a step smaller (the teacher's addition). */}
          {ending.earned !== undefined && (
            <span className="mt-2.5 text-yellow-300" style={{ fontSize: cue(0.051) }}>
              You earned {ending.earned} {ending.earned === 1 ? 'star' : 'stars'}!
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ControlButton({ label, ring, live, onTap }: { label: string; ring: string; live: boolean; onTap: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={clsx(
        'h-[clamp(2.75rem,7vh,4rem)] w-[clamp(7rem,17vh,10rem)] rounded-2xl border-[3px] bg-white/10 font-bold transition-[opacity,scale] active:scale-95',
        ring,
        !live && 'opacity-45',
      )}
      style={{ fontSize: 'clamp(1.1rem, 3vh, 1.6rem)' }}
    >
      {label}
    </button>
  )
}

function BigStar() {
  const id = `gr-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="block h-full w-full overflow-visible"
      style={{ filter: 'drop-shadow(0 10px 24px rgba(251,191,36,0.45))' }}
    >
      <defs>
        <radialGradient id={id} cx="50%" cy="40%" r="65%">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="0.55" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <path d={STAR_PATH} fill={`url(#${id})`} stroke="#fff" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  )
}

/** A drumstick: plain wood, two tones and a grip, no outlines - the drum's own flat style. Raised until it swings. */
function Stick({ ref }: { ref: Ref<HTMLDivElement> }) {
  const id = `gs-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        left: '18.27%',
        top: '19.6%',
        width: '30.77%',
        height: '3.08%',
        transformOrigin: '0 50%',
        transform: RAISED,
        filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.25))',
      }}
    >
      <svg viewBox="0 0 160 16" aria-hidden="true" preserveAspectRatio="none" className="block h-full w-full">
        <defs>
          <clipPath id={id}>
            <rect x="0" y="1" width="160" height="14" rx="7" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <rect x="0" y="0" width="160" height="16" fill="#ecc995" />
          <rect x="0" y="9" width="160" height="7" fill="#d9a866" />
          <rect x="0" y="0" width="34" height="16" fill="#b97b45" />
          <rect x="0" y="9" width="34" height="7" fill="#a56a39" />
        </g>
      </svg>
    </div>
  )
}
