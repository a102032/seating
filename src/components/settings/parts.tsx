import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'

/**
 * The pieces every section of Class Settings is built from (index.css, "Class Settings"): rows
 * with their label on the left and their control on the right, as in a phone's Settings, and
 * buttons a size smaller than the board's, as a settings window's are.
 */

export function Btn({
  children,
  kind = 'default',
  small,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'default' | 'primary' | 'next' | 'quiet' | 'red' | 'quiet-red'; small?: boolean }) {
  return (
    <button
      type="button"
      data-slot="button"
      className={clsx(
        'cs-btn',
        kind === 'primary' && 'cs-primary',
        kind === 'next' && 'cs-next',
        (kind === 'quiet' || kind === 'quiet-red') && 'cs-quiet',
        (kind === 'red' || kind === 'quiet-red') && 'cs-red',
        small && 'cs-small',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Tick() {
  return (
    <span className="cs-tick">
      <Check strokeWidth={3.5} />
    </span>
  )
}

/**
 * A switch's two sentences, one for each way it can be, laid on top of each other with the other
 * hidden: the words always say the state the switch is in, and flipping it moves nothing.
 */
export function States({ on, onText, offText, className }: { on: boolean; onText: ReactNode; offText: ReactNode; className?: string }) {
  return (
    <span className={clsx('cs-states', className)}>
      <span className={on ? undefined : 'cs-gone'}>{onText}</span>
      <span className={on ? 'cs-gone' : undefined}>{offText}</span>
    </span>
  )
}

/** A row that is a switch and its label, the label saying what is true now. */
export function SwitchRow({
  label,
  on,
  onText,
  offText,
  onChange,
  disabled,
  note,
  guide,
}: {
  label: string
  on: boolean
  onText: ReactNode
  offText: ReactNode
  onChange: (on: boolean) => void
  disabled?: boolean
  /** In place of the two sentences, when the switch can't be used. */
  note?: ReactNode
  guide?: string
}) {
  return (
    <div className="cs-row" data-guide={guide}>
      <div className="cs-row-label">
        <b>{label}</b>
        <small>{note ?? <States on={on} onText={onText} offText={offText} />}</small>
      </div>
      <Switch checked={on} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}

/**
 * A white box of settings on the window's grey (2026-10-26, the Apple and Windows Settings look):
 * a small grey heading over it, and a line under the heading when what the box is for needs saying.
 */
export function Group({
  head,
  intro,
  guide,
  className,
  children,
}: {
  head?: ReactNode
  intro?: ReactNode
  guide?: string
  className?: string
  children: ReactNode
}) {
  return (
    <>
      {head && <div className="cs-gh">{head}</div>}
      {intro && <div className="cs-gi">{intro}</div>}
      <div className={clsx('cs-group', className)} data-guide={guide}>
        {children}
      </div>
    </>
  )
}

/**
 * More options, at a section's foot (2026-10-26, the teacher's sort of every setting: what a
 * teacher needs to set a class up stays in sight, what is useful but rare is tucked in here). It
 * says what is inside, so nothing is hidden from a teacher looking for it.
 */
export function MoreRow({ inside, onClick }: { inside: string; onClick: () => void }) {
  return (
    <div className="cs-group" data-guide="more">
      <button type="button" className="cs-row cs-more" onClick={onClick}>
        <span className="cs-row-label">
          <b>More options</b>
          <small>{inside}</small>
        </span>
        <ChevronRight className="cs-chev" />
      </button>
    </div>
  )
}

/** The top of a page inside a section (More options, the prizes, a tool's settings): back, and its name. */
export function SubHead({ back, title, onBack }: { back: string; title: string; onBack: () => void }) {
  return (
    <div className="cs-sub-head">
      <button type="button" className="cs-back" onClick={onBack} data-guide="back">
        <ChevronLeft /> {back}
      </button>
      <b>{title}</b>
    </div>
  )
}

const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 90
const HOLD_REPEAT_MIN_MS = 22
/** Each repeat comes a little sooner than the last, so a long haul doesn't take all day. */
const HOLD_ACCEL = 0.88

/**
 * A number with − and + beside it, and a box in between that can be typed in (the teacher: quick
 * on a laptop). Holding − or + repeats, so 50 to 100 isn't fifty taps; the step stays 1, so it
 * can still stop on an exact number. What is typed counts as it is typed, held to the limits; the
 * box shows the number again when it is left.
 */
export function NumberStepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  label: string
  onChange: (value: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const stop = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => stop, [])

  const step = (by: number) => {
    const next = Math.min(max, Math.max(min, valueRef.current + by))
    // Held at its limit, a step changes nothing, so it saves nothing either.
    if (next === valueRef.current) return
    valueRef.current = next
    onChange(next)
  }
  function hold(by: number) {
    setText(null)
    step(by)
    const repeat = (delay: number) => {
      timers.current.push(
        setTimeout(() => {
          step(by)
          repeat(Math.max(HOLD_REPEAT_MIN_MS, delay * HOLD_ACCEL))
        }, delay),
      )
    }
    timers.current.push(setTimeout(() => repeat(HOLD_REPEAT_MS), HOLD_DELAY_MS))
  }
  const press = (by: number) => ({
    onPointerDown: () => hold(by),
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // A key on a keyboard, not a finger: one step.
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        step(by)
      }
    },
  })

  return (
    <div className="cs-stepper">
      <button type="button" aria-label={`Less: ${label}`} disabled={value <= min} {...press(-1)}>
        <Minus size={20} strokeWidth={2.75} />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={text ?? String(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, '')
          setText(raw)
          if (raw !== '') onChange(Math.min(max, Math.max(min, Number(raw))))
        }}
        onBlur={() => setText(null)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" aria-label={`More: ${label}`} disabled={value >= max} {...press(1)}>
        <Plus size={20} strokeWidth={2.75} />
      </button>
    </div>
  )
}
