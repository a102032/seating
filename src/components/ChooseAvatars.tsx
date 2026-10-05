import clsx from 'clsx'
import { ArrowLeft, Check } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { STICKER_THEMES, friendlyPoses, getTheme, stickerId, stickerSrc } from '../lib/stickers'
import type { Student } from '../types'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

/** The board reads one touch as two: a tap that changes what is under the finger ignores the second. */
const TAP_GUARD_MS = 700

/**
 * Choose Your Avatar, at the board: the children asked to choose their own (lesson one). While it
 * is on, the bar over the board says what to do, and a tap on a desk opens a big picker for that
 * student. The teacher ends it with Done.
 */
export function ChooseAvatarBanner({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
      <span className="font-bold" style={{ fontSize: 'clamp(0.95rem, 2.2vmin, 1.4rem)' }}>
        Tap your desk. Choose your avatar!
      </span>
      <button
        type="button"
        onClick={onDone}
        className="rounded-xl bg-white/20 px-4 py-1 font-bold transition-transform active:scale-95"
        style={{ fontSize: 'clamp(0.85rem, 1.8vmin, 1.1rem)' }}
      >
        Done
      </button>
    </div>
  )
}

interface ChooseAvatarPickerProps {
  /** The student choosing, or null when nobody is. */
  student: Student | null
  onChoose: (avatarId: string) => void
  onClose: () => void
}

/**
 * One child's picker, in two big steps a young reader can follow: the characters, then that
 * character's poses, with Back between. Tiles are big for small fingers, and each step ignores
 * taps for a moment as it opens, since the board's second touch would land on whatever appears
 * under the finger.
 */
export function ChooseAvatarPicker({ student, onChoose, onClose }: ChooseAvatarPickerProps) {
  const open = student !== null
  const [themeId, setThemeId] = useState<string | null>(null)
  // Each child starts at the characters, not on the last child's pack.
  const [lastStudentId, setLastStudentId] = useState<string | null>(student?.id ?? null)
  if ((student?.id ?? null) !== lastStudentId) {
    setLastStudentId(student?.id ?? null)
    if (student) setThemeId(null)
  }
  const shownAt = useRef(0)
  useEffect(() => {
    if (open) shownAt.current = performance.now()
  }, [open, student?.id])

  // The student is remembered while the window fades out, so its title doesn't change as it goes.
  const [who, setWho] = useState<Student | null>(student)
  if (student && student !== who) setWho(student)

  const shown = useLingerWhileClosing(open)
  if (!shown || !who) return null

  const theme = themeId ? getTheme(themeId) : undefined
  const currentTheme = who.avatarId?.split('/')[0]
  const tooSoon = (e: MouseEvent) => e.timeStamp - shownAt.current < TAP_GUARD_MS

  function pickTheme(e: MouseEvent, id: string) {
    if (tooSoon(e)) return
    setThemeId(id)
    shownAt.current = e.timeStamp
  }

  function pickPose(e: MouseEvent, id: string) {
    if (tooSoon(e)) return
    onChoose(id)
  }

  const tile = 'relative flex flex-col items-center justify-center rounded-2xl border-[3px] p-2 transition-transform active:scale-95'

  return (
    <Modal open={open} onClose={onClose} title={theme ? 'Choose one!' : `${who.name}, choose your avatar!`} size="xl">
      <div className="flex flex-col gap-3">
        {theme && (
          <TactileButton onClick={() => setThemeId(null)} className="self-start">
            <ArrowLeft size={18} /> Back
          </TactileButton>
        )}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(5.5rem, 13vmin, 8.5rem), 1fr))' }}>
          {theme
            ? friendlyPoses(theme).map((pose) => {
                const id = stickerId(theme.id, pose)
                const mine = who.avatarId === id
                return (
                  <button
                    key={pose}
                    type="button"
                    onClick={(e) => pickPose(e, id)}
                    className={clsx(
                      tile,
                      'aspect-square',
                      mine ? 'border-primary bg-primary/10' : 'border-transparent bg-black/[0.03] dark:bg-white/5',
                    )}
                  >
                    {mine && <Tick />}
                    <img
                      src={stickerSrc(theme.id, pose)}
                      alt=""
                      draggable={false}
                      className="pointer-events-none h-full w-full select-none object-contain"
                    />
                  </button>
                )
              })
            : STICKER_THEMES.map((t) => {
                const mine = currentTheme === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => pickTheme(e, t.id)}
                    className={clsx(tile, mine ? 'border-primary bg-primary/10' : 'border-transparent bg-black/[0.03] dark:bg-white/5')}
                  >
                    {mine && <Tick />}
                    <img
                      src={stickerSrc(t.id, t.idle)}
                      alt=""
                      draggable={false}
                      className="pointer-events-none aspect-square w-full select-none object-contain"
                    />
                  </button>
                )
              })}
        </div>
      </div>
    </Modal>
  )
}

function Tick() {
  return (
    <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
      <Check size={14} strokeWidth={3} />
    </span>
  )
}
