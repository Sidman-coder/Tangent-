# Heuristic evaluation report — tangent-localhost (round 3)

Run: overnight 2 Phase 8 (round 3), Playwright, production build on push-v1.

> Nielsen heuristic evaluation with synthetic severity raters — **user-simulation · heuristic-test**.
> **Site:** http://localhost:3000 · **Date:** 2026-11-22 · **Mode:** site · **Scope:** 7 screens evaluated against an 8-page cap (cap not hit). **Not evaluated:** /settings/account (shows the [test account]'s email; deliberately excluded), the other Settings pages (security, schedule, notifications, AI activity, help and privacy), /privacy, /terms, /parents, project detail, task and plan screens, dialogs (setup, first-run tour, delete/discard confirmations), chat and plan-draft states, the Notifications panel, phone layout, light theme. Error probing was not run (site mode). Viewport 1440x900, dark colour scheme (same as round 2), driven by Playwright MCP. Home and What Tangent knows snapshots were truncated at the 15,000-character cap, so their tails were judged from screenshots only.
> **Pages inspected:** 7 — S1 Sign in (signed out, captured in a separate isolated browser context) · S2 Home · S3 Calendar (Agenda view) · S4 Projects · S5 Tangents · S6 What Tangent knows (Settings) · S7 Your data (Settings)
> **Raters:** tangent-localhost-power · tangent-localhost-average · tangent-localhost-low-literacy
> **Round 3:** same 7 screens, viewport and theme as round 2 (`2026-11-18-heuristic-tangent-localhost-site-round2.md`) and round 1 (`2026-11-18-heuristic-tangent-localhost-site.md`). Personas and business summary reused. Screenshots: `docs/overnight2/screens/heuristic3/heur-*.png`.

**Business:** Tangent is a phone-first planner (also usable on desktop) for high school students aged 13-18. Students capture anything they need to do, answer only the questions that change the plan (each with Skip and Stop), and confirm a dated plan onto the calendar (Confirm / Edit / Discard, with Undo). Parents decide whether to allow it. A failed conversion is a plan the student does not trust or cannot find after confirming, or a parent who cannot judge safety.

## Coverage

| Heuristic | Status |
|---|---|
| 1. Visibility of system status | 3 findings |
| 2. Match between system and the real world | 3 findings |
| 3. User control and freedom | 1 finding |
| 4. Consistency and standards | 3 findings |
| 5. Error prevention | 1 finding |
| 6. Recognition rather than recall | 1 finding |
| 7. Flexibility and efficiency of use | 1 finding |
| 8. Aesthetic and minimalist design | 3 findings |
| 9. Help users recognize, diagnose, and recover from errors | Not observable — no error state was captured on S1-S7. The 'alert' regions are empty, and the Projects text 'Nothing due right now' is an empty state, not an error. No error messages could be judged. |
| 10. Help and documentation | 1 finding — the help content itself (/settings/privacy, /parents) was outside the captured scope, so only where help sits could be judged, not its quality. |

## Findings by priority

| # | Description | Heuristic | Business | Usability | Priority | Convergence | Reason | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| F07 | Draft plan bar's only dismiss control discards the draft | User control and freedom | 2 | 2.3 | 4.7 | 3/3 | Losing a draft by accident breaks plan → confirm, and no Undo is visible. Low-literacy: "delete my child's plan by mistake, with nothing telling me what I just did." | Add a non-destructive 'Hide' control to the Draft plan bar and swap the 'X' glyph on the discard action for a labelled 'Discard'. |
| F01 | Home header 'next' skips earlier open items today | Visibility of system status | 2 | 2.0 | 4.0 | 2/3 | A wrong 'next' breaks the 3-second scan and erodes trust in the plan. Average: "that header line is the only thing I read." | Make the header's 'next' show the earliest open item still ahead today, or label it 'next fixed-time item' if it only counts fixed times. |
| F05 | Capture destination shown only as 'Goes to: Auto' | Match between system and the real world | 2 | 2.0 | 4.0 | 1/3 | Capture is step one, and an unknown destination leads to a plan the student "cannot find". Average: would "have to go looking for it afterward." | Replace 'Auto' on the destination button with a plain-language hint such as 'Tangent picks: Today or a project'. |
| F14 | Floating Draft plan bar covers Home's question actions | Aesthetic and minimalist design | 2 | 2.0 | 4.0 | 0/3 | A hidden 'Answer' blocks the clarifying-questions step and lowers plan quality. Average: "I'd just skip the questions, and my plans would be a bit less realistic." | Reserve bottom padding for the Draft plan bar so it never overlaps page content such as the 'From Tangent' actions. |
| F12 | Calendar agenda rows drop the project name shown on Home | Recognition rather than recall | 2 | 1.7 | 3.3 | 2/3 | Unlabelled steps on the calendar feed the "plan they cannot find" failure. Average: unsure "which one belongs to my plan." | Show the project name under each Calendar agenda row, matching the Home 'Coming up' rows. |
| F11 | Fact 'Forget' and data delete show no undo or recovery note | Error prevention | 2 | 1.7 | 3.3 | 1/3 | Accidental data loss hurts trust, and parents need clear recovery terms. Low-literacy: "I'd be scared to press anything." | Add 'You can undo this' or 'This can't be undone' text beside each 'Forget' and 'Delete data' control. |
| F04 | 'Tangents' label conflicts with page content and placement | Match between system and the real world | 2 | 1.3 | 2.7 | 1/3 | An unclear main area gets skipped, which cuts retention around long goals. Low-literacy: "can't tell what my child would be putting in there." | Rename the 'Tangents' nav item to the plain word the page already uses (for example 'Paths') and move it out of the Projects group. |
| F15 | Decorative knowledge map pushes the actual facts below the fold | Aesthetic and minimalist design | 2 | 1.3 | 2.7 | 1/3 | Parents judging safety must get past a decorative visual to reach the facts. Low-literacy: "might not realize the actual list of facts is further down." | Shrink the 'You, mapped' graph to a compact header and show the Goals/Classes fact lists in the first viewport. |
| F02 | Done toggles announce the opposite of their visible state | Visibility of system status | 2 | 1.0 | 2.0 | 0/3 | A contradictory completion status undermines 'done' for students who rely on assistive output. All raters go by the visible tick. | Give each toggle a stable name such as 'Mark done: <task>' and let the pressed state alone convey completion. |
| F06 | Data settings use developer terms like 'chat ids' | Match between system and the real world | 1 | 1.7 | 1.7 | 1/3 | Slightly weakens a parent's understanding of data handling. Low-literacy: "'chat ids' and 'cached titles' mean nothing to me, so I can't judge it." | Rewrite the 'Clear this browser' description in plain words, for example 'Forgets which chats and reminders this device remembers'. |
| F13 | Long task lists offer filters but no search | Flexibility and efficiency of use | 1 | 1.7 | 1.7 | 1/3 | Slows heavy users who need a specific task. Power: "friction I'd hit every week" across 35 items. | Add a task search field above the Calendar agenda and Home 'Coming up' list. |
| F17 | Help reachable only via Settings 'Help and privacy' | Help and documentation | 1 | 1.3 | 1.3 | 0/3 | May add support contacts but does not block the loop. Low-literacy: wants help "nearby when I see words I don't know." | Add a 'Help' link to the main sidebar footer next to Settings. |
| F03 | Section counts ignore completed rows shown inside them | Visibility of system status | 1 | 1.0 | 1.0 | 0/3 | Minor count confusion on Home. Low-literacy: "might wonder briefly why it says 2 items when I see five." | Change the Morning/Evening count label to '2 left' so it states that it counts open items only. |
| F08 | Home and Calendar filters use different control types | Consistency and standards | 1 | 1.0 | 1.0 | 0/3 | Small learnability cost across two views. Average: "they both do the same thing." | Use the same 'Show' filter component, with the same role and visual style, on Home and Calendar. |
| F09 | School and Work treated as projects in some places, not others | Consistency and standards | 1 | 1.0 | 1.0 | 0/3 | Confuses the categories without blocking the loop. Power: "untidy, but... doesn't cost me any taps." | Show School and Work the same way in the sidebar, Projects page and knowledge map, using one status wording. |
| F10 | Logo 'home' and Home nav item point to different URLs | Consistency and standards | 1 | 1.0 | 1.0 | 0/3 | Navigation ambiguity with little business effect. All raters navigate via the Home item. | Point the logo link at / and rename its accessible name to 'Tangent, go to Home'. |
| F16 | Sidebar repeats Projects and Tangents entry points | Aesthetic and minimalist design | 1 | 1.0 | 1.0 | 0/3 | Navigation clutter only. Average: "any of them gets me where I'm going." | Remove the 'All projects' sidebar link and the duplicate 'Tangents' link on the Projects page header. |

## Finding detail

### F07 — Draft plan bar's only dismiss control discards the draft · Priority 4.7

- **Heuristic:** User control and freedom (secondary: Error prevention)
- **Screen(s):** S3 Calendar (Agenda), S4 Projects, S5 Tangents, S7 Your data
- **Evidence:**
  - > "button "Discard draft ED II Supplemental Essay Draft"" — S3 Calendar (Agenda)
  - > "button "Draft plan · ED II Supplemental Essay Draft · 5 steps"" — S4 Projects
  - > "button "Discard draft ED II Supplemental Essay Draft"" — S7 Your data
  - Screenshot observation (heur-tangents.png): the bottom-right pill 'Draft plan · ED II Supplemental Essay Dra... 5 steps' ends in a plain 'X' icon, the usual close glyph — S5 Tangents
- **Business impact:** 2 — Losing a draft by accident breaks the plan → confirm step for that goal. The summary mentions Undo, but none is visible here.
- **Ratings:** power 2 — "That pill follows me onto every screen I use dozens of times a week, and the only way to get rid of it is to delete a plan I haven't confirmed yet, so I'm stuck with it covering things." · average 2 — "I'd tap that X just to get the bar out of the way and lose my unconfirmed essay plan, then have to undo it or make the plan again." · low-literacy 3 — "I'd press the X to get that bar out of my way and delete my child's plan by mistake, with nothing telling me what I just did or whether I could get it back."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — whether discard asks for confirmation or offers Undo after the click was not captured.
- **Suggested fix:** Add a non-destructive 'Hide' control to the Draft plan bar and swap the 'X' glyph on the discard action for a labelled 'Discard'.

### F01 — Home header 'next' skips earlier open items today · Priority 4.0

- **Heuristic:** Visibility of system status
- **Screen(s):** S2 Home
- **Evidence:**
  - > "3 left today · next: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping at 6:00 PM" — S2 Home
  - > "separator "Now, 6:35 AM"" — S2 Home
  - > "button "Done: Get ready"" — S2 Home
  - > "generic: 10:30 AM" — S2 Home
- **Business impact:** 2 — Today must be scannable in 3 seconds. A wrong 'next' erodes trust in the plan, which the summary names as the cause of a failed conversion.
- **Ratings:** power 2 — "I check that status line between every class, and if it tells me my next thing is 6 PM when I have 9:30 and 10:30 items open, I stop trusting the glance and have to scroll every time." · average 3 — "In my two-minute check-ins that header line is the only thing I read, so if it says my next thing is at 6 PM I'd skip my 9:30 and 10:30 items and stop trusting what the app says about my day." · low-literacy 1 — "I only glance at my child's plan now and then, and I wouldn't check the times closely enough to notice the 'next' line skips earlier items."
- **Divergence:** The average student (3, important) and the parent (1, not important) are furthest apart. The issue hurts students whose only daily check is the header line, not parents who look at the plan occasionally.
- **Confidence:** Medium — the selection logic may deliberately count only fixed-time items; the snapshot does not show which items are fixed versus suggested.
- **Suggested fix:** Make the header's 'next' show the earliest open item still ahead today, or label it 'next fixed-time item' if it only counts fixed times.

### F05 — Capture destination shown only as 'Goes to: Auto' · Priority 4.0

- **Heuristic:** Match between system and the real world (secondary: Recognition rather than recall)
- **Screen(s):** S2 Home
- **Evidence:**
  - > "button "Goes to: Auto"" — S2 Home
  - > "textbox "What do you want to add?"" — S2 Home
- **Business impact:** 2 — Capture is the first step of the core loop. Not knowing where an item will go leads to the named failure of a plan the student "cannot find after confirming".
- **Ratings:** power 2 — "I capture 5 to 10 times a day and 'Auto' doesn't tell me where things land, so I'd have to check the destination a few times before I trust the routing." · average 2 — "I type things in fast and want to forget about them, so not knowing where 'Auto' put my essay means I'd have to go looking for it afterward." · low-literacy 2 — "'Goes to: Auto' doesn't tell me where something I type will end up, so I'd hesitate before adding anything. But I'm not the one capturing tasks."
- **Divergence:** All three scores are equal, but only the average student marks it important. The cost lands on occasional capturers who type and expect to forget. The power user learns the routing, and the parent does not capture.
- **Confidence:** Medium — what happens after 'Add' (it may show where the item went) was not captured.
- **Suggested fix:** Replace 'Auto' on the destination button with a plain-language hint such as 'Tangent picks: Today or a project'.

### F14 — Floating Draft plan bar covers Home's question actions · Priority 4.0

- **Heuristic:** Aesthetic and minimalist design (secondary: User control and freedom)
- **Screen(s):** S2 Home, S6 What Tangent knows
- **Evidence:**
  - > "button "Answer"" — S2 Home
  - Screenshot observation (heur-home.png): the 'Draft plan · ED II Supplemental Essay Dra... 5 steps' pill overlaps the right side of the 'A few questions to sharpen your plans' bar; no Answer or Hide button is visible — S2 Home
  - Screenshot observation (heur-settings-context.png): the Draft plan pill overlays the area chip row to the right of 'Classes & activities' — S6 What Tangent knows
- **Business impact:** 2 — Hiding 'Answer' blocks the step where Tangent "asks only the few questions that change the plan", which degrades plan quality.
- **Ratings:** power 2 — "With Answer and Hide hidden under the draft pill, I'd have to deal with the draft before I could clear those questions, which is an annoying extra step but one I'd get around." · average 2 — "If the bar hid the Answer button I'd just skip the questions, and my plans would be a bit less realistic, but I'd still finish." · low-literacy 2 — "With the floating bar covering buttons, the screen feels crowded and I can't see what I'm supposed to press there. That adds to my uncertainty, but I'd get past it."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — judged from one static screenshot at one scroll position; the overlap may change on scroll.
- **Suggested fix:** Reserve bottom padding for the Draft plan bar so it never overlaps page content such as the 'From Tangent' actions.

### F12 — Calendar agenda rows drop the project name shown on Home · Priority 3.3

- **Heuristic:** Recognition rather than recall (secondary: Consistency and standards)
- **Screen(s):** S2 Home, S3 Calendar (Agenda)
- **Evidence:**
  - > "button "Review notes on weakest units"" — S2 Home
  - > "generic: AP Chem Final Prep" — S2 Home
  - > "button "Review notes on weakest units"" — S3 Calendar (Agenda)
  - > "button "Learn log rules and change of base"" — S3 Calendar (Agenda)
- **Business impact:** 2 — Students need to recognise confirmed plan steps on the calendar. Unlabelled steps feed the "plan they cannot find" failure.
- **Ratings:** power 2 — "In my weekly desktop planning pass I juggle several AP projects, and two identical step titles on Thursday with no project name means I'd have to cross-check Home to know which is which." · average 2 — "I check the Calendar to see my plan after I confirm it, and two identical 'Learn log rules' steps with no project name would make me unsure which one belongs to my plan." · low-literacy 1 — "I'm not managing my child's steps day to day, so a missing project name on the calendar rows wouldn't affect me."
- **Divergence:** Both students mark it important, and the parent does not. The issue hurts the students who check confirmed plans on the calendar, not parents who oversee from a distance.
- **Confidence:** High
- **Suggested fix:** Show the project name under each Calendar agenda row, matching the Home 'Coming up' rows.

### F11 — Fact 'Forget' and data delete show no undo or recovery note · Priority 3.3

- **Heuristic:** Error prevention (secondary: User control and freedom)
- **Screen(s):** S6 What Tangent knows, S7 Your data
- **Evidence:**
  - > "button "Forget: You do your best work late at night"" — S6 What Tangent knows
  - > "button "Edit: You do your best work late at night"" — S6 What Tangent knows
  - > "button "Delete data"" — S7 Your data
  - > "Removes your tasks, projects, chats and history. Your account stays." — S7 Your data
- **Business impact:** 2 — Losing facts or data by accident damages plan quality and trust, and parents judging safety need clear recovery terms.
- **Ratings:** power 1 — "I almost never forget facts or delete data, so a missing undo note there is something I'd hardly ever run into." · average 1 — "I rarely go into fact lists or delete settings, so missing undo text there probably wouldn't affect me in a normal week." · low-literacy 3 — "I can't tell whether 'Forget' or 'Delete data' asks me first or can be undone, so I'd be scared to press anything when I'm checking what's stored about my child."
- **Divergence:** The parent (3, important) diverges sharply from both students (1). This is a parent-trust problem: it stops the person who decides on adoption from inspecting and managing their child's data.
- **Confidence:** Low — confirmation dialogs or undo toasts may appear after the click; post-click states were not captured.
- **Suggested fix:** Add 'You can undo this' or 'This can't be undone' text beside each 'Forget' and 'Delete data' control.

### F04 — 'Tangents' label conflicts with page content and placement · Priority 2.7

- **Heuristic:** Match between system and the real world (secondary: Consistency and standards)
- **Screen(s):** S2 Home, S4 Projects, S5 Tangents
- **Evidence:**
  - > "heading "Projects" [level=2]" — S2 Home
  - > "link "Tangents":" — S4 Projects
  - > "Where you want to be in a year or more. Tangent maps the moves from what you already do." — S5 Tangents
  - > "button "Start your first path"" — S5 Tangents
- **Business impact:** 2 — Students who cannot work out what a main area is for will skip it or get lost, which cuts into retention around long goals.
- **Ratings:** power 1 — "A coined nav word is a one-time puzzle for me; I'd click it once, see 'paths', and never think about it again." · average 1 — "Tangents is a made-up word, but I'd learn it by tapping it once, and I'm not making year-long paths anyway." · low-literacy 2 — "'Tangents' means nothing to me, and when it's sitting next to Projects but talks about 'paths' I can't tell what my child would be putting in there."
- **Divergence:** Only the parent marks it important. Students learn the coined word in one tap, but the parent cannot tell what this area holds for their child.
- **Confidence:** High
- **Suggested fix:** Rename the 'Tangents' nav item to the plain word the page already uses (for example 'Paths') and move it out of the Projects group.

### F15 — Decorative knowledge map pushes the actual facts below the fold · Priority 2.7

- **Heuristic:** Aesthetic and minimalist design
- **Screen(s):** S6 What Tangent knows
- **Evidence:**
  - > "Drag to turn · click an area to open it" — S6 What Tangent knows
  - > "button [aria-hidden]" — S6 What Tangent knows
  - Screenshot observation (heur-settings-context.png): the graph occupies roughly y=150-815; the labels 'Commitments' and 'Python Competitive Pr...' overlap, and the fragments 'C' and 'Prep' are clipped beside the 'L 20 facts' node — S6 What Tangent knows
- **Business impact:** 2 — Students and parents checking what is stored (a parent safety judgment) must get past a decorative visual to read and fix facts.
- **Ratings:** power 1 — "I rarely visit What Tangent knows, and when I do I'll just scroll past the graph to the facts." · average 1 — "I'd hardly ever open the What Tangent knows page, so a big spinning graph there wouldn't slow down my planning." · low-literacy 2 — "When I open the page about what the app knows about my child, I get a spinning graph with jumbled labels, and I might not realize the actual list of facts is further down."
- **Divergence:** Only the parent marks it important. The graph hides the facts from the person auditing what is stored, while students rarely visit the page.
- **Confidence:** High
- **Suggested fix:** Shrink the 'You, mapped' graph to a compact header and show the Goals/Classes fact lists in the first viewport.

### F02 — Done toggles announce the opposite of their visible state · Priority 2.0

- **Heuristic:** Visibility of system status (secondary: Consistency and standards)
- **Screen(s):** S2 Home, S3 Calendar (Agenda)
- **Evidence:**
  - > "button "Not done: Set up Codeforces account" [pressed]" — S2 Home
  - > "button "Done: Get ready"" — S2 Home
  - > "button "Not done: Map all AP Chem units" [pressed]" — S3 Calendar (Agenda)
- **Business impact:** 2 — 'Done' is the last step of the capture → plan → done loop. A contradictory completion status makes the plan hard to trust for students who rely on assistive output.
- **Ratings:** power 1 — "I go by the visible checkmark and strikethrough, so a mismatched accessible name never slows down my taps." · average 1 — "I just look at the checkmark and the strikethrough, so I'd never notice what the button is called behind the scenes." · low-literacy 1 — "I go by the tick and the crossed-out text I can see, so I would never notice a hidden button label that says the opposite."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — the visual checked state is clear in the screenshots; the contradiction only shows in the accessible name plus state, and how it is announced was not tested.
- **Suggested fix:** Give each toggle a stable name such as 'Mark done: <task>' and let the pressed state alone convey completion.

### F06 — Data settings use developer terms like 'chat ids' · Priority 1.7

- **Heuristic:** Match between system and the real world
- **Screen(s):** S7 Your data
- **Evidence:**
  - > "Forgets saved chat ids, cached titles and nudges on this device. Nothing in your account changes." — S7 Your data
- **Business impact:** 1 — Peripheral setting. It slightly weakens a parent's understanding of data handling but does not block it.
- **Ratings:** power 1 — "I know what chat ids and cached titles are, and I barely ever open the data page anyway." · average 1 — "I'd basically never open the data page. If I did, 'chat ids' wouldn't matter to me; that's more my parent's thing." · low-literacy 3 — "This is the page I'd use to decide whether my ninth-grader's data is handled safely, and 'chat ids' and 'cached titles' mean nothing to me, so I can't judge it."
- **Divergence:** The parent (3, important) diverges sharply from both students (1). The jargon sits on the exact page a parent uses to judge safety, so it hurts the person who decides whether the student may use Tangent.
- **Confidence:** High
- **Suggested fix:** Rewrite the 'Clear this browser' description in plain words, for example 'Forgets which chats and reminders this device remembers'.

### F13 — Long task lists offer filters but no search · Priority 1.7

- **Heuristic:** Flexibility and efficiency of use
- **Screen(s):** S2 Home, S3 Calendar (Agenda)
- **Evidence:**
  - > "button "Coming up 35" [expanded]" — S2 Home
  - > "33 things to do in the next 7 days, 4 at a set time or date." — S3 Calendar (Agenda)
  - > "group "Show":" — S3 Calendar (Agenda)
- **Business impact:** 1 — Slows heavy users who need to find a specific task; scrolling is a workaround.
- **Ratings:** power 2 — "With 35 upcoming items across classes, sport and a side project, scrolling past four category filters to find one task is friction I'd hit every week." · average 2 — "With 35 things coming up, finding one task without search means scrolling, but I'd get there with the School filter." · low-literacy 1 — "I'm not hunting for particular tasks, so having no search box doesn't matter on my rare visits."
- **Divergence:** Only the power user marks it important. Missing search is an efficiency cost for high-volume students. Average users get by with filters, and parents do not search.
- **Confidence:** Medium — a search might be reachable through the 'New' button or a shortcut that a snapshot cannot show.
- **Suggested fix:** Add a task search field above the Calendar agenda and Home 'Coming up' list.

### F17 — Help reachable only via Settings 'Help and privacy' · Priority 1.3

- **Heuristic:** Help and documentation
- **Screen(s):** S2 Home, S6 What Tangent knows, S7 Your data
- **Evidence:**
  - > "link "Settings":" — S2 Home
  - > "button "Too big"" — S2 Home
  - > "link "Help and privacy":" — S7 Your data
- **Business impact:** 1 — May add support contacts but does not block the core loop on its own.
- **Ratings:** power 1 — "I work out UI patterns by poking around and almost never look for help, so where it lives barely matters to me." · average 1 — "I never look for help pages. I figure things out by tapping, so having help only in Settings wouldn't bother me." · low-literacy 2 — "I'd want help nearby when I see words I don't know, and it's tucked at the bottom of Settings. I'd probably find it eventually because I'd go to Settings anyway."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — the contents of /settings/privacy and the first-run tour were not in scope, so the quality and coverage of help could not be judged.
- **Suggested fix:** Add a 'Help' link to the main sidebar footer next to Settings.

### F03 — Section counts ignore completed rows shown inside them · Priority 1.0

- **Heuristic:** Visibility of system status
- **Screen(s):** S2 Home
- **Evidence:**
  - > "button "Morning 5 AM – 12 PM 2 items" [expanded]" — S2 Home
  - > "button "Map all AP Chem units"" — S2 Home
  - > "button "I still have to film and edit 's video"" — S2 Home
- **Business impact:** 1 — Minor count confusion on Home; does not plausibly block the core loop.
- **Ratings:** power 1 — "I'd work out on first sight that '2 items' means open ones, so it costs me nothing after day one." · average 1 — "If I saw '2 items' above five rows I'd probably figure it means the two I haven't done yet and move on." · low-literacy 1 — "I might wonder briefly why it says 2 items when I see five, but it wouldn't stop me judging whether the app is safe."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Change the Morning/Evening count label to '2 left' so it states that it counts open items only.

### F08 — Home and Calendar filters use different control types · Priority 1.0

- **Heuristic:** Consistency and standards
- **Screen(s):** S2 Home, S3 Calendar (Agenda)
- **Evidence:**
  - > "tablist "Show":" — S2 Home
  - > "tab "School"" — S2 Home
  - > "group "Show":" — S3 Calendar (Agenda)
  - > "button "All" [pressed]" — S3 Calendar (Agenda)
- **Business impact:** 1 — Small learnability cost across two views; does not plausibly move any named outcome.
- **Ratings:** power 1 — "Tabs on one page and chips on the other filter the same way, so I'd use both without slowing down." · average 1 — "The filters look a bit different on each page, but they both do the same thing, so I'd just tap School either way." · low-literacy 1 — "Both filters say All/School/Projects/Personal, so I wouldn't care that they look a bit different."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Use the same 'Show' filter component, with the same role and visual style, on Home and Calendar.

### F09 — School and Work treated as projects in some places, not others · Priority 1.0

- **Heuristic:** Consistency and standards
- **Screen(s):** S2 Home, S4 Projects, S6 What Tangent knows
- **Evidence:**
  - > "link "Work No steps yet":" — S2 Home
  - > "region "School & Work":" — S4 Projects
  - > "link "Work Nothing coming up 0 open":" — S4 Projects
  - > "button "Project: School, linked to 0 facts"" — S6 What Tangent knows
- **Business impact:** 1 — Confuses the categories; does not block capture, planning or completion.
- **Ratings:** power 1 — "School and Work showing up in two different places is untidy, but I know what they are and it doesn't cost me any taps." · average 1 — "I wouldn't think about whether Work counts as a project. I don't use it for planning." · low-literacy 1 — "I wouldn't dig deep enough to notice School and Work being grouped differently on different pages."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Show School and Work the same way in the sidebar, Projects page and knowledge map, using one status wording.

### F10 — Logo 'home' and Home nav item point to different URLs · Priority 1.0

- **Heuristic:** Consistency and standards
- **Screen(s):** S2 Home, S3 Calendar (Agenda)
- **Evidence:**
  - > "link "Tangent, go to the capture home":" — S2 Home
  - > "/url: /capture" — S2 Home
  - > "link "Home 3 open today":" — S3 Calendar (Agenda)
- **Business impact:** 1 — Navigation ambiguity with little effect on business outcomes.
- **Ratings:** power 1 — "I navigate from the sidebar, so a logo that goes to a capture page instead of Home wouldn't trip me up." · average 1 — "I tap Home to go home, so I'd never notice that the logo goes somewhere slightly different." · low-literacy 1 — "I'd just tap Home, and I'd probably never notice the logo goes somewhere slightly different."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — /capture may redirect to /; the destination page was not captured.
- **Suggested fix:** Point the logo link at / and rename its accessible name to 'Tangent, go to Home'.

### F16 — Sidebar repeats Projects and Tangents entry points · Priority 1.0

- **Heuristic:** Aesthetic and minimalist design
- **Screen(s):** S2 Home, S4 Projects
- **Evidence:**
  - > "link "Projects":" — S2 Home
  - > "heading "Projects" [level=2]" — S2 Home
  - > "link "All projects":" — S2 Home
  - > "link "Tangents":" — S4 Projects
- **Business impact:** 1 — Navigation clutter only; does not plausibly move any named outcome.
- **Ratings:** power 1 — "Extra links to the same Projects page are clutter I'd tune out right away; they don't slow me down." · average 1 — "Three links to Projects is clutter, but any of them gets me where I'm going." · low-literacy 1 — "The repeated Projects links make the sidebar a bit busier, but they all go to the same place, so it wouldn't trip me up."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Remove the 'All projects' sidebar link and the duplicate 'Tangents' link on the Projects page header.

## Fix this first

**F07 — Draft plan bar's only dismiss control discards the draft (Priority 4.7, convergence 3/3):** Add a non-destructive 'Hide' control to the Draft plan bar and swap the 'X' glyph on the discard action for a labelled 'Discard'. This rescues all three raters. It matters most for the parent (low-literacy, 3), who would otherwise delete their child's unconfirmed plan just to clear the screen. It also helps the power and average students, who currently have to choose between living with the bar and losing their draft.

## Round 2 → round 3

Round 1: 17 findings. Round 2: 11 findings. Round 3: 17 findings. The count went up because the expert flagged more small issues on screens that now show more content (a populated Home and Calendar, a floating Draft plan bar). It does not mean round 2's problems came back: 6 of the 11 round-2 findings are gone, 2 are partly fixed, and 3 remain. Round-3 priorities top out at 4.7; round 2's top finding scored 8.0. Each finding gets a fresh ID every round, so round-2 IDs below are from the round-2 report.

**Gone (not raised in round 3, and the captured screens show the change):**
- R2 F01 (8.0) Calendar 'next 7 days' count contradicts the agenda. The panel now reads "33 things to do in the next 7 days, 4 at a set time or date." and the Agenda lists the items day by day.
- R2 F11 (5.0) No help, privacy or parent info from sign-in or Settings. Sign-in now has a "Privacy, terms and contact" footer (Privacy, Terms, For parents, contact address), and Settings has a "Help and privacy" entry. What remains is the narrower R3 F17 (help only inside Settings, 1.3).
- R2 F08 (3.3) Calendar agenda truncates task titles. In `heur-calendar.png` the long titles now wrap onto two lines.
- R2 F10 (1.3) Home says 'Nothing planned today' twice. The header now reads "3 left today · next: …".
- R2 F04 (1.0) Done labelled differently on Home and Calendar. Both screens now use "Done: <task>" / "Not done: <task>". This consistency fix led to the new R3 F02 (name vs pressed state).
- R2 F05 (3.3) Removal verbs Forget / Clear / Delete / Remove used inconsistently. Not raised again. The verbs themselves are unchanged ("Forget" on S6; "Clear" and "Delete data" on S7), so this may be evaluator variance, not a fix.
- R2 F07 (3.3) Icon-only capture controls. Not raised again. The mic and send controls are still icon-only in `heur-home.png`, so this may also be evaluator variance.

**Remain (same problem, new ID):**
- R2 F02 (2.7) 'Tangents' jargon under the Projects heading → R3 F04 (2.7). The page now talks about "paths", which adds a mismatch with its label.
- R2 F06 (3.3) Destructive data buttons with no visible confirmation → R3 F11 (3.3). It now also covers the per-fact 'Forget' buttons.
- R2 F09 (2.7) Decorative knowledge map dominates What Tangent knows → R3 F15 (2.7). The duplicated 'Facts per area' list was not raised again; the map is still the first-viewport content, and its labels now overlap.

**Partly fixed:**
- R2 F03 (2.0) Home and Calendar category filter names differ → R3 F08 (1.0). Both now say All / School / Projects / Personal; only the control type (tabs vs toggle chips) still differs.

**New in round 3:** F07 Draft plan bar dismiss = discard (4.7), F01 Home header 'next' skips earlier items (4.0), F05 'Goes to: Auto' (4.0), F14 Draft plan bar covers Home actions (4.0), F12 Calendar rows drop the project name (3.3), F02 Done toggle name vs pressed state (2.0), F06 'chat ids' wording (1.7), F13 no search (1.7), F17 help only in Settings (1.3), F03 section counts (1.0), F09 School/Work grouping (1.0), F10 logo vs Home URL (1.0), F16 duplicate Projects/Tangents links (1.0). Three of the top four involve UI that round 2 could not see: the Draft plan bar and a populated Home day.

## Method note

One expert agent evaluated 7 captured screens of http://localhost:3000 under forced enumeration of all ten Nielsen heuristics. The expert recorded a verdict for every heuristic: Heuristic 9 was not observable because no error state was captured. Three synthetic personas (power student, average student, low-literacy parent) independently rated the usability impact of each finding; rater coverage was 3/3. Priority = business impact × the unrounded mean usability impact, rounded once to one decimal. Findings are a lower bound (single-evaluator ceiling, per Nielsen & Molich 1990).

Scope and capture details:
- **Pages and settings:** site mode, 7 of an 8-page cap (cap not hit), viewport 1440x900, dark colour scheme, captured with Playwright MCP. Error probing was not run.
- **Sign-in page:** S1 was captured signed out in a separate isolated browser context; the main signed-in session was never signed out.
- **Not evaluated:**
  - /settings/account (excluded because it shows the [test account]'s email)
  - the other Settings pages: security, schedule, notifications, AI activity, help and privacy
  - /privacy, /terms, /parents
  - project detail, task and plan screens
  - dialogs: setup, first-run tour, delete/discard confirmations
  - chat and plan-draft states, the Notifications panel
  - phone layout, light theme
- **Snapshot trimming:** snapshots were trimmed per protocol (refs and cursor markers stripped, repeated siblings beyond 5 collapsed, 15,000-character cap). Home (S2) and What Tangent knows (S6) hit the cap and were truncated. The Home tail (rest of Coming up, Canvas prompt, Draft plan bar) and the S6 fact list beyond the cap were judged from screenshots only.
- **Redaction:** the sign-in page's public contact email address was redacted to "[contact email]" in the snapshot given to the expert.
- **Transport:** trimmed snapshots and the rater projection were handed to the expert and raters as files they read in full, not pasted inline; the content is identical.
- **Evidence check:** all 53 snapshot evidence quotes were verified against the trimmed snapshots, and 0 findings were dropped. F07, F14 and F15 also carry screenshot observations as evidence.
- **Test data:** the [test account] is shared with other test personas, so odd or duplicate item content is test data, not product behaviour.
- **Handoff decisions (no questions asked):** personas and business summary reused; summary-synthesizer skipped as instructed; round-2 → round-3 comparison written by the orchestrator from the two reports and the round-3 screenshots.

References: Nielsen & Molich (1990), Proc. ACM CHI'90; Nielsen (1994), Proc. ACM CHI'94; Nielsen & Mack (1994), Usability Inspection Methods, Wiley; nngroup.com — "How to Conduct a Heuristic Evaluation" and "Severity Ratings for Usability Problems".
