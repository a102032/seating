import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NO_AVATAR, STICKER_THEMES, getTheme, hasNoAvatar, stickerId, stickerSrc } from '../lib/stickers'
import type { Student } from '../types'
import { Modal } from './Modal'
import { NoAvatarPicture } from './NoAvatarPicture'

interface AvatarPickerModalProps {
  open: boolean
  student: Student | null
  onClose: () => void
  onSelect: (avatarId: string) => void
}

export function AvatarPickerModal({ open, student, onClose, onSelect }: AvatarPickerModalProps) {
  const [themeId, setThemeId] = useState(STICKER_THEMES[0].id)

  // Open on the character the student already has, so changing just their pose is one step.
  useEffect(() => {
    if (!open || !student) return
    const current = student.avatarId?.split('/')[0]
    setThemeId(getTheme(current)?.id ?? STICKER_THEMES[0].id)
  }, [open, student])

  if (!student) return null
  const theme = getTheme(themeId) ?? STICKER_THEMES[0]

  return (
    <Modal open={open} onClose={onClose} title={`Choose an Avatar for ${student.name}`} size="xl">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <ScrollArea className="shrink-0">
          <div className="flex gap-1.5 pb-2">
            {/* First in the row: one tap gives this student just their name on the desk. It is a
                choice, not a pack to look through, so it is ticked when chosen rather than lit
                like the pack whose poses show below, and a rule sets it apart from the packs. */}
            <button
              type="button"
              onClick={() => onSelect(NO_AVATAR)}
              className="relative flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 border-transparent p-1.5 transition-colors hover:bg-accent active:scale-95"
            >
              {hasNoAvatar(student) && (
                <span className="absolute right-0.5 top-0.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
              <NoAvatarPicture className="h-12 w-12 text-foreground" />
              <span className="max-w-[5rem] truncate text-xs font-semibold text-foreground">No Avatar</span>
            </button>
            <span className="mx-1 w-px shrink-0 self-stretch bg-black/10 dark:bg-white/15" aria-hidden />
            {STICKER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                title={t.label}
                className={clsx(
                  'flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-colors active:scale-95',
                  t.id === themeId ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent',
                )}
              >
                <img src={stickerSrc(t.id, t.idle)} alt="" draggable={false} className="h-12 w-12 object-contain" />
                <span className="max-w-[5rem] truncate text-xs font-semibold text-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-black/10 dark:border-white/10">
          <div className="grid grid-cols-3 gap-3 p-3 sm:grid-cols-4 md:grid-cols-6">
            {theme.poses.map((pose) => {
              const id = stickerId(theme.id, pose)
              return (
                <button
                  key={pose}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={clsx(
                    'aspect-square rounded-2xl border-2 p-1.5 transition-colors active:scale-[0.97]',
                    student.avatarId === id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent',
                  )}
                >
                  <img
                    src={stickerSrc(theme.id, pose)}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    className="h-full w-full object-contain select-none pointer-events-none"
                  />
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </Modal>
  )
}
