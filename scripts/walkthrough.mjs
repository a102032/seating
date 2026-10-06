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

const THEMES = ['light', 'dark', 'chalkboard', 'vibrant', 'comic']
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
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && page.errors.push(m.text()))
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
    }
  })
}

const scenarios = {
  /** Stars given with the class goal switched off shouldn't be filling a meter nobody can see. */
  async 'goal off: stars leave the meter alone'() {
    const cls = makeClass('c1', 'Goal Off', 5, { pointsGoal: 50, classPoints: 0, goalEnabled: false })
    const page = await open({ state: stateOf(cls) })
    for (let i = 0; i < 3; i++) {
      await desk(page, 'Amy').click()
      await award(page)
      await page.waitForTimeout(250)
    }
    const c = await activeSaved(page)
    check(
      'goal off: stars leave the meter alone',
      (c.classPoints ?? 0) === 0,
      `Amy has ${c.students[0].points} stars, meter holds ${c.classPoints}`,
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
    await page.locator('aside button[title="Pickers & Points settings"]').click()
    await page.waitForTimeout(500)
    await page.locator('#goal').fill('30')
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
    await page.locator('aside button[title="Pickers & Points settings"]').click()
    await page.waitForTimeout(500)
    const plus = page.locator('button[aria-label="Increase Class points on the meter now"]')
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
        'choosing a timer face',
        async (page) => {
          await page.locator('aside [aria-label="Timer controls"]').click()
          await page.waitForTimeout(400)
          await page.locator('aside button[title="Timer settings"]').click()
          await page.waitForTimeout(500)
          await page.getByRole('button', { name: /Dial/ }).first().click()
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
    await page.getByRole('button', { name: /^2/ }).first().click()
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
    await page.waitForTimeout(400)
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
      await panelButton(page, 'Pick Student').click()
      await page.waitForTimeout(3200)
      landed.add(await page.evaluate(() => document.querySelector('[data-ink=desk].desk-picked')?.textContent ?? ''))
      await page.mouse.click(5, 5)
    }
    const pickedAway = [...landed].filter((t) => /Amy|Tony|Kevin/.test(t))
    check('absent students are never picked', landed.size > 0 && pickedAway.length === 0, `landed on ${[...landed].join(', ')}`)
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
      await panelButton(page, 'Pick Student').click()
      await page.waitForTimeout(2600)
      await desk(page, 'Amy').click()
      if (i === 0) {
        await page.reload()
        await page.locator('.splash-board button').first().click()
        await page.waitForTimeout(800)
      }
    }
    for (let i = 0; i < 3; i++) {
      await panelButton(page, 'Pick Student').click()
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
    await page.locator('aside button[title="Pickers & Points settings"]').click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Start a New Round' }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    c = await activeSaved(page)
    check('participation: Start a New Round keeps the record', !c.pickRound && Object.keys(c.participation[today]).length === 6)
    await page.getByTitle('Class Settings').click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Participation' }).click()
    await page.waitForTimeout(600)
    const report = await page.getByRole('dialog').last().innerText()
    check(
      'participation: the report lists the class',
      /Amy/.test(report) && /Tony/.test(report) && /Everyone here was picked/.test(report),
      report.slice(0, 80),
    )
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
    await page.locator('aside button[title="Pickers & Points settings"]').click()
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
    await page.reload()
    await page.locator('.splash-board button').first().click()
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
      await panelButton(page, 'Pick Student').click()
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
    await page.locator('[data-drum="10"]').click()
    const star = page.locator('[data-get-ready] button[aria-label="Start"]')
    await star.click({ force: true }) // the drum tap's second touch, where the star appears
    await page.waitForTimeout(800)
    check('Get Ready!: the star waits for its own tap', await page.getByText('Tap the star to start').isVisible())
    await star.click()
    await page.waitForTimeout(7200) // five seconds full, then two beats smaller on the 10-second drum
    await page.getByRole('button', { name: 'Ready!', exact: true }).click()
    await page.waitForTimeout(2200)
    let c = await activeSaved(page)
    check(
      'Get Ready!: Ready! two beats into the shrinking sends 3 of 5 to the goal, desks untouched',
      c.classPoints === 13 && c.students[0].points === 2 && /You earned 3 stars!/.test(await page.locator('[data-get-ready]').innerText()),
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
      await page.locator('[data-drum="10"]').click()
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
    await page.locator('[data-drum="10"]').click()
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
    check('long press: none on the side panel', !(await menuOpens(panelButton(page, 'Pick Student'))))
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(600)
    await page.getByRole('tab', { name: 'Class', exact: true }).click()
    await page.waitForTimeout(300)
    check('long press: a text box keeps its menu, for pasting', await menuOpens(page.locator('#class-name')))
    check("long press: none on a window's buttons", !(await menuOpens(page.getByRole('tab', { name: 'Students' }))))
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
      'float Get Ready!: the window grows to a snug rectangle of drums',
      Boolean(drums) && drums[0] > 600 && drums[1] < 300,
      JSON.stringify(drums),
    )
    check("float Get Ready!: the side panel's stands down meanwhile", await panelButton(page, 'Get Ready!').isDisabled())
    await win.setViewportSize({ width: drums[0], height: drums[1] })
    await win.waitForTimeout(800)
    const speaker = win.locator('[data-get-ready-sound]')
    await speaker.click()
    await win.waitForTimeout(300)
    check(
      'float Get Ready!: the speaker on the drums turns the class silent',
      (await speaker.getAttribute('data-get-ready-sound')) === 'off' && (await activeSaved(page)).getReadySilent === true,
    )
    await page.evaluate(() => (window.__sounds = []))
    await win.locator('[data-drum="10"]').click()
    await win.waitForTimeout(150)
    const star = (await win.evaluate(() => window.__resizes))[1]
    check('float Get Ready!: a drum grows the window for the star', Boolean(star) && star[1] >= 480, JSON.stringify(star))
    await win.setViewportSize({ width: star[0], height: star[1] })
    await win.waitForTimeout(900)
    check(
      'float Get Ready!: no meter over the star, and a chest to fly to',
      (await win.locator('[data-float-coin]').count()) === 1 && (await win.locator('[data-ink=panel]').count()) === 0,
    )
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

  /** Tiny, empty and full classes through every screen, looking for errors. */
  async 'edge classes'() {
    for (const count of [0, 1, 2, 35]) {
      // A goal the class can't fill here: Pick All + gives the whole class a star, and a filled
      // goal's celebration would cover the panel (it used to give only the picked row one).
      const cls = makeClass('c1', `Edge ${count}`, count, { pointsGoal: 100, classPoints: 0 })
      // A second class, so the splash offers class cards rather than first-time setup.
      const page = await open({ state: stateOf(cls, makeClass('c2', 'Other', 2)), size: [1024, 640] })
      if (count > 0) {
        await panelButton(page, 'Pick Student').click()
        await page.waitForTimeout(3200)
        await page.mouse.click(5, 5)
        await panelButton(page, 'Pick Row').click()
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
        await page.getByRole('button', { name: /^Pairs/ }).click()
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
    await page.getByRole('button', { name: /^3/ }).first().click()
    await page.waitForTimeout(4500)
    await page.locator('[data-group-id] button[title="Give a point"]').first().click()
    await page.reload()
    await page.locator('.splash-board button').first().click()
    await page.waitForTimeout(900)
    await panelButton(page, 'Group Activity').click()
    await page.waitForTimeout(600)
    const cont = await page.getByRole('button', { name: /Continue with Last Groups/ }).textContent()
    check('reload mid-activity: last groups kept, with their point', /3 groups/.test(cont) && /1/.test(cont), cont.replace(/\s+/g, ' '))
    await page.keyboard.press('Escape')
    await page.locator('aside [aria-label="Timer controls"]').click()
    await page.waitForTimeout(400)
    await page.locator('aside').locator('text=MIN').locator('..').locator('button').nth(1).click()
    await page.locator('aside button[title="Start"]').click()
    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.splash-board button').first().click()
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
    await page.locator('aside').getByRole('button', { name: 'Class B' }).click()
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
      await page.getByRole('dialog').getByRole('button', { name }).first().click()
      await page.waitForTimeout(5000)
    }
    await deal(/^4s/)
    let groups = await made()
    const together = (g) =>
      g.every((d) => g.some((e) => e !== d && Math.abs((e % 6) - (d % 6)) <= 1 && Math.abs(Math.floor(e / 6) - Math.floor(d / 6)) <= 1))
    check('by seats: fours are squares, everyone beside their group', groups.length === 7 && groups.every(together), JSON.stringify(groups))
    await deal(/^6/)
    groups = await made()
    check(
      'by seats: six groups are the six rows',
      groups.length === 6 && groups.every((g) => g.every((d) => d % 6 === g[0] % 6)),
      JSON.stringify(groups),
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
    await page.getByRole('button', { name: /^6/ }).first().click()
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
    check('mix up seats: the window closes on the new plan', (await page.locator('[role=dialog]').count()) === 0)
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
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(500)
    await page.locator('#avatars-on').click()
    await page.waitForTimeout(300)
    let c = await activeSaved(page)
    check(
      "no avatar: the switch turns the class's avatars off, every pick kept",
      c.avatarsOff === true && c.students[0].avatarId === 'frog/superhero',
    )
    await page.getByRole('button', { name: /Student Avatars/ }).click()
    await page.waitForTimeout(500)
    check(
      'no avatar: Student Avatars offers no No Avatar',
      !(await page.getByRole('dialog').filter({ hasText: 'Tap a character' }).innerText()).includes('No Avatar'),
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    // Measured before anyone joins: an unseated newcomer brings up the "not seated" bar, which
    // makes the desks, and so the names, a little smaller.
    const alone = await nameSize()
    check('no avatar: a class with no pictures gets bigger names', alone > besidePictures * 1.15, `${besidePictures}px -> ${alone}px`)
    // A newcomer to a class of names shows by name like everyone else, with nothing to undo later.
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(500)
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
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(500)
    await page.locator('#avatars-on').click()
    await page.waitForTimeout(300)
    // One student's family would rather not: No Avatar in their own picker.
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
    await page.locator('button[aria-label="Class Settings"]').click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Students Choose' }).click()
    await page.waitForTimeout(500)
    check('choose: the board says what to do', await page.getByText('Tap your desk. Choose your avatar!').isVisible())
    check('choose: the side panel stands down', await panelButton(page, 'Pick Student').isDisabled())
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
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.waitForTimeout(400)
    check(
      'choose: Done ends it',
      !(await page.getByText('Tap your desk. Choose your avatar!').isVisible()) && (await panelButton(page, 'Pick Student').isEnabled()),
    )
    return page
  },

  /**
   * The guided first setup: a teacher with no students yet taps New Class on the splash and is
   * walked through it, each bubble on the screen at the floor size; doing the thing moves it on,
   * and finishing is remembered, so the next class starts without it.
   */
  async 'guided first setup'() {
    const page = await open({ state: stateOf(makeClass('c1', 'Class 1', 0)), size: [1024, 500], splash: false })
    await page.locator('.splash-board button', { hasText: 'New Class' }).click()
    await page.waitForTimeout(1200)
    const bubble = page.locator('[data-guide-bubble]')
    const title = async () => ((await bubble.count()) ? bubble.locator('p.text-lg').innerText() : '')
    const onScreen = () =>
      bubble.evaluate((b) => {
        const r = b.getBoundingClientRect()
        return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5
      })
    const next = async () => {
      await page.locator('[data-guide-next]').click()
      await page.waitForTimeout(800)
    }
    check('guide: New Class starts it, on the class name', (await title()) === 'Name your class' && (await onScreen()))
    await page.locator('#class-name').fill('4B English')
    await next()
    check('guide: then the room', (await title()) === 'Pick your room' && (await onScreen()))
    await next()
    check('guide: then the students', (await title()) === 'Add your students' && (await onScreen()))
    await page.evaluate((text) => {
      const data = new DataTransfer()
      data.setData('text/plain', text)
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
    }, 'Amy\t401\nTony\t402\nKevin\t403')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Add 3 Students' }).click()
    await page.waitForTimeout(900)
    check('guide: a list in moves it on to avatars', (await title()) === 'Avatars' && (await onScreen()))
    await next()
    check('guide: then seats', (await title()) === 'Seat your students' && (await onScreen()))
    await page.locator('[data-guide="seat"]').click()
    await page.waitForTimeout(1200)
    const c = await activeSaved(page)
    check(
      'guide: Seat Students seats them and moves on to the goal, which is on',
      c.seating.filter(Boolean).length === 3 && c.goalEnabled === true && (await title()) === 'The class goal' && (await onScreen()),
    )
    await next()
    check("guide: then You're ready!, over the board", (await title()) === "You're ready!" && (await page.getByRole('tab').count()) === 0)
    const over = await overflow(page)
    check('guide: nothing scrolls', over.page <= 0 && over.panel <= 0, JSON.stringify(over))
    await next()
    check(
      'guide: Done ends it, remembered',
      (await bubble.count()) === 0 &&
        (await page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-guide-v1') || '{}')['walkthrough-teacher'] === true)),
    )
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
      ['tables5-top', '5th desk on top', 'table', 6],
      ['tables5-bottom', '5th desk below', 'table', 6],
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
          await page.locator('button[aria-label="Class Settings"]').click()
          await page.waitForTimeout(500)
          await page.getByRole('tab', { name: 'Class' }).click()
          await page.waitForTimeout(300)
          const o1 = await overflow(page)
          if (o1.page || o1.dialog) bad.push(`${id} settings ${JSON.stringify(o1)}`)
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
          const pickLabel = setName === 'table' ? 'Pick Table' : 'Pick Row'
          await panelButton(page, pickLabel).click()
          await page.waitForTimeout(3200)
          const lit = await page.locator('[data-ink=desk].desk-picked').count()
          if (lit === 0) bad.push(`${id}: ${pickLabel} lit nobody`)
          await page.mouse.click(5, 5)
          await page.waitForTimeout(300)
          await panelButton(page, 'Group Activity').click()
          await page.waitForTimeout(500)
          const split = page.getByRole('button', { name: new RegExp(`^${setName === 'table' ? 'Tables' : 'Rows'}`) })
          const caption = (await split.textContent()) ?? ''
          const groups = Number(caption.match(/(\d+) groups/)?.[1] ?? 0)
          if (groups < 2 || groups > sets + (count > 30 ? 2 : 0)) bad.push(`${id}: split makes "${caption}"`)
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
      await page.locator('button[aria-label="Class Settings"]').click()
      await page.waitForTimeout(500)
      await page.getByRole('tab', { name: 'Class' }).click()
      await page.waitForTimeout(300)
      await page.locator('[role=dialog] button[aria-pressed]', { hasText: label }).first().click()
      await page.waitForTimeout(300)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
    check('room layouts: rows, pairs and rows of 3 move nobody', (await activeSaved(page)).seating.slice(0, 35).join() === before)
    return page
  },

  /** The rule: nothing scrolls, in any theme, at any screen from 1024x500 up. */
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
          if (o.page > 0 || o.pageX > 0 || o.rootX > 0 || o.panel > 0 || o.dialog > 0) {
            bad.push(`${label} ${JSON.stringify(o)}`)
            await page.screenshot({ path: `${SHOTS}/scroll-${theme}-${size[0]}-${label.replace(/\W+/g, '-')}.png` })
          }
        }
        await look('board')
        await desk(page, 'Amy').click()
        await look('one selected')
        await page.locator('aside [aria-label="Timer controls"]').click()
        await page.waitForTimeout(400)
        await look('timer controls')
        await page.waitForTimeout(800) // past the timer's double-touch guard
        await page.locator('aside [aria-label="Timer controls"]').click({ position: { x: 10, y: 10 } })
        await page.waitForTimeout(700)
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
        await page.getByRole('button', { name: /^6/ }).first().click()
        await page.waitForTimeout(4500)
        await look('6 groups')
        await page.locator('button', { hasText: 'Exit Group Activity' }).first().click()
        await page.waitForTimeout(800)
        await page.locator('button[aria-label="Class Settings"]').click()
        await page.waitForTimeout(600)
        await look('settings students')
        await page.getByRole('tab', { name: 'Class' }).click()
        await page.waitForTimeout(400)
        await look('settings class')
        await page.getByRole('tab', { name: 'Students' }).click()
        await page.getByRole('button', { name: /View \/ Edit Attendance/ }).click()
        await page.waitForTimeout(600)
        await look('attendance record')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(600)
        await page.locator('aside button[title="Pickers & Points settings"]').click()
        await page.waitForTimeout(600)
        await look('pickers and points')
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
