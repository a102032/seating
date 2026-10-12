import clsx from 'clsx'
import { Check, CircleUserRound, ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NO_AVATAR, STICKER_THEMES, getTheme, hasNoAvatar, stickerId, stickerSrc } from '../lib/stickers'
import type { Student } from '../types'
import { Modal } from './Modal'
import { NoAvatarPicture } from './NoAvatarPicture'
import { Btn } from './settings/parts'
import { StudentPicture } from './StudentPicture'

interface AvatarPickerModalProps {
  open: boolean
  student: Student | null
  onClose: () => void
  onSelect: (avatarId: string) => void
  /**
   * The class shows photos: the student's photo comes first, chosen from a file (Add Photos'
   * window frames it), or taken away.
   */
  photo?: { onChoose: (file: File) => void; onAskRemove: () => void }
}

/** The photo is the first "pack", picked like the characters are. */
const PHOTO = 'photo'

export function AvatarPickerModal({ open, student, onClose, onSelect, photo }: AvatarPickerModalProps) {
  const [themeId, setThemeId] = useState(STICKER_THEMES[0].id)
  const file = useRef<HTMLInputElement>(null)
  const photos = photo !== undefined

  // Open on the character the student already has, so changing just their pose is one step - or
  // on their photo, while the class shows photos.
  useEffect(() => {
    if (!open || !student) return
    const current = student.avatarId?.split('/')[0]
    setThemeId(photos ? PHOTO : (getTheme(current)?.id ?? STICKER_THEMES[0].id))
  }, [open, student, photos])

  if (!student) return null
  const onPhoto = photos && themeId === PHOTO
  const theme = getTheme(themeId) ?? STICKER_THEMES[0]

  return (
    <Modal open={open} onClose={onClose} title={`Choose an Avatar for ${student.name}`} size="xl">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <ScrollArea className="shrink-0">
          <div className="flex gap-1.5 pb-2">
            {photos && (
              <button
                type="button"
                onClick={() => setThemeId(PHOTO)}
                className={clsx(
                  'relative flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-colors active:scale-95',
                  onPhoto ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent',
                )}
              >
                {student.photo ? (
                  <StudentPicture student={student} className="h-12 w-12 object-contain" />
                ) : (
                  <CircleUserRound className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
                )}
                <span className="max-w-[5rem] truncate text-xs font-semibold text-foreground">Photo</span>
              </button>
            )}
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

        {onPhoto ? (
          // Their photo, as big as the room allows, and what can be done with it.
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-black/10 p-4 dark:border-white/10">
            {student.photo ? (
              <StudentPicture student={student} className="ph-circle object-contain" />
            ) : (
              <CircleUserRound className="h-32 min-h-0 w-32 text-muted-foreground" strokeWidth={1} />
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Btn kind="primary" onClick={() => file.current?.click()}>
                <ImagePlus /> {student.photo ? 'Change Photo' : 'Choose a Photo'}
              </Btn>
              {student.photo && (
                <Btn kind="quiet-red" onClick={photo.onAskRemove}>
                  <Trash2 /> Remove Photo
                </Btn>
              )}
            </div>
            <span className="cs-hint text-center">The face is found and framed for you. Only the circle goes to your Google Drive.</span>
            <input
              ref={file}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                const chosen = e.target.files?.[0]
                e.target.value = ''
                if (chosen) photo.onChoose(chosen)
              }}
            />
          </div>
        ) : (
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
        )}
      </div>
    </Modal>
  )
}
