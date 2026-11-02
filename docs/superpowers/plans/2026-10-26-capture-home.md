# Capture Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening Tangent lands on a capture-first home (to-do list plus a hold-to-talk glass island with a lavender takeover). Canvas items auto-clear 2 days after they're due. Task dots use 4 category colors. The top task gets a "Do it now" focus timer.

**Architecture:** `/` becomes a new `CaptureHome` rendered inside the existing `(app)` group, with AppShell in a bare mode (no rail, top bar, mobile nav or floating mic). Today moves to `/today`. All the logic that can be pure goes in small tested `lib/` modules: list building, Canvas clearing, the hold gesture, outcome mapping, the focus timer and categories. The UI lives in `components/capture/`. It talks to the same `/api/chat`, `/api/questions` and `/api/confirm` routes AddFlow uses. AddFlow itself is not changed.

**Tech Stack:** Next.js 14 App Router, React 18, `motion` 13 (`motion/react`, `motion/react-m`), lucide-react, bespoke CSS variables (no Tailwind). Tests use `node --test` on `.ts` files.

**Spec:** `docs/superpowers/specs/2026-10-26-capture-home-design.md`. Motion reference: `.superpowers/brainstorm/89066-1792985687/content/capture-home-v3.html` (open it and hold the island).

## Global Constraints

- Corners stay rounded: `--r-sm/md/lg = 10/15/18px`. Islands and pills are capsules.
- No Tailwind, shadcn or new dependencies.
- Backend edits are limited to: `IMPORT_WINDOW_DAYS` 21 → 2 in `lib/canvas-ics.ts`, and the cleared-Canvas filter on `overdueTasks` in `lib/proactive.ts`.
- New `lib/*.ts` modules use **relative** imports (`./types`, `./time`) so `node --test` can load them. The test resolve hook only maps relative specifiers. Copy the `registerHooks` header from `lib/ics.test.ts` into each new test file.
- Add every new test file to the `test` script's globs if it isn't already covered (`lib/*.test.ts` already is).
- New glass buttons get added to the glass recipe selector lists at the end of `app/liquid-glass.css`, scoped to `button, a, [role=button]`.
- `prefers-reduced-motion`: crossfades only (use `useReducedMotion` from `motion/react`).
- Copy (exact): "Open app →", "To do", "Hold to talk", "Let go to add", "Tap to add", "or tap to type", "Listening…", "Sorting…", "Sorted", "Ask me later", "Undo", "Ask Tangent →", "Already on your list", "Couldn't add that, try again", "Start", "Done", "Stop", "Open it and do the first 5 minutes.", "Done, or 10 more minutes?".
- Colors (light): Canvas `#e4572e`, Academic `#5b4bc4`, ECs `#2f9e6e`, Other `#c3bdd9`. Lavender `--lav #e4dcfb`, `--lav-2 #cfc2f7`, blobs `#b7a4f5` / `#f0c9f2`.
- Git: run every git command with `DEVELOPER_DIR=/Library/Developer/CommandLineTools` (the Xcode license blocks the default shim). Work on `feat/capture-home`. **Never push to `main`** (it auto-deploys to prod). Ask Juann before any push.
- Stop `npm run dev` before `npm run build`. If `npm install` is needed, use `--cache <scratch dir>`.

## Review Focus

1. **A press that never ends cleanly** (pointercancel from a phone scroll, the window losing focus, or the pointer leaving the window mid-hold) must cancel, with no stuck lavender wash and no mic left recording. *Pinned by the `cancel` tests in Task 4; `CaptureIsland` wires `pointercancel`, `lostpointercapture` and `blur` to cancel.*
2. **Mic permission denied or no mic.** The wash closes and the error card shows "Couldn't add that, try again" with nothing saved. *Pinned by `outcomeFromError` in Task 5.*
3. **New student with nothing to do.** The list is empty and the screen shows an empty state ("Nothing to do. Hold to add something."), not a blank page. *Pinned by the empty test in Task 3; rendered in Task 6.*
4. **Day-boundary Canvas dates.** An item due exactly 2 days ago (any time, including 23:59) is cleared; one due yesterday is not. This uses the student's timezone `today`, not UTC. *Pinned in Task 2.*
5. **Holding again while a capture is still sorting** must not start a second recording or double-save. The island is inert in the `sorting` state. *Pinned by the `busy` test in Task 4.*

---

### Task 1: Move Today to `/today`, bare shell on `/`

**Files:**
- Create: `app/(app)/today/page.tsx` (moved from `app/(app)/page.tsx`, unchanged except where noted)
- Replace: `app/(app)/page.tsx` → for now, a stub rendering `<CaptureHome />` from `components/capture/CaptureHome.tsx` (stub: the heading "To do" and a link "Open app →" to `/today`)
- Modify: `components/AppShell.tsx` (NAV `Today` href `/today`; active checks at :138 and :225 compare `/today`; bare mode)
- Modify: `components/CommandPalette.tsx` (the hold-Space effect returns early when `pathname === "/"`)
- Modify: `app/manifest.ts` (the comment now says the capture home handles `?capture=1`)

**Interfaces:**
- Produces: `components/capture/CaptureHome.tsx` default export `CaptureHome()` (filled in by Task 6). AppShell bare mode: when `usePathname() === "/"`, render `<div className="shell is-bare">{children}</div>` plus `CommandPalette`, `GetToKnowYou`, `FirstRun` logic and the Canvas re-sync effect. Omit the rail, top bar, mobile nav, floating mic and `DesktopNotifPrompt`.

- [ ] **Step 1:** `git mv "app/(app)/page.tsx" "app/(app)/today/page.tsx"`. Move the `?capture=1` handling (around :71) out of Today, since CaptureHome owns it now.
- [ ] **Step 2:** Create the stub `app/(app)/page.tsx` and `components/capture/CaptureHome.tsx`.
- [ ] **Step 3:** Add AppShell bare mode, update the nav hrefs, and turn off the CommandPalette hold-Space recorder on `/`. Grep `href="/"`, `push("/")` and `"/"` comparisons. Only the rail logo, `not-found` and middleware keep meaning "home".
- [ ] **Step 4: Verify.** `npx tsc --noEmit` passes. `npm test` passes (179 before this branch).
- [ ] **Step 5: Commit.** `feat: capture home at /, Today moves to /today`

### Task 2: Canvas auto-clear

**Files:**
- Create: `lib/canvas-clear.ts`, `lib/canvas-clear.test.ts`
- Modify: `lib/canvas-ics.ts:85` (`IMPORT_WINDOW_DAYS = 2`, and update its doc comment)
- Modify: `lib/proactive.ts:88` (`overdueTasks` also drops `isCanvasCleared(t, today)`)
- Modify: `lib/urgency.ts` `getUrgency` (skip cleared items, using `toYMD(now)` as today)
- Modify: `app/(app)/today/page.tsx` (`doable` also drops cleared), `app/(app)/projects/[id]/page.tsx` (task lists drop cleared)
- Modify: `app/(app)/calendar/page.tsx` plus its CSS (cleared items render with class `is-cleared`: 45% opacity, no check, title not struck through)

**Interfaces:**
- Produces: `export const CANVAS_CLEAR_DAYS = 2;` `export function isCanvasCleared(task: Pick<Task, "source" | "completed" | "date">, today: string): boolean` (true iff `source === "canvas" && !completed && date <= addDaysYMD(today, -CANVAS_CLEAR_DAYS)`). `export function withoutClearedCanvas<T extends Pick<Task, "source" | "completed" | "date">>(tasks: T[], today: string): T[]`.

- [ ] **Step 1: Write failing tests** in `lib/canvas-clear.test.ts`, with today = `"2026-10-22"`:
  - canvas, incomplete, date `"2026-10-20"` → `true`
  - canvas, incomplete, `"2026-10-21"` → `false`
  - canvas, incomplete, `"2026-10-01"` → `true`
  - canvas, **completed**, `"2026-10-01"` → `false`
  - non-canvas (`source` undefined), `"2026-10-01"` → `false`
  - Month boundary: today `"2026-11-01"`, date `"2026-10-30"` → `true`; date `"2026-10-31"` → `false`
  - `withoutClearedCanvas` keeps order and removes only the cleared items
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Implement it, importing `addDaysYMD` from `./time`. Apply it in every file listed above.
- [ ] **Step 4:** `npm test` → PASS. `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit.** `feat: Canvas items clear 2 days after they're due`

### Task 3: Four category colors and the capture list

**Files:**
- Modify: `lib/task-colors.ts`. Create `lib/task-colors.test.ts`. Switch its type import to `./types`.
- Create: `lib/capture-list.ts`, `lib/capture-list.test.ts`
- Modify: `app/globals.css` (add `--cat-canvas/--cat-academic/--cat-ec/--cat-other` next to every block that defines `--kind-school`, plus dark-theme values with enough contrast on `--surface`, e.g. `#ff7a52 / #9a8cff / #4cc38f / #6e6890`)
- Modify the callers: `app/(app)/today/page.tsx:137`, `app/(app)/projects/[id]/page.tsx:139,162`, `app/(app)/calendar/page.tsx:156` (and its `getKindColor` helper used for legends), `components/TaskDetail.tsx:135`, `components/console/chatTask.ts:43`, `components/TaskChatModal.tsx:10-15,86` (delete the local `KIND_COLOR`, use `taskColor`)

**Interfaces:**
- Produces:
  - `export type TaskCategory = "canvas" | "academic" | "ec" | "other";`
  - `export function taskCategory(task: Pick<Task, "source" | "kind">): TaskCategory`
  - `export const CATEGORY_COLOR: Record<TaskCategory, string>` (`var(--cat-*)`)
  - `export const CATEGORY_LABEL = { canvas: "Canvas", academic: "Academic", ec: "ECs", other: "Other" }`
  - `export function taskColor(task: Pick<Task, "source" | "kind">): string`. **The `plans` parameter is removed** and every caller is updated. Project color no longer drives dots.
  - Keep `KIND_LABEL`, `taskGroup` and `TASK_GROUPS` as they are.
- Produces: `export type CaptureRow = { task: Task; sub: string; overdue: boolean }` and `export function buildCaptureList(tasks: Task[], plans: Plan[], today: string): CaptureRow[]`.
  - Keep a task when it is not completed, `tracksCompletion(task)` is true, it is not `isCanvasCleared`, and either its date is ≤ `addDaysYMD(today, 14)` or it has no date.
  - Sort: overdue and today first, then by `date`, then by `time`. Undated go last.
  - `sub` is the relative day ("Today", "Tomorrow", "Overdue", or the weekday, or "Oct 30" when more than 6 days out), plus " · Canvas" for Canvas items, or " · <plan title>" when the task has a `planId`.

- [ ] **Step 1: Write failing tests.**
  - `taskCategory`:
    - `{source:"canvas", kind:"school"}` → `"canvas"`
    - `{kind:"school"}` → `"academic"`
    - `{kind:"academic-ec"}` → `"academic"`
    - `{kind:"side-ec"}` → `"ec"`
    - `{kind:"commitment"}`, `{kind:"personal"}` and `{}` → `"other"`
  - `buildCaptureList`:
    - drops completed, School Block (`kind:"school"`, no source), cleared-Canvas and 15-days-out tasks
    - orders an overdue item before today's 09:00 before tomorrow's
    - `sub` for a project task ends in `" · Robotics"`
    - **`buildCaptureList([], [], today)` returns `[]`** (Review Focus 3)
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement it. Add the tokens. Update every caller (`npx tsc --noEmit` will find any you miss).
- [ ] **Step 4:** `npm test` → PASS. Run `tsc` clean. Grep `var(--kind-` in tsx/ts files: the only matches left should be the kind-legend helpers, if any.
- [ ] **Step 5: Commit.** `feat: four task colors (Canvas, Academic, ECs, Other) and the capture list`

### Task 4: Hold gesture state machine

**Files:**
- Create: `lib/hold-gesture.ts`, `lib/hold-gesture.test.ts`

**Interfaces:**
- Produces:
  - `export const HOLD_MS = 200; export const CANCEL_DRAG_PX = 40;`
  - `export type HoldState = "idle" | "pressed" | "listening" | "sorting";`
  - `export type HoldEvent = { type: "down"; t: number; y: number } | { type: "tick"; t: number } | { type: "move"; y: number } | { type: "up"; t: number; y: number } | { type: "cancel" } | { type: "sorted" };`
  - `export type HoldEffect = "none" | "start-listening" | "open-typing" | "send" | "abort";`
  - `export function holdReducer(s: { state: HoldState; downT: number; downY: number }, e: HoldEvent): { next: typeof s; effect: HoldEffect }`
- Rules:
  - `down` in idle → pressed.
  - `tick` with `t - downT >= HOLD_MS` in pressed → listening + `start-listening`.
  - `up` in pressed (before HOLD_MS) → idle + `open-typing`.
  - `up` in listening with `downY - y > CANCEL_DRAG_PX` → idle + `abort`; otherwise → sorting + `send`.
  - `cancel` in pressed or listening → idle + `abort`.
  - `sorted` → idle.
  - **Every event in `sorting` except `sorted` is ignored** (effect `none`).

- [ ] **Step 1: Write failing tests** covering each rule:
  - tap (down t=0, up t=120) → `open-typing`
  - hold (down 0, tick 210) → `start-listening`, then up → `send`
  - drag-up cancel (down y=500, up y=450) → `abort`
  - `cancel` while listening → `abort`
  - **busy:** a `down` in `sorting` → state stays `sorting`, effect `none` (Review Focus 5)
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5: Commit.** `feat: hold-to-talk gesture state machine`

### Task 5: Capture outcomes and the `useCapture` hook

**Files:**
- Create: `lib/capture-outcome.ts`, `lib/capture-outcome.test.ts`
- Create: `components/capture/useCapture.ts`

**Interfaces:**
- Produces, in `lib/capture-outcome.ts`:
  - `export type ChatReply` (the same shape as AddFlow's `Reply` at `components/add/AddFlow.tsx:40-56`; copy it, and import `ChangeSet`/`PreviewPayload` types relatively)
  - `export type CaptureOutcome =`
    - `| { kind: "saved"; summary: string; actionId: string | null; taskId: string | null; planId: string | null; where: string }`
    - `| { kind: "duplicate"; summary: string }`
    - `| { kind: "confirm"; id: string; message: string }`
    - `| { kind: "preview"; changeSet: ChangeSet; preview: PreviewPayload }`
    - `| { kind: "question"; said: string }`
    - `| { kind: "error"; said: string }`
  - `export function outcomeFromReply(reply: ChatReply, said: string, dayLabel: (ymd: string) => string): CaptureOutcome`. Rules:
    - `confirm_required` with `pending` → confirm
    - `preview` → preview
    - message or response matching `/^Skipped \d+ duplicate/` → duplicate ("Already on your list")
    - otherwise → saved; `where` is `dayLabel(taskDate)` or the plan title or `"Your list"`
    - **`clarify` is never passed in** (the hook resolves it first)
  - `export function outcomeFromError(said: string): CaptureOutcome` → `{ kind: "error", said }`
- Produces, in `components/capture/useCapture.ts`:
  - `export function useCapture(): { capture(said: string): Promise<CaptureOutcome>; confirm(id: string, yes: boolean): Promise<CaptureOutcome | null>; freshSet: QuestionSet | null }`
  - `capture` behaviour:
    - If `routeAsk(said) === "question"`, return `{kind:"question"}` without calling the server.
    - Otherwise POST `/api/chat` with `{messages:[{role:"user",content:said}], mode:"calendar", stream:false, capture:true, clarify:true}`, plus `newProject:true` when `routeAsk` is `"project"` or `"goal"` (a goal becomes a project).
    - If the reply is `clarify`, **immediately** POST again with `answers: null`, `capture:false`, `clarify:false` (save-first), and use that reply.
    - Then `refresh()`.
    - If there's a `taskId`, `await generateQuestions(taskId, said, reply.quick === true)` and store the result in `freshSet`.
    - Map the reply through `outcomeFromReply`. Wrap everything in try/catch → `outcomeFromError`.
  - `confirm` posts `/api/confirm` like AddFlow's `resolveConfirm`.

- [ ] **Step 1: Write failing tests** for `outcomeFromReply`:
  - a task reply `{ok:true, taskId:"t1", taskDate:"2026-10-27", message:"Added."}` → saved, where `"Tue, Oct 27"` (with a stub `dayLabel`)
  - a plan reply → saved, where = plan title
  - `"Skipped 1 duplicate (already have…)"` → duplicate
  - `confirm_required` → confirm
  - `outcomeFromError("x")` → `{kind:"error", said:"x"}` (Review Focus 2)
- [ ] **Step 2:** FAIL. **Step 3:** Implement both files. **Step 4:** PASS, and `tsc` clean.
- [ ] **Step 5: Commit.** `feat: capture outcomes and save-first useCapture`

### Task 6: CaptureHome UI, island, takeover, Sorted card

**Files:**
- Modify: `components/capture/CaptureHome.tsx` (the page)
- Create: `components/capture/CaptureIsland.tsx`, `components/capture/SortedCard.tsx`, `components/capture/capture.css`
- Modify: `app/liquid-glass.css` (add `.capture-island`, `.capture-open-app`, `.capture-start` and the card chips to the glass lists)

**Interfaces:**
- Consumes:
  - Task 3: `buildCaptureList`, `taskColor`
  - Task 4: `holdReducer`, `HOLD_MS`
  - Task 5: `useCapture`, `CaptureOutcome`
  - Existing: `useVoiceCapture({ live: true, onPartial, onTranscript, onError })` → `{ status, startRecording, stopRecording, cancelRecording, getLevel }` from `hooks/useVoiceCapture.ts`; `heardSomethingToAdd` from `lib/voice-intent.ts`; `useQuestionSets()` and `answerQuestions(id, answers)` from `lib/questions-client.ts`; `openTask(id)` from `components/TaskDetail`; `ActionReceipt` (Undo); `PreviewCard` (preview fallback); `putAsk("ai", text)` from `lib/ask-handoff`; `OPEN_PALETTE_EVENT` (tap → typing).
- Produces: `CaptureIsland` props `{ state: HoldState; level: () => number; transcriptTail: string; tapToStop: boolean; onEvent(e: HoldEvent): void }`. `SortedCard` props `{ outcome: CaptureOutcome; questions: QuestionSet | null; onDismiss(): void; onRetry(said: string): void; onConfirm(id: string, yes: boolean): void }`.

Behaviour (spec §1, "Motion" sub-section; match the mockup):
- **Layout.** A centred column, `max-width: 560px`. Top bar with the wordmark and the glass "Open app →" (`/today`). "To do" in the display font at 30px, plus a count line. Rows: check (optimistic complete, like TaskRow), title, sub, dot `taskColor(task)`; the body calls `openTask(id)`. **The first row** also gets a glass "Start" button (Task 7). Empty list → "Nothing to do. Hold to add something."
- **Island.** Fixed bottom: `left/right 16px` within the column, `bottom: calc(30px + env(safe-area-inset-bottom))`, 120px tall, `border-radius: 999px`, frosted glass (`backdrop-filter: blur(22px) saturate(1.8)`, the inset highlights from the mockup). It contains the accent mic glyph (30px), the label (crossfade "Hold to talk" ↔ "Let go to add"), and a 9-bar waveform driven by `getLevel()` on rAF. The whole island is the button. "or tap to type" sits under it.
  - Pointer events: down/up/move, plus `pointercancel`, `lostpointercapture` and window `blur` → `cancel`. Also Space keydown/keyup when no form field is focused. A 50ms rAF/interval sends `tick`. Effects map to the voice hook: `start-listening` → `startRecording`; `send` → `stopRecording` (the transcript arrives in `onTranscript`); `abort` → `cancelRecording`; `open-typing` → dispatch `OPEN_PALETTE_EVENT`.
- **Takeover motion** (`motion/react`, transform/opacity/filter/clip-path only):
  - **Press:** the island scales to `0.965` (spring), then height goes to 168px with radius 52px. The inner lavender glow breathes (opacity 1 ↔ 0.55, 1.8s) and the halo ring pulses.
  - **Wash:** a fixed full-viewport layer, `clip-path: circle(0 → 150% at <island centre>)`, ~0.75s ease-out (`[0.16,1,0.3,1]`). Background `radial-gradient(120% 80% at 50% 100%, var(--lav-2), var(--lav) 55%, #f1ecff)`. Two blurred blobs drift on 7s and 9s loops.
  - **Content behind:** `scale 0.93`, `y -8`, `blur(7px)`, opacity 0.55, origin `50% 85%`.
  - **"Listening…"** label, then the live transcript from `onPartial`. Display font at 30px. Each **new** word mounts with `{opacity 0, filter blur(8px), y 10} → none` over 0.5s. Only new words animate; don't re-animate the whole string.
  - **Release (send):** the wash collapses at ~0.55s ease-in (`[0.5,0,0.75,0]`). The island goes to `sorting`: label "Sorting…", a slow lavender shimmer sweeping across the glass, and the last transcript line (one line, ellipsised) shown small above the island.
  - **Result:** new rows spring in at the top of the list (`spring, bounce ~0.35`, with a brief `0 0 0 6px` accent ring that fades). `SortedCard` rises above the island (`y 20 → 0`, scale `0.96 → 1`, spring), with its lines staggered 0.12s.
  - **Dark theme:** the wash uses a deep-violet equivalent (e.g. `#2a2150 → #3a2d70`) and must never flash white.
  - `navigator.vibrate?.(8)` on `start-listening`.
  - Reduced motion: opacity crossfades only.
- **Voice result.** `onTranscript(t)`: if `!heardSomethingToAdd(t)`, abort with no card (the island returns to idle). Otherwise `capture(t)`. Send `sorted` when it resolves.
- **SortedCard by outcome:**
  - **saved:** "Sorted", then a line with the dot, the title (look up the `taskId` in the refreshed state; fall back to the said text) and "→ where", then:
    - if `freshSet` has questions: one question at a time with option chips plus "Ask me later". Collect answers; after the last one, `answerQuestions(set.id, answers)`. "Ask me later" closes the card and leaves the set in the pile.
    - else if `useQuestionSets().sets` is non-empty: the **oldest** set's first question, prefixed "Earlier you added *{taskTitle}*:", with its chips and "Later" (spec §5).
    - else: an `ActionReceipt` Undo chip, auto-dismissing after 3.2s.
  - **duplicate:** "Already on your list", and scroll to and flash the matching row if found.
  - **confirm:** the message, plus Yes / No chips → `onConfirm`.
  - **preview:** render `PreviewCard`.
  - **question:** "Sounds like a question." with the chip "Ask Tangent →" (`putAsk("ai", said)`, `router.push("/ai?ask=1")`).
  - **error:** "Couldn't add that, try again". Tapping it re-sends `said`.
  - The card dismisses on tap outside or a downward swipe. Dismissing never unsaves anything.
- **`?capture=1`.** On mount, start listening immediately, in tap-to-stop mode (`tapToStop`: the label reads "Tap to add", and the next tap → `send`).

- [ ] **Step 1:** Build the layout and list with no motion. `npx tsc --noEmit` clean.
- [ ] **Step 2:** Island plus gesture wiring plus voice. Check that tap opens the palette and that hold → release calls `capture`.
- [ ] **Step 3:** Takeover motion, matched side by side against `capture-home-v3.html`.
- [ ] **Step 4:** SortedCard, all outcome kinds, and saved questions.
- [ ] **Step 5: Verify.** `npm test` passes and `npm run build` succeeds (with dev stopped). Check the phone layout in a same-origin 390×780 iframe if a signed-in session is available. Otherwise, say plainly that the check is pending a preview deploy.
- [ ] **Step 6: Commit.** `feat: capture home with hold-to-talk island and lavender takeover`

### Task 7: "Do it now" focus view

**Files:**
- Create: `lib/focus-timer.ts`, `lib/focus-timer.test.ts`, `components/capture/FocusView.tsx`
- Modify: `components/capture/CaptureHome.tsx` (the Start button on the first row opens FocusView), `components/capture/capture.css`

**Interfaces:**
- Produces:
  - `export const FOCUS_MINUTES = 25; export const EXTEND_MINUTES = 10; export const FOCUS_KEY = "tangent-focus";`
  - `export type FocusSession = { taskId: string; endsAt: number };`
  - `export function startFocus(taskId: string, now: number, minutes = FOCUS_MINUTES): FocusSession`
  - `export function remainingMs(s: FocusSession, now: number): number` (≥ 0)
  - `export function parseFocus(raw: string | null): FocusSession | null` (null on junk)
  - `export function firstStep(task: Pick<Task, "startAction">): string` (`startAction?.trim()` or `"Open it and do the first 5 minutes."`)
- **FocusView:** the same lavender takeover language (wash grows from the Start button). It shows the task title (display font), `firstStep`, a 25-minute countdown ring (an SVG circle, `strokeDashoffset` driven per second, rotated with an SVG `transform="rotate(-90 …)"`, **not** CSS), and the actions Done (completes the task, the wash collapses, and the row springs out of the list) and Stop.
  - Persist to localStorage under `FOCUS_KEY` inside try/catch; resume on mount if the task still exists and isn't completed.
  - At 0: the ring pulses, the copy reads "Done, or 10 more minutes?" (Done / +10). If desktop notifications are enabled (`lib/desktop-notifications.ts`), fire one notification.

- [ ] **Step 1: Write failing tests:**
  - `startFocus("t", 1000).endsAt === 1000 + 25*60000`
  - `remainingMs` clamps to 0 past the end
  - `parseFocus("nope") === null` and `parseFocus(JSON.stringify({taskId:"t", endsAt:5})).taskId === "t"`
  - `firstStep({})` and `firstStep({startAction:"  "})` → the fallback copy
- [ ] **Step 2:** FAIL. **Step 3:** Implement the lib and FocusView. **Step 4:** PASS. `tsc` and `build` clean.
- [ ] **Step 5: Commit.** `feat: Do it now focus timer on the capture home`

### Task 8: Branch verification and handoff

- [ ] **Step 1:** `npm test` (report the count), `npx tsc --noEmit`, and `npm run build` with dev stopped. All must pass. Paste the summary lines.
- [ ] **Step 2:** Grep for leftovers: `taskColor(` calls with two arguments, `href="/"` meaning Today, `var(--kind-` in dots. None should remain.
- [ ] **Step 3:** Update `docs/tangent/PROJECT.md` current state with a short bullet each for the capture home, Canvas auto-clear and the four colors, and a link to the spec. Update project memory.
- [ ] **Step 4:** Ask Juann before pushing `feat/capture-home`. Pushing a branch triggers a Vercel preview, not prod, but it's still outward-facing. Then check the preview's status via `gh api repos/Sidman-coder/Tangent-/commits/<sha>/status`, and do the phone-iframe check on the preview if it has env vars. **Merging to `main` is Juann's call.**
