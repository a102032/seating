import type { BoardLock } from '../hooks/useBoardLock'

/*
 * The teacher's own lock icons (Flaticon, 2026-10-19; the originals are design/lock.svg and
 * design/unlock.svg), kept in their own colours: shut with an X, or swung open, they tell the two
 * apart by themselves, in every theme, with nothing lit behind them.
 */
/** Shut, with a red X: "don't touch", which a child reads without words. */
function LockedIcon({ size }: { size: number }) {
  return (
    <svg viewBox="-80 0 512 512.00038" width={size} height={size} aria-hidden="true">
      <path
        d="m297.535156 121.507812c0-65.332031-51.5625-118.621093-116.210937-121.394531-69.347657-2.976562-126.804688 53.46875-126.804688 122.878907v213.757812c0 16.425781 13.316407 29.738281 29.738281 29.738281 16.425782 0 29.738282-13.3125 29.738282-29.738281v-215.160156c0-34.226563 27.828125-62.074219 62.03125-62.074219s62.03125 27.847656 62.03125 62.074219v215.160156c0 16.425781 13.3125 29.738281 29.738281 29.738281 16.421875 0 29.734375-13.3125 29.734375-29.738281v-215.242188zm0 0"
        fill="#afb4c8"
      />
      <path
        d="m54.523438 122.992188v213.757812c0 16.425781 13.3125 29.738281 29.738281 29.738281 16.421875 0 29.738281-13.3125 29.738281-29.738281v-215.160156c0-34.226563 27.828125-62.074219 62.027344-62.074219v-59.5039062c-66.949219.0351562-121.503906 55.3437502-121.503906 122.9804692zm0 0"
        fill="#bec3d2"
      />
      <path
        d="m311.835938 512h-271.613282c-22.214844 0-40.222656-18.007812-40.222656-40.222656v-219.214844c0-22.210938 18.007812-40.222656 40.222656-40.222656h271.613282c22.214843 0 40.222656 18.007812 40.222656 40.222656v219.214844c0 22.214844-18.007813 40.222656-40.222656 40.222656zm0 0"
        fill="#f2cc40"
      />
      <path
        d="m40.222656 212.339844c-22.214844 0-40.222656 18.007812-40.222656 40.222656v219.214844c0 22.214844 18.007812 40.222656 40.222656 40.222656h135.804688v-299.660156zm0 0"
        fill="#fbe25f"
      />
      <path
        d="m197.242188 353.816406 38.148437-38.148437c5.859375-5.859375 5.859375-15.355469 0-21.210938-5.859375-5.859375-15.355469-5.859375-21.214844 0l-38.148437 38.148438-38.144532-38.148438c-5.859374-5.859375-15.355468-5.859375-21.214843 0-5.859375 5.855469-5.859375 15.355469 0 21.210938l38.148437 38.148437-38.148437 38.148438c-5.859375 5.859375-5.859375 15.355468 0 21.214844 2.929687 2.925781 6.769531 4.394531 10.605469 4.394531 3.839843 0 7.679687-1.464844 10.605468-4.394531l38.148438-38.148438 38.148437 38.144531c2.929688 2.929688 6.769531 4.394531 10.605469 4.394531 3.839844 0 7.679688-1.464843 10.609375-4.394531 5.855469-5.855469 5.855469-15.351562 0-21.210937zm0 0"
        fill="#cf4c88"
      />
      <path
        d="m137.882812 294.457031c-5.859374-5.859375-15.355468-5.859375-21.214843 0-5.859375 5.855469-5.859375 15.355469 0 21.210938l38.148437 38.148437-38.148437 38.148438c-5.859375 5.859375-5.859375 15.355468 0 21.214844 2.929687 2.925781 6.769531 4.394531 10.605469 4.394531 3.839843 0 7.679687-1.464844 10.605468-4.394531l38.148438-38.148438v-42.429688zm0 0"
        fill="#d26092"
      />
      <path
        d="m197.242188 353.816406 38.148437-38.148437c5.859375-5.859375 5.859375-15.355469 0-21.210938-5.859375-5.859375-15.355469-5.859375-21.214844 0l-38.148437 38.148438v42.425781l38.148437 38.148438c2.929688 2.925781 6.769531 4.394531 10.605469 4.394531 3.839844 0 7.679688-1.464844 10.609375-4.394531 5.855469-5.859376 5.855469-15.355469 0-21.214844zm0 0"
        fill="#cf4c88"
      />
    </svg>
  )
}

/** Swung open. */
function OpenLockIcon({ size }: { size: number }) {
  return (
    <svg viewBox="-12 0 512 512" width={size} height={size} aria-hidden="true">
      <path
        d="m268.152344 316.210938c16.832031-.105469 30.421875-13.78125 30.421875-30.617188v-160.417969c0-35.238281 28.648437-63.902343 63.859375-63.902343 35.214844 0 63.859375 28.664062 63.859375 63.902343v74.921875c0 11.355469 9.207031 20.5625 20.5625 20.5625h20.109375c11.351562 0 20.558594-9.207031 20.558594-20.5625v-7.046875l-14.039063-16.976562 14.039063-27.671875v-23.3125c0-69.085938-56.003907-125.089844-125.089844-125.089844-69.082032 0-125.085938 56.003906-125.085938 125.089844v160.503906c0 16.984375 13.820313 30.71875 30.804688 30.617188zm0 0"
        fill="#bec3d2"
      />
      <path
        d="m322.210938 512h-281.988282c-22.214844 0-40.222656-18.007812-40.222656-40.222656v-235.679688c0-22.214844 18.007812-40.222656 40.222656-40.222656h281.988282c22.214843 0 40.222656 18.007812 40.222656 40.222656v235.679688c0 22.214844-18.007813 40.222656-40.222656 40.222656zm0 0"
        fill="#f2cc40"
      />
      <path
        d="m41.410156 195.875c-22.871094 0-41.410156 18.539062-41.410156 41.40625v233.308594c0 22.871094 18.539062 41.410156 41.410156 41.410156h139.808594v-316.125zm0 0"
        fill="#fbe25f"
      />
      <path
        d="m223.425781 316.261719c0-23.730469-19.582031-42.886719-43.46875-42.191407-21.769531.636719-39.730469 18.144532-40.886719 39.890626-.734374 13.828124 5.199219 26.296874 14.867188 34.496093l-8.355469 64.890625c-1.035156 8.023438 5.214844 15.125 13.304688 15.125h44.664062c8.089844 0 14.335938-7.101562 13.304688-15.125l-8.355469-64.890625c9.128906-7.742187 14.925781-19.289062 14.925781-32.195312zm0 0"
        fill="#2b608e"
      />
      <path
        d="m179.957031 274.070312c-21.769531.636719-39.730469 18.144532-40.886719 39.886719-.734374 13.832031 5.199219 26.300781 14.867188 34.5l-8.355469 64.890625c-1.035156 8.019532 5.214844 15.125 13.300781 15.125h22.335938v-154.40625c-.421875 0-.839844-.007812-1.261719.003906zm0 0"
        fill="#2b76ae"
      />
    </svg>
  )
}

/** The lock in the top bar's far corner (useBoardLock has why). */
export function BoardLockButton({
  locked,
  onToggle,
  buttonRef,
  size = 28,
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
      {locked ? <LockedIcon size={size} /> : <OpenLockIcon size={size} />}
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
