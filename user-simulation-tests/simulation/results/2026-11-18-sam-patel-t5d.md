# Simulation report: Sam Patel, 14, 9th grader, procrastinator (end user)

**Task:** Capture three missed assignments by typing, and see what Tangent does with "I forgot my English essay is due Friday."
**Result:** Stalled at step 7 of 15. This is not "Goal reached", not "Abandoned" (abandoned=false at every step), and not "Step cap reached". The simulator named no element to tap at step 7, so the orchestrator did not improvise. Only 1 of 3 assignments was captured, and the planning flow itself worked.
**Steps:** 7 · **Total estimated time:** 80 s
**Date:** 2026-11-18 · **Driver:** Playwright · **Product:** Tangent, production build on localhost, `push-v1`, test account re-onboarded as Sam.

> **Orchestrator corrections to the synthesized text below** (facts checked against the run):
> 1. The notification alert's "Not now" was unreachable only at step 1, while the "One question" modal's scrim covered it. From step 2 on it was reachable. It stayed on every screen because Sam chose to ignore it, not because it could not be dismissed. The scrim bug is still real and is a first-load finding.
> 2. At step 7 the add box ("What do you want to add?") was visible, so "no way to add the other two assignments" really means the simulator did not see a prompt to add more. The task text only gave one sentence to type.
> 3. The run supplied a `memory` field at every step. The "Accumulated memory" lines are reconstructed by the synthesizer from `reason` and `emotionalState`.
> 4. The essay did not vanish: it moved to Recent activity after Done, and Thu/Fri steps sat under the collapsed "Coming up 2".

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Chat "Break down plan: Forgetting homework..." with notification alert and "One question" modal | Tries Not now on the notification, then falls back to Not now on the question box (the scrim blocked the notification) | Low | Yes |
| 2 | Same chat, notification alert, plus a third popup "Tangent in two minutes" (1 of 12) | Taps Not now on the tour (worked) | Low | Yes |
| 3 | Chat with notification alert only; reply box visible | Ignores the alert, types "I forgot my English essay is due Friday" and presses Enter | Medium | Yes |
| 4 | "Planning with Tangent": English Essay Due Friday, 3 steps, Confirm / Edit / Discard | Reads the dated steps and taps Confirm | Medium | Yes |
| 5 | Home "Still up, Sam?" / "1 left today", Evening: outline and thesis 7:00 PM | Taps the round Done button on a step he has not done | Medium | Yes |
| 6 | Home "Nice work today, Sam." / "All done for today" plus a "How did it go?" check-in | Taps Skip on the check-in | Low | Yes |
| 7 | Home "All done for today", Coming up 2 collapsed, Canvas card, notification alert | Looks and scrolls past the Canvas card and alert; no tap named, run stalled | Low | Yes |

## Per-screen detail

### Step 1: Chat page with two stacked popups
- **Action & thinking:** I tried to tap "Not now" on the notification popup first, then looked at the "One question" box ("What do you forget most: assignments, dates, or stuff people tell you?"). Two popups sit on top of each other and both ask me something before I can do anything. Behind them is a long paragraph about Canvas, Gmail, Settings and Integrations that I won't read. I can't tell which button to tap first or what to do right now. (Execution: the notification's Not now was covered by the question modal's scrim, so I fell back to Not now on the question box.)
- **Clarity:** Low · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Annoyed and a bit overwhelmed. If the next screen is also confusing, I'm out.
- **Accumulated memory:** First contact. Two popups plus a wall of text, and no obvious next action. I'm already on a short fuse.
- **Evidence:** `docs/overnight/screens/before/sim-sam-step1-first-screen.png`

### Step 2: Chat with notification alert and "Tangent in two minutes" tour
- **Action & thinking:** I tapped "Not now" on the new "Tangent in two minutes" dialog, a "1 of 12" tour. A third popup appeared after I closed the question one. I don't want a tour. The notification alert is still there, so I still can't see where to type.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Annoyed. I'm close to closing the whole thing.
- **Accumulated memory:** Closing one popup just brings out another. That's three popups and I still haven't done anything. I'm close to quitting.
- **Evidence:** `sim-sam-step2-tour-over-chat.png`

### Step 3: Chat with reply box
- **Action & thinking:** I ignored the notification popup and the big message and tapped into the "Reply to Tangent" box. I typed that I forgot my English essay is due Friday. The tour is gone and there's a text box, so I know where to type. The notification popup is still on screen and Tangent's message is a long wall of text. It does say "tell me each assignment and I'll write it down", which is the one useful part. (Execution: typed the sentence and pressed Enter. About 30 s later the app replaced the chat with a planning page.)
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Annoyed, but the text box is right there and the line about telling it each assignment makes me think I can finally just type.
- **Accumulated memory:** The popups are mostly out of the way, except the notification alert. I found one useful line: tell it each assignment. My patience has recovered a little, because now I have something to do.

### Step 4: "Planning with Tangent": English Essay Due Friday
- **Action & thinking:** I looked at the three dated steps (outline and thesis Wed 7:00 PM, full draft Thu 7:00 PM, proofread and submit Fri 7:15 AM) and tapped Confirm. It did something with my essay, and the steps with days are easy to get. But the page is long, has a lot of text about me, and says "Canvas and Gmail" even though I never connected anything. Confirm is visible, so I know the next tap. I don't know if the first step is today. "Nothing is on your calendar until you confirm" makes me unsure what Confirm does. (Execution: Confirm; the planning page closed itself.)
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** A bit relieved because it made a real plan from one sentence, but a little creeped out by "What I used about you" and the Canvas/Gmail line.
- **Accumulated memory:** One typed sentence became a real plan, which is the first thing that worked. But it claims to know things I never gave it (Canvas, Gmail), which makes me uneasy. I'm hanging on because Confirm gives me an obvious next tap.
- **Evidence:** `sim-sam-step4-after-essay.png`

### Step 5: Home "Still up, Sam?" / "1 left today"
- **Action & thinking:** I looked at the home page, spotted the one item under Evening ("English essay: outline and thesis, 7:00 PM"), and tapped the round Done button to see if anything happens. There's no clear "saved, you're good" message after Confirm. The essay shows at 7 PM but the clock says 1:26 AM. The round button looks like the only obvious next tap, but it might mark the essay done when I haven't done it. (Execution: Done, though I had not done the step.)
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Mild relief that my essay is actually there under Evening, then annoyed and unsure.
- **Accumulated memory:** The essay is on Home, so something got saved. Nothing told me so, though, and I'm guessing at what the round button does. I tapped it out of curiosity, not because I'd finished the step.
- **Evidence:** `sim-sam-step5-after-confirm.png`

### Step 6: Home "Nice work today, Sam." / "All done for today" with check-in
- **Action & thinking:** I tapped Skip on the "How did 'English essay: outline and thesis' go?" popup because I haven't even done the essay yet. The screen says "All done for today" and asks how the essay went, but I only added it. Two rows of choices (Nailed it / Okay / Struggled and Less time / About right / More time) plus Skip and Save is too much. (Execution: Skip.)
- **Clarity:** Low · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Confused and a bit annoyed. It says "Nice work today" when I did nothing. It feels fake and I'm close to closing the app.
- **Accumulated memory:** My tap on Done was treated as real work, and now the app is praising me and quizzing me about something I haven't done. It feels fake.
- **Evidence:** `sim-sam-step6-after-done.png`

### Step 7: Home "All done for today", Coming up 2 collapsed
- **Action & thinking:** I looked at Home for a second and scrolled past the Canvas card and the notifications alert without tapping them. I didn't type a second assignment yet. The screen says "All done" and "Nice work" when I only added one thing and did nothing. My essay isn't visible anywhere, and nothing tells me it's saved or what to do next. (No tap was named, so the run stalled.)
- **Clarity:** Low · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Annoyed and confused. That makes me trust it less, and I'm barely holding on.
- **Accumulated memory:** The essay left the Evening list, the app says I'm done, and the notification alert is still there. There is no visible next action. My trust is lower than when I started.
- **Evidence:** `sim-sam-step7-after-skip.png`

## Synthesis
- **Highest friction point:** Steps 1 and 2 (stacked popups) for getting in at all. Three overlays appeared before any content, and at step 1 the notification alert's Not now was unreachable behind the modal scrim. Steps 6 and 7 are the highest friction for the task itself: after tapping Done on an unstarted step, Home read "All done for today", the essay left the Evening list, and nothing prompted for the next two assignments. The task stalled there with 1 of 3 captured.
- **Highest emotional friction point:** Step 6. "Nice work today, Sam" appeared after Sam had done nothing, followed by a two-row quiz. Sam called it fake. For someone with low initial trust, this broke the trust the plan on step 4 had just started to build.
- **Final decision:** Neither continued nor abandoned. The run stalled at step 7 of 15 with no tap named. Sam was "close to closing the app" from step 1 onward, and at step 7 "barely holding on". In practice this is a likely drop-off, not a clean success.
- **Emotional summary:** I started annoyed. Two popups, then a third one for a tour I didn't ask for, and I hadn't even seen where to type. Then I found the box, typed my one sentence, and it actually made me a plan with days on it. That felt good for a second. But it said it read my Canvas and Gmail, and I never connected anything, which was weird, and the "what I used about you" part felt a little creepy. I hit Confirm and my essay showed up on Home, so I tapped the round button to see what it did. Suddenly it was telling me "Nice work today" and "All done," which was fake because I hadn't done anything. Then it asked me a bunch of questions about how it went. I skipped, and the essay was gone from the screen. I wasn't sure it was saved, I didn't know what to do next, and I definitely wasn't going to add two more assignments to something that might lose them. I was barely hanging on.
- **Detected risks:**
  - Impulsive users who give up after one confusing screen will leave during the opening popup stack, before they ever type.
  - A false "Based on Canvas and Gmail" claim damages trust, especially with a low-trust 14-year-old who is unsure whether it is safe to tell Tangent things.
  - Rewarding an accidental Done tap with "Nice work today / All done" misrepresents status. A student who forgets assignments could then believe a missed task is handled.
  - Upcoming steps (Thursday and Friday) hidden under a collapsed "Coming up 2" are easy to forget, which is exactly the original problem.
  - With no "saved, you're set" confirmation, the user cannot tell whether the capture worked.
  - Sam assumes a plan means reminders. Nothing on screen says how he will be reminded without notifications, since the alert was never resolved.
- **Structural insight:** The planning core is strong: one sentence produced a personalized, dated plan with outcomes. Everything around it works against a short-attention, low-trust user. The entry layer (stacked, blocking overlays) and the exit layer (ambiguous Done semantics and false-positive praise) fail where a tiny first win needs to be reinforced. Tangent also states untrue facts about its data sources, which undermines the safety Sam needs.
- **Fix this first:** Show at most one overlay at a time on first load, and make no overlay (tour, "One question", notification prompt) block the chat reply box. Suppress the tour and the question on the first screen and defer the notification prompt until after the first plan is confirmed. Fix the modal scrim stacking so the alert's Not now is always tappable.

## Potential improvements
| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Steps 1-2: chat first load with notification alert, "One question" modal, and "Tangent in two minutes" tour | Queue overlays so only one shows at a time. Remove the tour and "One question" from the first load, and show the notification prompt only after the first plan is confirmed. Make Not now on the notification alert reachable (fix scrim/z-order). | The user is impatient and will quit before typing if three popups block the input. |
| 2 | Steps 5-6: Done on a step the user has not done, then "Nice work today / All done for today" and the check-in | Change Done to ask "Did you finish this?" with an undo toast, or make the first tap "Start". Do not show "Nice work" or the How-did-it-go quiz on a step that was never started or was just added. Reduce the check-in to one tap row with Skip. | False praise feels fake and teaches the user that Tangent is not reliable about what is actually done. |
| 3 | Step 4: "What I assumed: Based on what Tangent read in Canvas and Gmail" | Show the Canvas/Gmail line only when those integrations are connected. Otherwise write "Based on what you told me", and collapse "What I used about you" under a "Why this plan?" row with a short safe-to-share reassurance. | Chat said Canvas is not connected and Gmail is unavailable, so the claim is false and creepy to a 14-year-old. |
| 4 | Steps 4-5: after Confirm, planning page closes silently | Add a clear confirmation, for example "Saved. First step: Outline and thesis, Wed 7:00 PM", that shows the next action and the other steps, and offers "Add another assignment". | The user needs to know the capture worked, what is next, and how to add the remaining assignments. |
| 5 | Step 7: Home with Coming up 2 collapsed | Keep upcoming steps for this week visible by default, with the nearest due item named (for example "English essay: draft, Thu 7:00 PM"). Do not show "All done" when future steps exist for a due-Friday assignment. | Sam's core problem is forgetting. Hiding Thursday and Friday steps under a collapse repeats it. |

## Tangent-specific checks

### Context (did Tangent use what this person said?)
Strong. The plan used school hours, 1 hour of work, 15 min focus, evenings, gentle nudges and the bugging-me line. It put the steps at 7 PM and 7:15 AM on Friday. This matches the onboarding answers. However, the plan says "Based on what Tangent read in Canvas and Gmail", while the chat one screen earlier said Canvas is not connected and Gmail is unavailable. That is a false claim.

### Different from generic apps (Todoist / Notion / ChatGPT)
One typed sentence became a 3-step plan with outcomes and no list setup. A generic app would not know school hours or focus length. This is the product's clearest advantage. It was undercut by the surrounding popups and by the Done behavior.

### Follow-through (check-ins, round review, daily bubble)
Weak. Done on an unstarted step gave "Nice work today / All done" and a quiz. The Thursday and Friday steps were hidden under the collapsed "Coming up 2". There was no "saved, you're set" confirmation. The daily follow-up bubble was NOT tested, because it needs a second day.

### Trust (what is stored, can they control it)
Poor for this profile. The Canvas/Gmail claim was untrue. "What I used about you" felt creepy to a 14-year-old. Nothing says it is safe to tell Tangent things. At first load the notification alert's Not now was hidden behind the question modal's scrim, and the alert then stayed on every screen because Sam ignored it. Three stacked popups appeared before any content.

**Evidence:** screenshots are in `docs/overnight/screens/before/`: `sim-sam-step1-first-screen.png`, `sim-sam-step2-tour-over-chat.png`, `sim-sam-step4-after-essay.png`, `sim-sam-step5-after-confirm.png`, `sim-sam-step6-after-done.png`, `sim-sam-step7-after-skip.png`, plus `sim-sam-onboarding-done.png`.
