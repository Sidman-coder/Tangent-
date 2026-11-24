# Judge verdict, round 2: STUDENT ADVOCATE (judge-student-2)

Lens: a high-school student and a teacher in one. Clarity, effort, "would a teen come back tomorrow", trust, tone for minors.

## What I could and could not see

- Read: BASELINE.md, JUDGMENT-1.md, my round-1 file, the six sim notes (Maya's in full, the rest only as summarised in JUDGMENT-1), PROGRESS.md, LAUNCH-REVIEW.md, the heuristic reports. I did not open the other judges' round-2 files or JUDGMENT-2.md.
- Looked at (after vs before, 390px): home, capture, calendar, projects, projects-school, settings, settings-context, settings-data, settings-schedule (light, and dark for most), plus heur-signin, fix-home-status, fix-calendar-rail, calendar-1440-light. I skipped the account pages (they can show an email, which is masked in the files and not quoted here).
- The after screenshots are of a lived-in test account that now carries a persona name ("Leo"), one recurring Sunday 6 PM item, no project and 12 facts. They are not an empty first-run account.
- **No AI persona simulation was re-run (API credit empty, DECISIONS D6).** Chat, plan quality, capture parsing, the Confirm moment and the "Stop and plan" fix were never observed working in round 2. PROGRESS says group 2 (C04-C09) had "No browser check run", and the only live chat checks were two: the how-to question (C15) and the friendly API-error reply. Those areas are "not re-scored" below; I carry the round-1 number and do not credit code changes I cannot see.
- Rule I use for section 2: FIXED means I can see it in a screenshot or a PROGRESS-recorded live check. PARTLY means partly seen, or code plus unit tests only (not seen live). NOT FIXED means nothing changed or it was never attempted.

## 1. Scores (1-10), round 1 -> round 2

| Area | R1 | R2 | Evidence |
|---|---|---|---|
| First-use | 3 | 5 | Home no longer opens under the "One question" sheet or tour (`after/home-390-light.png` vs `before/home-390-light.png`; PROGRESS C01, `lib/first-run-gates.ts`). Capped at 5: no empty-account shot, sign-in still has no parent/privacy link (`after/heur-signin.png`), and with API credit empty a brand-new student could not get a first plan at all. |
| Chat | 4 | not re-scored (4) | C03/C04/C15 are in code with unit tests; only the "how do I prepare" reply was checked live (PROGRESS ~08:40). Stop-and-plan and re-asking were never re-observed. |
| Planning quality | 7 | not re-scored (7) | C02, C12, C13 (true source line, "Why this plan", editable title) exist in code and tests only. No plan screenshot in round 2. |
| Today (Home) | 4 | 7 | Calm, one screen: warm greeting, big add box, one "Next is Sun, Nov 22 . 6:00 PM" line, a collapsed "Coming up 1", one quiet Canvas row (`after/home-390-light.png`, `fix-home-status.png`). The 9 past due, "Still up", four empty rows and the sheet are all gone. Still weak: the one row's title clips at 390 ("Keeping a weekly Sunday video upl...") and there is little to pull a student back (see new issues). |
| Calendar | 4 | 6 | Rail count now matches the agenda ("1 thing", `fix-calendar-rail.png`; before: "6 things" over one item), agenda titles wrap at 1440, History icon replaces the arrow. Still: 390 titles cut at two lines (`after/calendar-390-light.png`), the History icon has no visible label, and the mic floats over the empty area of the card. Empty-state "Add something" line not seen (the account has items). |
| Projects | 4 | 5 | The School page is no longer a dead sentence: it has "Connect Canvas" (`after/projects-school-390-light.png`), and "Tangents" is a quiet text link. But the screenshots are of an account with no project, so the stale "Next" date, the Overdue flag and the card grid were not seen. The empty page leads with a long AI intake box and the floating mic overlaps the "School & Work" card (`after/projects-390-light.png`). |
| Settings / You | 5 | 6 | New "Connections" block says "Tangent reads nothing until you do" and says what is kept (`after/settings-schedule-390-light.png`). Zero areas read "Not asked yet" in the list; contrast fixed (PROGRESS). But the map still clips "Classes & activities" at 390 (`after/settings-context-390-light.png`), still looks cream/glow, and the tab strip still clips "Your data" and "Account". |
| Overall polish | 5 | 6 | Consistent look held, no sideways scroll, 44px targets and contrast measured (PROGRESS 4.1, Phase 5). Friendly offline/mic/API errors in code. Dragged down by clipped titles, clipped tab labels, "0 things" on Capture while Home shows an item, and no offline page. |
| Differentiation | 6 | not re-scored (6) | The edge (one sentence into a dated plan around busy times) and the "follows up" half were not shown in round 2. |
| **Overall** | **4.5** | **5.5** | The shell I could see is clearly better and kinder. The engine, which is the reason to come back, is unverified this round, so I do not move higher. |

## 2. Round-1 issues a student would feel

Consensus ID in brackets (JUDGMENT-1). "code+tests" means PROGRESS names a test or file but I saw no live result.

| Issue | Status | Evidence |
|---|---|---|
| Stacked overlays block the first keystroke [C01] | FIXED (on the same lived-in account) | `after/home-390-light.png` has no sheet, tour or notification alert; PROGRESS C01. Not seen on an empty first login. |
| Plan claims it read Canvas and Gmail [C02] | PARTLY | code+tests: `lib/source-read.ts` names a source only if its tool returned data. No plan seen. |
| "Stop and plan" asks another question [C03] | PARTLY | code+tests: GRILL_DONE_MARK (PROGRESS ~04:20). Never run live. |
| Chat re-asks what was typed [C04] | PARTLY | code+tests: `infer.ts` reads "Thu Dec 17", meter copy changed. Never run live. |
| Silence after Confirm [C05] | PARTLY | code only: "Saved N steps / First up / View in Calendar" (PROGRESS ~05:00). No browser check on group 2. |
| No public privacy/terms/parent page [C06] | NOT FIXED | `after/heur-signin.png` has no footer links; round-2 heuristic F11; LAUNCH-REVIEW B1 (the pages do not exist at all). |
| Toast/draft dock cover buttons [C07] | PARTLY | code only (PROGRESS ~05:15). |
| Done on an unstarted step gives false praise [C08] | PARTLY | code only: no praise while steps ahead, one-row check-in. |
| Capture drops items / "Placing..." no progress [C09] | PARTLY | code only: `splitCaptureItems`, "still working" note after 5 s. Never run with a real sentence. |
| Today leads with guilt numbers and empty rows [C10] | FIXED | `after/home-390-light.png`, `after/home-390-dark.png`; PROGRESS ~06:10 (neutral greeting, "Catch up" fold, one calm line). |
| Home hides the next step / contradicts Calendar [C11] | FIXED | `fix-home-status.png` ("Next is Sun, Nov 22"), `fix-calendar-rail.png` (rail "1 thing" equals the agenda). |
| Stale or contradictory plan text [C12] | PARTLY | code only (title PATCH, status only while draft). |
| Plan page is a wall of assumptions [C13] | PARTLY | code only ("Why this plan", at most 3 assumptions). |
| Canvas promo card noise [C14] | FIXED | one quiet text row with "Not now" in `after/home-390-light.png`. |
| "How do I..." gets a form, not advice [C15] | PARTLY | PROGRESS ~08:40 live re-check answered with the student's own context (scratchpad shot, not in my set). One question only. |
| Canvas flow silent on storage/disconnect [C16] | PARTLY | copy fixed in `after/settings-schedule-390-light.png`; but the only way to remove Canvas data is "Delete all my data" (real disconnect gated, NEEDS-SID). |
| Empty Calendar hint, mic over grid, unlabelled history icon [C17] | PARTLY | History icon and room for the mic done; icon still has no visible label (heuristic F07) and the mic still floats in the card (`after/calendar-390-light.png`). |
| Projects sparse and stale [C18] | PARTLY | School page and Tangents link improved (`after/projects-school-390-light.png`); overdue flag and card grid unseen. |
| You, mapped off-system, clips, zeros [C19] | PARTLY | contrast fixed, "Not asked yet" in the list; map still clips a label at 390 and shows "School 0" on the map (`after/settings-context-390-light.png`). |
| Wrong labels (exam prep as Personal, practice with a Done circle) [C20] | PARTLY | tests in `lib/task-kind.test.ts`; not seen on screen. |
| "Follows up" never seen [C21] | NOT FIXED | LATER item; NEEDS-SID spec only. |
| 30 s capture wait [C22] | NOT FIXED | only a progress note was added. Latency untouched. |
| Stale name after reset [C23] | NOT FIXED | gated; home now greets the persona name, but I cannot tell whether that is the artifact or a fix. |
| Sign-in "listens / what it already knows about you" copy, Google loudest (R1 judge D) | NOT FIXED | same copy in `after/heur-signin.png`. |
| "Tangents" vs "path" jargon (my round-1 list) | NOT FIXED | heuristic F02 persists. |

## 3. New issues (top 15, most important first)

1. **No way to disconnect Canvas without deleting everything** (significant). `after/settings-schedule-390-light.png`: "To remove them, use Delete all my data under Your data." The copy is honest, but for a 15-year-old and a parent the only exit is nuclear. This is the opposite of the line above it ("Tangent reads nothing until you do"). Evidence also in PROGRESS C16 (true disconnect gated).
2. **The highest-trust fixes were never seen working** (significant). C02, C03, C04, C05, C08, C09 are code and unit tests only; PROGRESS says no browser check on group 2, and the persona sims were not re-run. Until someone runs one real sentence through, I cannot say a student would feel any of them.
3. **A student with no AI credit hits a dead end** (significant). Credit is empty (D6). The new reply "I couldn't do that right now. Try again in a minute." (PROGRESS Phase 5) is polite and kinder than raw JSON, but "in a minute" is not true if the balance is zero, and nothing says the typed text was kept. Offer "I saved your words as a plain to-do" instead.
4. **Typing offline loses the text** (significant for a phone-first app). LAUNCH-REVIEW S1: no service worker, no offline page, capture not queued; the new message is friendly ("No connection...") but the words are gone on reload.
5. **Sign-in still has nothing for a parent** (significant, carried but now confirmed worse). LAUNCH-REVIEW B1 corrects NEEDS-SID: the privacy/terms pages do not exist at all. Meanwhile Settings now says "Tangent reads nothing until you do" and "It's yours", which is exactly what a parent would want to read before signing up, and it is only visible after sign-in.
6. **Home has little pull for tomorrow** (significant for retention). After the cleanup, `after/home-390-light.png` is calm but shows one grey row ("Coming up 1", a three-week repeating Sunday item with a goal-sized title). The new answer to "what do I do now?" is "Nothing planned today", with a Sunday item that is 4 days away. Calm is right; empty is not a reason to open the app.
7. **Two homes still disagree** (minor to significant). `after/capture-390-light.png` says "To do, 0 things / Nothing to do. Hold to add something." while Home shows an upcoming item. A student who uses the mic page sees a list that denies their own plan.
8. **The one visible Home row is clipped at 390** (minor). "Keeping a weekly Sunday video upl..." (`after/home-390-light.png`); the Calendar agenda at 390 also cuts at two lines (`after/calendar-390-light.png`). The 1440 fix wraps in full (`fix-calendar-rail.png`) but the phone was not re-shot after the fix.
9. **You, mapped still clips and still glows** (minor). "Classes & activities" runs off the right edge at 390 (`after/settings-context-390-light.png`); the card is still cream/glow in both themes, and zero areas still say "0" on the map even though the list says "Not asked yet".
10. **Settings tab strip clips labels** (minor). "Your data" cut to "Your dat" (`after/settings-data-390-light.png`) and "Account" cut at the left (`after/settings-schedule-390-light.png`); LAUNCH-REVIEW N1 shows a clip at 360px too.
11. **Projects with no project leads with an AI intake box and four example chips** (minor). `after/projects-390-light.png`: the "School & Work" card is below the fold and the floating mic covers its corner. "Tangents" is now a small underlined link that is easy to miss and still jargon.
12. **School page is a dead end for a student without Canvas** (minor). `after/projects-school-390-light.png` offers only "Connect Canvas"; Priya in round 1 could not find a feed link at all. Add "or type what's due".
13. **"2 questions to sharpen your plans" stays above the day** (minor). Dismissible, but the X is icon-only (heuristic F07, "Hide until tomorrow") and it reads like a homework nudge on a quiet screen. Pull-based, not guilt-based, so only minor.
14. **Data verbs and confirmations still inconsistent** (minor). Forget / Clear / Delete / Remove (heuristic F05). The typed-DELETE confirmation exists (round-1 keep list), so the F06 "no confirmation" claim is probably an evaluator artifact, but a nervous parent cannot see that from the page.
15. **Phone screenshots lag the last fixes** (minor, evidence gap). The 390 Home and Calendar shots were taken before the F08/F10 fixes (fix shots are 1440), so I cannot confirm the phone layout of the final build.

### Would I open it again tomorrow?

**Partly.** From the screenshots alone: the Home is now a calm, kind page with no scolding number, and I would not be driven off by it. But I can see only one recurring item and a Sunday date, nothing that tells me what to do tomorrow, and I cannot see a first plan being made (credit empty, no sim). If a real plan worked, I would probably return for the "Next:" line; if the plan step failed with "Try again in a minute", I would not.

### Tone check for minors

- Good, seen: no past-due count, no "Still up" at 1 AM, a "Good evening, Leo" greeting, "Catch up" instead of pile-up copy in PROGRESS, "Tangent reads nothing until you do", and "It's yours: take a copy any time" (`after/home-390-light.png`, `after/settings-schedule-390-light.png`, `after/settings-data-390-light.png`). No streaks, no scores, no praise for work not done (the latter code only). The Canvas row has a plain "Not now".
- Still off: the sign-in page says the planner "listens" and asks questions "built from what it already knows about you" (`after/heur-signin.png`), which a parent will read as surveillance. "Delete all my data" is the only way to drop Canvas. "Tangent will watch for exactly that" (round 1 sheet) is no longer on Home but the line still lives in the sheet code unless removed; I did not check the code.

## 4. The single change that would most raise a student's chance of coming back

Make tomorrow's first screen an answer to "what do I do now?", not a calm empty page: after a student confirms their first plan, the next day's Home should open on one named next step ("Next: finish the kinetics rate laws, tonight 7:00 PM") with three one-tap choices, Done, Move it, Not today, where "Not today" quietly re-spaces the rest of the plan without any scolding or score, and the Calendar rail and Capture list say the same thing. The round-2 work removed what pushed a student away (stacked pop-ups, guilt numbers, four empty rows, a false Calendar count), but a clean Home with one distant row does not give a 16-year-old a reason to open it, and the "follows up" promise (C21) was never seen working. Before that, someone has to top up the API credit and run one real sentence from typing to Confirm to next-day Home, because every trust fix (true source line, Stop and plan, "Saved N steps") is still unverified; if that run passes, the day-2 next-step hook is the change that converts the first-use improvements into a habit.
