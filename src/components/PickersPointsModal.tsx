import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw, StarOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import type { ClassData, Student } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

export interface PickerSettingsValue {
  allowRepeats: boolean
  soundEnabled: boolean
}

interface PickersPointsModalProps {
  open: boolean
  onClose: () => void
  settings: PickerSettingsValue
  onUpdateSettings: (patch: Partial<PickerSettingsValue>) => void
  studentPickCounts: Map<string, number>
  columnPickCounts: Map<number, number>
  studentsById: Map<string, Student>
  activeClass: ClassData
  onSaveGoal: (goal: number, starsPerClassPoint: number) => void
  onSetGoalEnabled: (enabled: boolean) => void
  onResetClassGoal: () => void
  onResetStars: () => void
  onReset: () => void
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-1 items-start justify-between gap-3 rounded-2xl border border-black/10 p-3 dark:border-white/10">
      <div className="min-w-0">
        <Label className="text-foreground">{label}</Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
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
              'h-10 min-w-10 flex-1 rounded-xl text-sm font-bold transition-colors active:scale-95',
              choice === value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-black/5 text-muted-foreground hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20',
            )}
          >
            {choice}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** How long after the last tap the goal is written. */
const COMMIT_DELAY_MS = 400

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

  const button = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/5 text-foreground transition-colors hover:bg-black/10 active:scale-95 disabled:pointer-events-none disabled:opacity-35 dark:bg-white/10 dark:hover:bg-white/20'

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
          className="h-12 flex-1 text-center text-lg font-bold"
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
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function PickersPointsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  studentPickCounts,
  columnPickCounts,
  studentsById,
  activeClass,
  onSaveGoal,
  onSetGoalEnabled,
  onResetClassGoal,
  onResetStars,
  onReset,
}: PickersPointsModalProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [confirmingResetGoal, setConfirmingResetGoal] = useState(false)
  const [confirmingResetStars, setConfirmingResetStars] = useState(false)
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

  const totalStars = activeClass.students.reduce((sum, st) => sum + (st.points ?? 0), 0)
  // Off means the meter isn't on screen at all - but the goal itself is kept, so switching
  // back on restores the number the teacher chose rather than a default.
  const goalOn = activeClass.goalEnabled !== false && (activeClass.pointsGoal ?? 0) > 0

  // A switch has to act on the tap, not on a debounce - so it writes straight away rather
  // than going through the pending-edit path the steppers use.
  function toggleGoal(on: boolean) {
    if (on && (activeClass.pointsGoal ?? 0) <= 0) commitNow({ goal: goal || 50, starsPer })
    onSetGoalEnabled(on)
  }
  const studentEntries = Array.from(studentPickCounts.entries())
    .map(([id, count]) => ({ id, count, name: studentsById.get(id)?.name }))
    .filter((e): e is { id: string; count: number; name: string } => Boolean(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const rowEntries = Array.from(columnPickCounts.entries())
    .map(([column, count]) => ({ column, count }))
    .sort((a, b) => a.column - b.column)

  const hasHistory = studentEntries.length > 0 || rowEntries.length > 0

  return (
    <>
      <Modal
        open={open && !confirmingReset && !confirmingResetGoal && !confirmingResetStars}
        onClose={onClose}
        title="Pickers &amp; Points"
        size="xl"
      >
        {/* No h-full here: the dialog body is the scroller, and forcing this to its height
            made the sections fight over the space and spill their text over each other. */}
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <ToggleRow
                label="Allow Repeats"
                description="Off: everyone gets picked once before anyone repeats, and the same for rows."
                checked={settings.allowRepeats}
                onCheckedChange={(checked) => onUpdateSettings({ allowRepeats: checked })}
              />
              <ToggleRow
                label="Picker Sound"
                description="A sound plays as students or rows flash by during a pick."
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => onUpdateSettings({ soundEnabled: checked })}
              />
            </div>

            <Label>Pick History (this session)</Label>
            {!hasHistory ? (
              <p className="rounded-2xl border border-black/10 p-4 text-center text-muted-foreground dark:border-white/10">
                No one&apos;s been picked yet.
              </p>
            ) : (
              <ScrollArea className="max-h-44 rounded-2xl border border-black/10 dark:border-white/10">
                <div className="flex flex-col gap-3 p-3">
                  {studentEntries.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Students</p>
                      <div className="flex flex-wrap gap-1.5">
                        {studentEntries.map((e) => (
                          <Badge key={e.id} variant="secondary">
                            {e.name} &times;{e.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {rowEntries.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Rows</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rowEntries.map((e) => (
                          <Badge key={e.column} variant="secondary">
                            Row {e.column + 1} &times;{e.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            <TactileButton
              variant="danger"
              disabled={!hasHistory}
              className="w-full justify-center"
              onClick={() => setConfirmingReset(true)}
            >
              <RotateCcw size={16} /> Reset All Pick Counts
            </TactileButton>
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <ToggleRow
              label="Class Goal"
              description="Off: no meter on the board at all, and nothing for the class to ask about."
              checked={goalOn}
              onCheckedChange={toggleGoal}
            />
            {goalOn && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <ChipRow
                label="Stars for 1 class point"
                hint={starsPer === 1 ? 'Every star moves the meter.' : `${starsPer} stars = 1 class point.`}
                value={starsPer}
                choices={STARS_PER_CHOICES}
                onChange={changeStarsPer}
              />
              <Stepper
                id="goal"
                label="Class points to fill the goal"
                hint={`${goal * starsPer} stars fills it. Leftovers carry over.`}
                value={goal}
                min={1}
                max={999}
                onChange={changeGoal}
              />
            </div>
            )}
            {/* Stars are awarded whether or not a class goal exists, so clearing them stays
                available even with the goal switched off. Only the meter's own reset hides. */}
            <div className="flex flex-col gap-1.5 sm:flex-row">
              {goalOn && (
                <TactileButton
                  variant="danger"
                  disabled={(activeClass.classPoints ?? 0) === 0 && (activeClass.goalRemainder ?? 0) === 0}
                  className="flex-1 justify-center"
                  onClick={() => setConfirmingResetGoal(true)}
                >
                  <RotateCcw size={16} /> Reset Class Goal
                </TactileButton>
              )}
              <TactileButton
                variant="danger"
                disabled={totalStars === 0}
                className="flex-1 justify-center"
                onClick={() => setConfirmingResetStars(true)}
              >
                <StarOff size={16} /> Reset All Stars
              </TactileButton>
            </div>
          </section>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmingResetGoal}
        title="Reset the class goal meter?"
        message={`This empties "${activeClass.name}"'s shared meter back to 0. Each student keeps their own stars.`}
        confirmLabel="Yes, Reset Meter"
        cancelLabel="No"
        onCancel={() => setConfirmingResetGoal(false)}
        onConfirm={() => {
          onResetClassGoal()
          setConfirmingResetGoal(false)
        }}
      />

      <ConfirmModal
        open={confirmingResetStars}
        title="Reset everyone's stars?"
        message={`This sets every student in "${activeClass.name}" back to 0 stars. The class goal meter is left where it is.`}
        confirmLabel="Yes, Reset Stars"
        cancelLabel="No"
        onCancel={() => setConfirmingResetStars(false)}
        onConfirm={() => {
          onResetStars()
          setConfirmingResetStars(false)
        }}
      />

      <ConfirmModal
        open={confirmingReset}
        title="Reset All Pick Counts?"
        message="This puts every student and row back to being picked zero times this session. This can't be undone."
        confirmLabel="Yes, Reset"
        cancelLabel="No"
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          onReset()
          setConfirmingReset(false)
        }}
      />
    </>
  )
}
