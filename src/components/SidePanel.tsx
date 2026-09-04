import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, ChevronDown, Minus, Plus, Settings, Shuffle, SquareCheckBig, TriangleAlert, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Theme } from '../lib/theme'
import type { ClassData, TimerSettings } from '../types'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ConfirmModal } from './ConfirmModal'
import { FlipTimer } from './FlipTimer'
import { TactileButton } from './TactileButton'

interface SidePanelProps {
  classes: ClassData[]
  activeClassId: string | null
  onSelectClass: (id: string) => void
  swapMode: boolean
  onToggleSwap: () => void
  onPickStudent: () => void
  onPickRow: () => void
  rowLocked: boolean
  onOpenSettings: () => void
  onOpenPickerSettings: () => void
  timerSettings: TimerSettings
  onOpenTimerSettings: () => void
  side: 'left' | 'right'
  onToggleSide: () => void
  theme: Theme
  saveError: boolean
}

export function SidePanel({
  classes,
  activeClassId,
  onSelectClass,
  swapMode,
  onToggleSwap,
  onPickStudent,
  onPickRow,
  rowLocked,
  onOpenSettings,
  onOpenPickerSettings,
  timerSettings,
  onOpenTimerSettings,
  side,
  onToggleSide,
  theme,
  saveError,
}: SidePanelProps) {
  const [listOpen, setListOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<ClassData | null>(null)
  // Visual-only preview of the Select All / Deselect All state change - not wired to real desk selection yet.
  const [previewAllSelected, setPreviewAllSelected] = useState(false)

  const activeClass = classes.find((c) => c.id === activeClassId)

  useEffect(() => {
    if (swapMode) setListOpen(false)
  }, [swapMode])

  function requestSwitch(cls: ClassData) {
    if (cls.id === activeClassId) {
      setListOpen(false)
      return
    }
    setSwitchTarget(cls)
  }

  return (
    <aside
      className={clsx(
        'flex h-full w-56 shrink-0 flex-col gap-3 rounded-3xl border border-white/60 bg-card/70 p-3 shadow-xl shadow-black/5 backdrop-blur-xl backdrop-saturate-150 sm:w-64',
        'dark:border-white/10 dark:shadow-black/20',
      )}
    >
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate px-1 font-bold text-foreground" style={{ fontSize: 'clamp(1rem, 1.9vmin, 1.3rem)' }}>
            {activeClass?.name}
          </span>
          {classes.length > 1 && (
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              disabled={swapMode}
              title="Switch class"
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
            >
              <motion.span animate={{ rotate: listOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
                <ChevronDown size={18} />
              </motion.span>
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {listOpen && classes.length > 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-1.5 flex flex-col gap-1 pt-1">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => requestSwitch(cls)}
                    className={clsx(
                      'w-full truncate rounded-xl px-3 py-2 text-left font-semibold transition-colors active:scale-[0.98]',
                      cls.id === activeClassId
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                    style={{ fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FlipTimer settings={timerSettings} onOpenSettings={onOpenTimerSettings} disabled={swapMode} />

      <div className="flex shrink-0 flex-col gap-1.5">
        <div className="flex gap-1.5">
          <TactileButton onClick={onOpenSettings} disabled={swapMode} className="grow shrink basis-0 !px-2 justify-center">
            <Settings size={18} /> Settings
          </TactileButton>
          <TactileButton active={swapMode} onClick={onToggleSwap} className="grow shrink basis-0 !px-2 justify-center">
            <Shuffle size={18} /> Swap Seats
          </TactileButton>
        </div>
        <div className="rounded-2xl border border-black/10 p-2 dark:border-white/10">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pickers &amp; Points</span>
            <button
              type="button"
              onClick={onOpenPickerSettings}
              disabled={swapMode}
              title="Random picker settings"
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
            >
              <Settings size={15} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <TactileButton onClick={onPickStudent} disabled={swapMode} className="w-full justify-start">
              <User size={18} /> Pick Student
            </TactileButton>
            <TactileButton
              active={rowLocked}
              onClick={onPickRow}
              disabled={swapMode}
              className="w-full justify-start"
              title={rowLocked ? 'A row is locked - Pick Student now draws from it. Tap the row to clear it.' : undefined}
            >
              <Users size={18} /> Pick Row
            </TactileButton>
          </div>

          <div className="mt-1.5 flex items-stretch gap-1.5">
            <TactileButton
              active={previewAllSelected}
              disabled={swapMode}
              onClick={() => setPreviewAllSelected((v) => !v)}
              title={previewAllSelected ? 'Deselect All' : 'Select All'}
              className="h-[38px] w-[38px] shrink-0 !px-0 justify-center"
            >
              <SquareCheckBig size={18} />
            </TactileButton>
            <TactileButton disabled={swapMode} title="Deduct Point" className="h-[38px] flex-1 !px-0 justify-center">
              <Minus size={20} strokeWidth={2.75} />
            </TactileButton>
            <TactileButton disabled={swapMode} title="Award Point" className="h-[38px] flex-1 !px-0 justify-center">
              <Plus size={20} strokeWidth={2.75} />
            </TactileButton>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1" />

      {theme === 'school' && (
        <div className="flex shrink-0 items-center justify-center py-1">
          <img src="/branding/school-crest.png" alt="New Taipei City Yuteh Private School crest" className="w-20 select-none" draggable={false} />
        </div>
      )}

      <Separator />

      <div className="flex shrink-0 flex-col items-center gap-1.5">
        {saveError && (
          <Badge
            variant="outline"
            className="gap-1.5 border-amber-400/50 text-amber-600 dark:text-amber-400"
            title="Changes aren't saving on this device right now (storage may be full or private-browsing mode). Export a backup from Settings when you can."
          >
            <TriangleAlert size={12} />
            Not saving
          </Badge>
        )}
        <button
          type="button"
          onClick={onToggleSide}
          disabled={swapMode}
          title={`Move panel to the ${side === 'left' ? 'right' : 'left'}`}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowLeftRight size={16} />
        </button>
      </div>

      <ConfirmModal
        open={switchTarget !== null}
        title={`Switch to "${switchTarget?.name}"?`}
        message={`You'll now see "${switchTarget?.name}"'s seating chart instead of "${activeClass?.name}". Don't worry - "${activeClass?.name}" stays saved exactly as you left it, and you can switch back anytime.`}
        confirmLabel="Yes, Switch"
        cancelLabel="No"
        onCancel={() => setSwitchTarget(null)}
        onConfirm={() => {
          if (switchTarget) onSelectClass(switchTarget.id)
          setSwitchTarget(null)
          setListOpen(false)
        }}
      />
    </aside>
  )
}
