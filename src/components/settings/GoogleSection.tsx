import { ImageDown } from 'lucide-react'
import { useState } from 'react'
import type { useCloudSync } from '../../hooks/useCloudSync'
import { useDrive } from '../../hooks/useDrive'
import { dateKey } from '../../lib/attendance'
import { Switch } from '@/components/ui/switch'
import { chartShowsPhotos, downloadPicture, drawSeatingChart, pictureBlob, pictureName } from '../../lib/chartPicture'
import { appFolder, FOLDER_NAME, savePicture, type DriveFile } from '../../lib/drive'
import type { ClassData } from '../../types'
import { GoogleG, Initial, SyncBadge } from '../Account'
import { Btn, Group, MoreRow, SubHead } from './parts'

/** A file the app just saved to Drive, as a link: tapped, it opens in a new tab. */
export function DriveLink({ file, before = 'Saved to' }: { file: DriveFile; before?: string }) {
  return (
    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
      {before}{' '}
      <a href={file.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        {file.name}
      </a>
    </span>
  )
}

export function DriveProblem({ text }: { text: string }) {
  return <span className="text-sm font-semibold text-destructive">{text}</span>
}

interface GoogleSectionProps {
  activeClass: ClassData
  cloud: ReturnType<typeof useCloudSync>
  onSwitchTeacher: () => void
  /** The printed chart with the students' photos, or not, whatever the board shows. */
  onSetChartPhotos: (on: boolean) => void
}

/**
 * Account (it was Google, 2026-10-26): signing in and Switch Teacher, the seating chart as a
 * picture, and in More options the chart to Drive, its photos and the Drive folder. Google Classroom was dropped (DECISIONS, Deliberately not building): a pasted roster does its job.
 */
export function GoogleSection({ activeClass, cloud, onSwitchTeacher, onSetChartPhotos }: GoogleSectionProps) {
  const { account } = cloud
  const drive = useDrive(account?.uid)
  const [drawing, setDrawing] = useState(false)
  // More options: the chart to Drive, its photos switch, and the Drive folder (2026-10-26).
  const [more, setMore] = useState(false)

  async function savePictureHere() {
    setDrawing(true)
    try {
      downloadPicture(await pictureBlob(await drawSeatingChart(activeClass)), pictureName(activeClass))
    } finally {
      setDrawing(false)
    }
  }

  // Straight from the tap: the first save in an hour opens Google's window, which a browser only
  // allows right after one. The picture is drawn once the way into Drive is open.
  const savePictureToDrive = () =>
    void drive.run('picture', async (token) =>
      savePicture(token, activeClass, await pictureBlob(await drawSeatingChart(activeClass)), pictureName(activeClass), dateKey()),
    )

  const hasPhotos = activeClass.students.some((s) => s.photo)
  const pictureState =
    drive.problem?.action === 'picture' ? (
      <DriveProblem text={drive.problem.text} />
    ) : drive.done?.action === 'picture' ? (
      <DriveLink file={drive.done.file} />
    ) : null

  if (more) {
    return (
      <>
        <SubHead back="Account" title="More options" onBack={() => setMore(false)} />
        <Group head="Seating chart">
          {account && (
            <div className="cs-row" data-guide="chart-drive">
              <div className="cs-row-label">
                <b>Save to Google Drive</b>
                {pictureState ?? <small>One picture a day in your Drive folder.</small>}
              </div>
              <Btn small onClick={savePictureToDrive} disabled={drive.busy !== null}>
                <GoogleG size={18} /> {drive.busy === 'picture' ? 'Saving…' : 'Save to Drive'}
              </Btn>
            </div>
          )}
          {/* Only once the class has photos: a substitute is who they help most. */}
          {hasPhotos && (
            <label className="cs-row" data-guide="chart-photos">
              <span className="cs-row-label">
                <b>Photos on the printable chart</b>
                <small>Off: each student&rsquo;s character.</small>
              </span>
              <Switch
                checked={chartShowsPhotos(activeClass)}
                onCheckedChange={onSetChartPhotos}
                aria-label="Photos on the printable chart"
              />
            </label>
          )}
        </Group>
        {account && (
          <Group head="Your Drive folder">
            <div className="cs-row" data-guide="drive">
              {/* Drive's own folder, grey, so a teacher knows what to look for there. */}
              <svg viewBox="0 0 24 24" className="size-8 shrink-0" aria-hidden>
                <path fill="#5f6368" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
              <div className="cs-row-label">
                <b>{FOLDER_NAME}</b>
                {drive.problem?.action === 'folder' ? (
                  <DriveProblem text={drive.problem.text} />
                ) : (
                  <small>Everything the app saves to Drive.</small>
                )}
              </div>
              {/* A link once the folder is known; until then, finding it is a tap of its own. */}
              {drive.folder ? (
                <a href={drive.folder} target="_blank" rel="noreferrer" data-slot="button" className="cs-btn cs-small">
                  <GoogleG size={18} /> Open in Drive
                </a>
              ) : (
                <Btn small onClick={() => void drive.run('folder', appFolder)} disabled={drive.busy !== null}>
                  <GoogleG size={18} /> {drive.busy === 'folder' ? 'Finding it…' : 'Find My Folder'}
                </Btn>
              )}
            </div>
          </Group>
        )}
      </>
    )
  }

  return (
    <>
      <Group head="Your account">
        <div className="cs-row cs-wrap" data-guide="account">
          {account ? (
            <>
              <Initial name={account.firstName} className="size-10 text-lg" />
              <div className="cs-row-label">
                <b className="truncate">{account.firstName}</b>
                <small className="truncate">{account.email}</small>
              </div>
              <SyncBadge status={cloud.status} needsSignIn={cloud.needsSignIn} />
              <Btn onClick={onSwitchTeacher}>Switch Teacher</Btn>
            </>
          ) : (
            <>
              <div className="cs-row-label">
                <b>Sign in</b>
                <small>Sign in to keep your classes safe, and to save to Google Drive.</small>
              </div>
              <Btn onClick={() => void cloud.signIn()} disabled={cloud.signingIn}>
                <GoogleG size={18} /> {cloud.signingIn ? 'Signing in…' : 'Sign in with Google'}
              </Btn>
              {cloud.signInError && <DriveProblem text={cloud.signInError} />}
            </>
          )}
        </div>
      </Group>
      <Group head="Seating chart">
        <div className="cs-row cs-wrap" data-guide="chart">
          <div className="cs-row-label">
            <b>A picture for a substitute</b>
            {pictureState ?? <small>The room as it is laid out today, to print or put on the classroom door.</small>}
          </div>
          <Btn kind="primary" onClick={() => void savePictureHere()} disabled={drawing}>
            <ImageDown /> {drawing ? 'Drawing…' : 'Save as Picture to Print'}
          </Btn>
        </div>
      </Group>
      {(account || hasPhotos) && (
        <MoreRow
          inside={[account && 'Save to Drive', hasPhotos && 'photos on the printable chart', account && 'your Drive folder']
            .filter(Boolean)
            .join(', ')}
          onClick={() => setMore(true)}
        />
      )}
    </>
  )
}
