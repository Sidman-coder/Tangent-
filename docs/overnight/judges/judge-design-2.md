# Design Judge 2: Tangent visual and interaction review, round 2

Evidence read: BASELINE.md, JUDGMENT-1.md, my round-1 file, DESIGN-NOTES.md, PROGRESS.md, the style spec header, both heuristic reports (round 1 and round 2), and the round-2 screenshots in `docs/overnight/screens/after/` (home, calendar, projects, projects-school, settings index, settings-context, settings-data, settings-schedule, settings-notifications, settings-activity, capture, heur-signin, heur-tangents, fix-calendar-rail, fix-home-status) compared with the matching `before/` files. I did not read the other judges' round-2 files or any source code. No email address is quoted; the account page was not opened.

Limits that shape every score below:
- The API had no credit, so chat replies, plan drafting, confirm, capture parsing and the persona runs were NOT re-run. Those areas are "not re-scored" and keep the round-1 number.
- The after shots are the lived-in test account, now showing a persona name (Leo), with one upcoming item and no past-due. So the old pile-up, stale project card and populated Today were not re-seen. The calendar shots are in Agenda mode, so the empty hour grid and its new empty-state line were never seen.
- The two Calendar 1440 shots (`calendar-1440-light/dark.png`) and `home-1440-*.png` were taken BEFORE the heuristic fixes (rail still says "6 things", agenda titles truncated). Only `fix-calendar-rail.png` and `fix-home-status.png` show the fixed state, and only in dark at 1440.
- Contrast: script-measured, 0 failures at 390 on 12 pages in both themes, and at 1440 only for /settings/context. I did not re-measure anything. "Passes 4.5:1" does not mean "readable": the You-map labels pass and are still about 9px.
- First-run (new account, onboarding, overlay queue) was not captured.

## 1. Scores (1-10), round 1 -> round 2

| Area | R1 | R2 | Evidence |
|---|---|---|---|
| First-use | 3 | 4 (provisional) | `home-390-light.png` after: the "One question" sheet and its scrim are gone, replaced by an inline "2 questions to sharpen your plans" strip; no tour or toast on load. But this is a lived-in account; the new-student first run was not captured, so the fix is shown by code and tests, not by a first-run screenshot. |
| Chat | 5 | not re-scored (5) | No credit; no chat shot. |
| Planning quality | 6 | not re-scored (6) | No plan was drafted in round 2. The plan-page changes (Why this plan, 3 assumptions, saved line) are claimed in PROGRESS and never seen. |
| Today (Home) | 5 | 6 | `home-390-light.png`: neutral greeting, one status line, one collapsed "Coming up 1", no four empty day-part rows, Canvas is one quiet text row. Held back by the 2-question strip above the filters, a truncated task title ("...video upl"), and the next step still being a sentence plus an accordion rather than a visible item. Populated and overdue states unseen. |
| Calendar | 6 | 7 | `fix-calendar-rail.png`: rail now "1 thing", agenda titles wrap to two lines, history icon (clock) replaces the bare arrow. Still the floating mic over the panel corner (`calendar-390-light.png`) and the empty grid state is unseen. |
| Projects | 4 | 5 | `projects-school-390-light.png`: School now has one sentence and a filled Connect Canvas button; Tangents is a text link. But the page now leads with a full composer, `projects-390-light.png` has two mics (composer plus floating) and the floating mic covers the first card, and the stale Next-step card was not re-seen. |
| Settings / You | 5 | 6 | `settings-390-light.png` index is a clean, plain list; `settings-schedule-390-dark.png` Connections copy is honest ("Tangent reads nothing until you do"). But `settings-context-*` is still the off-system cream map with glow, and the phone sub-nav is still clipped (see section 2). |
| Overall polish | 6 | 7 | Token pass is visible in how consistent the radii, 44px rows and one-violet palette look across 13 pages x 2 widths x 2 themes; no sideways scroll; dark mode holds. Loses points for the map, the clipped tab strip, floating-mic overlaps and stale-state screenshots. |
| Differentiation | 6 | not re-scored (6) | Depends on the plan card and Skip/Stop question card, neither re-seen. Sign-in (`heur-signin.png`) is unchanged. |

Overall: 5.1 -> 5.8 (mean of the nine areas; five areas carry round-1 numbers or are provisional, so the real movement is smaller than it looks). Round 2 made the shell calmer and more consistent. It did not, and could not, prove the loop.

## 2. Round-1 design issues: status

My round-1 list (D1-D15) and the consensus items that touch design (C-numbers from JUDGMENT-1).

| # | Issue | Status | Evidence |
|---|---|---|---|
| D1 / C01 | Stacked overlays at first load | PARTLY | `home-390-light.png` after: no sheet, no scrim, inline strip. Lived-in account only; new-account first run never captured. Code/tests only for the tour and notification gate. |
| D2 / C07 | Toast and draft dock cover controls | PARTLY (unverified) | PROGRESS says toast moves to the top while a modal is open. No modal or toast was captured in round 2. |
| D3 / C05 | Silence after Confirm | PARTLY (unverified) | PROGRESS says the plan page stays open with "Saved N steps / First up / View in Calendar". Not seen (no credit). Home side is visibly better: "Next is Sun, Nov 22 . 6:00 PM" in `fix-home-status.png`. |
| D4 / C12 | Stale state copy | PARTLY (unverified) | Code and tests only. |
| D5 / C13 | Plan wall of text | PARTLY (unverified) | Code only. Not re-seen. |
| D6 / C02 | False "read Canvas and Gmail" claim | PARTLY (unverified) | `lib/source-read.ts` and tests; no plan drawn. |
| D7 / C10 | Today pile-up and empty rows | FIXED (for the state shown) | `home-390-light.png` before vs after: "9 past due", "A lot piled up", four "Nothing this..." rows and the duplicate setup strip are gone. The folded "Catch up" row is not visible because the account has nothing overdue. |
| D8 / C14 | Canvas promo card noise | FIXED (demoted) | After: a one-line row "Bring your Canvas deadlines in..." with Connect Canvas / Not now, no bright card. Permanent dismissal is deferred to NEEDS-SID. |
| D9 / C08 | False celebration and quiz on Done | PARTLY (unverified) | Code only. |
| D10 / C06 | Sign-in trust gap | NOT FIXED | `heur-signin.png` after: still no footer links, "listens" and "built from what it already knows about you" unchanged. Round-2 heuristic F11. Gated by design. |
| D11 / C19 | You, mapped off-system | PARTLY | Zero areas now read "Not asked yet" in the list (`settings-context-1440-light.png`); stage is shorter on phone. Still cream background, glowing dots, orbit rings, dark-mode brown tint, labels about 9px, and "Classes & activities 0" still clipped at the right edge in `settings-context-390-light.png` and `-dark.png`. |
| D12 / C18 | Projects stale and sparse | PARTLY | School empty state fixed (`projects-school-390-light.png`), Tangents is a text link, card grid is in place. Stale overdue Next step not re-seen. New problem: the composer now dominates the page (see N5). |
| D13 / C17 | Calendar empty, mic over grid, icon-only history | PARTLY | History now a clock icon (`calendar-390-light.png`) but still no visible label; the floating mic still overlaps the panel corner; empty-state line never seen (shots are Agenda mode). |
| D14 / C03-C04 | Chat meter, Stop and plan, re-asking | not re-scored | No credit. |
| D15 | Phone Settings sub-nav clipped | NOT FIXED | `settings-schedule-390-dark.png` ("Account" cut to ".ccount", "AI" cut), `settings-notifications-390-dark.png` ("urity", "You"), `settings-data-390-light.png` (active tab "Your dat"). Identical to round 1. |
| C11 | Home and Calendar disagree | PARTLY | Fixed for the rail (`fix-calendar-rail.png` "1 thing" matches the agenda). Not fixed for Capture: see N8. |
| C20 | Mislabelled categories / busy blocks | not re-scored | No such data in the after shots. |

## 3. New issues (round 2), most important first

Severity: fatal / significant / minor. None is fatal.

1. **You, mapped is still a different design language** (significant). `settings-context-1440-light.png`, `settings-context-1440-dark.png`: cream/beige panel, soft glowing dots, orbit rings, a "Drag to turn" hint, and in dark a brown tint that appears nowhere else. It fills the whole first viewport at 1440 and pushes the editable facts below the fold (heuristic R2 F09). This is the only glow in the app and it contradicts the style spec ("no gradients, no glass on content"). Round 1 flagged it as significant; round 2 softened it but did not bring it into the system.
2. **Map labels clip and are tiny** (significant). `settings-context-390-light.png`: "Classes & activities 0" is cut off at the right edge; "How you work 6" and "Commitments 1" are about 8 to 9px. They pass the 4.5:1 script and are still unreadable on a phone. DESIGN-NOTES claims bigger labels; the shot does not show that.
3. **Sign-in still has no trust layer** (significant). `heur-signin.png`; R2 heuristic F11 (priority 5.0). No privacy, terms or "for parents" link, and "listens" / "knows about you" are unreworded. This is design-adjacent (a footer) and was correctly gated, but the copy-only part (surveillance wording) could have been fixed without touching sign-in logic.
4. **Settings sub-nav on phone is still a clipped tab strip** (minor, persistent). Three shots above. The active tab on the page named "Your data" shows "Your dat". It is the only way between Settings pages on a phone except back-and-in.
5. **Projects at 390: two mics, a clipped placeholder and a mic that covers the first card** (significant). `projects-390-light.png` and `-dark.png`: the composer has its own mic, a second large floating mic sits bottom right and overlaps the "School" card, and the placeholder ("Prep for my chem final on Dec 12, start a robotics...") is truncated against the "New project" pill. Projects also now repeats a Home-style composer, which breaks "no second input" from the earlier problem list.
6. **Calendar floating mic still over content** (minor). `calendar-390-light.png`: the mic overlaps the bottom corner of the calendar panel. PROGRESS C17 says "room under content for the phone mic", which is not what the screenshot shows.
7. **Two homes still disagree** (significant). `capture-390-light.png` and `-dark.png`: "To do, 0 things / Nothing to do" while Home (`home-390-light.png`) shows an item for Sun, Nov 22. Capture also uses a lowercase "tangent" wordmark with no logo mark, a different top bar, and no tab bar. This is the baseline's "two homes" item, unchanged.
8. **Today's next step is a sentence, not an item** (minor/significant for the 3-second test). `home-390-light.png`: "Nothing planned today. Next is Sun, Nov 22 . 6:00 PM." then a collapsed "COMING UP 1" accordion, then the row. The student reads the same information twice and the next action is not a hero. The task title is also truncated at 390 ("...video upl").
9. **Screenshot evidence is partly stale** (minor, process). `calendar-1440-light.png` and `-dark.png` still show "6 things" and truncated agenda titles, `home-1440-*.png` shows the doubled "Nothing planned today" that the fix removed. Anyone reading the `after/` folder alone will think the bugs are still live.
10. **Agenda titles still truncate at 390** (minor). `calendar-390-light.png`: two lines then an ellipsis ("...going withou..."), and three rows with the identical title. The fix is only seen at 1440 dark (`fix-calendar-rail.png`).
11. **Destructive buttons have the same size and shape as neutral ones** (minor). `settings-data-1440-dark.png`: solid coral "Delete data" and "Delete account" in the same list as outline "Download" and "Clear". The coral differentiates, but the verbs (Forget / Clear / Delete / Remove) remain inconsistent (R2 F05); confirmation dialogs were not captured (R2 F06).
12. **Icon-only controls remain** (minor). Home mic, send arrow, dismiss X on the question strip and the Calendar clock/history icon have no visible text (R2 F07). Home "Auto" pill is unexplained jargon.
13. **Map shows "0" while the list says "Not asked yet"** (minor). `settings-context-1440-light.png`: "Classes & activities 0" and "School 0" on the map, "Not asked yet" in the list below. Two vocabularies for the same state, and the map still reads as failure.
14. **Type scale is not collapsed** (minor, self-reported). DESIGN-NOTES section 4: still 11 distinct sizes. Not visible as a defect in the shots, but it is the reason the small labels persist.
15. **Tangents screen jargon and "path"** (minor). `heur-tangents.png`: page called Tangents, button "Start your first path", sidebar lists it under PROJECTS (R2 F02). Unchanged.

AI-slop check on what I could see:
- Emoji: none. Sparkles: none in the live shots (Compass/Lightbulb used instead). Good.
- Gradients/glow: none on controls or buttons. Exceptions: the You-map glow (issue 1) and a very faint corner wash behind the sign-in page (`heur-signin.png`), which is mild.
- Generic cards: Home has no card stack; Projects has one "Nothing due right now" card with a dashed placeholder on the right that reads as an unfinished progress bar at 1440 (`projects-1440-light.png`).
- Radii: pills (filters, buttons, chips), 16px cards and 12px rows look consistent; the underlined "Tangents" text link is the only unstyled element.
- Contrast: 0 script failures at 390; not measured at 1440 on 11 pages.
- Icon-only controls: see issue 12.

## 4. The single most valuable next design change

Give Today one real hero: replace the sentence "Nothing planned today. Next is Sun, Nov 22 . 6:00 PM." plus the collapsed "Coming up" accordion with a single "Next up" item card (title wrapped to two lines, time, the Done circle, and a one-line "why" when there is one), and reuse that same card as the landing state after Confirm. Round 2 calmed Home by removing noise, but the screen still has no focal element, so the "scan in 3 seconds" promise rests on reading a sentence. Because the product's best moment (a confirmed plan with reasons) is the one thing round 2 could not re-test, a single shared "Next up" component is also the cheapest way to make the capture, plan, done payoff visible on both Home and the post-Confirm screen without adding a new surface. Runner-up: pull You, mapped into the app's flat surface style and delete the duplicate "Facts per area" list so the editable facts start in the first viewport.
