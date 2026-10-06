import { createRequire } from 'module'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
const require = createRequire(import.meta.url)
// The Move extension on Windows, where Chrome's windows have frames and Linux's test windows don't
// (on the teacher's laptop the first version made the floating window grow instead of moving it).
// Run by .github/workflows/move-extension.yml on GitHub's Windows computers, with Playwright's own
// Chromium shown on the desktop and a build of the app served at localhost:
//   PW=<path to playwright/index.js> URL=http://localhost:4173/seating/ node scripts/move-extension-windows.mjs
// It asks Chrome's windows API directly how it treats the floating window, then slides the hand grip
// with pointer events that carry their own screen positions (a test's mouse is placed by the page,
// which moves under it), and checks the window moved by the slide and kept its size.
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright/index.js')
const URL = process.env.URL || 'http://localhost:4173/seating/'
const EXT = fileURLToPath(new globalThis.URL('../tools/move-extension', import.meta.url))

let failures = 0
/** The scaling being checked, before each check's name. */
let at = ''
function check(name, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${at}${name}${detail ? ` - ${detail}` : ''}`)
}
const note = (text) => console.log(`     ${text}`)

const students = 'Amy Tony Kevin Mulan Brian Cindy'.split(' ').map((n, i) => ({ id: `s${i}`, name: n, homeroom: String(i + 1), points: 0 }))
const seating = Array(40).fill(null)
students.forEach((s, i) => (seating[i] = s.id))
const STATE = {
  classes: [{ id: 'c1', name: '2A1 ELA', students, seating, pointsGoal: 100, classPoints: 37, updatedAt: new Date().toISOString() }],
  activeClassId: 'c1',
}
const TEACHER = { uid: 'move-check', firstName: 'Test', email: 'test@example.com', dirty: [], deleted: [] }

/** The whole check at one screen scaling. */
async function run(scale) {
  at = `${scale * 100}%: `
  const context = await chromium.launchPersistentContext(mkdtempSync(`${tmpdir()}/move-win-`), {
    // Shown on the desktop on Windows; HEADLESS=1 runs it here, where a window has no frame.
    headless: process.env.HEADLESS === '1',
    // Here, the full Chromium (the headless one has no extensions); on Windows, Playwright's own.
    executablePath: process.env.CHROMIUM || undefined,
    viewport: null,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--window-size=1000,700',
      '--window-position=0,0',
      // As if Windows' scaling were set this high: the teacher's laptop and board are scaled.
      `--force-device-scale-factor=${scale}`,
    ],
  })
  let sw = null
  for (let i = 0; i < 100 && !sw; i++) {
    ;[sw] = context.serviceWorkers()
    if (!sw) await new Promise((r) => setTimeout(r, 150))
  }
  if (!sw) throw new Error('The extension did not start')
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
  await page.waitForTimeout(1200)
  const [win] = await Promise.all([context.waitForEvent('page'), page.locator('aside button', { hasText: 'Float' }).click()])
  await win.waitForLoadState()
  await win.waitForTimeout(2000)

  const outer = () => win.evaluate(() => ({ left: screenX, top: screenY, width: outerWidth, height: outerHeight, dpr: devicePixelRatio }))
  const start = await outer()
  note(`floating window as its page sees it: ${JSON.stringify(start)}`)
  note(
    `windows as the extension sees them: ${JSON.stringify(await sw.evaluate(() => chrome.windows.getAll().then((all) => all.map((w) => [w.id, w.type, w.left, w.top, w.width, w.height]))))}`,
  )
  check('the grip is there', (await win.locator('[data-move-grip]').count()) === 1)

  /** Chrome's windows API, asked straight: the floating window moved by left and top alone, five times. */
  const probe = await sw.evaluate(async ({ left, top, width, height }) => {
    const all = await chrome.windows.getAll()
    let best = null
    let off = Infinity
    for (const w of all) {
      const d = Math.abs(w.left - left) + Math.abs(w.top - top) + Math.abs(w.width - width) + Math.abs(w.height - height)
      if (d < off) [best, off] = [w, d]
    }
    const log = { found: [best.left, best.top, best.width, best.height], off, leftTopOnly: [], withSize: [] }
    for (let i = 1; i <= 5; i++) {
      const w = await chrome.windows
        .update(best.id, { left: best.left + 10 * i, top: best.top + 5 * i })
        .catch((e) => ({ error: e.message }))
      log.leftTopOnly.push(w.error || [w.left, w.top, w.width, w.height])
    }
    const now = await chrome.windows.get(best.id)
    for (let i = 1; i <= 5; i++) {
      const w = await chrome.windows
        .update(best.id, {
          left: now.left - 10 * i,
          top: now.top - 5 * i,
          width: now.width,
          height: now.height,
        })
        .catch((e) => ({ error: e.message }))
      log.withSize.push(w.error || [w.left, w.top, w.width, w.height])
    }
    return log
  }, start)
  note(`Chrome's own answer: ${JSON.stringify(probe)}`)
  const afterProbe = await outer()
  note(`after the probe, the page sees: ${JSON.stringify(afterProbe)}`)

  /** A finger slid on the grip: pointer events with their own screen positions. */
  async function slide(dx, dy, still = 0) {
    return win.evaluate(
      async ([dx, dy, still]) => {
        const grip = document.querySelector('[data-move-grip]')
        // A made-up finger can't be captured; a real one is.
        grip.setPointerCapture = () => {}
        const box = grip.getBoundingClientRect()
        const fire = (type, sx, sy) =>
          grip.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 7,
              pointerType: 'touch',
              isPrimary: true,
              clientX: box.x + box.width / 2,
              clientY: box.y + box.height / 2,
              screenX: sx,
              screenY: sy,
            }),
          )
        const wait = (ms) => new Promise((r) => setTimeout(r, ms))
        const x = 600
        const y = 600
        fire('pointerdown', x, y)
        // Held still first, as a finger on a board jitters: the same place over and over.
        for (let i = 0; i < still; i++) {
          fire('pointermove', x + (i % 2), y)
          await wait(30)
        }
        for (let i = 1; i <= 20; i++) {
          fire('pointermove', x + (dx * i) / 20, y + (dy * i) / 20)
          await wait(30)
        }
        fire('pointerup', x + dx, y + dy)
        await wait(800)
      },
      [dx, dy, still],
    )
  }

  let before = await outer()
  await slide(-120, -60)
  let after = await outer()
  check(
    'sliding the grip moves the window by the slide',
    after.left - before.left === -120 && after.top - before.top === -60,
    `${JSON.stringify(before)} to ${JSON.stringify(after)}`,
  )
  check(
    'and keeps its size',
    after.width === before.width && after.height === before.height,
    `${before.width}x${before.height} to ${after.width}x${after.height}`,
  )

  before = after
  await slide(80, 40, 40)
  after = await outer()
  check(
    'held still a while, then slid, it moves by the slide',
    after.left - before.left === 80 && after.top - before.top === 40,
    `${JSON.stringify(before)} to ${JSON.stringify(after)}`,
  )
  check(
    'and still keeps its size',
    after.width === before.width && after.height === before.height,
    `${before.width}x${before.height} to ${after.width}x${after.height}`,
  )
  await win.screenshot({ path: `${tmpdir()}/move-win-after.png` }).catch(() => {})
  await context.close()
}

for (const scale of [1, 1.5]) await run(scale)
console.log(failures ? `${failures} failed` : 'All passed')
process.exit(failures ? 1 : 0)
