# Judge verdict: STUDENT ADVOCATE (judge-student-1)

Lens: a high-school student and a teacher in one. Clarity, effort, "would a teen come back tomorrow", trust, and tone for minors.

Evidence base: BASELINE.md, the `before/` screenshots (390px first), six simulation reports (Maya, Jordan, Sam, Priya, Leo, Dana the parent), the heuristic report, and the Sam notes. Caveats I am holding myself to:
- The baseline account is a lived-in test account, not a new student.
- Most simulation runs were at 1440px, not on a phone, so phone first-use of the chat and plan flow is **not directly observed**. I score it conservatively.
- No screenshot of a true empty-account Home exists. The 390 Home shot is partly covered by the "One question" sheet.
- Settings-account was excluded as instructed.

## 1. Scores (1-10)

| Area | Score | One-line justification |
|---|---|---|
| First-use | 3 | Every run opens on two or three stacked overlays (notification alert, "One question", 12-step tour) before the student can type; Sam, Leo, Maya and Priya all said they were close to quitting at this point. |
| Chat | 4 | Skip works in one tap for Jordan, but "Stop and plan" led to another question for Maya, and a prep question never got advice text; chat also asks for things the student already typed (date, sport). |
| Planning quality | 7 | The best part: dated steps with "Why" and "You'll have", constraints honoured (practice, debate, shifts, 11 pm), nothing on the calendar until Confirm; marred by a false "read Canvas and Gmail" line, a wall of "What I assumed", dropped items and one-step rounds. |
| Today (Home) | 4 | Greeting, big add box and timeline are good bones, but the screen leads with "9 past due" and "Still up, Sid?", shows "Nothing this morning" four times, says "All done / Nice work" after an accidental Done, and hides the Thu/Fri steps under a collapsed "Coming up". |
| Calendar | 4 | Clean 3-day/Month/Agenda layout, but the only capture is an empty grid with no hint what to do, the floating mic overlaps the grid, and the 7-day panel disagreed with the grid in the heuristic run (low confidence). |
| Projects | 4 | Thin evidence: one card whose "Next" step is dated 10 days ago (looks stale), two competing pills at the top, and Leo's confirmed project never appeared in the sidebar. |
| Settings / You | 5 | "Your data" is plain and honest (download, clear, delete all, "It's yours"), a real strength; but nothing near Canvas says what is stored or how to disconnect, the You-mapped map clips at 390 and shows zeros as failures, and Canvas is hidden under "Schedule". |
| Overall polish | 5 | Consistent lavender look and good 390px layouts with no sideways scroll, undercut by stale text ("Nothing is on your calendar until you confirm" after confirming, "Spread from today to today", "No time given" after setting a time) and a self-closing plan page. |
| Differentiation | 6 | One sentence to a personalised, dated plan that respects busy times is something Todoist and ChatGPT do not do; but the "follows up" edge is invisible on the first screen and was never shown working (no round 2, no daily bubble observed). |

Overall: **4.5 / 10** as a first-use experience for a real teenager today; the core planning engine is clearly stronger than the shell around it.

## 2. Top 15 issues (most important first)

1. **stacked-overlays** (fatal). Notification alert, "One question" sheet and a 12-step tour all appear before the student can type, and the scrim hides the alert's "Not now". Evidence: `sim-sam-step1-first-screen.png`, `home-390-light.png` (sheet over the input); Maya: "Two popups in a row and I haven't done anything yet." Fix: show at most one overlay ever on first load, none over the add box, and delay notifications until after the first confirmed plan.

2. **no-parent-privacy-page** (fatal for adoption). Signed out, `/signin` has zero links, no price, no privacy, terms, maker or delete info, and /privacy, /terms, /pricing all bounce to /signin. Evidence: Dana report: "Fails the 5-minute test"; heuristic F16; `signin-390-light.png`. Fix: add a footer with public Privacy / Terms / Pricing / "Who makes this" and a four-answer plain-language page (what is stored, who sees it, no AI training if true, how to delete).

3. **false-canvas-gmail-claim** (fatal for trust). The plan says "Based on what Tangent read in Canvas and Gmail" when neither is connected, one screen after the chat said they are not. Evidence: Sam and Priya reports ("a little creeped out"); `sim-sam-step4-after-essay.png`. Fix: only name a source if it is connected, otherwise "Based on what you told me".

4. **silent-confirm** (significant). After Confirm the plan page closes itself, Home shows nothing about what was added, and the planning chat vanishes. Evidence: Priya step 14: "I pressed Confirm and got silence"; Maya step 6; Leo step 12 ("Added 6 steps" but 1 item listed). Fix: keep a persistent "Saved: N steps, first one is Wed 7:00 PM, View in Calendar" state and never auto-close the page or its reply box.

5. **stop-means-another-question** (significant). "Stop and plan" and "Skip" can lead to another question or a default that contradicts what the student typed ("When is this?" for Thu Dec 17; skip default "about 2 weeks"). Evidence: Maya steps 8-9; Priya step 11. Fix: Stop always produces the plan or answer immediately, and anything already in the sentence (dates, items, times) is pre-filled and never re-asked.

6. **capture-drops-items** (significant). Typing two items produced one step, typed days were overridden ("No day given" though Friday was typed), and a 30-second "Placing..." with no progress. Evidence: Maya steps 3-4; `sim-maya-step3-draft-plan.png`. Fix: one item per thing typed, keep stated days, and show real progress text during the wait.

7. **false-praise-on-done** (significant). Tapping Done on a step never started gives "Nice work today, Sam." and "All done for today" plus a two-row quiz; a student who forgets things could believe the work is handled. Evidence: `sim-sam-step6-after-done.png`. Fix: confirm "Did you finish this?" with Undo and only celebrate after genuine completion; make the check-in one tap with a single Skip.

8. **no-next-step-after-done** (significant). After finishing a step, Evening shows 0 and the next step is hidden under a collapsed "Coming up"; Jordan stalled at "no second step". Evidence: Jordan step 7-8; `sim-jordan-step5-home-after-confirm.png`. Fix: after Done or a skipped check-in, show "Next: [step], [day time]" on Today and keep this week's steps expanded.

9. **guilt-numbers-and-greeting** (significant). "9 past due" leads the header and "Still up, Sid?" appears at 1 AM; Maya read both as guilt. Evidence: `home-390-light.png`; Maya step 7. Fix: lead with what to do now, show past-due as a quiet, collapsed "Catch up" row, and use a time-neutral greeting.

10. **plan-wall-of-text** (significant). The plan page has long "What I assumed" lists with odd or buggy lines ("Spread from today to today", "Starting from the idea stage", "Standard milestones: idea, research, build") and "What I used about you" with quotes the student never typed. Evidence: `sim-maya-step10-real-plan.png`; Jordan step 3; Priya step 3. Fix: show 2-3 assumptions that change the plan, collapse the rest under "Why this plan?", and cite the true source ("from your setup").

11. **stale-contradictory-text** (significant). Text that no longer matches state: "Nothing is on your calendar until you confirm" after confirm, "No time given" after setting a time, a locked title and a Wednesday date on a Sunday recurrence. Evidence: Leo steps 9-12; Jordan step 4. Fix: regenerate or hide those lines on any edit and on Confirm, and make the title editable.

12. **canvas-and-data-trust-gap** (significant). Canvas sits under "Schedule", the wizard never says what is stored, who sees it, or how to disconnect, and the toast covered the Next button; copy nudges "the more Tangent can see, the better it plans". Evidence: `settings-schedule-390-light.png`; Priya steps 4-8. Fix: add a one-line "what's stored / how to disconnect" under every Connect, label it "Connections", and drop the "share more" pressure.

13. **empty-states-no-action** (minor to significant). Home shows "Nothing this morning / afternoon / evening / late tonight" four times; Calendar's empty grid offers nothing; Tangents says "path" and "Tangent" for the same thing. Evidence: BASELINE.md Home and Calendar; `calendar-390-light.png`. Fix: one calm empty state with a single next action ("Tell me what's due this week") and one noun throughout.

14. **canvas-card-noise** (minor). The "Use Canvas?" card (bright purple button) shows on Home in every run and repeats even when the user said no or is not on Canvas. Evidence: heuristic F14; `sim-jordan-step5-home-after-confirm.png`. Fix: show it once, make it a quiet text link, and move it to after the first confirmed plan.

15. **you-map-clips-and-zeros** (minor). On a phone the You-mapped labels clip at the right edge ("Classes & activities" cut), the hint sits under the tab bar, zero-count areas read like failures, and the style (cream/glow) differs from the lavender app. Evidence: `settings-context-390-light.png`. Fix: use a compact header at 390, show "not asked yet" instead of 0, and keep the page in the app's style.

Not ranked but worth a chair's attention: mislabelled Saturday game as "Practice" (Jordan step 8), a Done circle on practice rows (Jordan), exam prep filed under "Personal" (Maya), "Goes to: Auto" jargon (heuristic F03), and a stale name after reset (Jordan seen in Sam's run) which is a likely test artifact.

## 3. Would I come back tomorrow?

Honestly, not on the first day I opened it: before I typed a single word I was hit with a notification alert, a question about my habits and a 12-card tour, and then "9 past due" made me feel behind. If I got past that, the moment I typed one sentence and got a 3-step plan on the right evenings that avoided my practice, I would have been impressed; that is the thing that would pull me back. But I would stop trusting it quickly if it said it had read my Canvas and Gmail when I never connected them, or praised me for a task I had not done, or if after Confirm nothing told me it was saved. I would only return if the first 30 seconds were a single clear box and a plan I could confirm, and my parent could read a plain privacy page before letting me sign up.

## 4. What is already good (do not break)

- **The plan format.** Dated steps, each with a "Why" and "You'll have", honouring practice, debate, shifts and a late-night cutoff, and the line "Nothing is on your calendar until you confirm" with Confirm / Edit / Discard and Undo (`sim-maya-step10-real-plan.png`). This is the real edge over a list app.
- **Honest, non-guilting chat tone when it works.** Tangent said it could not see any homework and did not invent any (`sim-sam-step1-first-screen.png`); "skip and plan it anyway" is visible and works in one tap; the essay question let Priya answer "Not started" with no judgment.
- **"Your data" page.** Plain words, "It's yours", Download, Clear, Delete all with a typed DELETE confirmation (`settings-data-390-light.png`); this is the trust story parents need once it is surfaced publicly.
- **Phone layout basics.** The 390px screens have no sideways scroll, a four-item tab bar, a big readable add box with mic, and a simple sign-in card with Google first (`signin-390-light.png`, `home-390-light.png`).
- **The "knows you" chips on Tangents and the correct handling of busy times** ("Your week" listing shifts correctly, Mon-Fri 3:30 practice held): this makes Tangent feel personal when shown honestly.
