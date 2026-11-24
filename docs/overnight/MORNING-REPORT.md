# Morning report: overnight run, 2026-11-18

Branch `push-v1`, 20 commits on top of `v3-core-loop` (19 before this report). Nothing pushed.

**Tags:** **[ran]** = verified by running it (test name, command or screenshot named). **[code]** = read in code only, never seen working.

## 0. The five-line version
1. The app's look and flow are noticeably calmer and more consistent. The 3-judge AI panel moved from **4.7 to 5.7 / 10** [ran: judges read screenshots; they are AI].
2. **The AI loop was never re-tested.** The Anthropic credit balance ran out during Phase 4.3. Every plan, chat and capture fix is unit tests and code only [ran: tests; code: behaviour]. **Top up credits first** (section 3, item 1).
3. Both the panel and the three investor reviewers say the same thing: better shell, **engine not yet proven**. Investor verdict: **NOT YET** (all three).
4. A parent still has nothing public to read (no privacy, terms or parents page). That blocks any distribution beyond a hand-picked pilot.
5. Typecheck clean, **979 tests pass / 0 fail**, `npm run build` exit 0 [ran, on the commit before this report was written].

## 1. What changed

One line per commit group. Screenshots are relative to `docs/overnight/screens/`; "before" is the Phase 1 baseline, "after" is the final production build. All after shots were taken signed in as the test account, which is lighter than the baseline account (so some differences are the data, not the code).

| Group | Commit | What changed | Tag |
|---|---|---|---|
| Setup, baseline | 85081c5, 965c0fb | Tracking docs; about 130 baseline files (page shots plus per-persona sim shots); BASELINE.md | [ran] |
| Round 1 sims, judges | 65dc938, 5d6f762 | 6 synthetic personas, a heuristic test (17 findings), a 3-judge panel -> JUDGMENT-1 (23 consensus items) | [ran] |
| Group 1: first run and trust | 7c8dea8 | No auto tour or auto-onboarding on top of each other; notification prompt waits for the first real item; sources are only named if their tool returned data; "Stop and plan" asks nothing more; typed dates like "Thu Dec 17" are read | [ran: unit tests] [code: live] |
| Group 2: confirm and capture | 19c6b59 | After Confirm the plan stays open with "Saved N steps / First up / View in Calendar"; toasts and draft dock no longer fight modals; no praise while steps remain; one-row check-in; one sentence with several items becomes several tasks | [ran: unit tests] [code: live] |
| Group 3: screens | 924e907 | Home: neutral greeting, folded "Catch up", 7-day "Coming up", no past-due count, calm empty states. Plan page: editable title, "Why this plan" disclosure. Canvas as one quiet row. How-to questions get advice first then "Want me to plan it?". Calendar busy-block marker. You, mapped back into app style | Home, Calendar, Projects, Settings: [ran: screenshots]. Chat and plan flow: [code] |
| 4.1 Design | 5576691 | Tokens, 44px phone tap targets, Calendar and School skeleton loaders, DESIGN-NOTES.md | [ran: screenshots] |
| 4.2 Connectors | 75bfb46 | CONNECTORS.md; two-step Canvas guide; quiet retry plus a Reconnect message; planner avoids the eve of a Canvas deadline | [ran: unit tests] [code: live] |
| 4.3 Context | 088b607 | CONTEXT-REVIEW.md (one assembler, cost per call); due-date dedupe; title clipping; persona fixtures; free cost script; proposed `ai_usage.task` migration | [ran: tests, 64-case eval before only] |
| 4.4 Launch | 92a825e | LAUNCH-REVIEW.md; friendly offline and mic errors (`lib/friendly-error.ts` plus test) | [ran: unit tests] |
| 4.5 Post-event reviews | c88e8ba, cfbcd82 | **Plan only**: NEEDS-SID section, a proposed migration, a static mockup. Nothing live | [code] |
| Phase 5 verify, heuristic 2 | e32e3dc, c96c6c8 | 52 after screenshots; light-theme contrast fix on You, mapped; no raw upstream error text in chat; agenda titles wrap; rail count matches agenda; heuristic round 2: **11 findings (was 17)** | [ran: screenshots, scripted contrast at 390 on 12 pages] |
| Phase 5 judges, fixes | 932e0c3, 18518ab | Judges round 2 -> JUDGMENT-2. Fixes: sign-in copy (N04), two-line titles on phones (N07), Capture count line (N08), no second mic on Projects (N09), settings tab fade (N10), empty map pill (N11 part) | N07-N11 [ran: live at 390, `final-*` shots]; N04 [code only, not seen signed out] |
| Phase 6 | fed294b | INVESTOR-REVIEW.md; QUESTIONS-FOR-JUANN.md; DECISIONS D7, D8 | [ran: three subagent reviews] |

### Before / after, main screens

Each pair: before | after. Open the files directly (a phone is 390 wide, a laptop 1440).

| Screen | Before | After |
|---|---|---|
| Home, phone | `screens/before/home-390-dark.png` | `screens/after/final-home-390.png` |
| Home, laptop | `screens/before/home-1440-dark.png` | `screens/after/final-home-1440.png` |
| Calendar, phone | `screens/before/calendar-390-dark.png` | `screens/after/final-calendar-390.png` |
| Calendar, laptop | `screens/before/calendar-1440-dark.png` | `screens/after/final-calendar-1440.png` |
| Projects, phone | `screens/before/projects-390-dark.png` | `screens/after/final-projects-390.png` |
| Projects, laptop | `screens/before/projects-1440-dark.png` | `screens/after/final-projects-1440.png` |
| Capture, phone | `screens/before/capture-390-dark.png` | `screens/after/final-capture-390.png` |
| Capture, laptop | `screens/before/capture-1440-dark.png` | `screens/after/final-capture-1440.png` |
| You, mapped | `screens/before/settings-context-390-dark.png` | `screens/after/settings-context-390-dark.png` |
| Settings tabs, phone | `screens/before/settings-390-dark.png` | `screens/after/fix-settings-tabs-390.png` |
| Sign-in | `screens/before/signin-390-dark.png` | **No after shot.** The sign-in copy (N04) was changed in code only and never seen signed out |
| Light theme | `screens/before/home-390-light.png` | `screens/after/home-390-light.png` |

Privacy: no unmasked screenshot of `/settings/account` is in the working tree (see section 3, item 7 for git history).

## 2. Scores, round 1 -> round 2

From JUDGMENT-2 (three AI judges plus a chair; scores are opinion, not user data). Mean of the nine areas: **4.7 -> 5.7**. Judges' own verdict lines: 4.25 -> 5.25.

| Area | R1 | R2 | Re-scored? |
|---|---|---|---|
| First-use | 3.0 | 4.3 | yes |
| Chat | 4.3 | 4.3 | **no** (no credits) |
| Planning quality | 6.3 | 6.3 | **no** |
| Today (Home) | 4.3 | 6.3 | yes |
| Calendar | 4.7 | 6.3 | yes |
| Projects | 4.0 | 5.0 | yes |
| Settings / You | 5.0 | 6.0 | yes |
| Overall polish | 5.0 | 6.3 | yes |
| Differentiation | 6.0 | 6.0 | **no** |

- Heuristic findings: 17 -> 11 [ran: two crawls of 7 screens].
- Round-1 consensus items: 2 FIXED, 17 PARTLY, 2 GATED, 2 NOT FIXED. Most are "PARTLY" because they are code and unit tests only.
- Read this honestly: the three judges say the gain is the shell. The three areas that matter most for the pitch (chat, planning, differentiation) were **not re-measured**.
- The after account is lighter than the baseline account, which flatters Home. The Investor judge explicitly discounts for it.
- Round-2 persona sims were **not run** (no credits).

## 3. NEEDS-SID, most important first

Full detail in `docs/overnight/NEEDS-SID.md`. Gated areas: billing, auth, data deletion, database schema, OAuth scopes. I built none of them.

| # | Ask | Why it matters |
|---|---|---|
| 1 | **Top up the Anthropic credit balance**, then run `echo y \| npm run eval:pipeline` (about $0.30) and re-run the personas. | Until then every AI feature fails for every student. Nothing in chat, capture or planning has been seen working after tonight's fixes. |
| 2 | **Publish a privacy policy, terms and a "for parents" page** and decide the consent line naming Anthropic (text) and Deepgram (audio). (C06) | A parent can read nothing before signing in; it blocks the App Store and any pilot beyond hand-picked families. |
| 3 | **Decide who pays** and how a parent pays (IAP vs free pilot vs web). | No billing exists. Apple's in-app-purchase rules apply to a wrapper. Recommended by all three reviewers: free, invited pilot first. |
| 4 | **Per-connection Canvas / Google disconnect, and make "Forget everything" also clear observed habits.** | Today the only removal is "Delete all my data". Habits survive a reset. (N12, minors' data) |
| 5 | **Rotate the pen upload key (`PEN_KEY`)** and confirm `CANVAS_FEED_KEY` is set in Vercel; keep `TANGENT google cloud secrets.json` out of shares. | The key is printed in a README; feed URLs are only encrypted at rest if the env var exists. |
| 6 | **Create a reviewer demo account** (allowlist, sample data, credits on); decide Sign in with Apple. | App Store review 2.1(a), 4.8. |
| 7 | **Decide on history:** the Phase 1 commit `965c0fb` still holds six unmasked Account screenshots (the test email). The working tree is masked. | Rewrite before any push, or accept. I did not rewrite history. |
| 8 | **Apply two proposed migrations** if you want them: `proposed-migrations/20261118000000_ai_usage_task.sql` (cost per task) and `20261118010000_event_reviews.sql` (post-event reviews). Neither is applied. | Needed to measure cost per student and to build 4.5. |
| 9 | **Confirm RLS on every table** in the Supabase dashboard; add security headers and rate limits. | I could only read migration files. |
| 10 | **Choose** the Home hero ("Next up"), the "push" word, the Projects composer (N06, section 5). | Product calls. |

## 4. Decisions I made for you

Short version of `docs/overnight/DECISIONS.md`. Each one is reversible.

| ID | Decision |
|---|---|
| D1 | The test account was not signed in at the start; I used it once you had signed in. |
| D2, D3 | Build and dev server run with a raised Node memory limit because the machine had little free RAM. |
| D4 | Screenshots and sims use the **production** build (`/dev/app/*` returns 404 in production); no signed-out shortcuts used for signed-in claims. |
| D5 | The signed-in account is a "+test" alias that was not empty (a project, 9 past-due items, 8 facts), so first-run screenshots show a lived-in account. |
| D6 | The credit balance ran out; I did **not** re-run the eval, did not touch billing, and report the after-eval as **invalid, not a regression** (21/64 is an artifact). |
| D7 | The three Juann questions: nothing changed, nothing deleted, questions written. |
| D8 | Investor verdicts are reported exactly as given. |

## 5. Questions for Juann

Full text with defaults: `docs/overnight/QUESTIONS-FOR-JUANN.md`.
1. **"Push"**: `CONTEXT.md` defines Push as one suggested next step, but the app says "step". Should students ever see "push"? [code]
2. **Liquid Glass**: 36 `backdrop-filter` rules remain in `tangents.css` plus blur in four other style files. Keep, flatten, or part of the Round 3 removal? [code]
3. **`TANGENT_FOCUS_MODE`**: no such string exists anywhere in the repo. Renamed, removed, or living elsewhere? [searched by text]

## 6. Verdicts

**Launch readiness** (`LAUNCH-REVIEW.md`, [code]): **not ready for the App Store**, fine for a small invited web pilot once credits are back. Blockers: empty credits, no public privacy or terms, no reviewer account, wrapper risk (guideline 4.2).

**Investor panel** (`INVESTOR-REVIEW.md`; three AI reviewers; no real user numbers exist; nothing invented):

| Reviewer | Verdict | Would students like it? |
|---|---|---|
| YC-style partner | NOT YET | Partly |
| Seed VC, consumer / edu | NOT YET | Partly |
| Counselor / teacher | NOT YET | Partly |

- Agreed strength: plans that fit real constraints (round-1 sims, one run each).
- Agreed fatal gaps: the loop was never seen working end to end; no evidence anyone comes back (the "follows up" half is not built or observed).
- Riskiest assumption (all three): a student types one real sentence, trusts the plan, and opens the app on day 2 unprompted.
- Cheapest test: top up credits, run the sims, publish a privacy page, then a 10-student, 3-day pilot with a human sending the follow-ups.

## 7. Cost

All **estimates** from call counts and logs; the provider dashboard was not readable (`AI-SPEND.md`).

| Item | Figure | Tag |
|---|---|---|
| App AI spend tonight | about **$1.6 to $2.9** of the $15 budget (after 4.3; nothing was spent after credits ran out) | estimate |
| 64-case eval, before | 147 calls, about **$0.27**, 39/64 passed | [ran: log, `scripts/eval-cost-from-log.mjs`] |
| 64-case eval, after | **invalid**: 96 of 146 calls refused for empty credit | [ran] |
| Plan brief | $0.0110 per call (1725 in / 751 out); 65% of eval cost | [ran, before only] |
| extendPlan | $0.0047; chatPlan $0.0039; agent loop $0.0109; router and extraction under $0.0002 | [ran, before only] |
| Cost per call or feature, **before -> after** | **Not measured.** The pack budgets (3000 / 2000 / 1600 tokens) were unchanged, so the worst case did not rise. I claim no saving. | [code] |

To measure properly after a top-up: `node scripts/eval-cost-from-log.mjs before.log after.log` (about $0.30, one run). Reviewer and judge subagents run on the Claude Code side and are not part of this app budget.

## 8. What Sid must check by hand

- **On a real phone** (everything was seen in a desktop browser at 390 wide): safe areas, keyboard over the composer, the mic and the tab bar, tap targets, scrolling the settings tabs.
- **After the credit top-up:** type one real sentence -> questions -> plan -> Confirm -> Home next day. This is the whole product and was not seen working after the fixes.
- **Brand-new account:** I only had a lived-in one. Check onboarding, no stacked tour, notification prompt timing.
- **Sign-in screen signed out:** the N04 copy change is [code only].
- **Signed-in flows not covered:** Canvas connect and failure, Google calendar and Gmail, voice capture, notification denied, offline, pen upload, "Delete all my data".
- **Light theme and 1440** beyond the screens listed: contrast was scripted at 390 on 12 pages and at 1440 only on `/settings/context`.
- **Still open from the judges, not fixed:** visible labels on the Calendar clock icon and the Home question-strip dismiss (N14); the clipped "Classes & activities" label on You, mapped; the Calendar composer placeholder; no "Next up" hero (N06); naming drift (N15); the questions strip above Today (N16).
- **Honest limits:** the personas, judges and reviewers are AI; the personas are synthetic; many fixes are "built and unit-tested, never seen working live".

## 9. How to review or undo

```
git log --oneline v3-core-loop..push-v1
git diff --stat v3-core-loop..push-v1          # about 408 files, +6.5k / -0.7k before this report
git revert <hash>                               # one commit group at a time
```

Each phase is its own commit with an `overnight:` prefix, so a group can be reverted on its own. Nothing was pushed. Nothing in Supabase, Vercel or billing was changed, and no SQL was run. The only data deleted was the test account's own, between simulations.

### EXTRA (built beyond the spec)
These were judged small and in service of capture -> plan -> done; revert any you dislike.
- `splitCaptureItems` multi-item instant add; editable titles; the 7-day Coming up window; the "Want me to plan it?" lead-in; Lightbulb, Compass and ListPlus icon swaps; empty-calendar line; School empty state with Connect Canvas; busy-block clock marker; Calendar and School skeleton loaders; the phone hit-area rule block; HOWTO_DO moved into the ask route.
- 4.2: two-step Canvas guide, the planner's Canvas-eve nudge, the Reconnect message.
- 4.3: `scripts/eval-cost-from-log.mjs`, `clipTitle` and `dueNotInWeek`, `personas.json` plus its test.
- 4.4: `lib/friendly-error.ts` plus its test and the display-site edits.
- Phase 5: the chat error-leak fix, the You, mapped contrast fix, `lib/week-lines.ts`, agenda two-line titles, Home status-line dedupe, and the N04, N07, N08, N09, N10, N11 edits (including the `.task-title-text` span and the Projects mic hide and placeholder).
