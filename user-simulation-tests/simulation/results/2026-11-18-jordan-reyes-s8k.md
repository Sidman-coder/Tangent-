# Simulation report — Jordan Reyes, End user (Varsity soccer player, 10th grade)

**Task:** Get the club plan around soccer practice, finish two steps, and do the end-of-round review.
**Result:** Abandoned (stalled, not an explicit abandonment). The run stopped at step 8 of 15, so this is not the step cap. The simulator could name no element to tap, because no second club step exists anywhere in the app. Partly reached: plan confirmed, first step marked done, check-in skipped. "Finish two steps" and "end-of-round review" were not reachable.
**Steps:** 8 · **Total estimated time:** 90 s

> Note on the run (orchestrator caveats): the test account's data was reset and re-onboarded before this run. The app was a production build at 1440x900, not phone width. The real clock was 1:16 AM, so the "Still up, Jordan?" greeting depends on time of day. The plan page closed itself before step 4's action ("Back to Today") could be executed, so the app was already on Home. The same thing happened in a previous run.
>
> Orchestrator correction on the "mislabelled Saturday block" finding: during onboarding the Saturday 08:00-12:00 slot was entered as a second *practice* time, because that screen only asks for practice. Tangent therefore labelled it "Practice" as entered. The real gap is that onboarding has no way to say "game", and that Tangent never states which blocks it keeps free. The row label itself is not a bug.

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Chat opened by Tangent after onboarding, with two overlays (notifications alert, "One question" modal about sport and season) | Not now on the "One question" modal and Not now on the notification prompt | Low | Yes |
| 2 | Same chat, overlays gone, question about an advisor | Tap "skip and plan it anyway" | High | Yes |
| 3 | "Planning with Tangent" plan page (Round 1, 1 step) | Confirm | Medium | Yes |
| 4 | Plan page with "Added 1 step to your calendar." + Undo | Back to Today (page had already closed itself) | Medium | Yes |
| 5 | Home "Still up, Jordan?" (Afternoon, Evening, Coming up 3 collapsed, Canvas card) | Done on the pitch step | Medium | Yes |
| 6 | "How did it go?" dialog | Skip | Medium | Yes |
| 7 | Home again, Evening 0 items, "1 left today" | Open "Coming up 3" | Medium | Yes |
| 8 | Coming up expanded (Practice Thu, Fri, Sat 8:00 AM) | None executable (looks for another way to find the second step) | Medium | Yes |

## Per-screen detail

### Step 1 — Talk with Tangent chat (opened by Tangent) with two overlays
- **Action & thinking:** I see the chat Tangent opened ("Break down plan: Starting an Environmental Club before January...") with the question about an advisor. On top there's an "Enable desktop notifications" alert and a "One question" modal asking which sport I play and when my season is. I already told it "A sport" during onboarding, so I tap Not now on the modal and then Not now on the notification prompt. I want to get to the plan, not answer more questions.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Annoyed. Two overlays come before anything useful, and the sport question repeats something I already answered.
- **Accumulated memory:** I just started, and the first thing I got was two pop-ups. I want a plan that avoids practice (Mon-Fri 3:30-5:30) and Saturday mornings, and it's asking about my sport again instead of using what it should know.

### Step 2 — Same chat, overlays gone
- **Action & thinking:** Now I can read the chat. "Skip" is right inside the question, so I tap "skip and plan it anyway". I don't have a teacher in mind and I won't answer optional questions. My worry is that I don't see any sign that Tangent knows practice is 3:30-5:30.
- **Clarity:** High · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Slightly relieved that skipping is easy and obvious, but still uneasy about practice times.
- **Accumulated memory:** The plan must stay out of 3:30-5:30 on weekdays and Saturday mornings. A single step in practice time and I'm done. The overlays were annoying, but the skip was clear and I went straight to planning.

### Step 3 — "Planning with Tangent" plan page
- **Action & thinking:** I look at the time first. Round 1 has ONE step, "Draft Environmental Club pitch paragraph", Wed Nov 18 at 7:00 PM, with a Why and an Outcome (a one-paragraph pitch and 3 possible advisors). 7 PM is after practice, so it's safe. Then there's a wall of text. "What I used about you" has only "You often don't know where to start", which feels preachy. "What I assumed" has 7 lines, including "Spread from today to today", which makes no sense, and an advisor "picked from science or other teachers you already have", though I never said that. Nothing mentions Saturday mornings. Only one step is odd, but the time is safe, so I tap Confirm.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** Relieved about the 7 PM slot, annoyed by the wall of text, the "today to today" line, the preachy "don't know where to start" line, and having only one step.
- **Accumulated memory:** Trust earned on the key point: the step avoids practice. Still open: nothing says Saturday mornings are protected, and the plan is one step when I need an advisor, signatures and a room. I confirmed because the time is right, not because I understood the page.

### Step 4 — Plan page after confirming
- **Action & thinking:** The page says "Added 1 step to your calendar." with an Undo, but the old text "Nothing is on your calendar until you confirm." is still there. I want a next place to go, so I choose Back to Today. In fact the page had already closed itself and the app was on Home.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 10s
- **Emotional state:** Relieved that confirmation is clear, annoyed that it is a single step with nowhere obvious to go next. The text feels like homework about homework.
- **Accumulated memory:** The plan is confirmed and the 7 PM step is on my calendar. The screen contradicts itself (added vs. "nothing until you confirm"). I'm waiting to see more steps on Today.

### Step 5 — Home ("Still up, Jordan?")
- **Action & thinking:** It's 1:16 AM and the greeting says "Still up, Jordan?". Home says "2 left today · next: Practice at 3:30 PM". Afternoon has Practice at 3:30 PM under "Personal" with a Done circle. Evening has the pitch step at 7:00 PM under "Environmental Club Launch Pitch", with Done / Not today / Too big. Coming up 3 is collapsed and there's a "Use Canvas?" card. I like the 7 PM time and that Practice was already known. I'm annoyed that there's only one club step, that Coming up is collapsed, that Canvas is noise, and that Saturday isn't mentioned. I tap Done on the pitch step to move things along.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Mixed: pleased that Tangent knew about practice, annoyed by the clutter and the lack of a second step.
- **Accumulated memory:** Tangent held my practice time, which is a good sign. But I only have one club step and I don't see what comes after it. I'll mark this one done and expect the next step to appear.

### Step 6 — "How did it go?" dialog
- **Action & thinking:** I tapped Done and got a questionnaire: Nailed it / Okay / Struggled, Less time / About right / More time, an optional text box and two Skip buttons. I didn't ask for this. I tap Skip.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 6s
- **Emotional state:** Annoyed: "I tapped Done and got a questionnaire."
- **Accumulated memory:** Marking Done costs an extra screen I don't want. I skipped it, as I skip every optional question. I still expect the next club step to show up on Today.

### Step 7 — Home after skipping
- **Action & thinking:** Evening now has 0 items. Only Practice is visible, as "1 left today", and Coming up 3 is still collapsed. The club step is gone and nothing replaced it. Practice is shown as a to-do, which is odd. I open "Coming up 3" to look for my second step.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 10s
- **Emotional state:** Mildly annoyed that the club step vanished and Practice sits there as a task.
- **Accumulated memory:** I finished step one and nothing new appeared. My only lead for step two is Coming up. If it isn't there, I'm stuck.

### Step 8 — Coming up (expanded)
- **Action & thinking:** Coming up shows Thu Nov 19 Practice 3:30 PM, Fri Nov 20 Practice 3:30 PM, and Sat Nov 21 Practice 8:00 AM. No club step. The Saturday 8 AM row is my game time, not practice. I look around for another way to find my second club step, but I can't name anything to tap.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Annoyed. The Saturday block is labelled "Practice" and there is no second step.
- **Accumulated memory:** Now I opened Coming up looking for my second step and it's only Practice, Thursday, Friday and Saturday 8 AM. That Saturday morning item bugs me, because Saturday mornings are games. I still don't see where my next club step is. If it isn't on the Today screen soon, I'm done with this.

## Synthesis
- **Highest friction point:** Step 7-8 (Home after Done, then Coming up). After the first step was finished, no next club step appeared. The task's "finish two steps" and "end-of-round review" were unreachable, and the simulator had nothing to tap. Round 1 held only one step, so round 2 never started.
- **Highest emotional friction point:** Step 1 for the first spike (two stacked overlays plus a repeated sport question, with nothing useful visible). Step 8 for the final one (the Saturday 8:00 AM block labelled "Practice", which collides with the game time Jordan guards, and no second step). Step 8 is where the run effectively ends.
- **Final decision:** Stalls at step 8. There is no explicit abandonment, but the memory says "If it isn't on the Today screen soon, I'm done with this", and by the profile's rules a task with no visible next action and no final confirmation is marked unresolved.
- **Emotional summary:** I started off annoyed: two pop-ups before I could even read the chat, and it asked about my sport again. Then it got better. Skipping the advisor question was easy, and the plan put my club work at 7 PM, after practice, so I relaxed a little. The plan page was a wall of text and "Spread from today to today" looked like a bug, but the time was safe, so I confirmed. I marked the step done and got a questionnaire I skipped. After that, nothing. No second step, no next place to go, only Practice listed like a chore. And on Saturday at 8 AM, a block called "Practice" when that's my game. I didn't see what comes next, and I'd have closed the app.
- **Detected risks:**
  - Users who are decisive and impatient drop the app when the next action is not visible after finishing a step.
  - A one-step "this week" plan feels like an incomplete plan for a goal that needs a sponsor, signatures and a room.
  - A Saturday game block shown as "Practice" undermines trust in how well the schedule is understood (onboarding only collects practice times).
  - Stacked prompts on the first screen delay the first useful content.
  - Contradictory or buggy-looking text on the plan page (stale "Nothing is on your calendar until you confirm.", "Spread from today to today") weakens trust.
  - Users who always skip the check-in give the loop no input, so no follow-up appears.
  - Invented assumptions ("teachers you already have") can mislead.
- **Structural insight:** The trust gate for this profile is time safety, and Tangent passed it at step 3. But the flow ends at "added to calendar". There is no visible path from "one step done" to "what's next", so the follow-through that makes capture → plan → done valuable never starts. After Done the app must always show the next step or say what happens next.
- **Fix this first:** After a step is marked Done (and also when the check-in is skipped), immediately show the next step of the plan on Today, or a one-line message such as "Next: Ask a teacher to be the club advisor, Thu 7:00 PM", so the user always sees the next action. For this plan, Round 1 should contain more than one step (advisor, signatures, room), all placed outside practice and game times.

## Potential improvements
| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Home, step 7 (after Done on the pitch step, Evening 0 items) | Replace the empty Evening with the next club step (e.g., "Next: pick an advisor, Thu 7:00 PM"), or a line saying when the next step will appear. | The run died here: a finished step left no visible next action. |
| 2 | Plan page, step 3 (Round 1, one step) | Generate 2-3 steps for the week covering faculty sponsor, signatures and room, each at a time outside Mon-Fri 3:30-5:30 and Saturday mornings. | One step does not match a goal with three requirements and a January deadline. |
| 3 | Onboarding practice screen and Coming up, step 8 (Sat Nov 21 "Practice 8:00 AM") | Let the user name a time as "Game" (or their own term), show a small "kept free" marker on protected blocks, and remove the Done circle from practice rows. | A game shown as "Practice" breaks the trust the 7 PM slot had earned, and a Done circle turns practice into a chore. |
| 4 | First screen, step 1 (notification alert + "One question" modal) | Do not show the sport/season modal when sport was already chosen in onboarding, and delay the notification prompt until after the first plan is confirmed. | Stacked prompts before any content cost an impatient user trust at the start. |
| 5 | Plan page, steps 3-4 ("What I used / assumed", stale confirmation text) | Cut "What I assumed" to the 2-3 lines that change the plan, delete "Spread from today to today", replace the invented "teachers you already have" line, add "Kept free: Mon-Fri 3:30-5:30, Sat mornings" under "What I used", and hide "Nothing is on your calendar until you confirm." once confirmed. | Visible protection of practice and games is what this profile looks for, and the stale or buggy-looking text undermines it. |

## Tangent-specific section

### Context
- The plan used the 7 PM slot, "after practice", the 2-hour school night and 45-minute answers. It did not show practice or Saturday games in "What I used about you", which had only one line: "You often don't know where to start".
- The Coming-up list proves Tangent held Mon-Fri 3:30 PM and Sat 8:00 AM. It labelled the Saturday block "Practice" (as entered) and did not say it was protected.
- One invented assumption: "Advisor picked from ... teachers you already have", although no teachers were collected.

### Different from generic apps
- Why / Outcome for each step, "What I used / assumed" and "Nothing is on your calendar until you confirm" make the plan transparent.
- The question could be skipped: "skip and plan it anyway" went straight to a plan, unlike a previous persona's "Stop and plan".
- There is a per-step "How did it go?" check-in.

### Follow-through
- The "this week" plan was one step, with no steps for faculty sponsor, 5 signatures, or room.
- After Done, nothing new appeared, so round 2 never started and the end-of-round review was unreachable.
- The check-in was skipped, so the loop had no input.
- Practice is shown as a to-do with a Done circle.

### Trust
- Practice times were respected (trust earned at step 3), but this is unproven for Saturday mornings.
- "Nothing is on your calendar until you confirm." stayed on screen after confirming.
- "Spread from today to today" reads like a bug.
- The first screen stacked prompts (notifications, sport question), and "Still up, Jordan?" appeared at 1:16 AM.

Screenshots (in docs/overnight/screens/before/): sim-jordan-step1-first-screen.png, sim-jordan-step3-plan.png, sim-jordan-step4-confirmed.png, sim-jordan-step5-home-after-confirm.png, sim-jordan-step6-after-done.png, sim-jordan-step7-after-skip.png, sim-jordan-step8-coming-up.png.
