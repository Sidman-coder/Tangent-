# Heuristic evaluation report — tangent-localhost

> Nielsen heuristic evaluation with synthetic severity raters — **user-simulation · heuristic-test**.
> **Site:** http://localhost:3000 · **Date:** 2026-11-18 · **Mode:** site · **Scope:** 7 screens evaluated (page cap 8, not hit). **Not evaluated:** /settings/account (deliberately excluded because it shows the account email in clear text); /settings/security, /settings/schedule, /settings/notifications and /settings/activity (not crawled); /projects/school (not crawled in this run); everything behind interaction (chat/plan flow, onboarding, first-run tour, Confirm/Edit/Discard, notification panel contents). Error probing did not run. **Evidence caveats:** S2, S4 and S5 rest on condensed DOM text, not an ARIA snapshot. F02 is Low confidence and needs human verification.
> **Pages inspected:** 7 — S1 Sign-in (/signin, signed out) · S2 Home (/, condensed text) · S3 Calendar (/calendar) · S4 Projects (/projects, condensed text) · S5 Tangents (/tangents, condensed text) · S6 What Tangent knows (/settings/context) · S7 Your data (/settings/data)
> **Raters:** tangent-localhost-power · tangent-localhost-average · tangent-localhost-low-literacy

**Business:** Tangent is a phone-first planner for high school students (also usable on desktop). The student captures anything they need to do, Tangent asks only the questions that change the plan, and a plan reaches the calendar only after the student confirms (capture → plan → done). Parents decide whether to allow the app. A failed conversion is a student who cannot find or trust a confirmed plan, or a parent who cannot judge safety.

## Coverage

| Heuristic | Status |
|---|---|
| 1. Visibility of system status | 2 findings (F01, F02) |
| 2. Match between system and the real world | 3 findings (F03, F04, F05) |
| 3. User control and freedom | Clean — swept all 7 screens. Home Undo, Not now and per-fact Forget/Edit are present. Missing confirmation on destructive actions is filed under heuristic 5 (F10). |
| 4. Consistency and standards | 4 findings (F06, F07, F08, F09), each citing at least two screens |
| 5. Error prevention | 1 finding (F10) |
| 6. Recognition rather than recall | 2 findings (F11, F12) |
| 7. Flexibility and efficiency of use | Clean — swept all screens. Lists in scope are short, and Calendar offers suggested-question chips and view switching. Keyboard shortcuts and gestures cannot be judged from the snapshots. |
| 8. Aesthetic and minimalist design | 3 findings (F13, F14, F15). Judged with screenshots for S1 to S7. |
| 9. Help users recognize, diagnose, and recover from errors | Not observable — no error state was captured in any of the 7 screens (error probing was not run). The only related elements are disabled buttons (Email me a code, Add, Send), which are not error messages. |
| 10. Help and documentation | 2 findings (F16, F17). Help content quality is not judgeable because no help pages are in scope. |

## Findings by priority

| # | Description | Heuristic | Business | Usability | Priority | Convergence | Reason | Suggested fix |
|---|---|---|---|---|---|---|---|---|
| F01 | Home says "all caught up" while an Undo for a new item exists | Visibility of system status | 3 | 2.7 | 8.1 | 2/3 | The capture-to-plan loop fails if students cannot find what they just added; the average rater would "quietly stop opening the app". | Show the result of each capture on Home (for example a line saying where it was saved, with a link) so the empty state never contradicts the Undo entry. |
| F16 | Sign-in page gives parents no safety, privacy or consent information | Help and documentation | 3 | 1.7 | 5.1 | 1/3 | Parents decide whether the app is allowed, so missing safety info can block conversion; the parent rater calls it "a reason to say no". | Add a short 'For parents' line on the sign-in page linking to what Tangent stores and how data is deleted. |
| F02 | Calendar's 7-day panel and week grid disagree (Low confidence) | Visibility of system status | 2 | 2.0 | 4.0 | 2/3 | If confirmed work does not show on the calendar, trust erodes; the average rater "can't find my confirmed plan again" and quits. | Make the 'Your next 7 days' summary and the week grid read from the same data, and show a visible count or jump-to link for items outside the visible hours. |
| F10 | Delete and Forget actions show no confirmation step or undo note | Error prevention | 2 | 2.0 | 4.0 | 1/3 | An accidental wipe costs retention and trust; the parent rater would be "afraid to press anything near my child's data". | Add a confirmation dialog to 'Delete data', 'Delete account' and 'Forget everything' that names exactly what will be removed and requires an explicit confirm. |
| F14 | Canvas promo card outweighs capture and the empty state on Home | Aesthetic and minimalist design | 2 | 2.0 | 4.0 | 1/3 | Promo content draws attention from the core loop; the power user sees "repeated noise" in every session. | Make the 'Connect Canvas' button secondary in weight, or move the card below the plan sections until after the first confirmed plan. |
| F17 | No Help entry in the sidebar or settings navigation | Help and documentation | 2 | 2.0 | 4.0 | 1/3 | Stuck students have no in-app route to help; the parent rater finds no Help for terms like "Grill me" and "would stop and refuse". | Add a 'Help' link in the sidebar footer that opens the tour and short task guides. |
| F03 | Chip "Goes to: Auto" is unexplained system wording | Match between system and the real world | 2 | 1.3 | 2.6 | 0/3 | The chip sits on the main capture control, adding friction to step one; "means nothing to me" (parent rater), though it can be ignored. | Replace the 'Auto' chip label with plain wording such as 'Tangent picks where it goes' and list the choices in its menu. |
| F05 | Stored facts read as machine-built sentences with raw goal text | Match between system and the real world | 2 | 1.3 | 2.6 | 0/3 | Clumsy or duplicated facts undermine trust for parents and students; the parent rater says the profile "looks sloppy". | Rewrite the Goals fact templates to short natural sentences (for example 'You want 1,000 subscribers on your retro handhelds channel by June') and merge near-duplicate facts. |
| F04 | Tangents page stacks undefined terms: Tangents, path, moves | Match between system and the real world | 1 | 1.7 | 1.7 | 1/3 | A secondary area, so no direct block on capture; the parent rater "cannot decode" Tangents, paths and moves. | Use one noun consistently on the Tangents page (for example 'path') and add one line saying how it differs from a Project. |
| F15 | "What Tangent knows" mixes fact review with five setup cards | Aesthetic and minimalist design | 1 | 1.7 | 1.7 | 1/3 | Rarely used cards on a supporting page; the parent rater would "not know which are safe to press". | Move the 'Getting to know you' cards to a separate 'Setup and tour' settings section and leave only the facts and 'Tell Tangent something' on this page. |
| F06 | Same filter set is named differently on Home and Calendar | Consistency and standards | 1 | 1.3 | 1.3 | 0/3 | Mild confusion about where tasks live, no core-loop block; the average rater pauses at "Personal" vs "Short-term". | Use one category name ('Personal' or 'Short-term') and one control pattern for the filter on both Home and Calendar. |
| F09 | Tangents sits inside the Projects sidebar group yet reads as separate | Consistency and standards | 1 | 1.3 | 1.3 | 0/3 | Affects navigation to a secondary area only; adds to the parent rater's confusion "about what is what". | Move the 'Tangents' link out of the 'Projects' group, or label the group so Tangents clearly belongs in it. |
| F11 | Calendar 'Recent changes' is an icon-only button | Recognition rather than recall | 1 | 1.3 | 1.3 | 0/3 | Secondary undo and history feature; a bare arrow icon would leave the parent rater unsure, but they would skip it. | Add a visible text label (for example 'Undo / Recent changes') to the 'Recent changes' button next to the Week, Month, Agenda tabs. |
| F13 | "You, mapped" constellation fills the first screen and duplicates lists | Aesthetic and minimalist design | 1 | 1.3 | 1.3 | 0/3 | Makes stored facts harder to review (a supporting trust feature); the parent rater would "scroll down to find them". | Shrink the 'You, mapped' map to a compact header and drop the separate 'Facts per area' chip list so the fact regions start in the first viewport. |
| F07 | 'Notifications' is a sidebar button but a Settings link | Consistency and standards | 1 | 1.0 | 1.0 | 0/3 | Peripheral navigation ambiguity; the power rater knows which opens the panel, "so there's no real cost". | Rename the Settings entry to 'Notification settings' so it differs from the sidebar 'Notifications' button. |
| F08 | Voice and submit controls change names between capture surfaces | Consistency and standards | 1 | 1.0 | 1.0 | 0/3 | Each surface still works, so the harm is slight learning friction; the parent rater would "read each label as I go". | Name the mic button 'Say it' on every surface and keep one verb for each submit type. |
| F12 | Sidebar project status is an unlabeled ring icon | Recognition rather than recall | 1 | 1.0 | 1.0 | 0/3 | Affects peripheral progress cues only; all three raters would ignore the ring. | Show the status text ('No steps yet') or a count next to the 'School' project name instead of icon only. |

## Finding detail

### F01 — Home shows an empty state while an Undo for a just-added item exists · Priority 8.1

- **Heuristic:** Visibility of system status
- **Screen(s):** S2 Home (condensed text)
- **Evidence:**
  > "button \"Undo: Add \"Keeping a weekly Sunday video upload going without my chem and algebra grades slipping\"\"" — S2
  > "empty state: \"You're all caught up.\" / \"Anything on your mind? Say it above.\"" — S2
  > "button \"COMING UP 0\" (collapsed section header, count 0)" — S2
- **Business impact:** 3 — The core loop (capture to plan to done) fails if a student cannot find what they just added, and they stop using the app.
- **Ratings:** power 3 — "I capture many times a day, and if the item vanishes into an \"all caught up\" screen I can't trust where it went and would go back to my notes app." · average 3 — "I add something, see 'all caught up' and a 0 count, and can't tell where it went, so I'd stop trusting that anything got saved and quietly stop opening the app." · low-literacy 2 — "I would be unsure where the thing went after typing it, but I'd likely just assume it worked and move on."
- **Divergence:** importantToMe splits: the power and average raters (frequent capturers) say it matters to them, while the low-literacy rater, who would assume it worked, does not. The issue hurts people who capture often and rely on finding the item again.
- **Confidence:** Medium — The snapshot is a hand-condensed summary. The added item may have been saved only as a fact (S6 lists it under Goals) rather than as a task. S2 rests on condensed DOM text, not an ARIA snapshot.
- **Suggested fix:** Show the result of each capture on Home (for example a line saying where it was saved, with a link) so the empty state never contradicts the Undo entry.

### F16 — Sign-in page gives parents no safety, privacy or consent information · Priority 5.1

- **Heuristic:** Help and documentation
- **Screen(s):** S1 Sign-in
- **Evidence:**
  > "paragraph: Use your school or personal account. New here? Creating an account takes about a minute." — S1
  > "button \"Continue with Google\"" — S1
- **Business impact:** 3 — The business states that parents decide whether to allow the app, so missing safety info at signup can block conversion.
- **Ratings:** power 1 — "Parent-facing safety info on the sign-in page doesn't touch my daily use." · average 1 — "Privacy and consent info is my parent's concern, and I'd just sign in with Google." · low-literacy 3 — "As the parent deciding yes or no, a sign-in page with nothing on privacy, my child's age or what happens to their information is a reason to say no."
- **Divergence:** Max−min is 2 and importantToMe splits: only the low-literacy (parent) rater is hurt. The student personas do not feel it, yet the parent is the one who decides whether the student ever gets in.
- **Confidence:** Medium — Judged from the sign-in snapshot and screenshot only. (Orchestrator note: the signed-out probe in Phase 2 confirmed /privacy, /terms and /pricing all redirect to /signin.)
- **Suggested fix:** Add a short 'For parents' line on the sign-in page linking to what Tangent stores and how data is deleted.

### F02 — Calendar's next-7-days panel and grid disagree with each other across captures · Priority 4.0

- **Heuristic:** Visibility of system status
- **Screen(s):** S3 Calendar
- **Evidence:**
  > "listitem: Nothing on your calendar for the next 7 days." — S3
  > "heur-calendar.png panel text: \"6 things to do in the next 7 days, 6 at a set time or date.\" with empty 8 AM to 8 PM week grid (verified from the screenshot, not in the snapshot)" — S3 (this quote comes from the screenshot, not the snapshot)
- **Business impact:** 2 — If confirmed work does not show up on the calendar, trust in the plan erodes and students stop returning.
- **Ratings:** power 2 — "In my weekly planning pass on desktop I need the 7-day panel and the grid to agree, and a grid that is empty while the panel says 6 things makes me doubt the plan." · average 3 — "If the calendar says 6 things are coming up but the grid is empty or says nothing, I can't find my confirmed plan again, and that's what makes me quit." · low-literacy 1 — "I would not compare the calendar panel to the grid or notice they disagree on a one-time look."
- **Divergence:** Max−min is 2 and importantToMe splits: the power and average raters, who return to the calendar to find confirmed plans, are hurt. The low-literacy rater, who looks once, would not notice.
- **Confidence:** Low — The snapshot (Month view) and screenshot (Week view) were captured at different times. The week grid may also be scrolled past the items. Needs human verification.
- **Suggested fix:** Make the 'Your next 7 days' summary and the week grid read from the same data, and show a visible count or jump-to link for items outside the visible hours.

### F10 — Delete and Forget actions show no confirmation step or undo note · Priority 4.0

- **Heuristic:** Error prevention
- **Screen(s):** S7 Your data, S6 What Tangent knows
- **Evidence:**
  > "button \"Delete data\"" — S7
  > "button \"Delete account\"" — S7
  > "Removes all of the above and your sign-in. You'll be signed out for good." — S7
  > "button \"Forget everything\"" — S6
- **Business impact:** 2 — An accidental wipe of plans or an account is a direct cause of lost retention and trust.
- **Ratings:** power 1 — "I rarely touch Delete or Forget, and I'm careful when I do, so a missing confirmation doesn't hurt my daily flow." · average 2 — "A mis-tap on delete could cost me my plans, but I'm rarely on the data page, so it's unlikely to hit me in a normal week." · low-literacy 3 — "Delete data and Delete account are two matching coral buttons with no confirmation or undo mention, and I'd be afraid to press anything near my child's data."
- **Divergence:** Max−min is 2 and importantToMe splits: only the low-literacy (parent) rater is hurt. Frequent users never go near these buttons, but the parent judging safety reads the unguarded look as a risk.
- **Confidence:** Medium — Confirmation dialogs are behavioral and not captured in the static snapshots; only the missing hint text is certain. (Orchestrator note: in Phase 2 the Delete data flow was run and asks the user to type DELETE, so read this finding as about the page text, not the flow. Whether Forget everything and per-fact Forget ask for confirmation was not observed.)
- **Suggested fix:** Add a confirmation dialog to 'Delete data', 'Delete account' and 'Forget everything' that names exactly what will be removed and requires an explicit confirm.

### F14 — Canvas promo card competes with capture and the empty state on Home · Priority 4.0

- **Heuristic:** Aesthetic and minimalist design
- **Screen(s):** S2 Home (condensed text; judged with the screenshot)
- **Evidence:**
  > "card: \"Use Canvas?\" / \"Bring your deadlines into Tangent.\" ; button \"Not now\" ; button \"Connect Canvas\"" — S2
- **Business impact:** 2 — Secondary promotional content on the Home screen can draw attention from the capture, plan and done loop.
- **Ratings:** power 2 — "I already have the Canvas feed connected, so a bright Connect Canvas card on Home that I see every session is repeated noise between my capture box and my plan." · average 2 — "The bright Connect Canvas card is annoying on a screen I check several times a week, but I can tap Not now and move on." · low-literacy 2 — "A bright 'Connect Canvas' button pulls my eye and makes me wonder whether I'm supposed to press it, but I could tap Not now."
- **Divergence:** Usability ratings are identical (2, 2, 2), but importantToMe splits: only the power user, who already has Canvas connected and sees the card every session, says it matters to them.
- **Confidence:** Medium — Judged from one screenshot of an empty state. S2 rests on condensed DOM text, not an ARIA snapshot.
- **Suggested fix:** Make the 'Connect Canvas' button secondary in weight, or move the card below the plan sections until after the first confirmed plan.

### F17 — No Help entry in the sidebar or settings navigation · Priority 4.0

- **Heuristic:** Help and documentation
- **Screen(s):** S2 Home, S7 Your data, S6 What Tangent knows
- **Evidence:**
  > "button \"Notifications\"; link \"Settings\" -> /settings; link \"Your account: account settings\" -> /settings/account" — S2
  > "navigation \"Settings sections\"" — S7
  > "strong: Take the tour" — S6
- **Business impact:** 2 — Students who get stuck have no in-app route to help, so avoidable support contacts or drop-off follow.
- **Ratings:** power 1 — "I learn interfaces by using them and rarely look for a Help entry." · average 2 — "When something confuses me I'd want a help button, and without one I'd guess or give up on that feature, though the main loop still works." · low-literacy 3 — "When I'm confused by words like Grill me or Canvas, I find no Help anywhere and cannot get an answer, so I'd stop and refuse."
- **Divergence:** Max−min is 2 and importantToMe splits: only the low-literacy rater is hurt. The power user explores by doing, while the user least able to decode the vocabulary has no way out.
- **Confidence:** Medium — Absence is shown in the snapshots; Help may be reachable from the Notifications panel or the account screen, which were not captured.
- **Suggested fix:** Add a 'Help' link in the sidebar footer that opens the tour and short task guides.

### F03 — Destination chip 'Goes to: Auto' is unexplained system wording · Priority 2.6

- **Heuristic:** Match between system and the real world
- **Screen(s):** S2 Home (condensed text), S4 Projects (condensed text)
- **Evidence:**
  > "button \"Goes to: Auto\" (destination chip \"Auto\")" — S2
  > "button \"Goes to: New project\"" — S4
- **Business impact:** 2 — The chip sits on the main capture control, so confusion adds friction to the first step of the core loop.
- **Ratings:** power 1 — "I'd work out what \"Auto\" does after a couple of uses and then ignore the chip." · average 1 — "I'd just ignore 'Goes to: Auto' and type my task, since it routes itself without my doing anything." · low-literacy 2 — "'Goes to: Auto' means nothing to me and I would not dare touch it, but I could ignore it and just type."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — The chip's menu contents were not captured. S2 and S4 rest on condensed DOM text.
- **Suggested fix:** Replace the 'Auto' chip label with plain wording such as 'Tangent picks where it goes' and list the choices in its menu.

### F05 — Stored facts appear as machine-assembled sentences with literal goal text spliced in · Priority 2.6

- **Heuristic:** Match between system and the real world
- **Screen(s):** S6 What Tangent knows
- **Evidence:**
  > "On your mind right now: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping" — S6
  > "Why Keeping a weekly Sunday video upload going without my chem and algebra grades slipping matters to you: I want 1,000 subscribers on my retro handhelds channel by June" — S6
- **Business impact:** 2 — Parents judging what Tangent stores about their teen, and students judging trust in the plan, see clumsy or duplicated facts.
- **Ratings:** power 1 — "The clunky stored-fact wording is on a settings page I rarely open, and it doesn't affect my capture or planning." · average 1 — "Clunky sentences on a settings page I rarely open don't slow down my capture-to-plan loop." · low-literacy 2 — "The odd sentences about my child make the stored profile look sloppy, but I can still tell roughly what it has saved."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Rewrite the Goals fact templates to short natural sentences (for example 'You want 1,000 subscribers on your retro handhelds channel by June') and merge near-duplicate facts.

### F04 — Tangents page stacks undefined terms: Tangents, path and moves · Priority 1.7

- **Heuristic:** Match between system and the real world
- **Screen(s):** S5 Tangents (condensed text), S4 Projects (condensed text)
- **Evidence:**
  > "heading \"Tangents\" [level=1]: \"Where you want to be in a year or more. Tangent maps the moves from what you already do.\"" — S5
  > "button \"Start your first path\"" — S5
  > "heading \"Projects\" [level=1]: \"Bigger goals, broken into steps Tangent spaces out on your calendar.\"" — S4
- **Business impact:** 1 — This is a secondary area, so the confusion does not directly block capture or planning.
- **Ratings:** power 1 — "I only need to learn once how Tangents differs from Projects, so it doesn't slow my daily capture." · average 1 — "I pick up words like Tangents and path by tapping once, and I barely use that page in a normal week." · low-literacy 3 — "Tangents, paths and moves are all words I cannot decode, and I cannot tell what 'Start your first path' commits my child to."
- **Divergence:** Max−min is 2 and importantToMe splits: only the low-literacy (parent) rater is hurt. Regular users learn the vocabulary by tapping, while a parent judging what the child commits to cannot decode it.
- **Confidence:** Medium — Judged from page copy only. S4 and S5 rest on condensed DOM text.
- **Suggested fix:** Use one noun consistently on the Tangents page (for example 'path') and add one line saying how it differs from a Project.

### F15 — 'What Tangent knows' page mixes data review with five onboarding and setup cards · Priority 1.7

- **Heuristic:** Aesthetic and minimalist design
- **Screen(s):** S6 What Tangent knows
- **Evidence:**
  > "heading \"Getting to know you\" [level=2]" — S6
  > "button \"Take it again\"" — S6
  > "button \"Ask me one\"" — S6
  > "button \"Grill me now\"" — S6
  > "button \"Redo setup\"" — S6
- **Business impact:** 1 — The cards are rarely used and sit on a supporting settings page.
- **Ratings:** power 1 — "The setup rows are on a page I seldom visit, and I'd skip past them." · average 1 — "The extra setup rows on that page don't matter to me because I won't be there often." · low-literacy 3 — "The page where I'm trying to review what is known about my child is mixed with Grill me, Redo setup and other odd buttons, and I'd not know which are safe to press."
- **Divergence:** Max−min is 2 and importantToMe splits: only the low-literacy (parent) rater is hurt. The page is a review surface for parents, and the setup buttons make it feel unsafe to touch.
- **Confidence:** Medium — Order and spacing are taken from the snapshot.
- **Suggested fix:** Move the 'Getting to know you' cards to a separate 'Setup and tour' settings section and leave only the facts and 'Tell Tangent something' on this page.

### F06 — Same filter set is named differently on Home and Calendar · Priority 1.3

- **Heuristic:** Consistency and standards
- **Screen(s):** S2 Home (condensed text), S3 Calendar
- **Evidence:**
  > "tablist: tab \"All\" ; tab \"School\" ; tab \"Projects\" ; tab \"Personal\"" — S2
  > "button \"Short-term\"" — S3
  > "group \"Show\": button \"All\" [pressed]" — S3
- **Business impact:** 1 — This causes mild confusion about where tasks live but does not block the core loop.
- **Ratings:** power 1 — "I'd spot that Personal and Short-term are the same bucket on first look, and it costs me nothing after that." · average 2 — "'Personal' versus 'Short-term' makes me pause for a second when I'm filtering, but I'd work out they're the same thing." · low-literacy 1 — "I would not notice Personal versus Short-term; I would not be comparing two screens."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Use one category name ('Personal' or 'Short-term') and one control pattern for the filter on both Home and Calendar.

### F09 — Tangents sits inside the Projects sidebar group yet is presented as a separate area · Priority 1.3

- **Heuristic:** Consistency and standards
- **Screen(s):** S2 Home (condensed text), S4 Projects (condensed text), S5 Tangents (condensed text)
- **Evidence:**
  > "region \"Projects\": heading \"Projects\" [level=2]; link \"Tangents\" -> /tangents" — S2
  > "link \"Tangents\" -> /tangents" — S4
  > "heading \"Tangents\" [level=1]: \"Where you want to be in a year or more.\"" — S5
- **Business impact:** 1 — This affects navigation to a secondary area only.
- **Ratings:** power 1 — "Where Tangents sits in the sidebar is a one-time orientation quirk, and I go straight to the page I need." · average 1 — "Where Tangents sits in the sidebar is a small oddity I'd shrug off, because I mostly stay on Home and Calendar." · low-literacy 2 — "Tangents sitting under Projects adds to my confusion about what is what, but I would get through it."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — Sidebar grouping is inferred from the condensed summaries of S2 and S4 and the full snapshot of S3.
- **Suggested fix:** Move the 'Tangents' link out of the 'Projects' group, or label the group so Tangents clearly belongs in it.

### F11 — Calendar 'Recent changes' is an icon-only button with no visible label · Priority 1.3

- **Heuristic:** Recognition rather than recall
- **Screen(s):** S3 Calendar
- **Evidence:**
  > "button \"Recent changes\"" — S3
- **Business impact:** 1 — It affects a secondary undo and history feature rather than the core loop.
- **Ratings:** power 1 — "I'd hover or click the icon once to find the history and undo, then remember it." · average 1 — "I don't go looking for recent-changes history on a two-minute check, so a small icon without a label doesn't slow me down." · low-literacy 2 — "A bare arrow icon with no label would leave me unsure, but I would just skip it rather than get stuck."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — Icon appearance comes from heur-calendar.png; a tooltip may exist and was not captured.
- **Suggested fix:** Add a visible text label (for example 'Undo / Recent changes') to the 'Recent changes' button next to the Week, Month, Agenda tabs.

### F13 — 'You, mapped' constellation fills the first screen and duplicates the fact lists · Priority 1.3

- **Heuristic:** Aesthetic and minimalist design
- **Screen(s):** S6 What Tangent knows
- **Evidence:**
  > "heading \"You, mapped\" [level=2]" — S6
  > "list \"Facts per area\": button \"Goals 3\"" — S6
  > "region \"Goals\": heading \"Goals\" [level=3]" — S6
- **Business impact:** 1 — It reduces how easily students and parents can review stored facts, a supporting trust feature, but does not block the core loop.
- **Ratings:** power 1 — "The big map pushes facts below the fold, but I seldom review What Tangent knows and I'd just scroll." · average 1 — "The big constellation map is on a settings page I seldom open, so it doesn't touch my plan loop." · low-literacy 2 — "The big decorative map pushes the actual facts below where I'd look, but I would scroll down to find them."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Shrink the 'You, mapped' map to a compact header and drop the separate 'Facts per area' chip list so the fact regions start in the first viewport.

### F07 — 'Notifications' is a button in the sidebar but a link in Settings · Priority 1.0

- **Heuristic:** Consistency and standards
- **Screen(s):** S2 Home (condensed text), S6 What Tangent knows
- **Evidence:**
  > "button \"Notifications\"" — S2
  > "link \"Notifications\": /url: /settings/notifications" — S6
- **Business impact:** 1 — This is a peripheral navigation ambiguity that does not touch capture or planning.
- **Ratings:** power 1 — "I know the sidebar button opens the panel and the Settings link configures it, so there's no real cost." · average 1 — "I'd tap the sidebar Notifications to read them and never go looking in settings for the other one." · low-literacy 1 — "Whether it is a button or a link makes no difference to me; I just tap and see what appears."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — What the sidebar button opens was not captured.
- **Suggested fix:** Rename the Settings entry to 'Notification settings' so it differs from the sidebar 'Notifications' button.

### F08 — Voice and submit controls change names between capture surfaces · Priority 1.0

- **Heuristic:** Consistency and standards
- **Screen(s):** S2 Home (condensed text), S4 Projects (condensed text), S6 What Tangent knows, S3 Calendar
- **Evidence:**
  > "button \"Say it\" (mic)" — S2
  > "button \"Dictate\"" — S6
  > "button \"Add\" [disabled]" — S4
  > "button \"Send\" [disabled]" — S6
  > "button \"Ask\" [disabled]" — S3
- **Business impact:** 1 — The labels differ but each surface still works, so the harm is slight learning friction.
- **Ratings:** power 1 — "Say it, Dictate, Add, Send and Ask are all instantly readable to me and I mostly type anyway." · average 1 — "Say it, Add and Ask are all clear enough in context, and I rarely visit the settings page that says Dictate or Send." · low-literacy 1 — "Different words for the mic and submit buttons would not stop me; I would just read each label as I go."
- **Divergence:** Aligned across raters.
- **Confidence:** High
- **Suggested fix:** Name the mic button 'Say it' on every surface and keep one verb for each submit type.

### F12 — Project status in the sidebar is shown by an unlabeled ring icon · Priority 1.0

- **Heuristic:** Recognition rather than recall
- **Screen(s):** S6 What Tangent knows, S2 Home (condensed text)
- **Evidence:**
  > "link \"School No steps yet\"" — S6
  > "img \"No steps yet\"" — S6
- **Business impact:** 1 — It affects project progress cues only, which is peripheral.
- **Ratings:** power 1 — "A bare ring beside School is a cosmetic ambiguity, and I'd work out what it means on my first look." · average 1 — "A bare ring next to School is something I'd ignore, because it doesn't change what I do." · low-literacy 1 — "A little ring next to School is something I'd ignore entirely."
- **Divergence:** Aligned across raters.
- **Confidence:** Medium — Icon rendering is read from heur-home.png and heur-settings-context.png; hover text was not captured.
- **Suggested fix:** Show the status text ('No steps yet') or a count next to the 'School' project name instead of icon only.

## Fix this first

**F01 — Home shows an empty state while an Undo for a just-added item exists (Priority 8.1, convergence 2/3).** Show the result of each capture on Home (for example a line saying where it was saved, with a link) so the empty state never contradicts the Undo entry. This rescues the power and average personas, who capture often and would otherwise stop trusting that anything got saved. Check first whether the item was saved as a task or only as a fact (Medium confidence).

## Method note

One expert agent evaluated the product under forced enumeration of the ten Nielsen heuristics. Three synthetic personas (power user, average user, low digital literacy) then rated usability impact independently, and all three rated (coverage 3/3). Priority = business impact × average usability impact, computed from the displayed one-decimal average and rounded to one decimal. Findings are a lower bound, because a single evaluator misses problems (Nielsen & Molich 1990).

Scope and evidence caveats for this run:
- **Not evaluated:** /settings/account (deliberately excluded: the page shows the account email in clear text, a privacy rule for this run). /settings/security, /settings/schedule, /settings/notifications and /settings/activity were not crawled; the 8-page cap was not reached, and the crawl was limited to the main areas. /projects/school was not crawled in this run (a baseline screenshot exists but was not part of the expert bundle). Everything behind interaction was not evaluated: the chat/plan flow, onboarding, first-run tour, Confirm/Edit/Discard, and notification panel contents.
- **Error probing:** none. No forms were submitted empty or invalid, so heuristic 9 is not observable.
- Signed-in screens were captured as the test account (data left over from the Leo persona run).
- **Condensed text (S2, S4, S5):** these screens had an empty ARIA snapshot main region (hydration issue observed during capture). Their text is a DOM innerText plus controls-list condensation, so heuristics judged from them (notably F01, F03, F04, F09, F14) rest on condensed text.
- **F02 (Low confidence):** it cites one quote that comes from the screenshot (heur-calendar.png), not the snapshot, and needs human verification. The snapshot was Month view and the screenshot Week view.
- **F10:** it concerns the static page text. In the Phase 2 persona runs the Delete data flow does ask the user to type DELETE; whether Forget everything and per-fact Forget ask for confirmation was not observed.
- **F16 and F17:** they are partly corroborated by the Phase 2 Dana run: /privacy, /terms and /pricing redirect signed-out visitors to /signin, and /signin has no links.
- **Evidence quotes:** they were checked against the captured text by script. All match except the F02 second quote (from the screenshot). Several quotes (F06, F07, F09, F13) are one-line renderings of nested snapshot entries or a prefix of a longer line.
- **Finding IDs:** F01 to F17 are the expert evaluator output re-keyed in capture order (originally E1 to E17).

References: Nielsen & Molich (1990), Proc. ACM CHI'90; Nielsen (1994), Proc. ACM CHI'94; Nielsen & Mack (1994), Usability Inspection Methods, Wiley; nngroup.com — "How to Conduct a Heuristic Evaluation" and "Severity Ratings for Usability Problems".
