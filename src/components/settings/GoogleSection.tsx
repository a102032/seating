import { ImageDown } from 'lucide-react'
import { useState } from 'react'
import type { useCloudSync } from '../../hooks/useCloudSync'
import { useDrive } from '../../hooks/useDrive'
import { dateKey } from '../../lib/attendance'
import { downloadPicture, drawSeatingChart, pictureBlob, pictureName } from '../../lib/chartPicture'
import { appFolder, FOLDER_NAME, savePicture, type DriveFile } from '../../lib/drive'
import type { ClassData } from '../../types'
import { GoogleG, Initial, SyncBadge } from '../Account'
import { Btn } from './parts'

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
}

/**
 * Everything Google in one place: the account, the seating chart as a picture, and the Drive
 * folder. Google Classroom is to come, once the school's answer about it is in (Next up).
 */
export function GoogleSection({ activeClass, cloud, onSwitchTeacher }: GoogleSectionProps) {
  const { account } = cloud
  const drive = useDrive(account?.uid)
  const [drawing, setDrawing] = useState(false)

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

  return (
    <>
      <div className="cs-page-head">
        <p>Your account, and what the app saves to Drive.</p>
      </div>
      <div className="cs-group">
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
                <b>Your account</b>
                <small>Sign in to keep your classes safe, and to save to Google Drive.</small>
              </div>
              <Btn onClick={() => void cloud.signIn()} disabled={cloud.signingIn}>
                <GoogleG size={18} /> {cloud.signingIn ? 'Signing in…' : 'Sign in with Google'}
              </Btn>
              {cloud.signInError && <DriveProblem text={cloud.signInError} />}
            </>
          )}
        </div>
        <div className="cs-row cs-wrap" data-guide="chart">
          <div className="cs-row-label">
            <b>Seating chart</b>
            {drive.problem?.action === 'picture' ? (
              <DriveProblem text={drive.problem.text} />
            ) : drive.done?.action === 'picture' ? (
              <DriveLink file={drive.done.file} />
            ) : (
              <small>A picture for a substitute, or the classroom door.</small>
            )}
          </div>
          <Btn onClick={() => void savePictureHere()} disabled={drawing}>
            <ImageDown /> {drawing ? 'Drawing…' : 'Save as Picture to Print'}
          </Btn>
          {account && (
            <Btn onClick={savePictureToDrive} disabled={drive.busy !== null}>
              <GoogleG size={18} /> {drive.busy === 'picture' ? 'Saving…' : 'Save to Drive'}
            </Btn>
          )}
        </div>
        {account && (
          <div className="cs-row cs-wrap" data-guide="drive">
            <div className="cs-row-label">
              <b>Your Drive folder</b>
              {drive.problem?.action === 'folder' ? (
                <DriveProblem text={drive.problem.text} />
              ) : (
                <small>Everything the app saves goes in one folder, {FOLDER_NAME}</small>
              )}
            </div>
            {/* A link once the folder is known; until then, finding it is a tap of its own. */}
            {drive.folder ? (
              <a href={drive.folder} target="_blank" rel="noreferrer" data-slot="button" className="cs-btn">
                <GoogleG size={18} /> Open in Drive
              </a>
            ) : (
              <Btn onClick={() => void drive.run('folder', appFolder)} disabled={drive.busy !== null}>
                <GoogleG size={18} /> {drive.busy === 'folder' ? 'Finding it…' : 'Find My Folder'}
              </Btn>
            )}
          </div>
        )}
      </div>
    </>
  )
}
