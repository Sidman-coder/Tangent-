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
| M21 | Placeholder copy varies by screen ("Add a task, a project, or ask anything", "Add anything, or ask", "Add or change something on your calendar…"). | A, D |

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
