# Sam run: orchestrator notes (feeds the Tangent-specific section of the report)

Run on the production build, `push-v1`, signed in as the test account, reset (Settings > Your data > Delete all my data, test account only; email confirmed as the +test account before the reset) and re-onboarded as Sam (14, 9th, School Mon-Fri 08:00-15:00 [default, untouched], priority Grades, slip = "I forget things" + "I put it off until the last minute", bugging-me = "Forgetting homework and finding out in class", step 6 skipped, works best Evenings / 15 min / 1 hour, step 8 skipped, push = "Gentle nudges"). Viewport 1440x900.

Onboarding observations (setup, not simulated steps):
- Nine steps still; "Continue" is disabled until required fields are set; the time/focus/load step uses radios (not buttons), which the driver had to be told about. Step 9 auto-advanced on choosing a nudge style.
- After "You're all set, Sam." the page behind still greeted "Jordan" for several seconds (stale name from the previous persona's cached session data; it showed "Still up, Sam?" after about 8 s). Likely a client cache of the old name after "Delete all my data". Worth a look.
- Evidence: `sim-sam-onboarding-done.png`.

## Observed (step 1 screen)
After "Open Tangent" Sam lands on a chat Tangent opened itself ("Break down plan: Forgetting homework and finding out in class"). Tangent's message (a status line): "I checked, but I can't see any of your homework yet. Canvas isn't connected, so connect your calendar feed in Settings, then Integrations, and I'll pull in every due date. Gmail isn't available yet either. Your task list only has school blocks. Until then, tell me each assignment and I'll write it down. I can also add a nightly 10-minute homework check at 7 PM."
On top: "Enable desktop notifications" alert dialog (Enable / Not now) and a "One question" dialog: "You said things slip your mind. What do you forget most: assignments, dates, or stuff people tell you?" (text box, mic, Answer, Not now). Two stacked prompts again before anything useful.
Good: Tangent is honest that it sees no homework and does not invent any; offers the 7 PM check. Weak: "Settings, then Integrations" and "calendar feed" are jargon for a 14-year-old; the chat has no Skip/Stop control here; the actual next action for Sam (type the assignment) is in the middle of a long paragraph.
Evidence: `sim-sam-step1-first-screen.png`.

## Step 1 evaluator result
Clarity Low, doubt, annoyed/overwhelmed, 12 s. "Two popups at once... a wall of text about Canvas and Gmail... I just want to type that I forgot my English essay and be done." Declared: tap "Not now" on the notification popup, else "Not now" on the question box.
Executed: the notification popup's "Not now" could NOT be clicked: the "One question" modal's scrim (role=dialog, aria-modal) intercepts pointer events, so the alert behind it is unreachable until the modal is dismissed. Real friction (a user would see a button they cannot press). Fell back to the simulator's own alternative, "Not now" on the question box.
## Step 2 screen
After dismissing the question, a THIRD popup appears: "Tangent in two minutes" (1 of 12; "A quick walk through everything Tangent does... Esc ends it any time."; Not now / Start). The notification alert is still behind it. Three prompts stacked before Sam can type one word. Evidence: `sim-sam-step2-tour-over-chat.png`.

## Step 2 evaluator result
Low clarity, annoyed, 8 s. "A third popup... '1 of 12', I don't want a tour... close to closing the whole thing." Declared: "Not now" on the tour, then "Not now" on the notification alert again. Executed the tour "Not now" (worked). Tour is skippable in one tap.
## Step 3 screen
Chat page + the notification alert only ("Enable desktop notifications", Enable / Not now). Reply box visible and enabled; Send disabled until text.

## Step 3 evaluator result
Medium clarity, doubt, annoyed but hopeful, 12 s. "The text box is right there and the line about telling it each assignment makes me think I can finally just type." Declared: type the English essay into the reply box. Executed: typed "I forgot my English essay is due Friday" + Enter.
## Step 4 screen (what Tangent did with the sentence)
Within about 30 s the chat page was replaced by "Planning with Tangent": "English Essay Due Friday" with Round 1: 3 steps, all with a "You will have" outcome: outline and thesis Wed 7:00 PM; write full draft Thu 7:00 PM; proofread and submit Fri 7:15 AM. Respects School Mon-Fri 8-3 and the 1 hour/15 min/evening answers ("What I used about you" lists them, including "gentle nudges" and the bugging-me line).
TRUST BUG: "What I assumed: Based on what Tangent read in Canvas and Gmail". Tangent said one screen earlier that Canvas and Gmail are not connected and it can see no homework. This line is false for this user and would make a low-trust 14-year-old wonder what was read.
"Nothing is on your calendar until you confirm." with Confirm / Edit / Discard, plus a Brief/Calendar tab and a November month calendar (a lot for Sam).
The notification alert is still on the page behind this.
Evidence: `sim-sam-step4-after-essay.png`.

## Step 4 evaluator result
Medium, doubt, "relieved because it made a real plan from one sentence, but a little creeped out by 'what I used about you' and the Canvas/Gmail line." 20 s. Declared: tap Confirm. Executed.
## Step 5 screen (Home after Confirm)
Plan page closed by itself; Home: "Still up, Sam?" / "Wednesday, November 18 · 1 left today". Evening 5-9 PM: 1 item, "English Essay Due Friday / English essay: outline and thesis / 7:00 PM" with "Not today" and "Too big". Coming up: 2. A "Use Canvas? Bring your deadlines into Tangent. Not now / Connect Canvas" card. Notification alert still sitting on the page (never dismissed).
Positive: first step is tiny, tonight, at 7 PM, after school, and matches "Evenings". Home answers "what do I do now" in 3 seconds. No guilt copy.
Evidence: `sim-sam-step5-after-confirm.png`.

## Step 5 evaluator result
Medium, doubt, 12 s. "Nobody told me 'ok, got it, you're set'... it says 7 PM and it's the middle of the night [1:26 AM]... wary of tapping Done when I haven't done anything." Declared: tap the round Done button. Executed (Sam had NOT done the step; simulator chose to tap Done to see what happens, which is a plausible real-user probe).
## Step 6 screen (after Done)
Home headline changes to "Nice work today, Sam." / "All done for today". Evening 0 items. Dialog "How did 'English essay: outline and thesis' go?" (Nailed it / Okay / Struggled; Less time / About right / More time; Skip / Save). Canvas card and the notification alert are still there. "Recent activity 1".
Notes: marking Done on an unstarted step instantly says "Nice work" (celebratory, no check that it was actually done: Sam can game it and the plan rounds depend on honest check-ins). Two other essay steps (Thu, Fri) are not on Home but only 'Coming up 2' collapsed. Only ONE assignment was created; task asked for three.
Evidence: `sim-sam-step6-after-done.png`.

## Step 6 evaluator result
Low, confused/annoyed, 8 s. "It says 'Nice work today' when I did nothing, and now it's quizzing me about how something went. It feels fake, and I'm close to closing the app." Declared: Skip on the check-in. Executed (the dialog has TWO Skip buttons, top and bottom).
## Step 7 screen
Home: "Nice work today, Sam." / "All done for today", Evening 0 items, add box visible, Coming up 2 (collapsed), Canvas card, notification alert still showing. Nothing says what comes next (Thu/Fri steps are hidden under Coming up).
Evidence: `sim-sam-step7-after-skip.png`.

## Step 7 evaluator result; run stopped
Low, confused/annoyed, 8 s. "It says 'All done' when I only added one thing and did nothing. My essay isn't visible anywhere, since the Evening section shows 0 items and 'Coming up 2' is collapsed. Nothing tells me my essay is saved or what to do next... I'm barely holding on." The simulator named no element to tap ("I look... scroll past... I don't type a second assignment yet"), so no action was improvised: run stopped as stalled/unresolved at step 7 of 15 (same rule as Jordan step 8). abandoned=false.
Task result: 1 of 3 assignments captured (only the essay was typed; the sandbox task text gave only that sentence). Next-day daily follow-up bubble: not run (needs a second day; noted).

## Orchestrator summary of Tangent-specific observations
Context: strong. Plan used School 8-3, 1 hour/15 min/evenings, "gentle nudges" and the bugging-me line; scheduled 7 PM and a 7:15 AM Friday proofread. BUT the plan page claims "Based on what Tangent read in Canvas and Gmail" (false; contradicts the chat one screen earlier).
Different from generic apps: one sentence became a 3-step plan with "You will have" outcomes, with no list setup. A Todoist/ChatGPT would not know the school hours or the focus length.
Follow-through: Done on an unstarted step gave "Nice work today / All done" plus a how-did-it-go quiz; Thu/Fri steps hidden under collapsed "Coming up 2"; no "saved, you're set" confirmation after Confirm; no sign of the daily bubble.
Trust: Canvas/Gmail claim; "What I used about you" reads as surveillance to a 14-year-old ("a little creeped out"); no one tells Sam it is safe to tell Tangent things; three popups and the notification alert never closed (its Not now is hidden behind the question-box scrim).
