# Seating Chart

A classroom seating chart, points and picker app for one teacher's smartboard, built to sit alongside Gynzy /
Classroom Screen rather than replace them. The students are young EFL learners (New Taipei City). It is live at
https://a102032.github.io/seating/, and every push to `main` deploys there.

**Read `DECISIONS.md` before changing any feature.** It records what has been settled and why, including ideas
that were built and deliberately taken out. It is imported at the bottom of this file, so it is already loaded.

## How to work with the teacher

- **Discuss before building** whenever they ask for thoughts, ideas or a plan. Give a recommendation, not a
  survey, then wait. "go" means build it.
- They use it by touch at a smartboard, so avoid anything that needs typing, double-tapping, dragging or hovering.
  Smart boards often read one touch as two.
- **Nothing happens on a timer.** Cards don't flip back by themselves, and picks don't expire. The teacher or a
  tap decides when something ends.
- **The class goal is the only big celebration.** Other good moments get something small (a pop, a short
  sparkle), so the big one keeps its meaning.
- On-screen words are for young EFL readers: short, plain, and one idea per label.
- Plain-language replies. Say what was verified and how. Send a screenshot after visual changes.

## Hard rules

- **The app never scrolls.** Not the board, not the side panel, not a screen that slides over the board. Content
  inside a modal may scroll; a modal itself must fit. Check new UI at 1024x640, 1280x800 and 1920x1080.
  (Known exceptions, both accepted: 1024x640 with the dial timer's controls open is about 38px short in the side panel;
  the flip clock fits, except with students selected too, when it's 16px short.)
- **Smooth on the board.** Classroom boards are often 4K panels with weak processors, and the app was choppy on the teacher's (see "Smooth on the
  board" in DECISIONS). No backdrop blur. Anything that moves many elements, or keeps moving, is CSS or
  `element.animate`, not framer-motion. No framer `layout`/`layoutId` on anything that is always on screen: framer then
  measures the page on every render. A modal returns null while closed (`useLingerWhileClosing`). Check a change that
  moves things with `node scripts/frame-check.mjs` against a production build.
- Fixed-size boards: once a board (flip cards, group cards) is laid out, cards don't resize or move as others
  leave. A class of 30 or fewer must look exactly as it did before the seventh column existed.
  Empty space goes where a child won't miss it: the flip deck's short row goes on top, starting at the left, so
  the empty slots are at the top right. Cards are dealt bottom row first, left to right, working up.

## Stack and commands

React 19, TypeScript, Vite 8, Tailwind v4, shadcn/ui (Radix), framer-motion, lucide-react. The font is Andika
(weights 400 and 700 only). Saved in localStorage, and to the teacher's Google account once they sign in (Firebase: Google
sign-in and Firestore, project class-yes).

```bash
npm run dev -- --port 5175     # dev server at http://localhost:5175/seating/
npx tsc -b                     # typecheck
npx oxlint                     # lint (the existing warnings are known)
npm run build                  # typecheck + production build
npx prettier --single-quote --no-semi --print-width 140 --trailing-comma all --write <files>
```

Deploy: commit and push to `main`. The GitHub Pages workflow (`.github/workflows/deploy.yml`) builds and then
checks the live URL. Confirm it went green before saying something is live.

## Where things are

- `src/App.tsx`: top-level state and wiring (points selection, which screen is open, modals).
- `src/types.ts`: data model. `ClassData`, `Student`, `StudentGroup`. A class seats at most 35 (`MAX_DESKS`).
- `src/lib/layouts.ts`: room layouts (Rows, Pairs, Rows of 3, Tables of 4, Tables of 5 two ways). `planFor(cls)` gives
  the desks a class shows, which row or table each belongs to (Pick Row / Pick Table, Split by Rows / Tables) and the
  fill order. Never work out a desk's place with `index % 6`: go through the plan. Rows keeps the old numbering (desks
  0-29 six wide, 30-34 the seventh column), and `DeskGrid` draws Rows with its original code.
- `src/hooks/useClasses.ts`: all class data changes (seating, points, class goal, groups, attendance) and saving.
- `src/hooks/useCloudSync.ts`: signing in and sync (the first-sign-in question, live sync, offline catch-up, Switch
  teacher). It watches `classes` and sends whatever changed, so class changes need nothing extra to sync.
  `lib/firebase.ts` is Firebase itself, loaded only when needed; `lib/cloud.ts` loads it and keeps the account record,
  the put-aside board classes and the sign-in error words. `components/Account.tsx`: the Saved mark, Switch teacher
  and the question. `firestore.rules` is a copy of the rules in the Firebase console.
- Google Drive and Sheets: `lib/drive.ts` (the folder, the roster sheet, reading a sheet, the attendance Sheet, the
  picture upload, error words), `hooks/useDrive.ts` (one action at a time, with its link or its problem),
  `lib/chartPicture.ts` (the seating chart picture, drawn on a canvas from the class's plan),
  `components/GoogleTab.tsx` (Class Settings' third tab) and `components/RosterSheetsModal.tsx`. Only Google's
  drive.file permission; every Drive action starts from a tap, because Google's window may need to open.
- `src/hooks/usePicker.ts`: Pick Student / Pick Row on the desks. `useGroupPicker.ts`: the same during Group Activity.
- `src/hooks/useFlipDeck.ts`: the flip card deck: dealing, the active card, the Flip Back / Discard modes, bonus
  cards, and `planDeck` (how many bonus cards and columns). `useCountdown.ts`: the timer.
- `src/components/`:
  - `SidePanel.tsx`: class switcher, timer, pickers and points.
  - `DeskGrid.tsx` / `Desk.tsx`: the seating chart.
  - `FlipDeck.tsx` / `FlipCard.tsx` / `FlipDeckSettingsModal.tsx`: flip cards.
  - `FlipTimer.tsx` / `TimerDial.tsx` / `TimerSettingsModal.tsx`: the side panel's timer, as flip digits or a Time Timer-style dial.
  - `GroupActivity*.tsx`, `GroupStatusPicker.tsx`, `GroupExitModal.tsx`: Group Activity.
  - `PointsMeter.tsx` / `GoalCelebration.tsx`: the class goal. `FloatingGoal.tsx`: the goal floating over the lesson
    (Chrome/Edge's always-on-top window, opened by `hooks/useFloatingWindow.ts`). CSS animations only in there.
  - `AttendanceHistoryModal.tsx` (the record, opened from Class Settings) and `AbsentIcon.tsx` (the zzz).
  - `ui/`: shadcn primitives.
- `src/lib/starFlight.ts`: the star that flies from a desk or flip card into the goal meter's coin; `PointsMeter` waits for it
  to land (`starsLandingIn`) before the coin moves.
- `src/lib/`: `sound.ts` (every sound, synthesised with Web Audio), `groups.ts` (building and pruning groups),
  `bonusCards.ts`, `theme.ts`, `stickers.ts` (avatars), `fitText.ts`, `localStore.ts`, `attendance.ts` (date keys, CSV).
- Absent students: `App.tsx` builds `presentSeating` (absent desks as empty) for everything that chooses students.
  Anything new that picks, deals or awards should use it, not the raw `seating`.
- `src/index.css`: the five themes as CSS custom properties, plus the keyframe classes.
- localStorage keys all start with `seating-chart-` and end in `-v1` (the main state is `seating-chart-state-v1`).

## Conventions

- Comments explain *why*: the classroom reason, or the trap being avoided. Match the density of the file you're in.
- When a decision is made or reversed, update `DECISIONS.md` in the same commit.
- Commit messages say what changed for the teacher, not just the code.
- framer-motion traps: it never clears an inline `box-shadow` it has set (use a CSS class instead). On elements with
  `layout`/`layoutId`, drive opacity through `animate`, because a utility class loses.
- Keep sounds above about 400Hz; a classroom tablet speaker has no bass.

## Checking changes in a browser

Playwright is installed globally (`/opt/node22/lib/node_modules/playwright/index.js`); launch Chromium with
`executablePath: '/opt/pw-browsers/chromium'`. Seed a class through `localStorage` in `addInitScript`, click past
the splash screen (`.splash-board button`), then act and take screenshots. `scripts/walkthrough.mjs` does this for a
whole lesson and class setup (the bugs found in the sweep, edge-size classes, reloads, and "nothing scrolls" in every
theme at all three sizes); run it after a change to anything shared. Google Fonts is blocked in the sandbox,
so Andika renders as a fallback unless the font files are served locally. Measure "no scroll" as
`scrollHeight - clientHeight` on the document and on `aside`.

Sync is checked against Firebase's own emulators (Java is needed), never the real project: start them from the repo
root with `npx -y firebase-tools@15 emulators:start --only auth,firestore --project class-yes`, build a copy that
talks to them (`VITE_FIREBASE_EMULATOR=1 npx vite build --outDir /tmp/dist-emu`, served with `npx vite preview --port
4174 --outDir /tmp/dist-emu`), then `URL=http://localhost:4174/seating/ node scripts/sync-check.mjs`. Google's sign-in
window can't load in the sandbox, so that copy signs in as whatever account a test names (`window.__testGoogle`).
The proxy blocks the real project's addresses, so nothing here can reach it. `scripts/drive-check.mjs` runs the same
way and checks Drive and Sheets against a stand-in for Google built into the script (that copy hands over a pass with
`window.__testGoogle.driveToken`).

@DECISIONS.md
