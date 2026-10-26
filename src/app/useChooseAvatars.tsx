import { useRef, useState } from 'react'
import { ChooseAvatarPicker } from '../components/ChooseAvatars'
import type { ClassData } from '../types'

/** Choose Your Avatar: the children come up and tap their own desk to choose. */
export function useChooseAvatars() {
  const [on, setOn] = useState(false)
  /** Whose picker is open. */
  const [choosingFor, setChoosingFor] = useState<string | null>(null)
  /** When the last picker closed: the board's second touch lands on the desk under it. */
  const closedAt = useRef(0)

  return {
    on,
    choosingFor,
    start: () => setOn(true),
    stop: () => {
      setOn(false)
      setChoosingFor(null)
    },
    /** A child tapped their desk. */
    tapDesk: (studentId: string | null, absent: boolean) => {
      // Away today, they can choose another day; and a picker just closed leaves the board's
      // second touch on the same desk, which would open it again.
      if (!studentId || absent || performance.now() - closedAt.current < 700) return
      setChoosingFor(studentId)
    },
    closePicker: () => {
      closedAt.current = performance.now()
      setChoosingFor(null)
    },
  }
}

export type ChooseAvatars = ReturnType<typeof useChooseAvatars>

/** The student whose desk was tapped picks from the characters, then a pose. */
export function ChooseAvatarWindow({
  choosing,
  cls,
  onChoose,
}: {
  choosing: ChooseAvatars
  cls: ClassData
  onChoose: (studentId: string, avatarId: string) => void
}) {
  return (
    <ChooseAvatarPicker
      student={choosing.choosingFor ? (cls.students.find((s) => s.id === choosing.choosingFor) ?? null) : null}
      onChoose={(avatarId) => {
        if (choosing.choosingFor) onChoose(choosing.choosingFor, avatarId)
        choosing.closePicker()
      }}
      onClose={choosing.closePicker}
    />
  )
}
