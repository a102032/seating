import { ChevronLeft, ChevronRight, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../../lib/assets'
import { CELEBRATION_GIFS, gifThumbUrl } from '../../lib/celebrationGifs'
import { goalIsLive, pointsModeOf } from '../../lib/points'
import { lastKeyTook, prizeId, prizesOf, questOf, SIZE_NAMES } from '../../lib/quest'
import type { ClassData, PointsMode, PrizeSize, QuestPrize } from '../../types'
import { PrizeIcon } from '../quest/QuestPictures'
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
  onSetPrizes: (prizes: QuestPrize[]) => void
  /** The celebration's pictures, or the prize list, are up in place of the section (with Back). */
  choosingGif: boolean
  onChoosingGif: (choosing: boolean) => void
  editingPrizes: boolean
  onEditingPrizes: (editing: boolean) => void
}

const PRIZE_SIZES: { size: PrizeSize; says: string }[] = [
  { size: 's', says: 'Plain slices' },
  { size: 'm', says: 'Silver slices' },
  { size: 'b', says: 'Gold slices' },
]

/**
 * The class's prizes for the Quest's wheels (DECISIONS, "Treasure Quest"): one list, each prize
 * small, medium or big. Each chest's wheel is built from it by the agreed odds, so a teacher
 * never sets up a wheel. A prize's name is typed (a board brings up its own keyboard, and this is
 * set up ahead, at a desk); its picture is chosen from the name.
 */
function PrizeList({ prizes, onSetPrizes, onBack }: { prizes: QuestPrize[]; onSetPrizes: (p: QuestPrize[]) => void; onBack: () => void }) {
  const [typed, setTyped] = useState<Record<PrizeSize, string>>({ s: '', m: '', b: '' })
  function add(size: PrizeSize) {
    const name = typed[size].trim()
    if (!name) return
    onSetPrizes([...prizes, { id: prizeId(), name, size }])
    setTyped((t) => ({ ...t, [size]: '' }))
  }
  return (
    <>
      <div className="cs-page-head">
        <h2 className="m-0 text-xl font-bold">Prizes</h2>
        <p>What the wheel in each chest can give. Better chests have more silver and gold.</p>
        <div className="cs-right">
          <Btn small onClick={onBack}>
            <ChevronLeft /> Back
          </Btn>
        </div>
      </div>
      <div className="cs-prizes">
        {PRIZE_SIZES.map(({ size, says }) => {
          const mine = prizes.filter((p) => p.size === size)
          return (
            <div key={size} className={`cs-prize-col cs-prize-${size}`} data-guide={`prizes-${size}`}>
              <div className="cs-prize-head">
                <b>{SIZE_NAMES[size]}</b>
                <small>{says}</small>
              </div>
              <div className="cs-prize-list">
                {mine.map((p) => (
                  <div key={p.id} className="cs-prize-row">
                    <PrizeIcon name={p.name} size={18} className="cs-prize-ic" />
                    <span className="min-w-0 flex-1 break-words">{p.name}</span>
                    <button
                      type="button"
                      className="cs-icon-btn !h-8 !w-8"
                      aria-label={`Take out ${p.name}`}
                      title="Take it out"
                      // A wheel needs something to give: the last prize of all stays.
                      disabled={prizes.length <= 1}
                      onClick={() => onSetPrizes(prizes.filter((x) => x.id !== p.id))}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <form
                className="flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  add(size)
                }}
              >
                <input
                  className="cs-box min-w-0 flex-1"
                  value={typed[size]}
                  maxLength={40}
                  placeholder="New prize"
                  aria-label={`New ${SIZE_NAMES[size].toLowerCase()} prize`}
                  onChange={(e) => setTyped((t) => ({ ...t, [size]: e.target.value }))}
                />
                <Btn small type="submit" disabled={!typed[size].trim()} aria-label="Add">
                  <Plus /> Add
                </Btn>
              </form>
            </div>
          )
        })}
      </div>
    </>
  )
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
  onSetPrizes,
  choosingGif,
  onChoosingGif,
  editingPrizes,
  onEditingPrizes,
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

  if (editingPrizes) return <PrizeList prizes={prizesOf(activeClass)} onSetPrizes={onSetPrizes} onBack={() => onEditingPrizes(false)} />

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
  const prizes = prizesOf(activeClass)
  const tookLine = lastKeyTook(questOf(activeClass))
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
              <small>How many stars fill the meter and win a key.{tookLine && <b className="cs-took"> {tookLine}</b>}</small>
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
          <div className="cs-row" data-guide="prizes-row">
            <div className="cs-row-label">
              <b>Prizes</b>
              <small>What the wheel in each chest can give.</small>
            </div>
            <Btn onClick={() => onEditingPrizes(true)}>
              {(['s', 'm', 'b'] as const)
                .map((size) => `${prizes.filter((p) => p.size === size).length} ${SIZE_NAMES[size].toLowerCase()}`)
                .join(', ')}
              <ChevronRight />
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
