import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Pause, Play, Plus, Settings, Square } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useCountdown } from '../hooks/useCountdown'
import { playAlarm } from '../lib/sound'
import type { TimerSettings } from '../types'
import { FlipDigit } from './FlipDigit'
import { TimerDial } from './TimerDial'

const TAP_GUARD_MS = 700

interface FlipTimerProps {
  settings: TimerSettings
  onOpenSettings: () => void
  disabled?: boolean
}

export function FlipTimer({ settings, onOpenSettings, disabled = false }: FlipTimerProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const {
    minutes,
    seconds,
    running,
    configuredSeconds,
    remainingSeconds,
    endsAt,
    warningLevel,
    adjustMinutes,
    adjustSeconds,
    start,
    pause,
    stop,
  } = useCountdown(() => playAlarm(settings.alarmSound))
  const activeWarningLevel = settings.warningEnabled ? warningLevel : 'none'
  const remainingTotal = minutes * 60 + seconds
  const dial = settings.face === 'dial'
  // Ran out and not reset: the dial says so until Stop or a new time clears it.
  const timesUp = !running && configuredSeconds > 0 && remainingSeconds === 0

  useEffect(() => {
    if (disabled) setMenuOpen(false)
  }, [disabled])

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  // The controls open from a tap on the timer itself - no words on the box, so the clock gets
  // the room. A second tap within 0.7 s is ignored: smart boards read one touch as two, and
  // the second would shut what the first just opened.
  const lastToggle = useRef(0)
  function toggleControls() {
    if (disabled) return
    const now = performance.now()
    if (now - lastToggle.current < TAP_GUARD_MS) return
    lastToggle.current = now
    setMenuOpen((v) => !v)
  }
  const faceProps = {
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    'aria-expanded': menuOpen,
    'aria-label': 'Timer controls',
    title: disabled ? undefined : menuOpen ? 'Hide timer controls' : 'Timer controls',
    onClick: toggleControls,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      toggleControls()
    },
  }
  const faceClass = clsx(
    'flex w-full items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-clock-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-clock',
    !disabled && 'cursor-pointer',
  )

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-clock p-3 shadow-lg">
      {dial ? (
        // The dial is the point - it's what the children read - so it takes most of the row and
        // the time sits small beside it for the teacher, centred top to bottom. Capped by the
        // screen's height so a short screen's panel still fits with the controls open.
        <div {...faceProps} className={clsx(faceClass, 'gap-2.5')}>
          <TimerDial
            configuredSeconds={configuredSeconds}
            remainingSeconds={remainingSeconds}
            endsAt={endsAt}
            timesUp={timesUp}
            className="shrink-0 drop-shadow-md"
            style={{ width: 'min(62%, 15.5vh)' }}
          />
          <div className="min-w-0 flex-1" style={{ containerType: 'inline-size' }}>
            <div
              className="w-full rounded-md border border-black/5 bg-card py-0.5 text-center font-mono font-black text-card-foreground tabular-nums shadow-md dark:border-white/10"
              style={{ fontSize: '26cqw' }}
            >
              {mm}:{ss}
            </div>
          </div>
        </div>
      ) : (
        <div {...faceProps} className={clsx(faceClass, 'gap-1')}>
          <FlipDigit value={mm[0]} warningLevel={activeWarningLevel} />
          <FlipDigit value={mm[1]} warningLevel={activeWarningLevel} />
          <span className="shrink-0 px-0.5 font-black text-clock-foreground" style={{ fontSize: 'clamp(1rem, 4.5vmin, 2.4rem)' }}>
            :
          </span>
          <FlipDigit value={ss[0]} warningLevel={activeWarningLevel} />
          <FlipDigit value={ss[1]} warningLevel={activeWarningLevel} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="flex w-full flex-col items-center gap-2 overflow-hidden"
          >
            <div className="flex items-center gap-4 pt-1">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-clock-foreground">MIN</span>
                <div className="flex items-center gap-1">
                  <SpinButton disabled={disabled || running} onClick={() => adjustMinutes(-1)}>
                    <Minus size={14} />
                  </SpinButton>
                  <SpinButton disabled={disabled || running} onClick={() => adjustMinutes(1)}>
                    <Plus size={14} />
                  </SpinButton>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-clock-foreground">SEC</span>
                <div className="flex items-center gap-1">
                  <SpinButton disabled={disabled || running} onClick={() => adjustSeconds(-1)}>
                    <Minus size={14} />
                  </SpinButton>
                  <SpinButton disabled={disabled || running} onClick={() => adjustSeconds(1)}>
                    <Plus size={14} />
                  </SpinButton>
                </div>
              </div>
              <button
                onClick={onOpenSettings}
                disabled={disabled}
                className="mt-3.5 rounded-full p-1.5 text-clock-foreground hover:bg-black/10 disabled:pointer-events-none disabled:opacity-30"
                title="Timer settings"
              >
                <Settings size={18} />
              </button>
            </div>
            <div className="flex items-center gap-3 pb-0.5 pt-1">
              <SymbolButton disabled={disabled || running || remainingTotal <= 0} onClick={start} title="Start">
                <Play size={20} />
              </SymbolButton>
              <SymbolButton disabled={disabled || !running} onClick={pause} title="Pause">
                <Pause size={20} />
              </SymbolButton>
              {/* Stays live once the time has run out: it's what clears "Time's up!" on the dial. */}
              <SymbolButton disabled={disabled || (!running && remainingTotal <= 0 && !timesUp)} onClick={stop} title="Stop">
                <Square size={20} />
              </SymbolButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 90

function SpinButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const held = useRef(false)

  const clearHold = () => {
    if (holdTimeout.current) clearTimeout(holdTimeout.current)
    if (holdInterval.current) clearInterval(holdInterval.current)
    holdTimeout.current = null
    holdInterval.current = null
  }

  useEffect(() => clearHold, [])

  function handlePointerDown() {
    if (disabled) return
    held.current = false
    holdTimeout.current = setTimeout(() => {
      held.current = true
      onClick()
      holdInterval.current = setInterval(onClick, HOLD_REPEAT_MS)
    }, HOLD_DELAY_MS)
  }

  function handlePointerUp() {
    if (disabled) return
    if (!held.current) onClick()
    clearHold()
  }

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
      className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-border bg-card text-foreground disabled:opacity-30"
    >
      {children}
    </motion.button>
  )
}

function SymbolButton({
  children,
  disabled,
  onClick,
  title,
}: {
  children: ReactNode
  disabled: boolean
  onClick: () => void
  title: string
}) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: 1.15 }}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-10 w-10 items-center justify-center rounded-full text-clock-foreground hover:bg-black/10 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </motion.button>
  )
}
