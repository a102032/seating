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
await page.addInitScript(
  ([s, t]) => {
    localStorage.setItem('seating-chart-state-v1', JSON.stringify(s))
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

await measure('idle, nothing happening', () => wait(2000))
await measure('tap 6 desks', async () => {
  for (const n of ['Amy', 'Tony', 'Kevin', 'Mulan', 'Brian', 'Cindy']) {
    await desk(n).click()
    await wait(250)
  }
})
await measure('give +1 three times', async () => {
  for (let i = 0; i < 3; i++) {
    await page.locator('aside button:has(svg.lucide-plus)').click()
    await wait(500)
    if (i < 2) {
      await desk('Amy').click()
      await wait(100)
    }
  }
})
await measure('pick student', async () => {
  await page.getByRole('button', { name: 'Pick Student' }).click()
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
await page.getByTitle('Back to the seating chart').click()
await wait(1500)
await measure('group activity: deal 4s', async () => {
  await page.getByRole('button', { name: 'Group Activity' }).click()
  await wait(600)
  await page.getByRole('dialog').getByRole('button', { name: /^4s/ }).click()
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
await measure('dial timer running', async () => {
  await page.locator('aside .bg-clock [role=button]').click()
  await wait(400)
  const sec = page
    .locator('aside .bg-clock div.flex-col.gap-1', { has: page.locator('span:text-is("MIN")') })
    .locator('button')
    .nth(1)
  await sec.click()
  await page.getByRole('button', { name: 'Start' }).click()
  await wait(3000)
})
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
