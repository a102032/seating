import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { assetUrl } from '../lib/assets'
import { CHESTS, type ChestNow } from '../lib/quest'
import { playCoinTick, playFootstep } from '../lib/sound'
import { landingIsLoud, landingIsSilent, starsLandingIn } from '../lib/starFlight'
import { barClass } from '../lib/topBar'
import { KeyMoment } from './quest/KeyMoment'
import { ChestPicture, KeyPicture, KeyPips } from './quest/QuestPictures'
import { QuestRoad, type RoadGeometry, type RoadMotion } from './quest/QuestRoad'

interface PointsMeterProps {
  classId: string
  classPoints: number
  goal: number
  /** Times the goal has been filled. A rise here is a key won for the Quest. */
  goalsReached: number
  /** The Quest's chest the class is on, at the bar's end, and how many of its locks are gold. */
  chest: ChestNow
  /** Keys won this quest, all of them: which stretch of road the knight is on. */
  questKeys: number
  /** The map at the bar's start: Our Quest slides over the board. */
  onTapMap: () => void
  /** The chest: it opens when every lock is gold; otherwise the goal's settings, in Points. */
  onTapChest: () => void
  /** The key moment and the roll on to the next key are over (or there was none): the board is calm. */
  onSettled?: () => void
  /**
   * The app isn't in front of the class - the goal was filled from the floating window, over a
   * lesson, where the key dropped into the window's own chest. The key moment doesn't play again
   * here: the lock is gold and the land rolls on.
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

/** How long the knight takes to walk to where the stars put him, and the land to roll on after a key. */
const WALK_MS = 2400
const ROLL_MS = 3200
/** One footstep each way the knight sways. */
const STEP_MS = 420
/** How full the meter has to get before the key at its end starts bobbing. */
const NEAR_FROM = 0.85

const treasure = (name: string) => assetUrl(`/treasure/${name}.svg`)

/**
 * The class goal, as a strip of the quest's map (2026-10-13, the teacher's design; lib/questRoad).
 * The knight is the class: each star walks him on toward the key at the bar's end, slowly, with
 * soft footsteps, while the land slides the other way. The key won goes into the chest past it by
 * itself, and the land rolls on to the next stretch with a new key ahead. A tap on the map at the
 * bar's start opens Our Quest; a tap on the chest opens the goal's settings, or the chest itself
 * once every lock is gold.
 *
 * Everything that moves is a CSS transform or `element.animate`, which the graphics chip runs, and
 * nothing here changes the row's height.
 */
export function PointsMeter({
  classId,
  classPoints,
  goal,
  goalsReached,
  chest,
  questKeys,
  onTapMap,
  onTapChest,
  onSettled,
  holdKeyMoment,
  lifted = false,
  leading,
  side,
}: PointsMeterProps) {
  const prevRef = useRef<{ classId: string; value: number; reached: number } | null>(null)
  const chestRef = useRef<HTMLDivElement>(null)
  // 'arriving' is the knight walking up to the key; 'key' the key moment; 'rolling' the land
  // going on to the next stretch.
  const [phase, setPhase] = useState<'idle' | 'arriving' | 'key' | 'rolling'>('idle')
  const [keysWon, setKeysWon] = useState(1)
  /** Bumped as a key lands, so the chest gives its click and wiggle. */
  const [clicks, setClicks] = useState(0)
  const [motion, setMotion] = useState<RoadMotion>('none')
  const [walking, setWalking] = useState(false)
  const holdRef = useRef(holdKeyMoment)
  const phaseRef = useRef(phase)
  const settledRef = useRef(onSettled)
  /** The meter's real total, for picking up once the key is in. */
  const latestPoints = useRef(classPoints)
  useEffect(() => {
    holdRef.current = holdKeyMoment
    phaseRef.current = phase
    latestPoints.current = classPoints
    settledRef.current = onSettled
  })
  // Normally mirrors classPoints, but holds at full through the key moment so the knight stays at
  // the key until it is in.
  const [displayPoints, setDisplayPoints] = useState(classPoints)

  /** Timers: meter moves waiting for a star still in the air (lib/starFlight), and the walk's steps. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t)
      fn()
    }, ms)
    timers.current.push(t)
  }
  const steps = useRef<ReturnType<typeof setInterval> | null>(null)
  const walkEnd = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      if (steps.current) clearInterval(steps.current)
      if (walkEnd.current) clearTimeout(walkEnd.current)
    },
    [],
  )

  /** The knight walks for a while: his sway, and a footstep each way, unless the stars came in silent. */
  function walk(ms: number, kind: RoadMotion, quiet = false) {
    setMotion(kind)
    setWalking(true)
    if (steps.current) clearInterval(steps.current)
    if (walkEnd.current) clearTimeout(walkEnd.current)
    if (!quiet && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      playFootstep()
      steps.current = setInterval(playFootstep, STEP_MS)
    }
    walkEnd.current = setTimeout(() => {
      setWalking(false)
      if (steps.current) clearInterval(steps.current)
      steps.current = null
    }, ms)
  }

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { classId, value: classPoints, reached: goalsReached }
    if (!prev || prev.classId !== classId) {
      timers.current.forEach(clearTimeout)
      timers.current = []
      setDisplayPoints(classPoints)
      setPhase('idle')
      setMotion('none')
      return
    }

    // A point from a desk sends a star flying to the knight first: he walks, the coin sounds and a
    // filled goal wins its key as it lands, not while it is still on the desk.
    const wait = classPoints > prev.value || goalsReached > prev.reached ? starsLandingIn() : 0
    if (wait > 0) later(wait, () => land(prev))
    else land(prev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, classPoints, goal, goalsReached])

  function land(prev: { value: number; reached: number }) {
    const silent = landingIsSilent()
    const sound = () => {
      if (!silent) playCoinTick(landingIsLoud())
    }
    // A key is already on its way: the knight stays at the key until it is in, and what landed
    // meanwhile is picked up then. A second goal filled meanwhile is one more key in the same moment.
    if (phaseRef.current === 'arriving' || phaseRef.current === 'key') {
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
        // simply gold, and the land rolls on.
        setClicks((n) => n + 1)
        setDisplayPoints(classPoints)
        setPhase('rolling')
        walk(ROLL_MS, 'roll', true)
        later(ROLL_MS, settle)
        return
      }
      // The knight walks up to the key, and then it is his.
      setKeysWon(goalsReached - prev.reached)
      setDisplayPoints(goal)
      setPhase('arriving')
      walk(WALK_MS, 'move', silent)
      later(WALK_MS, () => setPhase('key'))
      return
    }

    // A fall without a fill is a reset or a correction: the knight just goes back, quietly.
    if (classPoints < prev.value) {
      setMotion('move')
      setDisplayPoints(classPoints)
      return
    }

    if (classPoints > prev.value) {
      setDisplayPoints(classPoints)
      walk(WALK_MS, 'move', silent)
      sound()
    }
  }

  /** The key is in: the lock turns gold and the land rolls on to the next stretch, with the new run. */
  function keyLanded() {
    setClicks((n) => n + 1)
    setPhase('rolling')
    setDisplayPoints(latestPoints.current)
    walk(ROLL_MS, 'roll')
    later(ROLL_MS, settle)
  }

  function settle() {
    setPhase('idle')
    settledRef.current?.()
  }

  // Where things are in the bar, for the land and the knight: measured, and again when it resizes
  // (a screen change, or the put-away clock coming and going at its start).
  const barRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLButtonElement>(null)
  const roadRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const chestButtonRef = useRef<HTMLButtonElement>(null)
  const [geo, setGeo] = useState<RoadGeometry | null>(null)
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const measure = () => {
      const b = bar.getBoundingClientRect()
      const road = roadRef.current?.getBoundingClientRect()
      const map = mapRef.current?.getBoundingClientRect()
      const end = chestButtonRef.current?.getBoundingClientRect()
      const count = countRef.current?.getBoundingClientRect()
      if (!b.width || !road || !map || !end || !count) return
      const next: RoadGeometry = {
        width: Math.round(b.width),
        x0: Math.round(road.left - b.left + 18),
        x1: Math.round(road.right - b.left - 4),
        mapX: Math.round((map.left + map.right) / 2 - b.left),
        endL: Math.round(end.left - b.left),
        endR: Math.round(count.right - b.left),
      }
      setGeo((g) => (g && Object.entries(next).every(([k, v]) => g[k as keyof RoadGeometry] === v) ? g : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    if (roadRef.current) ro.observe(roadRef.current)
    void document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [])

  const keyMoment = phase === 'key'
  const waiting = phase === 'arriving' || phase === 'key'
  const p = goal > 0 ? Math.min(1, Math.max(0, displayPoints / goal)) : 0
  // While the key is on its way its lock isn't gold yet, and the knight is still on its stretch.
  const have = waiting ? Math.max(0, chest.have - keysWon) : chest.have
  const k = Math.max(0, questKeys - (waiting ? keysWon : 0))
  const ready = phase === 'idle' && chest.ready
  const near = p >= NEAR_FROM && !waiting
  const tier = CHESTS[chest.chest]
  const knightX = geo ? geo.x0 + p * (geo.x1 - geo.x0) - 18 : 0
  const timing = motion === 'move' ? 'quest-road-move' : motion === 'roll' ? 'quest-road-roll' : undefined

  return (
    <div
      ref={barRef}
      data-ink="panel"
      data-side={side}
      data-quest-road=""
      className={clsx(
        barClass(),
        'isolate',
        // Above Get Ready!'s faded board (z-55), under the stars flying in (z-60). Only to be
        // seen: a tap on it goes through to the board, where it ends Get Ready!, rather than
        // opening the class list or a settings window under the faded board.
        lifted && 'pointer-events-none z-[56]',
      )}
    >
      <QuestRoad k={k} p={p} geo={geo} motion={motion} />

      {leading}

      {/* Where the quest is drawn: a tap opens Our Quest. 40px, because the teacher found the map
          hard to see at 30; it still fits the 56px row. */}
      <button
        ref={mapRef}
        type="button"
        onClick={onTapMap}
        title="Our Quest"
        aria-label="Our Quest"
        data-guide="quest-map"
        className="relative h-10 w-10 shrink-0 rounded-xl transition-transform active:scale-90"
      >
        <img src={treasure('map')} alt="" draggable={false} className="h-10 w-10 select-none" />
      </button>

      {/* The knight's road: he walks it as the stars come in. */}
      <div ref={roadRef} className="h-full min-w-0 flex-1" />

      {/* The key this goal wins, waiting at the road's end: it bobs as the class gets near.
          Hidden while the big one is on the board. */}
      <KeyPicture
        className={clsx('relative h-[18px] w-9 shrink-0', near && 'quest-key-near')}
        style={{ visibility: keyMoment ? 'hidden' : undefined }}
      />

      {/* The Quest's chest, with a little key for each lock. It rattles once every lock is gold, and
          a tap then opens it; otherwise a tap opens the goal's settings. */}
      <button
        ref={chestButtonRef}
        type="button"
        onClick={onTapChest}
        title={ready ? `Open the ${tier.name} chest` : `${tier.name} chest, ${have} of ${chest.need} keys: the goal's settings`}
        data-guide="quest-chest"
        className="relative flex shrink-0 flex-col items-center gap-px rounded-xl px-1 transition-transform active:scale-90"
      >
        <div ref={chestRef} data-quest-chest="" className={clsx(ready && 'meter-chest-rattle')}>
          <div key={clicks} className={clicks ? 'quest-chest-click' : undefined}>
            <ChestPicture chest={chest.chest} keys={have} className="h-[33px] w-[38px]" />
          </div>
        </div>
        <KeyPips need={chest.need} have={have} className="h-2" />
      </button>

      <span
        ref={countRef}
        key={displayPoints}
        className="count-pop relative shrink-0 font-bold tabular-nums text-[#4a2f14]"
        style={{ fontSize: 'clamp(0.85rem, 1.6vmin, 1.1rem)' }}
      >
        {displayPoints} / {goal}
      </span>

      {/* The class, walking. Where a student's star flies to (lib/starFlight). */}
      {geo && (
        <div
          className={clsx('quest-knight pointer-events-none', timing)}
          style={{ transform: `translateX(${knightX.toFixed(1)}px)` }}
          data-quest-knight=""
        >
          <div className={clsx('quest-knight-body', walking && 'quest-knight-walk')}>
            <img src={assetUrl('/quest/knight.svg')} alt="" draggable={false} data-goal-coin="" />
          </div>
        </div>
      )}

      {keyMoment && <KeyMoment count={keysWon} target={() => chestRef.current} onLanded={keyLanded} />}
    </div>
  )
}
