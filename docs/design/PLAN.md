# Round 3 implementation plan

Phases 2–4 of the Round 3 design pass. Spec: [TANGENT-STYLE.md](TANGENT-STYLE.md). Layouts: [WIREFRAMES.md](WIREFRAMES.md). Research: [REFERENCE-NOTES.md](REFERENCE-NOTES.md). Baseline: `screens/before/` (44 captures of `/dev/app/*` and `/signin`, 1440 and 390, light and dark, sample data only).

**Ground rules:**
- Design and UI only. No changes to auth logic, the DB schema, migrations, Supabase/Vercel settings, AI planning logic (except title wording) or billing.
- Every listed feature keeps working.
- One commit per phase, never pushed.
- `npm test` stays green after every step.

---

## What exists today (inspected Nov 7, 2026)

- **Tokens:** `app/globals.css` (≈218 KB, 9,431 lines) defines theme tokens **four times**: `:root` (line 4), `[data-theme]` blocks (82–158), an "Apple pass" (~8443) and later overrides (~8603, 8727, 8810, 8899).
  - The live values are the last ones: bg `#f5f4f9` / `#0e0d14`, accent `#4b3a8c` / `#b3a5f0`, body font = the system stack (Figtree is installed but never imported), display = Bricolage.
- **Other CSS:** `app/liquid-glass.css` (28 KB) plus 20 per-feature CSS files. The largest are `components/chat/console.css` (50 KB), `capture.css` (15 KB), `today-home.css` (13 KB) and `today.css` (11 KB).
- **Existing `components/ui/`:** Button, ConfirmPanel, FormMessage, PageHeader, Select, SettingRow, SettingsSection, SidePeek, TaskRow, TaskTitle, TextField, Toggle and `settings.css`. They are reused and restyled, not duplicated.
- **Routes:**
  - `/` renders `TodayHome` (composer `AddFlow` + `HomeChat` + `TodaySlider` + `QuestionsInbox` + `TodaySections`); `/today` redirects to `/`.
  - `/capture` is the full-screen voice capture.
  - `/ai` is the Chats library; `/tangents` is the Projects list (`/path` redirects there); `/projects/[id]` is the project page.
- **Nav** (`components/AppShell.tsx`): Today(`/`) · Calendar · Projects · Chats · Settings, plus the floating mic in `LiquidGlass`.
- **Titles:** `lib/short-titles.ts` (`baseTitle`, `useShortTitles`), `lib/course.ts` (`splitCourse`, `cleanCourse`), `components/ui/TaskTitle.tsx` and `lib/plan-title.ts` (fallback `"New Plan"`).
- **Pace:** `lib/project-stats.ts` (`paceOf`, `recommendedPace`), rendered by `components/projects/ProjectStats.tsx`. It has a test file.
- **Known issues:**
  - `appleWebApp.capable` in `app/layout.tsx` emits the deprecated `apple-mobile-web-app-capable` meta.
  - `/api/notifications` is fetched 4× per page load.
  - The "@import rules must be at the top" warning was **not** reproduced in the current dev log, and no CSS file in `app/` or `components/` contains `@import`. Phase 2 re-checks it in a production build.

---

## Phase 2: design system (one commit)

Order matters: tokens first, then fonts, then components, then the shell. Each step is visually checked with the Playwright token probe (computed `--bg`, `--text`, `--accent`, `--font-body` in both themes) and a quick 1440/390 screenshot diff against `screens/before/`.

| # | Files | Change |
|---|---|---|
| 2.1 | **new** `app/styles/tokens.css`; `app/layout.tsx` | The Quick Start block from TANGENT-STYLE §13 becomes the only token source, imported **first** in `layout.tsx`. |
| 2.2 | `app/globals.css` | Delete the four competing token blocks (lines 4–158, the Apple pass, and the overrides at ~8603/8727/8810/8899) and their `prefers-color-scheme` copies. The theme stays driven by `data-theme` only. Probe: computed tokens match §13 in both themes. |
| 2.3 | `app/globals.css`, `app/liquid-glass.css`, `components/**/*.css` | Hex sweep: replace hard-coded hex/rgb with tokens (scripted `rg "#[0-9a-fA-F]{3,8}"` list, by hand per rule). Map `--neu-*`, `--cal-*` and `--kind-*` callers to `--series-*` / surface tokens, then delete those tokens. Keep the legacy aliases until Phase 4. |
| 2.4 | `app/layout.tsx` | Import `@fontsource-variable/figtree` (the package is already installed); fonts set through tokens only. Replace `appleWebApp.capable` with `other: { "mobile-web-app-capable": "yes" }` (keep `title` and `statusBarStyle`). Set `theme-color` to `#f7f6fb` / `#121119`. Add `interactive-widget=resizes-content` to the viewport. |
| 2.5 | `components/ui/` | Restyle and extend: **Button** (variants primary/secondary/ghost/danger/danger-quiet, sizes md/sm, loading), **IconButton** (new; required `label`), **Chip** (new: filter/project/meta/status), **SegmentedTabs** (new: pill + underline variants, Motion `layoutId`, arrow keys), **TaskRow** (restyle: checkbox, stripe, time, hover actions, swipe on touch), **GroupHeader** (new: project + time-of-day variants), **Card** (new: plain/outlined/muted), **Sheet** (new: bottom sheet on phone, side sheet on desktop; focus trap; the old `SidePeek` becomes a thin wrapper), **Toast** (new stack; `UndoToast` and `NotificationToasts` render through it), **EmptyState** (new), **Skeleton** (new, 150ms delay), **ProgressPace** (new), **Composer** (move `components/console/Composer.tsx` styling onto the new spec; one component for Home and every chat). CSS lives in one `components/ui/ui.css` with a `ui-` class prefix, loaded after `globals.css`. |
| 2.6 | `components/AppShell.tsx`, `components/LiquidGlass.tsx`, `app/liquid-glass.css`, `components/NotificationBell.tsx` | Shell: the sidebar spec (Home first, PROJECTS list, bell/Settings/user at the bottom) and the phone bottom bar (5 items, 12px labels, safe areas, not floating). Remove the global mic FAB; add the scoped phone FAB on Calendar and the Projects list. Glass only on the two bars, with `@supports` and reduced-transparency fallbacks. Delete the unused `liquid-glass.css` rules after a grep for each class. Notifications open in the Sheet. |
| 2.7 | all `input`, `select`, `textarea` | Every form field gets an `id` or `name` (grep-driven); labels linked. |
| 2.8 | `components/MotionProvider.tsx` | `reducedMotion="user"`; duration constants read from the motion tokens. |

**Safe replacement rule for the old CSS:** never delete a selector until a grep over `app/`, `components/` and `lib/` finds no `className` that uses it. Delete in sections, one section heading of `globals.css` at a time. After each section, run the screenshot check for the screens that used it. New styles never use `!important`; specificity stays flat (a single class).

**Commit:** "v3 R3 Phase 2: tokens, fonts, ui components, app shell".

---

## Phase 3: screen fixes (one commit)

| # | Screen | Files | Change |
|---|---|---|---|
| 3.1 | **Home / Capture** | `components/today/TodayHome.tsx`, `TodaySlider.tsx` (removed), `TodayFilter.tsx` (→ SegmentedTabs), `components/add/*`, `components/chat/HomeChat.tsx`, `components/dashboard/QuestionsInbox.tsx`, `components/today/useSetupLeft.ts` | One Composer with live words and the **Auto ▾** destination pill (absorbs `AddFlow` destination + the slider's "Send to"). View tabs All/School/Projects/Personal (wrapping the existing `lib/task-filters.ts`), remembered in localStorage. Grill + "Finish setting up" merge into one dismissible line that expands to the existing cards. `/` stays the landing page; the nav item is renamed "Home". |
| 3.2 | **Today list** | `components/today/TodaySections.tsx`, `TodayRow.tsx`, `lib/today-sections.ts` (+ test), `components/dashboard/FreshStart.tsx` | Past due = last 3 days (red for fixed and reminders, amber "Planned for Mon" for flexible), collapsible, Fresh start for older. Groups Morning/Afternoon/Evening/Night/Anytime with a Now line; only today's tasks; done faded; must-do stripe; then by project inside each group. Coming up = the next 3 days, collapsed. The grouping logic is pure and tested in `lib/today-sections.ts`. |
| 3.3 | **Short titles** | **new** `lib/clean-title.ts` + `lib/clean-title.test.ts`; `lib/short-titles.ts`, `lib/course.ts`, `components/ui/TaskTitle.tsx`; prompts in `lib/ai/plan.ts`, `lib/ai/split.ts`, `lib/pipeline/extend-plan-prompt.ts`, `lib/pipeline/intent-prompt.ts`; `lib/plan-title.ts`; fixtures in `lib/pipeline/fixtures/` | `cleanTaskTitle(raw, { projectName?, course? }) → { title, course }`: strips the bracketed course/teacher/section suffix, the project-name prefix, a trailing period and extra whitespace; it never returns empty (falls back to the raw text). Display-only: task detail shows the original. Prompt wording asks for 2–6 word, verb-first titles without the project name. `LAST_RESORT_PLAN_TITLE` becomes "New project". 10+ title fixtures added to the Round 2 eval set. **Not run** (paid); the command for the user: `npm run eval:pipeline -- --round2`. |
| 3.4 | **Project page** | `app/(app)/tangents/[pathId]/page.tsx`, `app/(app)/projects/[id]/page.tsx`, `components/projects/ProjectStats.tsx`, `project-stats.css`, `lib/project-stats.ts` (+ test) | Chips replace "Assumed —"; "How this was planned" collapsed card. Groups This week / Next week / Later; no ECs tags. ProgressPace with week dots and whole-number copy; "On track" only when `paceOf` says so; "Starts Tue, Nov 17" before the first step. **Rounding fix** in `paceOf`/`recommendedPace` (integers via `Math.ceil` for needed steps), with a regression test for the `1.5135…` case. Side cards trimmed; Delete → inline ConfirmPanel. |
| 3.5 | **Chat** | `components/console/ChatThread.tsx`, `Composer.tsx`, `Markdown.tsx`, `chat-ux.css`, `components/chat/ChatSheet.tsx`, `ChatPanel.tsx`, `TaskChatSheet.tsx`, `console.css`, `app/(app)/ai/page.tsx` | The Claude/ChatGPT layout from the style guide: typing dots, auto-scroll + Jump to latest, Enter/Shift+Enter, composer above the keyboard, a Done control, preview cards that fit. Library: linear rows, search, underline tabs, empty and no-results states, hover/swipe delete through ConfirmPanel. One scroller per view (remove inner `overflow:auto` doubles). |
| 3.6 | **Other** | `app/(app)/calendar/page.tsx`, `components/calendar/*`, `components/preview/PlanCalendarPreview.tsx`, `components/PreviewWeek.tsx`, `components/settings/*`, `app/(app)/settings/*`, `app/(auth)/signin/page.tsx`, `app/(auth)/invite-only/page.tsx`, `components/TaskDetail.tsx`, `components/NotificationBell.tsx` | Calendar: phone 3-day/agenda, the start hour from school start or 7 AM, tinted blocks, a collapsible all-day row, a top toolbar. Settings: SettingRow/Card/Button only, underline tabs on phone, one H1. Sign-in/invite-only: restyle only, card first on phone. Plan preview at 390: month first + the day list. Task detail and notifications: the Sheet. |

**Commit:** "v3 R3 Phase 3: Home, Today, short titles, project page, chat, calendar, settings, sign-in".

---

## Phase 4: no-bugs pass (one commit)

- Re-capture every `/dev/app/*` page plus `/signin` at 1440 and 390 in light and dark into `screens/after/`, using the same names as `before/`. Add a before/after table to `docs/tangent/audits/2026-11-ui-audit.md`.
- Run the checklist from the brief with Playwright scripts. Each item is pass/fail in the audit:
  - horizontal scroll, overlap and clipping (bounding-box checks)
  - truncation
  - 44px targets (an element-size scan)
  - focus rings (tab through each page)
  - console errors and warnings
  - `window.confirm` / `alert` (grep)
  - contrast (computed colors against the token table)
  - heading order
  - unlabelled icon buttons
  - reduced motion (emulated)
  - safe areas, keyboard and nav overlap at 390
  - repeated fetches (the network log: `/api/notifications` deduped to one fetch with a shared hook)
  - CLS (a PerformanceObserver)
- Remove the legacy aliases and dead CSS that no caller uses.
- `npm run build` and `npm test`.

**Commit:** "v3 R3 Phase 4: UI audit, after screenshots, cleanup".

---

## Risks and how they are contained

| Risk | Containment |
|---|---|
| Deleting the token blocks changes colors on screens not yet restyled | Phase 2.1 maps every old name to a new value, so old rules keep resolving; the probe and screenshots catch surprises |
| A dead-looking selector is used by a dynamic `className` | Grep for each class's stem as well as the full name (for template strings like `` `pstats-${…}` ``) before deleting |
| Moving `AddFlow`/`HomeChat` into one Composer breaks capture or Pipeline V2 | The data and handlers stay in place; only the markup is unified. Test it through the dev pages (`preview`, `ai`, `grill`) and the existing pipeline tests |
| Swipe gestures conflict with vertical scroll | Horizontal-intent threshold (16px, angle < 30°), the same pattern as `lib/hold-gesture.ts`; a tap and the detail sheet are always available |
| Low memory on this machine (dev server OOM earlier) | One dev server only; Playwright reuses one browser; clear `.next` if chunks go missing |

---

## Open points to confirm at approval

1. **Home = Today on one screen.** `/` stays the landing page with the composer, view tabs and today's list. The nav item is called **Home**, and there is no separate Today nav item. `/capture` stays as the full-screen voice capture, reached from the phone mic FAB with a long-press and from PWA shortcuts. It is not in the nav.
2. **Phone nav:** Home · Calendar · Projects · Chats · Settings, with the bell in the top bar.
3. **Accent shifts** from the muted `#4b3a8c` to the clearer `#5641b8` in light (white text 7.4:1). Dark stays `#b3a5f0`.
4. **Dark theme** moves from near-black `#0e0d14` to slate-violet `#121119` and keeps its structure.
5. **Body font** becomes Figtree (already a dependency) instead of the system stack.
