import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * The safety screen (the deep clean, 2026-10-26): if something on screen breaks, the board shows
 * this rather than going blank in front of the class. The classes are safe whatever broke: every
 * change was saved on this computer as it was made, and anything not yet in the teacher's account
 * waits to go up. A tap anywhere reloads, which goes straight back to the class (lib/resume), as a
 * refresh does.
 *
 * Drawn with nothing from the app - its own colours, no theme, no pictures but the mascot - since
 * whatever broke may be any of those. What went wrong is in small print at the foot, for the
 * teacher to send on, and in the browser's console.
 */
export class SafetyNet extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The safety screen caught this:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <button
        type="button"
        data-safety-screen=""
        onClick={() => window.location.reload()}
        className="fixed inset-0 flex h-[100dvh] w-[100dvw] cursor-pointer flex-col items-center justify-center gap-[3vmin] overflow-hidden px-6 text-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #2f7461 0%, #1c4a3d 70%, #143a30 100%)',
          color: '#f8fafc',
          fontFamily: "Andika, 'Comic Sans MS', system-ui, sans-serif",
        }}
      >
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-[28vmin] w-auto" draggable={false} />
        <span className="font-bold leading-tight" style={{ fontSize: 'clamp(2rem, 8vmin, 5rem)' }}>
          Your classes are safe.
        </span>
        <span
          className="rounded-full px-[1.2em] py-[0.4em] font-bold leading-tight"
          style={{ fontSize: 'clamp(1.4rem, 5.5vmin, 3.2rem)', background: '#fde047', color: '#1c4a3d' }}
        >
          Tap to reload.
        </span>
        <span className="absolute bottom-3 left-4 right-4 truncate text-xs" style={{ color: 'rgba(248, 250, 252, 0.45)' }}>
          {error.message}
        </span>
      </button>
    )
  }
}
