# JUDGMENT-1: Consensus of the three-judge panel

Chair's merge of `judges/judge-design-1.md` (D), `judges/judge-student-1.md` (S) and `judges/judge-investor-1.md` (I). Nothing here is new evidence. Every citation comes from the judges' files.

Reading notes:
- Severity labels are the judges' own: fatal, significant (sig), minor. "mention" means the judge raised the problem inside a score justification or a "runners-up / not ranked" note but not in their top 15. "-" means not raised.
- An item is IN if at least 2 of 3 judges raise it (score-justification mentions count when they describe the same underlying problem), or if any one judge calls it fatal.
- Caveats the judges shared: the screenshots are of a lived-in test account (so "9 past due" and the pre-stored facts are partly test artifacts), most simulation steps were at 1440px, and the 390px first-use chat and plan flow was not directly observed.

## 1. Scores (1-10, copied from the judges)

| Area | D | S | I | Mean |
|---|---|---|---|---|
| First-use | 3 | 3 | 3 | 3.0 |
| Chat | 5 | 4 | 4 | 4.3 |
| Planning quality | 6 | 7 | 6 | 6.3 |
| Today (Home) | 5 | 4 | 4 | 4.3 |
| Calendar | 6 | 4 | 4 | 4.7 |
| Projects | 4 | 4 | 4 | 4.0 |
| Settings / You | 5 | 5 | 5 | 5.0 |
| Overall polish | 6 | 5 | 4 | 5.0 |
| Differentiation | 6 | 6 | 6 | 6.0 |
| Overall (verdict line) | not given | 4.5 | 4 | 4.3 (two judges) |

Mean of the nine area means: 4.8. The panel agrees on the shape: the planning engine and plan card are the strongest parts (6.3 and the "keep" list), and first-use (3.0) is the weakest. The shell around the engine is what loses points.

## 2. Consensus fix list

Ranked by impact on a first-time student, then lowest effort. Effort: S = hours, M = a focused half-day or more, L = multi-day. 23 items: 19 BUILD TONIGHT, 2 GATED, 2 LATER.

### C01. Stacked overlays block the first keystroke
- Tag: **BUILD TONIGHT**. Effort: M.
- Raised by: D fatal, S fatal, I fatal. Merged slugs: `stacked-overlays` (all three).
- Evidence: `sim-sam-step2-tour-over-chat.png`, `sim-jordan-step1-first-screen.png`, `sim-sam-step1-first-screen.png`, `home-390-light.png` (One question sheet over the input). Sam: "Three overlays appeared before any content ... the notification alert's Not now was unreachable"; Maya: "Two popups in a row and I haven't done anything yet". Every persona hit 2-3 overlays.
- Fix direction: queue overlays so at most one is ever shown, none over the add box, and none on the first screen. Defer the 12-step tour and the notification prompt until after the first confirmed plan. Make "Not now" always reachable (no scrim over it). Do not open the One question sheet on first load. This follows "ask only when the answer changes the plan" and "no new AI surfaces".

### C02. Plan claims it read Canvas and Gmail when neither is connected
- Tag: **BUILD TONIGHT**. Effort: S.
- Raised by: D sig, S fatal (trust), I sig. Merged slugs: `false-data-claim` (D), `false-canvas-gmail-claim` (S), `false-data-source-claim` (I).
- Evidence: `sim-sam-step4-after-essay.png` ("Based on what Tangent read in Canvas and Gmail" one screen after the chat said they are not connected); Priya's plan has the same line; Sam "a little creeped out".
- Fix direction: render a source line only for integrations that are actually connected; otherwise "Based on what you told me" (or "from your setup"). Test: with Canvas and Gmail disconnected, no plan or assumption text names them.

### C03. "Stop and plan" does not stop, it asks another question
- Tag: **BUILD TONIGHT**. Effort: M.
- Raised by: D sig, S sig, I sig. Merged slugs: `chat-ask-again-meter` (D, stop part), `stop-means-another-question` (S), `stop-does-not-plan` (I).
- Evidence: Maya step 9: "'Stop and plan' did not plan ... a second question"; Priya step 11; `sim-maya-step8-asks-when.png`. Breaks the guardrail that Stop never blocks.
- Fix direction: Stop and plan (and Skip) always go straight to a draft plan with stated defaults. Any extra question moves inside the plan as an optional "Refine". Test: after Stop, the next screen is a draft plan, never a question card.

### C04. Chat re-asks what the student already typed
- Tag: **BUILD TONIGHT**. Effort: M.
- Raised by: D sig, S sig, I sig. Merged slugs: `chat-ask-again-meter` (D, re-ask part), `stop-means-another-question` (S, pre-fill part), `asks-what-it-knows` (I).
- Evidence: `sim-maya-step8-asks-when.png` ("When is this?" with "If you skip: about 2 weeks" after she typed "Thu Dec 17"); Priya asked for a prompt after typing Jan 5; Maya step 8-9.
- Fix direction: parse dates, items and times from the sentence first, pre-fill them, and skip those questions. A default must never override a stated date. This is the "never ask what's known" guardrail and it contradicts the context-engine pitch live (I).

### C05. After Confirm, silence: plan page closes, Home shows nothing, counts disagree
- Tag: **BUILD TONIGHT**. Effort: M.
- Raised by: D fatal, S sig, I sig. Merged slugs: `post-confirm-silence` (D), `silent-confirm` (S), `confirm-feedback-mismatch` and `panel-closes-by-itself` (I).
- Evidence: Priya step 14: "I pressed Confirm and got silence"; Maya step 6 (page closed itself, reply box gone); Leo step 12 ("Added 6 steps" but one item listed, and no project appeared in the sidebar); `sim-jordan-step5-home-after-confirm.png`; Sam: no "saved, you're set" confirmation.
- Fix direction: after Confirm, show a persistent "Saved: N steps, first one is Wed 7:00 PM, View in Calendar". Do not auto-close the plan page or its reply box; give a link back to that chat. Reconcile the "Added N steps" count with what is listed, and check why Leo's confirm created no project (possible data bug; investigate before assuming copy only). Test: confirm a 6-step plan and see 6 steps in Calendar, a matching count, and a visible saved line.

### C06. No public privacy, terms or "for parents" page; sign-in has zero links
- Tag: **GATED**. Effort: M.
- Raised by: D sig, S fatal, I fatal. Merged slugs: `signin-trust-gap` (D), `no-parent-privacy-page` (S), `public-trust-layer-missing` (I).
- Evidence: Dana report: `/privacy`, `/terms`, `/pricing` "all returned HTTP 200 but ended on /signin"; "/signin contains zero `<a>` links"; Dana's verdict "Fails the 5-minute test"; heuristic F16; `signin-1440-light.png`, `signin-390-light.png`.
- Why GATED: the routes currently bounce signed-out visitors to sign-in, so making them reachable most likely means changing the route-protection or redirect allowlist, which is sign-in logic. I cannot confirm from the judges' files that a static page alone would do it, so per the rules this is GATED. The page content also states facts only Sid can confirm (what is stored, who sees it, AI training, deletion, who makes it, price).
- Plan for NEEDS-SID: draft the four plain-language answers (what is stored, who sees it, AI training if true, how to delete) as page copy, list the exact route-guard change needed, and add a sign-in footer with Privacy / Terms / Pricing / For parents links once the pages are reachable. If a developer can show the static pages need no auth-logic change, this item can move to BUILD TONIGHT.

### C07. Toast and draft-dock pill cover primary buttons
- Tag: **BUILD TONIGHT**. Effort: S.
- Raised by: D sig, S sig (inside `canvas-and-data-trust-gap`), I minor (inside `canvas-card-noise`). Merged slugs: `toast-covers-controls` (D) plus the toast mentions in S and I.
- Evidence: `sim-priya-step7-toast-covers-next.png`; Priya notes: toast "fully covers the modal's Next button ... intercepted pointer events 55 times"; Leo: the draft dock pill covers the Delete everything button.
- Fix direction: one reserved slot for fixed elements, below modals, never overlapping a primary action; auto-dismiss or collapse the notification prompt; hide the draft dock while a modal is open.

### C08. Tapping Done on an unstarted step gives false praise and a quiz
- Tag: **BUILD TONIGHT**. Effort: S.
- Raised by: D sig, S sig, I mention. Merged slugs: `fake-celebration-checkin` (D), `false-praise-on-done` (S), Sam's "All done for today" under `home-contradicts-state` (I).
- Evidence: `sim-sam-step6-after-done.png`: "Nice work today, Sam / All done for today" after an accidental Done, then a two-row quiz with two Skip buttons; Jordan: "I tapped Done and got a questionnaire".
- Fix direction: Done gives a quiet confirmation with Undo. Show "All done" only when nothing remains this week. Reduce the check-in to one row with a single Skip that never blocks.

### C09. Capture drops items, overrides typed days, and "Placing..." shows no progress
- Tag: **BUILD TONIGHT**. Effort: M. (Latency itself is C22.)
- Raised by: S sig, I sig. D did not list it. Merged slugs: `capture-drops-items` (S, I).
- Evidence: `sim-maya-step3-draft-plan.png` (one step for "AP Chem unit exam Friday, Precalc quiz Tuesday", "No day given" though days were typed); Sam captured 1 of 3 items; Maya steps 3-4.
- Fix direction: one draft item per thing typed, keep typed days, show "N things found" before Confirm, and show real progress text while placing. Test: the two-item Maya sentence yields two items with Friday and Tuesday preserved.

### C10. Today leads with guilt numbers and four empty rows (fails the 3-second scan)
- Tag: **BUILD TONIGHT**. Effort: S.
- Raised by: D sig, S sig, I sig. Merged slugs: `today-pileup-and-empty-rows` (D), `guilt-numbers-and-greeting` and the Home part of `empty-states-no-action` (S), `guilt-copy-first-screen` (I).
- Evidence: `home-390-light.png`, `home-1440-light.png`: "Still up, Sid? ... 9 past due", "A lot piled up", four "Nothing this morning / afternoon / evening / late tonight" rows, a duplicate setup strip. Maya: "read as guilt". Note (I): "9 past due" is partly a test-account artifact.
- Fix direction: lead with the single next action; collapse the empty day-parts into one calm line with one action ("Tell me what's due this week"); move past-due to a quiet collapsed "Catch up" row; use a time-neutral greeting; merge the duplicate setup strip.

### C11. Home hides the next step and contradicts Calendar
- Tag: **BUILD TONIGHT**. Effort: M.
- Raised by: D (inside `post-confirm-silence` and `today-pileup...`, sig), S sig, I sig. Merged slugs: `no-next-step-after-done` (S), `home-contradicts-state` (I), the collapsed "Coming up" parts of D's items, plus D, S and I score notes on panel vs grid disagreement (low confidence, heuristic run) and I's "two homes with different counts".
- Evidence: Leo: Home "Nothing planned today / Coming up 0" while `/calendar` lists 6 steps; heuristic F01 ("You're all caught up" beside an Undo for a new item); `sim-jordan-step5-home-after-confirm.png`; Jordan steps 7-8 stalled at "no second step".
- Fix direction: drive Home and Calendar from the same data; after Confirm, Done or Skip, show "Next: [step], [day time]" and keep this week's steps expanded under Coming up; never show "All caught up" while future steps exist. Test: a confirmed plan's first step appears on Home within one view.

### C12. Stale or contradictory text on the plan and status
- Tag: **BUILD TONIGHT**. Effort: S-M (M if the title lock needs work).
- Raised by: D sig, S sig, I sig (via `confirm-feedback-mismatch` and `assumptions-wall-and-template-leak`). Merged slugs: `stale-state-copy` (D), `stale-contradictory-text` (S).
- Evidence: Jordan step 4: "'Nothing is on your calendar until you confirm' (now false, directly above the status line)"; Leo: "No time given, so no set time" after setting 18:00, "Spread from today to today", a locked title, and a Wednesday date on a Sunday recurrence.
- Fix direction: derive the status block from state (draft, confirmed, edited); regenerate or hide assumption lines on any edit and on Confirm; make the title editable.

### C13. Plan page is a wall of "What I used / What I assumed", with leaked template text
- Tag: **BUILD TONIGHT**. Effort: S-M.
- Raised by: D sig, S sig, I sig. Merged slugs: `plan-wall-of-text` (D, S), `assumptions-wall-and-template-leak` (I).
- Evidence: `sim-maya-step10-real-plan.png` (a 1,900px page, ten assumption bullets, "Starting from the idea stage", "Standard milestones: idea, research, build, write-up, practice" on an exam-prep plan); Jordan: "feels like homework about homework".
- Fix direction: lead with steps and times; collapse the reasoning into one "Why this plan" disclosure showing at most 3 assumptions that change the plan; drop project-template lines for non-project tasks. Keep the per-step Why and "You'll have" lines (see Keep list).

### C14. Canvas promo card is noise on every Home view
- Tag: **BUILD TONIGHT**. Effort: S.
- Raised by: D sig, S minor, I minor. Merged slugs: `canvas-card-noise` (all three).
- Evidence: heuristic F14; `sim-maya-step11-confirmed.png`, `sim-sam-step6-after-done.png`, `sim-jordan-step5-home-after-confirm.png`; every persona called it noise ("A Canvas ad").
- Fix direction: a quiet one-line text row, not a bright CTA card; show only after the first confirmed plan; honour "Not now". Constraint: implement the dismissal with whatever storage already exists (browser or existing preference). If honouring it permanently would need a new database column, split that part into NEEDS-SID as GATED and build only the demotion tonight.

### C15. "How do I..." question gets an intake form instead of advice
- Tag: **BUILD TONIGHT**. Effort: M.
- Raised by: D mention (chat score), S mention (chat score), I mention (chat score). No judge listed it in their top 15; all three describe it.
- Evidence: D: "a 'How do I...' got an intake form"; S: "a prep question never got advice text"; I: "a 'How do I prepare' question never got advice text".
- Fix direction: in the existing chat, when the message is informational, answer it first (short advice), then offer "Want me to plan it?". No new AI surface.

### C16. Canvas and data flow says nothing about what is stored or how to disconnect
- Tag: **BUILD TONIGHT**. Effort: S (copy and one nav label).
- Raised by: S sig, I mention (Settings score). D did not raise it (D praises Your data). Merged slugs: `canvas-and-data-trust-gap` (S), the Settings justification in I.
- Evidence: `settings-schedule-390-light.png`; Priya steps 4-8; copy nudging "the more Tangent can see, the better it plans"; Canvas hidden under "Schedule".
- Fix direction: one line under every Connect ("what we store, how to disconnect"); label the section "Connections"; drop the "share more" pressure copy.

### C17. Empty Calendar gives no hint; mic floats over the grid; history icon unlabelled
- Tag: **BUILD TONIGHT**. Effort: S.
- Raised by: D minor, S minor-to-sig (inside `empty-states-no-action`). I did not raise it as an issue.
- Evidence: `calendar-390-light.png` (empty grid, floating mic over the grid corner, bare arrow icon beside the view tabs); heuristic F11 and F02.
- Fix direction: one empty-state line with a CTA, anchor the mic outside the grid, label the icon "Recent changes".

### C18. Projects page is sparse and stale (overdue Next step, competing pills, empty School page)
- Tag: **BUILD TONIGHT**. Effort: S.
- Raised by: D sig, S mention (Projects score), I mention (Projects score).
- Evidence: `projects-390-light.png`, `projects-1440-light.png`, `projects-school-390-light.png`; "Next: Define your Instagram nic... Sun, Nov 8" dated ten days ago; two competing pills (Tangents vs New project); the School project page is one sentence. Note: the stale date is partly a test-account artifact.
- Fix direction: flag overdue Next steps as overdue and show the full text; make Tangents a text link; give School and empty projects one clear next action; use the full-width card grid. (Leo's missing project is tracked in C05.)

### C19. "You, mapped" is off-system, clips on phone, and zero counts read as failures
- Tag: **BUILD TONIGHT**. Effort: M.
- Raised by: D sig, S minor, I minor. Merged slugs: `youmapped-off-system` (D), `you-map-clips-and-zeros` (S), `context-map-style-and-clip` (I).
- Evidence: `settings-context-390-light.png`, `settings-context-1440-dark.png`; "Classes & activities 2" clipped at the right edge; 8-10px labels; heuristic F13.
- Fix direction: compact header in the app's own surface style (one design system, no glow styling); larger labels; zero areas shown as "Not asked yet" in neutral text.

### C20. Wrong labels and categories (school work as Personal, Saturday game as Practice, Done circle on practice)
- Tag: **BUILD TONIGHT**. Effort: M. (If the fix needs a schema change for categories, move that part to NEEDS-SID.)
- Raised by: S mention (not ranked), I mention (runners-up). Not in either judge's top 15.
- Evidence: S: "mislabelled Saturday game as 'Practice' (Jordan step 8), a Done circle on practice rows, exam prep filed under 'Personal' (Maya)"; I: "school work filed as 'Personal' (Maya, Jordan's practice as a to-do)".
- Fix direction: classify exam prep and quizzes as school work; fixed commitments (practice, games, shifts) render as busy blocks without a Done circle.

### C21. The "follows up" half of the pitch was never seen working
- Tag: **LATER**. Effort: L.
- Raised by: I fatal (for the pitch). S mention in Differentiation ("follows up edge ... never shown working, no round 2, no daily bubble observed"). D did not raise it.
- Evidence: Jordan: "After Done, nothing new appeared, so round 2 never started and the end-of-round review was unreachable"; Maya: "no reminder or check-in time is stated"; the daily bubble needs a second day.
- Short spec:
  - What: a visible follow-up loop (Done or Skip, one-tap check-in, next step or round 2 adjusted from the answer, daily bubble on day 2).
  - Why: this is the retention half of capture, plan, done. Without it Tangent reads as a one-shot planner, and an investor cannot see the edge.
  - Smallest first slice: the "Next: ..." line after Done or Skip (already in C11 and C08), then a seeded two-day demo account where a check-in answer visibly changes the next step.
  - Measure with the pilot in section 4.

### C22. Capture-to-plan wait up to about 30 s
- Tag: **LATER**. Effort: L.
- Raised by: S sig (inside `capture-drops-items`), I (summary and riskiest assumption). D noted it only as a caveat ("Placing..." about 30 s in one run, about 6 s in another), not as an issue.
- Short spec:
  - What: cut placement latency and make it predictable.
  - Why: a 30 s silent wait right after typing is the worst moment to lose a first-time student.
  - Smallest first slice: instrument and log the time of each "Placing..." call, then split the work so the first draft step appears before the full plan. (Progress text is already in C09.)

### C23. Stale name pre-filled after a reset
- Tag: **GATED** (uncertain, touches reset and deletion of user data). Effort: S to investigate.
- Raised by: S mention ("a likely test artifact"), I mention (Leo setup: first-name field pre-filled with the previous persona).
- Evidence: Jordan's name seen in Sam's run (S); I: "first-name field pre-filled with the previous persona (Leo setup)".
- Plan for NEEDS-SID: first confirm whether this is only a test-account artifact (reused browser or account). If it is real, the fix is in the reset and delete behaviour, which is a deleting-user-data change. Do not build tonight.

## 3. Raised by only one judge and not fatal

Not consensus. Kept so nothing is lost.

- "Tangent knows enough: 25% / 33%" meter reads as grading (D, sig; part of `chat-ask-again-meter`). I used Priya's 33%/67% chips as a positive. Fix direction: "1 question left" or drop the percentage. Small copy change, a good candidate to ride with C03 and C04.
- Sign-in copy reads as surveillance ("listens", "built from what it already knows about you") and Google is the loudest control (D, sig; part of `signin-trust-gap`). Copy-only, buildable without touching sign-in logic, separate from the GATED pages in C06.
- Phone Settings sub-nav is a clipped scrolling tab strip and bottom content slides under the tab bar (D, minor; `mobile-settings-nav-clipped`; `settings-schedule-390-dark.png`).
- Plan shape is wrong for some goals: a 15-step round all at 7:00 PM titled "this week", a one-step round for a multi-part goal (I, sig; `plan-shape-wrong`). S noted "one-step rounds" in a score line only.
- "Goes to: Auto" jargon (S, heuristic F03; "not ranked").
- Tangents screen says "path" and "Tangent" for the same thing (S).
- Stored-fact wording sounds machine-made (I, heuristic F05; runners-up).
- Leo found no edge over Notion for a power user (I, in the report summary).
- Calendar 7-day panel vs grid disagreement (D, S, I all note it at low confidence; folded into C11 rather than listed alone).

## 4. Riskiest assumption and cheapest test

**Riskiest assumption.** That a student's first typed sentence, plus stored context, becomes a correct and trusted plan quickly enough that the student confirms it, returns the next day, and keeps answering follow-ups. Three links in that chain are unproven in the simulations: capture still drops items or re-asks known facts and can take 30 s (C04, C09, C22), the Confirm moment gives no visible payoff (C05), and the follow-up loop was not seen working in any run (C21). A fourth link sits outside the product: a parent can read nothing public before deciding (C06).

**Cheapest test.** A 10-student, 3-day concierge pilot on the live app. Each student types their real week once on day 1 and confirms; a human operator manually triggers the day-2 and day-3 check-ins and round 2. Measure three numbers only: percent who confirm a plan in the first session without help, percent who open the app unprompted on day 2, and percent who answer a check-in. If fewer than half confirm in session one, the intake flow (C01 to C05, C09) is the problem. If confirmation is high but day-2 return is low, the follow-up is not yet a retention engine (C21). Add a one-line parent-consent step in the same pilot to learn whether the gatekeeper blocks it (C06), and run it only after C01, C02 and C05 are fixed so the result measures the engine, not the shell.

## 5. Keep, don't break

Merged from all three judges' "already good" lists.

- **The plan card pattern** (all three): per-step "Why" and "You'll have", "What I used about you", Brief and month preview, the line "Nothing is on your calendar until you confirm", Confirm / Edit / Discard, and "Added N steps" with Undo. This is the product's identity (`sim-jordan-step3-plan.png`, `sim-sam-step4-after-essay.png`, `sim-maya-step10-real-plan.png`). Collapse the reasoning in C13 but do not remove it.
- **Constraint-respecting scheduling** (S, I): Maya's debate Tue 3:30-5 and 11 pm cutoff, Jordan's 7 PM after practice, Priya's Wed 4-9 PM shifts and Jan 5 deadline.
- **Question card with visible Skip and Stop and plan** (all three): non-modal, chip answers, a stated default ("If you skip: about 2 weeks"), "skip and plan it anyway" inline link that worked for Jordan, and gentle "Not started" chips for Priya (`sim-maya-step8-asks-when.png`). Fix the content and the Stop behaviour (C03, C04), keep the structure.
- **Honest, non-guilting chat tone when it works** (S): Tangent said it could not see homework and did not invent any.
- **Settings trust surfaces** (all three): "What Tangent knows" with per-fact Forget and Edit, plain-language "Your data", Download my data, Clear this browser, and the type-DELETE confirmation (`settings-data-390-light.png`). Settings rows with title, one plain line and a right-aligned control.
- **Coherent, restrained design system** (D, S): one purple, consistent radii, soft shadows, no emoji icons, readable type scale, dark mode that holds contrast, 390px layouts with no sideways scroll, a four-item tab bar, a big add box with mic (`home-390-dark.png`, `calendar-1440-light.png`, `settings-1440-light.png`).
- **Calendar layout** (D): clean 3-day mobile grid, strong today marker, tidy chips, and the desktop "Ask about your week" rail with suggested-question pills.
- **Sign-in tagline and feature list** (I, S): "Say it, it's saved", "It asks before it guesses", Google first. Reword only the surveillance-sounding lines (section 3).
- **Tangents "From what Tangent knows about you" chips** and correct handling of busy times (I, S): the context engine is readable at a glance.

## 6. Guardrails applied to every fix above

- Build only what serves capture, plan, done. No item adds a feature outside that loop; C21 is a retention slice of the same loop.
- Ask until enough, never what is known, always stoppable: C03 and C04 restore this, and C08 keeps Skip non-blocking.
- No new top-level AI surfaces: C15 answers inside the existing chat. C01 removes first-load overlays rather than adding any.
- Today scannable in 3 seconds: C10 and C11 are written to that test.
- One design system, no Liquid Glass: C19 pulls the map back into the app's own style, and C14 and C07 use quiet, existing components.
