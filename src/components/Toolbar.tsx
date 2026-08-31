import { Cloud, CloudOff, Settings, Shuffle, Timer, User, Users } from 'lucide-react'
import { TactileButton } from './TactileButton'

interface ToolbarProps {
  swapMode: boolean
  onToggleSwap: () => void
  onPickStudent: () => void
  onPickRow: () => void
  onOpenTimer: () => void
  onOpenSettings: () => void
  isCloudSynced: boolean
}

export function Toolbar({
  swapMode,
  onToggleSwap,
  onPickStudent,
  onPickRow,
  onOpenTimer,
  onOpenSettings,
  isCloudSynced,
}: ToolbarProps) {
  return (
    <div className="flex h-full items-center gap-1.5 sm:gap-2">
      <TactileButton active={swapMode} onClick={onToggleSwap} title="Toggle swap-seats mode">
        <Shuffle size={18} />
        <span className="hidden sm:inline">Swap Seats</span>
      </TactileButton>
      <TactileButton onClick={onPickStudent} title="Randomly pick a student">
        <User size={18} />
        <span className="hidden sm:inline">Pick Student</span>
      </TactileButton>
      <TactileButton onClick={onPickRow} title="Randomly pick a row">
        <Users size={18} />
        <span className="hidden sm:inline">Pick Row</span>
      </TactileButton>
      <TactileButton onClick={onOpenTimer} title="Open timer">
        <Timer size={18} />
        <span className="hidden sm:inline">Timer</span>
      </TactileButton>
      <TactileButton onClick={onOpenSettings} title="Class settings">
        <Settings size={18} />
        <span className="hidden sm:inline">Settings</span>
      </TactileButton>
      <div
        className="ml-auto flex items-center gap-1 px-2 text-neutral-400"
        title={isCloudSynced ? 'Synced live across devices' : 'Not connected to a shared database yet - saving on this device only'}
      >
        {isCloudSynced ? <Cloud size={18} /> : <CloudOff size={18} />}
      </div>
    </div>
  )
}
