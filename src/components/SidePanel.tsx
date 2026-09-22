import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, ChevronDown, Layers, Minus, Plus, Settings, Shuffle, TriangleAlert, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  /** Pick Student is currently confined to the row that was picked. */
  rowLockBinds: boolean
  /** A student pick is flashing or its winner is on the board. */
  studentPickActive: boolean
  /** A row pick is flashing or its winner is on the board. */
  rowPickActive: boolean
  onOpenSettings: () => void
  onOpenPickerSettings: () => void
  timerSettings: TimerSettings
  onOpenTimerSettings: () => void
  side: 'left' | 'right'
  onToggleSide: () => void
  saveError: boolean
  pointsSelectedCount: number
  allSeatedSelected: boolean
  onToggleSelectAll: () => void
  onAwardPoint: () => void
  onDeductPoint: () => void
  flipDeckOpen: boolean
  onToggleFlipDeck: () => void
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
  rowLockBinds,
  studentPickActive,
  rowPickActive,
  onOpenSettings,
  onOpenPickerSettings,
  timerSettings,
  onOpenTimerSettings,
  side,
  onToggleSide,
  saveError,
  pointsSelectedCount,
  allSeatedSelected,
  onToggleSelectAll,
  onAwardPoint,
  onDeductPoint,
  flipDeckOpen,
  onToggleFlipDeck,
}: SidePanelProps) {
  const [listOpen, setListOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<ClassData | null>(null)

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
      data-ink="panel"
      className={clsx(
        'flex h-full w-56 shrink-0 flex-col gap-3 rounded-3xl border border-white/60 bg-card/70 p-3 shadow-xl shadow-black/5 backdrop-blur-xl backdrop-saturate-150 sm:w-64',
        'dark:border-white/10 dark:shadow-black/20',
      )}
    >
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-1">
          <span data-ink="class-name" className="truncate px-1 font-bold text-foreground" style={{ fontSize: 'clamp(1rem, 1.9vmin, 1.3rem)' }}>
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
        <div data-ink="group" className="rounded-2xl border border-black/10 p-2 dark:border-white/10">
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
            {/*
              The label says what the button will actually do. Picking a row quietly confines
              Pick Student to it, and the only thing that said so was a hover tooltip on the
              other button - which does not exist on a tablet, where this app is mostly used.
              No row number: rows carry no visible label on purpose, since teachers disagree
              about which end of the grid is the front of the room, so "this row" is the only
              honest way to name it. It reverts the moment the lock stops binding.
            */}
            <TactileButton active={studentPickActive} onClick={onPickStudent} disabled={swapMode} className="w-full justify-start">
              <User size={18} /> {rowLockBinds ? 'Pick from This Row' : 'Pick Student'}
            </TactileButton>
            <TactileButton
              active={rowLocked || rowPickActive}
              onClick={onPickRow}
              disabled={swapMode}
              className="w-full justify-start"
              title={rowLockBinds ? 'Picks are staying in this row. Tap any desk to go back to the whole class.' : undefined}
            >
              <Users size={18} /> Pick Row
            </TactileButton>
            <TactileButton active={flipDeckOpen} onClick={onToggleFlipDeck} disabled={swapMode} className="w-full justify-start">
              <Layers size={18} /> Flip Cards
            </TactileButton>
          </div>

          {/*
            Pick All used to be a bare icon square wedged between two other icon
            squares - nothing told it apart from +/- at a glance. It says the word
            now, in the vocabulary of the buttons above it (Pick Student, Pick Row),
            and +/- shrink to fixed icon-width to give it the room - they only ever
            needed a glyph, and the row already read "pick everyone, then +/-" left
            to right. No icon: the highlight is the state, the word is the action.
          */}
          <div className="mt-1.5 flex items-stretch gap-1.5">
            <TactileButton
              active={allSeatedSelected}
              disabled={swapMode}
              onClick={onToggleSelectAll}
              title={allSeatedSelected ? 'Unpick All' : 'Pick All'}
              className="h-[38px] flex-1 !px-2 justify-center"
            >
              {allSeatedSelected ? 'Unpick All' : 'Pick All'}
            </TactileButton>
            <TactileButton
              disabled={swapMode || pointsSelectedCount === 0}
              onClick={onDeductPoint}
              title="Deduct Point"
              className="h-[38px] w-9 shrink-0 !px-0 justify-center"
            >
              <Minus size={20} strokeWidth={2.75} />
            </TactileButton>
            <TactileButton
              disabled={swapMode || pointsSelectedCount === 0}
              onClick={onAwardPoint}
              title="Award Point"
              className="h-[38px] w-9 shrink-0 !px-0 justify-center"
            >
              <Plus size={20} strokeWidth={2.75} />
            </TactileButton>
          </div>
          {pointsSelectedCount > 0 && (
            <p className="mt-1 px-1 text-center text-xs font-medium text-muted-foreground">
              {pointsSelectedCount} student{pointsSelectedCount === 1 ? '' : 's'} selected
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1" />

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
