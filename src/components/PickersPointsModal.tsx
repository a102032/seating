import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Plus, RotateCcw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { CELEBRATION_GIFS, gifThumbUrl } from '../lib/celebrationGifs'
import { assetUrl } from '../lib/assets'
import type { ClassData } from '../types'
import { GET_READY_PRIZES } from '../lib/getReady'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

export interface PickerSettingsValue {
  allowRepeats: boolean
  soundEnabled: boolean
}

interface PickersPointsModalProps {
  open: boolean
  onClose: () => void
  settings: PickerSettingsValue
  onUpdateSettings: (patch: Partial<PickerSettingsValue>) => void
  activeClass: ClassData
  /** Somebody (or some row) has been picked this round, so there is a round to start over. */
  roundStarted: boolean
  onStartNewRound: () => void
  onSaveGoal: (goal: number, starsPerClassPoint: number) => void
  onSetGoalEnabled: (enabled: boolean) => void
  onSetStarsOnDesks: (on: boolean) => void
  onSetCelebrationGif: (gifId: string) => void
  onResetClassGoal: () => void
  onSetClassPoints: (points: number) => void
  /** What a full star in Get Ready! is worth, the same on every drum. */
  getReadyPrize: number
  onSetGetReadyPrize: (prize: number) => void
}

/**
 * A labelled switch that describes the state it is actually in.
 *
 * These used to carry one fixed sentence describing the off state, which meant a switch
 * sitting in its on position was captioned "Off: no meter on the board at all" - a sentence
 * contradicting the control right beside it, with only a small "Off:" prefix to sort it out.
 * Now each state has its own sentence and the prefix is rendered from `checked`, so the words
 * and the switch cannot disagree.
 *
 * Both sentences are laid on top of each other in one grid cell and the inactive one is
 * hidden rather than unmounted. The row then reserves the height of the longer sentence, so
 * flipping a switch doesn't resize the row and shove everything below it down the modal.
 */
function ToggleRow({
  label,
  onDescription,
  offDescription,
  checked,
  onCheckedChange,
}: {
  label: string
  /** What is true while this is on. */
  onDescription: string
  /** What is true while this is off. */
  offDescription: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-1 items-start justify-between gap-3 rounded-2xl border border-black/10 p-2.5 dark:border-white/10">
      <div className="min-w-0">
        <Label className="text-foreground">{label}</Label>
        <div className="mt-0.5 grid text-sm text-muted-foreground">
          <p className={clsx('col-start-1 row-start-1', !checked && 'invisible')}>
            <span className="font-semibold text-foreground/70">On:</span> {onDescription}
          </p>
          <p className={clsx('col-start-1 row-start-1', checked && 'invisible')}>
            <span className="font-semibold text-foreground/70">Off:</span> {offDescription}
          </p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </div>
  )
}

const chestPicture = assetUrl('/treasure/chest-closed.svg')

/** A desk as the board draws it, rounded at the top, for the stars pictures. */
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
 * How the class runs its points, as two small pictures rather than a switch, because this is one
 * way or the other, not on and off (the timer's Flip Clock or Dial is chosen the same way). Both
 * sentences sit in one cell, the other hidden, so choosing doesn't change the window's height.
 */
function StarsChoice({ onDesks, onChange }: { onDesks: boolean; onChange: (onDesks: boolean) => void }) {
  const choice = (selected: boolean, label: string, picture: React.ReactNode, pick: () => void) => (
    <button
      type="button"
      onClick={pick}
      aria-pressed={selected}
      className={clsx(
        'relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-bold transition-all active:scale-95',
        selected
          ? 'bg-primary/15 text-foreground ring-2 ring-primary'
          : 'bg-black/5 text-muted-foreground hover:bg-black/10 dark:bg-white/10',
      )}
    >
      {picture}
      <span className="leading-tight">{label}</span>
      {selected && <SelectedTick />}
    </button>
  )
  return (
    <div className="flex-[1.35] rounded-2xl border border-black/10 p-2.5 dark:border-white/10">
      <Label className="text-foreground">Stars</Label>
      <div className="mt-1.5 flex gap-1.5">
        {choice(
          !onDesks,
          'Straight to the goal',
          <span className="flex shrink-0 items-center gap-0.5">
            <MiniDesk star={false} />
            <span className="text-amber-500">→</span>
            <img src={chestPicture} alt="" className="h-5 w-5" />
          </span>,
          () => onChange(false),
        )}
        {choice(onDesks, 'On the desks first', <MiniDesk star />, () => onChange(true))}
      </div>
      <div className="mt-1 grid text-xs text-muted-foreground">
        <p className={clsx('col-start-1 row-start-1', onDesks && 'invisible')}>A star flies into the goal the moment you give it.</p>
        <p className={clsx('col-start-1 row-start-1', !onDesks && 'invisible')}>
          Stars stay on the desks, and − takes one back. All Stars In! adds them to the goal.
        </p>
      </div>
    </div>
  )
}

/** The values worth offering for stars-per-class-point. Ten chips beat a slider here: no
    drag to land accurately, and the set is small and discrete enough to show in full. */
const STARS_PER_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function ChipRow({
  label,
  hint,
  value,
  choices,
  onChange,
}: {
  label: string
  hint: string
  value: number
  choices: number[]
  onChange: (value: number) => void
}) {
  return (
    <div className="flex-1">
      <Label className="text-foreground">{label}</Label>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onChange(choice)}
            className={clsx(
              'h-9 min-w-9 flex-1 rounded-xl text-sm font-bold transition-colors active:scale-95',
              choice === value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-black/5 text-muted-foreground hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20',
            )}
          >
            {choice}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** How long after the last tap the goal is written. */
const COMMIT_DELAY_MS = 400

function SelectedTick() {
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
      <Check size={12} strokeWidth={3.5} />
    </span>
  )
}

const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 90
const HOLD_REPEAT_MIN_MS = 22
/** Each repeat comes a little sooner than the last, so a long haul doesn't take all day. */
const HOLD_ACCEL = 0.88

function Stepper({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  // Holding a button repeats, so going from 5 to 50 isn't forty-five taps. Read the live
  // value through a ref - the repeat closure would otherwise keep stepping off the old one.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  function stop() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  useEffect(() => stop, [])

  function step(by: number) {
    onChange(Math.min(max, Math.max(min, valueRef.current + by)))
  }

  function hold(by: number) {
    step(by)
    // A shrinking chain of timeouts rather than a fixed interval: holding to cross a big
    // range shouldn't crawl, but the step stays 1 so you can still stop on an exact number.
    const repeat = (delay: number) => {
      timers.current.push(
        setTimeout(() => {
          step(by)
          repeat(Math.max(HOLD_REPEAT_MIN_MS, delay * HOLD_ACCEL))
        }, delay),
      )
    }
    timers.current.push(
      setTimeout(() => {
        step(by)
        repeat(HOLD_REPEAT_MS)
      }, HOLD_DELAY_MS),
    )
  }

  const button =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/5 text-foreground transition-colors hover:bg-black/10 active:scale-95 disabled:pointer-events-none disabled:opacity-35 dark:bg-white/10 dark:hover:bg-white/20'

  return (
    <div className="shrink-0 sm:w-64">
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          className={button}
          onPointerDown={() => hold(-1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
        >
          <Minus size={20} strokeWidth={2.75} />
        </button>
        {/* Still typeable, for the teacher who knows they want 137. */}
        <Input
          id={id}
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            const next = Number(e.target.value.replace(/[^0-9]/g, ''))
            onChange(Math.min(max, Math.max(min, Number.isFinite(next) ? next : min)))
          }}
          className="h-11 flex-1 text-center text-lg font-bold"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          className={button}
          onPointerDown={() => hold(1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
        >
          <Plus size={20} strokeWidth={2.75} />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function PickersPointsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  activeClass,
  roundStarted,
  onStartNewRound,
  onSaveGoal,
  onSetGoalEnabled,
  onSetStarsOnDesks,
  onSetCelebrationGif,
  onResetClassGoal,
  onSetClassPoints,
  getReadyPrize,
  onSetGetReadyPrize,
}: PickersPointsModalProps) {
  const [confirmingResetGoal, setConfirmingResetGoal] = useState(false)
  const [goal, setGoal] = useState(50)
  const [starsPer, setStarsPer] = useState(1)

  // Everything else in this modal applies the moment you touch it, so the goal does too -
  // no Save button. The write is debounced because holding the stepper would otherwise
  // persist the class forty times a second.
  const latest = useRef({ goal, starsPer })
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const classRef = useRef(activeClass)
  classRef.current = activeClass

  /** Writes now, whether or not a debounced write was already waiting. */
  function commitNow(next: { goal: number; starsPer: number }) {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
    latest.current = next
    onSaveGoal(next.goal, next.starsPer)
  }

  /** Only for closing and unmounting: writes the pending edit, if there is one. */
  function flushPending() {
    if (!commitTimer.current) return
    commitNow(latest.current)
  }

  function commitSoon(next: { goal: number; starsPer: number }) {
    latest.current = next
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => commitNow(latest.current), COMMIT_DELAY_MS)
  }

  function changeGoal(next: number) {
    setGoal(next)
    commitSoon({ goal: next, starsPer: latest.current.starsPer })
  }

  function changeStarsPer(next: number) {
    setStarsPer(next)
    commitSoon({ goal: latest.current.goal, starsPer: next })
  }

  // Seed once per opening, from a ref, so a debounced write landing mid-edit can't feed the
  // saved value back into the control the teacher is still using.
  useEffect(() => {
    if (!open) return
    const seeded = { goal: classRef.current.pointsGoal || 50, starsPer: classRef.current.starsPerClassPoint || 1 }
    latest.current = seeded
    setGoal(seeded.goal)
    setStarsPer(seeded.starsPer)
  }, [open])

  // Don't lose an edit to closing the modal, or to the app unmounting.
  useEffect(() => {
    if (open) return
    flushPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Off means the meter isn't on screen at all - but the goal itself is kept, so switching
  // back on restores the number the teacher chose rather than a default.
  const goalOn = activeClass.goalEnabled !== false && (activeClass.pointsGoal ?? 0) > 0

  // A switch has to act on the tap, not on a debounce - so it writes straight away rather
  // than going through the pending-edit path the steppers use.
  function toggleGoal(on: boolean) {
    if (on && (activeClass.pointsGoal ?? 0) <= 0) commitNow({ goal: goal || 50, starsPer })
    onSetGoalEnabled(on)
  }
  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <>
      <Modal open={open && !confirmingResetGoal} onClose={onClose} title="Pickers &amp; Points" size="xl">
        {/* No h-full here: the dialog body is the scroller, and forcing this to its height
            made the sections fight over the space and spill their text over each other. */}
        {/* Two columns on a wide screen. Stacked, this modal grew past the viewport every
            time anything was added to it, and shaving paddings only ever bought one more
            addition - side by side there is room to spare. */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <section className="flex flex-col gap-2.5 lg:w-[19rem] lg:shrink-0">
            <div className="flex flex-col gap-2.5">
              <ToggleRow
                label="Allow Repeats"
                onDescription="Anyone can be picked again straight away."
                offDescription="Everyone gets picked once before anyone repeats, and the same for rows and tables."
                checked={settings.allowRepeats}
                onCheckedChange={(checked) => onUpdateSettings({ allowRepeats: checked })}
              />
              <ToggleRow
                label="Picker Sound"
                onDescription="A sound plays as students or rows flash by during a pick."
                offDescription="Picks happen silently."
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => onUpdateSettings({ soundEnabled: checked })}
              />
            </div>

            {/*
              Who has been picked is kept quietly, for the teacher, in Class Settings
              (Participation) - the list of names that was here showed only the students who HAD
              been picked, and the ones worth noticing are the ones missing from it. What stays
              here is the round: with Allow Repeats off, everyone gets a turn before anyone has a
              second, and this starts that over.
            */}
            <div className="rounded-2xl border border-black/10 p-2.5 dark:border-white/10">
              <TactileButton disabled={!roundStarted} className="w-full justify-center" onClick={onStartNewRound}>
                <RotateCcw size={16} /> Start a New Round
              </TactileButton>
              <p className="mt-1 text-center text-xs text-muted-foreground">Everyone can be picked again.</p>
            </div>

            {/* Get Ready!'s one setting. A full star is the same prize on every drum, so a faster
                class keeps more of it and a shorter drum is harder without being worth less. It
                only exists with a goal, as the button does. */}
            {goalOn && (
              <div className="rounded-2xl border border-black/10 p-2.5 dark:border-white/10">
                <ChipRow
                  label="Get Ready! prize"
                  hint="Class points for a full star, on every drum."
                  value={getReadyPrize}
                  choices={GET_READY_PRIZES}
                  onChange={onSetGetReadyPrize}
                />
              </div>
            )}
          </section>

          <Separator className="lg:hidden" />

          <section className="flex min-w-0 flex-1 flex-col gap-2.5">
            {/* The guided setup lights the switch and the goal, not the celebrations under them. */}
            <div className="flex flex-col gap-2.5" data-guide="goal">
              {/* Side by side, so the second switch costs the modal no height. */}
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <ToggleRow
                  label="Class Goal"
                  onDescription="The goal meter shows at the top of the board."
                  offDescription="No meter on the board at all, and nothing for the class to ask about."
                  checked={goalOn}
                  onCheckedChange={toggleGoal}
                />
                {/* Straight to the goal by default: the board shows the jar the class fills
                  together, and nothing for children to compare. Stars on the desks are this
                  lesson's, on their way to the goal - never a running total. Only with a goal:
                  without one there is nowhere for the stars to go. */}
                {goalOn && <StarsChoice onDesks={activeClass.starsOnDesks === true} onChange={onSetStarsOnDesks} />}
              </div>
              {goalOn && (
                <div className="flex flex-col gap-2.5">
                  <ChipRow
                    label="Stars for 1 class point"
                    hint={starsPer === 1 ? 'Every star moves the meter.' : `${starsPer} stars = 1 class point.`}
                    value={starsPer}
                    choices={STARS_PER_CHOICES}
                    onChange={changeStarsPer}
                  />
                  {/* Side by side, so the second stepper costs the modal no height - it was
                  sized to fit the screen without scrolling, and it should stay that way. */}
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-4">
                    <Stepper
                      id="goal"
                      label="Class points to fill the goal"
                      hint={`${goal * starsPer} stars fills it. Leftovers carry over.`}
                      value={goal}
                      min={1}
                      max={999}
                      onChange={changeGoal}
                    />
                    {/* The one place the meter can be corrected. A point that landed by mistake
                    had no way back before this, short of resetting the whole run. */}
                    <Stepper
                      id="class-points"
                      label="Class points on the meter now"
                      hint="Fix a point that landed by mistake. Never opens the chest."
                      value={Math.min(goal, activeClass.classPoints ?? 0)}
                      min={0}
                      max={goal}
                      onChange={onSetClassPoints}
                    />
                  </div>
                </div>
              )}
            </div>
            {goalOn && (
              <div>
                <Label className="text-foreground">Celebration</Label>
                {/* A filmstrip, not a grid: a wrapped grid of eleven thumbnails is tall enough
                    to push this modal back into scrolling, which is the thing we just fixed. */}
                <div className="mt-1.5 flex gap-2 overflow-x-auto rounded-2xl border border-black/10 p-1.5 dark:border-white/10">
                  {/* The chosen one is ringed, lifted and ticked, and everything else is
                      dimmed. A 2px border on a thumbnail is invisible in a row of thumbnails. */}
                  <button
                    type="button"
                    onClick={() => onSetCelebrationGif('')}
                    title="Treasure chest"
                    className={clsx(
                      'relative flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95',
                      !activeClass.celebrationGifId
                        ? 'scale-105 bg-primary/15 ring-[3px] ring-primary ring-offset-2 ring-offset-card'
                        : 'bg-black/5 opacity-55 hover:opacity-100 dark:bg-white/10',
                    )}
                  >
                    <img src={assetUrl('/treasure/chest-open.svg')} alt="" className="h-8 w-8" />
                    <span className="text-[10px] font-bold text-foreground">Treasure</span>
                    {!activeClass.celebrationGifId && <SelectedTick />}
                  </button>
                  {CELEBRATION_GIFS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onSetCelebrationGif(g.id)}
                      title={g.label}
                      className={clsx(
                        'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/5 transition-all active:scale-95 dark:bg-white/10',
                        activeClass.celebrationGifId === g.id
                          ? 'scale-105 ring-[3px] ring-primary ring-offset-2 ring-offset-card'
                          : 'opacity-55 hover:opacity-100',
                      )}
                    >
                      <img src={gifThumbUrl(g.id)} alt={g.label} loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] font-bold text-white">
                        {g.label}
                      </span>
                      {activeClass.celebrationGifId === g.id && <SelectedTick />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reset All Stars went with the running total it cleared: stars on the desks are
                this lesson's and empty themselves into the goal, and a miscount is fixed in the
                roster. */}
            {goalOn && (
              <TactileButton
                variant="danger"
                disabled={(activeClass.classPoints ?? 0) === 0 && (activeClass.goalRemainder ?? 0) === 0}
                className="justify-center sm:self-start"
                onClick={() => setConfirmingResetGoal(true)}
              >
                <RotateCcw size={16} /> Reset Class Goal
              </TactileButton>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmingResetGoal}
        title="Reset the class goal meter?"
        message={`This empties "${activeClass.name}"'s shared meter back to 0.`}
        confirmLabel="Yes, Reset Meter"
        cancelLabel="No"
        onCancel={() => setConfirmingResetGoal(false)}
        onConfirm={() => {
          onResetClassGoal()
          setConfirmingResetGoal(false)
        }}
      />
    </>
  )
}
