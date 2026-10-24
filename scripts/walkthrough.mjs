import { createRequire } from 'module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js')
// A scripted run through the app, the way a lesson and a class setup go, looking for what breaks.
// Serve the app first (npm run dev -- --port 5175, or a build with npx vite preview --port 4173). Then:
//   URL=http://localhost:5175/seating/ node scripts/walkthrough.mjs [only]
// `only` runs the scenarios whose names contain it; THEME=comic limits "nothing scrolls" to one theme. FONTS=<dir> serves the real faces (Andika,
// Cabin Sketch, Bangers) from fontsource packages in that dir, since Google Fonts may be blocked.
// Each check prints OK or FAIL; anything a person should look at is written to SHOTS (default: a temp dir).
const URL = process.env.URL || 'http://localhost:5175/seating/'
const only = process.argv[2] || ''
const SHOTS = process.env.SHOTS || `${tmpdir()}/walkthrough`
mkdirSync(SHOTS, { recursive: true })
const FONT_DIR = process.env.FONTS
const FONTS = FONT_DIR && {
  'andika-400': `${FONT_DIR}/fontsource-andika/files/andika-latin-400-normal.woff2`,
  'andika-700': `${FONT_DIR}/fontsource-andika/files/andika-latin-700-normal.woff2`,
  'cabin-700': `${FONT_DIR}/fontsource-cabin-sketch/files/cabin-sketch-latin-700-normal.woff2`,
  'bangers-400': `${FONT_DIR}/fontsource-bangers/files/bangers-latin-400-normal.woff2`,
}
const FAMILY = { andika: 'Andika', cabin: 'Cabin Sketch', bangers: 'Bangers' }
const FONT_CSS = FONTS
  ? Object.keys(FONTS)
      .map((k) => {
        const [fam, w] = k.split('-')
        return `@font-face { font-family: '${FAMILY[fam]}'; font-weight: ${w}; src: url(https://fonts.gstatic.com/local/${k}) format('woff2'); }`
      })
      .join('\n')
  : ''

const THEMES = ['light', 'dark', 'chalk', 'vibrant', 'comic']
const SIZES = [
  [1024, 640],
  [1280, 800],
  [1920, 1080],
]
/**
 * Where "nothing scrolls" is checked: the three above, plus the room Chrome actually leaves a
 * page on real screens once Windows' scaling, Chrome's tabs and bookmarks bar and the taskbar
 * are taken off - 1280x559 is the teacher's 4K board at 300%. 1024x500 is the floor: the app
 * fits anything that size or bigger with no browser or Windows settings changed.
 */
const SCROLL_SIZES = [...SIZES, [1024, 500], [1280, 559], [1366, 620], [1536, 700], [1920, 940], [2560, 1300]]
const NAMES =
  'Amy Tony Kevin Mulan Brian Cindy Daniel Emma Grace Henry Ivy Jack Leo Sophia Andy Bella Chris Doris Eric Fiona Gary Hannah Ian Judy Kelly Louis Mandy Nick Olivia Peter Queenie Ray Sandy Tina Vicky'.split(
    ' ',
  )

function makeClass(id, name, count, extra = {}) {
  const students = NAMES.slice(0, count).map((n, i) => ({
    id: `${id}-s${i}`,
    name: n,
    homeroom: String(i + 1),
    gender: i % 2 ? 'boy' : 'girl',
    points: 0,
  }))
  const seating = Array(35).fill(null)
  students.forEach((s, i) => (seating[i] = s.id))
  return { id, name, students, seating, updatedAt: new Date().toISOString(), ...extra }
}

function stateOf(...classes) {
  return { classes, activeClassId: classes[0].id }
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
/** The page most recently opened, photographed if a scenario's script falls over. */
let lastPage = null

/**
 * The board as a signed-in teacher's, offline: classes are opened signed in only, so the splash
 * has class cards only once someone is. Firebase itself is kept from loading (sync is
 * sync-check's job), which the app takes as no internet: the side panel says Offline and
 * everything else is the app as a teacher uses it.
 */
const TEACHER = { uid: 'walkthrough-teacher', firstName: 'Test', email: 'test@example.com', dirty: [], deleted: [] }

/**
 * A fresh page with this state saved, past the splash screen. `storage` sets any other keys
 * (theme, flip deck settings); `before` runs in the page before the app does.
 */
async function open({ state, theme = 'vibrant', size = [1280, 800], storage = {}, before, fontDelayMs = 0, splash = true }) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] } })
  const page = await context.newPage()
  lastPage = page
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  // Google's face finder (Add Photos) reports its start on the error channel; it isn't one.
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource|net::ERR|XNNPACK delegate/.test(m.text()) && page.errors.push(m.text()),
  )
  if (FONTS) {
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: FONT_CSS }))
    await page.route('https://fonts.gstatic.com/local/**', async (r) => {
      if (fontDelayMs) await new Promise((res) => setTimeout(res, fontDelayMs))
      await r.fulfill({ contentType: 'font/woff2', body: readFileSync(FONTS[r.request().url().split('/').pop()]) })
    })
  }
  await page.route(
    (url) => url.pathname.includes('firebase'),
    (r) => r.abort(),
  )
  await page.addInitScript(
    ([s, t, extra, teacher]) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('seating-chart-state-v1', JSON.stringify(s))
      localStorage.setItem('seating-chart-account-v1', JSON.stringify(teacher))
      localStorage.setItem('seating-chart-theme-v1', t)
      localStorage.setItem('seating-chart-theme-chosen-v1', '1')
      // The tour's one-time offer would take a line above the desks in every scenario; "side desks"
      // brings it back to check it.
      localStorage.setItem('seating-chart-tour-offer-v1', 'true')
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
    },
    [state, theme, storage, TEACHER],
  )
  if (before) await page.addInitScript(before)
  await page.goto(URL)
  if (splash) {
    await page.locator('.splash-board button').first().click()
    await page.waitForTimeout(900)
  }
  return page
}

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-state-v1')))

/**
 * A kind of groups in the Group Activity window, then "Make them for me" (2026-10-12: who fills
 * the groups is the window's second question; Boys / Girls has none). Waits out the guard that
 * keeps the board's double touch from answering it.
 */
async function makeThem(page, name) {
  await page.getByRole('dialog').getByRole('button', { name }).first().click()
  await page.waitForTimeout(800)
  const make = page.getByRole('dialog').getByRole('button', { name: /Make them for me/ })
  if (await make.count()) await make.click()
}

/**
 * Notes every recorded sound the page starts, and when on the sound card's clock, told apart by
 * its length: a drum hit (0.62 s), a bamboo tap (0.32 s) or a rim click (0.09 s). Passed as `before`.
 */
function countSounds() {
  window.__sounds = []
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
    const d = this.buffer ? this.buffer.duration : 0
    const kind = d > 0.5 && d < 0.7 ? 'drum' : d > 0.25 && d < 0.4 ? 'bamboo' : d > 0.07 && d < 0.12 ? 'rim' : 'other'
    window.__sounds.push({ kind, when: when || this.context.currentTime })
    return start.call(this, when, ...rest)
  }
}
const activeSaved = async (page) => {
  const s = await saved(page)
  return s.classes.find((c) => c.id === s.activeClassId)
}
const desk = (page, name) => page.locator('[data-ink=desk]', { hasText: name }).first()
const panelButton = (page, name) => page.locator('aside').getByRole('button', { name, exact: true })
const meterText = (page) => page.locator('.count-pop').first().textContent()
const award = (page) => page.locator('aside button[title="Award Point"]').click()
/** Class Settings, on one of its sections (the list down its left). */
async function openSection(page, section) {
  await page.locator('button[aria-label="Class Settings"]').click()
  await page.waitForTimeout(400)
  await page.locator(`[data-section-link="${section}"]`).click()
  await page.waitForTimeout(200)
}
const openPointsTab = (page) => openSection(page, 'points')

/**
 * A refresh mid-lesson goes straight back to the class (lib/resume): same tab, same teacher, same
 * day. The splash coming back is a failure.
 */
async function refresh(page) {
  await page.reload()
  await page.waitForTimeout(600)
  if (await page.locator('.splash-board').count()) throw new Error('a refresh went back to the splash')
}

/** How far past the screen the page and the side panel run. 0 is the rule. */
async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const aside = document.querySelector('aside')
    const dialog = document.querySelector('[role=dialog], [role=alertdialog]')
    const box = dialog?.getBoundingClientRect()
    return {
      page: doc.scrollHeight - doc.clientHeight,
      pageX: doc.scrollWidth - doc.clientWidth,
      // The app's root clips, but can still be pushed sideways by anything wider than the
      // screen inside it - the goal meter's coin did that once, cutting the side panel off.
      rootX: (() => {
        const root = document.getElementById('root')
        return root ? root.scrollWidth - root.clientWidth + root.scrollLeft : 0
      })(),
      panel: aside ? aside.scrollHeight - aside.clientHeight : 0,
      dialog: box ? Math.max(0, Math.round(box.bottom - innerHeight), Math.round(-box.top)) : 0,
      // A section of Class Settings never runs past the window's edge; only its lists scroll inside.
      section: (() => {
        const page = document.querySelector('.cs-page')
        return page ? Math.max(page.scrollHeight - page.clientHeight, page.scrollWidth - page.clientWidth) : 0
      })(),
      // The Line's column never scrolls: as many names as fit, then "+3 more".
      line: (() => {
        const l = document.querySelector('[data-line-panel]')
        return l ? l.scrollHeight - l.clientHeight : 0
      })(),
      // The big timer floats, so it can't make the page scroll: it must simply be wholly on screen.
      timer: (() => {
        const t = document.querySelector('[data-timer-card]')?.getBoundingClientRect()
        return t ? Math.round(Math.max(0, -t.left, -t.top, t.right - innerWidth, t.bottom - innerHeight)) : 0
      })(),
    }
  })
}

const scenarios = {
  /**
   * The beta testers' changes (2026-10-14): the tour offered once above the desks; a line saying
   * what a desk tap does in Swap Seats and Attendance, with Done; side desks while Swap Seats is on,
   * a student moved to one staying there; and a picked row lighting only desks with a student.
   */
  async 'side desks, hints and the tour offer'() {
    const cls = makeClass('c1', 'Side Desks', 20, { pointsGoal: 50, classPoints: 0, goalEnabled: true })
    const page = await open({ state: stateOf(cls), size: [1280, 559], storage: { 'seating-chart-tour-offer-v1': '' } })
    const offer = page.getByText('New here? Take a tour of the app.')
    check('tour offer: shown above the desks on a board that never took the tour', (await offer.count()) === 1)
    await page.getByRole('button', { name: 'No thanks' }).click()
    await page.waitForTimeout(300)
    check(
      'tour offer: No thanks puts it away for good',
      (await offer.count()) === 0 && (await page.evaluate(() => localStorage.getItem('seating-chart-tour-offer-v1'))) === 'true',
    )
    const empties = () => page.locator('[data-ink=desk-empty]').count()
    const before = await empties()
    await panelButton(page, 'Swap Seats').click()
    await page.waitForTimeout(400)
    check('swap seats: says what a tap does', (await page.getByText('Tap two desks to swap them.').count()) === 1)
    check('swap seats: five side desks show', (await empties()) === before + 5, `${before} -> ${await empties()}`)
    await desk(page, 'Amy').click()
    await page.waitForTimeout(250)
    const boxes = await page
      .locator('[data-ink=desk-empty]')
      .evaluateAll((els) => els.map((e) => [e.getBoundingClientRect().x, e.getBoundingClientRect().y]))
    const right = Math.max(...boxes.map((b) => b[0]))
    const side = boxes
      .map((b, i) => [b, i])
      .filter(([b]) => b[0] === right)
      .sort((x, y) => x[0][1] - y[0][1])
    await page.locator('[data-ink=desk-empty]').nth(side[2][1]).click()
    await page.waitForTimeout(300)
    await page.locator('[data-board-hint] button', { hasText: 'Done' }).click()
    await page.waitForTimeout(400)
    const c = await activeSaved(page)
    const amy = c.students.find((st) => st.name === 'Amy')
    check(
      'side desks: Amy stays at the side, and Done ends Swap Seats',
      c.seating.indexOf(amy.id) >= 30 &&
        (await page.getByText('Tap two desks to swap them.').count()) === 0 &&
        (await empties()) === before + 5,
    )
    let litEmpty = 0
    let sawSide = false
    for (let i = 0; i < 12 && !sawSide; i++) {
      await panelButton(page, 'Pick a Random Row').click()
      await page.waitForTimeout(3600)
      litEmpty += await page.locator('[data-ink=desk-empty].desk-picked').count()
      sawSide = (await page.locator('[data-ink=desk].desk-picked', { hasText: 'Amy' }).count()) === 1
      await page.mouse.click(700, 300)
      await page.waitForTimeout(400)
    }
    check(
      'pick a row: only desks with a student light up, the side desk with the last row',
      litEmpty === 0 && sawSide,
      `empty lit ${litEmpty}, side seen ${sawSide}`,
    )
    await panelButton(page, 'Attendance').click()
    await page.waitForTimeout(300)
    check('attendance: says what a tap does', (await page.getByText('Tap a desk to mark a student away.').count()) === 1)
    await page.locator('[data-board-hint] button', { hasText: 'Done' }).click()
    await page.waitForTimeout(300)
    check('attendance: Done ends it', (await page.getByText('Tap a desk to mark a student away.').count()) === 0)
    await page.getByRole('button', { name: 'Full Screen', exact: true }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/full-screen.png` })
    check(
      'full screen: one tap in, and the rail still fits',
      await page.evaluate(() => {
        const aside = document.querySelector('aside')
        return Boolean(document.fullscreenElement) && aside.scrollHeight - aside.clientHeight <= 0
      }),
    )
    await page.getByRole('button', { name: 'Leave Full Screen' }).click()
    await page.waitForTimeout(400)
    check('full screen: one tap out', await page.evaluate(() => !document.fullscreenElement))
    return page
  },

  /**
   * Lock the board (2026-10-19): one tap on the lock in the far top corner and nothing on the board
   * answers a touch, the board looking as it did; one tap on the lock opens it. The board's second
   * touch can't undo the tap, and a refresh keeps it locked. Taps go by the mouse at a place, as a
   * finger would, since the see-through cover is what they land on.
   */
  async 'board lock'() {
    const cls = makeClass('c1', 'Grade 4 English', 12, { pointsGoal: 50, classPoints: 3 })
    const page = await open({ state: stateOf(cls) })
    const lock = page.locator('[data-board-lock]')
    const tapAt = async (loc) => {
      const b = await loc.boundingBox()
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    }
    const picked = () => page.locator('[data-ink=desk].desk-wiggle, [data-ink=desk].desk-wiggle-loop').count()
    check('board lock: a lock in the top corner', (await page.getByRole('button', { name: 'Lock the Board' }).count()) === 1)
    await tapAt(lock)
    // The board's second touch, a moment later, lands on the lock again: it must not open it.
    await page.waitForTimeout(150)
    await tapAt(lock)
    await page.waitForTimeout(300)
    check(
      'board lock: one tap locks it, and the second touch leaves it locked',
      (await lock.getAttribute('data-board-lock')) === 'locked' && (await page.locator('[data-board-lock-shield]').count()) === 1,
    )
    await page.screenshot({ path: `${SHOTS}/board-locked.png` })
    await tapAt(desk(page, 'Amy'))
    const wiggled = await lock.evaluate((el) => el.getAnimations().length > 0)
    await tapAt(panelButton(page, 'Pick All'))
    await tapAt(panelButton(page, 'Award Point'))
    await tapAt(page.getByRole('button', { name: 'Class Settings' }))
    await page.waitForTimeout(500)
    const c = await activeSaved(page)
    check(
      'board lock: a desk, the rail and the gear answer nothing',
      (await picked()) === 0 && (c.classPoints ?? 0) === 3 && (await page.getByRole('dialog').count()) === 0,
    )
    check('board lock: a stray tap wiggles the lock', wiggled)
    await refresh(page)
    check('board lock: a refresh keeps it locked', (await page.locator('[data-board-lock="locked"]').count()) === 1)
    await page.waitForTimeout(800)
    await tapAt(lock)
    await page.waitForTimeout(150)
    await tapAt(lock)
    await page.waitForTimeout(300)
    check(
      'board lock: one tap on the lock opens it, and the second touch leaves it open',
      (await lock.getAttribute('data-board-lock')) === 'open' && (await page.locator('[data-board-lock-shield]').count()) === 0,
    )
    await desk(page, 'Amy').click()
    await page.waitForTimeout(300)
    check('board lock: open, a desk answers again', (await picked()) > 0)
    return page
  },

  /**
   * A class saved with its goal switched off gave stars that went nowhere the class could see:
   * it comes in with no points, and nothing is given or counted.
   */
  async 'goal off: comes in with no points'() {
    const cls = makeClass('c1', 'Goal Off', 5, { pointsGoal: 50, classPoints: 0, goalEnabled: false })
    const page = await open({ state: stateOf(cls) })
    await desk(page, 'Amy').click()
    await page.waitForTimeout(300)
    const c = await activeSaved(page)
    check(
      'goal off: no star, no Pick All, no meter, and a desk tap picks nobody',
      (await panelButton(page, 'Award Point').count()) === 0 &&
        (await panelButton(page, 'Pick All').count()) === 0 &&
        (await page.locator('[data-goal-coin]').count()) === 0 &&
        (await page.locator('[data-ink=desk].desk-wiggle, [data-ink=desk].desk-wiggle-loop').count()) === 0 &&
        (c.classPoints ?? 0) === 0,
    )
    check('goal off: Get Ready! is still there', (await panelButton(page, 'Get Ready!').count()) === 1)
    await page.screenshot({ path: `${SHOTS}/no-goal-corner.png` })
    check(
      'goal off: Full Screen and the lock are still in the top corner',
      (await page.getByRole('button', { name: 'Full Screen', exact: true }).count()) === 1 &&
        (await page.getByRole('button', { name: 'Lock the Board' }).count()) === 1,
    )
    return page
  },

  /**
   * The three ways of running points (2026-10-11): a class goal, each student's own stars on their
   * desk, or none. Student points: + and − on the desks, Get Ready! gives everyone the stars, group
   * points go to each member, Clear All Stars empties them, and leaving asks first. No points: no
   * star, no scores on the group cards, and Get Ready! is a challenge with no prize.
   */
  /**
   * The Class Quest (DECISIONS, "Treasure Quest"): a filled goal wins a key that waits for a tap and
   * flies into the chest; a chest with all its keys opens on a tap, a wheel rises with the agreed
   * odds, Pick a Spinner names someone here and counts it as their turn, Spin lands on one slice and
   * the prize fills the screen until tapped; the class walks on to the next chest, and after the Mega
   * chest a new quest starts. Our Quest on its map never scrolls, and the floating window shows the
   * chest and says Open the chest when it has all its keys.
   */
  async 'the class quest'() {
    const quest = (chest, keys, extra = {}) => ({ number: 1, chest, keys, opened: [], keyDays: [], startedOn: '2026-09-01', ...extra })
    const cls = makeClass('c1', 'Quest', 12, { pointsMode: 'quest', goalEnabled: true, pointsGoal: 10, classPoints: 9 })
    let page = await open({ state: stateOf(cls), size: [1280, 559], before: () => sessionStorage.setItem('picks', '0') })
    check(
      'quest: the knight rides the meter where the coin would',
      (await page.locator('[data-goal-coin="knight"]').count()) === 1 && (await page.locator('[data-goal-coin=""]').count()) === 0,
    )
    await desk(page, 'Amy').click()
    await award(page)
    await page.waitForTimeout(1300)
    let c = await activeSaved(page)
    check(
      'quest: a filled goal wins a key, kept as it is won',
      c.quest?.keys === 1 && c.goalsReached === 1 && (await page.locator('[data-quest-moment="key"]').count()) === 1,
      JSON.stringify(c.quest),
    )
    check('quest: "You got a key!"', (await page.locator('[data-quest-moment="key"]').innerText()).includes('You got a key!'))
    await page.mouse.click(640, 300)
    await page.waitForTimeout(2200)
    check(
      'quest: a tap sends the key into the chest, and the chest is ready',
      (await page.locator('[data-quest-moment]').count()) === 0 &&
        (await page.locator('[data-quest-chest]').locator('..').getAttribute('title')) === 'Open the chest',
    )
    // The chest opening: the wheel, Pick a Spinner, Spin, the prize.
    await page.locator('[data-quest-chest]').click()
    await page.waitForTimeout(3300)
    const fills = await page
      .locator('[data-quest-wheel] [data-slice] > path:first-child')
      .evaluateAll((ps) => ps.map((p) => p.getAttribute('fill')))
    const count = (k) => fills.filter((f) => f.includes(k)).length
    check(
      'quest: the Wood wheel is 6 plain, 2 silver, no gold',
      count('silver') === 2 && count('gold') === 0 && fills.length === 8,
      fills.join(' '),
    )
    const picksBefore = Object.values((await activeSaved(page)).participation ?? {})
      .flatMap((d) => Object.values(d))
      .reduce((n, [p]) => n + p, 0)
    await page.getByRole('button', { name: 'Pick a Spinner' }).click()
    await page.waitForTimeout(3300)
    const spinner = await page.locator('[data-quest-spinner]').innerText()
    c = await activeSaved(page)
    const picksAfter = Object.values(c.participation ?? {})
      .flatMap((d) => Object.values(d))
      .reduce((n, [p]) => n + p, 0)
    check(
      'quest: Pick a Spinner names a student, and it is their turn',
      /, spin!$/.test(spinner) && picksAfter === picksBefore + 1,
      spinner,
    )
    await page.getByRole('button', { name: 'Spin!' }).click()
    await page.waitForTimeout(6600)
    check('quest: the wheel lands on one slice, the rest fade', (await page.locator('.quest-slice-dim').count()) === 7)
    await page.waitForTimeout(1200)
    const prize = await page.locator('[data-quest-prize]').getAttribute('data-quest-prize')
    check('quest: the prize fills the screen', !!prize, prize)
    await page.mouse.click(640, 300)
    await page.waitForTimeout(900)
    c = await activeSaved(page)
    check(
      'quest: the chest goes on the map and the class walks on to Bronze',
      c.quest.chest === 1 &&
        c.quest.keys === 0 &&
        c.quest.opened[0]?.prize.name === prize &&
        (await page.locator('[data-quest-moment]').count()) === 0,
      JSON.stringify(c.quest),
    )
    // Our Quest: a tap on the chest while it needs keys.
    await page.locator('[data-quest-chest]').click()
    await page.waitForTimeout(800)
    check('quest: the chest opens Our Quest when it needs keys', await page.locator('[data-our-quest]').isVisible())
    check(
      'quest: the map shows the prize under the Wood chest',
      (await page.locator('[data-our-quest] [data-station="0"]').innerText()).includes(prize),
    )
    const mapOver = []
    for (const size of SCROLL_SIZES) {
      await page.setViewportSize({ width: size[0], height: size[1] })
      await page.waitForTimeout(250)
      const o = await overflow(page)
      const out = await page.evaluate(() => {
        const m = document.querySelector('[data-our-quest]').getBoundingClientRect()
        return [...document.querySelectorAll('[data-our-quest] [data-station]')].some((e) => {
          const r = e.getBoundingClientRect()
          return r.top < m.top - 1 || r.bottom > m.bottom + 1 || r.left < m.left - 1 || r.right > m.right + 1
        })
      })
      if (out || Object.values(o).some((v) => v > 0)) mapOver.push(`${size.join('x')} ${JSON.stringify(o)} ${out}`)
    }
    check('quest: Our Quest fits every screen, nothing scrolls', mapOver.length === 0, mapOver.join('; '))
    await page.setViewportSize({ width: 1280, height: 559 })
    await page.locator('button[aria-label="Close Our Quest"]').click()
    await page.waitForTimeout(300)
    check('quest: Our Quest closes on its X', (await page.locator('[data-our-quest]').count()) === 0)
    await page.context().close()

    // The Silver wheel's first gold slice, and the Mega chest starting a new quest.
    const silver = makeClass('c1', 'Quest', 12, {
      pointsMode: 'quest',
      goalEnabled: true,
      pointsGoal: 10,
      classPoints: 0,
      quest: quest(2, 3),
    })
    page = await open({ state: stateOf(silver), size: [1024, 500] })
    await page.locator('[data-quest-chest]').click()
    await page.waitForTimeout(3300)
    const sf = await page
      .locator('[data-quest-wheel] [data-slice] > path:first-child')
      .evaluateAll((ps) => ps.map((p) => p.getAttribute('fill')))
    check(
      'quest: the Silver wheel is 2 plain, 5 silver, 1 gold',
      sf.filter((f) => f.includes('silver')).length === 5 && sf.filter((f) => f.includes('gold')).length === 1,
    )
    const fit = await page.evaluate(() => {
      const r = document.querySelector('[data-quest-wheel]').getBoundingClientRect()
      const b = [...document.querySelectorAll('.quest-stage-btn')].map((e) => e.getBoundingClientRect())
      return r.top >= 0 && b.every((x) => x.bottom <= innerHeight && x.right <= innerWidth)
    })
    check('quest: the chest opening fits 1024x500', fit)
    await page.locator('button[aria-label="Not now"]').click()
    await page.waitForTimeout(400)
    c = await activeSaved(page)
    check(
      'quest: Not now puts it back, the chest still full',
      (await page.locator('[data-quest-moment]').count()) === 0 && c.quest.keys === 3 && c.quest.chest === 2,
    )
    await page.context().close()

    const mega = makeClass('c1', 'Quest', 12, {
      pointsMode: 'quest',
      goalEnabled: true,
      pointsGoal: 10,
      classPoints: 0,
      quest: quest(4, 6),
    })
    page = await open({ state: stateOf(mega), size: [1280, 559] })
    await page.locator('[data-quest-chest]').click()
    await page.waitForTimeout(3300)
    const mf = await page
      .locator('[data-quest-wheel] [data-slice] > path:first-child')
      .evaluateAll((ps) => ps.map((p) => p.getAttribute('fill')))
    check('quest: the Mega wheel is all gold', mf.length === 8 && mf.every((f) => f.includes('gold')), mf.join(' '))
    await page.getByRole('button', { name: 'Spin!' }).click()
    await page.waitForTimeout(8000)
    await page.mouse.click(640, 300)
    await page.waitForTimeout(900)
    c = await activeSaved(page)
    check(
      'quest: after the Mega chest a new quest starts, with the spare key',
      c.quest.number === 2 && c.quest.chest === 0 && c.quest.keys === 1 && c.quest.opened.length === 0,
      JSON.stringify(c.quest),
    )
    await page.locator('[data-quest-chest]').click()
    await page.waitForTimeout(3300)
    await page.locator('button[aria-label="Not now"]').click()
    await page.context().close()

    // Points: four choices, the prize list, and how long the last key took.
    const pts = makeClass('c1', 'Quest', 12, {
      pointsMode: 'quest',
      goalEnabled: true,
      pointsGoal: 10,
      quest: quest(1, 1, { keyDays: ['2026-10-14', '2026-10-20'] }),
    })
    page = await open({ state: stateOf(pts), size: [1024, 500] })
    await openPointsTab(page)
    await page.waitForTimeout(300)
    const body = await page.locator('.cs-page').innerText()
    check(
      'quest: Points has four choices and says the last key took 6 days',
      ['Class Goal', 'Class Quest', 'Student Points (No Goal)', 'No Points'].every((l) => body.includes(l)) &&
        body.includes('The last key took 6 days.'),
    )
    check('quest: Points fits at 1024x500', (await page.locator('.cs-page').evaluate((e) => e.scrollHeight - e.clientHeight)) <= 0)
    await page.getByRole('button', { name: /^10 prizes/ }).click()
    await page.waitForTimeout(200)
    await page.locator('input[aria-label="A new big prize"]').fill('Library trip')
    await page.locator('button[aria-label="Add a big prize"]').click()
    await page.locator('button[aria-label="Remove Candy treat"]').click()
    await page.waitForTimeout(300)
    c = await activeSaved(page)
    check(
      'quest: a prize is added and one taken out',
      c.questPrizes.some((p) => p.name === 'Library trip' && p.size === 'b') &&
        !c.questPrizes.some((p) => p.name === 'Candy treat') &&
        c.questPrizes.length === 10,
    )
    check('quest: the prize list fits at 1024x500', (await page.locator('.cs-page').evaluate((e) => e.scrollHeight - e.clientHeight)) <= 0)
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('button', { name: /Start Over/ }).click()
    await page.getByRole('button', { name: 'Yes, Start Over' }).click()
    await page.waitForTimeout(300)
    c = await activeSaved(page)
    check('quest: Start Over goes back to the Wood chest', c.quest.chest === 0 && c.quest.keys === 0)
    await page.getByRole('button', { name: 'Class Goal', exact: true }).click()
    await page.waitForTimeout(300)
    c = await activeSaved(page)
    check('quest: back to a plain class goal, the quest kept for later', c.pointsMode === 'goal' && c.goalEnabled === true && !!c.quest)
    await page.context().close()

    // The floating window: the chest the class is on, and Open the chest.
    const fl = makeClass('c1', 'Quest', 12, { pointsMode: 'quest', goalEnabled: true, pointsGoal: 10, classPoints: 2, quest: quest(1, 2) })
    page = await open({ state: stateOf(fl), size: [1280, 559] })
    const [win] = await Promise.all([page.context().waitForEvent('page'), panelButton(page, 'Float').click()])
    await win.waitForLoadState()
    await win.setViewportSize({ width: 340, height: 180 })
    await page.waitForTimeout(600)
    check(
      'float: the quest chest, and Open the chest when it has its keys',
      (await win.locator('[data-float-chest]').count()) === 1 && (await win.getByText('Open the chest').count()) === 1,
    )
    await win.getByText('Open the chest').click()
    await page.bringToFront()
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.waitForTimeout(1500)
    check('float: Open the chest opens it in the app', (await page.locator('[data-quest-moment="chest"]').count()) === 1)
    check('quest: no errors', page.errors.length === 0, page.errors.join('; '))
    await page.context().close()
  },

  async 'the marble jar'() {
    // A jar laid out in rows, as if it had settled: 8 rows of 7 plain marbles and a Mega is past the line.
    const rows = (n) => {
      const out = []
      for (let r = 0; r < n; r++) for (let k = 0; k < 7; k++) out.push([0, r * 7 + k, 4 + k * 2, 24.6 - r * 2, 0, 1])
      return out
    }
    const jar = (extra = {}) => ({ number: 1, marbles: [], spins: 0, filled: [], spinDays: [], startedOn: '2026-09-01', ...extra })
    const cls = makeClass('c1', 'Marbles', 12, {
      pointsMode: 'quest',
      questAdventure: 'marbles',
      goalEnabled: true,
      pointsGoal: 10,
      classPoints: 9,
      marbleJar: jar({ marbles: rows(2) }),
    })
    let page = await open({ state: stateOf(cls), size: [1280, 559] })
    check(
      'marbles: a marble rides the meter, the wheel waits at its end, then the jar',
      (await page.locator('[data-goal-coin="marble"]').count()) === 1 &&
        (await page.locator('[data-marble-next]').count()) === 1 &&
        (await page.locator('[data-marble-mini]').count()) === 1 &&
        (await page.locator('[data-quest-next-key]').count()) === 0,
    )
    check(
      'marbles: no map at the meter\'s start',
      (await page.locator('img[src*="map"]').count()) === 0,
    )
    await desk(page, 'Amy').click()
    await award(page)
    await page.waitForTimeout(1600)
    let c = await activeSaved(page)
    check(
      'marbles: a filled goal wins a spin, kept as it is won, and the wheel comes up',
      c.marbleJar?.spins === 1 && c.goalsReached === 1 && (await page.locator('[data-marble-moment="spin"]').count()) === 1,
      JSON.stringify(c.marbleJar?.spins),
    )
    check('marbles: the wheel shows a ? on every wedge', (await page.locator('[data-marble-wheel] [data-face]').count()) === 8)
    await page.screenshot({ path: '/tmp/walkthrough/marbles-1-spin.png' })
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Spin!' }).click()
    await page.waitForTimeout(6600)
    check(
      'marbles: the wheel lands on one wedge, the rest fade',
      (await page.locator('[data-marble-wheel] .quest-slice-dim').count()) === 7,
    )
    const said = await page.locator('[data-marble-title]').innerText()
    check('marbles: it says what it landed on', /marbles!|Marble!/.test(said), said)
    await page.getByRole('button', { name: 'Done' }).waitFor({ timeout: 20000 })
    c = await activeSaved(page)
    check(
      'marbles: the marbles pour in, settle, and are kept where they came to rest',
      c.marbleJar.spins === 0 && c.marbleJar.marbles.length > 14 && c.marbleJar.marbles.every((m) => m[3] > 6 && m[3] < 26),
      `${c.marbleJar.marbles.length} marbles`,
    )
    const kept = JSON.stringify(c.marbleJar.marbles)
    await page.screenshot({ path: '/tmp/walkthrough/marbles-2-poured.png' })
    // Done waits out the board's second touch after it appears.
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Done' }).click()
    await page.waitForTimeout(1200)
    const after = (await meterText(page)).trim()
    check(
      'marbles: Done puts it away and the meter empties',
      (await page.locator('[data-marble-moment]').count()) === 0 && after === '0 / 10',
      after,
    )
    await refresh(page)
    await page.waitForTimeout(800)
    c = await activeSaved(page)
    check('marbles: a reload keeps the same jar', JSON.stringify(c.marbleJar.marbles) === kept)
    await page.locator('[data-marble-mini]').click()
    await page.waitForTimeout(800)
    check(
      'marbles: a tap on the jar that isn\'t full opens Points',
      (await page.locator('[data-marble-moment]').count()) === 0 && (await page.getByText('How many stars win a spin.').count()) > 0,
    )
    await page.context().close()

    // Two spins waiting: after the first, Later is a way out, and the second spin is kept.
    const two = makeClass('c1', 'Marbles', 12, {
      pointsMode: 'quest',
      questAdventure: 'marbles',
      goalEnabled: true,
      pointsGoal: 10,
      classPoints: 0,
      marbleJar: jar({ marbles: rows(1), spins: 2 }),
    })
    page = await open({ state: stateOf(two), size: [1280, 559] })
    await page.locator('[data-marble-next]').click({ force: true })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Spin!' }).click()
    await page.getByRole('button', { name: 'Later' }).waitFor({ timeout: 20000 })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Later' }).click()
    await page.waitForTimeout(800)
    c = await activeSaved(page)
    check(
      'marbles: after a spin, Later puts it away and keeps the spin still waiting',
      (await page.locator('[data-marble-moment]').count()) === 0 && c.marbleJar.spins === 1,
      JSON.stringify(c.marbleJar.spins),
    )
    await page.context().close()

    // A full jar: the prize wheel rises out of it, then it empties, marbles popping away.
    const full = makeClass('c1', 'Marbles', 12, {
      pointsMode: 'quest',
      questAdventure: 'marbles',
      goalEnabled: true,
      pointsGoal: 10,
      classPoints: 0,
      marbleJar: jar({ marbles: [...rows(8), [2, 0, 10, 8, 0, 2.2]], spins: 1 }),
    })
    page = await open({ state: stateOf(full), size: [1280, 559] })
    check('marbles: a full jar rattles at the meter', (await page.locator('[data-marble-mini].meter-chest-rattle').count()) === 1)
    await page.screenshot({ path: '/tmp/walkthrough/marbles-0-meter.png', clip: { x: 0, y: 0, width: 1280, height: 70 } })
    await page.locator('[data-marble-mini]').click()
    await page.waitForTimeout(800)
    check('marbles: "Our jar is full!"', (await page.locator('[data-marble-title]').innerText()).includes('Our jar is full!'))
    await page.getByRole('button', { name: 'Prize wheel!' }).click()
    await page.waitForTimeout(3300)
    check(
      'marbles: the prize wheel rises out of the jar',
      (await page.locator('[data-quest-moment="chest"]').count()) === 1 &&
        (await page.locator('[data-quest-moment="chest"] img').count()) >= 1,
    )
    await page.screenshot({ path: '/tmp/walkthrough/marbles-3-prize-wheel.png' })
    await page.getByRole('button', { name: 'Spin!' }).click()
    await page.waitForTimeout(8000)
    const prize = await page.locator('[data-quest-prize]').getAttribute('data-quest-prize')
    check('marbles: the prize fills the screen', !!prize, prize)
    await page.mouse.click(640, 300)
    await page.waitForTimeout(600)
    c = await activeSaved(page)
    check(
      'marbles: the prize is kept, a new jar starts, and the spin waiting goes into it',
      c.marbleJar.number === 2 && c.marbleJar.marbles.length === 0 && c.marbleJar.filled.length === 1 && c.marbleJar.spins === 1,
      JSON.stringify({ n: c.marbleJar.number, m: c.marbleJar.marbles.length, f: c.marbleJar.filled, s: c.marbleJar.spins }),
    )
    check('marbles: the full jar empties in front of the class', (await page.locator('[data-marble-moment="empty"]').count()) === 1)
    await page.getByRole('button', { name: 'Done' }).waitFor({ timeout: 8000 })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Done' }).click()
    await page.waitForTimeout(500)
    check(
      "marbles: the spin still waiting shows on the meter's wheel",
      (await page.locator('[data-marble-next]').innerText()).trim() === '1',
    )
    // It bobs while a spin waits, which Playwright reads as never still enough to tap.
    await page.locator('[data-marble-next]').click({ force: true })
    await page.waitForTimeout(500)
    check('marbles: a tap on it spins it', (await page.locator('[data-marble-moment="spin"]').count()) === 1)
    await page.locator('button[aria-label="Not now"]').click()
    check('marbles: no errors', page.errors.length === 0, page.errors.join('; '))
    await page.context().close()

    // Points: the adventure, how full the jar is, and Start Over; fitting at 1024x500.
    const pts = makeClass('c1', 'Marbles', 12, {
      pointsMode: 'quest',
      questAdventure: 'marbles',
      goalEnabled: true,
      pointsGoal: 10,
      marbleJar: jar({ marbles: rows(4), spinDays: ['2026-10-14', '2026-10-20'] }),
    })
    page = await open({ state: stateOf(pts), size: [1024, 500] })
    await openPointsTab(page)
    const row = await page.locator('[data-guide="quest-row"]').innerText()
    check(
      'marbles: Points says how full the jar is and how long the last spin took',
      /% full/.test(row) && row.includes('The last spin took 6 days.'),
      row,
    )
    const over = await page.locator('.cs-page').evaluate((e) => e.scrollHeight - e.clientHeight)
    await page.screenshot({ path: '/tmp/walkthrough/marbles-points-1024.png' })
    check('marbles: Points fits at 1024x500', over <= 0, `${over}px over`)
    for (const theme of ['comic', 'chalkboard']) {
      const themed = await open({ state: stateOf(pts), size: [1024, 500], theme })
      await openPointsTab(themed)
      const o = await themed.locator('.cs-page').evaluate((e) => e.scrollHeight - e.clientHeight)
      check(`marbles: Points fits at 1024x500 in ${theme}`, o <= 0, `${o}px over`)
      await themed.context().close()
    }
    await page.getByRole('button', { name: 'Knight', exact: true }).click()
    await page.waitForTimeout(300)
    c = await activeSaved(page)
    check('marbles: back to the Knight, the jar kept for later', c.questAdventure === 'knight' && c.marbleJar.marbles.length === 28)
    await page.getByRole('button', { name: 'Marble Jar', exact: true }).click()
    await page.getByRole('button', { name: /Start Over/ }).click()
    await page.getByRole('button', { name: 'Yes, Start Over' }).click()
    await page.waitForTimeout(300)
    c = await activeSaved(page)
    check('marbles: Start Over empties the jar', c.questAdventure === 'marbles' && c.marbleJar.marbles.length === 0)
    await page.context().close()

    // The wheel and the jar, whole on every screen from the smallest up, and nothing scrolls.
    const sized = makeClass('c1', 'Marbles', 12, {
      pointsMode: 'quest',
      questAdventure: 'marbles',
      goalEnabled: true,
      pointsGoal: 10,
      marbleJar: jar({ marbles: rows(3), spins: 2 }),
    })
    const bad = []
    for (const size of [
      [1024, 500],
      [1280, 559],
      [1366, 620],
      [1920, 1080],
    ]) {
      page = await open({ state: stateOf(sized), size })
      await page.locator('[data-marble-next]').click({ force: true })
      await page.waitForTimeout(900)
      const r = await page.evaluate(() => {
        const inside = (sel) => {
          const b = document.querySelector(sel)?.getBoundingClientRect()
          return !!b && b.width > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight
        }
        return {
          wheel: inside('[data-marble-wheel]'),
          jar: inside('[data-marble-jar]'),
          spin: [...document.querySelectorAll('[data-marble-moment] button')]
            .filter((b) => b.textContent.includes('Spin!'))
            .every((b) => {
              const x = b.getBoundingClientRect()
              return x.bottom <= innerHeight && x.right <= innerWidth
            }),
          scroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }
      })
      if (!r.wheel || !r.jar || !r.spin || r.scroll > 0) bad.push(`${size.join('x')}: ${JSON.stringify(r)}`)
      await page.context().close()
    }
    check('marbles: the wheel, the jar and Spin! fit every screen, nothing scrolls', bad.length === 0, bad.join('; '))

    // The floating window: the class's jar, and a spin won over the lesson waits for the board.
    const fl = makeClass('c1', 'Marbles', 12, {
      pointsMode: 'quest',
      questAdventure: 'marbles',
      goalEnabled: true,
      pointsGoal: 10,
      classPoints: 2,
      marbleJar: jar({ marbles: rows(2), spins: 1 }),
    })
    page = await open({ state: stateOf(fl), size: [1280, 559] })
    const [win] = await Promise.all([page.context().waitForEvent('page'), panelButton(page, 'Float').click()])
    await win.waitForLoadState()
    await win.setViewportSize({ width: 340, height: 180 })
    await page.waitForTimeout(600)
    check(
      'float: the class jar, and Spin the wheel with a spin waiting',
      (await win.locator('[data-float-chest] canvas').count()) === 1 && (await win.getByText('Spin the wheel').count()) === 1,
    )
    await win.getByText('Spin the wheel').click()
    await page.bringToFront()
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.waitForTimeout(1500)
    check('float: Spin the wheel opens it in the app', (await page.locator('[data-marble-moment="spin"]').count()) === 1)
    await page.context().close()
  },

  async 'points: a class goal, student points, or none'() {
    const cls = makeClass('c1', 'Points', 12, { pointsGoal: 50, classPoints: 10, goalEnabled: true })
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const choose = async (label) => {
      await openPointsTab(page)
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: label, exact: true }).click()
      await page.waitForTimeout(400)
    }
    await choose('Student Points (No Goal)')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    check(
      'student points: no meter, the star and − on the rail, no All Stars In!',
      (await page.locator('[data-goal-coin]').count()) === 0 &&
        (await panelButton(page, 'Award Point').count()) === 1 &&
        (await panelButton(page, 'Deduct Point').count()) === 1 &&
        (await page.getByRole('button', { name: /All Stars In/ }).count()) === 0,
    )
    await desk(page, 'Amy').click()
    await award(page)
    await award(page)
    await page.locator('aside button[title="Deduct Point"]').click()
    await desk(page, 'Tony').click()
    await award(page)
    await page.waitForTimeout(400)
    let c = await activeSaved(page)
    check(
      'student points: the stars stay with each student, the goal untouched',
      c.pointsMode === 'students' && c.students[0].points === 1 && c.students[1].points === 1 && c.classPoints === 10,
      `Amy ${c.students[0].points}, Tony ${c.students[1].points}, goal ${c.classPoints}`,
    )
    check('student points: a desk shows its count', /1/.test(await desk(page, 'Amy').innerText()))
    let over = await overflow(page)
    check(
      'student points: nothing scrolls',
      Object.values(over).every((v) => v <= 0),
      JSON.stringify(over),
    )
    // Get Ready!: a full star is 5 stars for everyone here.
    await panelButton(page, 'Unpick All').click()
    await panelButton(page, 'Get Ready!').click()
    await page.waitForTimeout(800)
    await page.locator('[data-drum="20"]').click()
    const star = page.locator('[data-get-ready] button[aria-label="Start"]')
    await page.waitForTimeout(800)
    await star.click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Ready!', exact: true }).click()
    await page.waitForTimeout(1200)
    const words = await page.locator('[data-get-ready]').innerText()
    c = await activeSaved(page)
    check(
      'student points: Get Ready! gives everyone the stars',
      /Everyone gets 5 stars!/.test(words) && c.students[0].points === 6 && c.students[2].points === 5 && c.classPoints === 10,
      `${words.replace(/\s+/g, ' ')} | Amy ${c.students[0].points}, Kevin ${c.students[2].points}`,
    )
    await page.mouse.click(640, 300)
    await page.waitForTimeout(800)
    // Group points go to each student in the group.
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(600)
    await makeThem(page, /^Pairs/)
    await page.waitForTimeout(3500)
    const first = page.locator('[data-group-id]').first()
    const members = await first.locator('button[title^="Tap"]').allInnerTexts()
    await first.locator('button[title="Give a point"]').click()
    await first.locator('button[title="Give a point"]').click()
    await page.locator('button', { hasText: 'Exit Group Activity' }).first().click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: /Give Out the Points/ }).click()
    await page.waitForTimeout(800)
    c = await activeSaved(page)
    const got = c.students.filter((st) => members.some((m) => m.includes(st.name))).map((st) => st.points)
    check(
      "student points: a group's points go to each student in it",
      got.length === 2 && got.every((n) => n >= 7),
      JSON.stringify({ members, got }),
    )
    // Clear All Stars, behind a question.
    await choose('Clear All Stars')
    await page.getByRole('button', { name: 'Yes, Clear Them' }).click()
    await page.waitForTimeout(600)
    c = await activeSaved(page)
    check(
      'student points: Clear All Stars empties every desk',
      c.students.every((st) => !st.points),
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    // Leaving student points with stars on the desks asks first.
    await desk(page, 'Amy').click()
    await award(page)
    await page.waitForTimeout(300)
    await choose('No Points')
    const asked = await page.getByRole('alertdialog').filter({ hasText: "Clear the students' stars?" }).count()
    await page.getByRole('button', { name: 'Yes, Switch' }).click()
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    c = await activeSaved(page)
    check(
      'no points: leaving student points asks first, and the desks are cleared',
      asked === 1 && c.pointsMode === 'none' && c.students.every((st) => !st.points),
    )
    check(
      'no points: no star, no Pick All, no meter',
      (await panelButton(page, 'Award Point').count()) === 0 &&
        (await panelButton(page, 'Pick All').count()) === 0 &&
        (await page.locator('[data-goal-coin]').count()) === 0,
    )
    over = await overflow(page)
    check(
      'no points: nothing scrolls',
      Object.values(over).every((v) => v <= 0),
      JSON.stringify(over),
    )
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: /Continue with Last Groups/ }).click()
    await page.waitForTimeout(1200)
    check(
      'no points: the group cards carry no score',
      (await page.locator('[data-group-id] button[title="Give a point"]').count()) === 0 &&
        (await page.getByRole('button', { name: /Reset Points/ }).count()) === 0,
    )
    await page.locator('button', { hasText: 'Exit Group Activity' }).first().click()
    await page.waitForTimeout(800)
    check('no points: leaving the groups asks nothing', (await page.getByRole('dialog').count()) === 0)
    await panelButton(page, 'Get Ready!').click()
    await page.waitForTimeout(800)
    await page.locator('[data-drum="20"]').click()
    await page.waitForTimeout(800)
    await star.click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Ready!', exact: true }).click()
    await page.waitForTimeout(1200)
    const plain = (await page.locator('[data-get-ready]').innerText()).replace(/\s+/g, ' ')
    c = await activeSaved(page)
    check(
      'no points: Get Ready! is a challenge with no prize',
      /Great Job!/.test(plain) && !/stars?!/.test(plain) && c.students.every((st) => !st.points) && c.classPoints === 10,
      plain,
    )
    await page.mouse.click(640, 300)
    await page.waitForTimeout(800)
    // Back to the class goal: its meter where it was.
    await choose('Class Goal')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    c = await activeSaved(page)
    check(
      'class goal: back, with the meter where it was',
      c.pointsMode === 'goal' && (await page.locator('[data-goal-coin]').count()) === 1 && (await meterText(page)).trim() === '10 / 50',
    )
    return page
  },

  /**
   * A row that did a good job: one desk, Pick Whole Row, +, and Unpick All lets everyone go - where it
   * was a tap on every desk, twice (2026-10-08, the teacher). Unpick All shows whenever anyone is picked
   * by hand, not only the whole class.
   */
  async 'Pick Whole Row and Unpick All'() {
    const cls = makeClass('c1', 'Rows', 30, { pointsGoal: 100, classPoints: 0 })
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const named = (n) => page.locator('[data-ink=desk]').filter({ hasText: new RegExp(`^\\s*${n}\\s*$`) })
    const picked = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-ink=desk].desk-wiggle, [data-ink=desk].desk-wiggle-loop')]
          .map((d) => d.textContent.trim())
          .sort()
          .join(','),
      )
    // Andy is away today, in Kevin's row.
    await panelButton(page, 'Attendance').click()
    await named('Andy').click()
    await panelButton(page, 'Attendance').click()
    await page.waitForTimeout(400)
    check('whole row: no button with nobody picked', (await panelButton(page, 'Pick Whole Row').count()) === 0)
    await named('Kevin').click()
    check('one desk picked: Pick All reads Unpick All', (await panelButton(page, 'Unpick All').count()) === 1)
    await panelButton(page, 'Pick Whole Row').click()
    await page.waitForTimeout(300)
    check('whole row: everyone here in that row, the student away left out', (await picked()) === 'Gary,Grace,Kevin,Mandy', await picked())
    check('whole row: greyed once the row is whole', await panelButton(page, 'Pick Whole Row').isDisabled())
    const over = await overflow(page)
    check(
      'whole row: nothing scrolls on the board 1280x559',
      Object.values(over).every((v) => v <= 0),
      JSON.stringify(over),
    )
    await award(page)
    await page.waitForTimeout(1500)
    const c = await activeSaved(page)
    check('whole row: the row gets the stars', c.classPoints === 4, `meter ${c.classPoints}`)
    await panelButton(page, 'Unpick All').click()
    await page.waitForTimeout(300)
    check(
      'Unpick All lets them all go in one tap',
      (await picked()) === '' && (await panelButton(page, 'Pick All').count()) === 1,
      await picked(),
    )
    await named('Amy').click()
    await named('Tony').click()
    await panelButton(page, 'Pick Whole Rows').click()
    await page.waitForTimeout(300)
    check(
      'whole rows: a desk in each of two rows picks both rows',
      (await picked()) === 'Amy,Daniel,Emma,Eric,Fiona,Kelly,Leo,Louis,Sophia,Tony',
      await picked(),
    )
    await panelButton(page, 'Unpick All').click()
    // At tables it is the table.
    const tables = await open({ state: stateOf(makeClass('c2', 'Tables', 30, { layout: 'tables4', pointsGoal: 50 })), size: [1024, 500] })
    await tables.locator('[data-ink=desk]', { hasText: 'Kevin' }).first().click()
    await panelButton(tables, 'Pick Whole Table').click()
    await tables.waitForTimeout(300)
    const atTable = await tables.locator('[data-ink=desk].desk-wiggle, [data-ink=desk].desk-wiggle-loop').count()
    check('whole table: at tables it picks the table', atTable >= 2 && atTable <= 4, `${atTable} picked`)
    const overTables = await overflow(tables)
    check(
      'whole table: nothing scrolls at 1024x500',
      Object.values(overTables).every((v) => v <= 0),
      JSON.stringify(overTables),
    )
    return page
  },

  /**
   * A refresh goes back to the class that was open, not the splash (2026-10-11, the teacher). The
   * splash is still how the app opens: a new tab, the next day, or nobody signed in.
   */
  async 'a refresh goes back to the class'() {
    const page = await open({
      state: stateOf(makeClass('c1', 'Grade 4 English', 20), makeClass('c2', 'Grade 3 Phonics', 18)),
      size: [1280, 559],
    })
    const splash = () => page.locator('.splash-board').count()
    const className = () => page.locator('[data-ink="class-name"]').innerText()
    await page.reload()
    await page.waitForTimeout(800)
    check(
      'refresh: straight back to the class, no splash',
      (await splash()) === 0 && (await className()) === 'Grade 4 English',
      await className(),
    )
    // The next day starts at the splash, as opening the app always has.
    await page.evaluate(() => {
      const note = JSON.parse(sessionStorage.getItem('seating-chart-in-class-v1'))
      sessionStorage.setItem('seating-chart-in-class-v1', JSON.stringify({ ...note, day: '2020-01-01' }))
    })
    await page.reload()
    await page.waitForTimeout(800)
    check('refresh: the next day starts at the splash', (await splash()) === 1)
    await page.locator('.splash-board button', { hasText: 'Grade 3 Phonics' }).click()
    await page.waitForTimeout(900)
    await page.reload()
    await page.waitForTimeout(800)
    check(
      'refresh: back to the class chosen on the splash',
      (await splash()) === 0 && (await className()) === 'Grade 3 Phonics',
      await className(),
    )
    check('refresh: no errors', page.errors.length === 0, page.errors[0] ?? '')
    // Another tab is opening the app.
    const other = await page.context().newPage()
    await other.goto(URL)
    await other.waitForTimeout(800)
    check('refresh: a new tab starts at the splash', (await other.locator('.splash-board').count()) === 1)
    await other.close()
    // Nobody signed in: the splash, with Sign in.
    await page.evaluate(() => localStorage.removeItem('seating-chart-account-v1'))
    await page.reload()
    await page.waitForTimeout(800)
    check('refresh: signed out, the splash', (await splash()) === 1)
    return page
  },

  /**
   * A theme draws the rail differently (Chalkboard's frame takes height), so a change of theme
   * fits it again. It used to go unfitted in the new theme, and going back left it tightened for
   * good (2026-10-11, the teacher's laptop): at 1333x608 Chalkboard runs over unless it tightens.
   */
  async 'theme change: the rail fits itself again'() {
    const page = await open({ state: stateOf(makeClass('c1', '2A1 ELA', 30, { pointsGoal: 100, classPoints: 75 })), size: [1333, 608] })
    const fit = () =>
      page.evaluate(() => {
        const a = document.querySelector('aside')
        return { step: a.dataset.fit, over: a.scrollHeight - a.clientHeight }
      })
    const start = await fit()
    await openSection(page, 'class')
    await page.getByRole('button', { name: 'Chalkboard' }).first().click()
    await page.waitForTimeout(500)
    const chalk = await fit()
    check('theme change: Chalkboard fits the rail', chalk.over <= 0, JSON.stringify(chalk))
    await page.getByRole('button', { name: 'Elementary' }).first().click()
    await page.waitForTimeout(500)
    const back = await fit()
    check(
      'theme change: back again, the rail is as it was',
      back.step === start.step && back.over <= 0,
      `${JSON.stringify(start)} -> ${JSON.stringify(back)}`,
    )
    return page
  },

  /** Points past the goal carry into the next run, and the meter should show them once the chest shuts. */
  async 'meter shows the carried-over points after a celebration'() {
    const cls = makeClass('c1', 'Overflow', 5, { pointsGoal: 10, classPoints: 8, goalEnabled: true })
    const page = await open({ state: stateOf(cls) })
    await panelButton(page, 'Pick All').click()
    await award(page)
    await page.waitForTimeout(1500)
    await page.mouse.click(640, 400)
    await page.waitForTimeout(1500)
    const c = await activeSaved(page)
    const shown = (await meterText(page)).trim()
    check(
      'meter shows the carried-over points after a celebration',
      shown === `${c.classPoints} / 10`,
      `meter reads "${shown}", saved ${c.classPoints}`,
    )
    return page
  },

  /** A goal lowered below the points already on the meter. */
  async 'lowering the goal below the meter'() {
    const cls = makeClass('c1', 'Lower', 5, { pointsGoal: 50, classPoints: 40, goalEnabled: true })
    const page = await open({ state: stateOf(cls) })
    await openPointsTab(page)
    await page.waitForTimeout(500)
    await page.locator('[data-guide="goal-row"] input').fill('30')
    await page.waitForTimeout(700)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const shown = (await meterText(page)).trim()
    const [have, goal] = shown.split(' / ').map(Number)
    check('lowering the goal below the meter', have <= goal, `meter reads "${shown}"`)
    return page
  },

  /** Holding a stepper's + until it reaches its limit, then letting go, should stop it. */
  async 'a held stepper stops at its limit'() {
    const cls = makeClass('c1', 'Stepper', 5, { pointsGoal: 50, classPoints: 45, goalEnabled: true })
    const page = await open({ state: stateOf(cls) })
    await openPointsTab(page)
    await page.waitForTimeout(500)
    const plus = page.locator('button[aria-label="More: Stars on the meter"]')
    const box = await plus.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(2000)
    await page.mouse.up()
    await page.evaluate(() => {
      window.__writes = 0
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function (k, v) {
        if (k === 'seating-chart-state-v1') window.__writes++
        return set.call(this, k, v)
      }
    })
    await page.waitForTimeout(1500)
    const writes = await page.evaluate(() => window.__writes)
    check('a held stepper stops at its limit', writes === 0, `${writes} saves in the 1.5 s after letting go`)
    return page
  },

  /** A Mystery Gift: turned, opened, rolled, sent - its stars land in the chest once, and the card goes to the pile. */
  async 'a mystery gift pays out once'() {
    const cls = makeClass('c1', 'Gifts', 10, { pointsGoal: 100, classPoints: 0, goalEnabled: true })
    const page = await open({
      state: stateOf(cls),
      storage: {
        // An older save, with the flip mode and bonus kinds that are gone.
        'seating-chart-flip-deck-settings-v1': {
          bonusCards: true,
          bonusKinds: ['everyone'],
          flipMode: 'stay',
          soundEnabled: false,
          genderColors: false,
        },
      },
    })
    await panelButton(page, 'Flip Cards').click()
    await page.waitForTimeout(3500)
    const gifts = await page.locator('[data-bonus=gift]').count()
    check('gifts: three in the deck (10 students)', gifts === 3, `${gifts} gifts`)
    const id = await page.locator('[data-bonus=gift]').first().getAttribute('data-flip-card')
    const card = page.locator(`[data-flip-card="${id}"]`)
    // Turn, open, (roll), send - and keep tapping after, as an excited class would.
    for (let i = 0; i < 6; i++) {
      await card.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(i === 1 ? 2000 : 900)
    }
    await page.waitForTimeout(1500)
    const c = await activeSaved(page)
    check('gifts: 2 to 5 stars in the chest, once', c.classPoints >= 2 && c.classPoints <= 5, `meter holds ${c.classPoints}`)
    check('gifts: a sent gift goes to the pile', (await card.count()) === 0)
    check('gifts: no Flip Back left on the toolbar', (await page.getByText('Flip Back').count()) === 0)
    return page
  },

  /** Storage that refuses a write (full, or a locked-down browser) mustn't take the app down. */
  async 'storage refusing a write'() {
    const refuse = () => {
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function (k, v) {
        if (sessionStorage.getItem('seeded') && k !== 'seeded' && localStorage.getItem('seating-chart-state-v1')) {
          throw new DOMException('full', 'QuotaExceededError')
        }
        return set.call(this, k, v)
      }
    }
    for (const [label, act] of [
      ['moving the panel', (page) => page.locator('aside button[title^="Move panel"]').click()],
      [
        "choosing the timer's colour",
        async (page) => {
          await panelButton(page, 'Timer').click()
          await page.waitForTimeout(800)
          await page.locator('[data-timer-card] button[aria-label="Timer settings"]').click()
          await page.waitForTimeout(800)
          await page.getByRole('button', { name: 'Green', exact: true }).click()
        },
      ],
    ]) {
      const page = await open({ state: stateOf(makeClass('c1', 'Storage', 5)), before: refuse })
      await act(page)
      await page.waitForTimeout(600)
      const alive = await page.locator('aside').count()
      check(`storage refusing a write: ${label}`, alive === 1 && page.errors.length === 0, page.errors[0] ?? '')
      await page.context().close()
    }
  },

  /** The board reads one touch as two: the second mustn't shut the status picker the first opened. */
  async 'status picker survives a double-read touch'() {
    const cls = makeClass('c1', 'Groups', 12)
    const page = await open({ state: stateOf(cls) })
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(500)
    await makeThem(page, /^2/)
    await page.waitForTimeout(4500)
    const chip = page.locator('[data-status-target]').first()
    const box = await chip.boundingBox()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.click(x, y)
    await page.waitForTimeout(80)
    await page.mouse.click(x, y)
    await page.waitForTimeout(900)
    const open_ = await page.locator('[data-status-choice]').count()
    check('status picker survives a double-read touch', open_ === 4, open_ ? 'still open' : 'the second touch closed it')
    return page
  },

  /** Saving a roster edit with the name wiped out. */
  async 'a student cannot be saved with no name'() {
    const cls = makeClass('c1', 'Roster', 5)
    const page = await open({ state: stateOf(cls) })
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(600)
    await page.locator('[role=dialog] button:has(svg.lucide-pencil)').first().click()
    await page.waitForTimeout(300)
    await page.locator('[role=dialog] input[value="Amy"]').fill('   ')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForTimeout(800)
    const c = await activeSaved(page)
    check('a student cannot be saved with no name', c.students[0].name.trim() !== '', `first student is now "${c.students[0].name}"`)
    return page
  },

  /** CSV import: Excel's byte-order mark, and the same file brought in twice. */
  async 'csv import'() {
    const cls = makeClass('c1', 'CSV', 0)
    // A second class, so the splash offers class cards rather than first-time setup.
    const page = await open({ state: stateOf(cls, makeClass('c2', 'Other', 2)) })
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(600)
    const file = `${SHOTS}/roster.csv`
    writeFileSync(file, '﻿Amy,1,girl\r\nTony,2,boy\r\nKevin,3,boy\r\n')
    const input = page.locator('[role=dialog] input[type=file]')
    await input.setInputFiles(file)
    await page.waitForTimeout(500)
    let c = await activeSaved(page)
    check('csv import: no hidden mark on the first name', c.students[0]?.name === 'Amy', JSON.stringify(c.students[0]?.name))
    await input.setInputFiles(file)
    await page.waitForTimeout(500)
    c = await activeSaved(page)
    check('csv import: the same file twice adds nobody twice', c.students.length === 3, `${c.students.length} students`)
    return page
  },

  /**
   * Setting up a class quickly: an empty class says how; a list copied from Excel and pasted
   * (Ctrl+V on the Students tab) comes in with its heading row skipped; an Excel file comes in
   * as it is; neither doubles anyone brought in twice.
   */
  async 'excel and a pasted list'() {
    const cls = makeClass('c1', 'Quick', 0)
    const page = await open({ state: stateOf(cls, makeClass('c2', 'Other', 2)), size: [1024, 500] })
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(600)
    check('empty class: says how to fill it', await page.getByText('Copy your student list from Excel and paste it here.').isVisible())
    // What Excel puts on the clipboard: tabs between the columns, a heading row, \r\n.
    const copied = 'English Name\tClass\r\nAmy\t401\r\nTony\t402\r\nKevin\t403\r\n'
    await page.evaluate((text) => {
      const data = new DataTransfer()
      data.setData('text/plain', text)
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
    }, copied)
    await page.waitForTimeout(600)
    const pasteWindow = page.getByRole('dialog').filter({ hasText: 'Paste Your Student List' })
    check(
      'pasted list: opens with three students, the heading skipped',
      await pasteWindow.getByText('3 students', { exact: true }).isVisible(),
    )
    const fits = await pasteWindow.evaluate((d) => d.getBoundingClientRect().bottom <= innerHeight)
    check('pasted list: the window fits at 1024x500', fits)
    await pasteWindow.getByRole('button', { name: 'Add 3 Students' }).click()
    await page.waitForTimeout(500)
    let c = await activeSaved(page)
    check(
      'pasted list: added with homerooms',
      c.students.map((s) => `${s.name} ${s.homeroom}`).join() === 'Amy 401,Tony 402,Kevin 403',
      JSON.stringify(c.students),
    )
    check('pasted list: says what it did', await page.getByText('Added 3 students.').isVisible())
    // An Excel file as it is: the file window offers it, and its 28 names come in, 3 already here.
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      (async () => {
        await page.getByRole('button', { name: /^Import/ }).click()
        await page.getByText('From an Excel or CSV file').click()
      })(),
    ])
    check('excel: the file window offers Excel files', (await chooser.element().getAttribute('accept')).includes('.xlsx'))
    await chooser.setFiles(`${import.meta.dirname}/fixtures/roster.xlsx`)
    await page.waitForTimeout(900)
    // The class has students now, so it asks first: Replace them, or Add to them.
    check('excel: a class with students asks first', await page.getByText('This class has 3 students').isVisible())
    await page.locator('[data-import-add]').click()
    await page.waitForTimeout(600)
    c = await activeSaved(page)
    check(
      'excel: the roster comes in, nobody twice',
      c.students.length === 28 && c.students[27].name === 'Nick' && c.students[27].homeroom === '401',
      `${c.students.length} students`,
    )
    check('excel: says what it did', await page.getByText('Added 25 students. 3 were already in the class.').isVisible())
    return page
  },

  /** Names are sized for Andika. If Andika arrives late, they must be sized again when it does. */
  async 'desk names re-fit when the font arrives late'() {
    if (!FONTS) return check('desk names re-fit when the font arrives late', true, 'skipped: needs FONTS')
    const cls = makeClass('c1', 'Fonts', 6)
    cls.students[0].name = 'Maximiliano'
    const sizes = []
    for (const delay of [0, 2500]) {
      const page = await open({ state: stateOf(cls), fontDelayMs: delay, splash: false })
      await page.locator('.splash-board button').first().click()
      await page.waitForTimeout(delay + 1500)
      sizes.push(
        await page.evaluate(() => {
          const name = [...document.querySelectorAll('[data-ink=desk] span')].find((s) => s.textContent === 'Maximiliano')
          return { size: getComputedStyle(name).fontSize, cut: name.scrollWidth > name.clientWidth + 1 }
        }),
      )
      await page.context().close()
    }
    check('desk names re-fit when the font arrives late', sizes[0].size === sizes[1].size && !sizes[1].cut, JSON.stringify(sizes))
  },

  /** Somebody away today is left out of everything that chooses students. */
  async 'absent students are passed over'() {
    const cls = makeClass('c1', 'Absent', 6, { pointsGoal: 50, classPoints: 0 })
    const page = await open({ state: stateOf(cls) })
    await panelButton(page, 'Attendance').click()
    for (const n of ['Amy', 'Tony', 'Kevin']) await desk(page, n).click()
    await panelButton(page, 'Attendance').click()
    await page.waitForTimeout(400)
    const landed = new Set()
    for (let i = 0; i < 8; i++) {
      await panelButton(page, 'Pick a Random Student').click()
      await page.waitForTimeout(3200)
      landed.add(await page.evaluate(() => document.querySelector('[data-ink=desk].desk-picked')?.textContent ?? ''))
      await page.mouse.click(5, 5)
    }
    const pickedAway = [...landed].filter((t) => /Amy|Tony|Kevin/.test(t))
    check('absent students are never picked', landed.size > 0 && pickedAway.length === 0, `landed on ${[...landed].join(', ')}`)
    // The last pick is still showing, so the rail's Pick All reads Unpick All: it lets the pick go first.
    await panelButton(page, 'Unpick All').click()
    await panelButton(page, 'Pick All').click()
    await award(page)
    await page.waitForTimeout(300)
    await page.waitForTimeout(1200)
    const c = await activeSaved(page)
    check('absent students get no stars from Pick All', c.classPoints === 3, `meter holds ${c.classPoints} for 3 present`)
    await panelButton(page, 'Flip Cards').click()
    await page.waitForTimeout(3000)
    const dealt = await page.locator('[data-flip-card]').count()
    check('absent students are not dealt a flip card', dealt === 3, `${dealt} cards for 3 present`)
    return page
  },

  /**
   * Who had a turn, kept quietly for the teacher: a pick and a star to some students go in the
   * record, the whole class at once doesn't, and Pick Student's round survives a reload.
   */
  async 'participation: picks and points are recorded, and the round survives a reload'() {
    const cls = makeClass('c1', 'Turns', 6, { pointsGoal: 50, classPoints: 0 })
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const today = await page.evaluate(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    await desk(page, 'Amy').click()
    await desk(page, 'Tony').click()
    await award(page)
    await page.waitForTimeout(900)
    // With anyone picked by hand Pick All reads Unpick All, so from two picked the whole class is two taps.
    await panelButton(page, 'Unpick All').click()
    await panelButton(page, 'Pick All').click()
    await award(page)
    await page.waitForTimeout(900)
    await panelButton(page, 'Unpick All').click()
    let c = await activeSaved(page)
    check(
      'participation: a star to two students is recorded, the whole class is not',
      JSON.stringify(c.participation?.[today]) === '{"c1-s0":[0,1],"c1-s1":[0,1]}' && c.classPoints === 8,
      `${JSON.stringify(c.participation?.[today])}, meter ${c.classPoints}`,
    )
    check(
      'participation: no minus when stars go straight to the goal',
      (await page.locator('aside button[title="Deduct Point"]').count()) === 0,
    )
    for (let i = 0; i < 3; i++) {
      await panelButton(page, 'Pick a Random Student').click()
      await page.waitForTimeout(2600)
      await desk(page, 'Amy').click()
      if (i === 0) {
        await refresh(page)
        await page.waitForTimeout(800)
      }
    }
    for (let i = 0; i < 3; i++) {
      await panelButton(page, 'Pick a Random Student').click()
      await page.waitForTimeout(2600)
      await desk(page, 'Amy').click()
    }
    c = await activeSaved(page)
    const picks = Object.values(c.participation?.[today] ?? {}).map(([picked]) => picked)
    check(
      'participation: six picks across a reload, everyone once',
      picks.length === 6 && picks.every((n) => n === 1) && c.pickRound?.ids.length === 6,
      `picks ${JSON.stringify(picks)}, round ${c.pickRound?.ids.length}`,
    )
    await openSection(page, 'tools')
    await page.getByRole('button', { name: 'Start a New Round' }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    c = await activeSaved(page)
    check('participation: Start a New Round keeps the record', !c.pickRound && Object.keys(c.participation[today]).length === 6)
    await openSection(page, 'participation')
    await page.waitForTimeout(400)
    const report = await page.locator('.cs-page').innerText()
    check(
      'participation: the report lists the class',
      /Amy/.test(report) && /Tony/.test(report) && /Everyone here was picked/.test(report),
      report.slice(0, 80),
    )
    // A pick made while trying something out, taken back out of the record; then the whole lesson.
    const amyId = c.students.find((s) => s.name === 'Amy').id
    const amy = page.locator('.cs-pc', { hasText: 'Amy' })
    await amy.getByTitle('Tap to fix these numbers').click()
    await page.waitForTimeout(300)
    await amy.locator('button[aria-label="Picked: one fewer"]').click()
    await page.waitForTimeout(400)
    c = await activeSaved(page)
    check(
      'participation: a pick taken back out',
      // Her star earlier in the scenario stays: only the pick goes.
      c.participation[today][amyId]?.join() === '0,1' &&
        Object.values(c.participation[today]).filter(([picked]) => picked === 1).length === 5,
      JSON.stringify(c.participation[today]),
    )
    await page.getByRole('button', { name: 'Clear This Day' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Yes, Clear It' }).click()
    await page.waitForTimeout(500)
    c = await activeSaved(page)
    check('participation: Clear This Day empties the day', !c.participation[today], JSON.stringify(c.participation))
    return page
  },

  /**
   * Stars on the desks first: they wait on the desks, minus takes one back, and All Stars In!
   * sends them all to the goal - and they are still there after a reload if it isn't tapped.
   */
  async 'stars on the desks: minus, and All Stars In!'() {
    const cls = makeClass('c1', 'Desk Stars', 6, { pointsGoal: 50, classPoints: 10, starsOnDesks: true })
    cls.students[3].points = 9 // a running total from before: never sent to the goal again
    cls.starsOnDesks = undefined
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    await openPointsTab(page)
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /On the desks first/ }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await desk(page, 'Amy').click()
    await award(page)
    await award(page)
    await page.waitForTimeout(200)
    await page.locator('aside button[title="Deduct Point"]').click()
    await desk(page, 'Tony').click()
    await award(page)
    await page.waitForTimeout(600)
    let c = await activeSaved(page)
    check(
      'stars on the desks: they wait there, the meter stays',
      c.students[0].points === 1 && c.students[1].points === 1 && !c.students[3].points && c.classPoints === 10,
      `Amy ${c.students[0].points}, Tony ${c.students[1].points}, Mulan ${c.students[3].points}, meter ${c.classPoints}`,
    )
    await refresh(page)
    await page.waitForTimeout(800)
    const button = page.getByRole('button', { name: /All Stars In/ })
    check('stars on the desks: still there after a reload', /2/.test(await button.innerText()))
    await button.click()
    await page.waitForTimeout(1600)
    c = await activeSaved(page)
    check(
      'All Stars In!: the stars go to the goal and the desks empty',
      c.classPoints === 12 && c.students.every((s) => !s.points) && (await button.isDisabled()),
      `meter ${c.classPoints}`,
    )
    return page
  },

  /** A nearly full meter's coin used to reach past the screen, and a pick could push the whole board sideways. */
  async 'a nearly full meter never pushes the board sideways'() {
    const cls = makeClass('c1', 'Nearly', 12, { pointsGoal: 50, classPoints: 46 })
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    for (let i = 0; i < 3; i++) {
      await panelButton(page, 'Pick a Random Student').click()
      await page.waitForTimeout(2600)
      await desk(page, 'Amy').click()
    }
    const o = await overflow(page)
    check('a nearly full meter never pushes the board sideways', o.rootX === 0, JSON.stringify(o))
    return page
  },

  /**
   * Get Ready!: "How long?", the star waiting for its tap, five seconds full and then smaller on
   * every beat, Ready! sending what is left into the jar - and the board's second touch never
   * closing the window or starting the star. It fits both ways of running points.
   */
  async 'Get Ready!: drums, the star, Ready! and the jar'() {
    const cls = makeClass('c1', 'Get Ready', 12, { pointsGoal: 50, classPoints: 10, starsOnDesks: true })
    cls.students[0].points = 2 // stars waiting on a desk: Get Ready! leaves them where they are
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const button = panelButton(page, 'Get Ready!')
    const at = await button.boundingBox()
    await button.click()
    await page.mouse.click(at.x + 8, at.y + 8) // the board's second touch, outside the window
    await page.waitForTimeout(400)
    check('Get Ready!: How long? stays open through a double touch', await page.getByRole('dialog', { name: 'How long?' }).isVisible())
    const overflows = []
    for (const size of SCROLL_SIZES) {
      await page.setViewportSize({ width: size[0], height: size[1] })
      await page.waitForTimeout(150)
      const o = await overflow(page)
      if (o.page || o.pageX || o.panel || o.dialog || o.rootX) overflows.push(`${size.join('x')} ${JSON.stringify(o)}`)
    }
    check('Get Ready!: the drum window fits every screen', overflows.length === 0, overflows.join('; '))
    await page.setViewportSize({ width: 1280, height: 559 })
    await page.locator('[data-drum="20"]').click()
    const star = page.locator('[data-get-ready] button[aria-label="Start"]')
    await star.click({ force: true }) // the drum tap's second touch, where the star appears
    await page.waitForTimeout(800)
    check('Get Ready!: the star waits for its own tap', await page.getByText('Tap the star to start').isVisible())
    await star.click()
    await page.waitForTimeout(8200) // five seconds full, then three beats smaller on the 20-second drum
    await page.getByRole('button', { name: 'Ready!', exact: true }).click()
    await page.waitForTimeout(2200)
    let c = await activeSaved(page)
    check(
      'Get Ready!: Ready! three beats into the shrinking sends 4 of 5 to the goal, desks untouched',
      c.classPoints === 14 && c.students[0].points === 2 && /You earned 4 stars!/.test(await page.locator('[data-get-ready]').innerText()),
      `meter ${c.classPoints}, Amy ${c.students[0].points}`,
    )
    await page.mouse.click(640, 300)
    await page.waitForTimeout(700)
    check('Get Ready!: a tap ends it', (await page.locator('[data-get-ready]').count()) === 0)
    return page
  },

  /**
   * Get Ready!'s taps: soft rim clicks and bamboo between the big beats, never on one, in four
   * rhythms that all take a turn before any comes round again; and the speaker on "How long?",
   * which makes the class's Get Ready! silent - nothing at all plays, and the stars still land.
   */
  async 'Get Ready!: taps between the beats, and the speaker'() {
    const cls = makeClass('c1', 'Taps', 12, { pointsGoal: 50, classPoints: 0 })
    const page = await open({ state: stateOf(cls), size: [1280, 559], before: countSounds })
    const run = async (waitMs) => {
      await panelButton(page, 'Get Ready!').click()
      await page.waitForTimeout(900)
      await page.locator('[data-drum="20"]').click()
      await page.waitForTimeout(900)
      await page.evaluate(() => (window.__sounds = []))
      await page.locator('[data-get-ready] button[aria-label="Start"]').click()
      await page.waitForTimeout(waitMs)
      return {
        rhythm: await page.locator('[data-get-ready]').getAttribute('data-rhythm'),
        sounds: await page.evaluate(() => window.__sounds),
      }
    }
    const stop = async () => {
      await page.getByRole('button', { name: 'Stop', exact: true }).click()
      await page.waitForTimeout(700)
    }
    const first = await run(9200)
    const hits = first.sounds.filter((x) => x.kind === 'drum').map((x) => x.when)
    const taps = first.sounds.filter((x) => x.kind === 'bamboo' || x.kind === 'rim')
    check(
      'taps: the rim and the bamboo both play between the beats',
      taps.some((t) => t.kind === 'rim') && taps.some((t) => t.kind === 'bamboo') && hits.length >= 8,
      `${hits.length} hits, ${taps.length} taps, ${first.rhythm}`,
    )
    check(
      'taps: none lands on a big beat, and the beat stays once a second',
      taps.every((t) => hits.every((w) => Math.abs(t.when - w) > 0.08)) && hits.slice(1).every((w, i) => Math.abs(w - hits[i] - 1) < 0.15),
    )
    await stop()
    const seen = [first.rhythm]
    for (let i = 0; i < 3; i++) {
      seen.push((await run(1200)).rhythm)
      await stop()
    }
    check('taps: all four rhythms take a turn before any comes round again', new Set(seen).size === 4, seen.join(', '))
    // The speaker: off for this class, and then nothing plays at all
    await panelButton(page, 'Get Ready!').click()
    await page.waitForTimeout(900)
    const speaker = page.locator('[data-get-ready-sound]')
    await speaker.click()
    await page.waitForTimeout(300)
    check(
      'speaker: one tap and the class is silent',
      (await speaker.getAttribute('data-get-ready-sound')) === 'off' && (await activeSaved(page)).getReadySilent === true,
    )
    await page.locator('[data-drum="20"]').click()
    await page.waitForTimeout(900)
    await page.evaluate(() => (window.__sounds = []))
    await page.locator('[data-get-ready] button[aria-label="Start"]').click()
    await page.waitForTimeout(2300)
    await page.getByRole('button', { name: 'Ready!', exact: true }).click()
    await page.waitForTimeout(2500)
    const c = await activeSaved(page)
    check(
      'speaker: silent - no drum, taps, Ready! or coins, and the stars still land',
      (await page.evaluate(() => window.__sounds.length)) === 0 && c.classPoints === 5,
      `${await page.evaluate(() => window.__sounds.length)} sounds, meter ${c.classPoints}`,
    )
    await page.mouse.click(640, 300)
    await page.waitForTimeout(800)
    return page
  },

  /**
   * A long press is a right-click on a Windows touch board: anywhere in the app it opens no menu -
   * the desks, the side panel, the splash and the floating window - but a text box keeps its menu,
   * for pasting a name.
   */
  async 'a long press opens no menu'() {
    const page = await open({ state: stateOf(makeClass('c1', 'Menus', 12, { pointsGoal: 50 })), size: [1280, 559], splash: false })
    // Whether the menu would open: the browser shows it unless the page cancels the event.
    const menuOpens = (target) =>
      target.evaluate((el) => {
        const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
        return el.dispatchEvent(e)
      })
    check('long press: none on the splash', !(await menuOpens(page.locator('.splash-board button').first())))
    await page.locator('.splash-board button').first().click()
    await page.waitForTimeout(900)
    check('long press: none on a desk', !(await menuOpens(desk(page, 'Kevin'))))
    check('long press: none on the side panel', !(await menuOpens(panelButton(page, 'Pick a Random Student'))))
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(600)
    await page.locator('[data-section-link="class"]').click()
    await page.waitForTimeout(300)
    check('long press: a text box keeps its menu, for pasting', await menuOpens(page.locator('#class-name')))
    check("long press: none on a window's buttons", !(await menuOpens(page.locator('[data-section-link="students"]'))))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const [win] = await Promise.all([page.context().waitForEvent('page'), panelButton(page, 'Float').click()])
    await win.waitForLoadState()
    await win.setViewportSize({ width: 340, height: 180 })
    await win.waitForTimeout(500)
    check("long press: none on the floating window's +1", !(await menuOpens(win.locator('[data-ink=canvas] > div.grid > button').first())))
    return page
  },

  /**
   * Get Ready! from the floating window, over the lesson: it grows to a snug rectangle of drums,
   * then to the star (no meter, the chest under Stop), and shrinks back when it is tapped away.
   */
  async 'Get Ready! in the floating window'() {
    const cls = makeClass('c1', 'Float', 12, { pointsGoal: 50, classPoints: 10 })
    const page = await open({ state: stateOf(cls), size: [1280, 559], before: countSounds })
    const [win] = await Promise.all([page.context().waitForEvent('page'), panelButton(page, 'Float').click()])
    const winErrors = []
    win.on('pageerror', (e) => winErrors.push(e.message))
    await win.waitForLoadState()
    // Playwright stretches the floating window to the test's viewport, gives it a screen the
    // size of that, and leaves its outer size behind when the viewport changes: set all three to
    // what a board would have.
    await win.setViewportSize({ width: 340, height: 180 })
    await win.evaluate(() => {
      for (const [k, v] of Object.entries({ availWidth: 1280, availHeight: 680, availLeft: 0, availTop: 0 })) {
        Object.defineProperty(screen, k, { get: () => v })
      }
      Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth })
      Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight })
      window.__resizes = []
      const resize = window.resizeTo.bind(window)
      window.resizeTo = (w, h) => {
        window.__resizes.push([w, h])
        resize(w, h)
      }
    })
    await page.waitForTimeout(500)
    const buttons = await win
      .locator('[data-ink=canvas] > div.grid > button')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
    check(
      'float: +1, Pick and Get Ready! are the same size',
      buttons.length === 3 && Math.max(...buttons) - Math.min(...buttons) < 1,
      buttons.join(', '),
    )
    await win.locator('[data-float-get-ready]').click()
    await win.waitForTimeout(150)
    const [drums] = await win.evaluate(() => window.__resizes)
    check(
      'float Get Ready!: the window grows for the drums, wider than tall',
      Boolean(drums) && drums[0] > 600 && drums[1] < drums[0],
      JSON.stringify(drums),
    )
    check("float Get Ready!: the side panel's stands down meanwhile", await panelButton(page, 'Get Ready!').isDisabled())
    await win.setViewportSize({ width: drums[0], height: drums[1] })
    await win.waitForTimeout(800)
    // Two rows of four, filling the window to its foot with nothing cut off (2026-10-12).
    const fit = await win.evaluate(() => {
      const ds = [...document.querySelectorAll('[data-drum]')].map((d) => d.getBoundingClientRect())
      return {
        drums: ds.length,
        rows: new Set(ds.map((r) => Math.round(r.top))).size,
        below: Math.round(innerHeight - Math.max(...ds.map((r) => r.bottom))),
      }
    })
    check(
      'float Get Ready!: a snug rectangle of eight drums, two rows',
      fit.drums === 8 && fit.rows === 2 && fit.below >= 0 && fit.below <= 30,
      JSON.stringify(fit),
    )
    await win.screenshot({ path: `${SHOTS}/float-drums.png` })
    const speaker = win.locator('[data-get-ready-sound]')
    await speaker.click()
    await win.waitForTimeout(300)
    check(
      'float Get Ready!: the speaker on the drums turns the class silent',
      (await speaker.getAttribute('data-get-ready-sound')) === 'off' && (await activeSaved(page)).getReadySilent === true,
    )
    await page.evaluate(() => (window.__sounds = []))
    await win.locator('[data-drum="20"]').click()
    await win.waitForTimeout(150)
    const star = (await win.evaluate(() => window.__resizes))[1]
    check('float Get Ready!: a drum grows the window for the star', Boolean(star) && star[1] >= 480, JSON.stringify(star))
    await win.setViewportSize({ width: star[0], height: star[1] })
    await win.waitForTimeout(900)
    check(
      'float Get Ready!: no meter over the star, and a chest to fly to',
      (await win.locator('[data-float-coin]').count()) === 1 && (await win.locator('[data-ink=panel]').count()) === 0,
    )
    await win.screenshot({ path: `${SHOTS}/float-star.png` })
    await win.locator('[data-get-ready] button[aria-label="Start"]').click()
    await win.waitForTimeout(1500)
    await win.getByRole('button', { name: 'Ready!', exact: true }).click()
    await win.waitForTimeout(2200)
    const c = await activeSaved(page)
    check('float Get Ready!: a full star lands in the jar', c.classPoints === 15, `meter ${c.classPoints}`)
    check('float Get Ready!: silent, nothing played', (await page.evaluate(() => window.__sounds.length)) === 0)
    await win.mouse.click(30, 460)
    await win.waitForTimeout(700)
    check(
      'float Get Ready!: a tap ends it and the window goes back',
      (await win.locator('[data-get-ready]').count()) === 0 && (await win.evaluate(() => window.__resizes.length)) === 3,
    )
    await win.setViewportSize({ width: 340, height: 180 })
    await win.waitForTimeout(300)
    check('float Get Ready!: the meter shows the stars', (await win.locator('[data-ink=panel]').innerText()).includes('15 / 50'))
    check('float Get Ready!: no errors in the floating window', winErrors.length === 0, winErrors.join(' | '))
    return page
  },

  /**
   * Pick in the floating window is the one place the class sees who was picked, so it says it as
   * the desks do: the name alone, no avatar, and the homeroom number after it only where two
   * students share the name (2026-10-08, from a lesson: two Amys couldn't be told apart).
   */
  /**
   * The app's clock in the floating window (2026-10-12): only once it is started in the app, at
   * the window's own size, counting on the window's clock. Pause there pauses it in the app, a tap
   * on the time takes it off the window, and time's up comes back there and is cleared there.
   */
  async 'the clock in the floating window'() {
    const cls = makeClass('c1', 'Float', 12, { pointsGoal: 50, classPoints: 10 })
    const page = await open({ state: stateOf(cls), size: [1280, 559], storage: { 'seating-chart-timer-settings-v1': { seconds: 300 } } })
    const [win] = await Promise.all([page.context().waitForEvent('page'), panelButton(page, 'Float').click()])
    const winErrors = []
    win.on('pageerror', (e) => winErrors.push(e.message))
    await win.waitForLoadState()
    await win.setViewportSize({ width: 340, height: 180 })
    await page.waitForTimeout(500)
    const floatClock = win.locator('[data-float-clock]')
    const boardCard = page.locator('[data-timer-card]')
    check('float clock: none until a clock runs', (await floatClock.count()) === 0)
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(800)
    // The page's clock from here, set going before the timer starts (one installed under a running
    // timer leaves the real one ticking). It starts at nought, so past the tap guards first.
    await page.clock.install()
    await page.clock.runFor(1000)
    check('float clock: none for a clock only opened, not started', (await floatClock.count()) === 0)
    await boardCard.getByRole('button', { name: 'Start', exact: true }).click()
    await page.clock.runFor(1300)
    await page.waitForTimeout(300)
    const layout = () =>
      win.evaluate(() => {
        const inside = (el) => {
          const r = el.getBoundingClientRect()
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5
        }
        const canvas = document.querySelector('[data-ink=canvas]')
        return {
          size: [innerWidth, innerHeight],
          scroll: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
          allInside: [...canvas.querySelectorAll('button')].every(inside),
          buttons: [...canvas.querySelectorAll('[aria-label="+1"], [data-float-get-ready]')].map((b) =>
            Math.round(b.getBoundingClientRect().height),
          ),
          // +1, Pick and Get Ready!, each still a finger wide.
          widths: [...canvas.querySelectorAll('[aria-label="+1"], [data-float-get-ready], [title="Pick a student"]')].map((b) =>
            Math.round(b.getBoundingClientRect().width),
          ),
          time: Math.round(parseFloat(getComputedStyle(document.querySelector('.float-clock-time')).fontSize)),
        }
      })
    const full = await layout()
    const first = (await floatClock.innerText()).trim()
    check(
      'float clock: started on the board, it counts in the window, which keeps its size',
      /^4:5\d$/.test(first) &&
        full.size.join() === '340,180' &&
        full.scroll.join() === '0,0' &&
        full.allInside &&
        full.buttons.every((h) => h >= 40),
      `${first} ${JSON.stringify(full)}`,
    )
    await win.screenshot({ path: `${SHOTS}/float-clock.png` })
    await floatClock.getByRole('button', { name: 'Pause' }).click()
    await page.clock.runFor(300)
    check("float clock: pause in the window pauses the app's clock", (await boardCard.locator('button[aria-label="Start"]').count()) === 1)
    await page.clock.runFor(800)
    await floatClock.getByRole('button', { name: 'Put the clock away' }).click()
    await page.clock.runFor(300)
    check(
      'float clock: a tap on the time takes it off the window, and the clock stays in the app',
      (await floatClock.count()) === 0 && (await boardCard.count()) === 1,
    )
    await page.clock.runFor(800)
    await boardCard.getByRole('button', { name: 'Start', exact: true }).click()
    await page.clock.runFor(500)
    check('float clock: started again in the app, it comes back', (await floatClock.count()) === 1)
    // The strip makes room for it, nothing past its edge.
    await page.clock.runFor(800)
    await win.getByRole('button', { name: 'Make it small' }).click()
    await win.setViewportSize({ width: 290, height: 62 })
    await page.clock.runFor(400)
    await page.waitForTimeout(300)
    const strip = await layout()
    check(
      "float clock: in the strip, the time takes the count's place, everything inside it and a finger wide",
      strip.scroll.join() === '0,0' && strip.allInside && strip.widths.length === 3 && strip.widths.every((w) => w >= 40),
      JSON.stringify(strip),
    )
    await win.screenshot({ path: `${SHOTS}/float-clock-strip.png` })
    await page.clock.runFor(800)
    await win.getByRole('button', { name: 'Make it big again' }).click()
    await win.setViewportSize({ width: 340, height: 180 })
    await page.clock.runFor(400)
    await page.waitForTimeout(300)
    // Orange at 20 seconds, red at 10.
    const [m, sec] = (await floatClock.innerText()).trim().split(':').map(Number)
    await page.clock.runFor((m * 60 + sec - 19) * 1000)
    await page.waitForTimeout(400)
    const look = () =>
      win.evaluate(() => {
        const el = document.querySelector('[data-float-clock]')
        return (
          el && {
            text: el.innerText.trim(),
            cls: el.className,
            bg: getComputedStyle(el).backgroundColor,
            anims: el.getAnimations().map((a) => a.animationName ?? 'pulse'),
          }
        )
      })
    const orange = await look()
    check(
      'float clock: orange for the last 20 seconds',
      /^0:1[89]$/.test(orange?.text ?? '') && orange.bg === 'rgb(249, 115, 22)',
      JSON.stringify(orange),
    )
    await page.clock.runFor(10000)
    await page.waitForTimeout(400)
    const red = await look()
    check('float clock: red for the last 10', /^0:0[89]$/.test(red?.text ?? '') && red.bg === 'rgb(239, 68, 68)', JSON.stringify(red))
    await win.screenshot({ path: `${SHOTS}/float-clock-red.png` })
    // Tapped away, time's up still comes back to the window, dancing; a tap there clears it everywhere.
    await page.clock.runFor(1000)
    await floatClock.getByRole('button', { name: 'Put the clock away' }).click()
    await page.waitForTimeout(300)
    await page.clock.runFor(10000)
    await page.waitForTimeout(400)
    const up = await look()
    check(
      "float clock: time's up comes back to the window, dancing",
      up?.text === 'Time’s up!' && up.anims.includes('timer-dance'),
      JSON.stringify(up),
    )
    await win.screenshot({ path: `${SHOTS}/float-clock-up.png` })
    await page.clock.runFor(1000)
    await floatClock.getByRole('button', { name: 'Time’s up' }).click({ force: true })
    await page.waitForTimeout(300)
    check(
      "float clock: a tap on Time's up clears it in the app too",
      (await floatClock.count()) === 0 &&
        (await page.locator('.timer-up').count()) === 0 &&
        (await page.locator('.timer-time').textContent()) === '5:00',
    )
    check('float clock: no errors in the floating window', winErrors.length === 0, winErrors.join('; '))
    return page
  },

  async 'Pick in the floating window'() {
    const pickInFloat = async (cls) => {
      const page = await open({ state: stateOf(cls), size: [1280, 559] })
      const [win] = await Promise.all([page.context().waitForEvent('page'), panelButton(page, 'Float').click()])
      await win.waitForLoadState()
      await win.setViewportSize({ width: 340, height: 180 })
      await win.waitForTimeout(500)
      await win.locator('button[title="Pick a student"]').click()
      const landed = win.locator('button[title="Tap to go back"]')
      await landed.waitFor({ timeout: 10000 })
      await win.waitForTimeout(500)
      return { page, win, landed, text: (await landed.innerText()).replace(/\s+/g, ' ').trim() }
    }
    const twins = makeClass('c1', 'Float', 2, { pointsGoal: 50 })
    twins.students.forEach((s, i) => Object.assign(s, { name: 'Sophia', homeroom: ['12', '27'][i] }))
    const a = await pickInFloat(twins)
    check('float pick: two Sophias, the homeroom number after the name', /^Sophia (12|27)$/.test(a.text), a.text)
    check('float pick: the number is small and quiet, as on the desks', (await a.landed.locator('[data-float-homeroom]').count()) === 1)
    check('float pick: no avatar beside the name', (await a.landed.locator('img').count()) === 0)
    await a.win.screenshot({ path: `${SHOTS}/float-pick-same-name.png` })
    // The strip, where the name is the height of the row: the number is never the part cut off.
    await a.win.setViewportSize({ width: 334, height: 62 })
    await a.win.waitForTimeout(500)
    const tag = await a.landed.locator('[data-float-homeroom]').boundingBox()
    check('float pick: in the strip the number still shows', Boolean(tag) && tag.width > 0 && tag.x + tag.width <= 334, JSON.stringify(tag))
    await a.win.screenshot({ path: `${SHOTS}/float-pick-same-name-strip.png` })
    const b = await pickInFloat(makeClass('c2', 'Float', 2, { pointsGoal: 50 }))
    check('float pick: a name nobody shares has no number', /^(Amy|Tony)$/.test(b.text), b.text)
    check('float pick: no avatar, avatars on or off', (await b.landed.locator('img').count()) === 0)
    const all = makeClass('c3', 'Float', 2, { pointsGoal: 50, showAllHomerooms: true })
    const c = await pickInFloat(all)
    check('float pick: Homeroom on all desks shows every number here too', /^(Amy 1|Tony 2)$/.test(c.text), c.text)
    return a.page
  },

  /** Tiny, empty and full classes through every screen, looking for errors. */
  async 'edge classes'() {
    for (const count of [0, 1, 2, 35]) {
      // A goal the class can't fill here: Pick All + gives the whole class a star, and a filled
      // goal's celebration would cover the panel (it used to give only the picked row one).
      const cls = makeClass('c1', `Edge ${count}`, count, { pointsGoal: 100, classPoints: 0 })
      // A second class, so the splash offers class cards rather than first-time setup.
      const page = await open({ state: stateOf(cls, makeClass('c2', 'Other', 2)), size: [1024, 640] })
      if (count > 0) {
        await panelButton(page, 'Pick a Random Student').click()
        await page.waitForTimeout(3200)
        await page.mouse.click(5, 5)
        await panelButton(page, 'Pick a Random Row').click()
        await page.waitForTimeout(3200)
        const rowPicked = await page.evaluate(() => document.querySelectorAll('[data-ink=desk].desk-picked').length)
        check(
          `edge class of ${count}: Pick Row lands on a row with someone in it`,
          rowPicked > 0,
          `${rowPicked} students in the picked row`,
        )
        await page.mouse.click(5, 5)
        // A pick selects its winner, so with one student Pick All may already read Unpick All.
        if (await panelButton(page, 'Pick All').count()) await panelButton(page, 'Pick All').click()
        await award(page)
      }
      await panelButton(page, 'Flip Cards').click()
      await page.waitForTimeout(2500)
      await page.screenshot({ path: `${SHOTS}/edge-${count}-flip.png` })
      const flipOver = await overflow(page)
      await panelButton(page, 'Flip Cards').click()
      await page.waitForTimeout(800)
      await panelButton(page, 'Group Activity').click()
      await page.waitForTimeout(600)
      if (count >= 2) {
        await makeThem(page, /^Pairs/)
        await page.waitForTimeout(5000)
        await page.screenshot({ path: `${SHOTS}/edge-${count}-pairs.png` })
      } else {
        await page.screenshot({ path: `${SHOTS}/edge-${count}-groups.png` })
      }
      const groupOver = await overflow(page)
      check(
        `edge class of ${count}: no errors, nothing scrolls`,
        page.errors.length === 0 && !flipOver.page && !groupOver.page && !groupOver.dialog,
        page.errors[0] ?? JSON.stringify({ flipOver, groupOver }),
      )
      await page.context().close()
    }
  },

  /** A reload in the middle of things: what comes back, and does anything break. */
  async 'reload mid-activity'() {
    const cls = makeClass('c1', 'Reload', 12, { pointsGoal: 10 })
    const page = await open({ state: stateOf(cls) })
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(500)
    await makeThem(page, /^3/)
    await page.waitForTimeout(4500)
    await page.locator('[data-group-id] button[title="Give a point"]').first().click()
    await refresh(page)
    await page.waitForTimeout(900)
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(600)
    const cont = await page.getByRole('button', { name: /Continue with Last Groups/ }).textContent()
    check('reload mid-activity: last groups kept, with their point', /3 groups/.test(cont) && /1/.test(cont), cont.replace(/\s+/g, ' '))
    await page.keyboard.press('Escape')
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(800)
    await page.locator('[data-timer-card] button[aria-label="A minute more"]').click()
    await page.waitForTimeout(800)
    await page.locator('[data-timer-card] button[aria-label="Start"]').click()
    await page.waitForTimeout(1200)
    await refresh(page)
    await page.waitForTimeout(900)
    check('reload mid-timer: no errors', page.errors.length === 0, page.errors[0] ?? '')
    return page
  },

  /** Changing class with the flip cards up, and with a group activity running. */
  async 'switching class mid-activity'() {
    const a = makeClass('c1', 'Class A', 8)
    const b = makeClass('c2', 'Class B', 12)
    const page = await open({ state: stateOf(a, b) })
    await panelButton(page, 'Flip Cards').click()
    await page.waitForTimeout(3000)
    await page.locator('[data-flip-card]').first().click()
    await page.waitForTimeout(800)
    await page.locator('button[title="Switch class"]').click()
    await page.waitForTimeout(400)
    await page.locator('[data-ink=menu]').getByRole('button', { name: 'Class B' }).click()
    await page.waitForTimeout(400)
    await page
      .getByRole('button', { name: /^(Switch|Yes)/ })
      .first()
      .click()
    await page.waitForTimeout(3000)
    const cards = await page.locator('[data-flip-card]').count()
    const up = await page.locator('[data-flip-card][data-state=active], [data-flip-card][data-state=up]').count()
    await page.screenshot({ path: `${SHOTS}/switch-flip.png` })
    check(
      'switching class with flip cards up: the new class is dealt, all face down',
      cards === 12 && up === 0,
      `${cards} cards, ${up} face up`,
    )
    check('switching class: no errors', page.errors.length === 0, page.errors[0] ?? '')
    return page
  },

  /**
   * Groups by seats: pairs are the desks side by side, fours are squares, six groups are the
   * rows; Continue with Last Groups says how they were made, and Shuffle, which mixes everyone,
   * works after it.
   */
  async 'groups by seats'() {
    const cls = makeClass('c1', 'Seats', 30)
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const deskOf = new Map(cls.seating.map((id, desk) => [id, desk]))
    const made = async () => (await activeSaved(page)).groups.map((g) => g.studentIds.map((id) => deskOf.get(id)).sort((a, b) => a - b))
    const deal = async (name) => {
      if (await page.locator('button', { hasText: 'New Groups' }).count()) {
        await page.locator('button', { hasText: 'New Groups' }).first().click()
      } else {
        await panelButton(page, 'Group Activity').click()
      }
      await page.waitForTimeout(500)
      await makeThem(page, name)
      await page.waitForTimeout(5000)
    }
    await deal(/^4/)
    let groups = await made()
    const together = (g) =>
      g.every((d) => g.some((e) => e !== d && Math.abs((e % 6) - (d % 6)) <= 1 && Math.abs(Math.floor(e / 6) - Math.floor(d / 6)) <= 1))
    check(
      'by seats: four groups are the corners, everyone beside their group',
      groups.length === 4 && groups.every(together),
      JSON.stringify(groups),
    )
    const corners = await page.evaluate(() => [...document.querySelectorAll('[data-group-id]')].map((c) => c.getBoundingClientRect()))
    check(
      'by seats: four corners sit two by two, as in the room',
      corners.length === 4 &&
        Math.abs(corners[0].top - corners[1].top) < 2 &&
        corners[2].top > corners[0].bottom - 2 &&
        corners[1].left > corners[0].right - 2,
    )
    await deal(/^6/)
    groups = await made()
    check(
      'by seats: six groups are the six rows',
      groups.length === 6 && groups.every((g) => g.every((d) => d % 6 === g[0] % 6)),
      JSON.stringify(groups),
    )
    // Laid out like the room (2026-10-12, the teacher): six rows of desks are six cards side by
    // side, Group 1 the left-hand row.
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-group-id]')].map((c) => c.getBoundingClientRect()))
    check(
      "by seats: the six rows are six cards side by side, in the room's order",
      rows.length === 6 &&
        rows.every((r) => Math.abs(r.top - rows[0].top) < 2) &&
        rows.every((r, i) => i === 0 || r.left > rows[i - 1].left) &&
        groups[0][0] % 6 === 0,
    )
    await deal(/^Pairs/)
    groups = await made()
    check(
      'by seats: pairs are the two desks side by side',
      groups.length === 15 && groups.every(([a, b]) => a % 2 === 0 && b === a + 1),
      JSON.stringify(groups),
    )
    await page.locator('button', { hasText: 'Exit Group Activity' }).first().click()
    await page.waitForTimeout(800)
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(500)
    const label = (await page.getByRole('button', { name: /Continue with Last Groups/ }).textContent()).replace(/\s+/g, ' ')
    check("continue: says how the groups were made, in the buttons' words", /Pairs · 15 groups/.test(label), label)
    await page.getByRole('button', { name: /Continue with Last Groups/ }).click()
    await page.waitForTimeout(4500)
    const shuffle = page.locator('button', { hasText: 'Shuffle' }).first()
    check('continue: Shuffle works after it', await shuffle.isEnabled())
    await shuffle.click()
    await page.waitForTimeout(5000)
    groups = await made()
    const sideBySide = groups.filter(([a, b]) => b === a + 1 && a % 2 === 0).length
    check(
      'shuffle: mixes everyone, into the same 15 cards',
      groups.length === 15 && sideBySide < 6,
      `${sideBySide} pairs still side by side`,
    )
    const over = await overflow(page)
    check('groups by seats: nothing scrolls', over.page <= 0 && over.panel <= 0, JSON.stringify(over))
    return page
  },

  /**
   * The Group Activity window's second question and the groups chosen by hand (2026-10-12): the
   * board's double touch can't answer the question, names go into the lit group and back to their
   * desks, Start waits for everyone, and Save keeps the groups under a typed name to start again,
   * with a student since removed dropping out and a new one joining the smallest group.
   */
  async "groups: I'll choose, and saved groups"() {
    const cls = makeClass('c1', 'Choose', 12)
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(500)
    const two = page.getByRole('dialog').getByRole('button', { name: /^2/ }).first()
    const box = await two.boundingBox()
    await two.click()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    const make = page.getByRole('dialog').getByRole('button', { name: /Make them for me/ })
    const mb = await make.boundingBox()
    await page.mouse.click(mb.x + 5, mb.y + 5)
    await page.waitForTimeout(200)
    check(
      "groups: the board's double touch doesn't answer the second question",
      (await page.locator('[data-group-id]').count()) === 0 && (await make.count()) === 1,
    )
    await page.waitForTimeout(700)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /I'll choose/ })
      .click()
    await page.waitForTimeout(500)
    const start = page.locator('[data-group-builder] button', { hasText: 'Start' })
    check("I'll choose: two groups, and Start waits", (await page.locator('[data-frame]').count()) === 2 && (await start.isDisabled()))
    const tap = async (name) => {
      await page
        .locator('[data-group-builder] [data-student-id]', { hasText: new RegExp(`^${name}`) })
        .first()
        .click()
      await page.waitForTimeout(30)
    }
    await page.locator('[data-frame="1"]').click({ position: { x: 20, y: 10 } })
    for (const n of NAMES.slice(0, 3)) await tap(n)
    await page.locator('[data-frame="0"]').click({ position: { x: 20, y: 10 } })
    for (const n of NAMES.slice(3, 12)) await tap(n)
    const chip = page.locator('[data-frame="0"] [data-chip-id]').first()
    const cb = await chip.boundingBox()
    await chip.click()
    await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2)
    await page.waitForTimeout(100)
    check(
      "I'll choose: a name tapped in a group goes back to its desk, once",
      (await page.locator('[data-frame="0"] [data-chip-id]').count()) === 8 && (await start.isDisabled()),
    )
    await tap(NAMES[3])
    await start.click()
    await page.waitForTimeout(900)
    let c = await activeSaved(page)
    check(
      "I'll choose: the groups as they were tapped in",
      c.groups.length === 2 && c.groups[1].studentIds.join() === 'c1-s0,c1-s1,c1-s2' && c.groups[0].studentIds.length === 9,
      c.groups.map((g) => g.studentIds.length).join('/'),
    )
    await page.getByRole('button', { name: /^Save$/ }).click()
    await page.waitForTimeout(400)
    await page.keyboard.type('Writing')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    c = await activeSaved(page)
    check('save: kept under the name typed', c.savedGroups?.length === 1 && c.savedGroups[0].name === 'Writing')
    await page.locator('button', { hasText: 'Exit Group Activity' }).first().click()
    await page.waitForTimeout(800)
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(500)
    await page.getByRole('dialog').locator('[data-saved-groups="Writing"] button').first().click()
    await page.waitForTimeout(900)
    const back = await activeSaved(page)
    check(
      'saved groups: Writing starts the same groups',
      JSON.stringify(back.groups.map((g) => g.studentIds)) === JSON.stringify(c.groups.map((g) => g.studentIds)),
    )
    await page.context().close()

    // A student who has left drops out; one who has joined goes to the smallest group.
    const later = makeClass('c1', 'Choose', 12, {
      savedGroups: [
        {
          id: 'w',
          name: 'Writing',
          savedAt: new Date().toISOString(),
          madeBy: { kind: 'count', count: 2 },
          groups: [
            { name: 'Group 1', color: '#3b82f6', studentIds: ['c1-s0', 'c1-s1', 'c1-s2', 'c1-s3', 'c1-s4', 'gone'] },
            { name: 'Group 2', color: '#ec4899', studentIds: ['c1-s5', 'c1-s6', 'c1-s7', 'c1-s8', 'c1-s9'] },
          ],
        },
      ],
    })
    const next = await open({ state: stateOf(later), size: [1280, 559] })
    await panelButton(next, 'Group Activity').click()
    await next.waitForTimeout(500)
    await next.getByRole('dialog').locator('[data-saved-groups="Writing"] button').first().click()
    await next.waitForTimeout(900)
    const g = (await activeSaved(next)).groups.map((x) => x.studentIds)
    const toast = await next
      .locator('.fixed.bottom-5')
      .textContent()
      .catch(() => '')
    check(
      'saved groups: a student who left drops out, and the new ones join the smallest group',
      g.length === 2 && !g[0].includes('gone') && g[0].length === 6 && g[1].length === 6,
      `${g.map((x) => x.length).join('/')} | ${toast}`,
    )
    return next
  },

  /** Red, amber, green and grey belong to the statuses (Help, Ready, Done, Working), never to a group. */
  async 'group colours never look like a status'() {
    const STATUS = ['#ef4444', '#f59e0b', '#22c55e', '#64748b', '#f43f5e', '#f97316']
    const bandColors = (page) =>
      page.evaluate(() => [...document.querySelectorAll('[data-group-id]')].map((card) => getComputedStyle(card).borderTopColor))
    const hex = (rgb) =>
      '#' +
      rgb
        .match(/\d+/g)
        .slice(0, 3)
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('')
    // Groups saved in yesterday's colours, the first one red: "Continue" should bring them back recoloured.
    const cls = makeClass('c1', 'Colours', 12)
    cls.groups = ['#ef4444', '#3b82f6', '#22c55e'].map((color, g) => ({
      id: 'g' + g,
      name: `Group ${g + 1}`,
      color,
      points: 0,
      studentIds: cls.students.filter((_, i) => i % 3 === g).map((s) => s.id),
    }))
    const page = await open({ state: stateOf(cls) })
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /Continue with Last Groups/ }).click()
    await page.waitForTimeout(4500)
    const continued = (await bandColors(page)).map(hex)
    check(
      'saved groups in a status colour come back recoloured',
      continued.length === 3 && !continued.some((c) => STATUS.includes(c)),
      continued.join(' '),
    )
    await page.locator('button', { hasText: 'New Groups' }).first().click()
    await page.waitForTimeout(500)
    await makeThem(page, /^6/)
    await page.waitForTimeout(4500)
    const dealt = (await bandColors(page)).map(hex)
    check(
      'a new deal of six uses no status colour, and no colour twice',
      dealt.length === 6 && !dealt.some((c) => STATUS.includes(c)) && new Set(dealt).size === 6,
      dealt.join(' '),
    )
    return page
  },

  /** One tap for a new seating plan: everyone seated at random, back rows first. */
  async 'mix up seats'() {
    const cls = makeClass('c1', 'Mix', 20)
    // Two unseated students, who should get seats too.
    cls.seating[18] = null
    cls.seating[19] = null
    const page = await open({ state: stateOf(cls) })
    const before = (await activeSaved(page)).seating.slice(0, 30).join()
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: /Mix Up Seats/ }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Yes, Mix Up' }).click()
    await page.waitForTimeout(800)
    const after = (await activeSaved(page)).seating
    const seated = after.filter(Boolean)
    // Rows are six desks, the top one first. Twenty fill the back three rows (desks 12-29), then
    // two desks at the left of the fourth (6 and 7); the rest stay empty.
    const backFirst =
      after.slice(12, 30).every(Boolean) && after[6] && after[7] && [...after.slice(0, 6), ...after.slice(8, 12)].every((s) => !s)
    check('mix up seats: everyone seated once', seated.length === 20 && new Set(seated).size === 20, `${seated.length} seated`)
    check(
      'mix up seats: back rows first',
      backFirst,
      JSON.stringify(
        after
          .slice(0, 30)
          .map((s) => (s ? 1 : 0))
          .join(''),
      ),
    )
    check('mix up seats: a different plan', after.slice(0, 30).join() !== before)
    // Since the menus' tidy-up (2026-10-11) the window stays open, saying what happened.
    check(
      'mix up seats: the window stays open, saying so',
      (await page.locator('.cs-page').count()) === 1 &&
        (await page.locator('.cs-note', { hasText: 'New seats for everyone.' }).count()) === 1,
    )
    return page
  },

  /**
   * Avatars off: the class's switch gives names only, centred and bigger than beside a picture,
   * with the homeroom number under a shared name, and keeps every student's own pick for when
   * they come back on; a newcomer shows by name too. No Avatar is one student's choice now, in
   * their own picker; a class given it all round before the switch comes in with avatars off.
   * Nothing scrolls or spills.
   */
  async 'no avatar'() {
    const cls = makeClass('c1', 'Names', 30)
    cls.students[29].name = cls.students[0].name // two students share a name, so a number shows
    cls.students[0].avatarId = 'frog/superhero'
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const nameSize = () =>
      page
        .locator('[data-ink=desk] span.font-bold')
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
    const besidePictures = await nameSize()
    await openSection(page, 'avatars')
    await page.locator('[data-guide="desk-pictures"] button', { hasText: 'Names' }).click()
    await page.waitForTimeout(300)
    let c = await activeSaved(page)
    check(
      "no avatar: Names Only turns the class's avatars off, every pick kept",
      c.avatarsOff === true && c.students[0].avatarId === 'frog/superhero',
    )
    check(
      'no avatar: a character for the class offers no No Avatar',
      !(await page.locator('[data-guide="give-character"]').innerText()).includes('No Avatar'),
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    // Measured before anyone joins: an unseated newcomer brings up the "not seated" bar, which
    // makes the desks, and so the names, a little smaller.
    const alone = await nameSize()
    // Bigger, though by less than before the side rail: its wider desks give a name beside a picture
    // more room across, while a name with a number under it is held by the desk's height.
    check('no avatar: a class with no pictures gets bigger names', alone > besidePictures, `${besidePictures}px -> ${alone}px`)
    // A newcomer to a class of names shows by name like everyone else, with nothing to undo later.
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(500)
    await page.locator('[data-guide="add"]').click()
    await page.getByPlaceholder('Name').fill('Zoe')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.waitForTimeout(300)
    c = await activeSaved(page)
    check(
      'no avatar: a new student keeps no avatar of their own',
      c.students.find((s) => s.name === 'Zoe')?.avatarId === undefined && c.avatarsOff,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const desks = await page.evaluate(() =>
      [...document.querySelectorAll('[data-ink=desk]')].map((d) => {
        const r = d.getBoundingClientRect()
        const spans = [...d.querySelectorAll('span')].map((x) => x.getBoundingClientRect()).filter((q) => q.height > 0)
        const name = d.querySelector('span.font-bold')?.getBoundingClientRect()
        return {
          img: Boolean(d.querySelector('img')),
          spill: spans.some((q) => q.bottom > r.bottom + 0.5 || q.top < r.top - 0.5),
          centred: name ? Math.abs((name.top + name.bottom) / 2 - (r.top + r.bottom) / 2) < 3 : false,
          number: d.querySelector('[data-ink=homeroom]')?.textContent ?? '',
        }
      }),
    )
    const named = desks.filter((d) => !d.img)
    check(
      'no avatar: the names sit in the middle of their desks, and nothing spills out',
      named.length >= 30 && named.every((d) => d.centred) && desks.every((d) => !d.spill),
      JSON.stringify({ named: named.length, offCentre: named.filter((d) => !d.centred).length }),
    )
    check('no avatar: the two students who share a name show their numbers, nobody else does', desks.filter((d) => d.number).length === 2)
    let over = await overflow(page)
    check('no avatar: nothing scrolls', over.page <= 0 && over.panel <= 0, JSON.stringify(over))
    // Back on: every character where it was.
    await openSection(page, 'avatars')
    await page.locator('[data-guide="desk-pictures"] button', { hasText: 'Characters' }).click()
    await page.waitForTimeout(300)
    // One student's family would rather not: No Avatar in their own picker.
    await page.locator('[data-section-link="students"]').click()
    await page.waitForTimeout(300)
    await page.getByTitle('Choose an avatar').nth(1).click()
    await page.waitForTimeout(500)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /No Avatar/ })
      .first()
      .click()
    await page.waitForTimeout(300)
    c = await activeSaved(page)
    check(
      'no avatar: one student can have none',
      c.students[1].avatarId === 'none' && c.students.filter((s) => s.avatarId === 'none').length === 1,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    check(
      'no avatar: back on, the pictures are back, the frog where it was',
      (await desk(page, NAMES[0]).locator('img[src*="frog/superhero"]').count()) === 1 &&
        (await page.locator('[data-ink=desk] img').count()) >= 29,
    )
    // A mixed class keeps one size for every name, centred or beside a picture.
    const sizes = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll('[data-ink=desk] span.font-bold')].map((e) => parseFloat(getComputedStyle(e).fontSize).toFixed(1)),
      ),
    ])
    check('no avatar: with one student by name only, every name is one size', sizes.length === 1, sizes.join(', '))
    over = await overflow(page)
    check('no avatar: mixed, nothing scrolls', over.page <= 0 && over.panel <= 0, JSON.stringify(over))
    await page.context().close()
    // A class given No Avatar all round before the switch existed comes in with it off.
    const old = makeClass('c1', 'Old', 6)
    old.students.forEach((s) => (s.avatarId = 'none'))
    const page2 = await open({ state: stateOf(old) })
    await page2.waitForTimeout(600)
    c = await activeSaved(page2)
    check(
      'no avatar: an old class of names comes in with avatars off',
      c.avatarsOff === true &&
        c.students.every((s) => s.avatarId === undefined) &&
        (await page2.locator('[data-ink=desk] img').count()) === 0,
    )
    return page2
  },

  /**
   * Choose Your Avatar: the children come up and tap their own desk; a big picker, characters
   * then poses, ignores the board's second touch as each step opens; Done ends it.
   */
  async 'choose your avatar'() {
    const page = await open({ state: stateOf(makeClass('c1', 'Choose', 12)), size: [1280, 559] })
    await openSection(page, 'avatars')
    await page.getByRole('button', { name: 'Let Students Choose' }).click()
    await page.waitForTimeout(500)
    check('choose: the board says what to do', await page.getByText('Tap your desk. Choose your avatar!').isVisible())
    check('choose: the side panel stands down', await panelButton(page, 'Pick a Random Student').isDisabled())
    await desk(page, 'Kevin').click()
    await page.waitForTimeout(100)
    const picker = page.getByRole('dialog')
    await picker.locator('button:has(img[src*="/owl/"])').click() // the board's second touch
    await page.waitForTimeout(100)
    check('choose: a touch straight after it opens is ignored', (await picker.innerText()).includes('Kevin, choose your avatar!'))
    await page.waitForTimeout(800)
    await picker.locator('button:has(img[src*="/frog/"])').click()
    await page.waitForTimeout(800)
    check('choose: then the poses', (await picker.innerText()).includes('Choose one!'))
    await picker.locator('button:has(img[src*="frog/superhero"])').click()
    await page.waitForTimeout(600)
    const c = await activeSaved(page)
    check(
      'choose: saved, and on the desk',
      c.students[2].avatarId === 'frog/superhero' && (await desk(page, 'Kevin').locator('img[src*="frog/superhero"]').count()) === 1,
    )
    const over = await overflow(page)
    check('choose: nothing scrolls', over.page <= 0 && over.panel <= 0, JSON.stringify(over))
    // A child's window moves by its title strip (2026-10-19): slid down, it stops at the screen's
    // edge, a tap still chooses, and the next child's window opens where it was put. The desks
    // ignore a tap for 0.7 s after a window closes (the board's double touch), so wait that out.
    await page.waitForTimeout(800)
    await desk(page, 'Tony').click()
    await page.waitForTimeout(900)
    const strip = picker.locator('[data-move-strip]')
    const before = await picker.boundingBox()
    const s = await strip.boundingBox()
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(s.x + s.width / 2 - i * 40, s.y + s.height / 2 + i * 60)
    await page.mouse.up()
    await page.waitForTimeout(200)
    const after = await picker.boundingBox()
    const vp = page.viewportSize()
    check(
      "choose: the child's window slides down by its strip, and stops at the screen's edge",
      after.y > before.y && Math.abs(after.y + after.height - vp.height) <= 1 && after.x >= 0,
      `${Math.round(before.y)} -> ${Math.round(after.y)}, bottom ${Math.round(after.y + after.height)} of ${vp.height}`,
    )
    await picker.locator('button:has(img[src*="/owl/"])').click()
    await page.waitForTimeout(800)
    check('choose: moved, a tap still chooses', (await picker.innerText()).includes('Choose one!'))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)
    await desk(page, 'Amy').click()
    await page.waitForTimeout(900)
    const again = await picker.boundingBox()
    check(
      "choose: the next child's window opens where it was put",
      Math.abs(again.y - after.y) <= 2 && Math.abs(again.x - after.x) <= 2,
      `${Math.round(again.x)},${Math.round(again.y)} vs ${Math.round(after.x)},${Math.round(after.y)}`,
    )
    await page.screenshot({ path: `${SHOTS}/choose-moved.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.waitForTimeout(400)
    check(
      'choose: Done ends it',
      !(await page.getByText('Tap your desk. Choose your avatar!').isVisible()) &&
        (await panelButton(page, 'Pick a Random Student').isEnabled()),
    )
    return page
  },

  /**
   * The fixes of 2026-10-12: New Class at the foot of Class Settings' list makes a class and walks
   * its setup (Back crossing into the section before), greyed at five; Remove All empties the class
   * list after asking, records and all; and the participation record goes out as a spreadsheet,
   * the quiet ones first.
   */
  /**
   * Student photos (2026-10-12): what the desks show is one of three, Characters, Photos or Names;
   * the caution comes the first time; Add Photos asks "Who is this?" with the class list's next name
   * lit, matches a file named for a student, and fits every screen, as does the window it opens
   * from. Saving needs Google (drive-check tests it); here Firebase is kept out, so it says so.
   * Photos already on this computer show as circles on the desks, the roster and the picker.
   */
  async 'student photos'() {
    const cls = makeClass('c1', 'Grade 4 English', 30, { pointsGoal: 50 })
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    /** A picture with no face in it, drawn in the page: the repo holds no photos of real people. */
    const picture = async (name, hue) => ({
      name,
      mimeType: 'image/jpeg',
      buffer: Buffer.from(
        await page.evaluate(async (h) => {
          const c = Object.assign(document.createElement('canvas'), { width: 900, height: 1200 })
          const ctx = c.getContext('2d')
          ctx.fillStyle = `hsl(${h} 60% 70%)`
          ctx.fillRect(0, 0, 900, 1200)
          ctx.fillStyle = `hsl(${h} 50% 35%)`
          ctx.beginPath()
          ctx.arc(450, 450, 200, 0, Math.PI * 2)
          ctx.fill()
          const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
          return [...new Uint8Array(await blob.arrayBuffer())]
        }, hue),
      ),
    })
    const pile = [
      await picture('IMG_0003.jpg', 30),
      await picture('IMG_0001.jpg', 120),
      await picture('Kevin.jpg', 200),
      await picture('IMG_0002.jpg', 300),
    ]
    const choice = (label) => page.locator('[data-guide="desk-pictures"] button', { hasText: label })

    await openSection(page, 'avatars')
    await choice('Photos').click()
    await page.waitForTimeout(300)
    const caution = await page.getByRole('alertdialog').innerText()
    check("photos: the caution comes first, about the school's rules", /Check your school's rules/.test(caution))
    await page.getByRole('button', { name: 'Not now' }).click()
    await page.waitForTimeout(400)
    check('photos: Not now leaves the class on characters', !(await activeSaved(page)).photosOn)
    await choice('Photos').click()
    await page.getByRole('button', { name: "I've checked, go on" }).click()
    await page.waitForTimeout(400)
    await choice('Characters').click()
    await page.waitForTimeout(200)
    await choice('Photos').click()
    await page.waitForTimeout(300)
    check(
      'photos: the caution only the first time, and the class shows photos',
      (await page.getByRole('alertdialog').count()) === 0 && (await activeSaved(page)).photosOn === true,
    )
    check(
      'photos: Let Students Choose gives way to Add Photos',
      (await page.locator('[data-guide="let-choose"]').count()) === 0 && (await page.locator('[data-guide="add-photos"]').count()) === 1,
    )

    await page.locator('[data-guide="add-photos"] input[type=file]').setInputFiles(pile)
    await page.locator('.ph-yes').waitFor({ timeout: 20000 })
    const first = await page.locator('.ph-yes').innerText()
    await page.locator('.ph-yes').click()
    await page.waitForTimeout(700)
    // A child skipped when the photos were taken: the right name is tapped, and the guesses carry on from there.
    await page.locator('.ph-name', { hasText: 'Emma' }).click()
    await page.waitForTimeout(700)
    const after = await page.locator('.ph-yes').innerText()
    check(
      'photos: the next name is lit, a file named for a student is matched, and a skip carries on from the name tapped',
      /Amy/.test(first) && /Grace/.test(after),
      `${first} / ${after}`,
    )
    // Back to the photo just named, named again, and on with the ones still to name.
    await page.getByRole('button', { name: 'Back' }).click()
    await page.waitForTimeout(700)
    const again = await page.locator('.ph-yes').innerText()
    await page.locator('.ph-yes').click()
    await page.waitForTimeout(700)
    check(
      'photos: Back goes to the photo before, and naming it carries on with the rest',
      /Emma/.test(again) && /Grace/.test(await page.locator('.ph-yes').innerText()) && (await page.locator('.ph-grid').count()) === 0,
      again,
    )
    await page.getByRole('button', { name: 'Leave it out' }).click()
    await page.locator('.ph-grid').waitFor()
    await page.waitForTimeout(500)
    const tiles = await page.locator('.ph-tile').allInnerTexts()
    check(
      'photos: every photo to check, named, with the one left out last',
      tiles.length === 4 && /Amy/.test(tiles.join()) && /Kevin/.test(tiles.join()) && /Left out/.test(tiles[3]),
      tiles.join(' | '),
    )
    await page.getByRole('button', { name: /Save 3 Photos/ }).click()
    const problem = await page
      .locator('.ph-page .text-destructive')
      .innerText({ timeout: 8000 })
      .catch(() => '')
    check('photos: with no way to Google, Save says so and keeps the photos', /Can't reach Google/.test(problem), problem)
    // Every screen of it fits, on every screen, in the theme with the biggest letters too.
    const bad = []
    const fits = async (label) => {
      const o = await page.evaluate(() =>
        Math.max(
          0,
          ...[...document.querySelectorAll('[role=dialog], .cs-page')].map((e) => e.scrollHeight - e.clientHeight),
          ...[...document.querySelectorAll('[role=dialog]')].map((d) => Math.round(d.getBoundingClientRect().bottom - innerHeight)),
        ),
      )
      if (o > 0) bad.push(`${label} ${o}px`)
    }
    for (const theme of ['vibrant', 'comic', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
      await page.waitForTimeout(400)
      for (const [w, h] of SCROLL_SIZES) {
        await page.setViewportSize({ width: w, height: h })
        await page.waitForTimeout(300)
        await fits(`${theme} ${w}x${h} check`)
        await page.locator('.ph-tile').first().click()
        await page.locator('.ph-canvas canvas').waitFor()
        await fits(`${theme} ${w}x${h} fix`)
        await page.getByRole('button', { name: 'Change who it is' }).click()
        await page.waitForTimeout(150)
        await fits(`${theme} ${w}x${h} who`)
        await page.locator('.ph-name', { hasText: 'Amy' }).click()
        await page.waitForTimeout(600)
      }
    }
    check('photos: Add Photos fits every screen, in every step', bad.length === 0, bad.slice(0, 6).join('; '))
    await page.setViewportSize({ width: 1280, height: 559 })
    await page.getByRole('button', { name: 'Close' }).click()
    check('photos: closing with photos not saved asks first', /Leave without saving/.test(await page.getByRole('alertdialog').innerText()))
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Photos already on this computer: Amy's and Tony's, in its own copy, by their files' ids.
    const jpeg = (await picture('x.jpg', 90)).buffer.toString('base64')
    await page.evaluate(
      ([b, cid]) =>
        new Promise((resolve) => {
          const req = indexedDB.open('seating-chart-photos-v1', 1)
          req.onupgradeneeded = () => req.result.createObjectStore('photos')
          req.onsuccess = () => {
            const bytes = Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0))
            const tx = req.result.transaction('photos', 'readwrite')
            tx.objectStore('photos').put(new Blob([bytes], { type: 'image/jpeg' }), 'p-amy')
            tx.objectStore('photos').put(new Blob([bytes], { type: 'image/jpeg' }), 'p-tony')
            tx.oncomplete = () => {
              const st = JSON.parse(localStorage.getItem('seating-chart-state-v1'))
              const c = st.classes.find((x) => x.id === cid)
              c.students[0].photo = 'p-amy'
              c.students[1].photo = 'p-tony'
              localStorage.setItem('seating-chart-state-v1', JSON.stringify(st))
              resolve()
            }
          }
        }),
      [jpeg, 'c1'],
    )
    await refresh(page)
    const circles = () => page.locator('[data-ink=desk] img.student-photo').count()
    check('photos: the photos on this computer show on their desks', (await circles()) === 2)
    let over = await overflow(page)
    check('photos: nothing scrolls', over.page <= 0 && over.panel <= 0, JSON.stringify(over))
    await openSection(page, 'students')
    check('photos: and in the class list', (await page.locator('.cs-srow img.student-photo').count()) === 2)
    await page.getByTitle('Choose an avatar').first().click()
    await page.waitForTimeout(500)
    check(
      "photos: a student's own picker opens on their photo, with Change and Remove",
      (await page.getByRole('button', { name: 'Change Photo' }).count()) === 1 &&
        (await page.getByRole('button', { name: 'Remove Photo' }).count()) === 1,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await page.locator('[data-section-link="avatars"]').click()
    await choice('Names').click()
    await page.waitForTimeout(200)
    await choice('Characters').click()
    await page.waitForTimeout(200)
    const kept = await activeSaved(page)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    check(
      'photos: Characters shows characters, and every photo is kept for later',
      (await circles()) === 0 && kept.students[0].photo === 'p-amy' && kept.students[1].photo === 'p-tony',
    )
    return page
  },

  async 'class settings: New Class, Remove All, and the participation export'() {
    const cls = makeClass('c1', 'Grade 4 English', 6, {
      pointsGoal: 50,
      classPoints: 0,
      participation: { '2026-10-05': { 'c1-s0': [2, 1], 'c1-s1': [1, 0] }, '2026-10-06': { 'c1-s0': [1, 0] } },
      attendance: { '2026-10-06': ['c1-s2'] },
      attendanceTaken: ['2026-10-06'],
    })
    const page = await open({ state: stateOf(cls), size: [1024, 500] })

    // The record as a spreadsheet: totals first, the fewest turns at the top, Away where they were away.
    await openSection(page, 'participation')
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-guide="part-export"]').click()])
    const csv = readFileSync(await download.path(), 'utf8').split('\n')
    check(
      'participation export: a row per student, the quiet ones first, every lesson',
      download.suggestedFilename() === 'Grade 4 English participation.csv' &&
        csv[0] ===
          'Homeroom,Name,Times picked,Times given points,2026-10-05 picked,2026-10-05 points,2026-10-06 picked,2026-10-06 points' &&
        csv
          .slice(1)
          .map((r) => r.split(',')[1])
          .join() === 'Brian,Cindy,Kevin,Mulan,Tony,Amy' &&
        csv.includes('3,Kevin,0,0,0,0,Away,') &&
        csv.includes('1,Amy,3,1,2,1,1,0'),
      csv.join(' / '),
    )
    check('participation export: Update in Drive beside it, signed in', await page.locator('[data-guide="part-drive"]').isEnabled())

    // Remove All: No changes nothing; Yes empties the list, seats and records.
    await page.locator('[data-section-link="students"]').click()
    await page.waitForTimeout(300)
    await page.locator('[data-guide="remove-all"]').click()
    await page.waitForTimeout(300)
    const asked = await page.getByRole('alertdialog').innerText()
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await page.waitForTimeout(300)
    let c = await activeSaved(page)
    check(
      'remove all: it asks first, and No keeps everyone',
      /Remove All Students\?/.test(asked) && /All 6 students/.test(asked) && c.students.length === 6,
    )
    await page.locator('[data-guide="remove-all"]').click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Yes, Remove All' }).click()
    await page.waitForTimeout(500)
    c = await activeSaved(page)
    check(
      'remove all: the list, seats, attendance and record are empty',
      c.students.length === 0 &&
        c.seating.every((s) => s === null) &&
        Object.values(c.attendance ?? {}).every((ids) => ids.length === 0) &&
        Object.values(c.participation ?? {}).every((day) => Object.keys(day).length === 0) &&
        (await page.locator('.cs-page').innerText()).includes('The class list is empty.') &&
        (await page.locator('[data-guide="remove-all"]').count()) === 0,
      JSON.stringify({ n: c.students.length, att: c.attendance, part: c.participation }),
    )

    // New Class, at the foot of the list: a second class, on Class, its setup walked.
    await page.locator('[data-guide="new-class"]').click()
    await page.waitForTimeout(800)
    const s = await saved(page)
    const bubble = page.locator('[data-guide-bubble]')
    const where = () => bubble.locator('span').first().innerText()
    check(
      'new class: made and opened on Class, with the guide',
      s.classes.length === 2 &&
        s.activeClassId !== 'c1' &&
        (await page.locator('.cs-page[data-section="class"]').count()) === 1 &&
        (await bubble.locator('p').innerText()) === 'Type the name of your class.',
    )
    // Back from Students' first step goes back into Class, the window with it.
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-guide-next]').click()
      await page.waitForTimeout(400)
    }
    const students = await where()
    await page.locator('[data-guide-back]').click()
    await page.waitForTimeout(500)
    check(
      'guide: Back crosses into the section before',
      students === 'Students · 1 of 6' &&
        (await where()) === 'Class · 5 of 5' &&
        (await page.locator('.cs-page[data-section="class"]').count()) === 1,
      `${students} -> ${await where()}`,
    )
    await page.locator('[data-guide-stop]').click()
    await page.waitForTimeout(300)
    const over = await overflow(page)
    check('new class: nothing scrolls', over.page <= 0 && over.section <= 0, JSON.stringify(over))
    await page.context().close()

    // Five classes, the most a teacher keeps: greyed, saying so.
    const five = await open({ state: stateOf(...[1, 2, 3, 4, 5].map((i) => makeClass(`c${i}`, `Class ${i}`, 3))), size: [1024, 500] })
    await openSection(five, 'class')
    const nc = five.locator('[data-guide="new-class"]')
    check('new class: greyed at five classes', (await nc.isDisabled()) && (await nc.innerText()).includes('5 classes at most'))
    return five
  },

  /**
   * The guide through Class Settings (2026-10-11): New Class on the splash walks the whole setup,
   * one thing lit at a time, every bubble inside the window at the floor size, ending on the
   * tour's offer; a tap on the faded part does nothing; Guide me walks only the section that is
   * open and finishes there; stopping is remembered.
   */
  async 'guide through class settings'() {
    const page = await open({ state: stateOf(makeClass('c1', 'Class 1', 0)), size: [1024, 500], splash: false })
    await page.locator('.splash-board button', { hasText: 'New Class' }).click()
    await page.waitForTimeout(1200)
    const bubble = page.locator('[data-guide-bubble]')
    const text = async () => ((await bubble.count()) ? bubble.locator('p').innerText() : '')
    const where = async () => ((await bubble.count()) ? bubble.locator('span').first().innerText() : '')
    const inWindow = () =>
      bubble.evaluate((b) => {
        const r = b.getBoundingClientRect()
        const w = document.querySelector('[data-slot="dialog-content"]').getBoundingClientRect()
        return r.left >= w.left - 0.5 && r.top >= w.top - 0.5 && r.right <= w.right + 0.5 && r.bottom <= w.bottom + 0.5
      })
    const next = async () => {
      await page.locator('[data-guide-next]').click()
      await page.waitForTimeout(500)
    }
    check(
      'guide: New Class walks it, from the class name, with the cursor in the box',
      (await text()) === 'Type the name of your class.' &&
        (await where()) === 'Class · 1 of 5' &&
        (await page.evaluate(() => document.activeElement?.id)) === 'class-name' &&
        (await inWindow()),
    )
    await page.keyboard.press('Control+A')
    await page.keyboard.type('4B English')
    // A tap on the faded part goes nowhere: the section list is behind the fade.
    await page.mouse.click(80, 300)
    await page.waitForTimeout(300)
    check('guide: a tap on the fade does nothing', (await where()) === 'Class · 1 of 5')
    // Back (2026-10-12): greyed on the first step, and one step back from the next.
    const firstBackGreyed = await page.locator('[data-guide-back]').isDisabled()
    await next()
    const second = await where()
    await page.locator('[data-guide-back]').click()
    await page.waitForTimeout(500)
    check(
      'guide: Back goes to the step before, and is greyed on the first',
      firstBackGreyed && second === 'Class · 2 of 5' && (await where()) === 'Class · 1 of 5',
      `${firstBackGreyed}, ${second}, ${await where()}`,
    )
    let steps = 0
    let offScreen = 0
    const seen = []
    while ((await bubble.count()) && !(await text()).includes('Want a tour') && steps < 30) {
      if (!(await inWindow())) offScreen++
      seen.push(await where())
      if ((await text()).startsWith('Paste your student list')) {
        // The list goes in as the guide says, with a paste.
        await page.evaluate((list) => {
          const data = new DataTransfer()
          data.setData('text/plain', list)
          document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
        }, 'Amy\t401\nTony\t402\nKevin\t403')
        await page.waitForTimeout(600)
        check('guide: the pasted list window puts the guide aside', (await bubble.count()) === 0)
        await page.getByRole('button', { name: 'Add 3 Students' }).click()
        await page.waitForTimeout(700)
        check('guide: and it comes back on the list', (await text()).startsWith('This is your class list'))
      }
      if ((await text()).startsWith('Tap Seat Students')) {
        await page.locator('[data-guide="seat"]').click()
        await page.waitForTimeout(500)
      }
      await next()
      steps++
    }
    const c = await activeSaved(page)
    check(
      "guide: Class, Students, Avatars and Points, then You're all set! at Done",
      (await text()).includes('Want a tour') &&
        offScreen === 0 &&
        seen.some((w) => w.startsWith('Students')) &&
        seen.some((w) => w.startsWith('Avatars')) &&
        seen.some((w) => w.startsWith('Points')),
      `${seen.join(', ')}; ${offScreen} off the window`,
    )
    check(
      'guide: the class is named and seated',
      c.name === '4B English' && c.seating.filter(Boolean).length === 3,
      `${c.name}, ${c.seating.filter(Boolean).length}`,
    )
    const over = await overflow(page)
    check('guide: nothing scrolls', over.page <= 0 && over.panel <= 0 && over.section <= 0, JSON.stringify(over))
    // Show me: the tour's first card, Class Settings put away.
    await next()
    check(
      'guide: Show me starts the tour',
      (await page.locator('[data-tour-card]').count()) === 1 && (await page.locator('.cs-page').count()) === 0,
    )
    await page.locator('[data-tour-action="not-now"]').click()
    await page.waitForTimeout(400)
    check(
      'guide: finished is remembered',
      await page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-guide-v1') || '{}')['walkthrough-teacher'] === true),
    )
    // Guide me, on the section that is open: only it, finishing there.
    await openSection(page, 'tools')
    await page.locator('[data-guide="help"]').click()
    await page.locator('[data-help="guide"]').click()
    await page.waitForTimeout(400)
    const toolSteps = []
    while ((await bubble.count()) && toolSteps.length < 12) {
      toolSteps.push(await where())
      const finish = (await page.locator('[data-guide-next]').innerText()).includes('Finish')
      await next()
      if (finish) break
    }
    check(
      'guide: Guide me walks the open section and finishes there',
      toolSteps.length === 8 &&
        toolSteps.every((w) => w.startsWith('Tools')) &&
        (await bubble.count()) === 0 &&
        (await page.locator('.cs-page[data-section="tools"]').count()) === 1,
      toolSteps.join(', '),
    )
    return page
  },

  /**
   * The tour of the app, from Help: a picture of each screen with one thing lit, a card between
   * parts, and stopping picks up where it left off next time.
   */
  async 'tour of the app'() {
    const page = await open({ state: stateOf(makeClass('c1', 'Tour', 12, { pointsGoal: 50, classPoints: 5 })), size: [1280, 559] })
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(400)
    await page.locator('[data-guide="help"]').click()
    await page.locator('[data-help="tour"]').click()
    await page.waitForTimeout(400)
    check(
      'tour: Help opens it, Class Settings put away',
      (await page.locator('[data-tour-card]').count()) === 1 && (await page.locator('.cs-page').count()) === 0,
    )
    await page.locator('[data-tour-action="begin"]').click()
    let stops = 0
    let bad = 0
    const parts = []
    for (let guard = 0; guard < 150; guard++) {
      // Past the lit ring's own slide to its new place (0.2 s).
      await page.waitForTimeout(300)
      if (await page.locator('[data-tour-card]').count()) {
        const title = await page.locator('[data-tour-card] h3').innerText()
        parts.push(title)
        if (title === 'That’s the tour!') break
        await page.locator('[data-tour-action="go"]').click()
        continue
      }
      const ok = await page.evaluate(() => {
        const b = document.querySelector('[data-tour-bubble]').getBoundingClientRect()
        const h = document.querySelector('[data-tour-hole]')?.getBoundingClientRect()
        const cover = h
          ? Math.max(0, Math.min(b.bottom, h.bottom) - Math.max(b.top, h.top)) *
            Math.max(0, Math.min(b.right, h.right) - Math.max(b.left, h.left))
          : 1
        return (
          Boolean(h) && b.top >= 0 && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && cover / (h.width * h.height) < 0.15
        )
      })
      if (!ok) bad++
      stops++
      await page.locator('[data-tour-action="next"]').click()
    }
    check(
      // 97: Full Screen's stop (2026-10-14), the Line's button on the board and a part of its own (2026-10-15),
      // the board's lock (2026-10-19), and the Class Quest's part and the Marble Jar's (2026-10-24).
      'tour: 103 stops, each lit, the bubble on the screen and off the lit thing',
      stops === 103 && bad === 0,
      `${stops} stops, ${bad} bad`,
    )
    check('tour: a card before each part after the first', parts.length === 9, parts.join(', '))
    // Back from the last card goes to the last stop of the last part, and Next comes back to it.
    const place = () => page.locator('[data-tour-bubble] span').first().innerText()
    await page.locator('[data-tour-action="back"]').click()
    await page.waitForTimeout(300)
    const lastStop = (await page.locator('[data-tour-bubble]').count()) ? await place() : ''
    await page.locator('[data-tour-action="next"]').click()
    await page.waitForTimeout(300)
    check(
      'tour: Back on the last card, to the last stop',
      /^(.+) · (\d+) of \2$/.test(lastStop) && (await page.locator('[data-tour-card] h3').innerText()) === 'That’s the tour!',
      lastStop,
    )
    await page.locator('[data-tour-action="done"]').click()
    await page.waitForTimeout(300)
    // Stopped in Group Activity, it offers to go on from there.
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.locator('[data-guide="help"]').click()
    await page.locator('[data-help="tour"]').click()
    await page.locator('[data-tour-action="begin"]').click()
    // Through the board's 21 stops to the card before the Class Quest, then skip it, the Marble Jar and Flip Cards to Group Activity's card.
    for (let i = 0; i < 21; i++) await page.locator('[data-tour-action="next"]').click()
    await page.locator('[data-tour-action="skip"]').click()
    await page.locator('[data-tour-action="skip"]').click()
    await page.locator('[data-tour-action="skip"]').click()
    await page.locator('[data-tour-action="stop-here"]').click()
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.locator('[data-guide="help"]').click()
    await page.locator('[data-help="tour"]').click()
    await page.waitForTimeout(300)
    const offer = await page.locator('[data-tour-card]').innerText()
    await page.locator('[data-tour-action="resume"]').click()
    const resumed = await page.locator('[data-tour-card] h3').innerText()
    check(
      'tour: stopped, it picks up where it left off',
      /You were up to\s+Group Activity/.test(offer) && resumed === 'Group Activity',
      `${offer.replace(/\s+/g, ' ')} -> ${resumed}`,
    )
    // The card between parts has Back too (2026-10-12): to the last stop of the part before.
    await page.locator('[data-tour-action="back"]').click()
    await page.waitForTimeout(300)
    const before = (await page.locator('[data-tour-bubble]').count()) ? await place() : ''
    check(
      'tour: Back on the card between parts, to the last stop of the part before',
      new RegExp(`^${parts[2]} · (\\d+) of \\1$`).test(before),
      before,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check('tour: Escape stops it', (await page.locator('[data-tour]').count()) === 0)
    return page
  },

  /**
   * Room layouts: each one chosen in Class Settings, for a class of 30 and a class of 35, at the
   * three sizes - everyone seated once, nothing scrolls, the names as big as in Rows (the
   * layouts keep six desks across), and Pick Row/Table and Split by Rows/Tables use the room.
   */
  async 'room layouts'() {
    const LAYOUTS = [
      ['pairs', 'Pairs', 'row', 6],
      ['threes', 'Rows of 3', 'row', 6],
      ['tables4', 'Tables of 4', 'table', 9],
      ['tables5-top', '5th on top', 'table', 6],
      ['tables5-bottom', '5th below', 'table', 6],
      ['rows', 'Rows', 'row', 6],
    ]
    const nameSize = (page) =>
      page.evaluate(() => {
        const span = document.querySelector('[data-ink=desk] span[style*="--desk-name"]')
        return span ? parseFloat(getComputedStyle(span).fontSize) : 0
      })
    for (const count of [30, 35]) {
      for (const size of SIZES) {
        const page = await open({ state: stateOf(makeClass('c1', 'Layouts', count), makeClass('c2', 'Other', 2)), size })
        const where = `${count} students ${size.join('x')}`
        const rowsName = await nameSize(page)
        const bad = []
        for (const [id, label, setName, sets] of LAYOUTS) {
          await openSection(page, 'class')
          const o1 = await overflow(page)
          if (o1.page || o1.dialog || o1.section > 0) bad.push(`${id} settings ${JSON.stringify(o1)}`)
          await page.locator('[role=dialog] button[aria-pressed]', { hasText: label }).first().click()
          await page.waitForTimeout(300)
          await page.keyboard.press('Escape')
          await page.waitForTimeout(600)
          const c = await activeSaved(page)
          const seated = c.seating.filter(Boolean)
          if (c.layout !== id && !(id === 'rows' && (c.layout ?? 'rows') === 'rows')) bad.push(`${id}: saved layout is ${c.layout}`)
          if (seated.length !== count || new Set(seated).size !== count) bad.push(`${id}: ${seated.length} seated`)
          const o = await overflow(page)
          if (o.page || o.pageX || o.panel > 0) bad.push(`${id} board ${JSON.stringify(o)}`)
          const drawn = await page.locator('[data-ink=desk]').count()
          if (drawn !== count) bad.push(`${id}: ${drawn} desks with a student drawn`)
          // Six across keeps the names at Rows' size; a big class in tables of 5 is the exception (eight across).
          const ratio = (await nameSize(page)) / rowsName
          if (!(id === 'tables5-top' || id === 'tables5-bottom') || count <= 30) {
            if (ratio < 0.97) bad.push(`${id}: names ${Math.round(ratio * 100)}% of Rows`)
          }
          const pickLabel = setName === 'table' ? 'Pick a Random Table' : 'Pick a Random Row'
          await panelButton(page, pickLabel).click()
          await page.waitForTimeout(3200)
          const lit = await page.locator('[data-ink=desk].desk-picked').count()
          if (lit === 0) bad.push(`${id}: ${pickLabel} lit nobody`)
          await page.mouse.click(5, 5)
          await page.waitForTimeout(300)
          await panelButton(page, 'Group Activity').click()
          await page.waitForTimeout(500)
          // One group a table, offered only in a room of tables (a room of rows has 2 to 6 groups).
          const split = page.getByRole('button', { name: /^Tables/ })
          if (setName === 'table') {
            const caption = (await split.textContent()) ?? ''
            const groups = Number(caption.match(/(\d+) groups/)?.[1] ?? 0)
            if (groups < 2 || groups > sets + (count > 30 ? 2 : 0)) bad.push(`${id}: split makes "${caption}"`)
          } else if (await split.count()) bad.push(`${id}: Tables offered in a room of rows`)
          await page.keyboard.press('Escape')
          await page.waitForTimeout(500)
          if (size[0] === 1280) await page.screenshot({ path: `${SHOTS}/layout-${id}-${count}.png` })
        }
        check(`room layouts: ${where}`, bad.length === 0 && page.errors.length === 0, [...bad, ...page.errors].join('; '))
        await page.context().close()
      }
    }
    // Rows, Pairs and Rows of 3 number their desks alike: switching between them moves nobody.
    const cls = makeClass('c1', 'Same seats', 20)
    cls.seating[3] = null
    cls.seating[25] = cls.students[3].id
    const page = await open({ state: stateOf(cls, makeClass('c2', 'Other', 2)) })
    const before = (await activeSaved(page)).seating.slice(0, 35).join()
    for (const label of ['Pairs', 'Rows of 3', 'Rows']) {
      await openSection(page, 'class')
      await page.locator('[role=dialog] button[aria-pressed]', { hasText: label }).first().click()
      await page.waitForTimeout(300)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
    check('room layouts: rows, pairs and rows of 3 move nobody', (await activeSaved(page)).seating.slice(0, 35).join() === before)
    return page
  },

  /** The rule: nothing scrolls, in any theme, at any screen from 1024x500 up. */
  /**
   * The timer (the side rail's hourglass): big over the board, set with a tap on the face and − +,
   * coloured on the wedge alone, moved and made smaller, put away into the bar, time's up waiting
   * for a tap, and X to turn it off.
   */
  async 'the timer'() {
    const cls = makeClass('c1', 'Timer', 12, { pointsGoal: 50, classPoints: 5 })
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const card = page.locator('[data-timer-card]')
    const time = () => page.locator('.timer-time').textContent()
    const pause = () => page.waitForTimeout(800) // past the double-touch guard
    // The board reads one touch as two: a second tap on the rail's button straight away is ignored.
    await panelButton(page, 'Timer').click()
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(300)
    check(
      'timer: opens big from the rail, and a double touch leaves it open',
      (await card.count()) === 1 && (await time()) === '10:00',
      await time(),
    )
    // The board dims behind it (2026-10-12), but stays live: a desk under the shade still takes a
    // tap and a star, and the rail stays above the shade.
    const dimmed = await page.evaluate(() => {
      const rail = document.querySelector('aside').getBoundingClientRect()
      const onRail = document.elementFromPoint(rail.x + rail.width / 2, rail.y + rail.height / 2)
      return { dim: document.querySelectorAll('.timer-dim').length, railOnTop: Boolean(onRail?.closest('aside')) }
    })
    await desk(page, 'Amy').click()
    await award(page)
    await page.waitForTimeout(1500)
    check(
      'timer: the board dims behind it, the rail stays bright, and a desk still takes a star',
      dimmed.dim === 1 && dimmed.railOnTop && (await activeSaved(page)).classPoints === 6,
      `${JSON.stringify(dimmed)} meter ${(await activeSaved(page)).classPoints}`,
    )
    await page.screenshot({ path: `${SHOTS}/timer-dim.png` })
    await desk(page, 'Amy').click()
    // Never started: the rail's button turns it off again.
    await pause()
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(300)
    check(
      'timer: tapped again unstarted, it goes off',
      (await card.count()) === 0 && (await page.locator('[data-timer-clock]').count()) === 0,
    )
    await pause()
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(300)
    // A tap on the face at three o'clock is 15 minutes; − takes one off.
    const dial = await page.locator('.timer-dial').boundingBox()
    await page.mouse.click(dial.x + dial.width * 0.85, dial.y + dial.height / 2)
    await page.waitForTimeout(300)
    const fromFace = await time()
    await card.getByRole('button', { name: 'A minute less' }).click()
    await page.waitForTimeout(300)
    check(
      'timer: a tap on the face sets it, and − takes a minute off',
      fromFace === '15:00' && (await time()) === '14:00',
      `${fromFace}, then ${await time()}`,
    )
    // Green colours the wedge alone: the play button keeps the theme's colour.
    await pause()
    await card.getByRole('button', { name: 'Timer settings' }).click()
    await pause()
    await card.getByRole('button', { name: 'Green', exact: true }).click()
    await pause()
    await card.getByRole('button', { name: 'Done' }).click()
    await page.waitForTimeout(300)
    const colours = await page.evaluate(() => ({
      wedge: getComputedStyle(document.querySelector('.timer-wedge')).fill,
      play: getComputedStyle(document.querySelector('.timer-round.go')).backgroundColor,
      primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
    }))
    check('timer: green is the wedge only', colours.wedge === 'rgb(22, 163, 74)' && colours.play !== colours.wedge, JSON.stringify(colours))
    // Slid by its strip, and made smaller by its corner: it stays on the screen and is kept.
    const before = await card.boundingBox()
    const grip = await page.locator('.timer-grip').boundingBox()
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(grip.x - 2000, grip.y + 2000, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    const moved = await card.boundingBox()
    const corner = await page.locator('[data-timer-size]').boundingBox()
    await page.mouse.move(corner.x + 5, corner.y + 5)
    await page.mouse.down()
    await page.mouse.move(corner.x - 400, corner.y - 400, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    const small = await card.boundingBox()
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-timer-settings-v1')))
    check(
      'timer: slid to the corner it stops at the edge, and smaller is kept',
      Math.round(moved.x) === 0 &&
        Math.round(moved.y + moved.height) === 559 &&
        small.width < before.width * 0.6 &&
        kept.size < 0.6 &&
        kept.pos.x === 0,
      `${JSON.stringify(moved)} ${JSON.stringify(small)} ${JSON.stringify(kept)}`,
    )
    // A tap that ends a slide presses nothing.
    check('timer: the slide pressed nothing', (await time()) === '14:00' && (await card.count()) === 1)
    // Started, put away: the clock in the bar counts down; then the time runs out.
    await page.clock.install()
    await card.getByRole('button', { name: 'Start', exact: true }).click()
    await page.clock.runFor(1500)
    await card.getByRole('button', { name: 'Put the timer away' }).click()
    await page.clock.runFor(1000)
    const clock = page.locator('[data-timer-clock]')
    check(
      'timer: put away, a clock in the bar',
      (await card.count()) === 0 && /^13:5\d$/.test((await clock.innerText()).trim()),
      await clock.innerText(),
    )
    check('timer: put away, the board is not dimmed', (await page.locator('.timer-dim').count()) === 0)
    // The last 20 seconds are orange and the last 10 red, pulsing each second (2026-10-12): in the bar...
    const phase = (sel) =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return {
          cls: el.className,
          bg: getComputedStyle(el).backgroundColor,
          outline: getComputedStyle(el).outlineColor,
          anims: el.getAnimations().map((a) => a.animationName ?? 'pulse'),
        }
      }, sel)
    await page.clock.runFor(818500)
    const barOrange = await phase('[data-timer-clock]')
    check(
      'timer: the last 20 seconds, the clock in the bar is orange',
      (await clock.innerText()).trim().startsWith('0:19') && barOrange.cls.includes('ending') && barOrange.bg === 'rgb(249, 115, 22)',
      JSON.stringify(barOrange),
    )
    await page.screenshot({ path: `${SHOTS}/timer-bar-orange.png` })
    await page.clock.runFor(10000)
    const barRed = await phase('[data-timer-clock]')
    check(
      'timer: the last 10 seconds, red and pulsing in the bar',
      barRed.cls.includes('last') && barRed.bg === 'rgb(239, 68, 68)' && barRed.anims.includes('pulse'),
      JSON.stringify(barRed),
    )
    // ...and big: orange at 20, red at 10 with the pulse.
    await page.clock.runFor(800)
    await clock.getByRole('button', { name: 'Open the timer' }).click({ force: true })
    await page.clock.runFor(200)
    const bigRed = await phase('[data-timer-card]')
    check(
      'timer: big in the last 10 seconds, the whole clock red',
      bigRed.cls.includes('last') && bigRed.outline === 'rgb(239, 68, 68)' && (await page.locator('.timer-dim').count()) === 1,
      JSON.stringify(bigRed),
    )
    await page.screenshot({ path: `${SHOTS}/timer-red.png` })
    await page.clock.runFor(1000)
    check('timer: big, it pulses as each second goes', (await phase('[data-timer-card]')).anims.includes('pulse'))
    // Time's up: the clock dances as the alarm goes, then the rail's button is red.
    await page.clock.runFor(10000)
    const upText = await page.locator('.timer-up').count()
    const railRed = (await panelButton(page, 'Timer').getAttribute('class')).includes('rail-alarm')
    const dancing = await phase('[data-timer-card]')
    check(
      "timer: time's up, the clock dances and the rail's button is red",
      upText === 1 && railRed && dancing.anims.includes('timer-dance'),
      `${upText} ${railRed} ${JSON.stringify(dancing)}`,
    )
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/timer-up.png` })
    await page.clock.runFor(1000)
    await card.getByRole('button', { name: 'Put the timer away' }).click()
    await page.clock.runFor(400)
    const barUp = await phase('[data-timer-clock]')
    check(
      "timer: time's up in the bar, dancing",
      (await clock.innerText()).trim() === 'Time’s up!' && barUp.anims.includes('timer-dance'),
      JSON.stringify(barUp),
    )
    await page.clock.runFor(1000)
    await clock.getByRole('button', { name: 'Open the timer' }).click({ force: true })
    await page.clock.runFor(1000)
    await page.locator('.timer-up').click({ force: true })
    await page.clock.runFor(300)
    check(
      "timer: a tap on Time's up puts the time back, and its colour",
      (await page.locator('.timer-up').count()) === 0 &&
        (await time()) === '14:00' &&
        !/ending|last/.test(await card.getAttribute('class')),
    )
    await page.clock.runFor(1000)
    await card.getByRole('button', { name: 'Turn the timer off' }).click()
    await page.clock.runFor(300)
    check(
      'timer: X turns it off',
      (await card.count()) === 0 && (await clock.count()) === 0 && page.errors.length === 0,
      page.errors[0] ?? '',
    )
    return page
  },

  /**
   * The timer's mouse face (2026-10-20): chosen behind the gear, one apple a minute and the cheese,
   * "How long?" from a tap on the stopped face, bites as the time goes, the cheese at time's up,
   * and the gear's choices fitting the face down to 1024x500.
   */
  /**
   * The writing mouse (2026-10-22, the class's idea): a page a minute at its desk, the blank pages the
   * minutes left, the finished ones on the line, no sound while it works, and "Done!" at time's up
   * with no orange, red or dance.
   */
  /**
   * Setting the time quickly (2026-10-23, the teacher): a finger held on − or + keeps the time
   * moving until it is lifted, and a tap on the time opens a box to type the minutes in.
   */
  async 'setting the time quickly'() {
    const cls = makeClass('c1', 'Quick', 12, { pointsGoal: 50 })
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const card = page.locator('[data-timer-card]')
    const time = () => card.locator('.timer-time').first().textContent()
    const mins = async () => Number((await time()).split(':')[0])
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(800)
    const start = await mins()
    const hold = async (name, ms) => {
      const b = await card.getByRole('button', { name }).boundingBox()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(ms)
      await page.mouse.up()
    }
    await hold('A minute more', 1400)
    const afterUp = await mins()
    await page.waitForTimeout(600)
    check(
      'quick time: holding + runs the time up, and stops when let go',
      afterUp >= start + 4 && (await mins()) === afterUp,
      `${start} -> ${afterUp} -> ${await mins()}`,
    )
    await hold('A minute less', 1100)
    const afterDown = await mins()
    check('quick time: holding − runs it down', afterDown <= afterUp - 3, `${afterUp} -> ${afterDown}`)
    await page.waitForTimeout(800)
    await card.getByRole('button', { name: 'A minute more' }).click()
    await page.waitForTimeout(400)
    check('quick time: a tap on + is still one minute', (await mins()) === afterDown + 1, `${afterDown} -> ${await mins()}`)
    await page.waitForTimeout(800)
    await card.locator('.timer-time-tap').click()
    await page.waitForTimeout(300)
    const box = card.getByRole('textbox', { name: 'Minutes' })
    check('quick time: a tap on the time opens a box to type in', (await box.count()) === 1)
    await page.screenshot({ path: `${SHOTS}/timer-type.png` })
    await box.fill('25')
    await box.press('Enter')
    await page.waitForTimeout(300)
    check('quick time: typing 25 sets 25:00', (await time()) === '25:00', await time())
    await page.waitForTimeout(800)
    await card.locator('.timer-time-tap').click()
    await page.waitForTimeout(300)
    await box.fill('99')
    await box.press('Enter')
    await page.waitForTimeout(300)
    check('quick time: a time past the hour changes nothing', (await time()) === '25:00', await time())
    await page.waitForTimeout(800)
    await card.locator('.timer-time-tap').click()
    await page.waitForTimeout(300)
    await box.fill('7')
    await box.press('Escape')
    await page.waitForTimeout(300)
    check('quick time: Esc leaves it as it was', (await time()) === '25:00' && (await box.count()) === 0, await time())
    check('quick time: no errors', page.errors.length === 0, page.errors[0] ?? '')
  },

  async 'the writing mouse'() {
    const cls = makeClass('c1', 'Writer', 12, { pointsGoal: 50 })
    const page = await open({ state: stateOf(cls), size: [1280, 559], before: countSounds })
    const card = page.locator('[data-timer-card]')
    const scene = page.locator('.mouse-scene')
    const hung = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('.mouse-scene use')].filter(
            (u) => /page$/.test(u.getAttribute('href')) && u.getAttribute('display') !== 'none' && u.parentElement.tagName === 'g',
          ).length,
      )
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(800)
    await card.getByRole('button', { name: 'Timer settings' }).click()
    await page.waitForTimeout(800)
    await card.getByRole('button', { name: 'Writing' }).click()
    await page.waitForTimeout(300)
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-timer-settings-v1')))
    check('writing mouse: chosen behind the gear and kept', kept.face === 'writer', JSON.stringify(kept))
    // The time's-up sound has its own switch (2026-10-23): off greys the sounds, and a tap on one turns it back on with that one.
    const timerKept = () => page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-timer-settings-v1')))
    await card.getByRole('switch', { name: 'Time’s up sound' }).click()
    await page.waitForTimeout(300)
    check(
      "time's up sound: the switch turns it off, kept, and No Sound is gone",
      (await timerKept()).alarmOn === false &&
        (await card.locator('.timer-sounds.off').count()) === 1 &&
        (await card.getByRole('button', { name: 'No Sound' }).count()) === 0,
    )
    await page.screenshot({ path: `${SHOTS}/timer-alarm-off.png` })
    await card.getByRole('button', { name: 'Chime' }).click()
    await page.waitForTimeout(300)
    const back = await timerKept()
    check(
      "time's up sound: a tap on Chime turns it back on with Chime",
      back.alarmOn === true && back.alarmSound === 'chime',
      JSON.stringify(back),
    )
    await page.screenshot({ path: `${SHOTS}/writer-gear.png` })
    await card.getByRole('button', { name: 'Done' }).click()
    await page.waitForTimeout(800)
    check('writing mouse: no speaker, since it makes no sound', (await card.locator('[data-timer-quiet]').count()) === 0)
    await scene.click()
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: '5 minutes', exact: true }).click()
    await page.waitForTimeout(800)
    check(
      'writing mouse: five minutes is five pages',
      (await scene.getAttribute('aria-label')) === '5 pages left',
      await scene.getAttribute('aria-label'),
    )
    await page.screenshot({ path: `${SHOTS}/writer-5.png` })
    await page.clock.install()
    await page.clock.pauseAt(Date.now() + 2000)
    await card.getByRole('button', { name: 'Start', exact: true }).click()
    const heard = await page.evaluate(() => window.__sounds.length)
    await page.clock.runFor(30000)
    const inked = await page.evaluate(
      () =>
        [...document.querySelectorAll('.mouse-scene path[stroke-dasharray]')].filter((p) => p.getAttribute('display') !== 'none').length,
    )
    check('writing mouse: half a minute in, the page is half written', inked > 3, String(inked))
    await page.screenshot({ path: `${SHOTS}/writer-running.png` })
    await page.clock.runFor(31000)
    check(
      'writing mouse: a minute in, a page on the line and nothing heard',
      (await hung()) === 1 && (await page.evaluate(() => window.__sounds.length)) === heard,
      `${await hung()} hung`,
    )
    // To time's up (5 minutes from the start), then the ending.
    await page.clock.runFor(239000)
    await page.clock.runFor(3000)
    const done = await page.evaluate(() =>
      [...document.querySelectorAll('.mouse-scene text')].some(
        (t) => t.textContent === 'Done!' && t.parentElement.getAttribute('display') !== 'none',
      ),
    )
    check(
      'writing mouse: time\'s up, all five pages hung, "Done!", and no red or dance',
      done &&
        (await hung()) === 5 &&
        (await page.locator('.mouse-up').count()) === 1 &&
        !/\b(up|last|ending)\b/.test(await card.getAttribute('class')),
      `${done} ${await hung()} ${await card.getAttribute('class')}`,
    )
    await page.screenshot({ path: `${SHOTS}/writer-done.png` })
    await page.locator('.mouse-up').click({ force: true })
    await page.clock.runFor(300)
    check("writing mouse: a tap on Time's up puts the pages back", (await page.locator('.mouse-up').count()) === 0 && (await hung()) === 0)
    check('writing mouse: no errors', page.errors.length === 0, page.errors[0] ?? '')
  },

  async 'the mouse timer'() {
    const cls = makeClass('c1', 'Mouse', 12, { pointsGoal: 50 })
    const page = await open({ state: stateOf(cls), size: [1280, 559], before: countSounds })
    const card = page.locator('[data-timer-card]')
    const time = () => page.locator('.timer-time').textContent()
    const apples = () =>
      page.evaluate(() => {
        const hrefs = [...document.querySelectorAll('.mouse-scene > g use')]
          .filter((u) => u.style.display !== 'none')
          .map((u) => (u.getAttribute('href') || '').replace(/^#mf\w*?(whole|coreR|coreL|cheese)$/, '$1'))
        return {
          whole: hrefs.filter((h) => h === 'whole').length,
          core: hrefs.filter((h) => h.startsWith('core')).length,
          cheese: hrefs.filter((h) => h === 'cheese').length,
        }
      })
    await panelButton(page, 'Timer').click()
    await page.waitForTimeout(800)
    await card.getByRole('button', { name: 'Timer settings' }).click()
    await page.waitForTimeout(800)
    check('mouse timer: the dial has its colours', (await page.locator('.timer-colors').count()) === 1)
    await card.getByRole('button', { name: 'Apples' }).click()
    await page.waitForTimeout(300)
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-timer-settings-v1')))
    check(
      'mouse timer: Mouse is chosen behind the gear, kept, and the colours go',
      kept.face === 'mouse' && (await page.locator('.timer-colors').count()) === 0,
      JSON.stringify(kept),
    )
    await page.screenshot({ path: `${SHOTS}/mouse-timer-gear.png` })
    await card.getByRole('button', { name: 'Done' }).click()
    await page.waitForTimeout(800)
    const ten = await apples()
    check(
      'mouse timer: ten minutes is ten apples and the cheese',
      ten.whole === 9 && ten.cheese === 1 && (await page.locator('.mouse-scene').count()) === 1,
      JSON.stringify(ten),
    )
    await page.screenshot({ path: `${SHOTS}/mouse-timer-10.png` })
    // A tap on the stopped face: "How long?", then 5.
    await page.locator('.mouse-scene').click()
    await page.waitForTimeout(800)
    check('mouse timer: a tap on the stopped face asks how long', (await page.locator('.mouse-pick').count()) === 1)
    await page.screenshot({ path: `${SHOTS}/mouse-timer-howlong.png` })
    await page.getByRole('button', { name: '5 minutes', exact: true }).click()
    await page.waitForTimeout(800)
    const five = await apples()
    check(
      'mouse timer: 5 is picked, five apples',
      (await time()) === '5:00' && five.whole === 4 && (await page.locator('.mouse-pick').count()) === 0,
      JSON.stringify(five),
    )
    // Started: a bite every 5 seconds, and after a minute the first apple is a core.
    // Paused, so each check looks at the moment it names: a running page clock drifts on with real time.
    await page.clock.install()
    await page.clock.pauseAt(Date.now() + 2000)
    await card.getByRole('button', { name: 'Start', exact: true }).click()
    await page.clock.runFor(62600)
    const after = await apples()
    const bites = await page.evaluate(() => window.__sounds.length)
    // About a bite every 5 seconds (the first may come before this page's copy of the sound has loaded).
    check(
      'mouse timer: a minute in, one core and a bite every 5 seconds heard',
      after.core === 1 && after.whole === 3 && bites >= 11 && bites <= 13,
      `${JSON.stringify(after)} bites ${bites}`,
    )
    await page.screenshot({ path: `${SHOTS}/mouse-timer-running.png` })
    // The strip's speaker turns the bites off, and is kept (2026-10-22: the class found them distracting).
    await card.getByRole('button', { name: 'Sound on. Tap for no sound' }).click()
    const before = await page.evaluate(() => window.__sounds.length)
    await page.clock.runFor(10000)
    check(
      'mouse timer: the speaker in the strip quiets the bites, and is kept',
      (await page.evaluate(() => window.__sounds.length)) === before &&
        (await page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-timer-settings-v1')).quiet)) === true,
    )
    await page.screenshot({ path: `${SHOTS}/mouse-timer-quiet.png` })
    await card.getByRole('button', { name: 'No sound. Tap for sound' }).click()
    await page.clock.runFor(1000)
    // Paused, a tap on the face asks how long again; leaving it, play carries on.
    await card.getByRole('button', { name: 'Pause' }).click()
    await page.clock.runFor(5000)
    check('mouse timer: paused, the time holds', (await time()) === '3:47', await time())
    await card.getByRole('button', { name: 'Start', exact: true }).click()
    // 3:47 left, less the 0.6 s already gone of that second: to 0:15, to time's up exactly, then 2.5 s on.
    await page.clock.runFor(211400)
    // No orange, red or pulse near the end: only the dial does that (2026-10-22, the teacher).
    check(
      'mouse timer: 15 seconds left, no orange or red',
      /^0:1[56]$/.test(await time()) && !/ending|last/.test(await card.getAttribute('class')),
      `${await time()} ${await card.getAttribute('class')}`,
    )
    await page.clock.runFor(15000)
    await page.clock.runFor(2500)
    const up = await page.locator('.mouse-up').count()
    const end = await page.evaluate(() => {
      const m = document.querySelector('.mouse-scene > g:nth-last-child(2)').getBoundingClientRect()
      const ch = [...document.querySelectorAll('.mouse-scene use')]
        .find((u) => /cheese$/.test(u.getAttribute('href')))
        .getBoundingClientRect()
      return Math.hypot(m.x + m.width / 2 - (ch.x + ch.width / 2), m.y + m.height - (ch.y + ch.height)) / ch.width
    })
    check(
      "mouse timer: time's up, every apple a core and the mouse at the cheese",
      up === 1 && (await apples()).whole === 0 && end < 1.3,
      `${up} ${end.toFixed(2)}`,
    )
    check(
      "mouse timer: time's up with no red and no dance",
      !/\b(up|last)\b/.test(await card.getAttribute('class')),
      await card.getAttribute('class'),
    )
    await page.screenshot({ path: `${SHOTS}/mouse-timer-up.png` })
    // Then it dances and eats the cheese, four chomps (2026-10-21, the class: "why didn't the mouse eat it?").
    const heard = await page.evaluate(() => window.__sounds.length)
    await page.clock.runFor(5000)
    const ate = await page.evaluate(() => {
      const ch = [...document.querySelectorAll('.mouse-scene use')]
        .find((u) => /cheese$/.test(u.getAttribute('href')))
        .getBoundingClientRect()
      return { w: ch.width, hic: document.querySelectorAll('.mouse-scene text').length }
    })
    const chomps = (await page.evaluate(() => window.__sounds.length)) - heard
    check('mouse timer: the mouse eats the cheese in four chomps', ate.w < 1 && chomps === 4, `${JSON.stringify(ate)} chomps ${chomps}`)
    // The sparkles fade away rather than staying on top of the mouse (2026-10-21).
    await page.clock.runFor(2000)
    const stars = await page.evaluate(() => document.querySelectorAll('.mouse-scene path[d^="M0 -7"]').length)
    check('mouse timer: the sparkles have faded away', stars === 0, String(stars))
    await page.screenshot({ path: `${SHOTS}/mouse-timer-full.png` })
    await page.clock.runFor(1000)
    await page.locator('.mouse-up').click({ force: true })
    await page.clock.runFor(300)
    check(
      "mouse timer: a tap on Time's up puts the apples back",
      (await page.locator('.mouse-up').count()) === 0 && (await time()) === '5:00' && (await apples()).whole === 4,
    )
    check('mouse timer: no errors', page.errors.length === 0, page.errors[0] ?? '')
    // The gear's choices, and "How long?", fit the face at the smallest screen, in every theme.
    let worst = ''
    for (const theme of THEMES)
      for (const size of [
        [1024, 500],
        [1280, 559],
        [1920, 1080],
      ]) {
        const p = await open({
          state: stateOf(cls),
          theme,
          size,
          storage: { 'seating-chart-timer-settings-v1': { face: 'mouse', seconds: 600 } },
        })
        await panelButton(p, 'Timer').click()
        await p.waitForTimeout(800)
        await p.locator('.mouse-scene').click()
        await p.waitForTimeout(800)
        const pick = await p.evaluate(() => {
          if (!document.querySelector('.mouse-pick')) return 'not open'
          const f = document.querySelector('.mouse-face').getBoundingClientRect()
          return [...document.querySelectorAll('.mouse-pick button, .mouse-pick-title')].every((b) => {
            const r = b.getBoundingClientRect()
            return r.top >= f.top - 1 && r.bottom <= f.bottom + 1 && r.left >= f.left - 1 && r.right <= f.right + 1
          })
        })
        if (pick === true)
          await p
            .locator('.mouse-pick-title')
            .click({ timeout: 3000 })
            .catch((e) => (worst += ` ${theme} ${size.join('x')} close: ${e.message.split('\n')[0]}`))
        await p.waitForTimeout(800)
        await p.locator('[data-timer-card]').getByRole('button', { name: 'Timer settings' }).click()
        await p.waitForTimeout(400)
        const gear = await p.evaluate(() => {
          const c = document.querySelector('.timer-choices')
          const card = document.querySelector('[data-timer-card]').getBoundingClientRect()
          const inside = [...c.querySelectorAll('button')].every((b) => {
            const r = b.getBoundingClientRect()
            return r.right <= card.right + 1 && r.bottom <= card.bottom + 1 && b.scrollWidth <= b.clientWidth + 1
          })
          return inside && c.scrollHeight <= c.clientHeight + 1 && card.bottom <= innerHeight + 1
        })
        if (pick !== true || !gear) worst += ` ${theme} ${size.join('x')} pick:${pick} gear:${gear}`
        if (theme === 'comic' && size[0] === 1024) await p.screenshot({ path: `${SHOTS}/mouse-timer-gear-1024.png` })
        await p.context().close()
      }
    check('mouse timer: "How long?" and the gear fit the face, every theme, 1024x500 up', !worst, worst)
    return page
  },

  /**
   * Saved lines (2026-10-16): "Start the Line" with four saved lines and the editor with six steps
   * fit every screen with nothing to scroll, in the theme with the biggest letters too, and a step's
   * name of 12 letters fits a desk whole in a class of 35.
   */
  async 'saved lines fit'() {
    let page
    const long = 'Proofreading'
    for (const theme of ['vibrant', 'comic', 'dark']) {
      for (const size of [
        [1024, 500],
        [1280, 559],
        [1920, 1080],
      ]) {
        // Every homeroom number up, which the Line's marks once pushed off the desk (2026-10-18).
        const cls = makeClass('c1', 'Writing', 35, { pointsGoal: 50, goalEnabled: true, pointsMode: 'goal', showAllHomerooms: true })
        cls.savedLines = [1, 2, 3, 4].map((n) => ({
          id: `l${n}`,
          name: `Wwwwwwwwwwwwwwwwwww${n}`,
          steps: Array(6).fill(long),
          checks: { 'c1-s0': 1 },
        }))
        cls.lineSavedAs = 'l1'
        if (page) await page.close()
        page = await open({ state: stateOf(cls), size, theme })
        const tag = `${theme} ${size.join('x')}`
        await panelButton(page, 'Line').click()
        await page.waitForTimeout(900)
        const fits = () =>
          page.evaluate(() => {
            const d = document.querySelector('[role=dialog]')
            if (!d) return 'no window'
            const r = d.getBoundingClientRect()
            const body = d.querySelector('[data-slot=dialog-body]') ?? d
            return r.top >= 0 && r.bottom <= innerHeight && body.scrollHeight <= body.clientHeight + 1
              ? 'ok'
              : `${r.top},${r.bottom},${body.scrollHeight},${body.clientHeight}`
          })
        let f = await fits()
        check(`saved lines: Start the Line fits, ${tag}`, f === 'ok', f)
        await page.locator('[data-saved-line]').first().click()
        await page.waitForTimeout(500)
        const name = desk(page, 'Amy').locator('[data-line-step-name]')
        check(
          `saved lines: a 12-letter step fits the desk, ${tag}`,
          (await name.count()) === 1 && (await name.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)),
        )
        const homeroomOff = await page.evaluate(() =>
          [...document.querySelectorAll('[data-ink="homeroom"]')]
            .filter((h) => {
              const d = h.closest('button')?.getBoundingClientRect()
              const r = h.getBoundingClientRect()
              return d && r.bottom > d.bottom + 1
            })
            .map((h) => h.textContent),
        )
        check(`saved lines: every homeroom number stays on its desk, ${tag}`, homeroomOff.length === 0, homeroomOff.join(','))
        // A line tall enough for the tails of g, y and p: the name is cut at its box's edge.
        const lh = await name.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) / parseFloat(getComputedStyle(e).fontSize))
        check(`saved lines: room for the tails of letters, ${tag}`, lh >= 1.4, String(lh))
        await page.screenshot({ path: `${SHOTS}/saved-lines-desks-${theme}-${size[0]}.png` })
        await page.locator('[data-line-steps-button]').click()
        await page.waitForTimeout(900)
        await page.locator('[data-edit-line]').first().click()
        await page.waitForTimeout(900)
        f = await fits()
        check(`saved lines: the editor with six steps fits, ${tag}`, f === 'ok', f)
        if (size[0] === 1024) await page.screenshot({ path: `${SHOTS}/saved-lines-editor-${theme}.png` })
      }
    }
    return page
  },

  /**
   * The Line (2026-10-15): a child taps their desk to wait their turn to be checked; the one with
   * the teacher keeps number 1; Done puts Done on their desk and calls the next; Skip, out of line,
   * Clear Line; the board's double touches; and the line kept through a refresh.
   */
  async 'the line'() {
    const cls = makeClass('c1', 'Writing', 20, { pointsGoal: 50, classPoints: 10, goalEnabled: true, pointsMode: 'goal' })
    cls.attendance = { [new Date().toLocaleDateString('en-CA')]: ['c1-s5'] }
    const page = await open({ state: stateOf(cls), size: [1280, 559] })
    const line = async () => (await activeSaved(page)).line
    const mark = (n) => desk(page, n).locator('[data-line-mark]')
    const tap = async (n) => {
      await desk(page, n).click()
      await page.waitForTimeout(750)
    }
    await panelButton(page, 'Line').click()
    await page.waitForTimeout(400)
    check('line: a class with no lines opens on New Line', await page.getByText('New Line').first().isVisible())
    await page.waitForTimeout(500)
    // With no lines yet it opens on New Line: a name, and three steps, unnamed.
    await page.locator('#line-name').fill('Test')
    await page.getByRole('button', { name: 'Save and Start' }).click()
    await page.waitForTimeout(500)
    check(
      'line: the column and "Tap your desk to get in line."',
      (await page.locator('[data-line-panel]').count()) === 1 && (await page.getByText('Tap your desk to get in line.').count()) === 1,
    )
    for (const n of ['Amy', 'Tony', 'Kevin', 'Mulan']) await tap(n)
    await tap('Cindy') // away today
    let l = await line()
    check(
      'line: the first goes to the teacher, the rest wait in order, an absent desk does nothing',
      l.now === 'c1-s0' && l.waiting.join() === 'c1-s1,c1-s2,c1-s3',
      JSON.stringify(l),
    )
    check(
      'line: the one with the teacher is 1, ringed, and the next is 2',
      (await mark('Amy').innerText()) === '1' &&
        (await desk(page, 'Amy').evaluate((e) => e.classList.contains('desk-called'))) &&
        (await mark('Tony').innerText()) === '2' &&
        (await mark('Mulan').innerText()) === '4',
    )
    // The board's double touch on a desk that just joined asks nothing.
    await desk(page, 'Brian').click()
    await page.waitForTimeout(120)
    await desk(page, 'Brian').click()
    await page.waitForTimeout(800)
    check(
      'line: a double touch joins once and asks nothing',
      (await page.getByRole('dialog').count()) === 0 && (await line()).waiting.at(-1) === 'c1-s4',
    )
    // Tony taps again: "get out of line?"
    await desk(page, 'Tony').click()
    await page.waitForTimeout(300)
    check('line: a desk in line tapped again asks', await page.getByText('Tony, get out of line?').isVisible())
    await page.getByRole('button', { name: 'Get out' }).click()
    await page.waitForTimeout(100)
    check('line: Get out ignores the touch that opened it', (await line()).waiting.includes('c1-s1'))
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: 'Get out' }).click()
    await page.waitForTimeout(800)
    check('line: Get out takes him out, not done', !(await line()).waiting.includes('c1-s1') && !(await line()).checks?.['c1-s1'])
    // The one with the teacher (the green 1) can tap their desk to get out of line too.
    await tap('Amy')
    check('line: the one with the teacher tapped asks too', await page.getByText('Amy, get out of line?').isVisible())
    await page.getByRole('button', { name: 'Stay in line' }).click()
    await page.waitForTimeout(800)
    check('line: Stay in line keeps her with the teacher', (await line()).now === 'c1-s0')
    // The star for the one with the teacher, then Done.
    const before = (await activeSaved(page)).classPoints
    await page.locator('[data-line-panel] [aria-label="Give a Star"]').click()
    await page.waitForTimeout(1500)
    check('line: the star goes to the class goal', (await activeSaved(page)).classPoints === before + 1)
    const done = page.locator('[data-line-panel] button', { hasText: /^Step 1 Done$/ })
    await done.click()
    await page.waitForTimeout(100)
    await page.locator('[data-line-panel] button', { hasText: /Done$/ }).last().click() // the board's second touch
    await page.waitForTimeout(900)
    l = await line()
    check('line: Step 1 Done once, through a double touch, calls the next', l.now === 'c1-s2' && l.checks['c1-s0'] === 1, JSON.stringify(l))
    check(
      'line: one dot of three on her desk, no number',
      (await desk(page, 'Amy').locator('[data-line-steps="1"]').count()) === 1 && (await mark('Amy').count()) === 0,
    )
    // Change Steps: two taps take her through step 2 to Done, a third back to none, a fourth to step 1.
    const change = page.locator('[data-line-panel] button', { hasText: 'Change Steps' })
    await change.click()
    await page.waitForTimeout(300)
    check(
      "line: Change Steps shows every desk's steps",
      (await page.locator('[data-line-steps]').count()) > 10 && (await page.getByText('Tap a desk to change its step.').count()) === 1,
    )
    await tap('Amy')
    await tap('Amy')
    check(
      'line: Change Steps to Done, the picture in place of hers',
      (await line()).checks['c1-s0'] === 3 && (await desk(page, 'Amy').locator('[data-done-mark]').count()) === 1,
    )
    await tap('Amy')
    await tap('Amy')
    check('line: and round through none to step 1', (await line()).checks['c1-s0'] === 1)
    await change.click()
    await page.waitForTimeout(300)
    await page.locator('[data-line-panel] button', { hasText: /^Skip$/ }).click()
    await page.waitForTimeout(900)
    l = await line()
    check('line: Skip to the back of the line', l.now === 'c1-s3' && l.waiting.at(-1) === 'c1-s2', JSON.stringify(l))
    await tap('Amy')
    check('line: a checked desk tapped joins again', (await line()).waiting.at(-1) === 'c1-s0' && (await mark('Amy').count()) === 1)
    // The speaker by "In line": no sound for the class, kept with it.
    await page.locator('[data-line-panel] [data-get-ready-sound]').click()
    await page.waitForTimeout(300)
    check('line: the speaker turns its sounds off for the class', (await activeSaved(page)).lineSilent === true)
    await refresh(page)
    check(
      'line: kept through a refresh, the screen closed',
      (await line()).now === 'c1-s3' && (await page.locator('[data-line-panel]').count()) === 0,
    )
    await panelButton(page, 'Line').click()
    await page.waitForTimeout(400)
    check('line: reopened mid-activity, no question', (await page.getByText('Start the Line').count()) === 0)
    await page.locator('[data-line-panel] button', { hasText: 'Clear Line' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Clear Line' }).click()
    await page.waitForTimeout(500)
    l = await line()
    check('line: Clear Line empties it and takes Done off', l.now === null && l.waiting.length === 0 && Object.keys(l.checks).length === 0)

    // Saved lines (2026-10-16): named, with named steps, kept from lesson to lesson.
    check('line: the desks show names only while the Line is open', (await page.locator('[data-ink=desk] img').count()) === 0)
    await page.locator('[data-line-steps-button]').click()
    await page.waitForTimeout(800)
    check("line: no quick line, only the class's lines", (await page.locator('[data-steps-choice]').count()) === 0)
    await page.locator('[data-new-line]').click()
    await page.waitForTimeout(800)
    await page.locator('#line-name').fill('Writing')
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'One step more' }).click()
    const stepNames = ['prewriting', 'sentences', 'paragraphs', 'publishing', 'illustrating']
    for (let i = 0; i < 5; i++) await page.locator(`[data-step-name="${i + 1}"]`).fill(stepNames[i])
    check('line: a step name is held to 12 letters', (await page.locator('[data-step-name="1"]').getAttribute('maxlength')) === '12')
    await page.screenshot({ path: `${SHOTS}/line-new-line.png` })
    await page.getByRole('button', { name: 'Save and Start' }).click()
    await page.waitForTimeout(600)
    let kept = await activeSaved(page)
    const writing = kept.savedLines?.find((l) => l.name === 'Writing')
    check(
      'line: Save and Start keeps the line and starts it',
      kept.savedLines?.length === 2 && kept.lineSavedAs === writing?.id && writing.steps.join() === stepNames.join(),
      JSON.stringify(kept.savedLines),
    )
    check('line: the column names it', (await page.locator('[data-line-steps-button]').innerText()).includes('Writing'))
    check(
      'line: named steps show on every desk from the start, beside the dots',
      (await desk(page, 'Leo').locator('[data-line-steps] [data-line-step-name]').innerText()) === 'prewriting',
    )
    await tap('Amy')
    check(
      'line: Done says the step by its name',
      (await page.locator('[data-line-panel] button', { hasText: /Done$/ }).last().innerText()).includes('prewriting'),
    )
    await page.locator('[data-line-panel] button', { hasText: /Done$/ }).last().click()
    await page.waitForTimeout(900)
    check(
      'line: the desk shows the step they are on, the dot before it green and its own amber',
      (await desk(page, 'Amy').locator('[data-line-step-name]').innerText()) === 'sentences' &&
        (await desk(page, 'Amy')
          .locator('[data-step-dot]')
          .evaluateAll((d) => d.map((e) => e.dataset.stepDot).join())) === 'done,now,ahead,ahead,ahead',
    )
    await tap('Amy')
    await tap('Leo')
    check(
      'line: in line, the number and the steps both show',
      (await desk(page, 'Amy').locator('[data-line-mark="1"]').count()) === 1 &&
        (await desk(page, 'Amy').locator('[data-line-step-name]').innerText()) === 'sentences' &&
        (await desk(page, 'Leo').locator('[data-line-mark="2"]').count()) === 1 &&
        (await desk(page, 'Leo').locator('[data-line-steps]').count()) === 1,
    )
    await page.screenshot({ path: `${SHOTS}/line-named-steps.png` })
    // Another line, then back to Writing: its steps were kept.
    await page.locator('[data-line-steps-button]').click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${SHOTS}/line-start-window.png` })
    await page.locator('[data-saved-line="Test"]').click()
    await page.waitForTimeout(500)
    check('line: another line has its own steps', (await desk(page, 'Amy').locator('[data-line-step-name]').count()) === 0)
    await page.locator('[data-line-steps-button]').click()
    await page.waitForTimeout(800)
    await page.locator('[data-saved-line="Writing"]').click()
    await page.waitForTimeout(500)
    check(
      'line: back to Writing, everyone where they were',
      (await desk(page, 'Amy').locator('[data-line-steps]').getAttribute('data-line-steps')) === '1',
    )
    // Edit it, then delete it, from the list.
    await page.locator('[data-line-steps-button]').click()
    await page.waitForTimeout(800)
    await page.locator('[data-edit-line="Writing"]').click()
    await page.waitForTimeout(800)
    await page.locator('#line-name').fill('Story')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForTimeout(800)
    check(
      'line: renamed',
      (await activeSaved(page)).savedLines?.some((l) => l.name === 'Story'),
    )
    await page.locator('[data-delete-line="Story"]').click()
    await page.locator('[data-confirm-delete-line="Story"]').click()
    await page.waitForTimeout(400)
    kept = await activeSaved(page)
    check('line: deleted, the Line carrying on with its steps', kept.savedLines.length === 1 && !kept.lineSavedAs && kept.lineSteps === 5)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    return page
  },

  async 'nothing scrolls'() {
    for (const theme of process.env.THEME ? [process.env.THEME] : THEMES) {
      for (const size of SCROLL_SIZES) {
        // Stars on the desks: the fuller board (a minus and All Stars In! on the panel, Float in its top row,
        // a star chip on desks) is the one that has to fit.
        const cls = makeClass('c1', 'Grade 4 English', 30, { pointsGoal: 50, classPoints: 20, starsOnDesks: true })
        cls.students.forEach((st, i) => (st.points = i % 3 === 0 ? 12 : 0))
        const page = await open({ state: stateOf(cls, makeClass('c2', 'Kindergarten Phonics', 3)), theme, size })
        const where = `${theme} ${size.join('x')}`
        const bad = []
        const look = async (label) => {
          const o = await overflow(page)
          // The timer controls and the class list open over the panel now, so there is no
          // accepted exception left: the panel fits itself to the screen (useFitToHeight).
          if (o.page > 0 || o.pageX > 0 || o.rootX > 0 || o.panel > 0 || o.dialog > 0 || o.timer > 0 || o.section > 0 || o.line > 0) {
            bad.push(`${label} ${JSON.stringify(o)}`)
            await page.screenshot({ path: `${SHOTS}/scroll-${theme}-${size[0]}-${label.replace(/\W+/g, '-')}.png` })
          }
          // And no button on the panel has words running past its edge ("Pick a Random Student").
          const spill = await page.evaluate(() =>
            [...document.querySelectorAll('aside button')]
              .filter((b) => b.offsetParent && b.scrollWidth > b.clientWidth + 1)
              .map((b) => `${b.textContent.trim() || b.title} (${b.scrollWidth - b.clientWidth}px)`),
          )
          if (spill.length) bad.push(`${label}: cut off ${spill.join(' | ')}`)
        }
        await look('board')
        await desk(page, 'Amy').click()
        await look('one selected')
        // The timer, big over the board, its choices, and put away in the bar.
        await panelButton(page, 'Timer').click()
        await page.waitForTimeout(500)
        await look('timer')
        await page.waitForTimeout(800) // past the timer's double-touch guard
        await page.locator('[data-timer-card] button[aria-label="Timer settings"]').click()
        await page.waitForTimeout(500)
        await look('timer choices')
        await page.waitForTimeout(800)
        // The choices' X closes them, leaving the clock (2026-10-21); then away into the bar.
        await page.locator('[data-timer-card] button.timer-done').click()
        await page.waitForTimeout(800)
        await page.locator('[data-timer-card] button[aria-label="Put the timer away"]').click()
        await page.waitForTimeout(500)
        await look('timer in the bar')
        await page.locator('button[title="Switch class"]').click()
        await page.waitForTimeout(400)
        await look('class list')
        await page.mouse.click(size[0] / 2, size[1] / 2)
        await page.waitForTimeout(400)
        await panelButton(page, 'Flip Cards').click()
        await page.waitForTimeout(2500)
        await look('flip cards')
        await panelButton(page, 'Flip Cards').click()
        await page.waitForTimeout(800)
        await panelButton(page, 'Group Activity').click()
        await page.waitForTimeout(600)
        await look('group modal')
        await page.getByRole('dialog').getByRole('button', { name: /^6/ }).first().click()
        await page.waitForTimeout(800)
        await look('group modal: who fills them')
        await page
          .getByRole('dialog')
          .getByRole('button', { name: /I'll choose/ })
          .click()
        await page.waitForTimeout(500)
        const cut = await page.evaluate(() =>
          [...document.querySelectorAll('[data-group-builder] [data-frame-body], [data-group-builder] [data-student-id]')].some(
            (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
          ),
        )
        if (cut) bad.push(`I'll choose: a name or a frame is cut off`)
        await look("I'll choose")
        await page.locator('[data-group-builder] button', { hasText: 'Cancel' }).click()
        await page.waitForTimeout(400)
        await panelButton(page, 'Group Activity').click()
        await page.waitForTimeout(600)
        await makeThem(page, /^6/)
        await page.waitForTimeout(4500)
        await look('6 groups')
        await page.locator('button', { hasText: 'Exit Group Activity' }).first().click()
        await page.waitForTimeout(800)
        // The Line with a long queue and a Done desk: the desks make room for its column.
        await panelButton(page, 'Line').click()
        await page.waitForTimeout(400)
        await look('how many steps')
        await page.waitForTimeout(400)
        await page.locator('#line-name').fill('Writing')
        for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'One step more' }).click()
        await page.getByRole('button', { name: 'Save and Start' }).click()
        await page.waitForTimeout(400)
        for (const n of NAMES.slice(0, 14)) {
          await desk(page, n).click()
          await page.waitForTimeout(720)
        }
        await page.locator('[data-line-panel] button', { hasText: /Done$/ }).last().click()
        await page.waitForTimeout(900)
        const offScreen = await page.evaluate(() =>
          [...document.querySelectorAll('[data-line-panel] button')].some((b) => {
            const r = b.getBoundingClientRect()
            return r.bottom > innerHeight || r.right > innerWidth || r.top < 0
          }),
        )
        if (offScreen) bad.push('the Line: a button off the screen')
        await look('the line')
        await panelButton(page, 'Line').click()
        await page.waitForTimeout(800)
        await page.locator('button[aria-label="Class Settings"]').click()
        await page.waitForTimeout(600)
        // Every section of Class Settings, all of it inside the window.
        for (const section of ['class', 'students', 'avatars', 'points', 'tools', 'attendance', 'participation', 'google']) {
          await page.locator(`[data-section-link="${section}"]`).click()
          await page.waitForTimeout(250)
          await look(`settings ${section}`)
        }
        // Avatars with photos on: the Photos row in place of Let Students Choose, and the caution.
        await page.locator('[data-section-link="avatars"]').click()
        await page.locator('[data-guide="desk-pictures"] button', { hasText: 'Photos' }).click()
        await page.waitForTimeout(300)
        await look('photos caution')
        await page.getByRole('button', { name: "I've checked, go on" }).click()
        await page.waitForTimeout(300)
        await look('settings avatars with photos')
        await page.locator('[data-section-link="points"]').click()
        await page.locator('[data-guide="celebration-row"] button').click()
        await page.waitForTimeout(300)
        await look('settings celebration')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(600)
        check(`nothing scrolls: ${where}`, bad.length === 0 && page.errors.length === 0, [...bad, ...page.errors].join('; '))
        await page.context().close()
      }
    }
  },
}

for (const [name, run] of Object.entries(scenarios)) {
  if (only && !name.includes(only)) continue
  try {
    const page = await run()
    if (page) {
      if (page.errors.length) check(`${name}: no page errors`, false, page.errors.join('; '))
      await page.context().close()
    }
  } catch (e) {
    const shot = `${SHOTS}/script-failed-${name.replace(/\W+/g, '-')}.png`
    await lastPage?.screenshot({ path: shot }).catch(() => {})
    check(name, false, `the script itself failed (${shot}): ${e.message.split('\n').slice(0, 3).join(' | ')}`)
  }
}
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} OK, ${failed.length} FAIL. Screenshots in ${SHOTS}`)
if (existsSync(SHOTS)) process.exitCode = failed.length ? 1 : 0
