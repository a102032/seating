import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useShrinkToFit } from '../hooks/useShrinkToFit'
import type { ClassData } from '../types'
import { ConfirmModal } from './ConfirmModal'

interface ClassTitleProps {
  classes: ClassData[]
  activeClassId: string | null
  onSelectClass: (id: string) => void
  onOpenSettings: () => void
  /** Swap Seats or Attendance is on: a desk tap is the only thing that answers. */
  disabled: boolean
  /** Settings also stands down while students are at a locked board. */
  settingsDisabled: boolean
  /**
   * Where it sits. In the side panel (no class goal on) the name has the top row to itself; on
   * the goal meter's end (a goal on) it is held to part of the bar, so the meter keeps its room,
   * and the class list drops down over the board from the right.
   */
  place: 'panel' | 'bar'
}

/**
 * The class's name, with the class switcher's arrow and the gear for Class Settings beside it.
 * With a class goal on it sits at the end of the goal meter, which it labels, and the goal's own
 * controls take its row on the side panel - buttons beside the meter took the eye from it.
 * With no goal there is no meter, so it stays at the top of the side panel.
 */
export function ClassTitle({ classes, activeClassId, onSelectClass, onOpenSettings, disabled, settingsDisabled, place }: ClassTitleProps) {
  const [listOpen, setListOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<ClassData | null>(null)
  const activeClass = classes.find((c) => c.id === activeClassId)
  // The name shares its row with the class switcher and the settings gear, so a name that still
  // doesn't fit gives up a little size before it gives up letters.
  const nameRef = useShrinkToFit<HTMLSpanElement>(activeClass?.name, 0.75)

  useEffect(() => {
    if (disabled) setListOpen(false)
  }, [disabled])

  function requestSwitch(cls: ClassData) {
    if (cls.id === activeClassId) {
      setListOpen(false)
      return
    }
    setSwitchTarget(cls)
  }

  return (
    // relative and above what is below, so the class list can open over it.
    // On the meter a hairline sets it apart from the count, so "32 / 50" and the name don't run together.
    <div className={clsx('relative z-30', place === 'panel' ? 'shrink-0' : 'min-w-0 max-w-[50%] shrink border-l border-border pl-2')}>
      <div className="relative z-30 flex items-center gap-1">
        <span
          ref={nameRef}
          data-ink="class-name"
          className="truncate px-1 font-bold text-foreground"
          style={{ fontSize: 'calc(clamp(1rem, 1.9vmin, 1.3rem) * var(--fit, 1))' }}
        >
          {activeClass?.name}
        </span>
        {classes.length > 1 && (
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            disabled={disabled}
            title="Switch class"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            <motion.span animate={{ rotate: listOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
              <ChevronDown size={18} />
            </motion.span>
          </button>
        )}
        {/*
          Class Settings is a gear beside the class's name, the way the pickers' settings are
          a gear beside theirs. It was a button with a word on the row below, and Attendance
          sat here instead, which left a long class name 67px and cut "Grade 4 English" to
          "Grade ...". It stands down when a running activity is underneath, since settings
          rearrange the class, and when the board is locked for students.
        */}
        {/* On the meter it says what it opens: two gears that look alike, and a "Class Settings"
            label only a mouse could make appear, sent the teacher to the wrong one first in
            lesson one. In the panel (no goal) there's no room for the words beside a long name. */}
        <button
          type="button"
          onClick={onOpenSettings}
          disabled={disabled || settingsDisabled}
          title="Class Settings"
          aria-label="Class Settings"
          className={clsx(
            'flex shrink-0 items-center gap-1 rounded-full p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30',
            place === 'panel' ? 'ml-auto' : 'pr-2.5',
          )}
        >
          <Settings size={18} />
          {place === 'bar' && (
            <span className="whitespace-nowrap font-semibold" style={{ fontSize: 'clamp(0.8rem, 1.5vmin, 1rem)' }}>
              Class Settings
            </span>
          )}
        </button>
      </div>

      {/*
        The class list opens over what is below, like a menu, rather than pushing anything down:
        on a board that gives the app 1280x559 it pushed Pick All and +/- off the bottom. A tap
        anywhere else closes it.
      */}
      {listOpen && classes.length > 1 && (
        <button
          type="button"
          aria-label="Close the class list"
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => setListOpen(false)}
        />
      )}
      <AnimatePresence initial={false}>
        {listOpen && classes.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            data-ink="menu"
            className={clsx(
              'absolute top-full z-30 mt-1.5 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl',
              place === 'panel' ? 'inset-x-0' : 'right-0 w-[clamp(14rem,24vmin,20rem)]',
            )}
          >
            <div className="flex flex-col gap-1">
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
    </div>
  )
}
