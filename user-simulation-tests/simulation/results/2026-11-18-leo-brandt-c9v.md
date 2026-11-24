> **Orchestrator notes (added by the run controller, not by the synthesizer)**
> - Evaluator results for steps 1-12 were recorded step by step in `docs/overnight/sim-notes-leo.md`. Every screen description sent to the simulator was read from the page DOM, not written from memory.
> - Step 1: the first "Not now" was a mouse click; the second (the desktop-notifications alert) was done by keyboard because the tour blocker (`.tour-blocker`) intercepted pointer events. Same declared action, different input method.
> - Step 7: the simulator declared a look, not a click, so nothing was clicked. The run controller read the Sunday chips from the DOM ("Anytime") and passed that on.
> - Step 9: "typed 18:00" is the exact value the simulator declared ("18:00"); Playwright filled it as a time input.
> - Step 12: the run stopped because the simulator set `abandoned = true`. The step cap (15) was not reached.
> - The "after the stop" facts (Home read-out, Calendar page, sidebar) were read by the run controller after the simulator had stopped. They are labelled as such in the report and were never shown to the simulator. Home was read at one moment only ("COMING UP 0"); the Calendar page said 6 things in the next 7 days, so Home not showing them may be a display lag or a real gap. Not tested further.
> - Screenshots: `docs/overnight/screens/before/sim-leo-*.png`. The Settings > Account page was never opened for this persona.
> - Total estimated time (sum of the 12 step estimates): 20+8+8+6+8+6+25+25+25+20+20+20 = 191 s.

# Simulation report: Leo Brandt, 11th grader with a YouTube side project (End user)

**Task:** Create a project for his channel with a weekly Sunday upload, ask the chat for a growth plan, then plan it around homework.
**Result:** Abandoned. Leo marked the task unresolved at step 12 because nothing confirmed that a project exists. The step cap (15) was not hit. The "ask the chat for a growth plan" and "plan around homework" parts were never reached.
**Steps:** 12 · **Total estimated time:** 191 s

Setup before step 1 (orchestrator facts, not simulator steps):
- The test account was reset and Leo went through the 9-step setup dialog using only answers from his profile.
- The setup has no step for a creative side project or a weekly recurring commitment.
- After "Open Tangent", Home auto-opened a drafted, unconfirmed plan titled with his whole "bugging" sentence.
- The First name field was still pre-filled with the previous persona's name after the data reset.

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Home with drafted plan behind two stacked popups | Clicked "Not now" on "One question", then "Not now" on the notifications alert (by keyboard, because a tour overlay blocked the pointer) | Low | Yes |
| 2 | Tour card 1 of 12, "Tangent in two minutes" | Clicked Start | High | Yes |
| 3 | Tour card 2, "Add anything, typed or spoken" | Clicked Next | Medium | Yes |
| 4 | Tour card 3, "Say it from anywhere" | Clicked Next | Medium | Yes |
| 5 | Tour card 4, "Today, in three parts" (page behind still the plan panel) | Clicked Next | Medium | Yes |
| 6 | Tour card 5, "Choose where it goes" (no visible Skip/Close) | Pressed Esc to leave the tour | Low | Yes |
| 7 | Plan panel after Esc (brief and calendar side by side) | Looked at the calendar and hesitated on Confirm (no click) | Medium | Yes |
| 8 | Plan panel | Clicked Edit to put a 6pm time on the Sunday upload | Medium | Yes |
| 9 | Plan panel in edit mode | Typed 18:00 in the Time field and watched the Sunday chips | Medium | Yes |
| 10 | Edit mode after the time was set | Clicked "Done editing" | Medium | Yes |
| 11 | Plan panel, edit closed | Clicked Confirm | Medium | Yes |
| 12 | Plan panel after Confirm ("Added 6 steps to your calendar" + Undo) | Abandoned and marked the task unresolved | Low | Yes |

## Per-screen detail

### Step 1 — Home with a drafted plan behind two stacked popups
- **Action & thinking:** I landed on Home with a drafted plan that is ONE item, dated Wed Nov 18. Its title is my whole onboarding sentence. It says "No time given, so no set time" and "Starts today and repeats until you remove it". The calendar marks Sun Nov 22 and 29 as "Recurring commitment". The sidebar has Home, Calendar, Projects, Tangents and a project called "School" (No steps yet). On top sit two popups: "One question: You said you put things off. What kind of thing do you put off most?" and a desktop-notifications alert. I clicked "Not now" on the question because it is about school, not my channel. Then a third overlay, a 12-step tour, appeared and its blocker intercepted the mouse, so I dismissed the alert's "Not now" by keyboard.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** Thrown, curious but wary. The plan names chem and algebra, which is a bit of my own words, but the question is about school, not the channel.
- **Accumulated memory:** I just arrived. There's a plan I didn't ask for, built from my setup answers. It looks like one thin item. The question popup is about school, not my channel.

### Step 2 — Tour card 1 of 12, "Tangent in two minutes"
- **Action & thinking:** A third popup in a row, with Not now and Start. The "two minutes" line is short enough, so I clicked Start instead of skipping.
- **Clarity:** High · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Mildly annoyed at the third popup in a row. The "two minutes" promise keeps me in.
- **Accumulated memory:** Same as before, plus three popups before I touched anything. The plan is one thin item and I don't know whether it's a project or a one-off. I'm giving the tour two minutes.

### Step 3 — Tour card 2, "Add anything, typed or spoken"
- **Action & thinking:** The card says Tangent works out whether something is a task or a project, asks a question or two, then puts it on the calendar or in the project, with Undo. Buttons are Back, Try it now and Next. This is relevant to what I want, but I'd rather do it than read about it. I clicked Next.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Mildly interested, getting impatient. The tour is blocking the plan.
- **Accumulated memory:** I now know the app claims to sort tasks from projects by itself. That's promising for my channel, but I haven't seen it happen. The tour is still in the way of the plan.

### Step 4 — Tour card 3, "Say it from anywhere"
- **Action & thinking:** The card mentions a mic and Cmd+K. Cmd+K is a small nice touch, like Notion. Nothing I need right now, so I clicked Next.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 6s
- **Emotional state:** Mildly impatient. The Cmd+K shortcut is a small positive.
- **Accumulated memory:** Cmd+K is a nice Notion-like touch. Otherwise the tour is still between me and the plan, and I'm getting impatient.

### Step 5 — Tour card 4, "Today, in three parts"
- **Action & thinking:** The card describes Must do, Today's plan and Coming up. But the page behind it was still the plan panel, not Today, so I couldn't see what it described. I clicked Next anyway.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Impatient. It "feels like Notion with a lecture on top".
- **Accumulated memory:** The tour describes things that aren't on screen, so it's telling me about a screen I can't see. I still haven't done anything for my channel, and the tour is turning into a lecture.

### Step 6 — Tour card 5, "Choose where it goes"
- **Action & thinking:** The card describes an Auto picker and a quiet line of skipped questions. It has Back and Next but no visible Skip or Close. Behind it was still the plan panel, so what it described wasn't on screen. I pressed Esc to get out.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 6s
- **Emotional state:** Annoyed. It's "homework before I'm allowed to touch the thing I came for".
- **Accumulated memory:** Five cards in, none of it was demonstrated on screen, and there was no visible exit. I had to guess Esc. I feel I'm doing homework before getting to what I came for.

### Step 7 — Plan panel after Esc
- **Action & thinking:** I now see the brief and the calendar side by side (no tabs on desktop). I looked at the calendar where Sun Nov 22 and 29 are marked. I hesitated on Confirm because I can't tell whether it makes a project or a repeating reminder. There's no 6pm, and I don't know whether I can edit the goal later. My own words are pasted back as one line, which feels generic. I didn't click anything.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** Relieved the tour is gone, a bit let down. One line of my own words pasted back feels generic.
- **Accumulated memory:** The tour is gone, and now I see the plan properly. It's one item that repeats on Sundays, with no 6pm and no mention of a project. Orchestrator read, not seen by Leo: the Sunday chips read "Anytime". I'm not sure what Confirm does, and I don't know whether the goal can be edited later.

### Step 8 — Plan panel
- **Action & thinking:** I want a 6pm time on the Sunday upload, so I clicked Edit. I'm staying because the buttons are clear and nothing is saved until Confirm.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** Annoyed and let down, but staying. The buttons are clear and nothing is saved until Confirm.
- **Accumulated memory:** I'm trying to fix the missing 6pm myself. Confirm and Edit are clear and nothing is saved until Confirm, which feels safe. I'm still unsure whether this is a project.

### Step 9 — Plan panel in edit mode
- **Action & thinking:** Edit mode shows a date field (Wed 2026-11-18), an empty time field, a Remove button, and Confirm / Done editing / Discard. The title is plain text and can't be edited. I typed 18:00 in the Time field and watched the Sunday chips.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** Relieved to see a time box, then annoyed that the title is locked and the date is a Wednesday. It's "half-editable, like a Notion page with locked cells".
- **Accumulated memory:** I can set a time, but I can't rename the plan, and the date is a Wednesday even though my upload is on Sundays. It feels half-editable, like a Notion page with locked cells.

### Step 10 — Edit mode after the time was set
- **Action & thinking:** The Sunday chips changed from "Anytime" to "6:00 PM", so the edit worked. But "What I assumed" still says "No time given, so no set time". I clicked Done editing.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** Small relief, then irritation at the stale line. It's "half-wired", and I trust Confirm less.
- **Accumulated memory:** The time worked on the Sunday chips, which is good, but the assumptions text didn't update. It feels half-wired, so I trust Confirm less.

### Step 11 — Plan panel, edit closed
- **Action & thinking:** The item now reads "Wed, Nov 18 · 6:00 PM". The stale "No time given" line is still there and the title is unchanged. Confirm is the only visible next step, so I clicked it. If nothing tells me what happened, I'll mark this unresolved.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** Mildly annoyed, half-wired. The Sunday chips keep me from bailing.
- **Accumulated memory:** The screen is inconsistent, with a 6pm item next to a "No time given" line. The Sunday chips keep me going. I'm clicking Confirm because it's the only visible next step. If nothing tells me what happened, I'll call it unresolved.

### Step 12 — Plan panel after Confirm
- **Action & thinking:** The Confirm / Edit / Discard row was replaced by "Added 6 steps to your calendar." plus "Undo", so this time there was feedback. But the panel still lists ONE round-1 item (6 vs 1 mismatch). The stale "Nothing is on your calendar until you confirm" and "No time given" lines remain. The sidebar shows no channel project, only "School". I abandoned and marked the task unresolved.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 20s · **Abandoned:** Yes
- **Emotional state:** Deflated and annoyed. "In Notion I'd at least have a page."
- **Accumulated memory:** I confirmed and got "Added 6 steps", but the panel still shows one item, the old lines contradict it, and there is no channel project in the sidebar. I never found out whether the AI can change my goal later or why the plan is specific to me. Unresolved.

## Synthesis
- **Highest friction point:** Step 12, the plan panel after Confirm. The task asked for a project, but the sidebar shows none (only "School"). The panel says "Added 6 steps" while still listing one item and keeping "Nothing is on your calendar until you confirm". The success line therefore doesn't match what Leo sees, and he never gets confirmation that a project exists. Orchestrator facts after the stop (not seen by Leo):
  - The panel closed by itself shortly after Confirm.
  - Home then read "Nothing planned today", "You're all caught up" and "COMING UP 0".
  - The Calendar page said "6 things to do in the next 7 days", so the steps exist.
  - Confirm created no channel project.

  The "Added 6 steps" line was on screen only briefly.
- **Highest emotional friction point:** Steps 1 to 6, the stacked popups plus the 12-step tour. Three overlays hit Leo before he could do anything, the tour blocked pointer input, cards 4 and 5 described elements that weren't on screen, and there was no visible Skip or Close. This ended in "homework before I'm allowed to touch the thing I came for". The final low point is step 12 (deflated), but the build-up of irritation starts here.
- **Final decision:** Abandons at step 12, after Confirm, because there is no confirmation that a project exists. This follows his rule "marks the task unresolved if there is no final confirmation".
- **Emotional summary:** I started out curious but wary: a plan I never asked for, with my chem and algebra grades named in it. Then came popup after popup and a tour about screens I couldn't even see, and I only got out by pressing Esc. Once I was in front of the plan I tried to make it mine. I got a 6pm onto the Sunday chips, which felt good for a second, then I noticed the text still said "No time given". It felt half-wired. The title was locked and the date was a Wednesday. When I hit Confirm there was finally a message, "Added 6 steps", but the panel still showed one item and the sidebar had no channel project. I never found out whether the AI can change my goal later or why the plan is specific to me. In Notion I'd at least have a page.
- **Detected risks:**
  - Users who go through onboarding with a creative or side-project goal get a generic, school-centred draft plan.
  - Stacked popups and an unskippable-looking tour make a first session feel like a lecture. Tour copy that describes things not on screen reads as broken.
  - The draft shows stale text after edits ("No time given") and after Confirm ("Nothing is on your calendar until you confirm"). This erodes trust in Confirm.
  - The success message is brief and the panel closes by itself, so a user can miss it.
  - Locked title and a start date that doesn't match the recurring day make the plan feel rigid. That is a bad fit for a burst worker who gets stuck on rigid plans.
  - A user can't tell whether a recurring plan is a project or a reminder. Confirm can end with no project in the sidebar.
- **Structural insight:** The flow is plan-first, not project-first. The setup collects a goal but has no way to say "this is a side project with a weekly commitment", so the result is a one-item draft titled with the user's sentence. After Confirm, the panel does not reflect what was created (6 steps, no project), and it does not tell the user where things went. The design needs a visible, durable end state (a named project or page) that matches what the user typed.
- **Fix this first:** After Confirm, keep the panel open (or open the destination) and show a persistent result. It should say "Added 6 steps to [name]" with a link to the calendar or project. It should refresh the panel's own text, so the item list shows 6 steps and the "Nothing is on your calendar until you confirm" and "No time given" lines are gone. If a project was meant to be created, show it in the sidebar.

## Tangent-specific

**Context** (does Tangent use what it knows about him)
- Partly. The draft plan quoted his own "bugging" sentence as its title and named chem and algebra. It also marked Sun Nov 22 and 29 as "Recurring commitment", so the Sunday cadence was picked up.
- But the plan had no time (Leo's 6pm had to be added by hand), and the start date was a Wednesday. The question popup asked about school procrastination, not his channel.
- Nothing visible showed that the late-night preference, the 45-minute focus or the 1,000-subscriber goal were used. Leo felt his own words were just "pasted back" and generic.

**Different from generic apps (Todoist / Notion / ChatGPT)**
- Leo compared everything to Notion. Cmd+K was a small plus, and the tour felt like "Notion with a lecture on top". Edit mode felt like "a Notion page with locked cells". At the end, "In Notion I'd at least have a page."
- Tangent's claim (tour card 2) that it works out task vs project, asks a question or two and places it with Undo was never demonstrated on this run. He didn't use "Try it now" or the chat.
- Nothing in this run showed an advantage over ChatGPT or Todoist. The run never reached the chat growth plan.

**Follow-through** (check-ins, round review, daily bubble)
- Not reached. Leo never got past the first Confirm, so no check-ins, round review or daily bubble were seen, and planning around homework never happened.
- Only the "One question" popup (about procrastination) was seen, and he dismissed it with "Not now".
- Orchestrator fact: after Confirm, Home read "Nothing planned today", "You're all caught up" and "COMING UP 0", and showed a "Use Canvas?" card. The 6 steps are in the Calendar, but Home gave no sign of them.

**Trust** (what is stored, can he control it, can the AI change his goal)
- Positive: nothing is saved until Confirm, and the buttons (Edit, Discard, Undo) are clear. Leo said that is why he stayed.
- Negative: Leo never found out whether the AI can change his goal later, or why the plan is specific to him (both were things he needed explicitly). The title can't be edited, and stale lines ("No time given", "Nothing is on your calendar until you confirm") contradict the visible state.
- Nothing visible told him what is stored. Confirm gave no project, and the success line vanished quickly.

## Potential improvements
| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Step 12, plan panel after Confirm | Keep the panel open after Confirm, replace the item list with the 6 created steps, remove "Nothing is on your calendar until you confirm" and "No time given", and show a link ("View in Calendar" or the project name). | Leo abandoned because the screen said "6 steps" but showed one item and no project. |
| 2 | Steps 1 to 6, first load of Home | Show one popup at a time. Move the "One question" and notifications alert until after the tour or plan review. Add a visible "Skip tour" on every tour card, and make sure the tour doesn't intercept pointer events on the other popups. | Three overlays plus a tour with no visible exit felt like "homework" before the task. |
| 3 | Tour cards 4 and 5 (steps 5 to 6) | Show tour steps only when the element they describe is on screen. Navigate to Today before card 4 (or skip those cards while the plan panel is open). | Cards describing missing UI looked broken and drove the Low clarity. |
| 4 | Steps 9 to 11, plan edit mode | Make the title editable, let the start date follow the Sunday recurrence, and regenerate "What I assumed" when the time is set so "No time given" disappears. | The half-editable panel and stale line made Leo trust Confirm less. |
| 5 | Step 1 and step 7, draft plan after setup | Add a setup question or plan label that says whether a side project with a weekly commitment becomes a project or a repeating reminder (and with what time). Show it on the draft before Confirm. | Leo couldn't tell what Confirm would create, and the missing project was the reason for abandoning. |
