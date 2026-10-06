import { createRequire } from 'module'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js')
// The Move extension (tools/move-extension) with the app: the floating window's hand grip moves
// the window when a finger slides on it, and without the extension there is no grip.
// Serve a build first (npm run build, then npx vite preview --port 4173). Then:
//   URL=http://localhost:4173/seating/ node scripts/move-extension-check.mjs
// The extension only answers pages at the app's address and at localhost, so it must be localhost here.
const URL = process.env.URL || 'http://localhost:4173/seating/'
const EXT = new globalThis.URL('../tools/move-extension', import.meta.url).pathname

let failures = 0
function check(name, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

const students = 'Amy Tony Kevin Mulan Brian Cindy'.split(' ').map((n, i) => ({ id: `s${i}`, name: n, homeroom: String(i + 1), points: 0 }))
const seating = Array(40).fill(null)
students.forEach((s, i) => (seating[i] = s.id))
const STATE = {
  classes: [{ id: 'c1', name: '2A1 ELA', students, seating, pointsGoal: 100, classPoints: 37, updatedAt: new Date().toISOString() }],
  activeClassId: 'c1',
}
const TEACHER = { uid: 'move-check', firstName: 'Test', email: 'test@example.com', dirty: [], deleted: [] }

/** The app with Float tapped: the page, and the floating window as a page of its own. */
async function floatIn(context) {
  const page = context.pages()[0] || (await context.newPage())
  await page.route(
    (url) => url.pathname.includes('firebase'),
    (r) => r.abort(),
  )
  await page.addInitScript(
    ([s, t]) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('seating-chart-state-v1', JSON.stringify(s))
      localStorage.setItem('seating-chart-account-v1', JSON.stringify(t))
    },
    [STATE, TEACHER],
  )
  await page.goto(URL)
  await page.locator('.splash-board button').first().click()
  await page.waitForTimeout(900)
  const [win] = await Promise.all([context.waitForEvent('page'), page.locator('aside button', { hasText: 'Float' }).click()])
  await win.waitForLoadState()
  await win.waitForTimeout(1500)
  // Playwright gives the floating window a screen the size of the test's viewport, but Chrome
  // checks a move against its real one (800x600 here) and refuses a window more than half off it.
  // The resizes are noted too: Playwright keeps the window stretched whatever it is asked.
  await win.evaluate(() => {
    for (const [k, v] of Object.entries({ availWidth: 800, availHeight: 600, availLeft: 0, availTop: 0 })) {
      Object.defineProperty(screen, k, { get: () => v })
    }
    window.__resizes = []
    const resize = window.resizeTo.bind(window)
    window.resizeTo = (w, h) => {
      window.__resizes.push([w - (window.outerWidth - window.innerWidth), h - (window.outerHeight - window.innerHeight)])
      resize(w, h)
    }
  })
  return { page, win }
}

const where = (win) => win.evaluate(() => [window.screenX, window.screenY])

/** A finger (the mouse, here) held on the grip, then slid by dx, dy. */
async function slide(win, dx, dy, holdMs = 0) {
  const box = await win.locator('[data-move-grip]').boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await win.mouse.move(x, y)
  await win.mouse.down()
  await win.waitForTimeout(holdMs)
  // Positions in the window's own page: Playwright moves the pointer there, and the grip reads the screen.
  for (let i = 1; i <= 10; i++) {
    await win.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10)
    await win.waitForTimeout(30)
  }
  await win.mouse.up()
  await win.waitForTimeout(600)
}

// Without the extension: the floating window as it always was.
{
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const { win } = await floatIn(await browser.newContext())
  check('without the extension, no grip', (await win.locator('[data-move-grip]').count()) === 0)
  await browser.close()
}

// With it.
const context = await chromium.launchPersistentContext(mkdtempSync(`${tmpdir()}/move-ext-`), {
  executablePath: '/opt/pw-browsers/chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
})
const { win } = await floatIn(context)
const errors = []
win.on('pageerror', (e) => errors.push(e.message))
check('with the extension, the grip is in the floating window', (await win.locator('[data-move-grip]').count()) === 1)

let before = await where(win)
await slide(win, -120, -70)
let after = await where(win)
check('sliding the grip moves the window with it', after[0] - before[0] === -120 && after[1] - before[1] === -70, `${before} to ${after}`)

before = after
await slide(win, 90, 40, 1500)
after = await where(win)
check('held still first, then slid, it still moves', after[0] - before[0] === 90 && after[1] - before[1] === 40, `${before} to ${after}`)

await slide(win, -900, -900)
after = await where(win)
check('it stops at the edge of the screen', after[0] === 0 && after[1] === 0, `${after}`)
await slide(win, 900, 900)
after = await where(win)
const size = await win.evaluate(() => [outerWidth, outerHeight])
check('and at the far edges', after[0] === 800 - size[0] && after[1] === 600 - size[1], `${after}, ${size[0]}x${size[1]}`)

const menu = await win
  .locator('[data-move-grip]')
  .evaluate((el) => !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))
check('a long press on the grip opens no menu', menu)

const touch = await win.locator('[data-move-grip]').evaluate((el) => getComputedStyle(el).touchAction)
check("a finger on the grip is all the window's (touch-action none)", touch === 'none', touch)

// The strip keeps the grip, and is wider by its room.
await win.locator('button[aria-label="Make it small"]').click()
await win.waitForTimeout(800)
const [strip] = await win.evaluate(() => window.__resizes.slice(-1))
check('the strip makes room for the grip', strip[0] === 334 && strip[1] === 62, `${strip}`)
check('no errors in the floating window', errors.length === 0, errors.join(' | '))
await context.close()
console.log(failures ? `${failures} failed` : 'All passed')
process.exit(failures ? 1 : 0)
