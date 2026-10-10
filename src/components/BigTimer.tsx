import clsx from 'clsx'
import { Check, Minus, Plus, RotateCcw, Settings, Volume2, VolumeX } from 'lucide-react'
import { useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import {
  TIMER_COLORS,
  TIMER_MIN_SIZE,
  timeText,
  timer,
  useTimer,
  type TimerColor,
  type TimerSound,
  type TimerState,
} from '../hooks/useTimer'
import { ALARM_SOUND_LABELS, playPickerTick } from '../lib/sound'
import { MoveHandIcon } from './MoveHandIcon'
import { BackIcon, MinimizeIcon } from './RailIcons'

/** A second touch the board makes of one tap, on something that just changed under the finger. */
const TAP_GUARD_MS = 700
/** − and + are pressed again on purpose, so they wait only for the board's ghost touch. */
const STEP_GUARD_MS = 250
/** A finger that moves less than this is still a tap. */
const SLIDE_PX = 10

const COLOR_CHOICES: { id: TimerColor; label: string }[] = [
  { id: 'theme', label: 'Theme' },
  { id: 'blue', label: 'Blue' },
  { id: 'red', label: 'Red' },
  { id: 'green', label: 'Green' },
]
const SOUND_CHOICES: TimerSound[] = ['ding', 'chime', 'bell', 'trainWhistle', 'guitar', 'rooster', 'none']

let lastChange = 0
/** True when a tap may act: not the board's second touch of a tap that just changed the card. */
function fresh(ms = TAP_GUARD_MS) {
  const now = performance.now()
  if (now >= lastChange && now - lastChange < ms) return false
  lastChange = now
  return true
}

/**
 * The timer, big over the board (2026-10-09, the teacher; drawn after Classroom Screen's visual
 * timer): a 60-minute face numbered every five minutes with a tick a minute, the time left a
 * wedge shrinking back to the top, the time in numbers under it, Again on the left and a round
 * play button on the right. The board behind isn't dimmed and stays live, so a desk can be
 * tapped for a point while it runs.
 *
 * Like a window: its top strip has the hand (hold and slide to move it), the gear (its colour and
 * sound, in the face's place until Back), minimise (away into the goal meter's bar) and X (off).
 * Its corner makes it smaller, down to about half, and back up to the size it opened at. It opens
 * again where it was put, at the size it was given, and the first time in the middle.
 *
 * It moves by transform, which the graphics chip runs, and is drawn again only when the second
 * changes. Nothing here ends on a clock: time's up waits for a tap.
 */
export function BigTimer() {
  const t = useTimer((s) => s)
  if (t.view !== 'big') return null
  return (
    <div className="timer-layer">
      <TimerCard t={t} />
    </div>
  )
}

function TimerCard({ t }: { t: TimerState }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: number
    mode: 'move' | 'size'
    x0: number
    y0: number
    pos0: { x: number; y: number }
    size0: number
    left0: number
    top0: number
    w0: number
    h0: number
    moving: boolean
    pos: { x: number; y: number }
    size: number
  } | null>(null)
  /** The tap that ends a slide sets nothing and presses nothing. */
  const swallow = useRef(false)

  const pos = t.pos ?? { x: 0.5, y: 0.5 }
  const style = {
    '--px': pos.x,
    '--py': pos.y,
    '--k': t.size,
    ...(t.color !== 'theme' && { '--tw': TIMER_COLORS[t.color] }),
  } as CSSProperties

  function begin(e: PointerEvent) {
    const d = drag.current!
    d.moving = true
    cardRef.current?.classList.add('dragging')
    try {
      cardRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // Already let go.
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // A new touch is a new gesture: only the click that ends a slide is ever eaten.
    swallow.current = false
    // Only the first finger counts, so the board's second touch can't pull it.
    const card = cardRef.current
    if (!card || drag.current || !e.isPrimary || e.button > 0) return
    const target = e.target as Element
    const W = window.innerWidth
    const H = window.innerHeight
    const w = card.offsetWidth
    const h = card.offsetHeight
    drag.current = {
      id: e.pointerId,
      mode: target.closest('[data-timer-size]') ? 'size' : 'move',
      x0: e.clientX,
      y0: e.clientY,
      pos0: pos,
      size0: t.size,
      left0: pos.x * (W - w),
      top0: pos.y * (H - h),
      w0: w,
      h0: h,
      moving: false,
      pos,
      size: t.size,
    }
    // The corner and the strip's hand move at once; anywhere else waits for a slide, so a tap on
    // the face or a button is still a tap.
    if (drag.current.mode === 'size' || (target.closest('[data-timer-strip]') && !target.closest('button'))) begin(e)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    const card = cardRef.current
    if (!d || !card || e.pointerId !== d.id) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.moving) {
      if (Math.hypot(dx, dy) < SLIDE_PX) return
      begin(e)
    }
    const W = window.innerWidth
    const H = window.innerHeight
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    if (d.mode === 'size') {
      // Along the corner's diagonal, from the size it had when the finger came down.
      let size = Math.min(1, Math.max(TIMER_MIN_SIZE, d.size0 * (1 + (dx / d.w0 + dy / d.h0) / 2)))
      card.style.setProperty('--k', size.toFixed(4))
      // Never past the right or bottom edge: the top-left corner stays where it is.
      const room = Math.min((W - d.left0) / card.offsetWidth, (H - d.top0) / card.offsetHeight)
      if (room < 1) {
        size = Math.max(TIMER_MIN_SIZE, size * room)
        card.style.setProperty('--k', size.toFixed(4))
      }
      d.size = size
      const fw = W - card.offsetWidth
      const fh = H - card.offsetHeight
      d.pos = { x: fw > 0 ? clamp(d.left0 / fw) : 0.5, y: fh > 0 ? clamp(d.top0 / fh) : 0.5 }
    } else {
      const fw = W - card.offsetWidth
      const fh = H - card.offsetHeight
      d.pos = { x: fw > 0 ? clamp(d.pos0.x + dx / fw) : 0.5, y: fh > 0 ? clamp(d.pos0.y + dy / fh) : 0.5 }
    }
    // Straight onto the card, not through React: a slide is many moves a second.
    card.style.setProperty('--px', d.pos.x.toFixed(4))
    card.style.setProperty('--py', d.pos.y.toFixed(4))
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    if (!d.moving) return
    swallow.current = true
    cardRef.current?.classList.remove('dragging')
    timer.place(d.pos, d.size)
  }

  function onClickCapture(e: MouseEvent) {
    if (!swallow.current) return
    swallow.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  /** A tap on the stopped face sets the time to where it landed, to the nearest minute (the top is 60). */
  function onFace(e: MouseEvent<SVGSVGElement>) {
    if (t.running || t.up) return
    // The board's second touch of the tap that just changed the card lands here too.
    const now = performance.now()
    if (now >= lastChange && now - lastChange < TAP_GUARD_MS) return
    const r = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    if (Math.hypot(dx, dy) < r.width * 0.06) return
    let minutes = Math.round((((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360) / 6)
    if (minutes === 0) minutes = 60
    if (minutes !== Math.round(t.left / 60) || t.left % 60 !== 0) playPickerTick()
    timer.setMinutes(minutes)
  }

  const act = (fn: () => void, ms?: number) => () => {
    if (fresh(ms)) fn()
  }

  return (
    <div
      ref={cardRef}
      className={clsx('timer-card', t.settings && 'setting')}
      style={style}
      data-timer-card=""
      role="dialog"
      aria-label="Timer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
      // A finger held still on a touch board is a right-click: no menu on the card.
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="timer-strip" data-timer-strip="">
        <span className="timer-grip" title="Hold and slide to move it">
          <MoveHandIcon />
        </span>
        <span className="grow self-stretch" />
        <button
          type="button"
          className={clsx('timer-bare', t.settings && 'on')}
          onClick={act(timer.toggleSettings)}
          aria-label="Timer settings"
          title="Color and sound"
        >
          <Settings />
        </button>
        <button type="button" className="timer-bare" onClick={act(timer.minimise)} aria-label="Put the timer away" title="Put it away">
          <MinimizeIcon />
        </button>
        <button type="button" className="timer-bare" onClick={act(timer.off)} aria-label="Turn the timer off" title="Turn it off">
          <CloseIcon />
        </button>
      </div>

      <div className="timer-face">
        {t.settings ? <TimerChoices t={t} onBack={act(timer.toggleSettings)} /> : <Dial t={t} onFace={onFace} onUp={act(timer.again)} />}
      </div>

      <div className="timer-foot">
        <button type="button" data-slot="button" className="timer-round quiet" onClick={act(timer.again)} aria-label="Again" title="Again">
          <RotateCcw />
        </button>
        <div className="timer-set">
          {/* They hide while it runs: the time is set before it starts. */}
          <button
            type="button"
            data-slot="button"
            className="timer-step"
            disabled={t.running}
            onClick={act(() => {
              playPickerTick()
              timer.step(-1)
            }, STEP_GUARD_MS)}
            aria-label="A minute less"
          >
            <Minus />
          </button>
          <span className="timer-time">{timeText(t.left)}</span>
          <button
            type="button"
            data-slot="button"
            className="timer-step"
            disabled={t.running}
            onClick={act(() => {
              playPickerTick()
              timer.step(1)
            }, STEP_GUARD_MS)}
            aria-label="A minute more"
          >
            <Plus />
          </button>
        </div>
        {t.running ? (
          <button type="button" data-slot="button" className="timer-round go" onClick={act(timer.pause)} aria-label="Pause" title="Pause">
            <PauseIcon />
          </button>
        ) : (
          <button type="button" data-slot="button" className="timer-round go" onClick={act(timer.start)} aria-label="Start" title="Start">
            <PlayIcon />
          </button>
        )}
      </div>

      {/* The corner that makes it smaller, and back up to the size it opened at: three short lines, as on a window. */}
      <span className="timer-size" data-timer-size="" title="Slide to make it smaller or bigger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M21 9L9 21M21 14l-7 7M21 19l-2 2" />
        </svg>
      </span>
    </div>
  )
}

const DIAL_R = 44

/** A point on the face, `deg` clockwise from the top, `r` from the middle. */
function at(deg: number, r: number) {
  const th = ((deg - 90) * Math.PI) / 180
  return [r * Math.cos(th), r * Math.sin(th)]
}

/** The 60-minute face, its ticks and numbers drawn once; only the wedge changes as it runs. */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const big = i % 5 === 0
  const [x1, y1] = at(i * 6, 46.5)
  const [x2, y2] = at(i * 6, big ? 51.5 : 49)
  return <line key={i} x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)} strokeWidth={big ? 1.1 : 0.6} />
})
const NUMBERS = Array.from({ length: 12 }, (_, i) => {
  const [x, y] = at(i * 30, 58)
  return (
    <text key={i} x={x.toFixed(2)} y={y.toFixed(2)} textAnchor="middle" dominantBaseline="central">
      {i * 5}
    </text>
  )
})

function Dial({ t, onFace, onUp }: { t: TimerState; onFace: (e: MouseEvent<SVGSVGElement>) => void; onUp: () => void }) {
  const minutes = Math.max(0, Math.min(60, t.left / 60))
  const angle = (minutes / 60) * 360
  const [ex, ey] = at(angle, DIAL_R)
  const wedge =
    minutes >= 59.99 ? (
      <circle className="timer-wedge" r={DIAL_R} />
    ) : minutes > 0 ? (
      <path
        className="timer-wedge"
        d={`M0 0 L0 ${-DIAL_R} A${DIAL_R} ${DIAL_R} 0 ${angle > 180 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`}
      />
    ) : null
  return (
    <svg
      className={clsx('timer-dial', (t.running || t.up) && 'running')}
      viewBox="-64 -64 128 128"
      onClick={onFace}
      role="img"
      aria-label={t.up ? "Time's up" : `${Math.ceil(minutes)} minutes left`}
    >
      <circle className="timer-tint" r={DIAL_R} />
      {wedge}
      {TICKS}
      {NUMBERS}
      <circle className="timer-dot" r={2.4} />
      {/* Time's up: on the face until it is tapped, which puts the time back. Nothing ends it on a clock. */}
      {t.up && (
        <g
          className="timer-up"
          onClick={(e) => {
            e.stopPropagation()
            onUp()
          }}
        >
          <circle r={DIAL_R} />
          <text y={-6} textAnchor="middle" dominantBaseline="central">
            Time&rsquo;s
          </text>
          <text y={9} textAnchor="middle" dominantBaseline="central">
            up!
          </text>
        </g>
      )}
    </svg>
  )
}

/**
 * The gear's choices, in the face's place until Back (the teacher's go-back arrow, at the top) or
 * the timer is started: the wedge's colour, then the time's-up sound (the app's six, and No Sound,
 * for a test next door). A tap on a sound plays it and picks it. Words here: only the teacher uses it.
 */
function TimerChoices({ t, onBack }: { t: TimerState; onBack: () => void }) {
  return (
    <div className="timer-choices">
      <button
        type="button"
        data-slot="button"
        className="timer-back"
        onClick={onBack}
        aria-label="Back to the clock"
        title="Back to the clock"
      >
        <BackIcon />
      </button>
      <div className="timer-heading">Color</div>
      <div className="timer-colors">
        {COLOR_CHOICES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={clsx('timer-color', t.color === id && 'on')}
            aria-pressed={t.color === id}
            onClick={() => {
              playPickerTick()
              timer.setColor(id)
            }}
          >
            <i style={{ '--c': id === 'theme' ? 'var(--primary)' : TIMER_COLORS[id] } as CSSProperties}>
              <Check />
            </i>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="timer-heading">Time&rsquo;s up sound</div>
      <div className="timer-sounds">
        {SOUND_CHOICES.map((sound) => (
          <button
            key={sound}
            type="button"
            data-slot="button"
            className={clsx('timer-sound', t.sound === sound && 'on', sound === 'none' && 'wide')}
            aria-pressed={t.sound === sound}
            onClick={() => timer.setSound(sound)}
          >
            {sound === 'none' ? <VolumeX /> : <Volume2 />}
            <span>{sound === 'none' ? 'No Sound' : ALARM_SOUND_LABELS[sound]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Put away (the minimise button): a clock at the start of the goal meter's bar, the time alone,
 * with pause or play and X, the way Windows puts a window on the taskbar. A tap on the time opens
 * it big again where it was. Red and breathing when the time is up, until it is tapped.
 */
export function TimerClock() {
  const view = useTimer((s) => s.view)
  const up = useTimer((s) => s.up)
  const running = useTimer((s) => s.running)
  const left = useTimer((s) => s.left)
  if (view !== 'bar') return null
  const act = (fn: () => void) => () => {
    if (fresh()) fn()
  }
  return (
    <div className={clsx('timer-clock', up && 'up')} data-timer-clock="">
      <button type="button" className="timer-open" onClick={act(timer.open)} aria-label="Open the timer" title="Open the timer">
        <span className="timer-digits">{up ? 'Time’s up!' : timeText(left)}</span>
      </button>
      {!up &&
        (running ? (
          <button type="button" className="timer-bare" onClick={act(timer.pause)} aria-label="Pause" title="Pause">
            <PauseIcon />
          </button>
        ) : (
          <button type="button" className="timer-bare" onClick={act(timer.start)} aria-label="Start" title="Start">
            <PlayIcon />
          </button>
        ))}
      <button type="button" className="timer-bare" onClick={act(timer.off)} aria-label="Turn the timer off" title="Turn it off">
        <CloseIcon />
      </button>
    </div>
  )
}

/** X turns it off, as on a window. */
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4.8v14.4a1 1 0 0 0 1.5.86l11.2-7.2a1 1 0 0 0 0-1.72L9.5 3.94A1 1 0 0 0 8 4.8z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4.5" width="4.4" height="15" rx="1.3" fill="currentColor" />
      <rect x="13.6" y="4.5" width="4.4" height="15" rx="1.3" fill="currentColor" />
    </svg>
  )
}
