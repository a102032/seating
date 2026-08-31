import clsx from 'clsx'
import { ArrowLeftRight, Cloud, CloudOff, Plus, Settings, Shuffle, Timer, User, Users } from 'lucide-react'
import type { ClassData } from '../types'
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
  timerVisible: boolean
  onToggleTimer: () => void
  onOpenSettings: () => void
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
  timerVisible,
  onToggleTimer,
  onOpenSettings,
  isCloudSynced,
  side,
  onToggleSide,
}: SidePanelProps) {
  return (
    <aside
      className={clsx(
        'flex h-full w-52 shrink-0 flex-col gap-3 rounded-2xl border-2 border-neutral-200 bg-neutral-100 p-3 sm:w-60',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-neutral-400">Classes</p>
        {classes.map((cls) => (
          <button
            key={cls.id}
            type="button"
            onClick={() => onSelectClass(cls.id)}
            className={clsx(
              'w-full shrink-0 truncate rounded-lg border-2 px-3 py-2 text-left font-bold transition-all active:scale-[0.98]',
              cls.id === activeClassId
                ? 'border-indigo-600 bg-indigo-600 text-white shadow'
                : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50',
            )}
            style={{ fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
          >
            {cls.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onCreateClass}
          className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-neutral-300 px-3 py-2 font-semibold text-neutral-500 hover:bg-neutral-50 active:scale-[0.98]"
        >
          <Plus size={16} /> New Class
        </button>
      </div>

      <div className="h-px shrink-0 bg-neutral-300" />

      <div className="flex shrink-0 flex-col gap-2">
        <TactileButton active={swapMode} onClick={onToggleSwap} className="w-full justify-start">
          <Shuffle size={18} /> Swap Seats
        </TactileButton>
        <TactileButton onClick={onPickStudent} className="w-full justify-start">
          <User size={18} /> Pick Student
        </TactileButton>
        <TactileButton onClick={onPickRow} className="w-full justify-start">
          <Users size={18} /> Pick Row
        </TactileButton>
        <TactileButton active={timerVisible} onClick={onToggleTimer} className="w-full justify-start">
          <Timer size={18} /> Timer
        </TactileButton>
        <TactileButton onClick={onOpenSettings} className="w-full justify-start">
          <Settings size={18} /> Settings
        </TactileButton>
      </div>

      <div className="h-px shrink-0 bg-neutral-300" />

      <div className="flex shrink-0 items-center justify-between gap-2">
        <div
          className="flex items-center gap-1.5 px-1 text-neutral-400"
          title={isCloudSynced ? 'Synced live across devices' : 'Not connected to a shared database yet - saving on this device only'}
        >
          {isCloudSynced ? <Cloud size={18} /> : <CloudOff size={18} />}
          <span className="text-xs font-semibold">{isCloudSynced ? 'Synced' : 'Local only'}</span>
        </div>
        <button
          type="button"
          onClick={onToggleSide}
          title={`Move panel to the ${side === 'left' ? 'right' : 'left'}`}
          className="rounded-lg border-2 border-neutral-300 bg-white p-1.5 text-neutral-500 hover:bg-neutral-50 active:scale-95"
        >
          <ArrowLeftRight size={16} />
        </button>
      </div>
    </aside>
  )
}
