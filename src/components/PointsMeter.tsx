import clsx from 'clsx'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { assetUrl } from '../lib/assets'
import { gifUrl as giphyUrl } from '../lib/celebrationGifs'
import { playCoinTick, playGoalCelebration, primeGoalFanfare } from '../lib/sound'
import { landingIsLoud, landingIsSilent, starsLandingIn } from '../lib/starFlight'
import { GoalCelebration } from './GoalCelebration'

interface PointsMeterProps {
  classId: string
  classPoints: number
  goal: number
  /** Times the goal has been filled. A rise here is what opens the chest. */
  goalsReached: number
  /** GIPHY id for the celebration, or empty for the treasure chest. */
  celebrationGifId?: string
  onOpenGoalSettings: () => void
  /**
   * The app isn't in front of the class - the goal was filled from the floating window, over a
   * lesson. The chest waits, full, until the app is showing again: the fanfare shouldn't play
   * from behind the lesson with nothing for the class to see.
   */
  holdCelebration: boolean
  /** Whether a filled goal is waiting for the app to come back, so the floating window can say so. */
  onWaitingChange: (waiting: boolean) => void
  /**
   * The class's name, with its switcher and settings gear (ClassTitle), at the meter's end: the
   * one thing beside the meter, and a quiet one. Float and All Stars In! were here and went to
   * the side panel, because buttons beside the meter took the eye from it.
   */
  title: ReactNode
  /**
   * Get Ready! is ending with stars on their way: the meter comes up above the faded board, so the
   * class sees them land in it.
   */
  lifted?: boolean
}

/** How full the meter has to get before the chest starts straining. */
const RATTLE_FROM = 0.85
/** Start fetching the celebration gif here, so it's decoded before the chest opens. */
const PRELOAD_FROM = 0.7
const CLOSE_UP_MS = 900

const treasure = (name: string) => assetUrl(`/treasure/${name}.svg`)

/**
 * The class goal, as a voyage from the map to the chest.
 *
 * The coin is the class: it rides the leading edge of the fill rather than the bar just
 * growing, so the bar has something in it that moves. The chest starts rattling near the end
 * because the last few points are the exciting ones and nothing used to mark them, and when
 * it opens the celebration erupts from the chest's own position on screen rather than from
 * nowhere. Nothing here changes the row's height - the icons sit in space the 56px row
 * already had.
 */
export function PointsMeter({
  classId,
  classPoints,
  goal,
  goalsReached,
  celebrationGifId,
  onOpenGoalSettings,
  holdCelebration,
  onWaitingChange,
  title,
  lifted = false,
}: PointsMeterProps) {
  const prevRef = useRef<{ classId: string; value: number; reached: number } | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  // 'waiting' is a filled goal whose chest hasn't opened yet, because the app wasn't in front.
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'opening' | 'closing'>('idle')
  const holdRef = useRef(holdCelebration)
  const waitingChangeRef = useRef(onWaitingChange)
  const phaseRef = useRef(phase)
  /** The meter's real total, for picking up once the chest has shut. */
  const latestPoints = useRef(classPoints)
  useEffect(() => {
    holdRef.current = holdCelebration
    waitingChangeRef.current = onWaitingChange
    phaseRef.current = phase
    latestPoints.current = classPoints
  })
  const [burstOrigin, setBurstOrigin] = useState<{ x: number; y: number } | null>(null)
  // Normally mirrors classPoints, but holds at full through the celebration so the bar
  // doesn't snap back to the new run while the chest is still open.
  const [displayPoints, setDisplayPoints] = useState(classPoints)
  // Null until the gif has actually decoded. The chest is what shows otherwise, so a slow
  // or blocked network costs the moment nothing.
  const [readyGif, setReadyGif] = useState<{ id: string; url: string } | null>(null)
  /** Cuts the fanfare short when the teacher closes the celebration. */
  const stopFanfare = useRef<(() => void) | null>(null)

  /** Meter moves waiting for a star still in the air (lib/starFlight). */
  const landings = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => landings.current.forEach(clearTimeout), [])

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { classId, value: classPoints, reached: goalsReached }
    if (!prev || prev.classId !== classId) {
      landings.current.forEach(clearTimeout)
      landings.current = []
      stopFanfare.current?.()
      stopFanfare.current = null
      setDisplayPoints(classPoints)
      setPhase('idle')
      return
    }

    // A point from a desk sends a star flying into the jar first: the coin moves, the sound
    // plays and a filled goal opens as it lands, not while it is still on the desk. Decided
    // when it lands, so a second point in the air sees the chest the first one opened.
    const wait = classPoints > prev.value || goalsReached > prev.reached ? starsLandingIn() : 0
    if (wait > 0) {
      const timer = setTimeout(() => {
        landings.current = landings.current.filter((t) => t !== timer)
        land(prev)
      }, wait)
      landings.current.push(timer)
    } else land(prev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, classPoints, goal, goalsReached])

  function land(prev: { value: number; reached: number }) {
    // The chest is already open, or waiting to be: the bar stays full until it shuts, and
    // what landed meanwhile is picked up then. A second party on top of the first would play
    // two fanfares at once.
    if (phaseRef.current === 'opening' || phaseRef.current === 'waiting') {
      if ((classPoints > prev.value || goalsReached > prev.reached) && !landingIsSilent()) playCoinTick()
      return
    }

    // The goal was filled: celebrate. This used to key off the total dropping, which is
    // also what a reset or a correction looks like - so Reset Class Goal threw the party.
    if (goalsReached > prev.reached) {
      setDisplayPoints(goal)
      if (holdRef.current) {
        // The last marble still lands with its tick; the party waits for the app.
        if (!landingIsSilent()) playCoinTick()
        setPhase('waiting')
        return
      }
      setPhase('opening')
      stopFanfare.current = playGoalCelebration()
      const box = chestRef.current?.getBoundingClientRect()
      setBurstOrigin(box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null)
      return
    }

    // A fall without a fill is a reset or a correction: the coin just goes back, quietly.
    if (classPoints < prev.value) {
      setDisplayPoints(classPoints)
      return
    }

    // The coin moving and the count popping say a point landed. A "+1" also rose off the coin
    // every time; the teacher took it out as one thing more than the moment needed.
    if (classPoints > prev.value) {
      setDisplayPoints(classPoints)
      // A Get Ready! with its speaker off lands its stars in silence.
      if (!landingIsSilent()) playCoinTick(landingIsLoud())
    }
  }

  // A goal filled from the floating window opens the moment the app is in front again - when
  // the teacher taps Celebrate there, or comes back to the app some other way.
  useEffect(() => {
    if (phase === 'waiting' && !holdCelebration) {
      setPhase('opening')
      stopFanfare.current = playGoalCelebration()
      const box = chestRef.current?.getBoundingClientRect()
      setBurstOrigin(box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null)
    }
  }, [phase, holdCelebration])

  useEffect(() => {
    waitingChangeRef.current(phase === 'waiting')
  }, [phase])
  useEffect(() => () => waitingChangeRef.current(false), [])

  // Decode the fanfare as soon as this class has a goal, so it's in memory long before the
  // chest opens rather than starting a download at the moment it's needed.
  useEffect(() => {
    if (goal > 0) primeGoalFanfare()
  }, [goal])

  // Fetch the gif on approach rather than when the chest opens - starting the download at
  // the moment it's needed means it arrives halfway through, which looks broken.
  const approaching = goal > 0 && classPoints / goal >= PRELOAD_FROM
  useEffect(() => {
    if (!celebrationGifId || !approaching) return
    const url = giphyUrl(celebrationGifId)
    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (!cancelled) setReadyGif({ id: celebrationGifId, url })
    }
    img.onerror = () => {
      if (!cancelled) setReadyGif(null)
    }
    img.src = url
    return () => {
      cancelled = true
    }
  }, [celebrationGifId, approaching])

  /**
   * The celebration is over: shut the lid, send the coin home, then pick up the new total -
   * points past the goal carry into the next run, and the bar used to sit at 0 over them
   * until the next point landed.
   */
  function finishCelebration() {
    if (phase !== 'opening') return
    stopFanfare.current?.()
    stopFanfare.current = null
    setPhase('closing')
    setDisplayPoints(0)
    setTimeout(() => {
      setPhase('idle')
      setDisplayPoints(latestPoints.current)
    }, CLOSE_UP_MS)
  }

  useEffect(() => () => stopFanfare.current?.(), [])

  const pct = goal > 0 ? Math.min(100, (displayPoints / goal) * 100) : 0
  const open = phase === 'opening'
  const rattling = !open && goal > 0 && pct / 100 >= RATTLE_FROM

  return (
    <div
      data-ink="panel"
      className={clsx(
        'relative flex h-14 shrink-0 items-center gap-2.5 overflow-visible rounded-2xl border border-border bg-card/70 px-3 shadow-sm transition-shadow sm:gap-3 sm:px-4',
        open && 'shadow-[0_0_0_3px_rgba(251,191,36,0.65)]',
        // Above Get Ready!'s faded board (z-55), under the stars flying in (z-60). Only to be
        // seen: a tap on it goes through to the board, where it ends Get Ready!, rather than
        // opening the class list or a settings window under the faded board.
        lifted && 'pointer-events-none z-[56]',
      )}
    >
      {/* Where the voyage starts. It unrolls again when a new run begins. 40px, a third up from
          30, because the teacher found it hard to see; it still fits the 56px row. */}
      <motion.img
        src={treasure('map')}
        alt=""
        draggable={false}
        className="h-10 w-10 shrink-0 select-none"
        animate={phase === 'closing' ? { rotate: [0, -9, 6, 0], scale: [1, 1.18, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.7 }}
      />

      {/*
        Everything that moves here is CSS, so the board's graphics chip runs it and the main
        processor is left free. It was framer-motion springs, plus a ring of nine sparkles
        per point: on a 4K board that was a stutter on every +1, so the sparkles went and the
        rest moved to CSS with an ease that overshoots a touch, like the springs did.
      */}
      {/* Measured as a container, so the coin can travel in widths of the track (cqw). */}
      <div className="relative h-4 flex-1" style={{ containerType: 'inline-size' }}>
        <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.34,1.25,0.64,1)]"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #38bdf8, #a3e635, #facc15)',
              backgroundSize: '200% 100%',
              backgroundPositionX: `${100 - pct}%`,
            }}
          />
        </div>

        {/*
          The coin hangs off an anchor that travels along the track by a share of the track's
          width - a transform, which the graphics chip moves on its own - and the coin sits on
          it. The anchor has no width of its own. It used to span the whole track and slide by a
          percentage of itself, so a nearly full meter carried a track-wide box past the edge of
          the screen; the page could then be pushed sideways (a pick landing did it), cutting the
          side panel off.
        */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-0 transition-transform duration-700 ease-[cubic-bezier(0.34,1.25,0.64,1)]"
          style={{ transform: `translateX(${pct}cqw)` }}
        >
          <div className="absolute left-0 top-1/2 h-0 w-0">
            {/*
            The class, travelling. Centred on the anchor with plain offsets, so framer's rotate
            transform has nothing to fight over. max-w-none is load-bearing: the preflight's
            `img { max-width: 100% }` resolves against this anchor's zero-width content box and
            would otherwise squash the coin to nothing.
          */}
            <img
              src={treasure('star-coin')}
              alt=""
              draggable={false}
              // Where a student's star flies to (lib/starFlight).
              data-goal-coin=""
              className={clsx(
                'absolute h-[26px] w-[26px] max-w-none select-none drop-shadow',
                open && 'animate-[spin_0.8s_linear_infinite]',
              )}
              style={{ left: -13, top: -13 }}
            />
          </div>
        </div>
      </div>

      {/* Where it's going. Straining near the end, then open. */}
      <button
        type="button"
        onClick={onOpenGoalSettings}
        title="Class goal settings"
        className="shrink-0 rounded-xl p-0.5 transition-transform active:scale-90"
      >
        {/* The rattle runs for as long as the class sits near the goal - a whole lesson,
            sometimes - which is why it had to leave framer for CSS above all. */}
        <div ref={chestRef} className={clsx(open ? 'meter-chest-open' : rattling && 'meter-chest-rattle')}>
          <img src={treasure(open ? 'chest-open' : 'chest-closed')} alt="" draggable={false} className="h-8 w-8 select-none" />
        </div>
      </button>

      <span
        key={displayPoints}
        className="count-pop shrink-0 font-bold tabular-nums text-foreground"
        style={{ fontSize: 'clamp(0.85rem, 1.6vmin, 1.1rem)' }}
      >
        {displayPoints} / {goal}
      </span>

      {title}

      {/* Only the gif that is currently chosen counts as ready. The last decoded one used to
          be kept, so the chest could open on the gif the teacher had just switched away from. */}
      {open && (
        <GoalCelebration
          origin={burstOrigin}
          gifUrl={readyGif && readyGif.id === celebrationGifId ? readyGif.url : null}
          onDone={finishCelebration}
        />
      )}
    </div>
  )
}
