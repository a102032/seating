import clsx from 'clsx'
import { ArrowLeftRight, Cloud, CloudOff, Plus, Settings, Shuffle, User, Users } from 'lucide-react'
import type { ClassData, TimerSettings } from '../types'
import { FlipTimer } from './FlipTimer'
import { TactileButton } from './TactileButton'

interface SidePanelProps {
  classes: ClassData[]
  activeClassId: string | null
  onSelectClass: (id: string) => void
  onCreateClass: () => void
  swapMode: boolean
  onToggleSwap: () => void
  onPickStudent: () => void
  onPickRow: () => void
  onOpenSettings: () => void
  timerSettings: TimerSettings
  onOpenTimerSettings: () => void
  isCloudSynced: boolean
  side: 'left' | 'right'
  onToggleSide: () => void
}

export function SidePanel({
  classes,
  activeClassId,
  onSelectClass,
  onCreateClass,
  swapMode,
  onToggleSwap,
  onPickStudent,
  onPickRow,
  onOpenSettings,
  timerSettings,
  onOpenTimerSettings,
  isCloudSynced,
  side,
  onToggleSide,
}: SidePanelProps) {
  return (
    <aside
      className={clsx(
        'flex h-full w-56 shrink-0 flex-col gap-3 rounded-3xl border border-white/60 bg-white/70 p-3 shadow-xl shadow-black/5 backdrop-blur-xl backdrop-saturate-150 sm:w-64',
        'dark:border-white/10 dark:bg-neutral-900/60 dark:shadow-black/20',
      )}
    >
      <FlipTimer settings={timerSettings} onOpenSettings={onOpenTimerSettings} />

      <div className="flex shrink-0 flex-col gap-1.5">
        <TactileButton onClick={onOpenSettings} className="w-full justify-start">
          <Settings size={18} /> Settings
        </TactileButton>
        <TactileButton active={swapMode} onClick={onToggleSwap} className="w-full justify-start">
          <Shuffle size={18} /> Swap Seats
        </TactileButton>
        <TactileButton onClick={onPickStudent} className="w-full justify-start">
          <User size={18} /> Pick Student
        </TactileButton>
        <TactileButton onClick={onPickRow} className="w-full justify-start">
          <Users size={18} /> Pick Row
        </TactileButton>
      </div>

      <div className="h-px shrink-0 bg-black/10 dark:bg-white/10" />

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Classes</p>
        {classes.map((cls) => (
          <button
            key={cls.id}
            type="button"
            onClick={() => onSelectClass(cls.id)}
            className={clsx(
              'w-full shrink-0 truncate rounded-xl px-3 py-2 text-left font-semibold transition-colors active:scale-[0.98]',
              cls.id === activeClassId
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                : 'text-neutral-600 hover:bg-black/[0.05] dark:text-neutral-300 dark:hover:bg-white/[0.08]',
            )}
            style={{ fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
          >
            {cls.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onCreateClass}
          className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/15 px-3 py-2 font-semibold text-neutral-500 hover:bg-black/[0.04] active:scale-[0.98] dark:border-white/15 dark:text-neutral-400 dark:hover:bg-white/[0.06]"
        >
          <Plus size={16} /> New Class
        </button>
      </div>

      <div className="h-px shrink-0 bg-black/10 dark:bg-white/10" />

      <div className="flex shrink-0 items-center justify-between gap-2">
        <div
          className="flex items-center gap-1.5 px-1 text-neutral-400 dark:text-neutral-500"
          title={isCloudSynced ? 'Synced live across devices' : 'Not connected to a shared database yet - saving on this device only'}
        >
          {isCloudSynced ? <Cloud size={18} /> : <CloudOff size={18} />}
          <span className="text-xs font-semibold">{isCloudSynced ? 'Synced' : 'Local only'}</span>
        </div>
        <button
          type="button"
          onClick={onToggleSide}
          title={`Move panel to the ${side === 'left' ? 'right' : 'left'}`}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-black/[0.05] active:scale-95 dark:text-neutral-400 dark:hover:bg-white/[0.08]"
        >
          <ArrowLeftRight size={16} />
        </button>
      </div>
    </aside>
  )
}
