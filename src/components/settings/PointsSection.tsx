import { ChevronLeft, ChevronRight, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../../lib/assets'
import { CELEBRATION_GIFS, gifThumbUrl } from '../../lib/celebrationGifs'
import { goalIsLive, pointsModeOf } from '../../lib/points'
import {
  CHESTS,
  keysNeeded,
  lastKeyWords,
  PRIZE_NAME_MAX,
  prizesOf,
  questOf,
  SIZE_NAMES,
  type PrizeSize,
  type QuestPrize,
} from '../../lib/quest'
import { chestSVG, prizeIconSVG } from '../../lib/questArt'
import { adventureOf, CAPACITY, jarFill, jarOf, lastSpinWords, type Adventure } from '../../lib/marbles'
import { marbleSVG } from '../../lib/marbleArt'
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
  /** The Quest's prize list, each prize small, medium or big. */
  onSetQuestPrizes: (prizes: QuestPrize[]) => void
  /** Start the quest over from the Wood chest, or the Marble Jar from an empty jar (asks first). */
  onAskRestartQuest: () => void
  /** The Class Quest's adventure: the Knight's chests or the Marble Jar. */
  onSetAdventure: (adventure: Adventure) => void
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
  { mode: 'quest', label: 'Class Quest', says: 'Fill the goal to win a key. Keys open five chests, and each chest has a prize wheel.' },
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
  onSetQuestPrizes,
  onAskRestartQuest,
  onSetAdventure,
}: PointsSectionProps) {
  const [choosingPrizes, setChoosingPrizes] = useState(false)
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

  if (choosingPrizes && mode === 'quest') {
    return <PrizesPage prizes={prizesOf(activeClass)} onChange={onSetQuestPrizes} onBack={() => setChoosingPrizes(false)} />
  }

  if (choosingGif) {
    const chosen = activeClass.celebrationGifId ?? ''
    return (
      <>
        <div className="cs-page-head">
          <h2 className="m-0 text-xl font-bold">Celebration</h2>
          <p>
            {mode === 'quest'
              ? 'What dances beside the prize when the wheel stops.'
              : 'What fills the board when the class fills the chest.'}
          </p>
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
              ) : m.mode === 'quest' ? (
                <span
                  className="block h-6 w-7 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: chestSVG(2, { keys: 1 }) }}
                />
              ) : (
                <MiniDesk star={m.mode === 'students'} />
              )}
              {m.label}
              {mode === m.mode && <Tick />}
            </button>
          ))}
        </div>
        <p className="cs-hint" style={{ margin: '6px 2px 0' }}>
          {mode === 'quest' && adventureOf(activeClass) === 'marbles'
            ? 'Fill the goal to spin the marble wheel. The marbles fill the class jar, and a full jar has a prize wheel.'
            : mode === 'quest' && adventureOf(activeClass) === 'pirate'
              ? 'Fill the goal to win a piece of the next island’s map. A whole map shows where to dig for treasure.'
              : MODES.find((m) => m.mode === mode)?.says}
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
              <small>
                {mode === 'quest' && adventureOf(activeClass) === 'marbles'
                  ? 'How many stars win a spin. About a spin a week fills a jar in a semester.'
                  : mode === 'quest' && adventureOf(activeClass) === 'pirate'
                    ? 'How many stars win a map piece. A quest is 20 pieces: about one a week takes a semester.'
                    : mode === 'quest'
                      ? 'How many stars win a key. About a key a week makes a quest a semester.'
                      : 'Set the goal for your class: how many stars are needed to fill the chest.'}
              </small>
            </div>
            {/* A class whose goal was multiplied when the stars' rate went may be past 999. */}
            <NumberStepper value={goal} min={1} max={Math.max(999, activeClass.pointsGoal ?? 0)} label="Goal" onChange={changeGoal} />
          </div>
          {mode === 'quest' ? (
            <div className="cs-row" data-guide="prizes-row">
              <div className="cs-row-label">
                <b>Prizes</b>
                <small>
                  {adventureOf(activeClass) === 'marbles'
                    ? 'What a full jar can win, and the GIF beside a prize.'
                    : 'What the chests hold, and the GIF beside a prize.'}
                </small>
              </div>
              <Btn onClick={() => setChoosingPrizes(true)}>
                {prizesOf(activeClass).length} prizes <ChevronRight />
              </Btn>
              <Btn onClick={() => onChoosingGif(true)} title="Celebration">
                <img src={gif ? gifThumbUrl(gif.id) : chestOpen} alt="" className="h-6 w-6 rounded object-cover" />
                {gif?.label ?? 'No GIF'} <ChevronRight />
              </Btn>
            </div>
          ) : (
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
          )}
          {/* The one place the meter can be corrected: a point that landed by mistake had no way
              back short of starting the meter again. Held to the goal; never opens the chest. */}
          <div className="cs-row" data-guide="meter-row">
            <div className="cs-row-label">
              <b>{mode === 'quest' ? 'Stars on the meter now' : 'Number of stars currently on the class goal meter'}</b>
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
          {mode === 'quest' && <QuestRow activeClass={activeClass} onAskRestart={onAskRestartQuest} onSetAdventure={onSetAdventure} />}
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

/**
 * The quest's adventure, where the class is on it, how long the last key or spin took (to help set
 * the goal), and Start Over. Three adventures, one row: the Knight's keys and chests, the Marble Jar
 * (2026-10-24), or the Pirate Quest's islands and map pieces (2026-10-25). Each keeps its own place,
 * so trying another loses nothing.
 */
function QuestRow({
  activeClass,
  onAskRestart,
  onSetAdventure,
}: {
  activeClass: ClassData
  onAskRestart: () => void
  onSetAdventure: (a: Adventure) => void
}) {
  const adventure = adventureOf(activeClass)
  const q = questOf(activeClass)
  const T = CHESTS[q.chest]
  const need = keysNeeded(q)
  const j = jarOf(activeClass)
  const fresh =
    adventure === 'marbles' ? j.number === 1 && j.marbles.length === 0 && j.spins === 0 : q.number === 1 && q.chest === 0 && q.keys === 0
  const full = Math.min(100, Math.round((jarFill(j) / CAPACITY) * 100))
  return (
    <div className="cs-row" data-guide="quest-row">
      <div className="cs-row-label">
        <b>
          {adventure === 'marbles'
            ? `${j.number > 1 ? `Jar ${j.number}: ` : 'The jar: '}${full}% full`
            : adventure === 'pirate'
              ? `${q.number > 1 ? `Quest ${q.number}: ` : ''}Island ${q.chest + 1}, ${Math.min(q.keys, need)} of ${need} pieces`
              : `${q.number > 1 ? `Quest ${q.number}: ` : ''}${T.name} chest, ${Math.min(q.keys, T.keys)} of ${T.keys} ${T.keys === 1 ? 'key' : 'keys'}`}
        </b>
        <small>{adventure === 'marbles' ? lastSpinWords(j) : lastKeyWords(q)}</small>
      </div>
      {/* Each on one line: wrapped, "Marble Jar" made the row taller and Points ran past the window's edge at 1024x500. */}
      <div className="cs-choices whitespace-nowrap" data-guide="adventure-row" style={{ flex: '0 0 auto' }}>
        <button type="button" className="cs-choice" aria-pressed={adventure === 'knight'} onClick={() => onSetAdventure('knight')}>
          <img src={assetUrl('/quest/knight-head.svg')} alt="" className="h-6 w-6 shrink-0" />
          Knight
          {adventure === 'knight' && <Tick />}
        </button>
        <button type="button" className="cs-choice" aria-pressed={adventure === 'marbles'} onClick={() => onSetAdventure('marbles')}>
          <svg
            viewBox="-12 -12 24 24"
            className="h-6 w-6 shrink-0"
            aria-hidden
            dangerouslySetInnerHTML={{ __html: marbleSVG('#2b9be0', { r: 10 }) }}
          />
          Marble Jar
          {adventure === 'marbles' && <Tick />}
        </button>
        <button type="button" className="cs-choice" aria-pressed={adventure === 'pirate'} onClick={() => onSetAdventure('pirate')}>
          <img src={assetUrl('/quest/pirate/parrot.svg')} alt="" className="h-6 w-6 shrink-0" />
          Pirate
          {adventure === 'pirate' && <Tick />}
        </button>
      </div>
      <Btn kind="quiet-red" small disabled={fresh} onClick={onAskRestart}>
        <RotateCcw /> Start Over
      </Btn>
    </div>
  )
}

const SIZES: PrizeSize[] = ['s', 'm', 'b']
const SIZE_SAYS: Record<PrizeSize, string> = {
  s: 'Plain slices. Most of the Wood and Bronze wheels.',
  m: 'Silver slices, on every wheel but the Mega.',
  b: 'Gold slices, from the Silver chest. The Mega chest is all gold.',
}

/**
 * The prize list, in place of the section (as the celebration's pictures are), with Back: three
 * columns, small, medium and big. A prize is typed, since a list is made ahead at a desk; only a
 * column's list scrolls.
 */
function PrizesPage({ prizes, onChange, onBack }: { prizes: QuestPrize[]; onChange: (p: QuestPrize[]) => void; onBack: () => void }) {
  const [drafts, setDrafts] = useState<Record<PrizeSize, string>>({ s: '', m: '', b: '' })
  function add(size: PrizeSize) {
    const name = drafts[size].trim().slice(0, PRIZE_NAME_MAX)
    if (!name) return
    onChange([...prizes, { name, size }])
    setDrafts((d) => ({ ...d, [size]: '' }))
  }
  return (
    <>
      <div className="cs-page-head">
        <h2 className="m-0 text-xl font-bold">Prizes</h2>
        <p>The wheels are made from these. Whole-class activities work best.</p>
        <div className="cs-right">
          <Btn small onClick={onBack}>
            <ChevronLeft /> Back
          </Btn>
        </div>
      </div>
      <div className="cs-prizes">
        {SIZES.map((size) => {
          const list = prizes.map((p, i) => ({ p, i })).filter(({ p }) => p.size === size)
          return (
            <div key={size} className="cs-prize-col" data-size={size}>
              <b>{SIZE_NAMES[size]}</b>
              <small>{SIZE_SAYS[size]}</small>
              <ul className="cs-prize-list">
                {list.map(({ p, i }) => (
                  <li key={`${i}-${p.name}`}>
                    <span className="cs-prize-ic" dangerouslySetInnerHTML={{ __html: prizeIconSVG(p.name) }} />
                    <span className="min-w-0 flex-1 break-words">{p.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${p.name}`}
                      title="Remove"
                      onClick={() => onChange(prizes.filter((_, k) => k !== i))}
                    >
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="cs-prize-add"
                onSubmit={(e) => {
                  e.preventDefault()
                  add(size)
                }}
              >
                <input
                  value={drafts[size]}
                  maxLength={PRIZE_NAME_MAX}
                  placeholder="A new prize"
                  aria-label={`A new ${SIZE_NAMES[size].toLowerCase()} prize`}
                  onChange={(e) => setDrafts((d) => ({ ...d, [size]: e.target.value }))}
                />
                <Btn small type="submit" disabled={!drafts[size].trim()} aria-label={`Add a ${SIZE_NAMES[size].toLowerCase()} prize`}>
                  <Plus />
                </Btn>
              </form>
            </div>
          )
        })}
      </div>
    </>
  )
}
