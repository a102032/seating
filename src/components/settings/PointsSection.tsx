import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../../lib/assets'
import { CELEBRATION_GIFS, gifThumbUrl } from '../../lib/celebrationGifs'
import { goalIsLive, pointsModeOf } from '../../lib/points'
import type { ClassData, PointsMode } from '../../types'
import { Btn, NumberStepper, Tick } from './parts'

interface PointsSectionProps {
  activeClass: ClassData
  /** A class goal, student points, or none (asks first when that clears students' stars). */
  onSetPointsMode: (mode: PointsMode) => void
  onSetStarsOnDesks: (on: boolean) => void
  onSetGoal: (goal: number) => void
  onSetCelebrationGif: (gifId: string) => void
  onSetClassPoints: (points: number) => void
  onAskEmptyMeter: () => void
  onAskClearStars: () => void
  /** The celebration's pictures are up, in place of the section (with Back). */
  choosingGif: boolean
  onChoosingGif: (choosing: boolean) => void
}

const chestClosed = assetUrl('/treasure/chest-closed.svg')
const chestOpen = assetUrl('/treasure/chest-open.svg')

/** A desk as the board draws it, rounded at the top, with or without a star. */
function MiniDesk({ star }: { star: boolean }) {
  return (
    <svg viewBox="0 0 28 24" className="h-6 w-7 shrink-0" aria-hidden>
      <path d="M2 9 Q2 3 8 3 H20 Q26 3 26 9 V22 H2 Z" fill="var(--card)" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.6" />
      {star && (
        <path
          d="M20 4.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"
          fill="#fbbf24"
          stroke="#b45309"
          strokeWidth="0.6"
        />
      )}
    </svg>
  )
}

const MODES: { mode: PointsMode; label: string; says: string }[] = [
  { mode: 'goal', label: 'Class Goal', says: 'All points go to the class goal.' },
  { mode: 'students', label: 'Student Points (No Goal)', says: 'Each student keeps their own stars, on their desk, until you clear them.' },
  { mode: 'none', label: 'No Points', says: 'No stars. The pickers, the cards, groups and Get Ready! still work.' },
]

/** How long after the last tap the goal is written: holding − or + would otherwise save it forty times a second. */
const COMMIT_DELAY_MS = 400

/**
 * How the class earns stars, then only what the chosen way needs. "Stars for 1 class point" went
 * (2026-10-11, the teacher: a bigger goal is the same challenge), so the goal is the one number
 * that sets how hard the chest is to fill.
 */
export function PointsSection({
  activeClass,
  onSetPointsMode,
  onSetStarsOnDesks,
  onSetGoal,
  onSetCelebrationGif,
  onSetClassPoints,
  onAskEmptyMeter,
  onAskClearStars,
  choosingGif,
  onChoosingGif,
}: PointsSectionProps) {
  const mode = pointsModeOf(activeClass)
  const goalOn = goalIsLive(activeClass)
  const onDesks = activeClass.starsOnDesks === true

  // The goal as it is being changed, written a moment after the last tap; seeded as the section
  // opens, so a write landing mid-edit can't feed back into the box being used.
  const [goal, setGoal] = useState(() => activeClass.pointsGoal || 50)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(goal)
  const save = useRef(onSetGoal)
  useEffect(() => {
    save.current = onSetGoal
  })
  useEffect(() => {
    setGoal(activeClass.pointsGoal || 50)
    // Only another class reseeds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass.id])
  // An edit isn't lost to the window closing or another section.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        save.current(latest.current)
      }
    },
    [],
  )
  function changeGoal(next: number) {
    setGoal(next)
    latest.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      save.current(latest.current)
    }, COMMIT_DELAY_MS)
  }

  if (choosingGif) {
    const chosen = activeClass.celebrationGifId ?? ''
    return (
      <>
        <div className="cs-page-head">
          <h2 className="m-0 text-xl font-bold">Celebration</h2>
          <p>What fills the board when the class fills the chest.</p>
          <div className="cs-right">
            <Btn small onClick={() => onChoosingGif(false)}>
              <ChevronLeft /> Back
            </Btn>
          </div>
        </div>
        <div className="cs-pics cs-gifs">
          <button
            type="button"
            className="cs-pic"
            aria-pressed={chosen === ''}
            onClick={() => {
              onSetCelebrationGif('')
              onChoosingGif(false)
            }}
          >
            <span className="cs-gif-tile bg-amber-50 p-1.5">
              <img src={chestOpen} alt="" className="!object-contain" />
            </span>
            {chosen === '' && <Tick />}
            <span className="w-full truncate">Treasure</span>
          </button>
          {CELEBRATION_GIFS.map((g) => (
            <button
              key={g.id}
              type="button"
              className="cs-pic"
              aria-pressed={chosen === g.id}
              onClick={() => {
                onSetCelebrationGif(g.id)
                onChoosingGif(false)
              }}
            >
              <span className="cs-gif-tile">
                <img src={gifThumbUrl(g.id)} alt="" loading="lazy" />
              </span>
              {chosen === g.id && <Tick />}
              <span className="w-full truncate">{g.label}</span>
            </button>
          ))}
        </div>
      </>
    )
  }

  const gif = CELEBRATION_GIFS.find((g) => g.id === activeClass.celebrationGifId)
  const deskStars = activeClass.students.reduce((n, s) => n + (s.points ?? 0), 0)
  const goalNow = activeClass.pointsGoal || goal
  return (
    <>
      <div className="cs-page-head">
        <p>How your class earns stars.</p>
      </div>
      <div data-guide="points-choice">
        <div className="cs-choices">
          {MODES.map((m) => (
            <button key={m.mode} type="button" className="cs-choice" aria-pressed={mode === m.mode} onClick={() => onSetPointsMode(m.mode)}>
              {m.mode === 'goal' ? (
                <img src={chestClosed} alt="" className="h-6 w-6 shrink-0" />
              ) : (
                <MiniDesk star={m.mode === 'students'} />
              )}
              {m.label}
              {mode === m.mode && <Tick />}
            </button>
          ))}
        </div>
        <p className="cs-hint" style={{ margin: '6px 2px 0' }}>
          {MODES.find((m) => m.mode === mode)?.says}
        </p>
      </div>

      {goalOn && (
        <div className="cs-group">
          <div className="cs-row" data-guide="stars-row">
            <div className="cs-row-label">
              <b>Stars</b>
              <small>
                {onDesks ? 'Stars wait on desks until you put them into the goal.' : 'A star flies into the goal the moment you give it.'}
              </small>
            </div>
            <div className="cs-choices" style={{ flex: '0 1 22rem' }}>
              <button type="button" className="cs-choice" aria-pressed={!onDesks} onClick={() => onSetStarsOnDesks(false)}>
                Straight to the goal
                {!onDesks && <Tick />}
              </button>
              <button type="button" className="cs-choice" aria-pressed={onDesks} onClick={() => onSetStarsOnDesks(true)}>
                On the desks first
                {onDesks && <Tick />}
              </button>
            </div>
          </div>
          <div className="cs-row" data-guide="goal-row">
            <div className="cs-row-label">
              <b>Goal</b>
              <small>Set the goal for your class: how many stars are needed to fill the chest.</small>
            </div>
            {/* A class whose goal was multiplied when the stars' rate went may be past 999. */}
            <NumberStepper value={goal} min={1} max={Math.max(999, activeClass.pointsGoal ?? 0)} label="Goal" onChange={changeGoal} />
          </div>
          <div className="cs-row" data-guide="celebration-row">
            <div className="cs-row-label">
              <b>Celebration</b>
              <small>Pick a celebration animation when the class achieves their goal.</small>
            </div>
            <Btn onClick={() => onChoosingGif(true)}>
              <img src={gif ? gifThumbUrl(gif.id) : chestOpen} alt="" className="h-6 w-6 rounded object-cover" />
              {gif?.label ?? 'Treasure chest'} <ChevronRight />
            </Btn>
          </div>
          {/* The one place the meter can be corrected: a point that landed by mistake had no way
              back short of starting the meter again. Held to the goal; never opens the chest. */}
          <div className="cs-row" data-guide="meter-row">
            <div className="cs-row-label">
              <b>Number of stars currently on the class goal meter</b>
              <small>Fix a point given by mistake.</small>
            </div>
            <NumberStepper
              value={Math.min(goalNow, activeClass.classPoints ?? 0)}
              min={0}
              max={goalNow}
              label="Stars on the meter"
              onChange={onSetClassPoints}
            />
            <Btn kind="quiet-red" small disabled={(activeClass.classPoints ?? 0) === 0} onClick={onAskEmptyMeter}>
              <RotateCcw /> Empty
            </Btn>
          </div>
        </div>
      )}

      {/* Student points stay until the teacher clears them - never on a clock - so the teacher
          decides whether a week or a term is over. */}
      {mode === 'students' && (
        <div className="cs-group">
          <div className="cs-row" data-guide="clear-stars">
            <div className="cs-row-label">
              <b>Clear All Stars</b>
              <small>Everyone back to 0, at the end of a week or a term. A student&rsquo;s stars can be fixed in Students.</small>
            </div>
            <Btn kind="red" disabled={deskStars === 0} onClick={onAskClearStars}>
              <RotateCcw /> Clear All Stars
            </Btn>
          </div>
        </div>
      )}
    </>
  )
}
