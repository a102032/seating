import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import type { RoomLayout } from '../../lib/layouts'
import type { Theme } from '../../lib/theme'
import type { ClassData } from '../../types'
import { LayoutPicker } from '../LayoutPicker'
import { ThemePicker } from '../ThemePicker'
import { Btn, Group, States } from './parts'

interface ClassSectionProps {
  activeClass: ClassData
  classes: ClassData[]
  onRename: (name: string) => void
  onSetLayout: (layout: RoomLayout, rows?: number) => void
  onSetShowAllHomerooms: (show: boolean) => void
  theme: Theme
  onSetTheme: (theme: Theme) => void
  onAskDelete: () => void
  /** Another class, made and opened here with the whole setup walked; greyed at the most a teacher keeps. */
  onNewClass: () => void
  canAddClass: boolean
}

/**
 * The class itself: its name, how the desks stand, and its colours; and the two things done to a
 * whole class, making another (at the foot) and deleting this one (beside its name). It is where
 * Class Settings opens (2026-10-26, the teacher). No line saying what to do: the boxes say it.
 */
export function ClassSection({
  activeClass,
  classes,
  onRename,
  onSetLayout,
  onSetShowAllHomerooms,
  theme,
  onSetTheme,
  onAskDelete,
  onNewClass,
  canAddClass,
}: ClassSectionProps) {
  const [name, setName] = useState(activeClass.name)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    setName(activeClass.name)
    setNameError(null)
  }, [activeClass.id, activeClass.name])

  function commitName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === activeClass.name) {
      // A cleared box goes back to the name the class still has, rather than sitting empty.
      setName(activeClass.name)
      setNameError(null)
      return
    }
    if (classes.some((c) => c.id !== activeClass.id && c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNameError(`You already have a class named "${trimmed}"`)
      return
    }
    setNameError(null)
    onRename(trimmed)
  }

  const showAll = activeClass.showAllHomerooms === true

  return (
    <>
      <Group head="Class Name">
        <div className="cs-row cs-wrap" style={{ rowGap: 4 }}>
          <input
            id="class-name"
            data-slot="input"
            data-guide="class-name"
            aria-label="Class Name"
            className="cs-box font-semibold"
            style={{ flex: '1 1 16rem', maxWidth: '26rem', ...(nameError ? { borderColor: 'var(--destructive)' } : {}) }}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(null)
            }}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          {/* Quiet, and it asks first, with the class's name typed to be sure. Beside the name it
              deletes (2026-10-26, the teacher). */}
          <Btn kind="quiet-red" small className="ml-auto" onClick={onAskDelete} data-guide="delete">
            <Trash2 /> Delete This Class
          </Btn>
          {nameError && <p className="cs-full text-sm font-semibold text-destructive">{nameError}</p>}
        </div>
      </Group>
      {/* Per class: classes can meet in different rooms. The number switch is about the desks, so
          it sits under them. Off, a number shows only after a name two students share - the app
          finds them (lib/sameNames). */}
      <Group head="Desk Layout">
        <div className="cs-row cs-stack">
          <LayoutPicker cls={activeClass} onSetLayout={onSetLayout} />
        </div>
        <label className="cs-row" data-guide="homerooms">
          <span className="cs-row-label">
            <b>Classroom number on every desk</b>
            <small>
              <States on={showAll} onText="On: after every name." offText="Off: only where two students share a name." />
            </small>
          </span>
          <Switch checked={showAll} onCheckedChange={onSetShowAllHomerooms} aria-label="Classroom number on every desk" />
        </label>
      </Group>
      <Group head="Color Theme" guide="theme">
        <div className="cs-row cs-stack">
          <ThemePicker theme={theme} onSetTheme={onSetTheme} />
        </div>
      </Group>
      <div className="cs-foot">
        {/* New Class, where a teacher looks for it (2026-10-12), in the section about the class
            (2026-10-26, the teacher). Greyed with its reason at five, rather than gone. */}
        <Btn data-guide="new-class" disabled={!canAddClass} onClick={onNewClass}>
          <Plus /> Create a New Class
        </Btn>
        {!canAddClass && <span className="cs-hint">5 classes at most</span>}
      </div>
    </>
  )
}
