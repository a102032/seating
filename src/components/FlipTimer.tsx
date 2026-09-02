import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Minus, Pause, Play, Plus, Settings, Square } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCountdown } from '../hooks/useCountdown'
import { playAlarm } from '../lib/sound'
import type { TimerSettings } from '../types'
import { FlipDigit } from './FlipDigit'

interface FlipTimerProps {
  settings: TimerSettings
  onOpenSettings: () => void
  disabled?: boolean
}

export function FlipTimer({ settings, onOpenSettings, disabled = false }: FlipTimerProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { minutes, seconds, running, warningLevel, adjustMinutes, adjustSeconds, start, pause, stop } = useCountdown(() =>
    playAlarm(settings.alarmSound),
  )
  const activeWarningLevel = settings.warningEnabled ? warningLevel : 'none'
  const remainingTotal = minutes * 60 + seconds

  useEffect(() => {
    if (disabled) setMenuOpen(false)
  }, [disabled])

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-clock p-3 shadow-lg">
      <div className="flex w-full items-center gap-1">
        <FlipDigit value={mm[0]} warningLevel={activeWarningLevel} />
        <FlipDigit value={mm[1]} warningLevel={activeWarningLevel} />
        <span className="shrink-0 px-0.5 font-black text-clock-foreground" style={{ fontSize: 'clamp(1rem, 4.5vmin, 2.4rem)' }}>
          :
        </span>
        <FlipDigit value={ss[0]} warningLevel={activeWarningLevel} />
        <FlipDigit value={ss[1]} warningLevel={activeWarningLevel} />
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold text-clock-foreground hover:bg-black/10 disabled:pointer-events-none disabled:opacity-30"
      >
        {menuOpen ? 'Hide controls' : 'Timer controls'}
        <motion.span animate={{ rotate: menuOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
          <ChevronDown size={14} />
        </motion.span>
      </button>

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
              <SymbolButton disabled={disabled || (!running && remainingTotal <= 0)} onClick={stop} title="Stop">
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
