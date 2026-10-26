# Capture home, Canvas auto-clear, four colors, "Do it now"

Date: 2026-10-26 · Approved by Juann in a brainstorming session. Mockup that was approved:
`.superpowers/brainstorm/89066-1792985687/content/capture-home-v3.html` (gitignored, local only).
Open it in a browser and hold the island. **It is the motion reference; match it.**

## Why

Juann and Sid see two uses of Tangent:

1. **Capture (the urgent one).** You open Tangent because something just came up. You want to dump it
   in by voice and get out. Tangent sorts it into a project or a short-term calendar item, and if it needs
   context it asks once, or saves the question for later.
2. **Check in.** Later, you look at what you added and work through it.

Capture matters more, so the first screen should do only that: your to-do list plus a giant
hold-to-talk mic. Everything else is one tap away behind "Open app →".

Separately, Canvas assignments pile up. The Canvas calendar feed (`lib/canvas-ics.ts`) never says
whether something was submitted, and every sync re-imports the last 21 days. So Juann sees a wall of
already-finished work, which "clutters everything else and panics me." The goal is to see only Canvas work
that is still open.

Juann also wants Tangent to push you toward doing what you added.

## Goals

1. **Capture home at `/`.** It's the first screen after sign-in. The layout is option C, version 3,
   from the mockup.
2. **Canvas auto-clear.** A Canvas item more than 2 days past its due date counts as handled.
3. **Four colors for task dots, everywhere:** Canvas, Academic, ECs, grey.
4. **"Do it now":** a Start button on the top task opens a focus timer.
5. **One saved question per capture:** after a capture, the Sorted card also surfaces one parked
   question.

## Non-goals (Juann explicitly rejected these, don't build them)

- "Still doing this?" nudges on stale tasks ("annoying").
- An evening "did these get done?" check-in ("no").
- A real Canvas submission sync (needs a Canvas API token plus backend work).
- Push notifications, and auto-scheduled study blocks before Canvas deadlines. **These go to Sid as
  backend notes (see the end), not built here.**

## Anti-goals (would be a failure even if it technically works)

- The capture home feels like a dashboard. It must stay **only** the list and the island.
- Motion that is merely okay. Juann's words: "make sure the motion is SO AMAZING". The mockup is
  the bar.
- Sharp corners. The rounded shape language is settled; keep `--r-sm/md/lg = 10/15/18px`.
- Backend rewrites. Sid said not to touch much backend. The only server-side edits allowed are the
  two small ones named below.

## 1 · Capture home

**Route (my call):** `/` becomes the capture home and renders **without** the AppShell chrome
(no sidebar or top bar). Today moves to `/today`. Update the nav item in `components/AppShell.tsx:46`
and its active check (`:138`, `:225`). The rail logo keeps linking to `/`. `middleware.ts` already
sends signed-in users to `/`, so it needs no change. Anything else hard-linking `/` *meaning Today*
should point to `/today`; grep for it. `/?capture=1` keeps working (it now lands on the capture home).

**Screen, top to bottom (from the mockup):**
- Top bar: the `tangent` wordmark on the left, the glass pill **"Open app →"** on the right (goes to
  `/today`).
- "To do" heading (display font) and a count line ("5 things").
- **The list.** Incomplete tasks where `tracksCompletion(task)` is true (`lib/urgency.ts`, so School
  Blocks are excluded) and that are not Canvas-cleared (section 2). Order: overdue and today first, then
  by date and time. Window (my call): anything overdue (but not cleared) plus the next 14 days. Undated
  tasks go last. The page scrolls, and the bottom of the list fades under the island.
- Each row: a round check (completes the task with the existing optimistic update), the title, a
  subline (relative day, "· Canvas" or "· <project name>"), and the color dot (section 3). Tapping the
  row body calls `openTask(id)`.
- **The island:** a full-width frosted Liquid Glass capsule fixed at the bottom, 120px tall, inset
  16px from the sides and 30px above the bottom (plus the safe-area inset). **The whole island is the
  button.** Inside it: a mic glyph in accent color, the label "Hold to talk", and a waveform that
  appears while listening. Below it, small text: "or tap to type". Add it to the glass recipe lists in
  `app/liquid-glass.css` the way other buttons are added.

**Interaction:**
- **Hold** (pointerdown held ≥ ~200ms, or Space on desktop) starts listening. **Release** sends.
  **Dragging up more than ~40px before release cancels.** A **tap** (released before the hold
  threshold) opens typing: the existing `AddFlow` sheet / CommandPalette, focused.
- Voice and sorting reuse what `components/add/AddFlow.tsx` already does: the same voice hook, the
  same routing (calendar or new/existing project, questions to `/ai`, goals to `/tangents`), the same
  `/api/chat` clarify call with "Skip for now" (shown here as "Ask me later") feeding
  `generateQuestions`, and the same Undo. **Pull the logic out of AddFlow into a shared hook if
  needed. Don't fork it.** AddFlow on the other screens must behave the same afterwards.
- **Save first, ask after (Juann: "auto sort it… if tangent needs context question it stores it").**
  On the capture home, a capture that triggers a clarify reply is saved **immediately**, the same way
  "Skip for now" saves it today (the questions go to `generateQuestions`). The Sorted card then shows
  the saved item(s) plus the first question. Answering applies the answer to the saved item. Ignoring
  or swiping the card leaves the item saved and the question in the pile. This is a capture-home
  behaviour; AddFlow elsewhere keeps its current ask-then-save flow.
- **Several questions (confirmed):** the card shows one question at a time, with the first one first;
  answering moves to the next. "Ask me later" parks all the rest.
- **Spoken questions and goals (confirmed):** don't navigate away. A spoken question gets a chip,
  "Ask Tangent →" to `/ai`, which carries the text. **A spoken goal is sorted as a project.** There
  is no Tangents chip, because Tangents is becoming a way to visualise projects (see "Next" below).
  AddFlow's voice path elsewhere stays unchanged.
- **Other outcomes in the card (confirmed):** a duplicate → "Already on your list" with the existing
  row highlighted; confirm required → the confirm text with Yes / No chips; a change preview (Pipeline
  V2, off in prod) → fall back to the existing preview UI; an error → "Couldn't add that, try again"
  with the transcript kept so a tap re-sends it.
- **While it's sorting (confirmed):** on release, the wash collapses into the island as usual. The
  island shows a working state ("Sorting…" with a slow lavender shimmer across the glass, and the
  last transcript line in small text above it). The Sorted card rises the moment the result arrives,
  and the rows spring in at the same time. There is no fake delay.
- **Desktop (confirmed):** the list and island sit in a centred column, about 560px wide. The island
  matches the column width, and the wash covers the whole window from the island's centre.
- **`/?capture=1` (the PWA shortcut, confirmed):** opens the capture home already listening, in
  tap-to-stop mode (the label reads "Tap to add"), since there's no hold to release.
- **Shell (my call):** `/` keeps AppShell's non-visual parts (FirstRun, CommandPalette as the tap
  target, the Canvas re-sync check). It hides the sidebar, top bar, mobile nav and floating mic.
  CommandPalette's global hold-Space recorder is disabled on `/` so it doesn't fight the island.
- Voice only auto-sends with at least 2 real words (`lib/voice-intent.ts`). Keep that rule. If it
  fails, the takeover closes with no card.

**Motion (match capture-home-v3.html):**
- Press: the island scales to ~0.965 with a spring, then swells to ~168px tall with a larger corner
  radius. A lavender glow breathes up from inside it, and a soft halo ring pulses around it.
- A **lavender wash** grows as a circle from the island's centre until it covers the whole screen
  (~750ms, ease-out-expo-like). Two blurred blobs (lavender and pink) drift slowly inside it.
- Meanwhile the list behind scales to ~0.93, lifts ~8px, blurs ~7px and fades to ~55%.
- "Listening…" appears near the top, and the live transcript renders large (display font, ~30px).
  **Each word blurs and rises in as it arrives.** Use the real interim transcript if the voice hook
  exposes one; otherwise show the words when the final transcript arrives, with the same per-word
  stagger.
- The label crossfades "Hold to talk" → "Let go to add" (vertical slide plus blur). The waveform
  bars expand in. If the hook exposes an audio level, use it; otherwise use a believable synthetic
  motion like the mockup's.
- Release: the wash collapses back into the island (~550ms, ease-in). The new rows **spring into the
  top of the list** with a brief accent ring. A frosted **Sorted card** rises above the island: an
  uppercase "Sorted" label, then one line per created item (dot, title, "→ where", staggered), then
  either the clarify question with answer chips plus "Ask me later", or an Undo chip. With no
  question, it dismisses itself after ~3.2s.
- Light haptic tick on press where `navigator.vibrate` exists.
- `prefers-reduced-motion`: crossfades only, with no scale, blur, blobs or word stagger. Reuse
  `useReducedMotion` from motion, as the rest of the app does.
- The project already uses `motion/react`. Prefer it over hand-written CSS keyframes wherever the app
  does, and keep everything on transform, opacity, filter and clip-path (no layout-thrashing
  properties).
- Lavender tokens from the mockup: `--lav #e4dcfb`, `--lav-2 #cfc2f7`, blobs `#b7a4f5` / `#f0c9f2`.
  Define a dark-theme equivalent (deep violet wash) so the takeover doesn't flash white in dark mode.

## 2 · Canvas auto-clear

- One helper (my call: `isCanvasCleared(task, today)` in `lib/urgency.ts` or a new
  `lib/canvas-clear.ts`, with a unit test). It returns true when `task.source === "canvas"`, the task
  is not completed, and `task.date <= addDaysYMD(today, -2)`, using the student's timezone. Example:
  due Oct 20 → gone from Oct 22.
- Cleared items are **hidden** from the capture list, Today (`TodayCard` / attention / urgency),
  Projects lists, notification counts, and the proactive "overdue" prompt (`lib/proactive.ts`
  `overdueTasks`, a one-line filter: allowed server edit #1).
- On the **calendar** they stay visible but greyed out and unchecked, so you can look back.
- Imports: `IMPORT_WINDOW_DAYS` in `lib/canvas-ics.ts` goes from 21 → 2 (allowed server edit #2).
  Already-imported old items stay in the DB and are filtered out by the helper. No migration.
- The student checking a Canvas item off still works as before.

## 3 · Four colors

Replace `taskColor()` in `lib/task-colors.ts` so that every caller (calendar, Today, AI chat list,
TaskDetail, capture home) gets one of four categories:

| Category | Rule | Light | Notes |
|---|---|---|---|
| Canvas | `source === "canvas"` | `#e4572e` | wins over everything |
| Academic | `kind` is `school` (non-Canvas) or `academic-ec` | `#5b4bc4` | |
| ECs | `kind === "side-ec"` | `#2f9e6e` | robotics, Tangent, clubs |
| Other | `commitment`, `personal`, no kind | `#c3bdd9` | grey |

- **Project color no longer drives the dot.** A project step uses its own kind. If the task has no
  kind, it uses the kind of the project's other tasks if they agree; otherwise grey (builder may simplify).
  Project colors can still appear on project cards themselves.
- Expose a `CATEGORY_LABEL` (Canvas / Academic / ECs / Other) for legends.
- Define the four as CSS tokens with dark-theme values that keep contrast against `--surface`.
- **Hardcoded-colour trap:** many colours in globals.css / console.css / tangents.css bypass the tokens.
  Grep for the old `--kind-*` uses and anything else that colours a task dot.

## 4 · "Do it now"

- Only on the capture home: the **first row** of the list gets a small glass "Start" button.
- Start opens a full-screen focus view in the same lavender takeover language: the task title, the
  first step (`task.startAction` if present, otherwise the fallback "Open it and do the first 5
  minutes."), a 25-minute countdown ring, and two actions: **Done** (completes the task and springs
  back to the list) and **Stop**.
- Client-only. Persist `{taskId, endsAt}` in localStorage (wrapped in try/catch) so a reload resumes
  the timer. When time is up: a gentle pulse plus a desktop notification if those are already enabled
  (`lib/desktop-notifications.ts`), asking "Done, or 10 more minutes?".

## 5 · One saved question per capture

- After a capture finishes **and the capture itself produced no clarify question**, the Sorted card
  adds one parked question from `useQuestionSets` (the oldest first), worded like "Earlier you added
  *chem test*: how long do you usually need?", with its answer chips and "Later". Answering uses the
  same path `QuestionsInbox` uses. At most one per capture. Never shown if the pile is empty.

## Constraints and working notes

- No Tailwind or shadcn. It's bespoke CSS variables. 21st.dev is reference-only.
- **Git is currently blocked** by an unaccepted Xcode license (`sudo xcodebuild -license accept`,
  Juann must run it). After that, `git fetch` first. Sid pushes big changes and local main goes stale fast.
- **Pushing to `main` auto-deploys to production** (yourtangent.vercel.app). Work on a branch. Ask
  Juann before pushing to main.
- No `.env.local` locally, so the app can't run signed-in locally. Verification options: unit tests
  (`npm test`), `npm run build` (stop `npm run dev` first or `.next` corrupts), and a live check after
  Juann approves a deploy. For phone layout: a same-origin 390×780 iframe trick (see project memory).
- `npm install` may fail on `~/.npm/_cacache` permissions; use `npm install --cache <tmpdir>`.

## Left to the builder

File and component names; whether the capture home is one component or several; exact spring
constants (match the mockup's feel); how to share AddFlow logic; the list window details beyond
the rules above.

## Next (separate piece, after this one)

Tangents is moving from its own tab to "a way to visualise projects you're working on": in the
Projects tab you click **View paths** and the path map pops up. That needs its own short design pass
(how a project maps to a path) before it's built.

## For Sid (backend, not built here)

Juann said: "if u can do them do it." Check with Juann before starting either, since Sid asked for
backend to be left mostly alone.

- **Push notifications when the app is closed** (service worker + Web Push + a send path from the
  proactive cron).
- **Auto-blocked study time before Canvas deadlines** (already on the 2026-10-12 list).
- **Real Canvas completion:** optional Canvas API token → submission status, which would replace
  the 2-day heuristic.
