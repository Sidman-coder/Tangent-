# Heuristic evaluation report — tangent-localhost (round 2)

> Nielsen heuristic evaluation with synthetic severity raters — **user-simulation · heuristic-test**.
> **Site:** http://localhost:3000 · **Date:** 2026-11-18 · **Mode:** site · **Scope:** 7 of the app's screens, all at 1440x900 in the dark theme, page cap of 8 not hit. Left out: /settings/account (it shows the test account's email), the other Settings pages (security, schedule, notifications, AI activity), project detail, School detail, task and plan screens, dialogs (setup, first-run tour, delete confirmations), chat and plan-draft states (the AI API had no credit tonight), and the phone layout.
> **Pages inspected:** 7 — Sign-in (/signin, signed out), Home (/), Calendar (/calendar, Agenda), Projects (/projects), Tangents (/tangents), What Tangent knows (/settings/context), Your data (/settings/data)
> **Raters:** tangent-localhost-power · tangent-localhost-average · tangent-localhost-low-literacy
> **Round 2:** same 7 screens as the round-1 run (`2026-11-18-heuristic-tangent-localhost-site.md`), after the overnight fixes. Screenshots: `docs/overnight/screens/after/heur-*.png`.

**Business:** Tangent is a phone-first planner for high school students (also usable on desktop): the student says or types a task, Tangent asks only the few questions that change the plan, drafts it, and puts it on the calendar only after the student confirms. A failed conversion is a student who gets a plan they do not trust or cannot find after confirming, or a parent who cannot judge safety.

## Coverage

| Heuristic | Status |
|---|---|
| 1. Visibility of system status | 1 finding — feedback speed and animation not observable from snapshots |
| 2. Match between system and the real world | 1 finding |
| 3. User control and freedom | Clean — swept S1-S7; Cancel, Skip and Undo flows live in dialogs and chats that were not captured, so absence there is not judged |
| 4. Consistency and standards | 3 findings |
| 5. Error prevention | 1 finding — confirmation dialogs were not captured, confidence Medium |
| 6. Recognition rather than recall | 2 findings |
| 7. Flexibility and efficiency of use | Clean — swept S1-S7; keyboard shortcuts cannot be judged from snapshots |
| 8. Aesthetic and minimalist design | 2 findings |
| 9. Help users recognize, diagnose, and recover from errors | Not observable — no error state captured in any of the 7 screens |
| 10. Help and documentation | 1 finding — help page quality not judgeable because no help pages are in scope |

## Findings by priority

| # | Description | Heuristic | Business | Usability | Priority | Convergence | Reason | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| F01 | Calendar's 'next 7 days' count contradicts the agenda list | Visibility of system status | 3 | 2.7 | 8.0 | 2/3 | Contradictory counts undermine trust in a confirmed plan; average: "The panel says 6 things are due this week but the agenda shows one, so I stop trusting that my confirmed plan is on the calendar." | Make the 'Your next 7 days' count come from the same items the agenda lists, or list the counted items beneath it. |
| F11 | No help, privacy or parent information reachable from sign-in or Settings | Help and documentation | 3 | 1.7 | 5.0 | 1/3 | A parent who cannot judge safety before signup blocks conversion; low-literacy: "I find no privacy, safety or help page to read, so I would likely say no." | Add a visible footer on the sign-in page linking to privacy and safety information for parents, and add a Help entry to the Settings navigation. |
| F08 | Calendar agenda truncates the only text that distinguishes each task | Recognition rather than recall | 2 | 1.7 | 3.3 | 2/3 | Students who cannot recognise confirmed tasks cannot find their plan; average: "Three Sundays with the same cut-off title means I can't tell what's actually planned." | Let agenda task titles wrap to two lines, or show a short title with the full text on expand. |
| F05 | Removal actions use Forget, Clear, Delete and Remove inconsistently | Consistency and standards | 2 | 1.7 | 3.3 | 1/3 | Unclear data-removal controls weaken a parent's ability to judge safety; low-literacy: "I cannot tell which one is mild and which one wipes my child's account." | Use 'Delete' for server-side removal and 'Clear' for device-only removal, applied the same way on both screens. |
| F06 | Destructive data buttons sit next to harmless ones, no visible confirmation | Error prevention | 2 | 1.7 | 3.3 | 1/3 | An accidental delete loses a student's plans and trust; low-literacy: "...would make me afraid to press anything in Settings." | Gate 'Delete data', 'Delete account' and 'Forget everything' behind a confirmation dialog that names what will be lost and has a Cancel button. |
| F07 | Core capture controls are icon-only, so their names are not visible | Recognition rather than recall | 2 | 1.7 | 3.3 | 1/3 | Capture is the first step of the core loop; low-literacy: "I am unsure what a bare microphone, arrow or X icon commits me to." | Add a visible text label or tooltip to the Home mic, send and dismiss icons. |
| F02 | 'Tangents' label is jargon and sits under Projects heading | Match between system and the real world | 2 | 1.3 | 2.7 | 1/3 | Students who cannot tell where a long goal belongs may fail to find it; low-literacy: "I do not know what 'Tangents' means and it sits under Projects." | Rename the 'Tangents' link to a plain label such as 'Long-term goals' and move it out of the sidebar's 'Projects' group. |
| F09 | What Tangent knows: decorative map repeats the same counts three times | Aesthetic and minimalist design | 2 | 1.3 | 2.7 | 0/3 | This is the main place a parent or student can check what Tangent stores; no persona reason recorded. | Shrink the map and remove the duplicate 'Facts per area' list so the fact sections start in the first viewport. |
| F03 | Home and Calendar use different category filter names | Consistency and standards | 2 | 1.0 | 2.0 | 0/3 | Mismatched categories make a confirmed task harder to find; no persona reason recorded. | Use one name and one control type for the category filter on both screens. |
| F10 | Home states 'Nothing planned today' twice in a row | Aesthetic and minimalist design | 1 | 1.3 | 1.3 | 1/3 | Minor redundancy; average: "...this makes Home look empty and cluttered, so I can't tell at a glance whether my plan landed." | Drop 'Nothing planned today' from the header subtitle and keep the single status line with the next item. |
| F04 | Completing a task is labelled differently on Home and Calendar | Consistency and standards | 1 | 1.0 | 1.0 | 0/3 | Wording drift on a small control; no persona reason recorded. | Give the task-completion button one accessible name pattern on Home and Calendar. |

## Finding detail

### F01 — Calendar's 'next 7 days' count contradicts the agenda list · Priority 8.0

- **Heuristic:** Visibility of system status
- **Screen(s):** Calendar, Home
- **Evidence:**
  > "6 things to do in the next 7 days, 6 at a set time or date." — Calendar
  > "list: listitem: Nothing scheduled." — Calendar
  > "Nothing planned today. Next is Sun, Nov 22 · 6:00 PM." — Home
- **Description:** The side panel says 6 things are due in the next 7 days. The agenda shows only one item (Sun Nov 22) in that window, and Home says 'Nothing planned today. Next is Sun, Nov 22'. The student cannot tell what the status summary is counting.
- **Business impact:** 3 — Contradictory counts undermine trust in a confirmed plan, the stated route to a student who stops using the app.
- **Ratings:** power 3 — "I check the 7-day count daily to trust my plan; a count of 6 against one visible item makes me doubt the Canvas feed reconciles." · average 3 — "The panel says 6 things are due this week but the agenda shows one, so I stop trusting that my confirmed plan is on the calendar." · low-literacy 2 — "A count that says 6 while the list shows one would confuse me, but I would not be relying on it to decide anything about my child's safety."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — the count may include items not shown in this agenda.
- **Suggested fix:** Make the 'Your next 7 days' count come from the same items the agenda lists, or list the counted items beneath it.

### F11 — No help, privacy or parent information reachable from sign-in or Settings · Priority 5.0

- **Heuristic:** Help and documentation
- **Screen(s):** Sign-in, What Tangent knows
- **Evidence:**
  > "tablist "Sign in or create an account": tab "Sign in" [selected]; tab "Create account"" — Sign-in
  > "paragraph: Use your school or personal account. New here? Creating an account takes about a minute." — Sign-in
  > "navigation "Settings sections": link "What Tangent knows" ... link "Your data"" — What Tangent knows
- **Description:** The signed-out page offers no link to privacy, safety, terms or a help page. The Settings navigation has no Help entry. A parent deciding whether to allow the app has nothing to read, and the student has no help route.
- **Business impact:** 3 — A parent who cannot judge safety before signup blocks conversion.
- **Ratings:** power 1 — "I never look for help or parent info." · average 1 — "More of a parent's concern." · low-literacy 3 — "As the parent deciding whether my ninth-grader may use this, I find no privacy, safety or help page to read, so I would likely say no."
- **Divergence:** The low-literacy parent rates 3 while power and average rate 1 (spread of 2). This hurts the parent who decides whether the student may sign up, not the students who would use the app.
- **Confidence:** Medium — footer or legal links outside the captured main region may exist.
- **Suggested fix:** Add a visible footer on the sign-in page linking to privacy and safety information for parents, and add a Help entry to the Settings navigation.

### F08 — Calendar agenda truncates the only text that distinguishes each task · Priority 3.3

- **Heuristic:** Recognition rather than recall
- **Screen(s):** Calendar
- **Evidence:**
  > "button "Keeping a weekly Sunday video upload going without my chem and algebra grades slipping"" — Calendar
  > "button "29 Sunday November"" — Calendar
- **Description:** The agenda shows the same long task title on three Sundays, and the screenshot cuts it off at 'algebra gr...'. The row shows nothing but the 6:00 PM time to tell the entries apart.
- **Business impact:** 2 — If students cannot recognise their confirmed tasks on the calendar, they cannot find the plan they confirmed.
- **Ratings:** power 2 — "In my weekly planning pass I need to tell tasks apart at a glance." · average 2 — "Three Sundays with the same cut-off title means I can't tell what's actually planned." · low-literacy 1 — "A cut-off task title is a detail I would not notice on one visit."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — the long title may be an artefact of test data.
- **Suggested fix:** Let agenda task titles wrap to two lines, or show a short title with the full text on expand.

### F05 — Removal actions use Forget, Clear, Delete and Remove inconsistently · Priority 3.3

- **Heuristic:** Consistency and standards
- **Screen(s):** What Tangent knows, Your data
- **Evidence:**
  > "Clears every fact here. Your tasks, projects and chats stay." — What Tangent knows
  > "button "Forget everything"" — What Tangent knows
  > "Forgets saved chat ids, cached titles and nudges on this device. Nothing in your account changes." — Your data
  > "button "Delete data"" — Your data
- **Description:** Settings uses four different verbs for removing data. 'Forget everything' (S6) clears facts; 'Clear' (S7) wipes browser-side data; 'Delete data' and 'Delete account' (S7) remove server data. A parent or student cannot easily tell which is the reversible or less severe one.
- **Business impact:** 2 — Unclear data-removal controls weaken a parent's ability to judge safety.
- **Ratings:** power 1 (no reason recorded) · average 1 (no reason recorded) · low-literacy 3 — "Forget, Clear, Delete and Remove all sound alike to me, and I cannot tell which one is mild and which one wipes my child's account."
- **Divergence:** The low-literacy parent rates 3 while power and average rate 1 (spread of 2). The wording confusion hurts the parent judging the safety of the data controls, not the students.
- **Confidence:** High
- **Suggested fix:** Use 'Delete' for server-side removal and 'Clear' for device-only removal, applied the same way on both screens.

### F06 — Destructive data buttons sit next to harmless ones, with no visible confirmation · Priority 3.3

- **Heuristic:** Error prevention
- **Screen(s):** Your data, What Tangent knows
- **Evidence:**
  > "Removes all of the above and your sign-in. You'll be signed out for good." — Your data
  > "button "Delete account"" — Your data
  > "button "Forget everything"" — What Tangent knows
- **Description:** 'Delete data' and 'Delete account' are plain buttons in the same list as 'Download' and 'Clear'. The text states the consequence but mentions no confirmation step and no undo. 'Forget everything' on S6 has the same pattern.
- **Business impact:** 2 — An accidental delete loses a student's plans and trust.
- **Ratings:** power 1 (no reason recorded) · average 1 (no reason recorded) · low-literacy 3 — "Delete buttons sitting next to Download with no sign of a confirmation or undo would make me afraid to press anything in Settings."
- **Divergence:** The low-literacy parent rates 3 while power and average rate 1 (spread of 2). The missing visible safeguard hurts the cautious parent, who cannot see that a confirmation exists.
- **Confidence:** Medium — confirmation dialogs after the click were not captured; they may exist.
- **Suggested fix:** Gate 'Delete data', 'Delete account' and 'Forget everything' behind a confirmation dialog that names what will be lost and has a Cancel button.

### F07 — Core capture controls are icon-only, so their names are not visible · Priority 3.3

- **Heuristic:** Recognition rather than recall
- **Screen(s):** Home, Calendar
- **Evidence:**
  > "button "Say it"" — Home
  > "button "Hide until tomorrow"" — Home
  > "button "Add" [disabled]" — Home
  > "button "Ask" [disabled]" — Calendar
- **Description:** In the Home screenshot the mic ('Say it'), the send arrow ('Add') and the dismiss X ('Hide until tomorrow') are bare icons with no visible text. The Calendar 'Ask' button is a bare arrow.
- **Business impact:** 2 — Capture is the first step of the core loop.
- **Ratings:** power 1 — "I recognize the mic and send icons instantly; only the hide X is slightly unclear." · average 2 — "I'd have to guess what the X does, which is a small slowdown." · low-literacy 2 — "I am unsure what a bare microphone, arrow or X icon commits me to, especially 'Hide until tomorrow'."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — tooltips on hover were not captured.
- **Suggested fix:** Add a visible text label or tooltip to the Home mic, send and dismiss icons.

### F02 — 'Tangents' label is jargon and sits under the Projects heading · Priority 2.7

- **Heuristic:** Match between system and the real world
- **Screen(s):** Tangents, Projects, Home
- **Evidence:**
  > "Where you want to be in a year or more. Tangent maps the moves from what you already do." — Tangents
  > "region "Projects": heading "Projects" [level=2]; link "Tangents" (/tangents)" — Home
  > "link "Tangents" (/tangents)" — Projects
- **Description:** 'Tangents' is the app's own word for year-plus goals, but the sidebar files it under the 'Projects' heading and Projects also links to it. Two overlapping concepts with no plain-language cue.
- **Business impact:** 2 — Students who cannot tell where a long goal belongs may fail to find it after confirming.
- **Ratings:** power 1 (no reason recorded) · average 1 (no reason recorded) · low-literacy 2 — "I do not know what 'Tangents' means and it sits under Projects, so I cannot tell what I would be pressing."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — the business summary describes Tangents as chats while S5 describes them as long-term paths.
- **Suggested fix:** Rename the 'Tangents' link to a plain label such as 'Long-term goals' and move it out of the sidebar's 'Projects' group.

### F09 — What Tangent knows: large decorative map repeats the same counts three times · Priority 2.7

- **Heuristic:** Aesthetic and minimalist design
- **Screen(s):** What Tangent knows
- **Evidence:**
  > "button "Goals, 3 facts": Goals 3" — What Tangent knows
  > "list "Facts per area": button "Goals 3"" — What Tangent knows
  > "region "Goals": heading "Goals" [level=3]; text: 3" — What Tangent knows
- **Description:** The orbit map fills the first viewport, with the fact list pushed below the fold. Area names and counts appear three times: map nodes, 'Facts per area' list, section headers. Tiny map labels are hard to read.
- **Business impact:** 2 — This is the main place a parent or student can check what Tangent stores.
- **Ratings:** power 1 (no reason recorded) · average 1 (no reason recorded) · low-literacy 2 (no reason recorded)
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — snapshot truncated, below-the-fold not reviewed.
- **Suggested fix:** Shrink the map and remove the duplicate 'Facts per area' list so the fact sections start in the first viewport.

### F03 — Home and Calendar use different category filter names · Priority 2.0

- **Heuristic:** Consistency and standards
- **Screen(s):** Home, Calendar
- **Evidence:**
  > "tablist "Show": tab "All" [selected]; tab "School"; tab "Projects"; tab "Personal"" — Home
  > "group "Show": button "All" [pressed]; button "School"; button "Projects"; button "Short-term"" — Calendar
- **Description:** Home filters by 'All / School / Projects / Personal'. Calendar filters the same items by 'All / School / Projects / Short-term'. The fourth category is named differently and the controls use different roles (tabs vs toggle buttons).
- **Business impact:** 2 — Mismatched categories make a confirmed task harder to find.
- **Ratings:** power 1 (no reason recorded) · average 1 (no reason recorded) · low-literacy 1 (no reason recorded)
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Use one name and one control type for the category filter on both screens.

### F10 — Home states 'Nothing planned today' twice in a row · Priority 1.3

- **Heuristic:** Aesthetic and minimalist design
- **Screen(s):** Home
- **Evidence:**
  > "paragraph: Wednesday, November 18Nothing planned today" — Home
  > "status: Nothing planned today. Next is Sun, Nov 22 · 6:00 PM." — Home
- **Description:** The header subtitle and the status line below the filter tabs both say there is nothing planned today.
- **Business impact:** 1 — Minor redundancy.
- **Ratings:** power 1 (no reason recorded) · average 2 — "On my phone this makes Home look empty and cluttered, so I can't tell at a glance whether my plan landed." · low-literacy 1 (no reason recorded)
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Drop 'Nothing planned today' from the header subtitle and keep the single status line with the next item.

### F04 — Completing a task is labelled differently on Home and Calendar · Priority 1.0

- **Heuristic:** Consistency and standards
- **Screen(s):** Home, Calendar
- **Evidence:**
  > "button "Done: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping"" — Home
  > "button "Mark Keeping a weekly Sunday video upload going without my chem and algebra grades slipping done"" — Calendar
- **Description:** The completion control is named 'Done: <task>' on Home and 'Mark <task> done' on Calendar.
- **Business impact:** 1 — Wording drift on a small control.
- **Ratings:** power 1 (no reason recorded) · average 1 (no reason recorded) · low-literacy 1 (no reason recorded)
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Give the task-completion button one accessible name pattern on Home and Calendar.

## Fix this first

**F01 — Calendar's 'next 7 days' count contradicts the agenda list (Priority 8.0).** Make the 'Your next 7 days' count come from the same items the agenda lists, or list the counted items beneath it. It rescues the power user and the average student, both rated 3, who stop trusting that a confirmed plan is on the calendar; the low-literacy parent rated it 2.

## Method note

One expert agent evaluated the product under forced enumeration of the ten heuristics, and three synthetic personas (power user, average user, low-literacy parent) rated usability impact independently. Rater coverage was 3/3, so convergence is shown as N/3. Priority = business impact × average usability impact, computed from the unrounded mean and rounded once; the usability column is shown to one decimal. Findings are a lower bound (single-evaluator ceiling, per Nielsen & Molich 1990).

This is round 2: the same 7 screens as the round-1 run earlier the same night, after the overnight fixes. Scope was limited to those 7 screens at 1440x900 in the dark theme; error probing did not run (site mode). The pages and states left out are listed in the Scope line above, which is why Heuristic 9 is Not observable and why Heuristics 3 and 7 are Clean only for what was captured. Some evidence quotes for Home, Calendar, What Tangent knows and Your data come from a flattened one-line form of the trimmed snapshot, so punctuation differs slightly from the raw snapshot. The What Tangent knows snapshot was truncated at 9,000 characters. The test account is lived-in but has few tasks, so list-heavy states were not seen.

References: Nielsen & Molich (1990), Proc. ACM CHI'90; Nielsen (1994), Proc. ACM CHI'94; Nielsen & Mack (1994), Usability Inspection Methods, Wiley; nngroup.com — "How to Conduct a Heuristic Evaluation" and "Severity Ratings for Usability Problems".
