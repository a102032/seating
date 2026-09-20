# Decisions

Running record of what we've settled and why, so the reasoning survives between sessions.
Newest thinking at the top of each section. Last updated 2026-09-20.

## What this app is

- **A seating chart, attendance and points tool that runs *alongside* Gynzy / NaniBox / Classroom Screen** — not a replacement for them. Gynzy already does whiteboard, lessons, timers and noise meters well; its seating chart and attendance are weak. That gap is the product.
- **Target user: teachers who want marble-jar dynamics but can't have the jar.** Derek's room runs on a physical marble jar, a per-class jar, and a battery wall that fills toward a treasure chest. Colleagues like watching it work and default to ClassDojo instead because they can't replicate it.
- **Deliberately fewer features than ClassDojo**: no parent accounts, no behaviour taxonomy, no setup. The things people complain about are the things we leave out. That's a position, not a limitation.
- Because it's designed to share the screen rather than own it, **coexisting with the lesson app is the core premise**, not a nice-to-have.

## Next up

- **Use it in a real class before building anything else.** It's live and working. Three lessons will replace a speculative bug list with a real one, and will answer whether the floating-window idea is genuinely useful or just looked good in someone else's app.
- **Attendance mode** is the strongest feature idea we have. Teacher taps the desks of absent students; those desks ghost for the *whole day*, not the session; tapping again in attendance mode undoes it; the record is viewable, exportable and printable.
  - It's the only feature that makes someone open the app *every single day*. That's the habit hook — timers and pickers are occasional.
  - A seating chart is the right interface for it: a teacher scanning the room sees empty *chairs*, not missing names.
  - Open: tardy vs. absent (a record without the distinction is less useful to the office); presumably per class per date.
  - Open: **durability**. localStorage is fine for seating and points, not for a record anyone relies on — clearing the browser wipes a term. This is what would finally justify turning Supabase on, or at minimum a real export/backup.

## Parked — revisit, don't rebuild

- **Marble sounds** (`design/marble-sounds.html`, published as its own artifact). Four candidates mapped to classroom moments. Derek: "gets so close to the actual sound." Undecided whether they go in the app; the synthesis ports straight into `lib/sound.ts` if so.
  - The insight behind it: his marble swirl is a *command* (it changes the room's behaviour), where all our current sounds are *feedback* (they confirm something happened). The award sound should carry across a room, not confirm a click.
  - Attention-getter sound boards already exist (Classroom Screen, Class123), so a sound *library* is commodity. What isn't commodity is the reward system's own sound being the cue.
- **Picture-in-Picture floating window** — a small always-on-top window (Chrome/Edge) holding the timer and a compact scrollable name list with inline +/−. Roughly a day's work vs. weeks for Electron, and it tests the actual hypothesis. `useCountdown` already computes from a stored end-timestamp, so background throttling won't corrupt the clock.
- **Group/team making** — randomly split the class into teams of N. Teachers do this constantly and badly by hand; fits the scope.
- **Electron port** — deferred. Only it can give a true borderless floating icon pinned to the corner. If PiP proves the idea useful, this becomes a polish exercise worth doing; if not, it's saved entirely. Electron over Tauri when we do: predictability and prior art matter more than footprint, since none of it can be tested from here.

## Deliberately not building

- **Reasons / labels on points** (ClassDojo-style). Teachers and admins report the taxonomy is the cumbersome part — it inserts a decision between the moment and the reward, which is fatal for something whose value is immediacy.
- **Further timer investment.** The smartboard has a timer, so do Gynzy and Classroom Screen. Ours is nice and costs nothing to keep, but nobody switches apps for a timer.
- **Whiteboard, lesson building, noise meter, AI images.** Gynzy's territory; we'd always be behind.
- **Student self-check-in for attendance.** Thirty kids tapping in creates a queue at the board; one teacher scanning the room takes ten seconds.
- **Fly-from-desks transition** for the flip deck. The slide is enough.

## Open questions

- **Are per-student point tallies actually wanted?** Derek's own practice is whole-class — marbles all land in one jar, no individual scorekeeping. The app is individual-first with the class meter riding along. That may be right for other teachers, or it may be the ClassDojo instinct sneaking in.
- Which existing features need tweaking. Derek reports several do; specifics need real classroom use to pin down.

## Settled mechanics

- **Points**: floored at 0. Select students (tap desks or revealed cards), then +/− in the side panel. Selection is keyed by student id, which is what lets desks and flip cards share the same controls.
- **Class goal meter**: one shared total. Deductions affect a student's own tally but never pull the class meter backward — it's collective momentum, not a ledger. On reaching the goal: celebrate, then reset to 0 for the next goal.
- **Two knobs on the goal, not one.** Stars convert to class points at a teacher-set rate, and the goal is counted in class points. A divisor doesn't change *pacing* — the goal alone already does, since "10 stars each, goal 8" is arithmetically "goal 80" — it changes the number the class looks at. 5/8 is a jar filling; 48/80 is a score. Leftover stars are banked, so awarding one at a time eventually counts for as much as awarding them all at once. Default is 1:1, so classes saved before this behave exactly as they did.
- **Resetting stars and resetting the meter are separate actions.** They were briefly one, on the grounds that both describe the same term — but that argues for making both easy, not for forcing a teacher who wants one to destroy the other.
- **Points settings live in Pickers & Points**, not Class Settings, with per-student editing in the roster (the only per-student surface). Class Settings is for the class's composition and appearance.
- **Flip-card picker**: slides over the desk grid rather than taking the full screen, so the side panel's point buttons and the goal meter stay live. Seated students only. Its own round, independent of Pick Student's history — setting a card aside *is* the no-repeat mechanism. Gender colouring on card backs is cosmetic (all students dealt), and flipping awards no points automatically.
- **Avatars**: Flaticon sticker packs (paid subscription), imported by `import-stickers.py` into `public/avatars/stickers/<theme>/<pose>.svg`. This replaced the Google Flow set and fixed the proportion drift outright — every sticker is drawn on the same 512×512 canvas, so nothing needs per-image CSS. A student with no avatar gets a character derived from their id, so a freshly imported class already looks varied.
- **Bulk avatar assignment**: Class Settings → Class Avatars. Scope (everyone / boys / girls) × poses (mixed / same for all), then one tap applies; tapping the same character again re-rolls. Immediate rather than a confirm step — the undo is tapping something else.
- **Typeface**: Andika, app-wide. Chosen for its single-storey lowercase `a`, which is how the students are taught to write it; Comic Sans was rejected. Lexend was a close second. `lib/fitText.ts` measures in Andika because it picks one name size for a whole class — measuring in the wrong face would size every desk wrong.
- **Desk layout**: rounded top, square bottom. Homeroom number top-left, points badge top-right, both over the avatar's empty corners, leaving the whole bottom row to the name. One name size per class, computed from the longest name, so no student's desk reads smaller than the rest.
- **Deployment**: pushes to `main` auto-deploy to https://a102032.github.io/seating/. The workflow curls the published URL afterwards and fails if it isn't serving the built bundle — Pages served the repo's raw `index.html` for several runs while every step reported green. `build-artifact.py` bundles a standalone copy for the Claude artifact preview.

## Known loose ends

- **Not every sticker pack can be filtered.** Only 7 of the 20 packs ship descriptive filenames (`sick`, `tired`, `broken-heart`); the other 13 are numbered (`owl-002`), so bulk assignment can't keep glum poses out of those and `absent` can't be detected for them either. Renaming them by hand is the only fix, and it's probably not worth it.
- **Andika ships only weights 400 and 700.** `font-semibold` renders identically to `font-bold` throughout the app. Nothing looks broken, but the type has one less step than the design assumed.
