import { Lock, LockOpen } from 'lucide-react'
import type { BoardLock } from '../hooks/useBoardLock'

/** The lock in the top bar's far corner (useBoardLock has why). */
export function BoardLockButton({
  locked,
  onToggle,
  buttonRef,
  size = 22,
  className,
}: {
  locked: boolean
  onToggle: () => void
  buttonRef: BoardLock['buttonRef']
  size?: number
  className?: string
}) {
  const label = locked ? 'Unlock the Board' : 'Lock the Board'
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={locked}
      data-board-lock={locked ? 'locked' : 'open'}
      className={className}
    >
      {locked ? <Lock size={size} /> : <LockOpen size={size} />}
    </button>
  )
}

/**
 * Over the whole app while it is locked, above the board, the rail and the timer but under the
 * windows (a celebration, a question), so nothing on the board can be touched. It is see-through:
 * the class sees the board as the teacher left it. A tap on the lock goes through to it; any other
 * tap just gives the lock a small wiggle, so a child learns it's locked without a sound or a word
 * in front of the class.
 */
export function BoardLockShield({ lock }: { lock: BoardLock }) {
  if (!lock.locked) return null
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const button = lock.buttonRef.current
    if (!button) return lock.toggle()
    const r = button.getBoundingClientRect()
    // A finger is wider than the icon: the lock answers to a little room round it.
    const pad = 8
    if (e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) {
      lock.toggle()
      return
    }
    button.animate([{ rotate: '0deg' }, { rotate: '-14deg' }, { rotate: '11deg' }, { rotate: '-6deg' }, { rotate: '0deg' }], {
      duration: 420,
      easing: 'ease-in-out',
    })
  }
  return (
    <div
      data-board-lock-shield=""
      className="fixed inset-0 z-[46]"
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
