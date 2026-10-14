import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Plus, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useShrinkToFit } from '../hooks/useShrinkToFit'
import type { ClassData } from '../types'
import { ConfirmModal } from './ConfirmModal'

interface ClassTitleProps {
  classes: ClassData[]
  activeClassId: string | null
  onSelectClass: (id: string) => void
  onOpenSettings: () => void
  /** Another class, from the foot of the class list; null when the teacher has the most there can be. */
  onNewClass: (() => void) | null
  /** Swap Seats or Attendance is on: a desk tap is the only thing that answers. */
  disabled: boolean
  /** Settings also stands down while students are at a locked board. */
  settingsDisabled: boolean
  /** Which side the rail is on: the tab is beside it, and the class list opens from the tab's rail edge, over the board. */
  side: 'left' | 'right'
}

/**
 * The class's name, with the class switcher's arrow and the gear for Class Settings beside it, in
 * its own tab in the top corner away from the rail (lib/topBar), apart from the goal meter: the
 * meter is the class's, these are the teacher's. The class list drops down over the board from
 * the window's edge.
 */
export function ClassTitle({
  classes,
  activeClassId,
  onSelectClass,
  onOpenSettings,
  onNewClass,
  disabled,
  settingsDisabled,
  side,
}: ClassTitleProps) {
  const [listOpen, setListOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<ClassData | null>(null)
  const activeClass = classes.find((c) => c.id === activeClassId)
  // The name shares its row with the class switcher and the settings gear, so a name that still
  // doesn't fit gives up a little size before it gives up letters.
  const nameRef = useShrinkToFit<HTMLSpanElement>(activeClass?.name, 0.75)
  // The list holds the other classes and New Class (2026-10-11: New Class left Class Settings' title
  // bar), so it is there with one class too, unless there can be no more.
  const hasList = classes.length > 1 || onNewClass !== null

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
    <div className="relative z-30 min-w-0">
      <div className="relative z-30 flex items-center gap-1">
        <span
          ref={nameRef}
          data-ink="class-name"
          className="truncate px-1 font-bold text-foreground"
          style={{ fontSize: 'calc(clamp(1rem, 1.9vmin, 1.3rem) * var(--fit, 1))' }}
        >
          {activeClass?.name}
        </span>
        {hasList && (
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            disabled={disabled}
            title="Switch class"
            data-class-list-button=""
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            <motion.span animate={{ rotate: listOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
              <ChevronDown size={18} />
            </motion.span>
          </button>
        )}
        {/*
          Class Settings is a gear beside the class's name. It said "Class Settings" beside it on
          the meter for a while (lesson one: two gears that looked alike sent the teacher to the
          wrong one first); with the side rail it is the one gear in the app, so it stands alone
          (2026-10-09). It stands down when a running activity is underneath, since settings
          rearrange the class, and when the board is locked for students.
        */}
        <button
          type="button"
          onClick={onOpenSettings}
          disabled={disabled || settingsDisabled}
          title="Class Settings"
          aria-label="Class Settings"
          className="flex shrink-0 items-center rounded-full p-1.5 text-muted-foreground hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <Settings className="size-[clamp(18px,3.8vh,24px)]" />
        </button>
      </div>

      {/*
        The class list opens over what is below, like a menu, rather than pushing anything down:
        on a board that gives the app 1280x559 it pushed Pick All and +/- off the bottom. A tap
        anywhere else closes it.
      */}
      {listOpen && hasList && (
        <button
          type="button"
          aria-label="Close the class list"
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => setListOpen(false)}
        />
      )}
      <AnimatePresence initial={false}>
        {listOpen && hasList && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            data-ink="menu"
            className={clsx(
              'absolute top-full z-30 mt-1.5 w-[clamp(14rem,24vmin,20rem)] rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl',
              side === 'left' ? 'left-0' : 'right-0',
            )}
          >
            <div className="flex flex-col gap-0.5" data-class-list="">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => requestSwitch(cls)}
                  aria-current={cls.id === activeClassId ? 'true' : undefined}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-bold transition-colors hover:bg-secondary active:scale-[0.98]"
                  style={{ fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{cls.name}</span>
                    <span className="block text-[0.8em] font-normal text-muted-foreground">
                      {cls.students.length
                        ? `${cls.students.length} ${cls.students.length === 1 ? 'student' : 'students'}`
                        : 'No students yet'}
                    </span>
                  </span>
                  {cls.id === activeClassId && <Check size={18} className="shrink-0 text-primary" />}
                </button>
              ))}
              {onNewClass && (
                <>
                  <div className="mx-2 my-1 h-px bg-border" />
                  <button
                    type="button"
                    data-new-class=""
                    onClick={() => {
                      setListOpen(false)
                      onNewClass()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-bold text-secondary-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
                    style={{ fontSize: 'clamp(0.8rem, 1.5vmin, 1.05rem)' }}
                  >
                    <Plus size={18} /> New Class
                  </button>
                </>
              )}
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
