# JUDGMENT-2: Consensus of the three-judge panel, round 2

Date: 2026-11-18. Chair's merge of `judges/judge-design-2.md` (D), `judges/judge-student-2.md` (S) and `judges/judge-investor-2.md` (I). Nothing here is new evidence. Every citation comes from the judges' files, `PROGRESS.md`, `NEEDS-SID.md`, `DECISIONS.md` and the two heuristic reports.

## 0. Method and honest limits

Method: the three judges worked independently (none read the others' round-2 files) from the after screenshots in `docs/overnight/screens/after/` compared with `before/`, `PROGRESS.md`, the review documents, and both heuristic reports. I merged their scores and statuses. Where they disagree I say so. Severity words (fatal, significant, minor) are the judges'. Labels used below: **fact** = seen in a screenshot, test or command output; **inference** = reasoned from facts; **opinion** = judgement.

Limits the reader must keep in mind:

1. **The AI could not run.** The Anthropic credit was empty (DECISIONS D6). The six persona simulations, chat, planning quality, capture parsing and the AI evals were NOT re-run in round 2. Those areas are "not re-scored" and carry round-1 scores. The round-2 AI eval is invalid (CONTEXT-REVIEW section 0).
2. **The after screenshots are a lighter account than round 1.** Round 1 was a heavily used account (9 past due, a project). The after shots are a lived-in test account left by a persona: one recurring Sunday item, no project, 12 facts, no overdue items. Part of the gain on Home and Projects may be a lighter account, not a better product. Nothing in the files lets us separate the two.
3. **Some after shots predate the final fixes.** `calendar-1440-light/dark.png` and `home-1440-*.png` were taken before the heuristic fixes (rail still "6 things", agenda titles truncated, doubled "Nothing planned today"). Only `fix-calendar-rail.png` and `fix-home-status.png` show the fixed state, at 1440 in dark only. The 390 Home and Calendar shots were not re-taken after those fixes.
4. **Contrast was checked by script** at 390 on 12 pages in light and dark (0 failures after one fix), and at 1440 only on `/settings/context`. Passing 4.5:1 does not mean readable: the You-map labels pass and are still about 9px (D).
5. **Many changes are "built and unit-tested, never seen working live".** PROGRESS says group 2 (C04-C09) had no browser check. The only live AI checks were the how-to question (C15) and the friendly API-error reply. Test count at the end: 979 pass, typecheck clean, build OK (PROGRESS, last entry).
6. **No empty-account first run was captured.** First-use scores rest on code, tests and a lived-in account.
7. **Heuristic rounds used one expert each** on 7 screens at 1440 dark, so a drop from 17 to 11 findings is partly evaluator variance (I, and the report itself).

## 1. Scores (1-10): round 1 -> round 2

Cell format `R1 -> R2`. "nr" = not re-scored (the judge carried the round-1 number; no AI run). Round-1 numbers are as in JUDGMENT-1.

| Area | Design | Student | Investor | Chair mean R1 -> R2 | Change |
|---|---|---|---|---|---|
| First-use | 3 -> 4 (provisional) | 3 -> 5 | 3 -> 4 | 3.00 -> 4.33 | +1.33 |
| Chat | 5 -> 5 nr | 4 -> 4 nr | 4 -> 4 nr | 4.33 -> 4.33 | 0 (nr) |
| Planning quality | 6 -> 6 nr | 7 -> 7 nr | 6 -> 6 nr | 6.33 -> 6.33 | 0 (nr) |
| Today (Home) | 5 -> 6 | 4 -> 7 | 4 -> 6 | 4.33 -> 6.33 | +2.00 |
| Calendar | 6 -> 7 | 4 -> 6 | 4 -> 6 | 4.67 -> 6.33 | +1.67 |
| Projects | 4 -> 5 | 4 -> 5 | 4 -> 5 | 4.00 -> 5.00 | +1.00 |
| Settings / You | 5 -> 6 | 5 -> 6 | 5 -> 6 | 5.00 -> 6.00 | +1.00 |
| Overall polish | 6 -> 7 | 5 -> 6 | 4 -> 6 | 5.00 -> 6.33 | +1.33 |
| Differentiation | 6 -> 6 nr | 6 -> 6 nr | 6 -> 6 nr | 6.00 -> 6.00 | 0 (nr) |
| **Mean of the nine areas** | 5.11 -> 5.78 | 4.67 -> 5.78 | 4.44 -> 5.44 | **4.74 -> 5.67** | **+0.93** |
| Judge's own verdict line | not given -> 5.8 (its mean of nine) | 4.5 -> 5.5 | 4 -> 5 | 4.25 -> 5.25 (S and I only) | +1.00 |

How the means were computed:

- Area mean = (D + S + I) / 3. Example, Today R2 = (6 + 7 + 6) / 3 = 6.33. Example, Calendar R1 = (6 + 4 + 4) / 3 = 4.67.
- Overall by area = sum of the nine area means / 9. R1: (3.00 + 4.33 + 6.33 + 4.33 + 4.67 + 4.00 + 5.00 + 5.00 + 6.00) / 9 = 42.67 / 9 = 4.74. R2: (4.33 + 4.33 + 6.33 + 6.33 + 6.33 + 5.00 + 6.00 + 6.33 + 6.00) / 9 = 51.00 / 9 = 5.67. Cross-check: all 27 judge scores, R1 sum 128, R2 sum 153, so 4.74 and 5.67.
- Verdict-line mean: R1 had no design verdict (D gave 5.1 only as the mean of its nine areas, the same way as above), so the like-for-like comparison uses S and I only: (4.5 + 4) / 2 = 4.25 -> (5.5 + 5) / 2 = 5.25. With all three R2 verdicts: (5.8 + 5.5 + 5) / 3 = 5.43.
- Correction: JUDGMENT-1 printed "4.8" for the nine-area mean. Recomputed from its own table it is 4.74, so **4.7**. Use 4.7 as the round-1 baseline.

**Headline: consensus overall 4.7 -> 5.7 (+0.9) by area means; 4.25 -> 5.25 (+1.0) by the judges' verdict lines.**

What the movement is made of:

- Six of nine areas were re-scored and carry the whole gain: their mean goes 4.33 -> 5.72 (+1.39). Three areas (chat, planning quality, differentiation) are carried unchanged, mean 5.56 both rounds. The +0.93 overall is 6/9 of +1.39.
- All three judges say the gain is the shell, not the engine. D: "Round 2 made the shell calmer and more consistent. It did not, and could not, prove the loop." S: "The engine, which is the reason to come back, is unverified this round, so I do not move higher." I: "One point for shell, not more."
- Largest jumps come from S (Today +3, First-use +2, Calendar +2). D and I are more cautious. I explicitly discounts for the lighter account. D marks First-use "provisional".
- Weakest area is still first-use (4.33). Strongest is still planning quality (6.33), which is a carried number.
- Opinion: treat 5.7 as an upper-ish estimate of the shell and unknown for the engine. A real run could move the three carried areas either way.

## 2. Round-1 consensus items C01-C23: status

Rule (judges' rule, adopted): **FIXED** = seen in a screenshot or a PROGRESS-recorded live check. **PARTLY** = partly seen, or code and unit tests only. **NOT FIXED** = no change or not attempted. **GATED** = needs Sid's approval; nothing built. Disagreements are named.

Totals: FIXED 2 (C10, C14). PARTLY 17. GATED 2 (C06, C23). NOT FIXED 2 (C21, C22, both LATER). Investor counted 5 FIXED (adds C11, C17, C18); D and S rate those PARTLY, so I keep them PARTLY.

| ID | Item | Round-1 tag | R2 status | One-line evidence (judges' words / PROGRESS) |
|---|---|---|---|---|
| C01 | Stacked overlays | BUILD | PARTLY (S says FIXED) | `after/home-390-light.png`: no sheet, tour or scrim; `lib/first-run-gates.ts`. D and I: lived-in account only, empty first run never captured. |
| C02 | Plan claims it read Canvas/Gmail | BUILD | PARTLY | `lib/source-read.ts` + tests; "No plan was drafted in round 2" (I). |
| C03 | Stop and plan asks another question | BUILD | PARTLY | GRILL_DONE_MARK, code and tests; "Never run live" (S, I). D not re-scored. |
| C04 | Chat re-asks typed facts | BUILD | PARTLY | `lib/context/infer.ts` reads "Thu Dec 17", meter copy changed; never run live. I: Jordan's "already said" case still depends on a client-side list (gated, CONTEXT-REVIEW). |
| C05 | Silence after Confirm | BUILD | PARTLY | Plan stays open with "Saved N steps / First up / View in Calendar" (PROGRESS, code only). Home side is visible: "Next is Sun, Nov 22 . 6:00 PM" (`fix-home-status.png`). Leo's possible "no project created" bug never re-run (I). |
| C06 | No public privacy/terms/parents page | GATED | GATED, NOT FIXED (all three) | `after/heur-signin.png` unchanged; R2 heuristic F11. **Correction to round 1:** LAUNCH-REVIEW B1 found the pages do not exist at all (round 1 said they bounced to sign-in). Route-guard plan and draft copy are in NEEDS-SID. |
| C07 | Toast / draft dock cover buttons | BUILD | PARTLY | Code only (toast to top while a modal is open, dock hidden). "No modal or toast was captured" (D). |
| C08 | False praise on Done | BUILD | PARTLY | Code only; I: Home shows no "All done" with a future item pending, consistent but the Done tap was not exercised. |
| C09 | Capture drops items / no progress | BUILD | PARTLY | `splitCaptureItems`, still-working note after 5 s; "Never run with a real sentence" (S). |
| C10 | Today guilt numbers, four empty rows | BUILD | **FIXED** (all three) | `home-390-light.png` before vs after: 9 past due, "A lot piled up", four empty rows, duplicate strip all gone. Caveat: the account has nothing overdue, so the folded "Catch up" row was not seen. |
| C11 | Home hides next step / contradicts Calendar | BUILD | PARTLY (S and I say FIXED) | Home and Calendar rail now agree (`fix-calendar-rail.png` "1 thing"; `fix-home-status.png`). All three still see Capture say "0 things" while Home shows an item (`capture-390-*`). |
| C12 | Stale text, locked title | BUILD | PARTLY | Title PATCH, status only while draft; code and tests, plan page not rendered. |
| C13 | Plan wall of assumptions | BUILD | PARTLY | "Why this plan", at most 3 assumptions; code only. I: CONTEXT-REVIEW admits the model still generates the template line and it is hidden in the view only. |
| C14 | Canvas promo card noise | BUILD | **FIXED** (demoted) | One quiet text row with Connect Canvas / Not now (`home-390-light.png`). Permanent dismiss is browser-local; a stored dismissal is GATED (NEEDS-SID). |
| C15 | "How do I" gets a form | BUILD | PARTLY | Live reply once with the student's own context (PROGRESS ~08:40); one question only. D not re-scored. |
| C16 | Canvas/data flow silent on storage and disconnect | BUILD | PARTLY (S, I) | Connections label, "Tangent reads nothing until you do" (`settings-schedule-390-*`). A real disconnect is GATED; the only exit is "Delete all my data". |
| C17 | Empty Calendar hint, mic over grid, unlabelled icon | BUILD | PARTLY (I says FIXED) | Clock icon replaces arrow, but still no visible label and the mic still overlaps the panel corner (`calendar-390-light.png`). Empty-state line never seen (shots are Agenda mode). |
| C18 | Projects sparse and stale | BUILD | PARTLY (I says FIXED) | School page has Connect Canvas, Tangents is a text link (`projects-school-390-light.png`). New problem: composer dominates, mic covers first card. Overdue flag unseen. |
| C19 | You, mapped off-system, clips, zeros | BUILD | PARTLY (all three) | "Not asked yet" in the list and contrast fixed. Still cream/glow, "Classes & activities" still clipped at 390, map still shows "0" (`settings-context-390-*`). |
| C20 | Wrong labels, practice as to-do | BUILD | PARTLY | `lib/task-kind.test.ts` busy-block tests; not seen on screen. Category schema part GATED. |
| C21 | "Follows up" never seen | LATER | NOT FIXED | Only the "Next:" line shipped; 4.5 post-event reviews is a plan, an unapplied migration and a static mockup (I). |
| C22 | Capture wait up to about 30 s | LATER | NOT FIXED | Only the progress note; latency untouched and not re-measurable without credits. |
| C23 | Stale name after reset | GATED | GATED, not retested | Not observed. S: Home now greets a persona name, cannot tell artifact from fix. |

## 3. New consensus issues (round 2)

Inclusion rule as in round 1: raised by at least 2 of 3 judges, or fatal from any one. Ranked by impact on a first-time student, then effort. Tags: **FIX NOW** (safe, small, code-only, no gated area), **GATED** (NEEDS-SID), **LATER** (with short spec). Basis: fact / inference / opinion.

Severity note: only I called anything fatal (N01 for a demo). D called none fatal.

### N01. Every AI feature fails while the credit is empty
- Raised by: I fatal (for a demo), S significant. Tag: **GATED** (billing), plus a **LATER** fallback.
- Basis: fact. DECISIONS D6; LAUNCH-REVIEW B2 (96 of 146 calls failed with HTTP 400, per I). New reply "I couldn't do that right now. Try again in a minute." is kinder than raw JSON but "in a minute" is untrue at a zero balance, and nothing says the typed text was kept (S).
- Action: top up credit (NEEDS-SID top item), then re-run the persona sims and `npm run eval:pipeline` (about $0.30 per CONTEXT-REVIEW).
- LATER spec: on an AI failure, save the typed words as a plain to-do and say so ("I saved your words as a to-do"). Smallest slice: stop saying "in a minute" when the cause is billing.

### N02. The highest-trust fixes were never seen working
- Raised by: S significant, I significant; D implies it for C02, C05, C13. Tag: **GATED** (needs N01 first).
- Basis: fact. C02, C03, C04, C05, C08, C09 are code and unit tests only; PROGRESS: no browser check on group 2.
- Action: after N01, run one real sentence from typing to Confirm to next-day Home (see section 6).

### N03. A parent still has nothing to read, and the pages do not exist
- Raised by: D significant, S significant, I fatal for distribution. Tag: **GATED** (route guard; copy needs Sid to confirm facts).
- Basis: fact. `after/heur-signin.png`; R2 heuristic F11 (priority 5.0, the second-highest of the 11); LAUNCH-REVIEW B1. I adds: student text goes to Anthropic and audio to Deepgram with no distinct consent step (LAUNCH-REVIEW 5.1.2).
- Irony noted by S: Settings now says "Tangent reads nothing until you do" and "It's yours", which is what a parent wants to read, but it is visible only after sign-in.
- Action: NEEDS-SID already holds the exact `lib/auth/gate.ts` change and draft copy. Also an App Store blocker.

### N04. Sign-in wording still sounds like surveillance
- Raised by: D, S, I (all in round 1 and again in R2). Tag: **FIX NOW** (copy only; strings on the page, not sign-in logic). If the strings are tangled with auth code, stop and move to GATED.
- Basis: fact (`after/heur-signin.png`: "listens", "built from what it already knows about you" unchanged). Opinion: a parent reads these as surveillance (S, D).
- Fix: replace "listens" with plain "say it or type it"; replace "built from what it already knows about you" with "based on what you tell it". I adds: the headline omits "follows up". Add nothing that makes a privacy claim; that belongs to N03.

### N05. Typing offline, or during an AI failure, loses the words
- Raised by: S significant, I significant. Tag: **LATER**.
- Basis: fact from LAUNCH-REVIEW S1 (no service worker, no offline page, capture not queued); friendly message exists, text is lost on reload.
- Spec: (1) keep the typed text in the box on any failed send (smallest slice); (2) an offline page; (3) a queued capture that retries when online. Fits "Say it, it's saved".

### N06. Today has no focal element and little pull for tomorrow
- Raised by: D (its single most valuable next change), S (its single change, plus issue 6), I (edge invisible on Home, issue 4). All three. Tag: **LATER**.
- Basis: fact for the layout (`home-390-light.png`: a sentence "Nothing planned today. Next is Sun, Nov 22 . 6:00 PM." plus a collapsed "Coming up 1" accordion). Opinion for the retention effect.
- Spec: one shared "Next up" card (title on two lines, time, Done circle, one-line "why" when there is one), used on Home and as the landing state after Confirm. S adds three one-tap choices: Done, Move it, Not today (Not today re-spaces quietly, no scolding or score). Smallest slice: replace the sentence plus accordion with the card. Also the first slice of C21.
- Note: I's guardrail concern (4.5 post-event reviews add scope beside "capture, plan, done") is a product call, not a defect.

### N07. The one Home row title is cut off at 390, and Calendar agenda titles still cut at two lines
- Raised by: D, S. Tag: **FIX NOW**.
- Basis: fact. `home-390-light.png` "...video upl"; `calendar-390-light.png` "...going withou..." with three identical titles. The wrap-to-two-lines fix exists at 1440 (`fix-calendar-rail.png`) but the phone was not re-shot.
- Fix: reuse the agenda wrap on the Home row; allow a third line, or show the date next to a repeated title, so three Sundays are distinguishable.

### N08. Capture page says "To do, 0 things" while Home shows an item
- Raised by: D, S, I (all three; the "two homes" item from the baseline, unchanged). Tag: **FIX NOW**.
- Basis: fact for the contradiction (`capture-390-light/dark.png` vs `home-390-light.png`). Inference for the cause: Capture's list may intentionally show only undated to-dos while Home shows a dated item.
- Fix: check the cause first. If it is a different filter, change the label and empty copy so it never says "Nothing to do" while a plan exists (for example point to Today); if it is a data bug, use the same source as Home. Also D notes Capture has a lowercase wordmark, a different top bar and no tab bar (opinion: leave for LATER).

### N09. The floating mic overlaps content on Projects and Calendar, and Projects shows two mics
- Raised by: D (issues 5, 6), S (issues 11, calendar). Tag: **FIX NOW**.
- Basis: fact. `projects-390-light/dark.png`: second large mic bottom right covers the "School" card, composer has its own mic, placeholder truncated. `calendar-390-light.png`: mic over the panel corner. PROGRESS C17 says "room under content for the phone mic"; the shot does not show it.
- Fix: bottom padding equal to the mic's footprint on both pages; hide the floating mic on Projects when the page has its own composer; shorten the placeholder.
- LATER: whether Projects should lead with a full composer at all (D: breaks "no second input"; I: better first screen). Judges disagree; leave to Sid.

### N10. The Settings tab strip clips its labels on a phone
- Raised by: D (persistent from round 1, "Account" cut to ".ccount"), S ("Your data" cut to "Your dat"; LAUNCH-REVIEW N1 also shows a clip at 360px). Tag: **FIX NOW**.
- Basis: fact (`settings-schedule-390-dark.png`, `settings-notifications-390-dark.png`, `settings-data-390-light.png`). It is the only way between Settings pages on a phone.
- Fix: scroll the active tab into view with side padding and a fade edge; no label may start off screen.

### N11. You, mapped: still off-system, one label clipped, tiny labels, "0" vs "Not asked yet"
- Raised by: D significant (x2), S, I. All three. Tag: **FIX NOW** (clip, label size, zero wording on the map) and **LATER** (restyle).
- Basis: fact. `settings-context-390-light/dark.png`: "Classes & activities" clipped at the right edge; labels about 8-9px; `settings-context-1440-light.png`: map shows "Classes & activities 0" while the list below says "Not asked yet". Cream background, glow dots, orbit rings, a brown tint in dark (`settings-context-1440-dark.png`). D: the only glow in the app, contradicting the style spec.
- FIX NOW: stop the clip; raise label size; show "Not asked yet" in the map in neutral text, not "0".
- LATER spec: restyle into the app's own flat surface; delete the duplicate "Facts per area" list so editable facts start in the first viewport (R2 heuristic F09). D's runner-up change.
- Basis note: DESIGN-NOTES claims bigger labels; the screenshot does not show it (D).

### N12. The only way to remove Canvas data is "Delete all my data"
- Raised by: S significant, I (the line describes an exit, not a button). Tag: **GATED** (deletes user data; already in NEEDS-SID).
- Basis: fact (`settings-schedule-390-light.png`: "To remove them, use Delete all my data under Your data").

### N13. Removal verbs and confirmations look inconsistent
- Raised by: D, S, I (all minor). Tag: **GATED** (data-deletion wording; NEEDS-SID asks Sid to pick one rule).
- Basis: fact for the verbs (Forget / Clear / Delete / Remove, R2 heuristic F05). Inference: the "no confirmation" claim (F06) is probably an evaluator artifact, since round 1 recorded the type-DELETE confirmation and the heuristic says dialogs were not captured. S makes the same point. Open item: a parent cannot see from the page that confirmations exist.

### N14. Icon-only controls have no visible name
- Raised by: D, S, I (minor). Tag: **FIX NOW**, small: give the Calendar clock icon a visible "Recent changes" label and the Home question-strip dismiss a visible label.
- Basis: fact. R2 heuristic F07 (priority 3.3); accessible names already exist ("Say it", "Hide until tomorrow"), only visible text is missing. Leave the mic and send icons (universal, opinion).

### N15. Naming drift
- Raised by: D, S, I (minor). Tag: **LATER**, needs a name decision.
- Items: "Tangents" vs "path" and its place under Projects (R2 F02, ask Juann); Home "Personal" vs Calendar "Short-term" (F03); "Done: X" vs "Mark X done" (F04); "Auto" pill (I, D).
- Spec: pick one word per concept, then apply. Opinion: the Tangents rename is a product call.

### N16. "2 questions to sharpen your plans" sits above the day on Home
- Raised by: D (holds Today back), S (issue 13). Tag: **LATER**.
- Basis: fact (`home-390-light.png`, inline strip above the filters, icon-only dismiss). It replaced the first-load sheet (C01 fix). Opinion: pull-based, so only minor, but it competes with the 3-second scan.
- Spec: show it below the first day section, and not before the first confirmed plan; keep Skip and Stop non-blocking.

### N17. The after-screenshot folder partly shows bugs that are already fixed
- Raised by: D, S, I (a process issue). Tag: **FIX NOW** (no code: re-shoot).
- Basis: fact (section 0 item 3). Re-shoot `home-1440-*`, `calendar-1440-*`, and the 390 Home and Calendar shots on the final build, and add the empty-calendar and empty-account states. Anyone reading `after/` alone will think fixed bugs are live.

## 3b. Raised by one judge only (not consensus, kept so nothing is lost)

- Leo's Confirm said "Added 6 steps" but created no project; after shots again show no project. PROGRESS does not say it was investigated (I, significant, unknown). Inference: could be a data bug. Worth one test once credit is back.
- Observed habits are neither shown nor deleted by "Forget everything" (I, CONTEXT-REVIEW section 6; gated).
- The default task title echoes the student's whole sentence, three Sundays in a row (I; D and S see the same truncated title). Spec: shorten the title at capture (LATER).
- School page is a dead end without Canvas: add "or type what's due" (S).
- Plan shape: a 15-step round at one time slot, a one-step round for a multi-part goal (I, round-1 item, not retested).
- Unit economics blank: cost per active student "argued, not measured", `ai_usage` does not record the task (migration proposed, not applied), pricing path undecided (I).
- Security basics: no headers, no rate limits, uneven validation; RLS claimed on 26 tables from migration files only (I; fine for an invited pilot, not for an open launch).
- Destructive buttons share size and shape with neutral ones; confirmation dialogs uncaptured (D).
- Type scale still 11 sizes (D, self-reported in DESIGN-NOTES).

## 4. Heuristic evaluation: round 1 -> round 2

Same 7 screens, one expert per round, three raters each. Round-2 scope was 1440 dark only. The R1-to-R2 mapping is my reading of the two reports.

| Measure | Round 1 | Round 2 |
|---|---|---|
| Findings | 17 | 11 |
| Top priority score | 8.1 (F01 Home "all caught up" beside an Undo) | 8.0 (F01 Calendar count vs agenda) |
| Findings at priority 4.0 or more | 6 (F01, F16, F02, F10, F14, F17) | 2 (F01, F11) |
| After the live fixes (F01, F08, F10) | not applicable | 8 left; top is F11 at 5.0 |

Of round 1's 17: **8 gone, 9 carried** (merged into 7 round-2 entries). Of round 2's 11: **3 new** (F04, F08, F10), 1 split out of an old one (F05 verbs, from R1 F10), 7 carried or reframed.

| Round-1 finding | Round-2 outcome |
|---|---|
| F01 Home "all caught up" beside Undo (top, 8.1) | **Gone.** Home now leads with a status line. |
| F14 Canvas promo outweighs capture | **Gone** (one quiet row). |
| F03 "Goes to: Auto" chip | **Gone.** |
| F05 Machine-sounding facts | **Gone.** |
| F07 Notifications button vs link | **Gone.** |
| F08 Voice/submit control names | **Gone.** |
| F15 Setup cards mixed into What Tangent knows | **Gone** (not reported; may be variance). |
| F12 Sidebar status ring icon | **Gone** (not reported; may be variance). |
| F16 + F17 No parent info, no Help | **Persists** as R2 F11 (5.0). Gated (N03). |
| F02 7-day panel vs grid disagree | **Reframed** as R2 F01 (8.0, "6 things" vs one item). Fixed after the report (`lib/week-lines.ts` + 2 tests; `fix-calendar-rail.png` "1 thing"). |
| F10 No delete confirmation | **Persists** as F06 (3.3) and F05 verbs (3.3). Likely artifact for F06 (N13). |
| F06 Filter names differ Home vs Calendar | **Persists** as F03 (2.0). |
| F04 + F09 Tangents jargon and placement | **Persists** as F02 (2.7). |
| F13 You, mapped fills first viewport | **Persists** as F09 (2.7). |
| F11 History icon-only | **Persists** in other form as F07 (icon-only mic, send, X, Ask). History became a clock icon, still unlabelled. |
| New: F08 agenda title cut off (3.3), F10 "Nothing planned today" twice (1.3), F04 Done label differs (1.0) | F08 and F10 **fixed after the report** (titles wrap at every width, status line now "Next is Sun, Nov 22 . 6:00 PM."). F04 not fixed. |

Evidence for the post-report fixes: `docs/overnight/screens/after/fix-calendar-rail.png` and `fix-home-status.png`, taken on a fresh production build, signed in, at 1440 dark only (PROGRESS ~15:00). The heuristic expert did not re-run after the fixes. Not fixed, by decision: F03, F04, F07, F09 (small, left for Sid), F02 (name, Juann), F05, F06, F11 (gated).

Chair's reading: the two worst round-1 heuristic findings (Home contradiction, promo noise) are gone, and the one new top finding was fixed the same night. What persists is trust-layer and naming, not shell breakage. Treat 17 -> 11 as direction, not magnitude.

## 5. Riskiest assumption: now, and the cheapest test

**Round 1 assumption (unchanged in substance):** a student's first typed sentence, plus stored context, becomes a plan they trust and confirm without help, they come back on day 2, and they answer a follow-up.

**Did it change?** Sharpened, not replaced. Round 1 listed four weak links. Round 2 moved the first two (intake friction, silent confirm) from "visibly broken" to "plausibly fixed in code, not re-observed". The third (follow-up loop never seen, C21) and fourth (a parent can read nothing, C06) did not move. One precondition is new (I): the engine has to be switched on and affordable before any of this can be tested (N01). S adds a fifth link in effect: a calm Home gives a student no reason to open the app tomorrow (N06).

**Cheapest test now, in order (all three judges point to the same sequence; I states it most completely):**

1. **Gate (hours, a few dollars):** top up the credit, then run ONE real sentence from typing to Confirm to next-day Home on the production build, with screenshots (S's ask). Then re-run the six persona simulations and `npm run eval:pipeline` once (about $0.30 per CONTEXT-REVIEW). Pass means C02-C05 and C09 are confirmed live and cost per task becomes measurable. Fail means the engine, not the shell, is the problem.
2. **Pilot (as in round 1):** 10 students, 3 days, concierge follow-ups. Four numbers: percent who confirm a plan in the first session without help; percent who open the app unprompted on day 2; percent who answer a check-in; AI cost per student per day (from `ai_usage`, new in round 2 because cost is now readable).
3. **Precondition for any outside pilot:** a public privacy and "for parents" page (N03). A parent will stop the test before the student does.

**What would change this view (I):** a recorded two-day run where a check-in answer visibly changes the next day's steps would raise differentiation several points; a plan-quality regression in the re-run eval would lower it; day-2 return below half says the follow-up is not yet a retention engine.

## 6. What this round could not tell us

- Whether chat, plan quality, capture parsing, "Stop and plan", the no-re-ask logic, Confirm feedback and the true source line work for a real student. None were run (no credit).
- Whether a brand-new student sees one calm first screen: no empty-account first run, onboarding or overlay queue was captured.
- How the six round-1 personas would score now. No persona outcome is claimed.
- How Today looks when it is busy or overdue: the after account had one item and nothing past due, so the "Catch up" fold, the populated Home and the overdue Projects flag were never seen.
- Whether the plan-page changes ("Why this plan", at most 3 assumptions, saved line, editable title) read well: no plan was drawn.
- The empty-calendar line and the Calendar hour grid: shots were in Agenda mode.
- Any toast, modal, check-in or Done-tap behaviour (C07, C08).
- Phone layout of the final build for Home and Calendar (390 shots predate the last fixes; the fix shots are 1440 dark only).
- Contrast at 1440 on 11 of 12 pages, and whether the You-map labels are readable (they pass 4.5:1 and are about 9px).
- How much of the Today, Calendar and Projects gain comes from the lighter test account rather than the changes (I's confound).
- Cost per active student, who pays, and whether the 4.5 post-event review idea works: estimates only (about $0.04 free and $0.20 paid per student per month from the planned design; the Deepgram rate is unconfirmed).
- Whether the "Added 6 steps but no project" case from round 1 is a data bug.
- Whether the heuristic drop (17 to 11) is real: one expert, 7 screens, one theme and width each time.

## 7. Keep, don't break (carried, with one round-2 addition)

- The plan card pattern (per-step Why, "What I used about you", draft until Confirm, Undo): untouched in structure this round (I).
- The Skip / Stop question card structure.
- Home as it is now: neutral greeting, one status line, one quiet Canvas row, no guilt number (all three). Keep it that quiet when adding the Next-up card (N06).
- Settings trust surfaces and the new Connections copy ("Tangent reads nothing until you do", "It's yours: take a copy any time").
- Honesty fixes: name a source only if read, no praise while steps remain, friendly errors (I: "exactly what an investor's own test drive would trip on").
- One violet, 44px targets, no sideways scroll at 390 on 13 pages in both themes (D).
- Cost discipline: one place assembles context, no third-party analytics or ad SDKs (I).

## 8. Guardrail check on the new items

- Capture, plan, done only: N06 and N16 serve the loop; N05 protects the "Say it, it's saved" promise. The 4.5 reviews scope concern (I) is flagged, not resolved here.
- Ask until enough, always stoppable: N16 keeps Skip and Stop non-blocking.
- No new top-level AI surface: N06 reuses one card on Home and the post-Confirm screen.
- Today scannable in 3 seconds: N06, N07 and N16 are written to that test.
- One design system: N11 pulls the map into the app's own surface.
