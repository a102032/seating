import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Minus, Pause, Play, Plus, Settings, Square, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useCountdown } from '../hooks/useCountdown'
import { playAlarm } from '../lib/sound'
import type { TimerSettings } from '../types'
import { FlipDigit } from './FlipDigit'
import { TactileButton } from './TactileButton'

interface FlipTimerProps {
  visible: boolean
  onClose: () => void
  settings: TimerSettings
  onOpenSettings: () => void
}

export function FlipTimer({ visible, onClose, settings, onOpenSettings }: FlipTimerProps) {
  const [menuOpen, setMenuOpen] = useState(true)
  const { minutes, seconds, running, isWarning, adjustMinutes, adjustSeconds, start, pause, stop } = useCountdown(() =>
    playAlarm(settings.alarmSound),
  )
  const warningActive = settings.warningEnabled && isWarning

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed right-4 top-16 z-40 flex flex-col items-center gap-2 rounded-2xl border-2 border-neutral-700 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <button
              onClick={onOpenSettings}
              className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              title="Timer settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white"
              title="Toggle controls"
            >
              <motion.span animate={{ rotate: menuOpen ? 180 : 0 }} className="block">
                <ChevronDown size={18} />
              </motion.span>
            </button>
            <button onClick={onClose} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white" title="Hide timer">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <FlipDigit value={mm[0]} warning={warningActive} />
            <FlipDigit value={mm[1]} warning={warningActive} />
            <span className="mx-0.5 font-black text-neutral-400" style={{ fontSize: 'clamp(1.2rem, 5vmin, 3rem)' }}>
              :
            </span>
            <FlipDigit value={ss[0]} warning={warningActive} />
            <FlipDigit value={ss[1]} warning={warningActive} />
          </div>

          <AnimatePresence initial={false}>
            {menuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex w-full flex-col items-center gap-2 overflow-hidden"
              >
                <div className="flex items-center gap-4 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-neutral-400">MIN</span>
                    <div className="flex items-center gap-1">
                      <SpinButton disabled={running} onClick={() => adjustMinutes(-1)}>
                        <Minus size={14} />
                      </SpinButton>
                      <SpinButton disabled={running} onClick={() => adjustMinutes(1)}>
                        <Plus size={14} />
                      </SpinButton>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-neutral-400">SEC</span>
                    <div className="flex items-center gap-1">
                      <SpinButton disabled={running} onClick={() => adjustSeconds(-1)}>
                        <Minus size={14} />
                      </SpinButton>
                      <SpinButton disabled={running} onClick={() => adjustSeconds(1)}>
                        <Plus size={14} />
                      </SpinButton>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {!running ? (
                    <TactileButton variant="primary" onClick={start}>
                      <Play size={16} /> Start
                    </TactileButton>
                  ) : (
                    <TactileButton onClick={pause}>
                      <Pause size={16} /> Pause
                    </TactileButton>
                  )}
                  <TactileButton variant="danger" onClick={stop}>
                    <Square size={16} /> Stop
                  </TactileButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SpinButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-neutral-600 bg-neutral-800 text-neutral-200 disabled:opacity-30"
    >
      {children}
    </motion.button>
  )
}
