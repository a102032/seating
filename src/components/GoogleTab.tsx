import { ImageDown } from 'lucide-react'
import { useState } from 'react'
import type { useCloudSync } from '../hooks/useCloudSync'
import { useDrive } from '../hooks/useDrive'
import { dateKey } from '../lib/attendance'
import { downloadPicture, drawSeatingChart, pictureBlob, pictureName } from '../lib/chartPicture'
import { appFolder, FOLDER_NAME, savePicture, type DriveFile } from '../lib/drive'
import type { ClassData } from '../types'
import { buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { GoogleG, Initial, SyncBadge } from './Account'
import { TactileButton } from './TactileButton'

interface GoogleTabProps {
  activeClass: ClassData
  cloud: ReturnType<typeof useCloudSync>
  onSwitchTeacher: () => void
}

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

/**
 * Class Settings' third tab: everything Google in one place, beside Students and Class, which are
 * about the class itself. The account, the seating chart as a picture, and the Drive folder.
 * Google Classroom is to come, once the school's answer about it is in (Next up).
 */
export function GoogleTab({ activeClass, cloud, onSwitchTeacher }: GoogleTabProps) {
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

  // Straight from the tap: the first save in an hour opens Google's window, which a browser
  // only allows right after one. The picture is drawn once the way into Drive is open.
  const savePictureToDrive = () =>
    void drive.run('picture', async (token) =>
      savePicture(token, activeClass, await pictureBlob(await drawSeatingChart(activeClass)), pictureName(activeClass), dateKey()),
    )

  return (
    <div className="flex flex-col gap-3.5">
      <section className="shrink-0">
        <Label className="mb-1.5">Your Account</Label>
        {account ? (
          <div className="flex flex-wrap items-center gap-3">
            <Initial name={account.firstName} className="size-10 text-lg" />
            <div className="min-w-0">
              <div className="truncate font-bold text-foreground">{account.firstName}</div>
              <div className="truncate text-sm text-muted-foreground">{account.email}</div>
            </div>
            <SyncBadge status={cloud.status} needsSignIn={cloud.needsSignIn} />
            <TactileButton className="ml-auto" onClick={onSwitchTeacher}>
              Switch teacher
            </TactileButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Sign in to keep your classes safe, and to save to Google Drive.</p>
            <TactileButton className="ml-auto" onClick={() => void cloud.signIn()} disabled={cloud.signingIn}>
              <GoogleG size={18} /> {cloud.signingIn ? 'Signing in…' : 'Sign in with Google'}
            </TactileButton>
            {cloud.signInError && <DriveProblem text={cloud.signInError} />}
          </div>
        )}
      </section>

      <Separator className="shrink-0" />

      <section className="shrink-0">
        <Label className="mb-1.5">
          Seating Chart <span className="font-normal">(this class)</span>
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <TactileButton onClick={() => void savePictureHere()} disabled={drawing}>
            <ImageDown size={18} /> {drawing ? 'Drawing…' : 'Save as Picture'}
          </TactileButton>
          {account && (
            <TactileButton onClick={savePictureToDrive} disabled={drive.busy !== null}>
              <GoogleG size={18} /> {drive.busy === 'picture' ? 'Saving…' : 'Save to Google Drive'}
            </TactileButton>
          )}
          {drive.problem?.action === 'picture' ? (
            <DriveProblem text={drive.problem.text} />
          ) : drive.done?.action === 'picture' ? (
            <DriveLink file={drive.done.file} />
          ) : (
            <span className="text-sm text-muted-foreground">For a substitute, or the classroom door</span>
          )}
        </div>
      </section>

      {account && (
        <>
          <Separator className="shrink-0" />
          <section className="shrink-0">
            <Label className="mb-1.5">Your Drive Folder</Label>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Everything the app saves to Drive goes in one folder, <span className="font-bold text-foreground">{FOLDER_NAME}</span>
              </p>
              {/* A link once the folder is known; until then, finding it is a tap of its own. */}
              {drive.folder ? (
                <a
                  href={drive.folder}
                  target="_blank"
                  rel="noreferrer"
                  data-slot="button"
                  className={cn(
                    buttonVariants({ variant: 'secondary' }),
                    'ml-auto h-auto gap-2 rounded-xl px-3.5 py-2.5 font-semibold shadow-sm active:scale-[0.96]',
                  )}
                >
                  <GoogleG size={18} /> Open in Drive
                </a>
              ) : (
                <TactileButton className="ml-auto" onClick={() => void drive.run('folder', appFolder)} disabled={drive.busy !== null}>
                  <GoogleG size={18} /> {drive.busy === 'folder' ? 'Finding it…' : 'Find My Folder'}
                </TactileButton>
              )}
              {drive.problem?.action === 'folder' && <DriveProblem text={drive.problem.text} />}
            </div>
          </section>
        </>
      )}
      <Separator className="shrink-0" />
    </div>
  )
}
