import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import type { RoomLayout } from '../../lib/layouts'
import type { Theme } from '../../lib/theme'
import type { ClassData } from '../../types'
import { LayoutPicker } from '../LayoutPicker'
import { ThemePicker } from '../ThemePicker'
import { Btn, NextButton, States } from './parts'

interface ClassSectionProps {
  activeClass: ClassData
  classes: ClassData[]
  onRename: (name: string) => void
  onSetRoom: (room: string) => void
  onSetLayout: (layout: RoomLayout) => void
  onSetShowAllHomerooms: (show: boolean) => void
  theme: Theme
  onSetTheme: (theme: Theme) => void
  onAskDelete: () => void
  onNext: () => void
}

/**
 * The class itself: its name and the classroom it meets in, how the desks stand, and its colours.
 * No line saying what to do: the boxes say it themselves (2026-10-11, the teacher).
 */
export function ClassSection({
  activeClass,
  classes,
  onRename,
  onSetRoom,
  onSetLayout,
  onSetShowAllHomerooms,
  theme,
  onSetTheme,
  onAskDelete,
  onNext,
}: ClassSectionProps) {
  const [name, setName] = useState(activeClass.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [room, setRoom] = useState(activeClass.room ?? '')

  useEffect(() => {
    setName(activeClass.name)
    setNameError(null)
    setRoom(activeClass.room ?? '')
  }, [activeClass.id, activeClass.name, activeClass.room])

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
      <div className="cs-group">
        <div className="cs-row cs-wrap" style={{ gap: '10px 12px' }}>
          <span className="cs-field" data-guide="class-name" style={{ flex: '1 1 22rem', maxWidth: '30rem' }}>
            <label htmlFor="class-name" className="whitespace-nowrap font-bold">
              Class Name
            </label>
            <input
              id="class-name"
              data-slot="input"
              className="cs-box flex-1 font-semibold"
              style={nameError ? { borderColor: 'var(--destructive)' } : undefined}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
              onBlur={commitName}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </span>
          <span className="cs-field" data-guide="class-room">
            <label htmlFor="class-room" className="whitespace-nowrap font-bold">
              Classroom Number
            </label>
            <input
              id="class-room"
              data-slot="input"
              className="cs-box"
              style={{ width: '7rem' }}
              placeholder="e.g. 204"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onBlur={() => room.trim() !== (activeClass.room ?? '') && onSetRoom(room.trim())}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </span>
          {nameError && <p className="cs-full text-sm font-semibold text-destructive">{nameError}</p>}
        </div>
        {/* Per class: classes can meet in different rooms. The number switch is about the desks, so it
            sits under them. Off, a number shows only after a name two students share - the app finds
            them (lib/sameNames). */}
        <div className="cs-row cs-split cs-wrap">
          <div className="cs-row-label">
            <b>Desk Layout</b>
          </div>
          <LayoutPicker layout={activeClass.layout ?? 'rows'} onSetLayout={onSetLayout} />
          <label className="cs-state-switch cs-full" data-guide="homerooms">
            <Switch checked={showAll} onCheckedChange={onSetShowAllHomerooms} aria-label="Classroom number on every desk" />
            <States
              on={showAll}
              onText="On: Classroom number appears on every desk"
              offText="Off: Classroom number only appears on the desks of students who have the same name"
            />
          </label>
        </div>
        <div className="cs-row cs-split" data-guide="theme">
          <div className="cs-row-label">
            <b>App Color Theme</b>
            <small>Pick a color theme for this class</small>
          </div>
          <ThemePicker theme={theme} onSetTheme={onSetTheme} />
        </div>
      </div>
      <div className="cs-foot">
        {/* Quiet, and it asks first, with the class's name typed to be sure. */}
        <Btn kind="quiet-red" small onClick={onAskDelete} data-guide="delete">
          <Trash2 /> Delete Class
        </Btn>
        <div className="cs-right">
          <NextButton label="Students" onClick={onNext} />
        </div>
      </div>
    </>
  )
}
