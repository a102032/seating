import { createRequire } from 'module'
import { mkdirSync } from 'fs'
import { tmpdir } from 'os'
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js')
// Signing in and sync, end to end, against Firebase's own emulators on this computer - never the
// real class-yes project. Each "computer" is its own browser context, with its own storage.
//
// 1. Start the emulators from the repo root (they need Java; firebase.json and firestore.rules
//    are there):   npx -y firebase-tools@15 emulators:start --only auth,firestore --project class-yes
// 2. Build a copy that talks to them, and serve it:
//      VITE_FIREBASE_EMULATOR=1 npx vite build --outDir /tmp/dist-emu
//      npx vite preview --port 4174 --outDir /tmp/dist-emu
// 3. URL=http://localhost:4174/seating/ node scripts/sync-check.mjs [only]
//
// Google's own sign-in window can't be driven from a test, so the test copy signs in as whichever
// Google account a scenario names (window.__testGoogle, see lib/firebase.ts). Everything after
// that - the question about a board's own classes, sync, going offline, Switch Teacher - is the
// app's real code. The emulators are wiped at the start.
const URL = process.env.URL || 'http://localhost:4174/seating/'
const only = process.argv[2] || ''
const SHOTS = process.env.SHOTS || `${tmpdir()}/sync-check`
mkdirSync(SHOTS, { recursive: true })
const FIRESTORE = 'http://127.0.0.1:8080'
const AUTH = 'http://127.0.0.1:9099'
const PROJECT = 'class-yes'

const DEREK = { sub: 'google-derek', email: 'derek@yuteh.ntpc.edu.tw', email_verified: true, name: 'Derek Hoerler' }
const LIN = { sub: 'google-lin', email: 'lin@yuteh.ntpc.edu.tw', email_verified: true, name: 'Mei Lin' }

const NAMES =
  'Amy Tony Kevin Mulan Brian Cindy Daniel Emma Grace Henry Ivy Jack Leo Sophia Andy Bella Chris Doris Eric Fiona Gary Hannah Ian Judy Kelly Louis Mandy Nick'.split(
    ' ',
  )

function makeClass(id, name, count) {
  const students = NAMES.slice(0, count).map((n, i) => ({
    id: `${id}-s${i}`,
    name: n,
    homeroom: String(401 + (i % 3)),
    gender: i % 2 ? 'boy' : 'girl',
    points: 0,
  }))
  const seating = Array(40).fill(null)
  students.forEach((s, i) => (seating[i] = s.id))
  return { id, name, students, seating, updatedAt: new Date(Date.now() - 60_000).toISOString() }
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

/** JSON with keys in order, so two copies of the same class compare equal however they were built. */
const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  )

async function waitFor(fn, ms = 8000) {
  const end = Date.now() + ms
  for (;;) {
    const value = await fn().catch(() => undefined)
    if (value || Date.now() > end) return value
    await new Promise((r) => setTimeout(r, 200))
  }
}

async function wipeEmulators() {
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' })
}

/** A token the Firestore emulator accepts for this user, unsigned. */
function tokenFor(uid) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: uid,
    user_id: uid,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    firebase: { sign_in_provider: 'google.com' },
  }
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`
}

/** The classes in a teacher's account, read as `asUid` (or with the rules bypassed). Returns { status, classes }. */
async function accountClasses(uid, asUid) {
  const res = await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/teachers/${uid}/classes`, {
    headers: { Authorization: `Bearer ${asUid ? tokenFor(asUid) : 'owner'}` },
  })
  const body = await res.json()
  const classes = (body.documents ?? []).map((d) => JSON.parse(d.fields.json.stringValue))
  return { status: res.status, classes }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/** A computer: its own storage, holding these classes (or none, a fresh board). */
async function computer(name, classes, size = [1280, 800]) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] } })
  const page = await context.newPage()
  page.label = name
  page.errors = []
  page.firebaseRequests = 0
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('request', (r) => /127\.0\.0\.1:(8080|9099)/.test(r.url()) && page.firebaseRequests++)
  // Google Fonts are blocked here; the fallback face is fine for these checks.
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }))
  if (classes) {
    await page.addInitScript(
      (state) => {
        if (localStorage.getItem('seeded-for-test')) return
        localStorage.setItem('seeded-for-test', '1')
        localStorage.setItem('seating-chart-state-v1', JSON.stringify(state))
      },
      { classes, activeClassId: classes[0].id },
    )
  }
  await page.goto(URL)
  await page.waitForTimeout(600)
  return page
}

const splashText = (page) => page.locator('.splash-board').innerText()
/** The splash greets a signed-in teacher by name, in any of its ways (lib/greetings): "Welcome, Derek!", "Derek returns!"... */
const greets = (text, name) => new RegExp(`(^|[\\s,])${name}(,| returns!|[!?])`).test(text)
const uidOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-account-v1') ?? 'null')?.uid)
const boardState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-state-v1')))
/**
 * How many times a student was given a point, from the class's participation record: a star to
 * one student goes there whichever way the class runs its points (straight to the goal, a
 * student keeps no stars of their own).
 */
function pointsIn(cls, student) {
  const id = cls?.students.find((x) => x.name === student)?.id
  return Object.values(cls?.participation ?? {}).reduce((n, day) => n + (day[id]?.[1] ?? 0), 0)
}
const pointsOf = async (page, className, student) => {
  const s = await boardState(page)
  return pointsIn(
    s.classes.find((c) => c.name === className),
    student,
  )
}
const syncMark = (page) => page.locator('aside [data-sync]').getAttribute('data-sync')

async function signIn(page, who) {
  await page.evaluate((w) => (window.__testGoogle = w), who)
  await page.getByRole('button', { name: /Sign in with Google/ }).click()
}

async function openClass(page, name) {
  await page.locator('.splash-board button', { hasText: name }).first().click()
  await page.waitForTimeout(900)
}

/** Tap the desk, then +. After a point is given, the next desk tap starts a fresh selection. */
async function givePoint(page, student) {
  await page.locator('[data-ink=desk]', { hasText: student }).first().click()
  await page.locator('aside button[title="Award Point"]').click()
}

async function shot(page, name) {
  // Windows fade in over 0.2 s; a picture mid-fade looks see-through.
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

const want = (name) => !only || name.includes(only)

await wipeEmulators()

let board, laptop, derekUid

try {
  if (want('first')) {
    // A board with two classes and nobody signed in: exactly the app as it is today.
    board = await computer('board', [makeClass('g4', 'Grade 4 English', 28), makeClass('g3', 'Grade 3 Phonics', 20)])
    const before = await splashText(board)
    check(
      'first: signed out, the splash offers Sign in with Google',
      /Sign in with Google/.test(before) && /Welcome, Teacher!/.test(before),
    )
    check('first: signed out, no class cards - only Sign in', /Sign in to see your classes/.test(before) && !/Grade 4 English/.test(before))
    await board.waitForTimeout(1500)
    check('first: nothing talks to Firebase before a tap', board.firebaseRequests === 0, `${board.firebaseRequests} requests`)
    await shot(board, '01-splash-signed-out')

    await signIn(board, DEREK)
    const welcomed = await waitFor(async () => greets(await splashText(board), 'Derek'))
    check('first: signed in, the splash greets Derek', Boolean(welcomed))
    const offered = await splashText(board)
    check('first: and offers Switch Teacher, in two words', /Switch Teacher/.test(offered) && !/Not Derek/.test(offered))
    check('first: no question, since the account was empty', (await board.getByText("Add this board's classes").count()) === 0)
    await shot(board, '02-splash-signed-in')
    derekUid = await uidOf(board)
    const up = await waitFor(async () => {
      const { classes } = await accountClasses(derekUid)
      return classes.length === 2 && classes
    })
    check(
      'first: both classes went up to the account',
      Boolean(up),
      up ? up.map((c) => `${c.name} (${c.students.length})`).join(', ') : 'none',
    )
    await openClass(board, 'Grade 4 English')
    const mark = await waitFor(async () => (await syncMark(board)) === 'saved')
    check('first: the side panel says Saved', Boolean(mark), await syncMark(board))
    await shot(board, '03-side-panel-saved')
  }

  if (want('laptop') && board) {
    // A second computer, fresh: signing in brings the classes, with no question.
    laptop = await computer('laptop', null)
    await signIn(laptop, DEREK)
    const cards = await waitFor(async () => {
      const t = await splashText(laptop)
      return /Grade 4 English/.test(t) && /Grade 3 Phonics/.test(t) && t
    })
    check('laptop: a fresh computer gets both classes on sign-in', Boolean(cards))
    check('laptop: in the same order', cards ? cards.indexOf('Grade 4 English') < cards.indexOf('Grade 3 Phonics') : false)
    check('laptop: the blank first class is gone', !/Class 1\b/.test(cards || ''))
    await openClass(laptop, 'Grade 4 English')

    await givePoint(laptop, 'Amy')
    const there = await waitFor(async () => (await pointsOf(board, 'Grade 4 English', 'Amy')) === 1)
    check('laptop: a star given on the laptop shows on the board', Boolean(there))
    await givePoint(board, 'Tony')
    const back = await waitFor(async () => (await pointsOf(laptop, 'Grade 4 English', 'Tony')) === 1)
    check('laptop: and one given on the board shows on the laptop', Boolean(back))
    // A burst of taps is one write, and nothing bounces back and forth.
    for (let i = 0; i < 3; i++) await givePoint(board, 'Kevin')
    await board.waitForTimeout(2500)
    check(
      'laptop: three quick stars arrive as three',
      (await pointsOf(laptop, 'Grade 4 English', 'Kevin')) === 3 && (await pointsOf(board, 'Grade 4 English', 'Kevin')) === 3,
    )
  }

  if (want('offline') && board && laptop) {
    await board.context().setOffline(true)
    const off = await waitFor(async () => (await syncMark(board)) === 'offline')
    check('offline: the board says Offline, will catch up', Boolean(off), await syncMark(board))
    await shot(board, '04-offline')
    await givePoint(board, 'Amy')
    await givePoint(board, 'Amy')
    await board.waitForTimeout(1500)
    check('offline: the board keeps working', (await pointsOf(board, 'Grade 4 English', 'Amy')) === 3)
    check("offline: the laptop hasn't got them yet", (await pointsOf(laptop, 'Grade 4 English', 'Amy')) === 1)
    await board.context().setOffline(false)
    const caught = await waitFor(async () => (await pointsOf(laptop, 'Grade 4 English', 'Amy')) === 3, 20000)
    check('offline: back online, the laptop catches up', Boolean(caught))
    const saved = await waitFor(async () => (await syncMark(board)) === 'saved', 20000)
    check('offline: and the board says Saved again', Boolean(saved), await syncMark(board))

    // Switched off mid-lesson: a change made offline, then the page closed before it could go.
    await board.context().setOffline(true)
    await givePoint(board, 'Mulan')
    await board.close()
    await laptop.context().pages()[0].waitForTimeout(300)
    const context = laptop.context() === board.context() ? null : board.context()
    await context.setOffline(false)
    board = await context.newPage()
    board.errors = []
    board.on('pageerror', (e) => board.errors.push(e.message))
    await board.goto(URL)
    const mulan = await waitFor(async () => (await pointsOf(laptop, 'Grade 4 English', 'Mulan')) === 1, 20000)
    check('offline: a change made just before the board went off goes up when it comes back', Boolean(mulan))
    await openClass(board, 'Grade 4 English')

    // After all that, the board, the laptop and the account hold the very same class.
    const same = await waitFor(async () => {
      const find = (list) => stable(list.find((c) => c.name === 'Grade 4 English'))
      const [a, b, c] = [
        find((await boardState(board)).classes),
        find((await boardState(laptop)).classes),
        find((await accountClasses(derekUid)).classes),
      ]
      return a === b && b === c && a
    }, 15000)
    check('offline: afterwards the board, the laptop and the account agree exactly', Boolean(same))
  }

  if (want('delete') && board && laptop) {
    // A new class on the laptop appears on the board; deleting it there takes it off the board.
    await laptop.locator('button[aria-label="Class Settings"]').click()
    await laptop.getByRole('tab', { name: 'Class' }).click()
    await laptop.getByRole('dialog').getByRole('button', { name: 'New Class' }).click()
    await laptop.keyboard.press('Escape')
    const three = await waitFor(async () => (await boardState(board)).classes.length === 3)
    check('delete: a class made on the laptop appears on the board', Boolean(three))
    await laptop.locator('button[aria-label="Class Settings"]').click()
    await laptop.getByRole('tab', { name: 'Class' }).click()
    await laptop.locator('button[aria-label="Lift the safety cover to reveal Delete Class"]').click()
    await laptop.getByRole('dialog').getByRole('button', { name: 'Delete Class' }).first().click()
    await laptop.locator('#confirm-typed-text').fill('Class 3')
    await laptop.getByRole('alertdialog').getByRole('button', { name: 'Delete Class' }).click()
    const two = await waitFor(async () => (await boardState(board)).classes.length === 2)
    check('delete: deleting it on the laptop takes it off the board', Boolean(two))
    const left = await waitFor(async () => (await accountClasses(derekUid)).classes.length === 2 && true)
    check('delete: and out of the account', Boolean(left))
  }

  let spare
  if (want('question') && derekUid) {
    // A computer with a class of its own: the question, and Yes.
    const pc = await computer('pc-yes', [makeClass('5a', '5A English', 10)])
    await signIn(pc, DEREK)
    const asked = await waitFor(async () => (await pc.getByText("Add this board's classes to your account?").count()) > 0)
    check('question: a computer with its own classes is asked', Boolean(asked))
    const dialog = pc.getByRole('alertdialog')
    const text = asked ? await dialog.innerText() : ''
    check(
      "question: it names the board's class and the account's",
      /5A English · 10/.test(text) && /Grade 4 English/.test(text) && /all 3/.test(text),
      text.replace(/\s+/g, ' ').slice(0, 160),
    )
    await shot(pc, '05-question')
    await dialog.getByRole('button', { name: 'Yes, add them' }).click()
    const added = await waitFor(async () => (await accountClasses(derekUid)).classes.length === 3 && true)
    check('question: Yes adds it to the account', Boolean(added))
    const onBoard = board && (await waitFor(async () => (await boardState(board)).classes.some((c) => c.name === '5A English')))
    check('question: and the board gets it too', Boolean(onBoard))
    await pc.context().close()

    // Another, and No: the class is put aside, and comes back when the teacher switches out.
    spare = await computer('pc-no', [makeClass('art', 'Room 12 Art', 12)])
    await signIn(spare, DEREK)
    await waitFor(async () => (await spare.getByText("Add this board's classes to your account?").count()) > 0)
    await spare.getByRole('alertdialog').getByRole('button', { name: "No, only my account's" }).click()
    const mine = await waitFor(async () => {
      const t = await splashText(spare)
      return /5A English/.test(t) && !/Room 12 Art/.test(t)
    })
    check("question: No shows only the account's classes", Boolean(mine))
    check('question: and leaves the account as it was', (await accountClasses(derekUid)).classes.length === 3)

    await spare.getByRole('button', { name: /Switch Teacher/ }).click()
    const confirm = spare.getByRole('alertdialog')
    check('switch: it asks first, and says the classes are safe', /safe in the Google account/.test(await confirm.innerText()))
    await shot(spare, '06-switch-teacher')
    await Promise.all([spare.waitForEvent('load'), confirm.getByRole('button', { name: 'Yes, Switch' }).click()])
    await spare.waitForTimeout(800)
    const after = await splashText(spare)
    check('switch: the board is signed out', /Welcome, Teacher!/.test(after) && /Sign in with Google/.test(after))
    // Back on the board, and waiting for whoever signs in next (they'll be asked about it).
    const names = await spare.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-state-v1')).classes.map((c) => c.name))
    check(
      'switch: its own class is back, behind Sign in',
      names.includes('Room 12 Art') && !names.includes('Grade 4 English') && !/Room 12 Art/.test(after),
      names.join(', '),
    )
    const leftBehind = await spare.evaluate(async () => {
      const dbs = (await indexedDB.databases()).map((d) => d.name)
      return { dbs, state: localStorage.getItem('seating-chart-state-v1'), account: localStorage.getItem('seating-chart-account-v1') }
    })
    check(
      "switch: no trace of Derek's students on the board",
      !/Grade 4|Grade 3|5A English/.test(leftBehind.state ?? '') && !leftBehind.account,
      leftBehind.dbs.join(', '),
    )
    check("switch: Firestore's copy is wiped", !leftBehind.dbs.some((d) => /firestore/.test(d ?? '')), leftBehind.dbs.join(', '))
    check('switch: the account still has everything', (await accountClasses(derekUid)).classes.length === 3)
  }

  if (want('rules') && spare && derekUid) {
    // The next teacher signs in on that board; her classes and Derek's stay apart.
    await signIn(spare, LIN)
    await waitFor(async () => greets(await splashText(spare), 'Mei'))
    const linUid = await uidOf(spare)
    const hers = await waitFor(async () => (await accountClasses(linUid)).classes.length === 1 && true)
    check("rules: the next teacher's account gets the board's class", Boolean(hers))
    const peek = await accountClasses(derekUid, linUid)
    check("rules: she cannot read Derek's classes", peek.status === 403, `status ${peek.status}`)
    const own = await accountClasses(derekUid, derekUid)
    check('rules: Derek can', own.status === 200 && own.classes.length === 3, `status ${own.status}`)
    const nobody = await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/teachers/${derekUid}/classes`)
    check('rules: nor can anyone signed out', nobody.status === 403, `status ${nobody.status}`)
    await spare.context().close()
  }

  if (want('full') && derekUid) {
    // The account now has 3; a computer with 3 of its own can't add them (5 at most).
    const pc = await computer('pc-full', [makeClass('x1', 'Extra 1', 5), makeClass('x2', 'Extra 2', 5), makeClass('x3', 'Extra 3', 5)])
    await signIn(pc, DEREK)
    await waitFor(async () => (await pc.getByText('This board has classes of its own').count()) > 0)
    const text = await pc.getByRole('alertdialog').innerText()
    check(
      'full: too many to add, so only OK is offered',
      /can't be added/.test(text) && (await pc.getByRole('button', { name: 'Yes, add them' }).count()) === 0,
    )
    await shot(pc, '07-question-full')
    await pc.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click()
    check(
      'full: the account is untouched',
      (await waitFor(async () => (await accountClasses(derekUid)).classes.length === 3 && true)) === true,
    )
    await pc.context().close()
  }

  if (want('errors')) {
    const pc = await computer('pc-errors', null)
    await pc.evaluate(() => (window.__testGoogle = { error: 'auth/popup-blocked' }))
    await pc.getByRole('button', { name: /Sign in with Google/ }).click()
    const blocked = await waitFor(async () => /sign-in window was blocked/.test(await splashText(pc)))
    check('errors: a blocked window says how to fix it', Boolean(blocked))
    await shot(pc, '08-error-blocked')
    await pc.evaluate(() => (window.__testGoogle = { error: 'auth/popup-closed-by-user' }))
    await pc.getByRole('button', { name: /Sign in with Google/ }).click()
    await pc.waitForTimeout(800)
    const t = await splashText(pc)
    check("errors: closing Google's window is not an error", !/blocked|didn't work|Can't reach/.test(t) && /Sign in with Google/.test(t))
    check('errors: still signed out', /Welcome, Teacher!/.test(t) && !(await uidOf(pc)))
    await pc.context().close()
  }

  if (want('title')) {
    // A Google name that starts with a title is greeted with the name after it, not the title alone.
    const AMY = { sub: 'google-amy', email: 'amy@yuteh.ntpc.edu.tw', email_verified: true, name: 'Teacher Amy Chen' }
    const pc = await computer('pc-title', null)
    // A brand-new teacher on a fresh board: one button, and signing in goes straight to setting up a class.
    const fresh = await splashText(pc)
    check(
      'first sign-in: a fresh board shows Welcome, Teacher! and one button, Sign in with Google',
      /Welcome, Teacher!/.test(fresh) && (await pc.locator('.splash-board button').count()) === 1,
      fresh.replace(/\s+/g, ' ').slice(0, 100),
    )
    await signIn(pc, AMY)
    const setUp = await waitFor(async () => (await pc.getByRole('tab', { name: 'Class', selected: true }).count()) === 1)
    check('first sign-in: a brand-new teacher goes straight to Class Settings, on the Class tab', Boolean(setUp))
    await shot(pc, '11-first-sign-in')
    // The next day: her class, New Class and Switch Teacher, nothing else.
    await pc.reload()
    const greeted = await waitFor(async () => greets(await splashText(pc), 'Teacher Amy'))
    check(
      'title: "Teacher Amy Chen" is welcomed as Teacher Amy',
      Boolean(greeted),
      (await splashText(pc)).replace(/\s+/g, ' ').slice(0, 80),
    )
    const circle = (await pc.getByRole('button', { name: /Switch Teacher/ }).innerText()).trim()
    check("title: the circle on Switch Teacher is her letter, A, not the title's", /^A\s+Switch Teacher$/.test(circle), circle)
    const buttons = await pc.locator('.splash-board button').allInnerTexts()
    check(
      'next day: the splash is her class, New Class and Switch Teacher, nothing else',
      buttons.length === 3 && /Class 1/.test(buttons[0]) && /New Class/.test(buttons[1]) && /Switch Teacher/.test(buttons[2]),
      buttons.map((b) => b.replace(/\s+/g, ' ')).join(' | '),
    )
    await shot(pc, '12-next-day')
    // A board that saved the name the old way, as "Teacher", puts it right the next time it opens.
    await pc.evaluate(() => {
      const a = JSON.parse(localStorage.getItem('seating-chart-account-v1'))
      localStorage.setItem('seating-chart-account-v1', JSON.stringify({ ...a, firstName: 'Teacher' }))
    })
    await pc.reload()
    const fixed = await waitFor(async () => greets(await splashText(pc), 'Teacher Amy'))
    check('title: a board that saved "Teacher" greets Teacher Amy once it has checked the sign-in', Boolean(fixed))
    const kept = await pc.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-account-v1')).firstName)
    check('title: and keeps the new name for next time', kept === 'Teacher Amy', kept)
    if (pc.errors.length) check('title: no page errors', false, pc.errors.slice(0, 3).join(' | '))
    await pc.context().close()
  }

  if (want('reconnect')) {
    // The board remembers the teacher, but its own link to Google has gone (Firebase's sign-in on
    // this computer was cleared). The splash shows only Switch Teacher - no Sign in again beside
    // it - and tapping a class reconnects, so saving to the account starts again.
    const pc = await computer('pc-reconnect', [makeClass('g4', 'Grade 4 English', 28)])
    await signIn(pc, DEREK)
    await waitFor(async () => greets(await splashText(pc), 'Derek'))
    await pc.evaluate(() => {
      sessionStorage.setItem('drop-firebase-sign-in', '1')
      // Firebase's own copy of the sign-in, in both places it may keep one.
      for (const k of Object.keys(localStorage)) if (k.startsWith('firebase:authUser')) localStorage.removeItem(k)
    })
    await pc.addInitScript(() => {
      if (!sessionStorage.getItem('drop-firebase-sign-in')) return
      sessionStorage.removeItem('drop-firebase-sign-in')
      indexedDB.deleteDatabase('firebaseLocalStorageDb')
    })
    await pc.reload()
    await pc.waitForTimeout(2500)
    const splash = await splashText(pc)
    check(
      'reconnect: a board that lost its link still greets Derek, with no Sign in again beside Switch Teacher',
      greets(splash, 'Derek') && /Switch Teacher/.test(splash) && !/Sign in/.test(splash),
      splash.replace(/\s+/g, ' ').slice(0, 140),
    )
    // Closing Google's window: the class opens anyway, and the Saved mark shows the link is down.
    await pc.evaluate(() => (window.__testGoogle = { error: 'auth/popup-closed-by-user' }))
    await openClass(pc, 'Grade 4 English')
    const down = await waitFor(async () => (await syncMark(pc)) === 'error')
    check("reconnect: closing Google's window still opens the class, with the Saved mark amber", Boolean(down), String(await syncMark(pc)))
    await pc.reload()
    await pc.waitForTimeout(2500)
    await pc.evaluate((w) => (window.__testGoogle = w), DEREK)
    await openClass(pc, 'Grade 4 English')
    const saved = await waitFor(async () => (await syncMark(pc)) === 'saved', 15000)
    check('reconnect: tapping a class reconnects, and the side panel says Saved', Boolean(saved), String(await syncMark(pc)))
    await givePoint(pc, 'Amy')
    const reached = await waitFor(
      async () =>
        pointsIn(
          (await accountClasses(derekUid ?? (await uidOf(pc)))).classes.find((c) => c.name === 'Grade 4 English'),
          'Amy',
        ) >= 1,
    )
    check('reconnect: a star given afterwards reaches the account', Boolean(reached))
    if (pc.errors.length) check('reconnect: no page errors', false, pc.errors.slice(0, 3).join(' | '))
    await pc.context().close()
  }

  if (want('panel') && board) {
    // The side panel: the Saved mark doesn't push anything off the screen, and it holds Switch Teacher.
    for (const [w, h] of [
      [1024, 640],
      [1280, 800],
      [1920, 1080],
    ]) {
      await board.setViewportSize({ width: w, height: h })
      await board.waitForTimeout(300)
      const over = await board.evaluate(() => {
        const aside = document.querySelector('aside')
        return Math.max(
          document.documentElement.scrollHeight - document.documentElement.clientHeight,
          aside.scrollHeight - aside.clientHeight,
        )
      })
      check(`panel: nothing scrolls at ${w}x${h} with the Saved mark`, over <= 0, `${over}px`)
    }
    await board.setViewportSize({ width: 1280, height: 800 })
    await board.locator('aside [data-sync]').click()
    const pop = await board.locator('[data-radix-popper-content-wrapper]').innerText()
    check(
      'panel: a tap on Saved shows whose account, and Switch Teacher',
      /Derek/.test(pop) && /derek@yuteh/.test(pop) && /Switch Teacher/.test(pop),
      pop.replace(/\s+/g, ' '),
    )
    await shot(board, '09-saved-popover')

    // Offline, Switch Teacher warns that changes would be lost.
    await board.keyboard.press('Escape')
    await board.context().setOffline(true)
    await waitFor(async () => (await syncMark(board)) === 'offline')
    await givePoint(board, 'Brian')
    await board.locator('aside [data-sync]').click()
    await board.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: 'Switch Teacher' }).click()
    const warn = await board.getByRole('alertdialog').innerText()
    check('panel: offline with changes waiting, Switch Teacher warns', /haven't reached the account/.test(warn))
    await shot(board, '10-switch-offline')
    await board.getByRole('alertdialog').getByRole('button', { name: 'No' }).click()
    await board.context().setOffline(false)
    await waitFor(async () => (await syncMark(board)) === 'saved', 20000)

    await board.locator('aside [data-sync]').click()
    await board.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: 'Switch Teacher' }).click()
    check('panel: online, no warning', !/haven't reached/.test(await board.getByRole('alertdialog').innerText()))
    await Promise.all([board.waitForEvent('load'), board.getByRole('alertdialog').getByRole('button', { name: 'Yes, Switch' }).click()])
    await board.waitForTimeout(800)
    const t = await splashText(board)
    check('panel: after switching, a fresh board', /Welcome, Teacher!/.test(t) && /first class/.test(t))
    const brian = await waitFor(
      async () =>
        pointsIn(
          (await accountClasses(derekUid)).classes.find((c) => c.name === 'Grade 4 English'),
          'Brian',
        ) === 1,
    )
    check('panel: the star given offline reached the account before the switch', Boolean(brian))
  }

  for (const page of [board, laptop].filter(Boolean)) {
    if (!page.isClosed() && page.errors.length) check(`${page.label}: no page errors`, false, page.errors.slice(0, 3).join(' | '))
  }
} catch (error) {
  check('script', false, error.message.split('\n')[0])
  for (const ctx of browser.contexts())
    for (const p of ctx.pages()) await p.screenshot({ path: `${SHOTS}/crash-${p.label ?? 'page'}.png` }).catch(() => {})
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} OK, ${failed.length} FAIL. Screenshots in ${SHOTS}`)
process.exit(failed.length ? 1 : 0)
