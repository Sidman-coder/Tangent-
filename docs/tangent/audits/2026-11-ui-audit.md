# Tangent v3 Round 2: UI and quality audit

Date: 2026-11-04. Branch `v3-core-loop`, commit `ad8a0bc`. Nothing was changed while auditing.

Severity: **Critical** = a student can't use a core screen. **High** = a real fault most students will meet, or a blocker for publishing. **Medium** = visible or risky, with a workaround. **Low** = polish.

## How this was checked, and what it could not cover

Checked in a running dev server at 1440px and 390px, light and dark, measured in the DOM (overflow, control sizes, accessible names, contrast, fonts, radii) and with screenshots:

- `/signin` and `/invite-only`, signed out.
- `/dev/capture` and `/dev/app/{today,calendar,projects,school,settings,ai}`. These render the real components with sample data and no session, so server-loaded parts show empty or error states.

Baseline, run while auditing: `npm run build` passes, `npm test` passes 482 of 482.

**Not verified. Treat these as open until someone checks them:**

| Limit | Why | Effect on this audit |
|---|---|---|
| **No signed-in run** | Dev, Preview and Production share one Supabase project, sign-in is invite-only, and the dashboard and `.env.local` are off-limits. I did not sign in or create an account. | Real data, real API responses, AI flows, undo, and per-page signed-in console output weren't exercised. Findings about them come from reading the code. |
| No preview route | `/projects/[id]`, `/tangents`, `/tangents/[pathId]`, the first-run flow, and the task detail modal open state | Code review only. |
| No real phone | Emulation only | Notch, safe areas, on-screen keyboard and install flow are by code only. |
| Contrast tool | Reads `background-color` only, ignores gradients. The list per page was capped at 10. | Numbers on gradient buttons are best case. Lists are samples, not complete. |
| Console buffer | Keeps recent messages only. Everything sampled was 401 from having no session. No "Warning" or "hydrat" matches were retained. | "No other console errors" can't be claimed page by page. |
| Keyboard | Sampled the first stops on Today and `/signin`, not a full walk. | Modals by code only. |

Cleared as measurement artifacts, not bugs: the Browser pane was hidden, which stalls `motion` entrance animations until a paint is forced. Blank AI panel, calendar gap at 390, faded "Hold to talk" and an empty dark Today list all went away after a forced paint. Also cleared: `attention-chip` 1.2:1 in dark and `week-strip-name` 1.2:1 in light (the tool couldn't parse `color(srgb …)` and `oklab(…)`), the second mic on the dev AI page (the real gate checks `pathname.startsWith("/ai")`, and the dev route is `/dev/app/ai`), and nine fetches that first looked unhandled (each has a catch within a few lines).

## Summary by severity

| Severity | Count | Biggest item | Fixed in |
|---|---|---|---|
| Critical | 1 | Sign-in unreadable in dark theme | G (small; can land first) |
| High | 11 | Today fails the 3-second rule; no error boundaries; contrast tokens; primary controls under 44px | A, D, E, G |
| Medium | 21 | Duplicate mics, plan/project naming, jargon in errors, noisy logs | A, D, E, F, G |
| Low | 13 | Polish and leftovers | G or Known issues |

## Findings

### Critical

**C1. Sign-in and invite-only pages are unreadable in dark theme.** `app/(auth)/auth.css` hard-codes a white card (`rgb(255 255 255 / 0.78)`) and has no dark rules, while `--text` and `--muted` flip to light. The theme key survives sign-out, so a student who uses dark mode and signs out gets this page. Measured at 390 and 1440: heading 1.5:1, lede 1.5:1, label 1.5:1, divider 2.2:1, "Continue with Google" 2.0:1, "Email me a code" 2.5:1. `/invite-only`: heading, lede and list 1.5:1, link 1.3:1. The feature icons are close to invisible. **Phase G.**

### High

| # | Finding | Evidence | Phase |
|---|---|---|---|
| H1 | **Today fails the 3-second rule.** Composer, two chip rows and a setup pill come before any task; each card has two rows of buttons. | 1440: list starts about 470px down at 900 tall. 390: first task about 55% down, about 1.5 tasks fit above the nav. | A |
| H2 | **No `error.tsx`, `global-error.tsx` or `loading.tsx` anywhere.** Only `app/not-found.tsx` exists. Any render error shows Next's default screen. | File search of `app/`. | G |
| H3 | **Muted text fails AA in light theme on every page.** `--text-3 #7d7797` and `--text-2` on translucent surfaces. | 3.2 to 3.5:1 at 11–13px: rail "Settings", "3 left", calendar hour labels, school "1 due this week", settings descriptions, composer hints, capture filter labels. | G (tokens), checked in every phase |
| H4 | **Dark theme primary button labels fail AA.** `app/liquid-glass.css` forces `color: #fff` over `--accent-ink` (`#17132a` in dark) on lilac. | 3.4–3.5:1 before the white gradient, which lowers it further: "New project", "Start tour", "Connect", "Your Brief". | G |
| H5 | **Primary controls under 44px throughout.** | `tg-send` 11×14 (a bare icon), toggles 52×28, checks 22×22, chips 34, arrows 32, `ui-button` 38, rail buttons 40, settings anchors 34, `project-back` 65×16. Settings: 40 of 42 controls under 44. | A (Today, rows), D (chat), E (Settings), G (rest) |
| H6 | **`window.confirm` guards destructive actions.** `settings/page.tsx:171` (delete data), `SecuritySettings.tsx:237` (sign out everywhere). | Code. | E |
| H7 | **`viewport-fit=cover` is missing** while `globals.css` uses `safe-area-inset` 4 times and the app declares `appleWebApp.capable`. The insets evaluate to 0, so the installed app can sit under the notch and home bar. | `app/layout.tsx`. Phone not tested. | G |
| H8 | **Bottom nav labels are 9px at 3.4:1** on every phone page. | Measured at 390. | G |
| H9 | **Project page faults.** Copy says "Add more above" with no add box; delete has no error handling; loading is a blank `aria-busy` div. | `projects/[id]/page.tsx`, code only. | D |
| H10 | **Student-facing errors expose internals.** `describeFailure` (`ai/page.tsx:119,122`) and raw `Something went wrong: ${message}`; `api/chat/route.ts:153`, `api/path/route.ts:454,534` name `ANTHROPIC_API_KEY`. | Code. | D (AI page), G (routes) |
| H11 | **The invite-only explanation starts about 664px down on a phone**, under the marketing list. Same for the sign-in card. A student who wasn't invited may not see why. | Measured at 390. | G |

### Medium

| # | Finding | Phase |
|---|---|---|
| M1 | Two mics on a phone Today: the composer's and the floating `CaptureMic`, which also covers content (Settings text, School row, the sixth capture row). | A |
| M2 | Filter chips repeated on Today and Capture, always visible, 34px tall. | A |
| M3 | "Ask" appears on some rows only, which shifts Done's width. | A |
| M4 | Card nested in card on Today. | A |
| M5 | `TaskRow.shortDate` and `TaskDetail.longDate` use the browser's timezone, not the student's. | A |
| M6 | Calendar at 390: two floating bars and the nav take about 200 of 844px, rows show through the gap. Hour labels start at 1 AM. | G |
| M7 | School page: stats come before the task list on a phone; "On track" beside "0 done" and "0%" reads as false comfort. | D, F.1 |
| M8 | Project stats pace is approximate: `doneLast7` counts tasks by due date, because tasks don't record completion. | F.1 |
| M9 | Plan vs project naming: `calendar/page.tsx:567` "Filtering by plan:", `AiActivity:209,316`, `GrillDeck:60`, `HelpPlanBetter:42`. | G |
| M10 | Three names for the AI: "Tangent AI", "Ask Tangent", "Tangent". | D |
| M11 | `/api/sessions` returns raw `e.message` on 500 and doesn't validate `role`. | D |
| M12 | `TaskDetail`: no focus trap; toggle and remove ignore failures; no receipt on toggle. | A, G |
| M13 | Repeated fetches on Today in dev: `/api/notifications` 3×, `/api/health` and `/api/questions` 2×. Part is strict mode; not measured in production. | G |
| M14 | `/api/health` is fetched on every load to read `hasAnthropicKey`. | G |
| M15 | 192 `console.*` calls in 47 files. Sampled logs hold ids, counts and timings, not student text, but `e.message` and `lib/voice-handler.ts:1277,1294` parse errors could carry model text. | G |
| M16 | Settings: anchor nav runs off the right at 390; mixed button styles; heights 20, 28, 32, 40, 58. | E |
| M17 | Too many type sizes: Today uses 10 (11 to 28), Calendar goes down to 10.5, AI to 9. | A (Today), G |
| M18 | No stored week start. Calendar starts Sunday, preview Monday, `endOfWeek` treats Sunday as the end. | B |
| M19 | Client export in `YourDataSection` assembles JSON in the browser; `/api/sessions` list may omit messages, so the export can be incomplete. | E |
| M20 | Sign-in on a phone: marketing list pushes the card to about y=664. | G |
| M21 | Placeholder copy varies by screen ("Add a task, a project, or ask anything", "Add anything, or ask", "Add or change something on your calendar…"). | A, D; finished in Round 3 Phase 4 |

### Low

| # | Finding | Phase |
|---|---|---|
| L1 | `/path` is a legacy redirect; `/tangents` has no nav link but is reachable from AddFlow. Confusing rather than broken. | Known issue, raise as a decision |
| L2 | `/signin` copy "Map the path…" describes a hidden feature. | G |
| L3 | Theme ignores the OS preference: unset means light. | Known issue |
| L4 | `desktop` state starts true, so a phone can flash desktop UI. | G |
| L5 | `composerInView` polls every 400ms. | A |
| L6 | 14 `outline: none` rules to review (sampled focus rings are visible, 2px). | G |
| L7 | `notif-bell-btn` and `add-mic` lack `font: inherit` (icon-only, so no visible fault). | G |
| L8 | Hard-coded hex in TSX: `app/layout.tsx`, `ChatSidebar`, `PathAmbient`, `TangentLogo`. | G where touched |
| L9 | Stale comment "in-memory store" in the AI page. | D |
| L10 | Stale docs: `PROJECT.md` lists old default models; code is on Haiku 5.5 and Sonnet 5.5. | F.4 |
| L11 | `events` rows are insertable by students through REST, so analytics aren't tamper-proof. Acceptable for a pilot. | Known issue |
| L12 | Small asymmetry in Projects gutters at 390 (16px left, about 9px right); not confirmed. | G |
| L13 | Entrance animations start at opacity 0 with blur; a stalled tab looks blank. | Known issue |

## By audit area

**1. Page inventory.**

| Route | Purpose | Note |
|---|---|---|
| `/` | Capture home: to-do list and mic | Becomes Today in Phase A |
| `/today` | Today, with AddFlow | Duplicates `/` in purpose |
| `/calendar`, `/projects`, `/projects/[id]`, `/projects/school` | Calendar, projects, School card | |
| `/ai` | Single chat with Brief | Becomes the Chats library in D |
| `/settings` | One long page with anchors | Split in E |
| `/tangents`, `/tangents/[pathId]` | Long-term paths | No nav link (L1) |
| `/path` | Redirect to `/tangents` | Legacy (L1) |
| `/signin`, `/invite-only`, `/auth/confirm` | Sign-in | C1, H11 |
| `/dev/*` | Dev previews | Blocked outside development by middleware |

**2. Visual consistency.** H3, H4, H5, M4, M16, M17, M21. No horizontal page scroll and no clipped text found on any previewed page.

**3. Broken or unclear behavior.** H2, H9, H10, M12. Console: only 401s in the previews, with the limit above. Buttons that do nothing: none found in previews, but most buttons need a session, so this is not cleared.

**4. Accessibility.** No unlabelled controls on any previewed page. C1, H3, H4, H5, H8. Focus rings visible where sampled; tab order sensible; skip link present. Reduced motion handled by `MotionConfig reducedMotion="user"` and 14 CSS rules.

**5. Mobile.** No horizontal scrolling. H7, H8, H11, M1, M6. Keyboard covering inputs: not verified.

**6. Copy.** H10, M9, M10, M21, L2. No typos found in what I read.

**7. Performance.** First Load JS: `/settings` 232 kB, `/calendar` 189 kB, `/today` 176 kB, `/ai` 168 kB, `/signin` 163 kB, `/` 155 kB; shared 87.7 kB. `/settings` is the outlier and Phase E's split should reduce it. Time to interactive by eye was not meaningful in a dev server with no session. M13, M14.

**8. Security and privacy.** No secrets in client code; no `NEXT_PUBLIC_`, service-role or Anthropic key use in components or hooks. Every `app/api/**/route.ts` uses `withUser` or cron auth; `lib/cron-auth.ts` fails closed. RLS is on for all 23 tables. H10 and M15 are the gaps. Nothing Critical.

## Review notes

### Phase A — Today and task commitments (2026-11-05)

- Reviewed the inherited Phase A changes, the new task grouping and classification tests, and the migration fallback paths. `npm test` passed with 573 tests; `npx tsc --noEmit` passed after fixing three incomplete imports/expressions. `npm run build` passed outside the filesystem sandbox after its generated `.next` writes were denied in the sandbox.
- Viewed Today at 390px and 1440px in both themes on `/dev/app/today`. The sections, input and navigation fit without horizontal scrolling. The sample route returns 401 for account APIs because it has no session, so its console is not clean; that route still needs API mocking for meaningful interaction checks. Signed-in saves, real email, phone safe areas, and Supabase behavior need the manual checks in `docs/MANUAL-STEPS.md`.
- Follow-up: added tests for the scheduling rules (2 flexible steps per project per day, the packed-day note, the 15-minute buffer around fixed items, preferred work times) and for undo snapshots of task type. The Today slider's arrows and page dots now have 44px targets. `/dev/app/color` shows the project color picker; with no session its save fails, the old color comes back and the error shows. Warning text measured 5.5:1 or better on its row backgrounds in both themes.
- Phase A's code, build, and sample UI review are complete. The remaining audit findings stay assigned to Phases B–G; the sample route's 401 console noise and real account checks remain open.

### Phase B — Plan preview (2026-11-05)

- The plan preview opens to Month and supports Week, date navigation, and a mobile day sheet. Calendar and the preview use the stored week start when available.
- Verified the seven-column sample preview at 390px and 1440px in light and dark themes without horizontal scrolling. On mobile, the day sheet showed new and existing tasks and opened the selected week. The development shell still makes unauthenticated requests that return 401.
- `npm test` passed all 578 tests and `npm run build` passed. Signed-in confirmation and the week start migration still need the checks in `docs/MANUAL-STEPS.md`.

### Phase C — Context engine, Grill until enough (2026-11-05)

- `lib/context/` scores what Tangent knows per project (weighted slots, 0.7 drafts), infers slots from the request by rules (one FAST model call only for long, unclear asks), and picks one template question at a time: deadline and hours first, the once-ever work-time question next, a check-in after five in a row. Skipped deadline or hours become stated assumptions (2 weeks, 3 hours a week). Answers are saved to `context_slots` and mirrored into What Tangent knows; preferred work times feed placement windows.
- AddFlow opts in with `slotFlow`; other surfaces keep the older clarify questions, and AddFlow falls back to them before the migration or when the request may belong to an existing project.
- `/dev/app/grill` shows the card. At 390px and 1440px in both themes it fits without horizontal scrolling, every control is 44px tall, multi-select chips report `aria-pressed`, and the bar is a labelled progressbar. `npx tsc --noEmit` passed and `npm test` passed all 593 tests. The signed-in flow needs migration 4 and the check in `docs/MANUAL-STEPS.md`; PGlite was not available, so the migration was not run locally.

### Phase D — Chats where they belong (2026-11-05)

- Chats now open over the page they are about: Home's "Ask Tangent anything" bar (general), "Ask about this" on a task (one thread per task), and a project's Ask button (the plan's thread, reusing `chat_sessions.plan_id`). Each is a right-hand panel on a laptop and full screen on a phone, with focus moved into the composer and returned on close. `/ai` became the chat library: search, All/Projects/Tasks/General tabs, colored by project, with a two-step delete. Old `/ai?project=`, `?task=` and `?ask=1` links redirect.
- Each scoped chat gets the task or project context; a running summary is refreshed after longer threads. General chats are capped at the 50 most recent; task and project threads are kept. Rename, pin and color of chats were not carried over; the library only lists, opens and deletes.
- Verified on `/dev/app/today` and `/dev/app/ai` at 390px and 1440px in both themes: no horizontal scroll, header and tab targets 44px, Esc closes and focus returns to the opener. The project panel has no sample route and is covered by types only. `npx tsc --noEmit` passed and `npm test` passed all 607 tests. Signed-in threads need migration 5 and the check in `docs/MANUAL-STEPS.md`.

### Phase G — Audit fixes and release check (2026-11-05)

- Already fixed before Round 2's phases (commit `8ee5be9`): C1 (sign-in and invite-only follow the dark theme), H3 (muted text tokens), H4 (primary button labels use `--accent-ink`), H7 (`viewport-fit=cover`).
- Fixed in Phase G:
  - **H2:** `app/error.tsx` (retry and back to Today, never shows the error text), `app/global-error.tsx`, and `app/(app)/loading.tsx` with a reduced-motion-safe indicator.
  - **H5 (rest):** the notification bell is 44px in every style (it was 34, 40 and 42 in three rules); error-page buttons are 44px.
  - **H8:** bottom nav labels are 11px in `--text-2` (measured about 8:1 in dark at 390).
  - **H9:** the project page shows "Loading project…" or a "this project isn't here" message instead of a blank div, shows an error if delete fails, and no longer says "Add more above".
  - **H10:** chat and path routes no longer name `ANTHROPIC_API_KEY` to students; the chat panel's fallback no longer shows raw error text.
  - **H11, M20:** on phones (600px and under), the feature list on sign-in and invite-only is hidden, so the card or the reason comes right after the headline.
  - **M9:** Calendar says "Filtering by project". **M10:** the last "Tangent AI" in copy is now "Tangent". **L2:** the sign-in point about paths now describes projects. **L7:** the bell has `font: inherit`.
  - Leftovers: Fresh start is hidden when there is nothing to move. `window.confirm` is gone from the app (H6). The task type note already resets when another task opens.
- Release check: `npx tsc --noEmit` clean, `npm test` 621/621, `npm run build` passed. Browser check on `/signin` and `/dev/app/today` at 390 and 1440, light and dark: no horizontal scroll, bell 44×44, nav labels 11px, sign-in card in the first screen on a phone. The error boundary was checked by build and types only, not by forcing an error.

### Round 3 — Design and UI pass (2026-11-07)

Round 3 restyled every student-facing screen (Quiet Violet: accent `#5641b8`, dark background `#121119`, Figtree) without changing auth logic, the schema, AI planning or billing. Phase 1 recorded references, before screens and wireframes in `docs/design/`; Phase 2 added tokens, fonts, `components/ui/` and the app shell; Phase 3 rebuilt Home, Today, project, chats, calendar, settings and sign-in on them; Phase 4 is this audit.

**Before and after.** Same routes, same sample data, same sizes (1440×900 viewport and a 390×844 full-page capture), light and dark. 44 screens each.

| Page | Route | Before | After |
|---|---|---|---|
| Home (Today) | `/dev/app/today` | [1440 light](../../design/screens/before/today-1440-light.png) · [1440 dark](../../design/screens/before/today-1440-dark.png) · [390 light](../../design/screens/before/today-390-light.png) · [390 dark](../../design/screens/before/today-390-dark.png) | [1440 light](../../design/screens/after/today-1440-light.png) · [1440 dark](../../design/screens/after/today-1440-dark.png) · [390 light](../../design/screens/after/today-390-light.png) · [390 dark](../../design/screens/after/today-390-dark.png) |
| Calendar | `/dev/app/calendar` | [1440 light](../../design/screens/before/calendar-1440-light.png) · [1440 dark](../../design/screens/before/calendar-1440-dark.png) · [390 light](../../design/screens/before/calendar-390-light.png) · [390 dark](../../design/screens/before/calendar-390-dark.png) | [1440 light](../../design/screens/after/calendar-1440-light.png) · [1440 dark](../../design/screens/after/calendar-1440-dark.png) · [390 light](../../design/screens/after/calendar-390-light.png) · [390 dark](../../design/screens/after/calendar-390-dark.png) |
| Projects | `/dev/app/projects` | [1440 light](../../design/screens/before/projects-1440-light.png) · [1440 dark](../../design/screens/before/projects-1440-dark.png) · [390 light](../../design/screens/before/projects-390-light.png) · [390 dark](../../design/screens/before/projects-390-dark.png) | [1440 light](../../design/screens/after/projects-1440-light.png) · [1440 dark](../../design/screens/after/projects-1440-dark.png) · [390 light](../../design/screens/after/projects-390-light.png) · [390 dark](../../design/screens/after/projects-390-dark.png) |
| School project | `/dev/app/school` | [1440 light](../../design/screens/before/school-1440-light.png) · [1440 dark](../../design/screens/before/school-1440-dark.png) · [390 light](../../design/screens/before/school-390-light.png) · [390 dark](../../design/screens/before/school-390-dark.png) | [1440 light](../../design/screens/after/school-1440-light.png) · [1440 dark](../../design/screens/after/school-1440-dark.png) · [390 light](../../design/screens/after/school-390-light.png) · [390 dark](../../design/screens/after/school-390-dark.png) |
| Chats | `/dev/app/ai` | [1440 light](../../design/screens/before/chats-1440-light.png) · [1440 dark](../../design/screens/before/chats-1440-dark.png) · [390 light](../../design/screens/before/chats-390-light.png) · [390 dark](../../design/screens/before/chats-390-dark.png) | [1440 light](../../design/screens/after/chats-1440-light.png) · [1440 dark](../../design/screens/after/chats-1440-dark.png) · [390 light](../../design/screens/after/chats-390-light.png) · [390 dark](../../design/screens/after/chats-390-dark.png) |
| Plan preview | `/dev/app/preview` | [1440 light](../../design/screens/before/plan-preview-1440-light.png) · [1440 dark](../../design/screens/before/plan-preview-1440-dark.png) · [390 light](../../design/screens/before/plan-preview-390-light.png) · [390 dark](../../design/screens/before/plan-preview-390-dark.png) | [1440 light](../../design/screens/after/plan-preview-1440-light.png) · [1440 dark](../../design/screens/after/plan-preview-1440-dark.png) · [390 light](../../design/screens/after/plan-preview-390-light.png) · [390 dark](../../design/screens/after/plan-preview-390-dark.png) |
| Settings | `/dev/app/settings` | [1440 light](../../design/screens/before/settings-1440-light.png) · [1440 dark](../../design/screens/before/settings-1440-dark.png) · [390 light](../../design/screens/before/settings-390-light.png) · [390 dark](../../design/screens/before/settings-390-dark.png) | [1440 light](../../design/screens/after/settings-1440-light.png) · [1440 dark](../../design/screens/after/settings-1440-dark.png) · [390 light](../../design/screens/after/settings-390-light.png) · [390 dark](../../design/screens/after/settings-390-dark.png) |
| Settings: AI activity | `/dev/app/settings-activity` | [1440 light](../../design/screens/before/settings-activity-1440-light.png) · [1440 dark](../../design/screens/before/settings-activity-1440-dark.png) · [390 light](../../design/screens/before/settings-activity-390-light.png) · [390 dark](../../design/screens/before/settings-activity-390-dark.png) | [1440 light](../../design/screens/after/settings-activity-1440-light.png) · [1440 dark](../../design/screens/after/settings-activity-1440-dark.png) · [390 light](../../design/screens/after/settings-activity-390-light.png) · [390 dark](../../design/screens/after/settings-activity-390-dark.png) |
| Settings: What Tangent knows | `/dev/app/settings-context` | [1440 light](../../design/screens/before/settings-context-1440-light.png) · [1440 dark](../../design/screens/before/settings-context-1440-dark.png) · [390 light](../../design/screens/before/settings-context-390-light.png) · [390 dark](../../design/screens/before/settings-context-390-dark.png) | [1440 light](../../design/screens/after/settings-context-1440-light.png) · [1440 dark](../../design/screens/after/settings-context-1440-dark.png) · [390 light](../../design/screens/after/settings-context-390-light.png) · [390 dark](../../design/screens/after/settings-context-390-dark.png) |
| Capture | `/dev/capture` | [1440 light](../../design/screens/before/capture-1440-light.png) · [1440 dark](../../design/screens/before/capture-1440-dark.png) · [390 light](../../design/screens/before/capture-390-light.png) · [390 dark](../../design/screens/before/capture-390-dark.png) | [1440 light](../../design/screens/after/capture-1440-light.png) · [1440 dark](../../design/screens/after/capture-1440-dark.png) · [390 light](../../design/screens/after/capture-390-light.png) · [390 dark](../../design/screens/after/capture-390-dark.png) |
| Sign-in | `/signin` | [1440 light](../../design/screens/before/signin-1440-light.png) · [1440 dark](../../design/screens/before/signin-1440-dark.png) · [390 light](../../design/screens/before/signin-390-light.png) · [390 dark](../../design/screens/before/signin-390-dark.png) | [1440 light](../../design/screens/after/signin-1440-light.png) · [1440 dark](../../design/screens/after/signin-1440-dark.png) · [390 light](../../design/screens/after/signin-390-light.png) · [390 dark](../../design/screens/after/signin-390-dark.png) |

The Chats sample shows its "couldn't load" state before and after: `/dev/app/ai` has no session, so `/api/sessions` returns 401. The signed-in list was not checked.

**UI checklist, Phase 4.** Run on the 10 routes above at 390 and 1440 in a dev server.

| Check | Result |
|---|---|
| Horizontal page scroll | None (scroll width equals client width on all 20 runs). |
| One `h1` per page | Yes on all 20 runs. |
| Controls without an accessible name | None. Images without `alt`: none. `lang="en"` set. |
| Focus visible | 2px outline on sampled stops (Home, Settings, Calendar, Chats). The composer and chat search show a ring on their container (`:focus-within`, 3px), not the input. |
| Touch targets on a phone | Settings: none under 44px. Task checks (22px drawn) and filter chips (32px drawn) have a 44px hit area through `::after`. Today's filter tabs are 36px inside a 44px pill. Below 44 but above the 24px WCAG 2.2 minimum: the Calendar view switch (30px) and "Today" button (36px), and the chat search box (38px). Left as is: a dense toolbar; raise in a later pass if students miss them. |
| Toasts over the composer | Fixed: on a phone, toasts sit above the composer (`ui.css`, `body:has(.tg-dock)`). Measured 76px from the bottom with no composer, 204px on a page with one, 140px in the chat sheet. |
| Theme | Every after screen checked in both themes; no unreadable text found by eye. Contrast was not re-measured with a tool in Phase 4. |

**M21, placeholders.** Three short lines now, one per place: Home "Type or say anything…", chats "Ask anything, or add a task…" (was "Ask, plan, or add something…"), calendar day chat "Ask about this day…" (was three dots).

**Clean-up in Phase 4.**

- Motion: 97 single-line `transition` rules in 13 stylesheets now use `--dur-fast` (≤170ms), `--dur` (≤220ms), `--dur-slow` (≤320ms) and `--ease`, so reduced motion turns them off from one place. Longer timings (progress fills, capture animations, springs) and looping animations were left as they are on purpose.
- Dead selectors: `.td-primary`, `.td-primary.is-done` and `.td-icon` removed from `app/styles/controls.css`; the old task modal they styled was replaced by the Sheet in Phase 3.
- `StorageStatus` is still used by `AppShell`, so it stays; its pill and button now use `--r-pill` and `--r-sm`.
- M13 note: `NotificationBell` is the only caller of `/api/notifications` and there is one bell in `AppShell`. The second request seen in dev is React strict mode running effects twice; nothing to dedupe.
- Swipe-to-delete on task rows was not added. Done, Not today and Too big stay as buttons, so there is no hidden gesture to learn and nothing to delete by accident.

**Not verified this round:** a signed-in run (sign-in is invite-only and was not used), a real phone, contrast with a tool, and the Round 2 evals (`npm run eval:pipeline -- --round2`, paid, not run). "Plan step" is kept as the glossary term; elsewhere copy says "project".

## Release readiness

**Ready to deploy to a preview** once the steps in `docs/MANUAL-STEPS.md` are done, in order: the seven Round 2 migrations (`20261105000000` through `20261105060000`), the email templates, and the pilot analytics check. The code works before the migrations run (each feature falls back), but Task commitment, context slots, chats, quiet hours and completion times only save once their migration is in.

Not verified, and needed before students use it: a signed-in run of capture → plan → done, real email codes and password reset, an installed phone app (safe areas, keyboard over inputs), and the Round 2 evals (`npm run eval:pipeline -- --round2`, which costs money and was not run).

## Known issues

| # | Issue | Why it's left |
|---|---|---|
| M6 | Calendar at 390: two floating bars and the nav take about 200px; hour labels start at 1 AM. | Needs a calendar layout pass; larger than the Phase G budget. |
| M13, M14 | Today fetches some APIs twice in dev, and `/api/health` on every load. | Part is React strict mode; needs a production measurement before changing. |
| M15 | 192 `console.*` calls; a few log `e.message`, which could hold model text. | Sampled logs hold ids and counts. Needs a file-by-file pass. |
| M17 | Too many type sizes outside Today. | Design pass, not a quick fix. |
| L1 | `/tangents` is reachable from AddFlow but has no nav link. | Product decision (open question in PROJECT.md). |
| L3, L4, L13 | Theme ignores the OS setting; a phone can flash desktop UI; entrance animations start invisible. | Low impact; each needs care to avoid flashes. |
| L6, L8, L12 | `outline: none` rules, hard-coded hex in four components, a small Projects gutter asymmetry. | Polish. |
| L11 | `events` rows can be written by students through REST, so pilot analytics aren't tamper-proof. | Acceptable for a pilot. |
| — | `/dev/app/*` sample pages log 401s for account APIs. | Dev-only; they have no session. Mocking the APIs is more work than it saves. |
| — | `lib/store.ts` large-function clean-up (Phase F.5). | Skipped to keep the change small; behaviour is covered by tests. |
| — | Old `task_chat_messages` history isn't shown in the new task chats. | Open question in PROJECT.md. |
