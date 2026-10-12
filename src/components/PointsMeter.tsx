import clsx from 'clsx'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { assetUrl } from '../lib/assets'
import { CHESTS, type ChestNow } from '../lib/quest'
import { playCoinTick } from '../lib/sound'
import { landingIsLoud, landingIsSilent, starsLandingIn } from '../lib/starFlight'
import { barClass } from '../lib/topBar'
import { KeyMoment } from './quest/KeyMoment'
import { ChestPicture, KeyPicture, KeyPips } from './quest/QuestPictures'

interface PointsMeterProps {
  classId: string
  classPoints: number
  goal: number
  /** Times the goal has been filled. A rise here is a key won for the Quest. */
  goalsReached: number
  /** The Quest's chest the class is on, at the meter's end, and how many of its locks are gold. */
  chest: ChestNow
  /** A tap on the chest: it opens when every lock is gold; otherwise Our Quest slides over the board. */
  onTapChest: () => void
  /**
   * The app isn't in front of the class - the goal was filled from the floating window, over a
   * lesson, where the key dropped into the window's own chest. The key moment doesn't play again
   * here: the meter just shows the lock turned gold.
   */
  holdKeyMoment: boolean
  /**
   * Get Ready! is ending with stars on their way: the meter comes up above the faded board, so the
   * class sees them land in it.
   */
  lifted?: boolean
  /** The timer, put away as a clock at the bar's start (BigTimer.tsx). */
  leading?: ReactNode
  /** Which side the rail is on, so the put-away clock sits at the end by the rail's timer button. */
  side: 'left' | 'right'
}

/** How full the meter has to get before the key at its end starts bobbing. */
const NEAR_FROM = 0.85
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
  chest,
  onTapChest,
  holdKeyMoment,
  lifted = false,
  leading,
  side,
}: PointsMeterProps) {
  const prevRef = useRef<{ classId: string; value: number; reached: number } | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  // 'key' is the key moment, waiting for its tap; 'closing' the bar going back to the next run.
  const [phase, setPhase] = useState<'idle' | 'key' | 'closing'>('idle')
  const [keysWon, setKeysWon] = useState(1)
  /** Bumped as a key lands, so the chest gives its click and wiggle. */
  const [clicks, setClicks] = useState(0)
  const holdRef = useRef(holdKeyMoment)
  const phaseRef = useRef(phase)
  /** The meter's real total, for picking up once the key is in. */
  const latestPoints = useRef(classPoints)
  useEffect(() => {
    holdRef.current = holdKeyMoment
    phaseRef.current = phase
    latestPoints.current = classPoints
  })
  // Normally mirrors classPoints, but holds at full through the key moment so the bar doesn't
  // snap back to the new run while the key is still on its way.
  const [displayPoints, setDisplayPoints] = useState(classPoints)

  /** Meter moves waiting for a star still in the air (lib/starFlight). */
  const landings = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => landings.current.forEach(clearTimeout), [])

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { classId, value: classPoints, reached: goalsReached }
    if (!prev || prev.classId !== classId) {
      landings.current.forEach(clearTimeout)
      landings.current = []
      setDisplayPoints(classPoints)
      setPhase('idle')
      return
    }

    // A point from a desk sends a star flying into the jar first: the coin moves, the sound
    // plays and a filled goal wins its key as it lands, not while it is still on the desk.
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
    const sound = () => {
      if (!landingIsSilent()) playCoinTick(landingIsLoud())
    }
    // A key is already waiting for its tap: the bar stays full until it is in, and what landed
    // meanwhile is picked up then. A second goal filled meanwhile is one more key in the same moment.
    if (phaseRef.current === 'key') {
      if (goalsReached > prev.reached) setKeysWon((n) => n + goalsReached - prev.reached)
      if (classPoints > prev.value || goalsReached > prev.reached) sound()
      return
    }

    // The goal was filled: a key. This keys off the goals-reached count, never the total
    // falling - a reset or a correction is a fall too.
    if (goalsReached > prev.reached) {
      sound()
      if (holdRef.current) {
        // Filled from the floating window: the key went into its chest there. Here the lock is
        // simply gold, and the bar starts the next run.
        setDisplayPoints(classPoints)
        setClicks((n) => n + 1)
        return
      }
      setDisplayPoints(goal)
      setKeysWon(goalsReached - prev.reached)
      setPhase('key')
      return
    }

    // A fall without a fill is a reset or a correction: the coin just goes back, quietly.
    if (classPoints < prev.value) {
      setDisplayPoints(classPoints)
      return
    }

    // The coin moving and the count popping say a point landed.
    if (classPoints > prev.value) {
      setDisplayPoints(classPoints)
      sound()
    }
  }

  /** The key is in: the lock turns gold, the bar empties, then picks up the new total. */
  function keyLanded() {
    setClicks((n) => n + 1)
    setPhase('closing')
    setDisplayPoints(0)
    setTimeout(() => {
      setPhase('idle')
      setDisplayPoints(latestPoints.current)
    }, CLOSE_UP_MS)
  }

  const pct = goal > 0 ? Math.min(100, (displayPoints / goal) * 100) : 0
  const keyMoment = phase === 'key'
  // While the key is on its way its lock isn't gold yet.
  const have = keyMoment ? Math.max(0, chest.have - keysWon) : chest.have
  const ready = !keyMoment && chest.ready
  const near = goal > 0 && pct / 100 >= NEAR_FROM && !keyMoment
  const tier = CHESTS[chest.chest]

  return (
    <div
      data-ink="panel"
      data-side={side}
      className={clsx(
        barClass(),
        // Above Get Ready!'s faded board (z-55), under the stars flying in (z-60). Only to be
        // seen: a tap on it goes through to the board, where it ends Get Ready!, rather than
        // opening the class list or a settings window under the faded board.
        lifted && 'pointer-events-none z-[56]',
      )}
    >
      {leading}

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
                keyMoment && 'animate-[spin_0.8s_linear_infinite]',
              )}
              style={{ left: -13, top: -13 }}
            />
          </div>
        </div>
      </div>

      {/* The key this goal wins, waiting at the end of the track: it bobs as the class gets near.
          Hidden while the big one is on the board. */}
      <KeyPicture
        className={clsx('h-[18px] w-9 shrink-0', near ? 'quest-key-near' : 'opacity-50')}
        style={{ visibility: keyMoment ? 'hidden' : undefined }}
      />

      {/* The Quest's chest, with a little key for each lock. A tap opens Our Quest, or opens the
          chest once every lock is gold; then it rattles until the teacher is ready. */}
      <button
        type="button"
        onClick={onTapChest}
        title={ready ? `Open the ${tier.name} chest` : `Our Quest: ${tier.name} chest, ${have} of ${chest.need} keys`}
        data-guide="quest-chest"
        className="flex shrink-0 flex-col items-center gap-px rounded-xl px-1 transition-transform active:scale-90"
      >
        <div ref={chestRef} data-quest-chest="" className={clsx(ready && 'meter-chest-rattle')}>
          <div key={clicks} className={clicks ? 'quest-chest-click' : undefined}>
            <ChestPicture chest={chest.chest} keys={have} className="h-[33px] w-[38px]" />
          </div>
        </div>
        <KeyPips need={chest.need} have={have} className="h-2" />
      </button>

      <span
        key={displayPoints}
        className="count-pop shrink-0 font-bold tabular-nums text-foreground"
        style={{ fontSize: 'clamp(0.85rem, 1.6vmin, 1.1rem)' }}
      >
        {displayPoints} / {goal}
      </span>

      {keyMoment && <KeyMoment count={keysWon} target={() => chestRef.current} onLanded={keyLanded} />}
    </div>
  )
}
