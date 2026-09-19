import clsx from 'clsx'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AvatarScope } from '../hooks/useClasses'
import { STICKER_THEMES, stickerSrc } from '../lib/stickers'
import type { Student } from '../types'
import { Modal } from './Modal'

type PoseMode = 'mixed' | 'same'

interface ClassAvatarsModalProps {
  open: boolean
  students: Student[]
  onClose: () => void
  onAssign: (themeId: string, options: { scope: AvatarScope; poses: PoseMode }) => void
}

/** A row of choices that reads as one control, the way a segmented iOS switch does. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <div className="flex gap-1 rounded-full bg-black/5 p-1 dark:bg-white/10">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-semibold transition-colors',
              option.disabled && 'cursor-not-allowed opacity-35',
              option.value === value
                ? 'bg-card text-foreground shadow-sm'
                : !option.disabled && 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ClassAvatarsModal({ open, students, onClose, onAssign }: ClassAvatarsModalProps) {
  const [scope, setScope] = useState<AvatarScope>('all')
  const [poses, setPoses] = useState<PoseMode>('mixed')
  // The character last handed out, so the grid can show what the class is wearing.
  const [appliedThemeId, setAppliedThemeId] = useState<string | null>(null)

  const boys = students.filter((s) => s.gender === 'boy').length
  const girls = students.filter((s) => s.gender === 'girl').length
  const affected = scope === 'all' ? students.length : scope === 'boy' ? boys : girls

  function choose(themeId: string) {
    onAssign(themeId, { scope, poses })
    setAppliedThemeId(themeId)
  }

  // Switching who or how should not leave a tick on a character the new setting hasn't touched.
  function changeScope(next: AvatarScope) {
    setScope(next)
    setAppliedThemeId(null)
  }

  function changePoses(next: PoseMode) {
    setPoses(next)
    setAppliedThemeId(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="Avatars for the Whole Class" size="xl">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
          <Segmented
            label="Who"
            value={scope}
            onChange={changeScope}
            options={[
              { value: 'all', label: `Everyone (${students.length})` },
              { value: 'boy', label: `Boys (${boys})`, disabled: boys === 0 },
              { value: 'girl', label: `Girls (${girls})`, disabled: girls === 0 },
            ]}
          />
          <Segmented
            label="Poses"
            value={poses}
            onChange={changePoses}
            options={[
              { value: 'mixed', label: 'Mixed' },
              { value: 'same', label: 'Same for all' },
            ]}
          />
        </div>

        <p className="shrink-0 text-sm text-muted-foreground">
          {affected === 0
            ? 'Nobody in the roster matches that group yet.'
            : appliedThemeId
              ? 'Done. Tap the same character again for a different set of poses.'
              : `Tap a character to give it to ${affected} student${affected === 1 ? '' : 's'}.`}
        </p>

        <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-black/10 dark:border-white/10">
          <div className="grid grid-cols-3 gap-3 p-3 sm:grid-cols-4 md:grid-cols-5">
            {STICKER_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                disabled={affected === 0}
                onClick={() => choose(theme.id)}
                className={clsx(
                  'relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-colors active:scale-[0.97]',
                  affected === 0 && 'cursor-not-allowed opacity-40',
                  theme.id === appliedThemeId ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent',
                )}
              >
                {theme.id === appliedThemeId && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <img
                  src={stickerSrc(theme.id, theme.idle)}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  className="h-20 w-20 object-contain select-none pointer-events-none"
                />
                <span className="w-full truncate text-center text-xs font-bold text-foreground">{theme.label}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Modal>
  )
}
