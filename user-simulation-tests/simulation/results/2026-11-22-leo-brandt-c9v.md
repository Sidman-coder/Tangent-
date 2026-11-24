# Simulation report: Leo Brandt (leo-brandt-c9v), 11th grader with a retro-handhelds YouTube channel, end user

Run: overnight 2 Phase 1 baseline, Playwright, 1440x900, production build on push-v1.

**Task:** Add something from your week that you need to get ready for, get Tangent to plan it into your calendar, save the plan, then mark the first step done and tell Tangent how it went.
**Result:** Abandoned
**Steps:** 14 · **Total estimated time:** 340 s

Leo quit at step 14 of the 15-step cap. He got through the whole plan → save → mark done path. He stopped because nothing confirmed that Tangent received his check-in. He hit his abandonment rule ("marks the task unresolved if there is no final confirmation") one step before the cap. This was not a step-cap stop. Still, it took 14 of 15 allowed steps to get here, and 7 of those were spent correcting the plan. That alone shows the plan step is too long.

Two notes on how to read this run:
- **Shared account:** Codeforces, AP Chem Final Prep, Start Environmental Club, Python Competitive Programming Basics and the club sponsor steps were left on the shared test account by earlier runs. Their presence is not counted as a defect. How the app filed Leo's new plan into one of them is counted.
- **Edits and discards:** At steps 6–7 Leo used "× Remove" on draft steps that weren't saved yet. At step 14 he clicked "Discard" on an unsaved preview. Neither removed saved data.

Step screenshots: `docs/overnight2/sims/leo-brandt-c9v-step1.png` to `leo-brandt-c9v-step14.png`; full step JSONs: `docs/overnight2/sims/leo-brandt-c9v-steps.md`.

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Home (/) | Types "Algebra 2 test Friday on exponentials and logs… also editing Sunday's video" into the add box, leaves "Goes to: Auto", clicks Add | High | Yes |
| 2 | Plan brief (round 1: 1 step, Mon 3:30 PM) | Opens "Why this plan" to see why there's only one block and no mention of Friday or the video | Medium | Yes |
| 3 | Plan brief, "Why this plan" expanded | Types in Reply to Tangent: split into 3 sessions before Friday, keep off editing nights; Send | Medium | Yes |
| 4 | Replanned brief (5 steps: Mon, Tue, Thu Python, Sat, Sun) | Replies again: test is FRIDAY, move Sat/Sun steps before it, "what python step?"; Send | Medium | Yes |
| 5 | Second replan (still Sat/Sun; duplicate "Learn log rules" card) | Skips Confirm, taps Edit to fix it by hand | Medium | Yes |
| 6 | Plan brief in Edit mode | Clicks × on the duplicate Saturday "Learn log rules" card | Medium | Yes |
| 7 | Edit mode, 4 draft steps | Clicks × on the Sunday "Solve 6 mixed…" recheck | Medium | Yes |
| 8 | Edit mode, 3 draft steps (pill still "5 steps") | Taps "Done editing" to check the final cards before saving | Medium | Yes |
| 9 | Plan brief read-only, 3 steps (pill still "5 steps") | Clicks Confirm, unsure whether it saves 3 or 5 | Medium | Yes |
| 10 | After Confirm: "Saved 3 steps to your calendar." (pill still "Draft plan · 5 steps") | Clicks "View in Calendar" to check | Medium | Yes |
| 11 | Calendar week view (Nov 22 – Nov 28) | Opens Mon 3:30 PM "Review exponential growth and decay rules" to find a done control | Medium | Yes |
| 12 | Task detail panel (filed under "Python Competitive Programming Basics", tag ECs) | Taps "Mark done" | Medium | Yes |
| 13 | After Mark done: "Done — undo", no check-in prompt | Types the check-in into the "Ask about…" box, clicks Ask | Low | Yes |
| 14 | Ask reply: "Add to project" + 5-step "Preview · not added yet" | Clicks Discard and stops, check-in never acknowledged (ABANDONED) | Low | Yes |

## Per-screen detail

### Step 1 — Home (/)
- **Action & thinking:** I clicked into "Type or say anything…" under "What do you want to add?" and typed: "Algebra 2 test Friday on exponentials and logs, need to study but I'm also editing Sunday's video". I left "Goes to: Auto" alone and hit Add. The add box was the obvious place to start. My channel goal shows up as a "Personal" item with its whole sentence pasted in as the step title. I can't tell what "Auto" will do with my test. "9 questions to sharpen your plans" sounds like homework, so I skipped it.
- **Clarity:** High · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** It's nice that it says "Hey, Leo" at 3:47 AM and the page is clean. Seeing my channel goal dumped in as one giant sentence under Personal feels off, like it doesn't get that the channel is a real project. Nine waiting questions make me want to ignore that box.
- **Accumulated memory:** "Opened Tangent at like 4 AM after editing. Way less cluttered than my Notion setup, but my YouTube goal is just one long sentence under Personal at 6 PM. I typed in my Algebra 2 test and the Sunday edit to see if it can plan around both. Wondering where 'Auto' will put it and whether those 9 questions will get in my way."

### Step 2 — Plan brief (round 1: 1 step, Mon 3:30 PM)
- **Action & thinking:** I clicked "Why this plan" to see why I only got one study block on Monday at 3:30 PM, with nothing about Friday or Sunday's video. If it didn't explain, my next move was to reply asking for shorter sessions before Friday that leave room for editing. The layout is easy to follow: plan on the left, calendar on the right, Confirm obvious. But one generic block covers maybe half of what I typed.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** Let down. "Study exponentials and logs" is basically what ChatGPT would say. I did like the step lighting up on the Monday cell. "Nothing is on your calendar until you confirm" makes it feel safe to poke around.
- **Accumulated memory:** The memory changes from curiosity to suspicion. "It came back with one session Monday at 3:30 and nothing about Friday or the video, so I'm not sure it read what I wrote. Seeing the step on the calendar is nicer than Notion, but I'm checking 'Why this plan' before Confirm."

### Step 3 — Plan brief, "Why this plan" expanded
- **Action & thinking:** I read both sections. Then I typed in Reply to Tangent: "you said three 40 min sessions but only gave me one. split it into 3 before Friday and keep them off the nights I'm editing Sunday's video (I edit late, so early evening works)" and hit Send, without confirming. The breakdown shows it remembered my channel goal and school hours. But it promises three sessions "before the final" and shows one. It also calls Friday's test a "final" and says nothing about editing nights.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 40s
- **Emotional state:** Relieved it pulled in my 1,000-subscriber goal and school hours, which ChatGPT would never do. Then annoyed that it says three sessions and gives one. The first bullet reads like broken template text ("Why Keeping a weekly..."), so it feels less polished.
- **Accumulated memory:** Context is now mixed with mistakes. "It remembers my channel goal and school schedule, which is more personal than Notion. But it says three sessions, calls it a 'final', and ignores my editing nights. I told it to split into 3 around my edits. If the new version looks right I'll hit Confirm."

### Step 4 — Replanned brief (5 steps: Mon, Tue, Thu Python, Sat, Sun)
- **Action & thinking:** I didn't confirm. I replied: "the test is FRIDAY. why are logs on saturday and the practice quiz on sunday, that's after the test lol. put all 3 sessions before friday… also what python step? i don't remember saying that" and sent it. The calendar bars are easy to read. But log problems are on Sat Nov 28 and a "final check" quiz is on Sun Nov 29, after the test. The Sunday quiz is at 11 AM though its Why says "early evening". A Python catch-up step appeared that I never asked for. And Tangent wrote nothing back; it just swapped the plan.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 45s
- **Emotional state:** Hyped at first, because it split things up and the calendar bars beat dragging things in Notion. Then I saw two "study for Friday" steps after the test and it lost me. The personal-sounding Why lines now read like it's just saying things to sound like it knows me.
- **Accumulated memory:** Trust drops. "Replanned after I asked, looks clean, but it put the logs practice and the 'final' quiz after Friday's test, which is not how studying works. It added a Python step and didn't reply in words. Not hitting Confirm until all prep is before Friday. If it messes up again I'll use Edit myself."

### Step 5 — Second replan (still Sat/Sun after Friday; duplicate "Learn log rules")
- **Action & thinking:** I read all five cards again. Saturday and Sunday were still there and "Learn log rules and change of base" appeared twice, so I tapped Edit to fix it myself. The heading promises three 40-minute sessions before Friday, but there are five steps and two come after the test. The Saturday card even says it's after the test. The Python step vanished without explanation, and Tangent still hasn't replied in words.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 40s
- **Emotional state:** Annoyed. It literally wrote "Saturday is after the test" in the reason and kept the step anyway, then duplicated a card. That makes the specific-sounding reasons feel fake. One more chance through Edit, or this goes in Notion.
- **Accumulated memory:** Now actively distrustful. "Told it twice; still Saturday and Sunday after the test, and log rules twice. The Python thing vanished without a word, and it never talks back, so I can't tell if it reads what I type. One 'why' line admits the step is pointless. Going into Edit and won't confirm until everything is before Friday."

### Step 6 — Plan brief in Edit mode
- **Action & thinking:** I tapped the × on card 4 ("Remove: Learn log rules and change of base", 11/28/2026 03:00 PM) to delete the Saturday duplicate. It's a copy of card 3, it falls after the test, and its own Why calls it an optional bonus. The edit controls are easy to find. But two cards have the exact same title and remove label, so I'm not sure the × hits the Saturday copy and not the Thursday one.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** Finally real controls, like editing a Notion row, so I feel more in charge. But I'm the one cleaning up a duplicate the AI made after I told it twice, and I don't trust that deleting a same-named card takes out the right one.
- **Accumulated memory:** Leo is now fixing the plan by hand instead of asking Tangent. "Deleting the Saturday duplicate first, then the Sunday one. Same names, so I'll check the calendar bars to see the right one disappeared. Not confirming until three real sessions sit Mon to Thu."

### Step 7 — Edit mode, Saturday duplicate removed (4 draft steps)
- **Action & thinking:** I clicked × on card 4, "Solve 6 mixed log and exponential problems" (11/29/2026, 11:00 AM), to delete the Sunday recheck. The Sat 28 bar disappeared and the Thursday log-rules bar stayed, so the first delete hit the right card. The Sunday card's Why claims it "leaves your Sunday video edit alone" while sitting on Sunday. Removing it leaves Mon, Tue, Thu, which is what the heading promises.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Relieved the delete hit the right card. Annoyed that I had to check the calendar bars myself because nothing told me what got removed. The Sunday "why" lowers trust further, but I'm close enough to keep going.
- **Accumulated memory:** "Saturday one is gone, and I only know because the green bar vanished, no message. Deleting the Sunday card whose 'why' literally says it leaves Sunday alone. Then Done editing and Confirm, and hope it saves exactly that."

### Step 8 — Edit mode, 3 draft steps (pill still "5 steps")
- **Action & thinking:** I tapped "Done editing" to see the final three cards the way they'll be saved. The cards and calendar show only Mon, Tue and Thu. But the floating pill still says "5 steps" and nothing confirmed the Sunday card was removed, so I can't tell whether Confirm will save 3 or 5.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Relieved the cards and calendar finally match what I asked. The pill saying 5 bugs me, like part of the app didn't get the update, and I don't trust Confirm yet.
- **Accumulated memory:** The plan is correct now, but Leo still can't trust what will be saved. "Three sessions on Mon, Tue and Thu, which is right. But the draft pill still says 5 steps, and there was no message either time I deleted something. If it saves 5 I'm going to be annoyed."

### Step 9 — Plan brief read-only, 3 steps (pill still "5 steps")
- **Action & thinking:** I clicked the lilac Confirm button. The cards, the headline and the calendar all agree on three sessions before Friday with Sunday left free. The pill still says 5 steps and nothing says my deletions stuck, so I don't fully trust what Confirm will write.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** I like the headline saying my Sunday edit stays untouched; the Why lines finally sound like me. That pill makes me hit Confirm while half watching for it to mess up.
- **Accumulated memory:** "Cards, headline and calendar all say three sessions Mon, Tue, Thu. Hitting Confirm half expecting it to save the wrong version. If my calendar ends up with 5 steps, I'm done trusting edit mode."

### Step 10 — After Confirm: "Saved 3 steps to your calendar." (pill still "Draft plan · 5 steps")
- **Action & thinking:** I clicked "View in Calendar" to check that only the three Algebra 2 steps landed. The message says 3 steps saved, first one Mon 3:30 PM, and the calendar dots went up by one on Mon, Tue and Thu. But the pill still says "Draft plan · 5 steps" after confirming, and no new project appeared in the sidebar.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 14s
- **Emotional state:** Relieved it says 3 and tells me what's first. Bugged that the pill still says draft. Was it saved or is it still a draft? I'll check once and move on if it's right.
- **Accumulated memory:** The first real confirmation softens the distrust. "It said 'Saved 3 steps', first one tomorrow at 3:30, which is what I wanted. But the pill still says draft, 5 steps, so I'm not sure what's real. Checking the calendar before marking the first step done, and that step isn't until tomorrow afternoon."

### Step 11 — Calendar week view (Nov 22 – Nov 28)
- **Action & thinking:** I tapped "Review exponential growth and decay rules" on Mon 23 at 3:30 PM to look for a done control, even though it's tomorrow. My three steps are there (Mon 3:30, Tue 4:30, Thu 3:30) and the weekend steps are gone. But three cards are stacked at Mon 3:30 PM, and the cards have no done checkbox, so I have to open one and hope.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** Some relief seeing my three algebra steps on real days and my Sunday 6 PM slot untouched; that beats the confusing pill. But the week is cluttered compared to Notion, and three things stacked at 3:30 Monday make me wonder if Tangent checked for clashes.
- **Accumulated memory:** The save is now confirmed, but the stacked slot adds a new doubt. "The 3 saved steps show up and my 6 PM Sunday video is clear, so the save is real. Monday 3:30 has three things stacked, which is sketchy. No checkbox anywhere, so I'm opening the step to find a done button."

### Step 12 — Task detail panel (filed under "Python Competitive Programming Basics", tag ECs)
- **Action & thinking:** I read the panel, frowned at the project link, and tapped "Mark done". That's the clear next action, and the Why ("Monday is a bare school day with nothing else on it, so you can start the test prep without it touching your late-night time") mentions my late nights, which I like. But my Algebra 2 prep is filed under "Python Competitive Programming Basics" with an "ECs" tag, which is just wrong. Nothing on the panel says where I'll tell Tangent how it went.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** The late-night line is the first thing in this flow that feels written for me. Seeing math prep under a Python project kills it, like Notion with the wrong database relation. What else did it mix up?
- **Accumulated memory:** "The step content is decent and the 'why' gets my late nights, but it's filed under a Python project I never picked, and three things are stacked at Mon 3:30, even though the 'why' calls Monday bare. Hitting Mark done at 4 AM on a step due tomorrow, which feels fake. I still don't see where I'm supposed to tell it how it went."

### Step 13 — After Mark done: "Done — undo", no check-in prompt
- **Action & thinking:** I clicked into "Ask about Review exponential growth and decay rules", typed "Done. Copied the growth and decay formulas and worked 2 examples of each, took about 25 min. Decay was easier than growth.", and clicked Ask. The button just flipped to "Done — undo". Nothing asked how it went, there was no follow-up prompt and no confirmation. The Ask box is the only place to type, but its placeholder ("Stuck? Ask how to start…") is about being stuck, not reporting back, so I'm guessing.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** Let down. It flipped a label like a Notion checkbox, with no "nice, how'd it go?". I'll try the Ask box, but if it doesn't count as a check-in I'm calling this unfinished.
- **Accumulated memory:** Leo now sets himself a pass/fail test. "I hit Mark done and all I got was 'Done — undo', no question about how it went, so I'm dumping my update into the 'Stuck? Ask...' box. If Tangent doesn't respond like it got the check-in, I'm treating this whole thing as not finished."

### Step 14 — Ask reply: "Add to project" + 5-step "Preview · not added yet" (ABANDONED)
- **Action & thinking:** I read Tangent's reply and the preview card, clicked "Discard" so none of the extra steps land on my calendar, and stopped. I told it how the step went. All I got back was the label "Add to project" and a preview of 5 new steps I never asked for: Algebra, Python, AP Chem review, problems for "Saturday's contest", and a Sunday morning session, all under the Python project. Nothing confirms my check-in was received, so by my own rule the task is unresolved.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 25s
- **Emotional state:** I typed exactly what I did and that decay felt easier, and Tangent ignored it and tried to sell me five more sessions. It feels like generic "here's more work" output, not something that listened, and it kills any wish to keep going.
- **Accumulated memory:** This is where Leo stops. "Tangent answered with 'Add to project' and a pile of new steps for Chem, some contest I never mentioned, and a Sunday morning slot, all under that random Python project. Not one word about what I told it. I discarded the steps and I'm calling this unfinished, because it never confirmed it heard my check-in."

## Synthesis
- **Highest friction point:** The plan brief across steps 2–5. The first plan gave one step, even though its own "Why this plan" promised three 40-minute sessions, and it ignored the Friday date. Two typed corrections each produced a silent replan with no words. Both replans kept prep steps after the Friday test. The first added an unrequested Python step; the second dropped it without explanation and added a duplicate "Learn log rules" card. Leo had to switch to Edit and delete steps by hand (steps 6–7), then work around a stale "5 steps" pill (steps 8–10). That is 9 of 14 steps spent getting a correct 3-step plan saved.
- **Highest emotional friction point:** Step 14, the check-in reply. After marking the step done, Leo wrote a concrete update (25 min, 2 examples each, decay easier). Tangent answered only "Add to project" and proposed 5 new steps across unrelated subjects, with no sign it heard him. This came right after the high point at step 12, where the "late-night time" Why line felt written for him. The drop from "it gets me" to "it didn't listen" is what ended the run. Step 5 was a close second ("it literally wrote 'Saturday is after the test' and kept it anyway").
- **Final decision:** Abandons at step 14 of a 15-step cap. Plan, save and mark done all succeeded. The run failed on the last part of the task, "tell Tangent how it went". The check-in was never acknowledged, which triggered Leo's rule "marks the task unresolved if there is no final confirmation". It took 14 of 15 steps to reach this point, which suggests the planning path is too long even when it succeeds.
- **Emotional summary:** I opened Tangent at 4 AM after editing, half hopeful because it looked cleaner than my Notion setup and said hi to me by name. The first plan was one study block, which is exactly the generic ChatGPT thing I don't trust. Then "Why this plan" showed it knew my 1,000-subscriber goal and my school hours, and I thought okay, maybe. But every time I told it the test was Friday, it rebuilt the plan without saying a word and kept putting study sessions after the test, once with a reason admitting that. By the duplicate card I stopped talking to it and fixed things myself in Edit, like I would in Notion. Seeing "Saved 3 steps" and my three blocks on Mon, Tue and Thu felt good, and the line about protecting my late-night time was the one moment it really sounded like it knew me. Then my math prep was sitting in a Python project, and when I marked it done and told it how it went, it just tried to give me five more things to do. It never actually listened to me, so I'm not counting this as done.
- **Tangent-specific checks:**
  - **Context (did Tangent use what Leo said?):** Partial, and inconsistent.
    - Used: the 1,000-subscriber goal and school hours in "Why this plan" (step 3); the late-night editing in the saved step's Why line (step 12); the Sunday 6 PM upload kept clear (steps 9, 11).
    - Ignored or broke: the Friday deadline, in the first plan and both replans (steps 2–5); it called the test a "final"; it added an unrequested Python step; it filed the Algebra 2 step under "Python Competitive Programming Basics / ECs".
    - Contradicted: the step's Why says Monday is "bare… with nothing else on it" while three items sit at Mon 3:30 PM; the check-in content was ignored (step 14).
    - Leo's own wording sums it up: when context is used but the plan contradicts it, the personal lines "read like it's just saying stuff to sound like it knows me."
  - **Different from generic apps (Todoist/Notion/ChatGPT):**
    - Real differentiators Leo noticed: the plan shown next to the calendar, steps highlighted on calendar cells, and Why lines that cite his goals. He compared these favorably to Notion several times.
    - Where the difference collapsed: the one-step first plan ("basically what ChatGPT would say"), the silent replans, and the 5-step "more work" preview (step 14). These made Tangent feel generic.
    - Edit mode felt "like editing a Notion row". That is good for control, but it means the AI part was bypassed.
  - **Follow-through (check-ins, round review, daily bubble):** Failed in this run.
    - Mark done only flipped to "Done — undo", with no "how did it go?" prompt.
    - The only text box was framed for being stuck. Typing a progress report there sent it down a plan-expansion path, not a check-in path.
    - Round review and the daily bubble were not reached in this run.
  - **Trust (what is stored, can he control it?):**
    - Positives: "Nothing is on your calendar until you confirm", the "Preview · not added yet" card with Discard, Edit mode controls, and the explicit "Saved 3 steps to your calendar."
    - Negatives:
      - The "Draft plan · 5 steps" pill stayed wrong through edits and after saving.
      - Removing a step gave no feedback, so Leo checked the calendar bars himself.
      - Two draft cards had identical remove labels.
      - "Goes to: Auto" silently picked an unrelated project.
      - It was never clear whether the check-in was stored anywhere.
      - Leo's required info "whether the AI can edit his goal later" was never addressed, and his channel goal showed up as a raw sentence under Personal.
- **Detected risks:**
  - Students who give a dated deadline will get prep steps placed after it, and will either save a broken plan or give up correcting it.
  - Silent replans (no text reply) make users think the AI isn't reading them. Two failed corrections were enough for this persona to stop talking to Tangent.
  - Reasons that sound personal but contradict the plan ("Saturday is after the test", "leaves Sunday alone" on a Sunday step, "bare day" on a stacked slot) damage trust more than generic reasons would.
  - Auto project assignment can file school work under an unrelated extracurricular project, which corrupts how the user sees their projects.
  - Mark done with no follow-up means users never find the check-in loop. If they try the Ask box, a progress report gets turned into more work, which feels like nagging.
  - A stale draft/step-count pill makes users doubt whether Confirm saved the right version.
  - Stacked items at the same time slot suggest the scheduler isn't checking for clashes.
- **Structural insight:** Tangent's personalization layer (Why lines, goal recall) is ahead of its constraint layer (deadline, slot conflicts, project matching) and its conversation layer (replying in words, acknowledging updates). When the reasons sound tailored but the plan breaks the user's stated constraints, the personal copy reads as fake. The flow also has no defined place for "tell Tangent how it went". Marking a step done ends in a dead end, and the only text box sends input to planning. So follow-through, the step meant to set Tangent apart, is the part that's missing.
- **Fix this first:** When the user taps "Mark done" in the task detail panel, open an inline "How did it go?" check-in field right there (with Skip). Have Tangent reply with a short written acknowledgement of what the user said (e.g. "Got it, 25 min, decay felt easier. I'll lean the Tuesday session toward growth.") and store it on the step. Tangent should not propose new steps in that reply unless the user asks.

## Potential improvements

| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Task detail panel, right after "Mark done" (step 13) | Replace the bare "Done — undo" flip with an inline "How did it go?" field (with Skip and Stop) that sends to Tangent. Show a one-line written acknowledgement and a "Saved to this step" confirmation. | This is the part of the task that failed. The persona abandoned only because there was no check-in loop and no confirmation. |
| 2 | Task "Ask about…" box reply (step 14) | When typed text reads as a progress report ("Done… took 25 min… easier than…"), answer in words first and record it as a check-in. Never answer with just the label "Add to project" and a multi-subject step preview. If steps are proposed, start with one sentence on why and keep them to the current task's subject. | Turning a check-in into 5 unrequested steps across Chem, Python and a contest felt like being ignored and given more work, and it ended the run. |
| 3 | Plan brief replans (steps 2–5) | Treat a stated event date as a hard cutoff: no prep step may be scheduled after "Friday" once the user names it. Match step count to the brief's own text ("three 40-minute sessions" means 3 cards). Remove duplicate titles before showing a draft. After each Reply to Tangent, show a short text reply listing what changed ("Moved logs to Thu, removed Sat/Sun, dropped Python"). | Two corrections produced silent replans that kept post-test steps, a duplicate and an unrequested Python step. Leo stopped trusting the AI and fixed the plan by hand. |
| 4 | "Goes to: Auto" on Home and the saved step's project link (steps 1, 12) | Don't auto-file into an existing project unless the subject matches (Algebra 2 should never go to "Python Competitive Programming Basics / ECs"). Otherwise create or suggest a class project such as "Algebra 2". Show the chosen project on the plan brief before Confirm, with a way to change it. | Wrong filing made Leo ask "what else did it mix up?" right at the high point of the run, and it pollutes the user's projects. |
| 5 | Floating draft pill and Edit mode (steps 6–10) | Update the "Draft plan · N steps" count live as steps are removed, and clear or replace it with "Saved" after Confirm. After each × Remove, show a brief undoable toast naming the removed step and its date. Also run a clash check so a new step can't land on a slot already holding items (Mon 3:30 PM had three), and so the Why line can't call that day "bare". | The stale "5 steps" pill, silent removals and stacked slot made Leo doubt what Confirm saved and whether Tangent checks his calendar at all. |
