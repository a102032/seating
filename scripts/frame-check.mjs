import { createRequire } from 'module'
import { readdirSync } from 'fs'
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js')
// How smooth the production build is, frame by frame, with the processor slowed to a board's (DECISIONS: Smooth on the board).
// Serve a build first: npm run build && npx vite preview --port 4173. Then:
//   W=1920 H=1080 DPR=2 node scripts/frame-check.mjs     (4K-like; W/H/DPR default to 1280x800 at 1x)
// It walks a class through the classroom moments and prints frames per second, dropped frames and main-thread time for each.
// Arguments, all optional: processor slowdown (4), theme (vibrant), a label, extra CSS to try out.
const [rate = '4', theme = 'vibrant', label = 'as is', extraCss = ''] = process.argv.slice(2)
const STICKERS = new URL('../public/avatars/stickers', import.meta.url).pathname
const packs = readdirSync(STICKERS)
  .filter((d) => !d.includes('.'))
  .sort()
const names = [
  'Amy',
  'Tony',
  'Kevin',
  'Mulan',
  'Brian',
  'Cindy',
  'Daniel',
  'Emma',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
  'Leo',
  'Sophia',
  'Andy',
  'Bella',
  'Chris',
  'Doris',
  'Eric',
  'Fiona',
  'Gary',
  'Hannah',
  'Ian',
  'Judy',
  'Kelly',
  'Louis',
  'Mandy',
  'Nick',
  'Olivia',
  'Peter',
]
const students = names.map((n, i) => {
  const pack = packs[i % packs.length]
  const pose = readdirSync(`${STICKERS}/${pack}`)
    .filter((f) => f.endsWith('.svg'))
    .sort()[Math.floor(i / packs.length)]
  return {
    id: 's' + i,
    name: n,
    homeroom: String(i + 1),
    gender: i % 2 ? 'boy' : 'girl',
    points: i % 4,
    avatarId: `${pack}/${pose.replace('.svg', '')}`,
  }
})
const seating = students.map((s) => s.id).concat(Array(5).fill(null))
const state = {
  classes: [
    {
      id: 'c1',
      name: 'Grade 4 English',
      students,
      seating,
      updatedAt: new Date().toISOString(),
      pointsGoal: 50,
      classPoints: 30,
      goalEnabled: true,
    },
  ],
  activeClassId: 'c1',
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({
  viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 800) },
  deviceScaleFactor: Number(process.env.DPR || 1),
})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
// A signed-in teacher's board, offline: the splash only offers class cards once someone is
// signed in, and Firebase is kept from loading (as walkthrough.mjs does).
await page.route(
  (url) => url.pathname.includes('firebase'),
  (r) => r.abort(),
)
await page.addInitScript(
  ([s, t]) => {
    // A reload can bring another class in (the Quest's, at the end), set in this tab's sessionStorage.
    localStorage.setItem('seating-chart-state-v1', sessionStorage.getItem('frame-check-state') ?? JSON.stringify(s))
    // The attendance reminder, closed for every class today: each check opens classes for its own reasons.
    localStorage.setItem('seating-chart-attendance-reminder-v1', JSON.stringify({ day: new Date().toLocaleDateString('sv'), ids: ['*'] }))
    localStorage.setItem(
      'seating-chart-account-v1',
      JSON.stringify({ uid: 'frame-check-teacher', firstName: 'Test', email: 'test@example.com', dirty: [], deleted: [] }),
    )
    localStorage.setItem('seating-chart-theme-v1', t)
    localStorage.setItem('seating-chart-theme-chosen-v1', '1')
    localStorage.setItem('seating-chart-timer-settings-v1', JSON.stringify({ warningEnabled: true, alarmSound: 'ding', face: 'dial' }))
    window.__frames = []
    requestAnimationFrame(function loop(t) {
      window.__frames.push(t)
      requestAnimationFrame(loop)
    })
  },
  [state, theme],
)
await page.goto(process.env.URL || 'http://localhost:4173/seating/')
await page.locator('.splash-board button').first().click()
await page.waitForTimeout(2500) // pictures loaded, entrance done
if (extraCss) await page.addStyleTag({ content: extraCss })
const cdp = await page.context().newCDPSession(page)
await cdp.send('Performance.enable')
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) })
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
const wait = (ms) => page.waitForTimeout(ms)
const desk = (n) => page.locator('[data-ink=desk]', { hasText: n }).first()

const results = []
async function measure(name, fn) {
  const i0 = await page.evaluate(() => window.__frames.length)
  const m0 = await metrics()
  const t0 = Date.now()
  await fn()
  const wall = (Date.now() - t0) / 1000
  const m1 = await metrics()
  const f = await page.evaluate((i) => window.__frames.slice(i), i0)
  const gaps = f.slice(1).map((t, i) => t - f[i])
  const dropped = gaps.filter((g) => g > 25).length
  const worst = Math.max(...gaps)
  const d = (k) => m1[k] - m0[k]
  results.push({
    name,
    fps: (gaps.length / wall).toFixed(0),
    dropped,
    worst: worst.toFixed(0),
    busy: ((d('TaskDuration') / wall) * 100).toFixed(0),
    script: (d('ScriptDuration') * 1000).toFixed(0),
    style: ((d('RecalcStyleDuration') + d('LayoutDuration')) * 1000).toFixed(0),
  })
}

// A finger sliding the timer by its strip, and a child's window by its title strip (2026-10-19,
// the teacher: the timer slid smoothly, the avatar picker stuttered): forty moves, a frame apart.
async function slide(handle) {
  const b = await page.locator(handle).first().boundingBox()
  const x = b.x + 30
  const y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(x + i * 4, y + i * 3)
    await wait(16)
  }
  await page.mouse.up()
}
// First, before Group Activity, which is left open further down and stands Choose Your Avatar down.
await page.locator('button[aria-label="Class Settings"]').click()
await wait(800)
await page.locator('[data-section-link="avatars"]').click()
await wait(500)
await page.getByRole('button', { name: 'Let Students Choose' }).click()
await wait(800)
await desk('Kevin').click()
await wait(1500)
await measure("a child's window: sliding it", () => slide('[data-move-strip]'))
await page.keyboard.press('Escape')
await wait(900)
await page.getByRole('button', { name: 'Done', exact: true }).click()
await wait(600)
await measure('idle, nothing happening', () => wait(2000))
await measure('tap 6 desks', async () => {
  for (const n of ['Amy', 'Tony', 'Kevin', 'Mulan', 'Brian', 'Cindy']) {
    await desk(n).click()
    await wait(250)
  }
})
await measure('give +1 three times', async () => {
  for (let i = 0; i < 3; i++) {
    await page.locator('aside button[title="Award Point"]').click()
    await wait(500)
    if (i < 2) {
      await desk('Amy').click()
      await wait(100)
    }
  }
})
await measure('pick student', async () => {
  await page.getByRole('button', { name: 'Pick a Random Student' }).click()
  await wait(3500)
})
await page.mouse.click(700, 400)
await wait(300)
await measure('open flip cards (slide + deal)', async () => {
  await page.getByRole('button', { name: 'Flip Cards' }).click()
  await wait(3500)
})
await measure('flip 3 cards', async () => {
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(420 + i * 150, 560)
    await wait(900)
  }
})
// Fun surprise cards on (in Class Settings' Tools, which the cards' gear opens) and a fresh deal with
// them in it (not measured), then one gift from wrapped to sent.
await page.getByTitle('Flip card settings').click()
await wait(600)
// Since 2026-10-26 the gear opens Tools' list, and the cards' own page is behind its Settings.
await page.locator('[data-guide="flip-settings"]').click()
await wait(300)
await page.locator('[data-guide="gifts"] [role="switch"]').click()
await page.keyboard.press('Escape')
await wait(600)
await page.getByRole('button', { name: 'Shuffle' }).click()
await wait(4500)
await measure('a mystery gift: dance, roll, send', async () => {
  const gift = page.locator('[data-bonus=gift]').first()
  await gift.click()
  await wait(1500)
  await gift.click()
  await wait(2500)
  await gift.click()
  await wait(2000)
})
await page.getByTitle('Back to the seating chart').click()
await wait(1500)
// The Line: the column opens beside the desks, five children get in line, then Done (its stars at
// the desk and the Done picture popping in) twice, the next one called each time.
await measure('line: open, five get in line', async () => {
  await page.getByRole('button', { name: 'Line', exact: true }).click()
  await wait(600)
  await page.waitForTimeout(800)
  await page.fill('#line-name', 'Test')
  await page.getByRole('button', { name: 'Save and Start' }).click()
  await page.waitForTimeout(500)
  for (const n of ['Amy', 'Tony', 'Kevin', 'Mulan', 'Brian']) {
    await desk(n).click()
    await wait(750)
  }
})
await measure('line: Done twice, stars at the desk', async () => {
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-line-panel] button', { hasText: /Done$/ }).last().click()
    await wait(1200)
  }
})
await page.getByRole('button', { name: 'Line', exact: true }).click()
await wait(800)
await measure('group activity: deal 4 groups', async () => {
  await page.getByRole('button', { name: 'Group Activity' }).click()
  await wait(600)
  await page.getByRole('dialog').getByRole('button', { name: /^4/ }).first().click()
  await wait(800)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Make them for me/ })
    .click()
  await wait(4000)
})
await measure('group activity: +1 on a card', async () => {
  const plus = page.locator('main button:has(svg.lucide-plus)')
  for (let i = 0; i < 3; i++) {
    await plus.nth(i).click()
    await wait(400)
  }
})
await page.getByRole('button', { name: /Exit Group Activity/ }).click()
await wait(800)
if (await page.getByRole('dialog').count()) {
  await page.keyboard.press('Escape')
  await wait(500)
}
await page.getByRole('button', { name: 'Get Ready!' }).click()
await wait(600)
await page.locator('[data-drum="20"]').click()
await wait(900)
await page.locator('[data-get-ready] button[aria-label="Start"]').click()
await measure('get ready: drum beating, shrinking', () => wait(7000))
await measure('get ready: stars into the jar', async () => {
  await page.getByRole('button', { name: 'Ready!', exact: true }).click()
  await wait(2500)
})
await page.mouse.click(700, 400)
await wait(800)
await measure('timer running, big', async () => {
  await page.locator('aside button[aria-label="Timer"]').click()
  await wait(900)
  await page.locator('[data-timer-card] button[aria-label="Start"]').click()
  await wait(3000)
})
await measure('timer: sliding it', () => slide('[data-timer-strip]'))
await wait(800)
await measure('timer running, in the bar', async () => {
  await page.locator('[data-timer-card] button[aria-label="Put the timer away"]').click()
  await wait(3000)
})
// The mouse face (2026-10-20): the same running timer, eating its apples, with the bites in it.
await page.locator('[data-timer-clock] .timer-open').click()
await wait(800)
await page.locator('[data-timer-card] button[aria-label="Timer settings"]').click()
await wait(800)
await page.locator('[data-timer-card]').getByRole('button', { name: 'Apples' }).click()
await page.locator('[data-timer-card] button.timer-done').click()
await wait(800)
await measure('timer running, the mouse', () => wait(6000))
// The writing mouse (2026-10-22): the same running timer, writing its page.
await page.locator('[data-timer-card] button[aria-label="Timer settings"]').click()
await wait(800)
await page.locator('[data-timer-card]').getByRole('button', { name: 'Writing' }).click()
await page.locator('[data-timer-card] button.timer-done').click()
await wait(800)
await measure('timer running, the writer', () => wait(6000))
// The Marble Jar (2026-10-24; since 2026-10-30 the one quest left). A reload goes straight back to the class (lib/resume).
// The Marble Jar (2026-10-24): the same class on it, its jar a third full, a star from a spin.
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
await page.evaluate((s) => {
  const marbles = []
  for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) marbles.push([0, r * 7 + k, 4 + k * 2, 24.6 - r * 2, 0, 1])
  const c = {
    ...s.classes[0],
    pointsMode: 'quest',
    classPoints: 49,
    marbleJar: { number: 1, marbles, spins: 0, filled: [], spinDays: [], startedOn: '2026-09-01' },
  }
  sessionStorage.setItem('frame-check-state', JSON.stringify({ ...s, classes: [c] }))
}, state)
await page.reload()
await wait(3000)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) })
await desk('Amy').click()
await wait(300)
await measure('marbles: the wheel comes up', async () => {
  await page.locator('aside button[title="Award Point"]').click()
  await wait(2000)
})
// It lands on the Mega, the biggest of the landings (fireworks over the wheel, 2026-10-24): the seventh of eight equal wedges.
await page.evaluate(() => {
  window.__realRandom = Math.random
  Math.random = () => 292.5 / 360
})
await measure('marbles: the wheel spinning', async () => {
  await page.getByRole('button', { name: 'Spin!' }).click()
  await page.evaluate(() => (Math.random = window.__realRandom))
  await wait(5600)
})
await measure('marbles: the Mega celebration', () => wait(2200))
await measure('marbles: the pour', () => wait(5000))
// The full jar's prize wheel: the jar opened, the wheel out of it, spun, and the prize.
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
await page.evaluate((s) => {
  const marbles = []
  for (let r = 0; r < 8; r++) for (let k = 0; k < 7; k++) marbles.push([0, r * 7 + k, 4 + k * 2, 24.6 - r * 2, 0, 1])
  marbles.push([2, 0, 10, 8, 0, 2.7])
  const c = {
    ...s.classes[0],
    pointsMode: 'quest',
    classPoints: 10,
    marbleJar: { number: 1, marbles, spins: 0, filled: [], spinDays: [], startedOn: '2026-09-01' },
  }
  sessionStorage.setItem('frame-check-state', JSON.stringify({ ...s, classes: [c] }))
}, state)
await page.reload()
await wait(3000)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) })
await page.locator('[data-marble-mini]').click()
await wait(1000)
await measure('prize wheel: out of the jar', async () => {
  await page.getByRole('button', { name: 'Prize wheel!' }).click()
  await wait(3500)
})
await measure('prize wheel: spinning', async () => {
  await page.getByRole('button', { name: 'Spin!' }).click()
  await wait(6500)
})
await measure('prize wheel: the prize', () => wait(3000))
console.log(`\n${label} | theme ${theme} | processor ${rate}x slower`)
console.log('scenario'.padEnd(32), 'fps  dropped  worst(ms)  main-thread busy  script  style+layout(ms)')
for (const r of results)
  console.log(
    r.name.padEnd(32),
    String(r.fps).padStart(3),
    String(r.dropped).padStart(8),
    String(r.worst).padStart(10),
    (r.busy + '%').padStart(17),
    String(r.script).padStart(7),
    String(r.style).padStart(12),
  )
console.log('errors:', errors.length ? errors.slice(0, 3) : 'none')
await browser.close()
