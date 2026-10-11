import { CircleCheck, Pointer } from 'lucide-react'
import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import type { AvatarScope } from '../../hooks/useClasses'
import { STICKER_THEMES, stickerSrc } from '../../lib/stickers'
import type { ClassData } from '../../types'
import { Btn, NextButton, States } from './parts'

interface AvatarsSectionProps {
  activeClass: ClassData
  onSetAvatarsOff: (off: boolean) => void
  /** Students come up to the board and choose their own (Choose Your Avatar); the window closes. */
  onStudentsChoose: () => void
  /** The group cards cover the desks: choosing waits until the activity is over. */
  studentsChooseBlocked: boolean
  onAssignAvatars: (themeId: string, options: { scope: AvatarScope; poses: 'mixed' | 'same' }) => void
  onNext: () => void
}

/**
 * Avatars, all in one place: on or off for the class (each student's own pick is kept either way),
 * a character for the whole class in one tap - right here, not in a second window - and the
 * children choosing their own at the board. One student's own avatar is chosen from their picture
 * in Students.
 */
export function AvatarsSection({
  activeClass,
  onSetAvatarsOff,
  onStudentsChoose,
  studentsChooseBlocked,
  onAssignAvatars,
  onNext,
}: AvatarsSectionProps) {
  const [scope, setScope] = useState<AvatarScope>('all')
  const [poses, setPoses] = useState<'mixed' | 'same'>('mixed')
  const [given, setGiven] = useState<number | null>(null)
  const off = activeClass.avatarsOff === true
  const students = activeClass.students
  const boys = students.filter((s) => s.gender === 'boy').length
  const girls = students.filter((s) => s.gender === 'girl').length
  const none = students.length === 0
  const seated = activeClass.seating.some(Boolean)

  function give(themeId: string) {
    onAssignAvatars(themeId, { scope, poses })
    setGiven(scope === 'all' ? students.length : scope === 'boy' ? boys : girls)
  }

  return (
    <>
      <div className="cs-group">
        <div className="cs-row">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3" data-guide="avatars-switch">
            <Switch
              checked={!off}
              onCheckedChange={(on) => {
                onSetAvatarsOff(!on)
                setGiven(null)
              }}
              aria-label="Avatars on the desks"
            />
            <span className="cs-row-label">
              <b>Avatars on the desks</b>
              <small>
                <States
                  on={!off}
                  onText="On: each student's avatar is on their desk."
                  offText="Off: names only. Each student's avatar is kept."
                />
              </small>
            </span>
          </label>
          {/* Not with avatars off: the children would choose one and not see it. */}
          <Btn
            data-guide="let-choose"
            disabled={off || !seated || studentsChooseBlocked}
            title={off ? 'Turn avatars on first' : studentsChooseBlocked ? 'Finish the group activity first' : undefined}
            onClick={onStudentsChoose}
          >
            <Pointer /> Let Students Choose
          </Btn>
        </div>
        <div
          className="cs-row cs-stack"
          data-guide="give-character"
          style={off || none ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="cs-row-label">
              {given !== null ? (
                <span className="cs-note text-emerald-700 dark:text-emerald-400">
                  <CircleCheck size={16} /> Given to {given} {given === 1 ? 'student' : 'students'}.
                </span>
              ) : (
                <b>Give the class a character</b>
              )}
            </div>
            <div className="cs-seg" role="group" aria-label="Who">
              <button type="button" aria-pressed={scope === 'all'} onClick={() => (setScope('all'), setGiven(null))}>
                Everyone ({students.length})
              </button>
              <button type="button" aria-pressed={scope === 'boy'} disabled={boys === 0} onClick={() => (setScope('boy'), setGiven(null))}>
                Boys ({boys})
              </button>
              <button
                type="button"
                aria-pressed={scope === 'girl'}
                disabled={girls === 0}
                onClick={() => (setScope('girl'), setGiven(null))}
              >
                Girls ({girls})
              </button>
            </div>
            <div className="cs-seg" role="group" aria-label="Poses">
              <button type="button" aria-pressed={poses === 'mixed'} onClick={() => (setPoses('mixed'), setGiven(null))}>
                Mixed poses
              </button>
              <button type="button" aria-pressed={poses === 'same'} onClick={() => (setPoses('same'), setGiven(null))}>
                Same pose
              </button>
            </div>
          </div>
          <div className="cs-pics cs-chars">
            {STICKER_THEMES.map((theme) => (
              <button key={theme.id} type="button" className="cs-pic" onClick={() => give(theme.id)}>
                <img src={stickerSrc(theme.id, theme.idle)} alt="" draggable={false} loading="lazy" />
                <span className="w-full truncate">{theme.label}</span>
              </button>
            ))}
          </div>
          <span className="cs-hint cs-hide-short">
            {given !== null ? 'Tap the same one again for new poses.' : 'To choose for one student, tap their picture in Students.'}
          </span>
        </div>
      </div>
      <div className="cs-foot">
        <div className="cs-right">
          <NextButton label="Points" onClick={onNext} />
        </div>
      </div>
    </>
  )
}
