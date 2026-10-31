// The app opens with no internet (2026-10-31: the offline app, src/sw/serviceWorker.js).
// Against a production build, since only the built app keeps itself on the computer:
//   npm run build && npx vite preview --port 4173
//   URL=http://localhost:4173/seating/ node scripts/offline-check.mjs
// Opens a signed-in teacher's board once online, then with the network off: a reload goes back to the
// class, a new tab opens the splash with the classes, and a class opens from it with its desks and the
// rail's pictures.
import pw from '/opt/node22/lib/node_modules/playwright/index.js'
const { chromium } = pw

const URL = process.env.URL || 'http://localhost:4173/seating/'
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

const students = 'Amy Tony Kevin Mulan Brian Cindy'.split(' ').map((name, i) => ({ id: `s${i}`, name, homeroom: '1', gender: 'girl' }))
const seating = Array(40).fill(null)
students.forEach((s, i) => (seating[i] = s.id))
const state = {
  classes: [{ id: 'c1', name: 'Offline Class', students, seating, updatedAt: new Date().toISOString() }],
  activeClassId: 'c1',
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const context = await browser.newContext({ viewport: { width: 1280, height: 559 } })
await context.addInitScript(
  ([s]) => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('seating-chart-state-v1', JSON.stringify(s))
    localStorage.setItem(
      'seating-chart-account-v1',
      JSON.stringify({ uid: 'u', firstName: 'Test', email: 't@e.com', dirty: [], deleted: [] }),
    )
    localStorage.setItem('seating-chart-attendance-reminder-v1', JSON.stringify({ day: new Date().toLocaleDateString('sv'), ids: ['*'] }))
    localStorage.setItem('seating-chart-tour-offer-v1', 'true')
  },
  [state],
)
// Firebase stays out, as in every check: sync is sync-check's job. Per page, not on the context: a
// context's routes also catch the worker's own requests, and it never finished keeping its files.
const blockFirebase = (p) =>
  p.route(
    (url) => url.pathname.includes('firebase'),
    (r) => r.abort(),
  )

const page = await context.newPage()
await blockFirebase(page)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(URL)
await page.evaluate(() => navigator.serviceWorker.ready)
// Kept once the worker controls the page and has finished keeping its files.
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {})
if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
}
const kept = await page.evaluate(async () =>
  (await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).length))).reduce((a, b) => a + b, 0),
)
check('online: the app keeps itself on the computer', kept > 20, `${kept} files kept`)
await page.locator('.splash-board button').first().click()
await page.waitForTimeout(1200)
check('online: the class opens', (await page.locator('[data-ink=desk]').count()) === 6)

await context.setOffline(true)
await page.reload()
await page.waitForTimeout(2500)
check('offline: a reload goes back to the class', (await page.locator('[data-ink=desk]').count()) === 6)
const railPictures = await page.locator('aside svg').count()
check('offline: the rail is drawn', railPictures > 8, `${railPictures} icons`)

const fresh = await context.newPage()
await blockFirebase(fresh)
fresh.on('pageerror', (e) => errors.push(e.message))
await fresh.goto(URL)
await fresh.waitForTimeout(2500)
check(
  'offline: a new tab opens the splash with the class',
  (await fresh.locator('.splash-board button', { hasText: 'Offline Class' }).count()) === 1,
)
await fresh.locator('.splash-board button', { hasText: 'Offline Class' }).click()
await fresh.waitForTimeout(1500)
check('offline: the class opens from the splash', (await fresh.locator('[data-ink=desk]').count()) === 6)
const brokenImages = await fresh.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src))
check('offline: no broken pictures on the board', brokenImages.length === 0, brokenImages.slice(0, 3).join(', '))
await fresh.screenshot({ path: '/tmp/offline-board.png' })
check('no page errors', errors.length === 0, errors.slice(0, 3).join('; '))

await browser.close()
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed} OK, ${failed} FAIL. Screenshot in /tmp/offline-board.png`)
process.exitCode = failed ? 1 : 0
