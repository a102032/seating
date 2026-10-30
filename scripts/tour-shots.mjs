import { createRequire } from 'module'
import { readFileSync, writeFileSync } from 'fs'
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright/index.js')
// The tour's pictures (components/Tour.tsx): each screen of the app at the teacher's board size
// (1280x559), and where every thing a stop lights is in it. Take them again whenever one of those
// screens changes. Serve the app first (npm run dev -- --port 5175), then:
//   URL=http://localhost:5175/seating/ FONTS=<dir> node scripts/tour-shots.mjs
// FONTS serves the real faces from fontsource packages in that dir (as the walkthrough does), since
// Google Fonts may be blocked; without it the pictures have the fallback face.
// Writes public/tour/*.jpg and src/lib/tourRects.json.
const URL = process.env.URL || 'http://localhost:5175/seating/'
const FONT_DIR = process.env.FONTS
const FONTS = FONT_DIR && {
  'andika-400': `${FONT_DIR}/fontsource-andika/files/andika-latin-400-normal.woff2`,
  'andika-700': `${FONT_DIR}/fontsource-andika/files/andika-latin-700-normal.woff2`,
}
const FONT_CSS = FONTS
  ? Object.keys(FONTS)
      .map(
        (k) =>
          `@font-face { font-family: 'Andika'; font-weight: ${k.split('-')[1]}; src: url(https://fonts.gstatic.com/local/${k}) format('woff2'); }`,
      )
      .join('\n')
  : ''
const OUT = new globalThis.URL('../public/tour/', import.meta.url).pathname
const RECTS = new globalThis.URL('../src/lib/tourRects.json', import.meta.url).pathname
const SIZE = [1280, 559]

// A class like the teacher's: 28 students, one away today, a class goal part filled.
const NAMES =
  'Amy Tony Kevin Mulan Brian Cindy Daniel Emma Grace Henry Ivy Jack Leo Sophia Andy Bella Chris Doris Eric Fiona Gary Hannah Ian Judy Kelly Louis Mandy Nick'.split(
    ' ',
  )
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const students = NAMES.map((n, i) => ({ id: `s${i}`, name: n, homeroom: String(501 + (i % 4)), gender: i % 2 ? 'boy' : 'girl', points: 0 }))
const seating = Array(40).fill(null)
students.forEach((s, i) => (seating[i] = s.id))
const today = day(new Date())
const STATE = {
  classes: [
    {
      id: 'c1',
      name: '4B English',
      students,
      seating,
      pointsMode: 'goal',
      pointsGoal: 50,
      classPoints: 18,
      // Groups kept to use again, so the window shows where they are.
      savedGroups: [
        {
          id: 'g1',
          name: 'Writing groups',
          savedAt: new Date().toISOString(),
          madeBy: { kind: 'count', count: 4 },
          groups: [0, 1, 2, 3].map((g) => ({
            name: `Group ${g + 1}`,
            color: ['#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'][g],
            studentIds: students.filter((_, i) => i % 4 === g).map((s) => s.id),
          })),
        },
      ],
      attendance: { [today]: ['s3'] },
      attendanceTaken: [today],
      updatedAt: new Date().toISOString(),
    },
  ],
  activeClassId: 'c1',
}
const TEACHER = { uid: 't1', firstName: 'Derek', email: 'derek@example.com', dirty: [], deleted: [] }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function open(state = STATE) {
  const context = await browser.newContext({ viewport: { width: SIZE[0], height: SIZE[1] } })
  const page = await context.newPage()
  if (FONTS) {
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: FONT_CSS }))
    await page.route('https://fonts.gstatic.com/local/**', (r) =>
      r.fulfill({ contentType: 'font/woff2', body: readFileSync(FONTS[r.request().url().split('/').pop()]) }),
    )
  }
  await page.route(
    (url) => url.pathname.includes('firebase'),
    (r) => r.abort(),
  )
  await page.addInitScript(
    ([s, teacher]) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('seating-chart-state-v1', JSON.stringify(s))
      // The attendance reminder, closed for every class today: each check opens classes for its own reasons.
      localStorage.setItem('seating-chart-attendance-reminder-v1', JSON.stringify({ day: new Date().toLocaleDateString('sv'), ids: ['*'] }))
      localStorage.setItem('seating-chart-account-v1', JSON.stringify(teacher))
      localStorage.setItem('seating-chart-theme-v1', 'vibrant')
      localStorage.setItem('seating-chart-theme-chosen-v1', '1')
      localStorage.setItem('seating-chart-guide-v1', JSON.stringify({ t1: true }))
      localStorage.setItem('seating-chart-tour-offer-v1', 'true')
    },
    [state, TEACHER],
  )
  await page.goto(URL)
  await page.locator('.splash-board button', { hasText: '4B English' }).first().click()
  await page.waitForTimeout(900)
  return page
}

/** Where each thing is: everything a selector finds, as one box [left, top, right, bottom], kept on the screen. */
async function rects(page, map) {
  const out = {}
  for (const [k, sel] of Object.entries(map)) {
    out[k] = await page.evaluate((sel) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0)
      if (!els.length) return null
      const rs = els.map((e) => e.getBoundingClientRect())
      return [
        Math.max(0, Math.round(Math.min(...rs.map((r) => r.left)))),
        Math.max(0, Math.round(Math.min(...rs.map((r) => r.top)))),
        Math.min(innerWidth, Math.round(Math.max(...rs.map((r) => r.right)))),
        Math.min(innerHeight, Math.round(Math.max(...rs.map((r) => r.bottom)))),
      ]
    }, sel)
    if (!out[k]) throw new Error(`nothing found for ${k}: ${sel}`)
  }
  return out
}

/** Marks what has no selector of its own, by its words. */
async function mark(page, marks) {
  await page.evaluate((marks) => {
    for (const [name, re] of marks) {
      const el = [...document.querySelectorAll('button, span')].find((b) => new RegExp(re).test(b.textContent.trim()))
      el?.setAttribute('data-tour-mark', name)
    }
  }, marks)
}

const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 72 })
const all = {}

{
  const page = await open()
  await page.evaluate(() => {
    // The meter is the bar holding the chest; the tab the box holding the gear.
    const chest = document.querySelector('img[src*="chest-closed"]')
    let m = chest
    while (m && m.getBoundingClientRect().width < 600) m = m.parentElement
    m?.setAttribute('data-tour-mark', 'meter')
    document.querySelector('[data-class-tab]')?.setAttribute('data-tour-mark', 'tab')
    document.querySelector('[data-ink="desk"]')?.setAttribute('data-tour-mark', 'desk')
    m?.querySelector('img')?.setAttribute('data-tour-mark', 'start')
  })
  all.board = await rects(page, {
    float: 'aside [aria-label="Float"]',
    getready: 'aside [aria-label="Get Ready!"]',
    timer: 'aside [aria-label="Timer"]',
    attendance: 'aside [aria-label="Attendance"]',
    swap: 'aside [aria-label="Swap Seats"]',
    pickStudent: 'aside [aria-label="Pick a Random Student"]',
    pickRow: 'aside [aria-label="Pick a Random Row"]',
    pickAll: 'aside [aria-label="Pick All"]',
    flip: 'aside [aria-label="Flip Cards"]',
    groups: 'aside [aria-label="Group Activity"]',
    line: 'aside [aria-label="Line"]',
    star: 'aside [aria-label="Award Point"]',
    saved: 'aside [data-sync]',
    fullscreen: 'button[title="Full Screen"]',
    lock: '[data-board-lock]',
    undo: 'button[aria-label="Undo"]',
    side: 'aside button[title^="Move panel"]',
    meter: '[data-tour-mark="meter"]',
    start: '[data-tour-mark="start"]',
    chest: 'img[src*="chest-closed"]',
    tab: '[data-tour-mark="tab"]',
    gear: 'button[aria-label="Class Settings"]',
    desk: '[data-tour-mark="desk"]',
  })
  await shot(page, 'board')

  // Flip Cards, dealt, with one card turned over so the glow shows.
  await page.click('aside [aria-label="Flip Cards"]')
  await page.waitForTimeout(3500)
  await page.evaluate(() => document.querySelectorAll('[data-flip-card]')[8]?.setAttribute('data-tour-mark', 'card'))
  await page.click('[data-tour-mark="card"]')
  await page.waitForTimeout(1500)
  await mark(page, [
    ['left', ' left$'],
    ['shuffle', '^Shuffle$'],
    ['reveal', '^(Reveal All|Hide All)$'],
  ])
  await page.evaluate(() => {
    document.querySelector('[data-tour-mark="card"]')?.closest('.grid')?.setAttribute('data-tour-mark', 'deck')
  })
  all.flip = await rects(page, {
    shuffle: '[data-tour-mark="shuffle"]',
    reveal: '[data-tour-mark="reveal"]',
    pile: '[data-tour-mark="left"]',
    settings: 'button[title="Flip card settings"]',
    exit: 'button[title="Back to the seating chart"]',
    deck: '[data-tour-mark="deck"]',
    card: '[data-tour-mark="card"]',
    star: 'aside [aria-label="Award Point"]',
  })
  // The pile sits in the middle of the toolbar.
  all.flip.pileStack = await page.evaluate(() => {
    const bar = document.querySelector('[data-tour-mark="left"]')?.closest('div.flex')?.parentElement
    const r = bar?.children[1]?.getBoundingClientRect()
    return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] : null
  })
  await shot(page, 'flip')
  await page.click('button[title="Back to the seating chart"]')
  await page.waitForTimeout(1200)

  // Group Activity: the window that chooses, its second question, the names chosen by hand, then the cards.
  await page.click('aside [aria-label="Group Activity"]')
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    for (const l of document.querySelectorAll('[data-slot="dialog-content"] label')) {
      const sec = l.closest('section')
      if (/Saved Groups/.test(l.textContent)) sec?.setAttribute('data-tour-mark', 'saved')
      if (/New Groups/.test(l.textContent)) {
        const grids = sec?.querySelectorAll(':scope > div')
        grids?.[0]?.setAttribute('data-tour-mark', 'count')
        grids?.[1]?.setAttribute('data-tour-mark', 'kinds')
      }
    }
  })
  all.chooser = await rects(page, {
    window: '[data-slot="dialog-content"]',
    saved: '[data-tour-mark="saved"]',
    count: '[data-tour-mark="count"]',
    kinds: '[data-tour-mark="kinds"]',
  })
  await shot(page, 'chooser')
  await page.locator('[data-tour-mark="count"] button').nth(2).click()
  await page.waitForTimeout(900)
  await mark(page, [
    ['make', '^Make them for me'],
    ['choose', "^I'll choose"],
  ])
  all.who = await rects(page, { make: '[data-tour-mark="make"]', choose: '[data-tour-mark="choose"]' })
  await shot(page, 'who')
  await page.locator('[data-tour-mark="choose"]').click()
  await page.waitForTimeout(600)
  // Partway through, as a teacher would be: the first group full, the second lit with two in it.
  const tapIn = async (frame, names) => {
    await page.locator(`[data-frame="${frame}"]`).click({ position: { x: 20, y: 10 } })
    for (const n of names)
      await page
        .locator('[data-group-builder] [data-student-id]', { hasText: new RegExp(`^${n}`) })
        .first()
        .click()
  }
  await tapIn(0, ['Amy', 'Tony', 'Brian', 'Cindy', 'Grace', 'Henry', 'Ivy'])
  await tapIn(1, ['Kevin', 'Daniel'])
  await mark(page, [['bstart', '^Start$']])
  all.builder = await rects(page, {
    lit: '[data-group-builder] [data-frame="1"]',
    chart: '[data-builder-chart]',
    start: '[data-tour-mark="bstart"]',
  })
  await shot(page, 'builder')
  await page.locator('[data-group-builder] button', { hasText: 'Cancel' }).click()
  await page.waitForTimeout(500)
  await page.click('aside [aria-label="Group Activity"]')
  await page.waitForTimeout(700)
  await page.getByRole('dialog').getByRole('button', { name: /^4/ }).first().click()
  await page.waitForTimeout(900)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Make them for me/ })
    .click()
  await page.waitForTimeout(4500)
  await mark(page, [
    ['new', '^New Groups$'],
    ['gshuffle', '^Shuffle$'],
    ['gsave', '^Save$'],
    ['reset', '^Reset Points$'],
    ['lock', '^Lock$'],
    ['gexit', '^Exit Group Activity$'],
  ])
  await page.evaluate(() => {
    const chip = document.querySelector('[title*="tap to change"]')
    chip?.setAttribute('data-tour-mark', 'status')
    let card = chip
    while (card && card.getBoundingClientRect().height < 120) card = card.parentElement
    card?.setAttribute('data-tour-mark', 'gcard')
    card?.querySelector('[title^="Tap, then tap another group"]')?.setAttribute('data-tour-mark', 'name')
  })
  all.groups = await rects(page, {
    new: '[data-tour-mark="new"]',
    shuffle: '[data-tour-mark="gshuffle"]',
    save: '[data-tour-mark="gsave"]',
    reset: '[data-tour-mark="reset"]',
    lock: '[data-tour-mark="lock"]',
    exit: '[data-tour-mark="gexit"]',
    card: '[data-tour-mark="gcard"]',
    status: '[data-tour-mark="status"]',
    name: '[data-tour-mark="name"]',
    plus: '[data-tour-mark="gcard"] [title="Give a point"]',
    minus: '[data-tour-mark="gcard"] [title="Take a point away"]',
    pickGroup: 'aside [aria-label="Pick a Random Group"]',
  })
  await shot(page, 'groups')
  await page.context().close()
}

{
  // The Line, partway through a lesson of a saved line: Amy checked and Done, Tony with the teacher, four waiting.
  const page = await open()
  await page.click('aside [aria-label="Line"]')
  await page.waitForTimeout(500)
  await page.waitForTimeout(800)
  // A class with no lines opens on New Line: Writing, its three steps named, so the desks show the step each is on.
  await page.fill('#line-name', 'Writing')
  for (const [i, step] of ['Prewriting', 'Sentences', 'Paragraphs'].entries()) await page.fill(`[data-step-name="${i + 1}"]`, step)
  await page.getByRole('button', { name: 'Save and Start' }).click()
  await page.waitForTimeout(500)
  for (const n of ['Amy', 'Tony', 'Kevin', 'Brian', 'Emma', 'Leo']) {
    await page
      .locator('[data-ink="desk"]', { has: page.getByText(n, { exact: true }) })
      .first()
      .click()
    await page.waitForTimeout(750)
  }
  await page.locator('[data-line-panel] button', { hasText: /Done$/ }).last().click()
  await page.waitForTimeout(1800)
  // Cindy finished all three steps, set with Change Steps (a tap a step), so a Done desk shows too.
  const change = page.locator('[data-line-panel] button', { hasText: 'Change Steps' })
  await change.click()
  for (let i = 0; i < 3; i++) {
    await page
      .locator('[data-ink="desk"]', { has: page.getByText('Cindy', { exact: true }) })
      .first()
      .click()
    await page.waitForTimeout(750)
  }
  await change.click()
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const panel = document.querySelector('[data-line-panel]')
    const sections = panel?.querySelectorAll(':scope > section')
    sections?.[0]?.setAttribute('data-tour-mark', 'lnow')
    sections?.[1]?.setAttribute('data-tour-mark', 'llist')
    for (const b of panel?.querySelectorAll('button') ?? []) {
      const t = b.textContent.trim()
      if (t === 'Skip') b.setAttribute('data-tour-mark', 'lskip')
      if (/Done$/.test(t)) b.setAttribute('data-tour-mark', 'ldone')
      if (t === 'Change Steps') b.setAttribute('data-tour-mark', 'lchange')
      if (t === 'Clear Line') b.setAttribute('data-tour-mark', 'lclear')
    }
    document.querySelector('[data-line-mark="2"]')?.closest('[data-ink="desk"]')?.setAttribute('data-tour-mark', 'lnumber')
    document.querySelector('[data-done-mark]')?.closest('[data-ink="desk"]')?.setAttribute('data-tour-mark', 'ldesk')
    document.querySelector('[data-line-steps]')?.closest('[data-ink="desk"]')?.setAttribute('data-tour-mark', 'ldots')
  })
  all.line = await rects(page, {
    rail: 'aside [aria-label="Line"]',
    hint: '[data-board-hint]',
    number: '[data-tour-mark="lnumber"]',
    now: '[data-tour-mark="lnow"]',
    list: '[data-tour-mark="llist"]',
    sound: '[data-line-panel] [data-get-ready-sound]',
    skip: '[data-tour-mark="lskip"]',
    star: '[data-line-panel] [aria-label="Give a Star"]',
    done: '[data-tour-mark="ldone"]',
    doneDesk: '[data-tour-mark="ldesk"]',
    clear: '[data-tour-mark="lclear"]',
    steps: '[data-line-steps-button]',
    dots: '[data-tour-mark="ldots"]',
    change: '[data-tour-mark="lchange"]',
  })
  await shot(page, 'line')
  await page.context().close()
}

{
  // The timer, big over the board.
  const page = await open()
  await page.click('aside [aria-label="Timer"]')
  await page.waitForTimeout(900)
  all.timer = await rects(page, {
    card: '[data-timer-card]',
    grip: '.timer-grip',
    face: '.timer-face',
    gear: '[aria-label="Timer settings"]',
    minimise: '[aria-label="Put the timer away"]',
    off: '[data-timer-card] [aria-label="Turn the timer off"]',
    again: '[aria-label="Again"]',
    minusplus: '[aria-label="A minute less"], [aria-label="A minute more"]',
    start: '[data-timer-card] [aria-label="Start"]',
    size: '.timer-size',
    rail: 'aside [aria-label="Timer"]',
  })
  await shot(page, 'timer')
  await page.context().close()
}

{
  // Get Ready!: "How long?", then the star.
  const page = await open()
  await page.click('aside [aria-label="Get Ready!"]')
  await page.waitForTimeout(900)
  all.howlong = await rects(page, {
    window: '[data-slot="dialog-content"]',
    drums: '[data-drum]',
    speaker: '[aria-label*="Tap for"]',
  })
  await shot(page, 'howlong')
  await page.click('[data-drum="30"]')
  await page.waitForTimeout(1400)
  await mark(page, [
    ['ready', '^Ready!$'],
    ['stop', '^Stop$'],
  ])
  all.star = await rects(page, {
    star: 'button[aria-label="Start"]',
    ready: '[data-tour-mark="ready"]',
    stop: '[data-tour-mark="stop"]',
  })
  await shot(page, 'star')
  await page.context().close()
}

// The Marble Jar: the same class on it, its jar filled by three real spins (so the marbles lie where
// they fell), the meter partway to the next spin, then the wheel up for a spin.
{
  const onMarbles = {
    ...STATE,
    classes: [
      {
        ...STATE.classes[0],
        pointsMode: 'quest',
        pointsGoal: 40,
        classPoints: 26,
        marbleJar: { number: 1, marbles: [], spins: 4, filled: [], spinDays: [today], startedOn: today },
      },
    ],
  }
  const page = await open(onMarbles)
  await page.locator('[data-marble-next]').click({ force: true })
  await page.waitForTimeout(1200)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Spin!' }).click()
    await page.waitForTimeout(7000)
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('[data-marble-moment] button')].some((b) => /^Spin!$/.test(b.textContent.trim())),
        null,
        { timeout: 20000 },
      )
      .catch(async (e) => {
        await page.screenshot({ path: '/tmp/walkthrough/tour-marbles-stuck.png' })
        console.error('stuck at spin', i, await page.locator('[data-marble-title]').innerText())
        throw e
      })
    await page.waitForTimeout(900)
  }
  await page.locator('button[aria-label="Not now"]').click()
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    let m = document.querySelector('[data-marble-mini]')
    while (m && m.getBoundingClientRect().width < 600) m = m.parentElement
    m?.setAttribute('data-tour-mark', 'mmeter')
  })
  all.marbles = await rects(page, { meter: '[data-tour-mark="mmeter"]', wheel: '[data-marble-next]', jar: '[data-marble-mini]' })
  await shot(page, 'marbles')
  await page.locator('[data-marble-next]').click({ force: true })
  await page.waitForTimeout(1200)
  await mark(page, [
    ['mpick', '^Pick a Spinner$'],
    ['mspin', '^Spin!$'],
  ])
  all.marblespin = await rects(page, {
    wheel: '[data-marble-wheel]',
    spin: '[data-tour-mark="mpick"], [data-tour-mark="mspin"]',
    jar: '[data-marble-jar]',
  })
  await shot(page, 'marblespin')
  await page.context().close()
}

// The Marble Jar full: the jar tapped, Prize wheel!, the wheel out of the jar, spun, and its prize up.
{
  // A jar laid out as if it had settled, past its line: 8 rows of 7 plain marbles and a Mega.
  const rows = []
  for (let r = 0; r < 8; r++) for (let k = 0; k < 7; k++) rows.push([0, r * 7 + k, 4 + k * 2, 24.6 - r * 2, 0, 1])
  const page = await open({
    ...STATE,
    classes: [
      {
        ...STATE.classes[0],
        pointsMode: 'quest',
        pointsGoal: 40,
        classPoints: 26,
        marbleJar: { number: 1, marbles: [...rows, [2, 0, 10, 8, 0, 2.7]], spins: 0, filled: [], spinDays: [today], startedOn: today },
      },
    ],
  })
  await page.locator('[data-marble-mini]').click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Prize wheel!' }).click()
  await page.waitForTimeout(3400)
  await mark(page, [
    ['qpick', '^Pick a Spinner$'],
    ['qspin', '^Spin!$'],
  ])
  all.wheel = await rects(page, { wheel: '[data-quest-wheel]', pick: '[data-tour-mark="qpick"]', spin: '[data-tour-mark="qspin"]' })
  await shot(page, 'wheel')
  await page.click('[data-tour-mark="qspin"]')
  await page.waitForTimeout(9000)
  all.prize = await rects(page, { card: '.celebration-card' })
  await shot(page, 'prize')
  await page.context().close()
}

writeFileSync(RECTS, JSON.stringify(all, null, 1) + '\n')
console.log(JSON.stringify(all))
await browser.close()
