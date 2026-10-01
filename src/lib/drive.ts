import type { ClassData } from '../types'
import { attendanceRows } from './attendance'
import { loadCloud } from './cloud'

/**
 * The teacher's Google Drive and Sheets, through Google's own web addresses. Everything the app
 * saves goes in one folder, "Class? Yes!", so there are no files scattered about, and the app
 * finds its own files again by labels it puts on them (Drive's appProperties) rather than by
 * name, so a renamed file is still found.
 *
 * The app only ever has Google's drive.file permission: it can see and change the files it made,
 * and nothing else in the teacher's Drive.
 */
const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const FOLDER = 'application/vnd.google-apps.folder'
const SHEET = 'application/vnd.google-apps.spreadsheet'
export const FOLDER_NAME = 'Class? Yes!'

export interface DriveFile {
  id: string
  name: string
  /** Where it opens in Drive or Sheets. */
  url: string
  modifiedTime?: string
}

/** Google said no. `reason` is Google's own word for why, where it gave one. */
export class DriveError extends Error {
  status: number
  reason: string
  constructor(status: number, reason: string, message: string) {
    super(message)
    this.status = status
    this.reason = reason
  }
}

/**
 * Runs `work` with a pass into Drive. Must start from a tap: the first time in an hour it opens
 * Google's window. A pass Google turns down is forgotten, so the next tap asks for a fresh one.
 */
export async function withDrive<T>(work: (token: string) => Promise<T>): Promise<T> {
  const cloud = await loadCloud()
  const token = await cloud.driveToken()
  try {
    return await work(token)
  } catch (error) {
    if (error instanceof DriveError && (error.status === 401 || error.reason === 'scope')) cloud.forgetDriveToken()
    throw error
  }
}

async function google<T>(token: string, url: string, init: RequestInit = {}, json?: unknown): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (json !== undefined) headers.set('Content-Type', 'application/json; charset=UTF-8')
  const res = await fetch(url, { ...init, headers, body: json !== undefined ? JSON.stringify(json) : init.body })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] }
    }
    const message = body.error?.message ?? res.statusText
    const said = [
      body.error?.status,
      ...(body.error?.errors ?? []).map((e) => e.reason),
      ...(body.error?.details ?? []).map((d) => d.reason),
    ]
      .filter(Boolean)
      .join(' ')
    const reason =
      /accessNotConfigured|SERVICE_DISABLED/.test(said) || /has not been used|is disabled/.test(message)
        ? 'off'
        : /insufficientPermissions|SCOPE_INSUFFICIENT/i.test(said) || /insufficient.*scope/i.test(message)
          ? 'scope'
          : res.status === 404
            ? 'gone'
            : said || String(res.status)
    throw new DriveError(res.status, reason, message)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

const q = (query: string) => encodeURIComponent(query)
const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`
const labelled = (labels: Record<string, string>) =>
  Object.entries(labels)
    .map(([key, value]) => `appProperties has { key='${key}' and value='${value}' }`)
    .join(' and ')

/** The app's own files with these labels, newest first. */
async function findFiles(token: string, labels: Record<string, string>): Promise<DriveFile[]> {
  const query = `${labelled(labels)} and trashed = false`
  const { files } = await google<{ files: (Omit<DriveFile, 'url'> & { webViewLink?: string })[] }>(
    token,
    `${DRIVE}/files?q=${q(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,webViewLink)&pageSize=100`,
  )
  return files.map(({ webViewLink, ...f }) => ({ ...f, url: webViewLink ?? sheetUrl(f.id) }))
}

let folder: DriveFile | null = null

/** The folder, if anything this session has found or made it. */
export const knownFolder = () => folder

/** The "Class? Yes!" folder, made the first time anything is saved. */
export async function appFolder(token: string): Promise<DriveFile> {
  const [found] = await findFiles(token, { kind: 'folder' })
  if (found) return (folder = found)
  const made = await google<{ id: string; name: string; webViewLink: string }>(
    token,
    `${DRIVE}/files?fields=id,name,webViewLink`,
    { method: 'POST' },
    { name: FOLDER_NAME, mimeType: FOLDER, appProperties: { kind: 'folder' } },
  )
  return (folder = { id: made.id, name: made.name, url: made.webViewLink })
}

async function createSheet(token: string, name: string, labels: Record<string, string>): Promise<DriveFile> {
  const folder = await appFolder(token)
  const made = await google<{ id: string; name: string }>(
    token,
    `${DRIVE}/files?fields=id,name`,
    { method: 'POST' },
    { name, mimeType: SHEET, parents: [folder.id], appProperties: labels },
  )
  return { id: made.id, name: made.name, url: sheetUrl(made.id) }
}

interface SheetTab {
  sheetId: number
  title: string
  gridProperties?: { rowCount?: number; columnCount?: number }
}

async function firstTab(token: string, id: string): Promise<SheetTab> {
  const { sheets } = await google<{ sheets: { properties: SheetTab }[] }>(token, `${SHEETS}/${id}?fields=sheets.properties`)
  return sheets[0].properties
}

const batch = (token: string, id: string, requests: unknown[]) =>
  google(token, `${SHEETS}/${id}:batchUpdate`, { method: 'POST' }, { requests })
const a1 = (title: string) => `'${title.replace(/'/g, "''")}'`
const cell = (text: string, format?: unknown) => ({
  userEnteredValue: { stringValue: text },
  ...(format ? { userEnteredFormat: format } : {}),
})

const HEADER = { textFormat: { bold: true }, backgroundColor: { red: 0.94, green: 0.91, blue: 1 } }

/**
 * A ready-made roster in the Drive folder, to fill in and then import: Name, Homeroom, and Boy or
 * Girl as a dropdown so it can't be mistyped. Two example rows show the way; they are marked
 * "(example)", greyed while they say so, and skipped on import.
 */
export async function makeRosterSheet(token: string, className: string): Promise<DriveFile> {
  const file = await createSheet(token, `${className} – Roster`, { kind: 'roster' })
  const tab = await firstTab(token, file.id)
  const range = (r0: number, r1: number, c0: number, c1: number) => ({
    sheetId: tab.sheetId,
    startRowIndex: r0,
    endRowIndex: r1,
    startColumnIndex: c0,
    endColumnIndex: c1,
  })
  const width = (column: number, pixels: number) => ({
    updateDimensionProperties: {
      range: { sheetId: tab.sheetId, dimension: 'COLUMNS', startIndex: column, endIndex: column + 1 },
      properties: { pixelSize: pixels },
      fields: 'pixelSize',
    },
  })
  await batch(token, file.id, [
    {
      updateSheetProperties: {
        properties: { sheetId: tab.sheetId, title: 'Roster', gridProperties: { frozenRowCount: 1 } },
        fields: 'title,gridProperties.frozenRowCount',
      },
    },
    {
      updateCells: {
        range: range(0, 3, 0, 3),
        rows: [
          { values: [cell('Name', HEADER), cell('Homeroom', HEADER), cell('Boy or Girl', HEADER)] },
          { values: [cell('Amy (example)'), cell('401'), cell('Girl')] },
          { values: [cell('Tony (example)'), cell('403'), cell('Boy')] },
        ],
        fields: 'userEnteredValue,userEnteredFormat',
      },
    },
    // Homeroom numbers stay as typed: "05" is a classroom, not the number five.
    {
      repeatCell: {
        range: range(1, 300, 1, 2),
        cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    {
      setDataValidation: {
        range: range(1, 300, 2, 3),
        rule: {
          condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'Boy' }, { userEnteredValue: 'Girl' }] },
          strict: true,
          showCustomUi: true,
        },
      },
    },
    {
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [range(1, 300, 0, 3)],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=ISNUMBER(SEARCH("(example)", $A2))' }] },
            format: { textFormat: { italic: true, foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 } } },
          },
        },
      },
    },
    width(0, 220),
    width(1, 120),
    width(2, 130),
  ])
  return file
}

/** The roster sheets the app has made, newest first: the ones it can read back. */
export const rosterSheets = (token: string) => findFiles(token, { kind: 'roster' })

/** A sheet's first tab, as rows of text, the way the CSV import reads a file. */
export async function readSheet(token: string, id: string): Promise<string[][]> {
  const { values } = await google<{ values?: string[][] }>(
    token,
    `${SHEETS}/${id}/values/${q('A1:C1000')}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`,
  )
  return values ?? []
}

/**
 * The class's attendance Sheet: one per class, kept up to date in place rather than a new file on
 * every export. It holds what the CSV export holds - a row per student, a column per day on
 * record, an A where they were away, and their total.
 */
export async function updateAttendanceSheet(token: string, cls: ClassData): Promise<DriveFile> {
  const name = `${cls.name} – Attendance`
  let [file] = await findFiles(token, { kind: 'attendance', classId: cls.id })
  const fresh = !file
  if (!file) file = await createSheet(token, name, { kind: 'attendance', classId: cls.id })
  else if (file.name !== name) await google(token, `${DRIVE}/files/${file.id}?fields=id`, { method: 'PATCH' }, { name })

  const rows = attendanceRows(cls)
  const tab = await firstTab(token, file.id)
  const needRows = Math.max(rows.length + 5, tab.gridProperties?.rowCount ?? 0, 50)
  const needColumns = Math.max((rows[0]?.length ?? 0) + 2, tab.gridProperties?.columnCount ?? 0, 26)
  const title = fresh ? 'Attendance' : tab.title
  await batch(token, file.id, [
    {
      updateSheetProperties: {
        properties: {
          sheetId: tab.sheetId,
          title,
          gridProperties: { rowCount: needRows, columnCount: needColumns, frozenRowCount: 1, frozenColumnCount: 2 },
        },
        fields: 'title,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: tab.sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: HEADER },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
  ])
  await google(token, `${SHEETS}/${file.id}/values/${q(a1(title))}:clear`, { method: 'POST' }, {})
  await google(token, `${SHEETS}/${file.id}/values/${q(`${a1(title)}!A1`)}?valueInputOption=RAW`, { method: 'PUT' }, { values: rows })
  return { ...file, name, url: sheetUrl(file.id) }
}

/**
 * The seating chart picture into the folder. One a day per class: saving again the same day
 * replaces it, so the folder doesn't fill up with copies.
 */
export async function savePicture(token: string, cls: ClassData, picture: Blob, name: string, day: string): Promise<DriveFile> {
  const labels = { kind: 'seating-chart', classId: cls.id, day }
  const [existing] = await findFiles(token, labels)
  const boundary = `classyes${Math.random().toString(36).slice(2)}`
  const metadata = existing ? { name } : { name, parents: [(await appFolder(token)).id], appProperties: labels }
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
    picture,
    `\r\n--${boundary}--`,
  ])
  const url = existing
    ? `${UPLOAD}/files/${existing.id}?uploadType=multipart&fields=id,name,webViewLink`
    : `${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`
  const saved = await google<{ id: string; name: string; webViewLink: string }>(token, url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return { id: saved.id, name: saved.name, url: saved.webViewLink }
}

/**
 * What went wrong with Drive, in words for the teacher, or null when there's nothing to say:
 * closing Google's window is changing your mind.
 */
export function driveProblem(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code ?? ''
  if (error instanceof DriveError) {
    if (error.reason === 'off') return "Google Drive isn't switched on for this app yet."
    if (error.reason === 'scope') return 'Class? Yes! needs your OK to use Google Drive. Tap again, and tick the box Google shows.'
    if (error.status === 401) return 'Tap again to connect to Google Drive.'
    if (error.reason === 'gone') return "That file isn't in Google Drive any more."
    return "Google Drive didn't answer. Try again."
  }
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null
    case 'auth/popup-blocked':
      return "Google's window was blocked. Allow pop-ups for this site, then try again."
    case 'auth/user-mismatch':
      return 'Choose the same Google account you signed in with.'
    case 'auth/no-current-user':
      return 'Sign in with Google first.'
    case 'auth/network-request-failed':
      return "Can't reach Google right now. Check the internet, then try again."
    default:
      // A fetch that never reached Google is a TypeError with no code.
      if (!code) return "Can't reach Google right now. Check the internet, then try again."
      return "Google Drive didn't answer. Try again."
  }
}
