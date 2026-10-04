import { createRequire } from 'module'
import { mkdirSync } from 'fs'
import { tmpdir } from 'os'
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js')
// Google Drive and Sheets, end to end, against a stand-in for Google built into this script: the
// seating chart picture, the roster sheet and its import, the attendance Sheet, the folder, and
// what the teacher reads when Google says no. Signing in uses Firebase's emulators, as
// scripts/sync-check.mjs does - start them and serve the emulator build the same way (see its
// header), then:
//   URL=http://localhost:4174/seating/ node scripts/drive-check.mjs [only]
//
// The stand-in answers the requests the app makes the way Google's documented APIs do, and is
// strict where Google is: no pass, no answer; a write past a sheet's grid is refused; an unknown
// query or request is refused. It can't prove Google itself agrees - that's the real board's test.
const URL = process.env.URL || 'http://localhost:4174/seating/'
const only = process.argv[2] || ''
const SHOTS = process.env.SHOTS || `${tmpdir()}/drive-check`
mkdirSync(SHOTS, { recursive: true })
const TOKEN = 'test-drive-token'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}
const want = (name) => !only || name.includes(only)
async function waitFor(fn, ms = 8000) {
  const end = Date.now() + ms
  for (;;) {
    const value = await fn().catch(() => undefined)
    if (value || Date.now() > end) return value
    await new Promise((r) => setTimeout(r, 150))
  }
}

// ---------------------------------------------------------------------------------------------
// The stand-in for Google Drive and Sheets.

const drive = { files: new Map(), next: 1, fail: null, calls: [] }
const FOLDER = 'application/vnd.google-apps.folder'
const SHEET = 'application/vnd.google-apps.spreadsheet'

function newSheet() {
  return {
    tabs: [
      {
        sheetId: 0,
        title: 'Sheet1',
        rowCount: 1000,
        columnCount: 26,
        values: [],
        frozenRows: 0,
        frozenColumns: 0,
        validations: [],
        rules: [],
      },
    ],
  }
}
const link = (f) =>
  f.mimeType === FOLDER
    ? `https://drive.google.com/drive/folders/${f.id}`
    : f.mimeType === SHEET
      ? `https://docs.google.com/spreadsheets/d/${f.id}/edit`
      : `https://drive.google.com/file/d/${f.id}/view`
const view = (f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, webViewLink: link(f) })
const error = (status, reason, message) => ({
  status,
  body: { error: { code: status, message, errors: [{ reason, message }], status: reason } },
})

function listFiles(query) {
  let rest = query
  const labels = []
  rest = rest.replace(/appProperties has \{ key='([^']*)' and value='([^']*)' \}/g, (_, k, v) => (labels.push([k, v]), ''))
  let notTrashed = false
  rest = rest.replace(/trashed = false/g, () => ((notTrashed = true), ''))
  if (rest.replace(/\band\b/g, '').trim()) return error(400, 'invalid', `Invalid Value: ${query}`)
  const files = [...drive.files.values()]
    .filter((f) => (!notTrashed || !f.trashed) && labels.every(([k, v]) => f.appProperties?.[k] === v))
    .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
  return { status: 200, body: { files: files.map(view) } }
}

function create(meta, media) {
  if (meta.parents?.some((p) => !drive.files.has(p))) return error(404, 'notFound', 'File not found')
  const id = `f${drive.next++}`
  const file = {
    id,
    name: meta.name,
    mimeType: meta.mimeType ?? 'image/png',
    parents: meta.parents ?? [],
    appProperties: meta.appProperties ?? {},
    trashed: false,
    modifiedTime: new Date(Date.now() + drive.next).toISOString(),
    media,
  }
  if (file.mimeType === SHEET) file.sheet = newSheet()
  drive.files.set(id, file)
  return { status: 200, body: view(file) }
}

function multipart(contentType, buffer) {
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1]
  if (!boundary) return null
  const text = buffer.toString('latin1')
  const parts = text.split(`--${boundary}`).slice(1, -1)
  if (parts.length !== 2 || !text.trimEnd().endsWith(`--${boundary}--`)) return null
  const [metaPart, mediaPart] = parts.map((p) => p.replace(/^\r\n/, ''))
  const meta = JSON.parse(Buffer.from(metaPart.split('\r\n\r\n')[1].replace(/\r\n$/, ''), 'latin1').toString('utf8'))
  const [head, ...body] = mediaPart.split('\r\n\r\n')
  const media = Buffer.from(body.join('\r\n\r\n').replace(/\r\n$/, ''), 'latin1')
  return { meta, media, mediaType: /Content-Type: ([^\r\n]+)/.exec(head)?.[1] }
}

function tabFor(file, range) {
  const named = /^'((?:[^']|'')*)'/.exec(range)?.[1]?.replace(/''/g, "'")
  return named ? file.sheet.tabs.find((t) => t.title === named) : file.sheet.tabs[0]
}

function inGrid(tab, r) {
  const rowEnd = r.endRowIndex ?? tab.rowCount
  const colEnd = r.endColumnIndex ?? tab.columnCount
  return r.sheetId === tab.sheetId && rowEnd <= tab.rowCount && colEnd <= tab.columnCount
}

function batchUpdate(file, requests) {
  const tab = file.sheet.tabs[0]
  for (const req of requests) {
    const [kind] = Object.keys(req)
    const body = req[kind]
    const range = body.range ?? body.rule?.ranges?.[0]
    if (range && kind !== 'updateDimensionProperties' && !inGrid(tab, range))
      return error(400, 'badRequest', `Range exceeds grid limits: ${JSON.stringify(range)}`)
    switch (kind) {
      case 'updateSheetProperties': {
        const p = body.properties
        if (p.title) tab.title = p.title
        const g = p.gridProperties ?? {}
        if (g.rowCount) tab.rowCount = g.rowCount
        if (g.columnCount) tab.columnCount = g.columnCount
        if (g.frozenRowCount !== undefined) tab.frozenRows = g.frozenRowCount
        if (g.frozenColumnCount !== undefined) tab.frozenColumns = g.frozenColumnCount
        break
      }
      case 'updateCells':
        body.rows.forEach((row, i) =>
          row.values.forEach((cell, j) => {
            const r = range.startRowIndex + i
            const c = range.startColumnIndex + j
            tab.values[r] ??= []
            tab.values[r][c] = cell.userEnteredValue?.stringValue ?? ''
          }),
        )
        break
      case 'setDataValidation':
        tab.validations.push(body)
        break
      case 'addConditionalFormatRule':
        tab.rules.push(body.rule)
        break
      case 'repeatCell':
      case 'updateDimensionProperties':
        break
      default:
        return error(400, 'badRequest', `Unknown request ${kind}`)
    }
  }
  return { status: 200, body: { spreadsheetId: file.id, replies: requests.map(() => ({})) } }
}

/** Values as Google returns them: trailing empty cells and rows left off. */
function trimmed(values, cols = Infinity) {
  const rows = values.map((row) => {
    const r = (row ?? []).slice(0, cols).map((v) => v ?? '')
    while (r.length && r[r.length - 1] === '') r.pop()
    return r
  })
  while (rows.length && rows[rows.length - 1].length === 0) rows.pop()
  return rows
}

async function answer(route) {
  const req = route.request()
  const url = new globalThis.URL(req.url())
  const method = req.method()
  drive.calls.push(`${method} ${url.pathname}`)
  const reply = ({ status, body }) =>
    route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) })
  if (req.headers()['authorization'] !== `Bearer ${TOKEN}`) return reply(error(401, 'authError', 'Invalid Credentials'))
  if (drive.fail) return reply(drive.fail)
  const json = () => JSON.parse(req.postData() || '{}')
  const path = url.pathname
  let m
  if (url.host === 'www.googleapis.com' && path === '/drive/v3/files' && method === 'GET')
    return reply(listFiles(url.searchParams.get('q') ?? ''))
  if (url.host === 'www.googleapis.com' && path === '/drive/v3/files' && method === 'POST') return reply(create(json()))
  if (url.host === 'www.googleapis.com' && (m = /^\/drive\/v3\/files\/([^/]+)$/.exec(path)) && method === 'PATCH') {
    const f = drive.files.get(m[1])
    if (!f) return reply(error(404, 'notFound', 'File not found'))
    Object.assign(f, { name: json().name ?? f.name, modifiedTime: new Date().toISOString() })
    return reply({ status: 200, body: view(f) })
  }
  if (url.host === 'www.googleapis.com' && path.startsWith('/upload/drive/v3/files')) {
    if (url.searchParams.get('uploadType') !== 'multipart') return reply(error(400, 'badRequest', 'uploadType'))
    const parsed = multipart(req.headers()['content-type'] ?? '', req.postDataBuffer() ?? Buffer.alloc(0))
    if (!parsed) return reply(error(400, 'badRequest', 'Malformed multipart body'))
    if (parsed.mediaType !== 'image/png' || parsed.media.subarray(1, 4).toString() !== 'PNG')
      return reply(error(400, 'badRequest', 'Not a PNG'))
    if ((m = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(path)) && method === 'PATCH') {
      const f = drive.files.get(m[1])
      if (!f) return reply(error(404, 'notFound', 'File not found'))
      Object.assign(f, { name: parsed.meta.name ?? f.name, media: parsed.media, modifiedTime: new Date().toISOString() })
      return reply({ status: 200, body: view(f) })
    }
    if (method === 'POST') return reply(create(parsed.meta, parsed.media))
  }
  if (url.host === 'sheets.googleapis.com' && (m = /^\/v4\/spreadsheets\/([^/:]+)(.*)$/.exec(path))) {
    const f = drive.files.get(m[1])
    if (!f?.sheet) return reply(error(404, 'NOT_FOUND', 'Requested entity was not found.'))
    const rest = decodeURIComponent(m[2])
    if (rest === '' && method === 'GET')
      return reply({
        status: 200,
        body: {
          sheets: f.sheet.tabs.map((t) => ({
            properties: { sheetId: t.sheetId, title: t.title, gridProperties: { rowCount: t.rowCount, columnCount: t.columnCount } },
          })),
        },
      })
    if (rest === ':batchUpdate' && method === 'POST') return reply(batchUpdate(f, json().requests))
    let v
    if ((v = /^\/values\/(.+):clear$/.exec(rest)) && method === 'POST') {
      const tab = tabFor(f, v[1])
      if (!tab) return reply(error(400, 'INVALID_ARGUMENT', `Unable to parse range: ${v[1]}`))
      tab.values = []
      return reply({ status: 200, body: {} })
    }
    if ((v = /^\/values\/(.+)$/.exec(rest)) && method === 'PUT') {
      if (!url.searchParams.get('valueInputOption'))
        return reply(error(400, 'INVALID_ARGUMENT', "'valueInputOption' is required but not specified"))
      const tab = tabFor(f, v[1])
      if (!tab) return reply(error(400, 'INVALID_ARGUMENT', `Unable to parse range: ${v[1]}`))
      const values = json().values
      if (values.length > tab.rowCount || Math.max(...values.map((r) => r.length)) > tab.columnCount)
        return reply(error(400, 'INVALID_ARGUMENT', 'Range exceeds grid limits'))
      tab.values = values.map((r) => [...r])
      return reply({ status: 200, body: { updatedRows: values.length } })
    }
    if ((v = /^\/values\/(.+)$/.exec(rest)) && method === 'GET') {
      const tab = tabFor(f, v[1])
      const cols = /:([A-Z]+)\d*$/.exec(v[1])?.[1]?.charCodeAt(0) - 64 || Infinity
      const values = trimmed(tab.values, cols)
      return reply({ status: 200, body: { range: v[1], majorDimension: 'ROWS', ...(values.length ? { values } : {}) } })
    }
  }
  return reply(error(400, 'badRequest', `The stand-in doesn't know ${method} ${req.url()}`))
}

// ---------------------------------------------------------------------------------------------

const NAMES = 'Amy Tony Kevin Mulan Brian Cindy Daniel Emma Grace Henry Ivy Jack'.split(' ')
function makeClass(id, name) {
  const students = NAMES.map((n, i) => ({
    id: `${id}-s${i}`,
    name: n,
    homeroom: String(401 + (i % 3)),
    gender: i % 2 ? 'boy' : 'girl',
    points: 2,
  }))
  const seating = Array(40).fill(null)
  students.forEach((s, i) => (seating[18 + i] = s.id))
  return {
    id,
    name,
    students,
    seating,
    updatedAt: new Date().toISOString(),
    attendance: { '2026-09-29': [`${id}-s1`], '2026-09-30': [] },
    attendanceTaken: ['2026-09-29', '2026-09-30'],
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
const page = await context.newPage()
page.errors = []
page.on('pageerror', (e) => page.errors.push(e.message))
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }))
await page.route('https://www.googleapis.com/drive/**', answer)
await page.route('https://www.googleapis.com/upload/drive/**', answer)
await page.route('https://sheets.googleapis.com/**', answer)
await page.addInitScript(
  (state) => {
    if (localStorage.getItem('seeded-for-test')) return
    localStorage.setItem('seeded-for-test', '1')
    localStorage.setItem('seating-chart-state-v1', JSON.stringify(state))
  },
  { classes: [makeClass('g4', 'Grade 4 English'), makeClass('g3', 'Grade 3 Phonics')], activeClassId: 'g4' },
)

await fetch('http://127.0.0.1:8080/emulator/v1/projects/class-yes/databases/(default)/documents', { method: 'DELETE' })
await fetch('http://127.0.0.1:9099/emulator/v1/projects/class-yes/accounts', { method: 'DELETE' })

const shot = async (name) => {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}
const settings = async (tab) => {
  await page.locator('aside button[aria-label="Class Settings"]').click()
  await page.getByRole('tab', { name: tab }).click()
  await page.waitForTimeout(300)
}
const closeSettings = async () => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}
const dialog = () => page.getByRole('dialog').last()
const filesOf = (kind) => [...drive.files.values()].filter((f) => f.appProperties.kind === kind && !f.trashed)

try {
  await page.goto(URL)
  await page.waitForTimeout(600)
  // Classes are made and opened signed in only: the splash offers one thing, Sign in with
  // Google. Signed in with a pass into Drive ready for the stand-in; the empty account takes
  // the board's two classes, which then show as cards.
  await page.evaluate(
    (token) =>
      (window.__testGoogle = {
        sub: 'drive-derek',
        email: 'derek@yuteh.ntpc.edu.tw',
        email_verified: true,
        name: 'Derek Hoerler',
        driveToken: token,
      }),
    TOKEN,
  )
  await page
    .locator('.splash-board')
    .getByRole('button', { name: /Sign in with Google/ })
    .click()
  await page.locator('.splash-board button', { hasText: 'Grade 4 English' }).click()
  await page.waitForTimeout(800)

  if (want('picture')) {
    await settings('Google')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog()
        .getByRole('button', { name: /Save as Picture/ })
        .click(),
    ])
    const path = await download.path()
    const png = (await import('fs')).readFileSync(path)
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)
    check(
      'picture: saves a PNG, A4 landscape',
      png.subarray(1, 4).toString() === 'PNG' && width === 2000 && height === 1414,
      `${width}x${height}`,
    )
    check(
      'picture: named for the class and the day',
      /^Grade 4 English - Seating Chart - \d{4}-\d{2}-\d{2}\.png$/.test(download.suggestedFilename()),
      download.suggestedFilename(),
    )
    await closeSettings()
  }

  await settings('Google')
  const signedIn = await waitFor(async () => /derek@yuteh/.test(await dialog().innerText()))
  check('signed in on the splash: the Google tab shows the account', Boolean(signedIn))

  if (want('picture')) {
    const text = await dialog().innerText()
    check(
      'signed in: the account, Saved and Switch teacher',
      /Derek/.test(text) && /Switch teacher/.test(text) && /Saved|Connecting/.test(text),
    )
    await dialog()
      .getByRole('button', { name: /Save to Google Drive/ })
      .click()
    const saved = await waitFor(async () => /Saved to/.test(await dialog().innerText()))
    check('drive: the picture is saved, and says where', Boolean(saved))
    const [folder] = filesOf('folder')
    const pics = filesOf('seating-chart')
    check('drive: in a folder called Class? Yes!', folder?.name === 'Class? Yes!' && pics.length === 1 && pics[0].parents[0] === folder.id)
    await shot('02-google-tab-saved')
    const firstBytes = pics[0]?.media?.length
    await dialog()
      .getByRole('button', { name: /Save to Google Drive/ })
      .click()
    await waitFor(async () => drive.calls.filter((c) => c.startsWith('PATCH /upload')).length === 1)
    check(
      'drive: saving again the same day replaces it',
      filesOf('seating-chart').length === 1 && filesOf('folder').length === 1,
      `${filesOf('seating-chart').length} pictures`,
    )
    check('drive: and the picture is a real one', firstBytes > 20_000, `${firstBytes} bytes`)
    const folderLink = await dialog()
      .getByRole('link', { name: /Open in Drive/ })
      .getAttribute('href')
    check('drive: Open in Drive goes to the folder', folderLink === `https://drive.google.com/drive/folders/${folder?.id}`, folderLink)
  }
  await closeSettings()

  if (want('roster')) {
    await settings('Students')
    await dialog()
      .getByRole('button', { name: /^Import/ })
      .click()
    const menu = await page.locator('[data-radix-popper-content-wrapper]').innerText()
    check(
      'import: a menu with Google Sheets, CSV and Make a roster sheet',
      /From a Google Sheet/.test(menu) && /From a CSV file/.test(menu) && /Make a roster sheet/.test(menu),
    )
    await shot('03-import-menu')
    await page
      .locator('[data-radix-popper-content-wrapper]')
      .getByRole('button', { name: /Make a roster sheet/ })
      .click()
    const made = await waitFor(async () => /Made/.test(await dialog().innerText()))
    check('roster: Make a roster sheet makes one, and links to it', Boolean(made))
    const [sheet] = filesOf('roster')
    const tab = sheet?.sheet.tabs[0]
    check(
      'roster: named for the class, in the folder',
      sheet?.name === 'Grade 4 English – Roster' && sheet.parents[0] === filesOf('folder')[0]?.id,
    )
    check(
      'roster: headings and two examples',
      JSON.stringify(trimmed(tab?.values ?? [])) ===
        JSON.stringify([
          ['Name', 'Homeroom', 'Boy or Girl'],
          ['Amy (example)', '401', 'Girl'],
          ['Tony (example)', '403', 'Boy'],
        ]),
      JSON.stringify(tab?.values),
    )
    check(
      'roster: Boy or Girl is a dropdown',
      tab?.validations[0]?.rule.condition.values.map((v) => v.userEnteredValue).join() === 'Boy,Girl',
    )
    check(
      'roster: examples greyed while they say so, heading row frozen',
      tab?.rules.length === 1 && tab.frozenRows === 1 && tab.title === 'Roster',
    )
    const listed = await waitFor(
      async () =>
        (await dialog()
          .getByRole('button', { name: /Grade 4 English – Roster/ })
          .count()) === 1,
    )
    check('roster: and it is listed to import from', Boolean(listed))
    await shot('04-roster-made')

    // The teacher fills it in: two new students, one already in the class, examples left alone.
    tab.values.push(['Zoe', '405', 'Girl'], ['Max', '0406', 'Boy'], ['Amy', '401', 'Girl'], [], ['Lily', '', ''])
    await dialog()
      .getByRole('button', { name: /Grade 4 English – Roster/ })
      .click()
    const done = await waitFor(async () => /Added/.test(await dialog().innerText()))
    const said = done ? (await dialog().innerText()).match(/Added[^\n]*/)?.[0] : ''
    check('roster: importing adds who is new, and says so', said === 'Added 3 students. 1 was already in the class.', said)
    const roster = await page.evaluate(
      () => JSON.parse(localStorage.getItem('seating-chart-state-v1')).classes.find((c) => c.name === 'Grade 4 English').students,
    )
    const by = (n) => roster.find((s) => s.name === n)
    check(
      'roster: with homeroom and boy or girl',
      by('Zoe')?.gender === 'girl' && by('Max')?.homeroom === '0406' && by('Max')?.gender === 'boy' && by('Lily')?.gender === 'unspecified',
    )
    check(
      'roster: the examples are not imported',
      !roster.some((s) => /example/.test(s.name)) && roster.filter((s) => s.name === 'Amy').length === 1,
    )
    await shot('05-roster-imported')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await closeSettings()
  }

  if (want('attendance')) {
    await settings('Students')
    await dialog()
      .getByRole('button', { name: /View \/ Edit Attendance/ })
      .click()
    await page.waitForTimeout(400)
    await dialog()
      .getByRole('button', { name: /Update in Drive/ })
      .click()
    const linked = await waitFor(async () => /Saved to Grade 4 English – Attendance/.test(await dialog().innerText()))
    check('attendance: Update in Drive makes the Sheet, and links to it', Boolean(linked))
    const [sheet] = filesOf('attendance')
    const rows = trimmed(sheet?.sheet.tabs[0].values ?? [])
    const students = await page.evaluate(
      () => JSON.parse(localStorage.getItem('seating-chart-state-v1')).classes.find((c) => c.name === 'Grade 4 English').students.length,
    )
    check(
      'attendance: a row per student, a column per day, the total',
      rows[0]?.join('|') === 'Homeroom|Name|2026-09-29|2026-09-30|Days absent' && rows.length === students + 1,
      rows[0]?.join('|'),
    )
    check(
      'attendance: an A where they were away',
      rows
        .find((r) => r[1] === 'Tony')
        ?.slice(2)
        .join('|') === 'A||1',
      rows.find((r) => r[1] === 'Tony')?.join('|'),
    )
    check('attendance: heading row and names stay put', sheet?.sheet.tabs[0].frozenRows === 1 && sheet.sheet.tabs[0].frozenColumns === 2)
    await shot('06-attendance-drive')
    // Mark someone away today, then update again: the same Sheet, brought up to date.
    const firstId = sheet?.id
    await page.locator('[role=dialog] td button').first().click()
    await page.waitForTimeout(800)
    await dialog()
      .getByRole('button', { name: /Update in Drive/ })
      .click()
    await waitFor(
      async () =>
        filesOf('attendance')[0]?.sheet.tabs[0].values[0]?.length === 5 + 1 ||
        filesOf('attendance')[0]?.sheet.tabs[0].values[0]?.length > 5,
    )
    check('attendance: updating again keeps the same Sheet', filesOf('attendance').length === 1 && filesOf('attendance')[0].id === firstId)
    check(
      'attendance: with the new day on it',
      (filesOf('attendance')[0]?.sheet.tabs[0].values[0]?.length ?? 0) > 5,
      filesOf('attendance')[0]?.sheet.tabs[0].values[0]?.join('|'),
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await closeSettings()
  }

  if (want('errors')) {
    await settings('Google')
    drive.fail = error(403, 'accessNotConfigured', 'Google Drive API has not been used in project 323152163178 before or it is disabled.')
    await dialog()
      .getByRole('button', { name: /Save to Google Drive/ })
      .click()
    const off = await waitFor(async () => /isn't switched on/.test(await dialog().innerText()))
    check('errors: Drive switched off says so', Boolean(off))
    await shot('07-error-off')
    drive.fail = error(403, 'insufficientPermissions', 'Request had insufficient authentication scopes.')
    await dialog()
      .getByRole('button', { name: /Save to Google Drive/ })
      .click()
    const scope = await waitFor(async () => /needs your OK/.test(await dialog().innerText()))
    check('errors: Drive not allowed says how to fix it', Boolean(scope))
    drive.fail = null
    await page.evaluate(() => (window.__testGoogle.driveError = 'auth/popup-closed-by-user'))
    await dialog()
      .getByRole('button', { name: /Save to Google Drive/ })
      .click()
    await page.waitForTimeout(600)
    const t = await dialog().innerText()
    check(
      "errors: closing Google's window says nothing",
      !/isn't switched on|needs your OK|didn't answer|Can't reach/.test(t) && /For a substitute/.test(t),
    )
    await closeSettings()
  }

  if (want('fit')) {
    for (const [w, h] of [
      [1024, 640],
      [1280, 800],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width: w, height: h })
      await settings('Google')
      const box = await dialog().boundingBox()
      const over = await dialog().evaluate((el) => {
        const body = el.querySelector('[data-slot=dialog-body]') ?? el
        return body.scrollHeight - body.clientHeight
      })
      check(`fit: the Google tab fits at ${w}x${h}`, box.y >= 0 && box.y + box.height <= h && over <= 0, `scroll ${over}px`)
      if (w === 1024) await shot('08-google-tab-1024')
      await closeSettings()
    }
  }

  check('no page errors', page.errors.length === 0, page.errors.slice(0, 3).join(' | '))
} catch (e) {
  check('script', false, e.message.split('\n')[0])
  await page.screenshot({ path: `${SHOTS}/crash.png` }).catch(() => {})
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} OK, ${failed.length} FAIL. Screenshots in ${SHOTS}`)
process.exit(failed.length ? 1 : 0)
