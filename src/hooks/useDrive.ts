import { useCallback, useState } from 'react'
import { driveProblem, knownFolder, withDrive, type DriveFile } from '../lib/drive'

const FOLDER_KEY = 'seating-chart-drive-folder-v1'

const isFile = (value: unknown): value is DriveFile => typeof value === 'object' && value !== null && 'url' in value && 'id' in value

/** Where this teacher's "Class? Yes!" folder opens, once any save has found it. */
export function rememberedFolder(uid: string | undefined): string | null {
  if (!uid) return null
  try {
    const saved = JSON.parse(localStorage.getItem(FOLDER_KEY) ?? 'null') as { uid: string; url: string } | null
    return saved?.uid === uid ? saved.url : null
  } catch {
    return null
  }
}

/**
 * One Drive action at a time - Save to Drive, Update in Drive, Make a roster sheet - each with
 * what the teacher needs to see after: the button busy while it works, then a link to the file,
 * or what went wrong in plain words. The link is tapped rather than opened for the teacher: a
 * browser only opens a tab straight after a tap, and Google's own window may have used that tap.
 */
export function useDrive(uid: string | undefined) {
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<{ action: string; file: DriveFile } | null>(null)
  const [problem, setProblem] = useState<{ action: string; text: string } | null>(null)
  const [folder, setFolder] = useState<string | null>(() => rememberedFolder(uid))

  const run = useCallback(
    async <T>(action: string, work: (token: string) => Promise<T>): Promise<T | null> => {
      setBusy(action)
      setProblem(null)
      try {
        const result = await withDrive(work)
        if (isFile(result)) setDone({ action, file: result })
        const found = knownFolder()
        if (found && uid) {
          setFolder(found.url)
          try {
            localStorage.setItem(FOLDER_KEY, JSON.stringify({ uid, url: found.url }))
          } catch {
            // Only a convenience: the folder is found again next time.
          }
        }
        return result
      } catch (error) {
        const text = driveProblem(error)
        if (text) {
          console.warn('Google Drive', error)
          setProblem({ action, text })
        }
        return null
      } finally {
        setBusy(null)
      }
    },
    [uid],
  )

  return { run, busy, done, problem, folder }
}
