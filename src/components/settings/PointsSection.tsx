import { ChevronRight, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../../lib/assets'
import { CELEBRATION_GIFS, gifThumbUrl } from '../../lib/celebrationGifs'
import { goalIsLive, pointsModeOf } from '../../lib/points'
import { PRIZE_NAME_MAX, prizesOf, type PrizeSize, type QuestPrize } from '../../lib/quest'
import { prizeIconSVG } from '../../lib/questArt'
import { CAPACITY, jarFill, jarOf, lastSpinWords } from '../../lib/marbles'
import type { ClassData, PointsMode } from '../../types'
import { Btn, Group, MoreRow, NumberStepper, SubHead, Tick } from './parts'

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
  /** The Marble Jar's prize list, each prize medium or big (the jar's wheel has no small slices). */
  onSetQuestPrizes: (prizes: QuestPrize[]) => void
  /** Start the Marble Jar again from an empty jar (asks first). */
  onAskRestartQuest: () => void
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

/**
 * From the biggest way to the simplest, left to right (2026-10-26, the teacher). The Marble Jar is
 * the Class Quest's place since the Knight, Pirate and Space quests were retired (2026-10-30): its
 * value stays 'quest' in the class's data.
 */
const MODES: { mode: PointsMode; label: string; says: string }[] = [
  { mode: 'quest', label: 'Marble Jar', says: 'Each full meter wins a spin for marbles. A full jar wins a prize.' },
  { mode: 'goal', label: 'Class Goal', says: 'The class fills the meter together. A full meter is a celebration.' },
  { mode: 'students', label: 'Student Points', says: 'Each student keeps their own stars, on their desk, until you clear them.' },
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
}: PointsSectionProps) {
  const [choosingPrizes, setChoosingPrizes] = useState(false)
  // More options: the stars' two ways, fixing the meter, and Start Over (2026-10-26).
  const [more, setMore] = useState(false)
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
        <SubHead back="Points" title="Celebration" onBack={() => onChoosingGif(false)} />
        <div className="cs-gi">
          {mode === 'quest' ? 'What dances beside the prize when the wheel stops.' : 'What fills the board when the class fills the meter.'}
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
  if (more && goalOn) {
    return (
      <>
        <SubHead back="Points" title="More options" onBack={() => setMore(false)} />
        <Group head="Stars" guide="stars-row">
          <div className="cs-row cs-stack">
            <div className="cs-choices">
              <button type="button" className="cs-choice" aria-pressed={!onDesks} onClick={() => onSetStarsOnDesks(false)}>
                Stars go straight to the goal
                {!onDesks && <Tick />}
              </button>
              <button type="button" className="cs-choice" aria-pressed={onDesks} onClick={() => onSetStarsOnDesks(true)}>
                Stars go on the desks first
                {onDesks && <Tick />}
              </button>
            </div>
            {/* Where they go from there, said where it is chosen (2026-10-26). */}
            {onDesks && <span className="cs-hint">Tap the picture at the start of the meter to send them all to the goal.</span>}
          </div>
        </Group>
        {/* The one place the meter can be corrected: a point that landed by mistake had no way back
            short of starting the meter again. Held to the goal; never opens the chest. */}
        <div className="cs-group">
          <div className="cs-row" data-guide="meter-row">
            <div className="cs-row-label">
              <b>Change the number of stars on the meter</b>
              <small>Add or take away stars given by mistake.</small>
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
          {mode === 'quest' && <RestartRow activeClass={activeClass} onAskRestart={onAskRestartQuest} />}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="cs-group" data-guide="points-choice">
        <div className="cs-row cs-stack">
          <div className="cs-choices">
            {MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                className="cs-choice"
                aria-pressed={mode === m.mode}
                onClick={() => onSetPointsMode(m.mode)}
              >
                {m.mode === 'goal' ? (
                  <img src={chestClosed} alt="" className="h-6 w-6 shrink-0" />
                ) : m.mode === 'quest' ? (
                  <img src={assetUrl('/quest/marbles.svg')} alt="" className="h-6 w-6 shrink-0" />
                ) : (
                  <MiniDesk star={m.mode === 'students'} />
                )}
                {m.label}
                {mode === m.mode && <Tick />}
              </button>
            ))}
          </div>
          <span className="cs-hint">{MODES.find((m) => m.mode === mode)?.says}</span>
        </div>
      </div>

      {goalOn && mode === 'quest' && (
        <Group head="Our Jar">
          <JarRow activeClass={activeClass} />
        </Group>
      )}

      {goalOn && (
        <div className="cs-group">
          <div className="cs-row" data-guide="goal-row">
            <div className="cs-row-label">
              <b>Goal</b>
              <small>Number of stars needed to fill the meter.</small>
            </div>
            {/* A class whose goal was multiplied when the stars' rate went may be past 999. */}
            <NumberStepper value={goal} min={1} max={Math.max(999, activeClass.pointsGoal ?? 0)} label="Goal" onChange={changeGoal} />
          </div>
          {mode === 'quest' && (
            <div className="cs-row" data-guide="prizes-row">
              <div className="cs-row-label">
                <b>Prizes</b>
                <small>Set real custom rewards the class can win on the prize wheel.</small>
              </div>
              <Btn onClick={() => setChoosingPrizes(true)}>
                {prizesOf(activeClass).length} prizes <ChevronRight />
              </Btn>
            </div>
          )}
          <div className="cs-row" data-guide="celebration-row">
            <div className="cs-row-label">
              <b>Celebration</b>
              <small>
                {mode === 'quest'
                  ? 'Pick a celebration animation to play on the board when the class wins a prize.'
                  : 'Pick a celebration animation to play on the board when the class fills the meter.'}
              </small>
            </div>
            <Btn onClick={() => onChoosingGif(true)}>
              <img src={gif ? gifThumbUrl(gif.id) : chestOpen} alt="" className="h-6 w-6 rounded object-cover" />
              {gif?.label ?? (mode === 'quest' ? 'No GIF' : 'Treasure chest')} <ChevronRight />
            </Btn>
          </div>
        </div>
      )}

      {goalOn && (
        <MoreRow
          inside={`Stars on the desks first, change the stars on the meter${mode === 'quest' ? ', Start Over' : ''}`}
          onClick={() => setMore(true)}
        />
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

/** Start Over, in Points' More options: an empty jar again, the meter's stars kept. */
function RestartRow({ activeClass, onAskRestart }: { activeClass: ClassData; onAskRestart: () => void }) {
  const j = jarOf(activeClass)
  const fresh = j.number === 1 && j.marbles.length === 0 && j.spins === 0
  return (
    <div className="cs-row" data-guide="restart-quest">
      <div className="cs-row-label">
        <b>Start Over</b>
        <small>Starts again with an empty jar. The stars on the meter stay.</small>
      </div>
      <Btn kind="quiet-red" small disabled={fresh} onClick={onAskRestart}>
        <RotateCcw /> Start Over
      </Btn>
    </div>
  )
}

/** How full the class's jar is, and how long the last spin took, to help set the goal. */
function JarRow({ activeClass }: { activeClass: ClassData }) {
  const j = jarOf(activeClass)
  const full = Math.min(100, Math.round((jarFill(j) / CAPACITY) * 100))
  return (
    <div className="cs-row" data-guide="quest-row">
      <div className="cs-row-label">
        <b>{`${j.number > 1 ? `Jar ${j.number}: ` : 'The jar: '}${full}% full`}</b>
        <small>{lastSpinWords(j)}</small>
      </div>
    </div>
  )
}

const SIZES: PrizeSize[] = ['m', 'b']
/** The jar's prize wheel is six silver slices and two gold ones (lib/marbles, JAR_PRIZE_WHEEL), so no small prizes. */
const SIZE_LABEL: Record<PrizeSize, string> = { s: 'Small', m: 'Prizes', b: 'Big prizes' }
const SIZE_SAYS: Record<PrizeSize, string> = {
  s: '',
  m: 'Silver slices. Six on the wheel.',
  b: 'Gold slices. Two on the wheel.',
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
      <SubHead back="Points" title="Prizes" onBack={onBack} />
      <div className="cs-gi">
        When the marble jar is full, the prize wheel spins on the board and lands on one of these. The class gets the real reward from
        you. Whole-class activities work best.
      </div>
      <div className="cs-prizes">
        {SIZES.map((size) => {
          const list = prizes.map((p, i) => ({ p, i })).filter(({ p }) => p.size === size)
          return (
            <div key={size} className="cs-prize-col" data-size={size}>
              <b>{SIZE_LABEL[size]}</b>
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
                  aria-label={`A new ${SIZE_LABEL[size].toLowerCase()} prize`}
                  onChange={(e) => setDrafts((d) => ({ ...d, [size]: e.target.value }))}
                />
                <Btn small type="submit" disabled={!drafts[size].trim()} aria-label={`Add a ${SIZE_LABEL[size].toLowerCase()} prize`}>
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
