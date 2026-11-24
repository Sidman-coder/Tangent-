# Simulation report — jordan-reyes-s8k (Varsity soccer player, 10th grade, end user)

Run: overnight 2 Phase 1 baseline, Playwright, 390x844, production build on push-v1.

**Task:** Add something from your week that you need to get ready for, get Tangent to plan it into your calendar, save the plan, then mark the first step done and tell Tangent how it went.
**Result:** Abandoned
**Steps:** 8 (of a 15-step cap) · **Total estimated time:** 141 s

The 141 s is the persona's reading and acting time only. The orchestrator also saw system waits: about 8 s from Add to the question panel (step 1→2) and about 20 s from "Stop and plan" to the plan brief (step 2→3). Real time on task was roughly 170 s.

**Test-account noise (ignored as findings):** the "Hey, Leo." greeting, the "Python Competitive Programming Basics" project, the "AP Chem Final Prep" items and the "weekly Sunday video upload" item are left over from earlier runs on the shared test account. One exception is counted: in the Calendar Agenda the club steps had no project label, so they could not be told apart from unrelated items (step 5). That would still happen to a real student who has several projects.

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Home (/) | Typed the club goal plus the soccer schedule into the add box, left "Goes to: Auto" unchanged, tapped Add | Medium | Yes |
| 2 | Home, ask-first question panel ("What does this need approved, and by whom?") | Skipped the answers and tapped "Stop and plan" | High | Yes |
| 3 | Planning with Tangent, Brief tab (draft "Start Environmental Club", 8 steps) | Checked every step time against practice and games, then tapped Confirm | High | Yes |
| 4 | Brief after Confirm ("Saved 8 steps to your calendar.") | Read the saved status and the first step, found no checkboxes, tapped "View in Calendar" | Medium | Yes |
| 5 | Calendar, Agenda view (/calendar) | Found "Draft club pitch and shortlist sponsors" (Mon 23, 7:30 PM) and tapped its check circle | Medium | Yes |
| 6 | Calendar Agenda after the check (no feedback) | Waited for a check-in that never came, then tapped the floating "Say it to Tangent" button | Medium | Yes |
| 7 | Home, after the button sent them to / (no listening UI) | Typed the "how it went" note into the "What do you want to add?" box and tapped Add | Low | Yes |
| 8 | Planning with Tangent, new draft "Drafted the club pitch, went fine..." (1 step, Mon Nov 23 · 3:30 PM) | Saw a step at practice time, did not confirm, left the app | Low | Yes |

## Per-screen detail

### Step 1 — Home (/)
- **Action & thinking:** I skipped past the list, tapped the "Type or say anything…" box and typed: "Start Environmental Club - need a faculty sponsor, 5 signatures and a meeting room by January. I have soccer practice Mon-Fri 3:30-5:30 and games Saturday mornings." Then I tapped Add. I left "Goes to: Auto" alone because I don't know what it means, and I ignored the "9 questions" card because it feels like homework. A lot of items on the screen are at 3:30 PM on weekdays and 9:30 AM Saturday, which is exactly when I'm at practice or games, so I put my soccer schedule in up front.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** "It's a lot of other people's stuff and I have to scroll past it, but at least the box to add something is right there. Seeing tasks at 3:30 on weekdays makes me nervous that this thing will book me during practice."
- **Accumulated memory:** "Opened Tangent and the home screen is packed with someone else's Python and chem stuff. Whatever, I went straight for the box and typed in my club thing plus my practice times. Lots of stuff on there is set for 3:30 on weekdays, and if my club plan lands on practice I'm done with this app. I'm not touching the '9 questions' thing. I just want it to tell me what to do first for the club."
- **Orchestrator-observed (not visible to persona):** the ask-first question panel took about 8 s to appear after Add.

### Step 2 — Home, ask-first question panel ("What does this need approved, and by whom?")
- **Action & thinking:** I read the question and thought, "I literally just said I need a faculty sponsor." I skipped the answer buttons and tapped "Stop and plan" because I'd already given it my club details and practice times. The "Getting the picture" bar told me more questions were coming, so I got out before it turned into a quiz.
- **Clarity:** High · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Kind of annoyed. It asked something I'd already answered, and the progress bar promised more questions. I only stayed because "Stop and plan" was right there and I didn't have to answer anything.
- **Accumulated memory:** Shift from wary to irritated. The new part is "it didn't read what I typed": "...the first one was basically 'who approves this' when I'd just said faculty sponsor. I hit 'Stop and plan' because I'm not doing 9 questions. Now I just want to see the plan, and if anything lands at 3:30 on a weekday or on Saturday morning, I'm done with this."
- **Orchestrator-observed:** after "Stop and plan", a status read "Placing ... Still working. Longer plans can take up to 30 seconds." The brief appeared about 20 s later.

### Step 3 — Planning with Tangent, Brief tab (draft "Start Environmental Club", 8 steps)
- **Action & thinking:** I checked the time on every step first. Nothing fell between 3:30 and 5:30 on a weekday and nothing was on Saturday morning, so I tapped Confirm. Every step is at 7:30 PM, 7:45 AM before school, or Sunday 10 AM. Two things bugged me. The heading says "what you'll get this week" but the list runs to Dec 13, and 8 steps is more than I wanted. It also just says "first teacher" instead of helping me work out who to ask.
- **Clarity:** High · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** Relieved and a bit surprised. "It actually used my practice times and didn't drop anything at 3:30 or on a Saturday, so I'll give it a shot. 8 steps is a lot to look at though, and 'this week' going into December feels off."
- **Accumulated memory:** The irritation from step 2 gives way to conditional trust: "The wait was long-ish, but the plan dodges practice and Saturday mornings. Everything is early morning, evenings or Sunday, so it actually listened. It's 8 steps running into mid-December even though it says 'this week', which is more than I wanted. I'm hitting Confirm and hoping it really shows up on my calendar."
- **Orchestrator-observed:** all 8 steps avoided Mon-Fri 3:30-5:30 and Saturday mornings. The brief had no visible "Used:" line. A "Why this plan" expander was there but not opened. The persona worked out that the constraint had been respected by reading the times; the screen never said so.

### Step 4 — Brief after Confirm ("Saved 8 steps to your calendar.")
- **Action & thinking:** I read the green "Saved 8 steps to your calendar" line and the "First up" time, Mon 7:30 PM. Then I looked for a way to check off that step. The list is plain text with no checkboxes, so I tapped "View in Calendar" to see if the steps were really there and whether I could mark one done from there.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 10s
- **Emotional state:** Relieved that it says it saved and tells me straight what's first and when, Monday 7:30 PM after practice. But I'm already hunting for where to check it off and can't find it, which is a little annoying.
- **Accumulated memory:** Trust in the plan holds, and a new navigation doubt appears: "It said 'Saved 8 steps' and first up is Monday 7:30 PM drafting the pitch, so that's good. Now I need to check that one off and there's no box anywhere, so I'm going to the calendar and hoping it's there."
- **Orchestrator-observed:** status was "Saved 8 steps to your calendar. First up: Draft club pitch and shortlist sponsors, Mon, Nov 23 · 7:30 PM." with "View in Calendar" and "Undo". The "Why this plan" expander and the Reply box stayed visible. The Brief list items had no check controls.

### Step 5 — Calendar, Agenda view (/calendar)
- **Action & thinking:** I scanned the times, found "Draft club pitch and shortlist sponsors" on the 23rd at 7:30 PM, and tapped the round check next to it. The check circle was finally there, and my club steps were all at 7:45 AM, evenings or Sunday. But they were mixed in with Codeforces and chem items that aren't mine, with no club label, so I had to hunt for them. I still couldn't see where to tell Tangent how it went.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** Relieved there's finally a box to tap and that nothing is at 3:30 or Saturday morning. Annoyed at digging through someone else's 3:30 PM coding problems. Wondering whether checking the box is enough or whether it'll ask me something.
- **Accumulated memory:** Adds "buried" and "where do I report back?": "I went to the calendar to find a checkbox. It's there, but my club steps are buried in a list with Codeforces and chem stuff and nothing says 'club.' I'm checking off Monday's pitch draft now, but I still don't know where I'm supposed to tell Tangent how it went."

### Step 6 — Calendar Agenda after checking "Draft club pitch and shortlist sponsors" (no feedback shown)
- **Action & thinking:** I saw the circle fill in. I waited a couple of seconds for Tangent to ask how it went, and nothing came up. So I tapped the floating "Say it to Tangent" button to tell it myself. I wasn't sure it would connect what I said to this step.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 10s
- **Emotional state:** Kind of flat. "I tapped done and the app just sat there, no 'nice' and no 'how'd it go?'." A little annoyed that I had to go looking for where to report back. I'd rather talk than type, so I gave the voice button one shot.
- **Accumulated memory:** Enthusiasm from step 3 cools: "The circle filled in, but Tangent said nothing and didn't ask how it went. Now I'm trying the 'Say it to Tangent' button and hoping it knows I'm talking about the club step and doesn't start some brand-new thing."
- **Orchestrator-observed:** checking the step showed no toast, no check-in prompt and no message; only the circle changed. The scaffolding let the evaluator mark the step done before its scheduled time (Mon 7:30 PM). A check-in timed for later may therefore exist, but nothing on screen told the persona that one would come.

### Step 7 — Home, after "Say it to Tangent" on Calendar navigated to / (no listening UI)
- **Action & thinking:** The button dumped me back on Home. Nothing showed it was listening and nothing mentioned my pitch step. I didn't try the mic again. I typed "Drafted the club pitch, went fine, took about 20 min, kept it to one page" into the "What do you want to add?" box, left "Goes to: Auto" alone, and tapped Add. The only box says "add", so I guessed my update would start a new item instead of going on the step I'd just finished. The Monday pitch step isn't in this list, so I couldn't open it from here.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 35s
- **Emotional state:** Annoyed. "I hit the button and it just bounced me to Home with someone else's Python stuff all over it, like nothing happened. I'll give the type box one shot, but if it turns my 'went fine' into a new task, I'm done."
- **Accumulated memory:** Now expects to fail: "Then the 'Say it to Tangent' button just threw me back to Home. It didn't listen and didn't mention the club. Now I'm typing 'went fine' into a box that says 'add', and I'm pretty sure it'll make a new item instead of logging it on my pitch step."
- **Orchestrator-observed:** the browser console logged "Failed to load resource: 502 (Bad Gateway) @ /api/voice-token". The user saw no error and no listening state. On Home, the club items in "Coming up" did carry a "Start Environmental Club" label. The completed Monday step was not listed.

### Step 8 — Planning with Tangent, new draft "Drafted the club pitch, went fine..." (1 step: "Club pitch draft", Mon, Nov 23 · 3:30 PM)
- **Action & thinking:** I looked at the time first: "Mon, Nov 23 · 3:30 PM", exactly when practice starts. I didn't tap Confirm and I left the app. I'd been telling Tangent how my pitch draft went, and it turned that into a new "Club pitch draft" step during practice. One step in practice time and I'm out, and it never logged how my first step went.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** "Seriously? It took me saying 'went fine' and made it a new to-do, and put it right on top of practice. Even with 'Round 1' at the top, it clearly didn't get that I already did this. I don't trust it with my week anymore."
- **Accumulated memory:** Trust breaks completely: "So I typed 'went fine' into the Add box, and like I figured, it made a whole new plan out of it and put 'Club pitch draft' Monday at 3:30, which is practice. It never logged my check-in, so the task isn't done and I'm out."
- **Orchestrator-observed:** the Home box treated the past-tense report as a new item. It produced a new draft titled with the whole sentence and one step inside the practice window the persona gave in step 1. The draft was left unconfirmed and not discarded.

## Synthesis
- **Highest friction point:** Steps 6 to 7, the report-back moment. After marking the step done (Calendar Agenda), Tangent gave no feedback and no "how did it go?" prompt, and there was no visible place to report. The only lead, the "Say it to Tangent" button, failed silently: the orchestrator saw a 502 on /api/voice-token, and the user was sent to Home with no error. The only input left was a box labelled "add". From step 6 on, the persona was guessing.
- **Highest emotional friction point:** Step 8. The "went fine" report became a new to-do at Mon 3:30 PM, which is practice time. Two things failed at once: the check-in was read as new work, and the practice constraint Jordan gave in step 1 was not applied to the new draft. Jordan's main trust rule ("a single step in practice time ends it") was broken by the product's own output, right after step 3 had earned that trust.
- **Final decision:** Abandons at step 8 (of the 15-step cap) without confirming the stray draft. The first two parts of the task were done: the plan was saved and the first step was marked done. The "tell Tangent how it went" part was never logged, so the task stays unresolved.
- **Emotional summary:** I came in nervous because the screen was full of 3:30 PM stuff, so I told it my practice times straight away. Then it asked me who approves the club, which I'd literally just said, and I nearly rolled my eyes out of the app. "Stop and plan" saved it. When the plan came back with everything at 7:30 at night, early morning or Sunday, I thought, okay, this thing actually listened. That was the high point. Then I checked off my first step and nothing happened. No "nice", no "how'd it go". I tapped the talk button and it just threw me back to Home like I'd done nothing. I typed "went fine" into the only box there, already knowing it would mess it up, and it did. It made my finished pitch into a brand-new task at 3:30 on Monday, right on top of practice. It remembered my schedule once and then forgot it. I'm not giving it my week.
- **Detected risks:**
  - There is no check-in moment after a student marks a step done, so the "tell Tangent how it went" loop depends on the student finding a path that doesn't exist on screen.
  - The voice button fails silently and navigates away. Students who prefer voice (this profile says so: "prefers voice over typing when walking home") get no error and no fallback, and the profile's wrong assumption ("mic works without a permission prompt") is never corrected.
  - The Home add box turns past-tense progress reports into new items. Any student who reports progress there creates duplicate work and loses the report.
  - Availability given in free text (practice Mon-Fri 3:30-5:30, Saturday mornings) is applied to the plan it came with but not to later plans. Students in sports, jobs or caregiving will see the app "forget" their fixed commitments, and for this profile that ends trust in one step.
  - The ask-first flow asks for information already in the input (approval or sponsor). Impatient students who skip questions read this as "it didn't listen" before any value is delivered.
  - Saved steps have no check controls in the Brief, and Calendar Agenda rows have no project label. Finding and completing a step takes extra navigation and scanning, which is costly for students with several projects.
  - "What you'll get this week" over a plan running to Dec 13, plus 8 steps for a "short list" user, risks overwhelm and reads as inaccurate.
- **Structural insight:** Tangent is strong at the "plan" part of capture → plan → done and weak at "done". Planning respected Jordan's constraints and earned trust. The loop that should follow completion (acknowledge, ask how it went, log it against the step) has no visible surface. Every report-back route leads to the one generic input, which only knows how to create. User constraints also seem to live inside a single item's text rather than in what Tangent knows about the person, so the same app that respected practice in step 3 booked over it in step 8. Trust earned in planning is lost in follow-through.
- **Fix this first:** When a step is checked done (Calendar Agenda check circle, and any other completion control), show an inline check-in on that row: "Nice. How did it go?" with a one-line text field, a mic option, and Skip. Save the answer to that step, and confirm with a short status ("Logged on 'Draft club pitch and shortlist sponsors'"). This gives a visible next action at the exact moment Jordan looked for one (step 6) and would have stopped the cascade through steps 7 and 8. It also follows the "always stoppable" guardrail because Skip never blocks.

### Tangent-specific checks

- **Context (did Tangent use what this person said?):** Mixed. It ended negative.
  - Yes in the first plan. Jordan said: "I have soccer practice Mon-Fri 3:30-5:30 and games Saturday mornings." All 8 steps landed at "7:30 PM, 7:45 AM before school, or Sunday 10 AM". Jordan's reaction: "It actually used my practice times."
  - The brief never said it had used that context. The orchestrator saw no "Used:" line, and "Why this plan" was unopened, so Jordan had to check it by reading the times.
  - No in the ask-first question. After "need a faculty sponsor", it asked "What does this need approved, and by whom?" Jordan: "I literally just said I need a faculty sponsor."
  - Partly in the plan content. It said "first teacher" instead of helping Jordan identify a sponsor, which the profile lists as required information ("who is involved (teacher sponsor)").
  - No in the follow-up. The new draft put "Club pitch draft" at "Mon, Nov 23 · 3:30 PM", inside the stated practice window. It also missed that "Drafted the club pitch, went fine" described the existing step "Draft club pitch and shortlist sponsors".
- **Different from generic apps (Todoist/Notion/ChatGPT):**
  - Planning around stated fixed commitments and writing straight to a calendar is a real difference. Todoist and Notion would make Jordan place steps by hand, and ChatGPT would not write to a calendar. It was the high point of the run (step 3).
  - The difference disappeared at follow-through. The Home box behaved like a generic quick-add (everything typed becomes a task), which is worse than a plain chat app that would at least have understood "went fine".
- **Follow-through (check-ins, round review, daily bubble):**
  - **Check-in:** not offered. Marking done on the Calendar Agenda showed no toast, prompt or message (orchestrator-observed). Caveat: the step was marked done before its scheduled time under simulation scaffolding, so a later timed check-in may exist, but the screen gave no sign that one would come.
  - **Round review:** not reached.
  - **Daily bubble:** not seen in this run.
  - The done step was not acknowledged on Home either: it was simply absent from "Coming up".
  - The voice route meant for "tell Tangent" failed silently (502 on /api/voice-token, orchestrator-observed).
- **Trust (what is stored, can they control it):**
  - Jordan never saw what Tangent stored. Nothing showed that the practice and game times were saved as a lasting constraint, and step 8 suggests they weren't. There was no visible place to view or edit "my fixed times".
  - Positive control: "Undo" appeared next to the save status in step 4, and the step-8 draft needed Confirm before touching the calendar, so the bad 3:30 PM step was never saved.
  - Negative: the unconfirmed draft was left sitting in the account. From the screen, Jordan couldn't tell whether it would linger, and "Goes to: Auto" was never explained.
  - The mic gave no permission prompt, no listening state and no error, so Jordan couldn't tell what, if anything, had been captured.

## Potential improvements

| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Calendar Agenda, tapping a step's check circle (step 5→6) | Show an inline row prompt: "Nice. How did it go?" with a one-line field, a mic icon and Skip. Save the answer to that step and confirm with "Logged on '<step title>'". Use the same prompt anywhere a step can be completed. | This was the moment Jordan looked for the next action and found none. Without it, the "done" half of the core loop doesn't exist on screen. |
| 2 | Home "What do you want to add?" box, past-tense input that matches an existing step (step 7→8) | Before drafting, check for done-reports ("Drafted X", "went fine", "took 20 min") that match a recent or just-completed step. Ask in one line: "Log this on 'Draft club pitch and shortlist sponsors'?" with buttons "Log it" and "No, it's new". | Turning "went fine" into a new to-do lost the report and created duplicate work. That was the direct trigger for the abandon. |
| 3 | Planning, any new draft after the user has stated fixed times (step 3 vs step 8) | Save fixed commitments stated in an item ("soccer practice Mon-Fri 3:30-5:30, games Saturday mornings") as lasting busy blocks, never schedule into them, and show them in the brief as "Used: soccer practice Mon-Fri 3:30-5:30, Sat games" with a link to edit them. | The plan honoured practice once and then booked over it. Showing what was used makes the trust visible and lets the student control it. |
| 4 | Floating "Say it to Tangent" button on /calendar (step 6→7) | If /api/voice-token fails, stay on the current page and show "Voice isn't working right now. Type it instead:" with a text field tied to the current context (the step just completed). Never navigate to Home silently. On success, show a clear listening state. | A silent failure plus redirect looked like "nothing happened" and pushed a voice-first user into the wrong input. |
| 5 | Ask-first panel (step 2) and saved Brief / Calendar Agenda (steps 4–5) | Drop questions the input already answers (no "who approves this" after "need a faculty sponsor"; ask "Which teacher could sponsor it?" only if useful). Add check circles to saved steps in the Brief. Show the project label ("Start Environmental Club") on Calendar Agenda rows, as Home "Coming up" already does. | Re-asking known facts broke the "never ask what's known" guardrail and cost early trust. Missing checkboxes and labels added a screen change and a hunt before the first step could be completed. |

Full step JSONs: `docs/overnight2/sims/jordan-reyes-s8k-steps.md`. Screenshots: `docs/overnight2/sims/jordan-reyes-s8k-step1.png` through `docs/overnight2/sims/jordan-reyes-s8k-step8.png`.
