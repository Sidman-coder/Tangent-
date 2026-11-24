# Design Judge 1: Tangent visual and interaction review

Evidence read: BASELINE.md, about 45 screenshots in `docs/overnight/screens/before/` (home, capture, calendar, projects, projects-school, tangents, settings-*, signin-*, heur-*, notification-panel, sim-* steps), the six simulation reports and sim-notes, and the heuristic report. No source code or other judges' output was read.

Caveats on what was observable:
- Home/Calendar/Projects/Settings shots are of a lived-in test account (9 past due, a stale project), not a new student.
- The sim step shots are all 1440x900 and mostly dark mode. The 390px first-use flow is only seen on the lived-in account (home-390 with the One question sheet).
- `notification-panel.png` actually shows the Home screen with a small "You're all caught up" popover (empty state only). A populated notification list was not seen.
- Motion, transitions and loading states cannot be judged from stills. The only evidence is "Placing...", reported as roughly 30 s in one run and about 6 s in another.

## 1. Scores (1-10)

| Area | Score | Justification |
|---|---|---|
| First-use | 3 | Every persona hit 2-3 stacked overlays (One question, 12-step tour, notification alert) before the first keystroke, and the scrim blocks the alert's Not now. This is the weakest part of the product (`sim-sam-step2-tour-over-chat`, `sim-jordan-step1-first-screen`). |
| Chat | 5 | The chat page itself is clean and quiet, with a good "skip and plan it anyway" inline link and Skip / Stop and plan on the question card. But Stop and plan returned another question, a "How do I..." got an intake form, and the "knows enough: 25%" meter reads as grading. |
| Planning quality | 6 | The plan presentation (Why per step, "You'll have", Confirm / Edit / Discard, "Nothing is on your calendar until you confirm") is the product's best moment. It is drowned by a wall of "What I used / What I assumed" bullets with leaked template text, and it has a false "read Canvas and Gmail" line. |
| Today (Home) | 5 | The greeting and add box are good, but pile-up copy, a duplicate setup strip, four "Nothing this ..." rows, a heavy Canvas promo and a collapsed Coming up make it fail the 3-second scan. Post-confirm Home hides what was just planned. |
| Calendar | 6 | The calendar is the tidiest screen: clear 3-day / Week toggle, today highlighted, sensible event chip, and a useful "Ask about your week" rail on desktop. Weaknesses are an empty grid with no hint, a floating mic over the grid, a cryptic icon-only history button, and 7-day panel vs grid disagreement. |
| Projects | 4 | A single card on a mostly empty page. The Next step is dated 10 days ago and truncated. Two competing pill buttons sit above it, and the School project page is a one-sentence void. |
| Settings / You | 5 | Settings is orderly and plain-language (Your data is a trust strength). "You, mapped" is a different visual language (cream or dark-glow orb, tiny labels, clipped chips) from the rest of the app, with zero-count areas that look like failures. Sub-nav is a clipped scrolling tab strip on phone. |
| Overall polish | 6 | The core design system is coherent: one purple, consistent radii, restrained shadows, good type hierarchy, dark mode that holds up. It loses points for overlay discipline, empty/stale states, stacked fixed-position elements, and one off-system hero (the map). |
| Differentiation | 6 | Visible "why this step" reasoning, draft-until-confirm and a question card with Skip / Stop are genuinely unlike a to-do app. The sign-in and Home do not surface that edge in the first five seconds, and the "knows about you" language trips trust. |

## 2. Top 15 issues (most important first)

1. **stacked-overlays** (fatal)
   - Evidence: `sim-sam-step2-tour-over-chat.png`, `sim-jordan-step1-first-screen.png`, `home-390-light.png`; Sam report: "Three overlays appeared before any content, and at step 1 the notification alert's Not now was unreachable"; Maya: "Two stacked prompts before the add box is usable".
   - A first-run queue of One question, then tour, then notification toast, all modal or floating, blocks the input on every persona and the scrim blocks the toast.
   - Fix direction: allow one overlay at a time with no scrim over the input, drop the tour and One question from first load, and ask for notifications only after the first confirmed plan.

2. **toast-covers-controls** (significant)
   - Evidence: `sim-priya-step7-toast-covers-next.png`; Priya notes: "toast ... fully covers the modal's Next button ... intercepted pointer events 55 times"; Leo: the draft dock pill covers the Delete everything button.
   - Fixed bottom-right elements (notification toast, draft-plan dock) float over page and modal actions and persist across pages.
   - Fix direction: give fixed elements a single reserved slot below modals, never overlap primary actions, and auto-dismiss or collapse the notification prompt.

3. **post-confirm-silence** (fatal)
   - Evidence: Priya step 14: "I pressed Confirm and got silence"; Leo: Home shows "Nothing planned today / Coming up 0" while /calendar lists 6 steps; `sim-jordan-step5-home-after-confirm.png`; Sam: "no 'saved, you're set' confirmation".
   - The plan view closes itself within a minute, and Home does not show what was just planned, so the capture-to-done loop looks broken at its payoff moment.
   - Fix direction: after Confirm, land on Home with a persistent "Saved, first step: X, tonight 7:00 PM" line and show this week's steps expanded, not under a collapsed Coming up.

4. **stale-state-copy** (significant)
   - Evidence: Jordan step 4: "'Nothing is on your calendar until you confirm' (now false, directly above the status line)"; Leo: "No time given, so no set time" persists after he set 18:00; "Spread from today to today".
   - Static or template text contradicts the live state of the screen, which undermines the explicit draft vs confirmed state design.
   - Fix direction: derive the status block from state (draft / confirmed / edited) and swap or hide assumptions that no longer apply.

5. **plan-wall-of-text** (significant)
   - Evidence: `sim-maya-step10-real-plan.png` (a 1,900px page of Why / You'll have / 10 assumption bullets, including "Starting from the idea stage"); Jordan: "feels like homework about homework".
   - The reasoning is the differentiator but is rendered at equal weight as the plan, with leaked project-template assumptions.
   - Fix direction: lead with steps and times, collapse "What I used / assumed" into one "Why this plan" disclosure, and cap at 3 bullets.

6. **false-data-claim** (significant)
   - Evidence: Sam step 4: "Based on what Tangent read in Canvas and Gmail" when neither is connected; also in Priya's plan; Sam "a little creeped out".
   - A hard-coded assumption line states a data source that does not exist, which hurts trust more than any visual flaw.
   - Fix direction: render source lines only when the integration is connected, otherwise "Based on what you told me".

7. **today-pileup-and-empty-rows** (significant)
   - Evidence: `home-390-light.png`, `home-1440-light.png`: "9 past due" in the subtitle, "A lot piled up" plus Fresh start, four "Nothing this morning / afternoon / evening / late tonight" rows, a duplicate setup strip, "Coming up 0".
   - The screen is not scannable in 3 seconds: negative counts lead, and four empty timeline rows plus two prompts compete with the one useful item.
   - Fix direction: collapse empty day-parts into one line, lead with the next action, and move past-due and setup prompts below it.

8. **canvas-card-noise** (significant)
   - Evidence: `sim-maya-step11-confirmed.png`, `sim-sam-step6-after-done.png`; heuristic F14; every persona called it noise ("A Canvas ad").
   - A full-width card with a bright lavender CTA persists on every Home view after a student has already dismissed or seen it.
   - Fix direction: make it a quiet one-line text row, honor Not now permanently, and defer it until after the first confirmed plan.

9. **fake-celebration-checkin** (significant)
   - Evidence: `sim-sam-step6-after-done.png`; Sam: "Nice work today, Sam / All done for today" after an unstarted step, then a two-row quiz with two Skip buttons; Jordan: "I tapped Done and got a questionnaire".
   - The success state is unconditional and the check-in popover is a dense 7-control form for a single tap.
   - Fix direction: confirm Done with an undo toast, show "All done" only when nothing remains this week, and reduce the check-in to one row with a single Skip.

10. **signin-trust-gap** (significant)
    - Evidence: `signin-1440-light.png`, `signin-390-light.png`; Dana: "/signin contains zero <a> links ... a stop sign"; heuristic F16.
    - The sign-in page is visually clean but has no price, privacy, terms or "for parents" line, and the feature list uses "listens" and "built from what it already knows about you", which reads as surveillance. Google is the loudest control.
    - Fix direction: add a footer with Privacy / Terms / For parents links and one line on what is stored, and reword "listens" and "knows about you".

11. **youmapped-off-system** (significant)
    - Evidence: `settings-context-390-light.png`, `settings-context-1440-dark.png`; baseline: "cream, glow ... label chips clip at the right edge ('Classes & activities 2' is cut off)"; heuristic F13.
    - A different visual dialect (beige orb, orbit lines, 8-10px labels, "Drag to turn") fills the first screen, labels clip on phone, and zero-count areas read as failures.
    - Fix direction: shrink the map to a compact header in the app's own surface style, raise label size, and show zero areas as "Not asked yet" in neutral text.

12. **projects-stale-sparse** (significant)
    - Evidence: `projects-390-light.png`, `projects-1440-light.png`, `projects-school-390-light.png`; baseline: "Next: Define your Instagram nic... Sun, Nov 8" ten days ago.
    - The page is a single half-width card with the Next step truncated and past-dated, two competing pill buttons (Tangents vs New project), and an empty School page that is one sentence.
    - Fix direction: flag overdue Next steps as overdue, make Tangents a text link, give School and empty projects a clear next action, and use the full-width card grid.

13. **calendar-empty-and-icon-only** (minor)
    - Evidence: `calendar-390-light.png` (empty grid, floating mic over the grid corner, bare arrow icon next to the view tabs); heuristic F11 and F02.
    - An empty hour grid gives no hint what to do, the floating mic overlaps content, and the history button has no label.
    - Fix direction: add one empty-state line with a CTA, anchor the mic outside the grid or move it into the tab bar, and label the icon "Recent changes".

14. **chat-ask-again-meter** (significant)
    - Evidence: Maya: "Stop and plan did not plan ... a second question" and "When is this?" asked though the date was typed; Priya: "'Tangent knows enough: 33%' feels like it is grading her" (`sim-maya-step8-asks-when.png`).
    - The question card's controls are correct, but the percent meter, the redundant question and a Stop that does not stop undercut the "ask only what changes the plan" promise.
    - Fix direction: drop the percentage or replace it with "1 question left", never re-ask what the sentence contains, and make Stop and plan always produce a plan.

15. **mobile-settings-nav-clipped** (minor)
    - Evidence: `settings-schedule-390-dark.png` (tab strip scrolled mid-word ".ccount ... AI"), `settings-data-390-light.png` (hint under tab bar), `settings-context-390-light.png`.
    - The phone settings sub-nav is a horizontally scrolling text strip with partly clipped labels, and bottom content slides under the tab bar.
    - Fix direction: replace it with a stacked list or a segmented control that fits, and add bottom padding above the tab bar.

## 3. What is already good (do not break)

- **The plan card pattern.** Per-step "Why" and "You'll have" lines, a Brief and month-calendar preview, and the explicit draft-until-confirm copy with Confirm / Edit / Discard plus Undo (`sim-jordan-step3-plan.png`, `sim-sam-step4-after-essay.png`). This is the product's identity and is visually clear.
- **A coherent, restrained design system.** One purple, consistent rounded surfaces, soft shadows, no gradients-and-glow slop, no emoji icons, readable type scale, and a dark mode that holds contrast (`home-390-dark.png`, `calendar-1440-light.png`, `settings-1440-light.png`). Settings rows with title, one-line plain explanation and a right-aligned control are exactly right.
- **Question card with Skip and Stop and plan.** Visible escape hatches, a stated default ("If you skip: about 2 weeks"), and chip answers. The structure is right even though the content needs work (`sim-maya-step8-asks-when.png`).
- **Your data page.** Plain-language storage, Download, Clear this browser and Delete with a typed-DELETE confirm builds trust (`settings-data-390-light.png`).
- **Calendar layout and "Ask about your week".** Clean 3-day mobile grid, strong today marker, tidy chips and suggested-question pills in the desktop rail (`calendar-390-light.png`, `calendar-1440-light.png`).
