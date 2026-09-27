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
  (Known exception: 1024x640 with the timer controls open is about 39px short in the side panel. Accepted.)
- Fixed-size boards: once a board (flip cards, group cards) is laid out, cards don't resize or move as others
  leave. A class of 30 or fewer must look exactly as it did before the seventh column existed.
  Empty space goes where a child won't miss it: the flip deck's short row goes on top, starting at the left, so
  the empty slots are at the top right. Cards are dealt bottom row first, left to right, working up.

## Stack and commands

React 19, TypeScript, Vite 8, Tailwind v4, shadcn/ui (Radix), framer-motion, lucide-react. The font is Andika
(weights 400 and 700 only). Saved in localStorage; Supabase sync exists but is not turned on.

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
- `src/types.ts`: data model. `ClassData`, `Student`, `StudentGroup`; a 6x5 desk grid (`DESK_COUNT` 30), plus a
  seventh column (desks 30-34, `MAX_DESKS` 35) only for classes of more than 30. Use `deskColumn`/`deskRow`/`deskAt`,
  never `index % 6`, and `deskColumnsFor(cls)` for how many columns a class shows.
- `src/hooks/useClasses.ts`: all class data changes (seating, points, class goal, groups, attendance) and saving.
- `src/hooks/usePicker.ts`: Pick Student / Pick Row on the desks. `useGroupPicker.ts`: the same during Group Activity.
- `src/hooks/useFlipDeck.ts`: the flip card deck: dealing, the active card, the Flip Back / Discard modes, bonus
  cards, and `planDeck` (how many bonus cards and columns). `useCountdown.ts`: the timer.
- `src/components/`:
  - `SidePanel.tsx`: class switcher, timer, pickers and points.
  - `DeskGrid.tsx` / `Desk.tsx`: the seating chart.
  - `FlipDeck.tsx` / `FlipCard.tsx` / `FlipDeckSettingsModal.tsx`: flip cards.
  - `GroupActivity*.tsx`, `GroupStatusPicker.tsx`, `GroupExitModal.tsx`: Group Activity.
  - `PointsMeter.tsx` / `GoalCelebration.tsx`: the class goal.
  - `AttendanceHistoryModal.tsx` (the record, opened from Class Settings) and `AbsentIcon.tsx` (the zzz).
  - `ui/`: shadcn primitives.
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
the splash screen (`.splash-board button`), then act and take screenshots. Google Fonts is blocked in the sandbox,
so Andika renders as a fallback unless the font files are served locally. Measure "no scroll" as
`scrollHeight - clientHeight` on the document and on `aside`.

@DECISIONS.md
