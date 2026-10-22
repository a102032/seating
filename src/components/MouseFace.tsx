import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'
import { timerElapsed, timerNow, type TimerState } from '../hooks/useTimer'
import { MOUSE_ENDING, MouseScene } from '../lib/mouseTimer'
import { WRITER_ENDING, WriterScene } from '../lib/writerTimer'
import { playMouseBite, playMouseHic, playPickerTick, primeMouseBite } from '../lib/sound'

/** The times a tap on the face offers: the ones a lesson uses, up to the hour the dial has. */
const MINUTES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60]

/**
 * The timer's mouse face (2026-10-20, the teacher; the scene is `lib/mouseTimer.ts`): one apple a
 * minute, the mouse eating its way along them to the cheese. It takes the dial's place in the card
 * and everything round it (the time, − and +, Again, play, the last seconds' orange and red, the
 * dance) is the same.
 *
 * Setting the time: there is no dial to tap, so a tap on the stopped face brings up the times as
 * big round buttons ("How long?", as Get Ready! asks), and − and + still go a minute at a time.
 * Time's up: "Time's up!" at the foot of the face until it is tapped, as on the dial; the mouse is
 * at its cheese by then.
 *
 * The scene is drawn here on every animation frame, at most 30 times a second (15 while it waits),
 * straight into the SVG and never through React; the card itself still redraws once a second.
 *
 * The writing mouse (2026-10-22, `lib/writerTimer.ts`) is the same face with another scene: a page a
 * minute instead of an apple, so everything round it (setting the time, "Time's up!") is shared.
 */
export function MouseFace({
  kind,
  t,
  guard,
  onUp,
  onPick,
}: {
  /** The apples, or the mouse writing at its desk. */
  kind: 'mouse' | 'writer'
  t: TimerState
  /** The card's tap guard: false for the board's second touch of a tap that just changed things. */
  guard: () => boolean
  onUp: () => void
  onPick: (minutes: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const sceneRef = useRef<MouseScene | WriterScene | null>(null)
  const id = 'mf' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let scene: MouseScene | WriterScene
    if (kind === 'mouse') {
      primeMouseBite()
      scene = new MouseScene(svgRef.current!, id, {
        // Quiet with the strip's speaker off, or with No Sound (a test next door).
        onBite: () => !timerNow().quiet && timerNow().sound !== 'none' && playMouseBite(),
        onHic: () => !timerNow().quiet && timerNow().sound !== 'none' && playMouseHic(),
        reduceMotion,
      })
    } else scene = new WriterScene(svgRef.current!, id, { reduceMotion })
    scene.setLength(timerNow().seconds)
    sceneRef.current = scene
    const ending = kind === 'mouse' ? MOUSE_ENDING : WRITER_ENDING
    let raf = 0
    let drawn = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      // Eating, or the ending at the cheese: 30 frames a second. Waiting, only the breathing moves, so 15.
      const { running, up, seconds } = timerNow()
      const elapsed = timerElapsed()
      const busy = running || (up && elapsed < seconds + ending)
      if (now - drawn < (busy ? 32 : 64)) return
      drawn = now
      scene.draw(elapsed, now)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [id, kind])

  useEffect(() => {
    sceneRef.current?.setLength(t.seconds)
  }, [t.seconds])

  const stopped = !t.running && !t.up
  // Started, or the time is up: the choices go, and don't come back at a pause.
  const [wasStopped, setWasStopped] = useState(stopped)
  if (stopped !== wasStopped) {
    setWasStopped(stopped)
    if (!stopped) setPicking(false)
  }
  const showPick = picking && stopped
  return (
    <div className="mouse-face">
      <svg
        ref={svgRef}
        className={clsx('mouse-scene', stopped && 'settable')}
        role="img"
        aria-label={t.up ? "Time's up" : `${Math.ceil(t.left / 60)} ${kind === 'mouse' ? 'apples' : 'pages'} left`}
        onClick={() => {
          if (t.up) {
            if (guard()) onUp()
          } else if (stopped && guard()) setPicking(true)
        }}
      />
      {t.up && (
        <button type="button" className="mouse-up" onClick={() => guard() && onUp()}>
          Time&rsquo;s up!
        </button>
      )}
      {showPick && (
        <div className="mouse-pick" onClick={() => guard() && setPicking(false)}>
          <div className="mouse-pick-title">How long?</div>
          <div className="mouse-pick-grid">
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                data-slot="button"
                className={clsx('mouse-pick-min', t.seconds === m * 60 && 'on')}
                aria-label={`${m} minute${m === 1 ? '' : 's'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!guard()) return
                  playPickerTick()
                  onPick(m)
                  setPicking(false)
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
