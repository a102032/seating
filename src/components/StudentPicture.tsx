import clsx from 'clsx'
import { usePhoto } from '../lib/photos'
import { hasNoAvatar, resolveAvatarSrc } from '../lib/stickers'
import type { Student } from '../types'

/**
 * A student's picture, as the board shows it: their photo, cut to a circle, while the class shows
 * photos and this computer has it; otherwise their character. Nothing while this computer looks
 * for its copy of the photo, a moment, rather than a flash of the cartoon first. `className` sizes
 * it the way the sticker always was (object-contain in its box); the circle follows from that.
 */
export function StudentPicture({ student, className }: { student: Pick<Student, 'id' | 'avatarId' | 'photo'>; className?: string }) {
  const photo = usePhoto(student.photo)
  if (photo === 'loading') return <span className={clsx('block', className)} aria-hidden />
  if (photo && photo !== 'missing') {
    return <img src={photo} alt="" draggable={false} className={clsx(className, 'student-photo')} />
  }
  // A photo not on this computer yet: the student's character meanwhile, even for a student whose
  // character was No Avatar, since a picture was chosen for them.
  const src = resolveAvatarSrc(student.photo && hasNoAvatar(student) ? { id: student.id } : student)
  return src ? <img src={src} alt="" draggable={false} className={className} /> : null
}
