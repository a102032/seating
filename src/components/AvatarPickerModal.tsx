import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AVATAR_LIBRARY, type LibraryAvatar } from '../lib/avatarLibrary'
import type { Student } from '../types'
import { Modal } from './Modal'

interface AvatarPickerModalProps {
  open: boolean
  student: Student | null
  onClose: () => void
  onSelect: (avatarId: string) => void
}

type TabId = 'boy' | 'girl' | 'holiday' | 'all'

const TABS: { id: TabId; label: string }[] = [
  { id: 'boy', label: 'Boy Avatars' },
  { id: 'girl', label: 'Girl Avatars' },
  { id: 'holiday', label: 'Holidays' },
  { id: 'all', label: 'All Avatars' },
]

function matchesTab(avatar: LibraryAvatar, tab: TabId): boolean {
  if (tab === 'all') return true
  if (tab === 'holiday') return avatar.isHoliday
  return avatar.gender === tab
}

export function AvatarPickerModal({ open, student, onClose, onSelect }: AvatarPickerModalProps) {
  const [tab, setTab] = useState<TabId>('all')

  // Default to the student's own gender tab each time the modal opens for someone new - the "all" tab stays one tap away.
  useEffect(() => {
    if (open && student) {
      setTab(student.gender === 'boy' ? 'boy' : student.gender === 'girl' ? 'girl' : 'all')
    }
  }, [open, student])

  const avatars = useMemo(
    () =>
      AVATAR_LIBRARY.filter((a) => matchesTab(a, tab)).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
      ),
    [tab],
  )

  if (!student) return null

  return (
    <Modal open={open} onClose={onClose} title={`Choose an Avatar for ${student.name}`} size="xl">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors active:scale-95',
                tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-secondary-foreground hover:bg-accent',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-black/10 dark:border-white/10">
          <div className="grid grid-cols-3 gap-3 p-3 sm:grid-cols-4 md:grid-cols-5">
            {avatars.map((avatar) => {
              const selected = student.avatarId === avatar.id
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => onSelect(avatar.id)}
                  className={clsx(
                    'flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition-colors active:scale-[0.97]',
                    selected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent',
                  )}
                >
                  <div
                    className="w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10"
                    style={{ aspectRatio: '768 / 1376' }}
                  >
                    <img
                      src={avatar.src}
                      alt=""
                      draggable={false}
                      loading="lazy"
                      className="h-full w-full object-contain select-none pointer-events-none"
                    />
                  </div>
                  <span className="text-center text-sm font-semibold leading-tight text-foreground">{avatar.label}</span>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </Modal>
  )
}
