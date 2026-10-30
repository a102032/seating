import { Undo2 } from 'lucide-react'

/** What the toast says Undo took back. */
const TAKEN_BACK: Record<string, string> = {
  star: 'Star taken back.',
  stars: 'Stars taken back.',
  minus: 'Star given back.',
  away: 'Away mark taken back.',
  done: 'Done taken back.',
}

/**
 * One Undo for the last tap (2026-10-30, the teacher: "put it up and away out of reach of the
 * kids"): in the top bar's far corner, beside the board's lock, where a small child can't reach.
 * Always there, greyed with nothing to take back, so the lock and Full Screen beside it never move.
 * The board's second touch can't undo twice: once used it greys at once.
 */
export function UndoButton({ what, onUndo, toast }: { what: string | null; onUndo: () => void; toast: (text: string) => void }) {
  return (
    <button
      type="button"
      aria-label="Undo"
      title={what ? 'Undo the last tap' : 'Nothing to undo'}
      disabled={!what}
      data-undo={what ?? ''}
      onClick={() => {
        if (!what) return
        onUndo()
        toast(TAKEN_BACK[what] ?? 'Taken back.')
      }}
      className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Undo2 size={22} strokeWidth={2.4} />
    </button>
  )
}
