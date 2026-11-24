> **Orchestrator notes (added by the orchestrator, not the synthesizer):**
> - Steps 1-4 were passed to the synthesizer as condensed summaries of the simulator's output (taken from run notes), not as verbatim JSON. Steps 5-15 are closer to verbatim. The "Accumulated memory" lines in the per-screen detail are reconstructed by the synthesizer.
> - Step 9 was evaluated twice. The first run is discarded: my screen description wrongly listed a "Projects/Plans" sidebar link, so its action was not executed. The re-run used the real sidebar.
> - Steps 6-7: the mouse click on Next failed because the desktop-notification toast covered the button; the same declared action was executed by keyboard (focus + Enter).
> - Step 10: the typed wording was mine, standing in for the simulator's declared intent: "I need a plan for my Common App essay and two supplemental essays, all due Jan 5".
> - Step 15's declared action ("Your data") was NOT executed: step cap (15) reached. The run is "partial": plan confirmed, Canvas blocked, trust questions unanswered.
> - "Total estimated time: not reported" is wrong. Each evaluator returned a per-step estimate (about 10-45 seconds); they were not passed to the synthesizer. Simulated time is under 5 minutes in total.
> - Evidence: screenshots `docs/overnight/screens/before/sim-priya-*.png`; notes `docs/overnight/sim-notes-priya.md`.

# Simulation report: Priya Nair, Senior (12th grade), Early Decision II applicant with a part-time job (end user)

**Task:** Capture her ED II essay deadlines and bakery shifts, connect Canvas by iCal (if a feed URL is available; otherwise note that it is blocked), ask the chat for an essay plan, then plan it.
**Result:** Step cap reached (the 15th step's declared action was not executed). The plan was confirmed and Canvas was blocked. The storage and disconnect questions were never answered.
**Steps:** 15 · **Total estimated time:** not reported (no per-step `estimatedTimeSeconds` was supplied)

The cap stopped the run at the moment she was heading to "Your data" to look for storage and disconnect answers. It was not a method failure. It is a signal that the path to those answers was long and unlabeled: she spent 15 steps without finding them. Her abandonment rule was "marks the task unresolved if there is no final confirmation". Step 14 gave no confirmation after Confirm, so she would treat the task as unresolved.

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Planning page (auto-opened after onboarding) with "One question" modal and notification alert | "Not now" on the modal to read the plan first | Medium | Yes |
| 2 | Same plan page with "Tangent in two minutes" tour (1 of 12) on top | "Not now" on the tour | Medium | Yes |
| 3 | Planning page, unobstructed (reply box, Confirm/Edit/Discard) | Click Settings in the sidebar before confirming | Medium | Yes |
| 4 | Settings > Account | Click Schedule (guessed from labels) | Medium | Yes |
| 5 | Settings > Schedule | Click Canvas "Connect" | Medium | Yes |
| 6 | "Connect Canvas" modal, step 1 of 3 | Click Next. The mouse click failed because the toast covered the button, so it was done by keyboard | Medium | Yes |
| 7 | Modal step 2 of 3, "Select Calendar Feed" | Focus Next and press Enter (the toast still covers it) | Medium | Yes |
| 8 | Modal step 3 of 3, "Copy your feed link" | Click Close (X) and note Canvas as BLOCKED | Medium | Yes |
| 9 | Settings > Schedule (modal closed) | Click Home in the sidebar | Medium | Yes |
| 10 | Home ("Still up, Priya?", "What do you want to add?" box) | Click into the box and type the essay-plan request | Medium | Yes |
| 11 | Home, inline question card (33%) | Tap "A challenge I faced" | Medium | Yes |
| 12 | Home, inline question card (67%) | Tap "Not started" | High | Yes |
| 13 | Plan view (15 steps, Round 1) | Scan the list and click Confirm | Medium | Yes |
| 14 | Home after Confirm | Click Settings in the sidebar | Low | Yes |
| 15 | Settings > Account | Declared: click "Your data" (not executed, step cap) | Medium | Yes |

## Per-screen detail

Per-step accumulated memory was not supplied. The "Accumulated memory" lines below are reconstructed from the run notes and each step's emotional arc.

### Step 1 — Planning page auto-opened after onboarding
- **Action & thinking:** I clicked "Not now" on the "One question" modal to read the plan first. Two popups and a plan I never asked for, all at once. The plan already seems to know my Saturday shift. It says my ED II deadline is "around Jan 1", but mine is Jan 5.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Wary. "Nothing is on your calendar until you confirm" calms me.
- **Accumulated memory:** This is the start. There is a drafted plan I did not request, and its deadline is wrong. Nothing is committed until I confirm, and that is the one reassuring line.

### Step 2 — Same plan page + "Tangent in two minutes" tour (1 of 12)
- **Action & thinking:** I clicked "Not now" on the tour. This is the third overlay, and I just want to read the plan.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Annoyed. "Three interruptions in a row."
- **Accumulated memory:** Same plan, wrong Jan 1 deadline, "nothing on your calendar until you confirm". Now I also know the first-run experience stacks popups on me, and my patience is dropping.

### Step 3 — Planning page unobstructed
- **Action & thinking:** I clicked Settings in the sidebar before confirming. I want Canvas, what is stored, and how to disconnect. I like that the evening steps miss my Sat 8 AM and Wed 4-9 PM, but the "Jan 1" deadline is wrong. "You told me you do your best work" and "Saturday has your 8 AM shift" read as quotes of things I never typed.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Uneasy.
- **Accumulated memory:** The plan respects my shifts, but it claims I said things I did not type. Before I trust it or confirm, I need to see what it stores and how to disconnect, so I am going to Settings.

### Step 4 — Settings > Account
- **Action & thinking:** I clicked Schedule. Account is about dark mode, and no label says Canvas, Integrations or Connections, so I am guessing from the section names (What Tangent knows, Account, Security, Schedule, Notifications, AI activity, Your data).
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Annoyed and wary.
- **Accumulated memory:** I am in Settings, but nothing here names Canvas. I am guessing that Schedule is where connections live. The plan is still unconfirmed and the deadline is still wrong.

### Step 5 — Settings > Schedule
- **Action & thinking:** I clicked Canvas "Connect" to look for an iCal option. Canvas shows "Not connected", there is an ".ics file" import, and "When you're already busy" shows my shifts correctly. The copy "The more Tangent can see, the less it has to ask and the better it plans" pushes me to share more.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Relieved that Canvas exists here. Wary of the "see more" push and the lack of storage or disconnect copy.
- **Accumulated memory:** Found Canvas under Schedule, and my shifts are correct. But the page nudges me to share more and still says nothing about storage or disconnecting.

### Step 6 — "Connect Canvas" modal, step 1 of 3
- **Action & thinking:** I clicked Next on "Open Calendar in Canvas" (Cancel / Next). It is a calendar feed, not a login grab, which is good. Nothing says what is stored. The mouse click failed because the desktop-notification toast fully covered Next (Playwright reported the toast intercepting pointer events 55 times). The action was done by keyboard (focus Next + Enter).
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Cautiously relieved that it is a feed and not a login. Annoyed that nothing says what is stored.
- **Accumulated memory:** The wizard asks for a feed, not my password, which eases the worry. Still no word on storage. A notification now blocks the button I need.

### Step 7 — Modal step 2 of 3, "Select Calendar Feed"
- **Action & thinking:** I focused Next with the keyboard and pressed Enter because the toast still covers it.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Annoyed that an alert popup covers the button in a step about my data.
- **Accumulated memory:** The steps are clear, but an alert popup keeps covering the controls during a step about my data. Still no storage, visibility or disconnect info after two steps.

### Step 8 — Modal step 3 of 3, "Copy your feed link"
- **Action & thinking:** I clicked Close (X) and noted Canvas as BLOCKED. The field says "Paste your calendar feed link here" and "Tangent will use it to bring assignments into your calendar", but no feed link is available in the interface. I would not press Connect anyway, because nothing says what is stored, who sees it or how to disconnect.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Mildly annoyed and stuck.
- **Accumulated memory:** Canvas is blocked: no feed link here. Even with one I would not connect, because all three steps are silent on storage, visibility and disconnecting. That is my trust condition, and it is not met.

### Step 9 — Settings > Schedule (modal closed)
- **Action & thinking:** I clicked Home in the sidebar. Settings has no link back to the drafted plan. An earlier evaluation of this step was discarded because the screen description wrongly listed a "Projects/Plans" link. The step was re-run with the real sidebar (Home, Calendar, Projects, Tangents, Work, School, All projects, Settings). "Your week" lists my shifts correctly, but Connect still comes with no storage copy.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Relieved that "Your week" lists my shifts. Wary of Connect with no storage copy.
- **Accumulated memory:** Canvas is blocked and the plan is still unconfirmed. Settings gives me no way back to it, so Home is my best guess. My shifts show up correctly, which helps.

### Step 10 — Home
- **Action & thinking:** I clicked into the "What do you want to add?" box and typed an essay-plan request (Common App essay and two supplementals due Jan 5), because it is the only visible way to ask the chat. Home says "Still up, Priya?" at 1:38 AM and "1 left today · next: Work at 4:00 PM". The drafted essay plan is not visible. My bakery shift shows as a Personal to-do "Work 4:00 PM". There is a "Use Canvas?" card and an unexplained "Auto" control. (The typed wording was the orchestrator's: "I need a plan for my Common App essay and two supplemental essays, all due Jan 5".)
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Uneasy and irritated, close to giving up.
- **Accumulated memory:** The drafted plan has vanished from Home. My job shows up as a personal to-do, and "Auto" is unexplained. I only kept going because the box is the one visible next action. I am close to giving up.

### Step 11 — Home, inline question card (33%)
- **Action & thinking:** I tapped "A challenge I faced" for "What's the prompt, roughly?" The card says "A few quick questions so this fits you", quotes my request, and shows "Tangent knows enough: 33%". Chips: About me, Why this school, A challenge I faced, Not picked yet. Controls: Type answer, Skip, Stop and plan. I had already typed the Jan 5 date.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Relieved that something answered. Wary that the question covers only one of three essays, and that 33% feels like grading.
- **Accumulated memory:** The box worked and the chat responded. But the question is about one essay out of three, and the percentage feels like a grade on me. Skip and Stop are visible, which helps.

### Step 12 — Home, inline question card (67%)
- **Action & thinking:** I tapped "Not started" on "How far along is it?" (Not started, Some notes, A rough draft, Almost done). After the tap a "Placing “…”…" loading line showed for about 6 seconds, then the plan.
- **Clarity:** High · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** A bit exposed, but the card does not judge, and Skip and Stop keep me in control.
- **Accumulated memory:** This question was easy to answer honestly, and I never felt trapped. The 6-second wait with no explanation was a small worry. I am getting closer to a real plan.

### Step 13 — Plan view
- **Action & thinking:** I scanned the list and clicked Confirm despite the Canvas-and-Gmail line.
  - **Plan content:** "I have enough to start round 1. Add anything else anytime." The plan is "Common App + 2 Supplementals — Round 1: what you'll get this week", with 15 steps all at 7:00 PM, running Thu Nov 19 to Sat Jan 2.
  - **What it used:** "What I used about you" lists busy Work Wed 4-9 PM and weekends 8 AM-2 PM, School Mon-Fri 8-3, ~2 h on a school night, ~45 min focus, best work in the evening, and that I lock in once I know the first step.
  - **What I checked:** No step falls on Wednesday. The only weekend step is Sat Jan 2 at 7 PM, after my shift. Everything ends before Jan 5. I am irritated that two steps share the Nov 19 slot.
  - **What I objected to:** "What I assumed: Based on what Tangent read in Canvas and Gmail" is false, because neither is connected.
  - **Controls:** "Nothing is on your calendar until you confirm. When you finish these, tell me how they went and I'll plan round 2." Confirm / Edit / Discard; Reply to Tangent.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Relieved but uneasy about what else it has.
- **Accumulated memory:** The plan finally respects my shifts and my deadline. But it claims to have read Canvas and Gmail, which I never connected, so I do not know what else it "knows". I confirmed anyway, because the plan itself is good.

### Step 14 — Home after Confirm
- **Action & thinking:** I clicked Settings in the sidebar for the storage and disconnect answers. After Confirm there is no "saved" message and no link to the plan. The essays are not on today's list. "COMING UP 4" is collapsed (it was 1). The Canvas card and the notification box are still there.
- **Clarity:** Low · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Uneasy and deflated. "I pressed Confirm and got silence."
- **Accumulated memory:** I confirmed the plan and got nothing back: no message, no link, no essays in view. I cannot tell if it worked. I still do not know what is stored or how to disconnect, so I go back to Settings.

### Step 15 — Settings > Account
- **Action & thinking:** I see my name, a masked email, what Tangent helps with, Dark mode and Sign out. There is no storage or disconnect copy here. I would click "Your data" next, but the step cap stopped that action. Not abandoned.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** n/a
- **Emotional state:** Still uneasy. The same question has gone unanswered for 15 steps.
- **Accumulated memory:** The plan is confirmed, but with no feedback. Canvas is blocked. The question that mattered most to me (what is stored, who sees it, how to disconnect) is still unanswered. "Your data" is my last guess.

## Synthesis
- **Highest friction point:** Step 8 (Connect Canvas, step 3 of 3). There is no feed link available in the interface, so the main connection task is blocked. Steps 6-7 add friction: a notification toast covered Next, so the mouse click failed and the steps only advanced by keyboard. Steps 3-5 add more: Settings has no label that says Canvas or Connections, and it is found only under Schedule.
- **Highest emotional friction point:** Step 14 (Home after Confirm). The one action she took to commit produced no confirmation, no link and no visible essays. This is her stated abandonment condition. Step 2 is a secondary peak: three stacked first-run overlays.
- **Final decision:** Continues. She did not abandon. The run stopped at the step cap on step 15, heading to "Your data". She would treat the task as unresolved because there was no confirmation after Confirm and the storage and disconnect questions were never answered.
- **Emotional summary:** I started off wary: three popups on top of a plan I never asked for, with the wrong deadline. Then I liked that the plan avoided my bakery shifts. I went to Settings to find where my data goes, and Canvas was hidden under Schedule. The wizard looked safe at first (a feed, not a login), but an alert popup kept covering the button, and no step told me what is stored, who sees it or how to disconnect. I could not find a feed link anyway, so I gave up on Canvas. On Home my job looked like a to-do and my plan had disappeared. The questions about my essay were gentle and let me say "Not started" without judgment. The plan was good, but it claimed it had read my Canvas and Gmail when I never connected them. I confirmed it anyway. Then there was silence. I still do not know what Tangent keeps about me or how to remove it.
- **Detected risks:**
  - Overlays stacked at first run (One question modal, notification alert, 12-step tour) may cause new users to dismiss everything and miss real prompts.
  - The false line "Based on what Tangent read in Canvas and Gmail" can make a privacy-conscious student believe her mail is being read, or lose trust in the whole plan. It matches her wrong assumption that Canvas also reads her email.
  - The plan wrote "you told me…" and "Saturday has your 8 AM shift" as quotes of things she never typed, which reads as surveillance.
  - The plan invented a Jan 1 deadline because no deadline was captured in onboarding. For an ED applicant, a wrong deadline is high stakes.
  - The silent Confirm means users may re-confirm, doubt the plan, or lose track of it.
  - No storage, visibility or disconnect copy appears anywhere in the connection flow. This blocks the connection for trust-driven users.
  - A toast covering the wizard's Next button can block mouse and touch users entirely.
  - The "see more, plan better" copy and the "33%" meter can feel like pressure or grading to a perfectionist under stress.
  - The bakery shift appears on Home as a Personal to-do "Work 4:00 PM", and there is no explanation of "Auto".
- **Structural insight:** The planner's logic is strong: it respects shifts, ends before the deadline and asks light questions. The weakness is trust and follow-through around it. Connections are hard to find and silent about data handling. The commitment action gives no feedback. Overlays compete for the same screen. The product explains what it will do for her but never what it keeps, so the first-run experience and the trust story both fail at the moments she checks them.
- **Fix this first:** Add a visible confirmation to Confirm. After she taps it, show a clear "Plan saved" state that lists the number of steps added, the first step's date, and a link to view it (for example "View in Calendar"). This is the highest-impact fix because it closes the main loop (capture, plan, done) and it is her explicit abandonment condition.

## Potential improvements
| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Step 14, Home after Confirm | Show a "Plan saved" banner with the step count, the first step's date and a "View plan" link. Put the first essay step in today's or tomorrow's list. | She pressed Confirm and got silence; without feedback she cannot tell if it worked. |
| 2 | Steps 6-8, Connect Canvas wizard | Add one line to the wizard (for example under step 1): what is stored (feed events only), who sees it (only her), and "Disconnect any time in Settings > Schedule; imported items can be removed". Repeat it next to Connect. | It meets her explicit requirement and removes her main reason not to press Connect. |
| 3 | Step 13, Plan view "What I assumed" | Show the "Based on what Tangent read in Canvas and Gmail" line only when those sources are actually connected; otherwise say "Based on what you told me". Replace "you told me…" quotes with the true source (onboarding answers). | It stops a false claim of data access and rebuilds trust in the plan. |
| 4 | Steps 1-2, first run | Show a single overlay at a time and queue the rest. Show the plan first, the tour only when she asks, and the notification prompt later. | Three stacked popups were her first impression and the main early frustration. |
| 5 | Steps 6-7, wizard and toast | Position or defer the desktop-notification toast so it never covers modal buttons. Also add a "Connections" label in Settings that points to Canvas. | A covered Next button blocked a mouse click, and without the label Canvas took four steps to find. |

## Tangent-specific
- **Context:** Mostly yes. The plan used her shifts correctly (Wed 4-9 PM, weekends 8 AM-2 PM, School Mon-Fri 8-3), her evening focus and her ~45 min sessions, and it avoided Wednesdays. It also used her Jan 5 date from the typed request, though the early draft said Jan 1 because no deadline was captured in onboarding. The chat asked about the prompt even though she had already typed the Jan 5 date. It asked about the prompt for only one of three essays. It quoted things she never typed ("you told me you do your best work"). It claimed it had read Canvas and Gmail when neither is connected. Home showed her shift as a Personal to-do rather than as a shift.
- **Different from generic apps:** Better: it turns a vague request into a six-week plan that fits her work shifts, asks light questions with Skip and Stop, and says "Nothing is on your calendar until you confirm". Worse: a generic to-do app would not stack three first-run overlays, and would not claim to have read her Gmail. A generic app would also show a saved task right after she adds it. The "Tangent knows enough: 33%" meter and the "see more, plan better" copy add pressure that a plain list would not. The plan's "this week" title covers six weeks, and two steps share the Nov 19 7 PM slot.
- **Follow-through:** Weak. Confirm led nowhere visible: no "saved" message, no link to the plan, essays absent from today's list, "COMING UP" collapsed. The drafted plan could not be reached from Settings. The plan says "tell me how they went and I'll plan round 2", but nothing on the post-confirm screen shows how to do that.
- **Trust:** Not met. Across the Settings pages she visited (Account, Schedule) and all three Canvas wizard steps, nothing said what is stored, who sees it or how to disconnect. The one data-related line she saw was the nudge "The more Tangent can see, the less it has to ask and the better it plans". "Your data" was her last unexplored place when the cap hit. Canvas was blocked because no feed link was available, and she would not have connected without the storage and disconnect copy anyway.
