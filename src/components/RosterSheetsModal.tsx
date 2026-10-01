import { FilePlus2, Sheet } from 'lucide-react'
import type { useDrive } from '../hooks/useDrive'
import type { DriveFile } from '../lib/drive'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { DriveLink, DriveProblem } from './GoogleTab'

interface RosterSheetsModalProps {
  open: boolean
  onClose: () => void
  drive: ReturnType<typeof useDrive>
  /** The roster sheets in the teacher's Drive folder, newest first; null while they're being looked for. */
  sheets: DriveFile[] | null
  onMakeSheet: () => void
  onImportSheet: (sheet: DriveFile) => void
  /** What the last import did, in a sentence. */
  imported: string | null
}

function changed(when: string | undefined): string {
  if (!when) return ''
  return `Changed ${new Date(when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

/**
 * Rosters from Google Sheets. The app makes the sheet - Name, Homeroom, and Boy or Girl as a
 * dropdown - in the teacher's Drive folder; the teacher fills it in, then picks it here and the
 * students come in. Only sheets the app made are listed: that is all Google's drive.file
 * permission lets it see, and it is the permission that needs no review and no school IT.
 */
export function RosterSheetsModal({ open, onClose, drive, sheets, onMakeSheet, onImportSheet, imported }: RosterSheetsModalProps) {
  const made = drive.done?.action === 'make' ? drive.done.file : null
  const problem = drive.problem && ['list', 'make', 'read'].includes(drive.problem.action) ? drive.problem.text : null
  return (
    <Modal open={open} onClose={onClose} title="Roster from Google Sheets">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TactileButton onClick={onMakeSheet} disabled={drive.busy !== null}>
            <FilePlus2 size={18} /> {drive.busy === 'make' ? 'Making it…' : 'Make a Roster Sheet'}
          </TactileButton>
          {made ? (
            <DriveLink file={made} before="Made" />
          ) : (
            <span className="text-sm text-muted-foreground">A ready-made Sheet to fill in, then import</span>
          )}
        </div>
        {made && <p className="text-sm text-muted-foreground">Open it, type in your class, then come back and tap it below.</p>}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted-foreground">Import from:</span>
          {sheets === null ? (
            <p className="rounded-2xl border border-black/10 p-4 text-center text-muted-foreground dark:border-white/10">
              {drive.busy === 'list' ? 'Looking in your Drive…' : 'Your roster sheets will show here.'}
            </p>
          ) : sheets.length === 0 ? (
            <p className="rounded-2xl border border-black/10 p-4 text-center text-muted-foreground dark:border-white/10">
              No roster sheets yet. Make one above.
            </p>
          ) : (
            <div className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto">
              {sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  onClick={() => onImportSheet(sheet)}
                  disabled={drive.busy !== null}
                  className="flex items-center gap-3 rounded-2xl border border-black/10 px-3.5 py-3 text-left hover:bg-accent active:scale-[0.99] disabled:opacity-50 dark:border-white/10"
                >
                  <Sheet size={22} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate font-bold text-foreground">{sheet.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {drive.busy === 'read' ? 'Reading…' : changed(sheet.modifiedTime)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {problem ? (
          <DriveProblem text={problem} />
        ) : (
          imported && <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{imported}</p>
        )}
      </div>
    </Modal>
  )
}
