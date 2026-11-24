# Simulation report: Maya Okafor, junior (11th grade) student, end user

Run: overnight 2 Phase 8 (round 2), Playwright, 390x844, production build on push-v1.

**Task:** Add something from your week that you need to get ready for, get Tangent to plan it into your calendar, save the plan, then mark the first step done and tell Tangent how it went.
**Result:** Goal reached, but the persona marked it **unresolved**. Every action in the task was done. The persona still counted the task as unresolved because the check-in Save gave no confirmation. Her profile rule says: "Marks the task unresolved if there is no final confirmation." She did not abandon the task, and the run did not hit the 15-step cap.
**Steps:** 8 · **Total estimated time:** 92 s. This total leaves out step 3, where the evaluator gave no estimatedTimeSeconds, so the real time is higher.

Run context: Playwright at 390x844 (phone), production build at http://localhost:3000/, date 2026-11-22. This is a shared test account. The "Leo" greeting and items from other personas (Codeforces, Environmental Club, Gatsby/Macbeth, "Sunday video upload", an older "AP Chem final" ticked on Nov 23) are test artifacts. So are borrowed remembered facts such as "you said you lock in when there's a real deadline". None of these are reported as product defects below. They are only noted where they affected Maya's judgement.

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Home (Capture / Today feed) | Types "AP Chem final" in the add box and taps Add. Leaves "Goes to: Auto" alone and ignores the Tangent questions card and the Canvas banner | High | Yes |
| 2 | Planning with Tangent: Brief (draft, round 1) | Rejects the one-step plan on the day of the final. Replies in chat: spread over weeks, no Tue 3:30-5 (debate), nothing after 11pm | Medium | Yes |
| 3 | Planning with Tangent: Brief (revised draft, 5 steps) | Checks Tuesday and the 11pm limit, then taps Confirm | Medium | Yes |
| 4 | Planning with Tangent: saved confirmation | Reads "Saved 5 steps to your calendar" and taps "View in Calendar" | High | Yes |
| 5 | Calendar (Agenda, Nov 22 – Dec 12) | Ticks the circle on "Map all AP Chem units" (9:30 AM today) | Medium | Yes |
| 6 | Calendar with "How did it go?" card | Taps "Okay" | High | Yes |
| 7 | Calendar, check-in card expanded | Taps "About right", types the note "unit 6 and 8 are my weakest, start there", taps Save | Medium | Yes |
| 8 | Calendar after check-in Save | Looks for a confirmation and finds none. The next step is unchanged. Stops and marks the task unresolved | Medium | Yes |

## Per-screen detail

### Step 1 — Home (Capture / Today feed)
- **Action & thinking:** I skipped the long list and went straight to the "What do you want to add?" box at the top. I typed "AP Chem final" and tapped Add. I didn't know what "Goes to: Auto" meant, so I left it and assumed Tangent would sort it out. I ignored the "From Tangent" questions card and the "Connect Canvas" banner. I didn't type the date because I figured it already knew my final is Dec 17.
- **Clarity:** High · **Doubt:** Yes · **Time:** 12s
- **Emotional state:** Adding was easy because the box is right there. But the red "7 unread" and the huge "Coming up 17" list underneath made me tense, like I was already behind before I'd started.
- **Accumulated memory:** "I opened Tangent and it's a big feed with a 'Good morning', a pile of upcoming stuff and a red '7 unread' I'm choosing to ignore. I typed 'AP Chem final' into the add box and hit Add, assuming it knows it's Thursday Dec 17 because why wouldn't it. Now I want to see if it actually spreads studying over the next few weeks without landing on debate Tuesday or anything after 11."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step1.png`

### Step 2 — Planning with Tangent: Brief (draft, round 1)
- **Action & thinking:** I skimmed the heading and the only step, "Redo missed AP Chem problems - Thu, Dec 17 · 4:30 PM". I skipped "Why this plan". I didn't tap Confirm. I typed in "Reply to Tangent": "the final IS dec 17, i need this spread over the next few weeks before it, not one session on the day. no tuesdays 3:30-5 (debate) and nothing after 11pm" and tapped Send. One session on the day of the final is exactly the cramming I'm trying to stop.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 30s
- **Emotional state:** I was glad it found Dec 17 by itself. Then one session on the day of the final made me go "wait, what?" It felt like it missed the whole point. It was also weird that it quoted me on something I don't think I said. I gave it one correction. If the next version still crammed, I was done trusting it.
- **Accumulated memory:** This is the first trust test. "I typed 'AP Chem final' and it actually knew it's Dec 17, which surprised me. Then the 'plan' was literally one redo session at 4:30 on the day of the final, so basically cramming with extra steps. It also says I told it I 'lock in with real deadlines', and I don't know where that came from... I told it to spread things over the next few weeks and keep it off debate Tuesday and after 11, and nothing is saved until I hit Confirm, so I'm waiting to see if it actually listens."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step2.png`. The draft had one step on Thu Dec 17 at 4:30 PM, the day of the final. The "lock in" fact came from the shared account (test artifact).

### Step 3 — Planning with Tangent: Brief (revised draft, 5 steps)
- **Action & thinking:** I skimmed the five step titles and times. Tuesday's step is at 5:30, after debate, and nothing runs past 11pm. Then I tapped Confirm. I'm not sure whether this round only covers this week (it ends Nov 29 and mentions "round 2") or the whole run-up to Dec 17.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** not recorded by the evaluator
- **Emotional state:** Relieved. It actually kept debate and late nights free, and that's why I trusted it enough to hit Confirm. It was a little creepy that the reasons mentioned readings and problem sets I never told it about. I didn't stop over it, but I kept an eye on it.
- **Accumulated memory:** The mood moves from suspicion to cautious trust. "The redo actually listened: Tuesday is after debate, nothing after 11, and it's spread over this week. It only goes to Nov 29 though, with 'round 2' later, so I'm hoping it really keeps going until the 17th. It keeps saying things about me I never said, like Gatsby, Macbeth, problem sets and 'lock in with deadlines'... I'm hitting Confirm and expecting to see the steps show up in my calendar, not still be a draft."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step3.png`. The revised draft had 5 steps from Nov 22 to 29. The Tuesday step is at 5:30 PM with the line "Why Debate fills Tuesday 3:30-5", and nothing is after 11 PM. Tangent posted no text reply in the chat, only the revised plan. Gatsby, Macbeth and the Sunday upload in the Why lines are test artifacts.

### Step 4 — Planning with Tangent: saved confirmation
- **Action & thinking:** I read the bold "Saved 5 steps to your calendar." and "First up: Map all AP Chem units, Sun, Nov 22 · 9:30 AM". Then I tapped "View in Calendar" to make sure the steps were really there. There's no Done button on the step cards here, so I guessed I'd mark the step done in Calendar.
- **Clarity:** High · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** The check mark and "Saved" were a relief. It finally said the plan was in my calendar. I was a bit annoyed that there was no Done button right there, and that Tangent never actually answered my message.
- **Accumulated memory:** The worry about drafts is now gone. "I hit Confirm and it says 'Saved 5 steps to your calendar' with a check mark, so it's not a draft anymore, finally. But it only goes to Nov 29 with 'round 2' later, and it still says stuff about me I never told it... Now I'm going to Calendar to find 'Map all AP Chem units' and mark it done, because there's no done button on the plan itself."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step4.png`

### Step 5 — Calendar (Agenda, Nov 22 – Dec 12)
- **Action & thinking:** I found "Map all AP Chem units" at 9:30 AM in today's row (22). I tapped the empty circle on its left, which has the label "Done: Map all AP Chem units", not the title. After ticking it, I looked for a place to tell Tangent how it went and didn't see one yet.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 15s
- **Emotional state:** Finding my step at the top of today was a relief. But the pink/red outline on my Chem steps felt like a warning, as if I was already behind at 5:50 AM. Seeing "AP Chem final" ticked off on Nov 23 made me wonder whether the calendar understood my plan at all.
- **Accumulated memory:** Doubt shifts from Tangent's chat to the calendar's data. "The agenda is packed with stuff I don't recognise, like Codeforces, club pitches and Gatsby. It also shows 'AP Chem final' as done on Nov 23, which is weird and makes me trust the dates less... I've checked the step off, but nothing has asked me how it went yet."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step5.png`. The ticked "AP Chem final" on Nov 23, Codeforces and the club pitches are shared-account test artifacts.

### Step 6 — Calendar with "How did it go?" card
- **Action & thinking:** The card popped up right after I ticked the circle. I tapped "Okay" because the session was fine, not amazing. Then I looked for any sign that my answer had been saved.
- **Clarity:** High · **Doubt:** Yes · **Time:** 5s
- **Emotional state:** Relieved it asked me by itself so I didn't have to go looking. Three choices and no essay is exactly my speed. I was a bit wary that it would just vanish without showing it got my answer.
- **Accumulated memory:** The check-in shows up on its own, which counts in Tangent's favour. "A little 'How did it go?' card popped up with Nailed it / Okay / Struggled, and I hit Okay because it was fine, not amazing... Now I just want some proof it actually saved my answer and isn't going to quietly drop it."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step6.png`

### Step 7 — Calendar, check-in card expanded (time + note + Save)
- **Action & thinking:** The card got bigger instead of closing. I tapped "About right" under "How long it took". In "Anything to remember? (optional)" I typed "unit 6 and 8 are my weakest, start there" and tapped the pink Save. I don't know whether tapping Okay had saved anything by itself, or what happens to my note.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 14s
- **Emotional state:** When the card grew after Okay I had a small "wait, more?" moment, because it felt like I should have been done. It was still quick and nothing guilt-trippy, so I kept going. If Save didn't show me something like "got it", I'd assume it ate my answer.
- **Accumulated memory:** The expectation is now specific: Tangent should use the note. "I added that units 6 and 8 are my weakest and hit Save... Right now I really just need to see that it saved my answer and that it'll actually use the note on my next step, like 'Review notes on weakest units' at 3:30."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step7.png`

### Step 8 — Calendar after check-in Save (card closed, no confirmation)
- **Action & thinking:** I looked for any sign that "About right" and my note were saved and found nothing. I checked "Review notes on weakest units" (3:30 PM on the 23rd) to see if it now mentioned units 6 and 8. It didn't. I did every part of the task, but the last part was never confirmed, so I stopped and counted the task as unresolved.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 8s
- **Emotional state:** Let down. I typed something actually useful and it disappeared without a "got it". It felt like I was talking to a form, not a planner that pays attention.
- **Accumulated memory:** The run ends in uncertainty, not in trust. "I hit Save and the card just disappeared. No 'saved', and 'Review notes on weakest units' looks exactly the same, so I honestly don't know if it listened. Add the Codeforces and club pitch stuff that isn't mine and the Chem final showing as done on Nov 23, and I'm leaving without feeling sure it's all locked in."
- **Evidence:** `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step8.png`. After Save there was no toast or banner, the alert region stayed empty, and the next step did not change.

## Synthesis
- **Highest friction point:** Step 2, the first draft plan. It was one session ("Redo missed AP Chem problems") on Thu Dec 17 at 4:30 PM, the day of the final. That is exactly the cramming Maya came to avoid, so the first plan worked against her main goal. Getting a usable plan took a typed correction. This was the longest recorded step (30s) and the one that nearly broke her trust ("if the next version still crams I'm done trusting it"). It worked only because she knew what to ask for and was willing to type it.
- **Highest emotional friction point:** Step 8, after the check-in Save. She had just shared something useful ("unit 6 and 8 are my weakest, start there"), the card closed silently, and the next step stayed the same. This one moment turned a fully completed flow into "unresolved", and it left her feeling she was "talking to a form, not a planner."
- **Final decision:** She did not abandon. She finished every action in the task (capture, plan, correct, Confirm, View in Calendar, tick, check-in, Save) and stopped at step 8 with the task marked unresolved because the final action had no confirmation.
- **Emotional summary:** I started fine. The add box was right there, but the red 7 and the giant list made me feel behind before I'd done anything. When Tangent knew my final was Dec 17 I was honestly impressed. Then it planned one session on the day of the final, and I thought, great, an app that helps me cram. I told it what I needed, and the second plan actually respected debate and nothing after 11, so I trusted it enough to hit Confirm. "Saved 5 steps to your calendar" was the best moment of the whole thing. After that, small things kept chipping away: Tangent never answered me in the chat, the reasons quoted things I never said, the Chem steps had a red-ish outline, and the check-in turned into a mini survey. I still did it, because it was quick. Then I wrote something real about units 6 and 8 and it disappeared with no "got it", and my next step looked exactly the same. I left with a plan I mostly like and no idea whether Tangent was listening at the end.
- **Detected risks:**
  - Students who don't correct the first draft will save a cram-on-the-day plan. Maya caught it only because avoiding cramming was her whole goal. A student who taps the first obvious primary action (her default style) would have confirmed it.
  - A silent check-in Save makes students think their feedback was lost. They will stop writing notes, and the follow-through loop loses its most useful input.
  - Silent plan revisions: Tangent changed the plan after her message but posted no reply, so a fast skimmer has to work out what changed and whether her constraints were understood.
  - Round 1 ends Nov 29 while the final is Dec 17. With no clear "what happens next", a student may think the plan stops there, or simply not trust it to continue.
  - Why lines quote remembered facts with no visible source or way to edit them. In this run the facts were shared-account artifacts. Real users will also run into facts that are stale or misread, and with no way to trace them on screen, "creepy" becomes "untrustworthy".
  - Warning-looking colour: the red "7 unread" badge and the pink/red outline on her Chem steps read as "you're behind" to a student who reacts badly to guilt cues and red numbers.
  - The check-in card grows after the first tap. Fast users tap one choice and expect to be done. Some will close or leave it half-finished.
  - "Goes to: Auto" is unexplained at capture. It was harmless here, but it is a guess on the first screen.
- **Structural insight:** Tangent's planning loop already does the hard, differentiating work: it found the date, scheduled around a stated constraint, explained the reason, saved the plan to the calendar and asked for a check-in on its own. It loses the user at the two edges of the loop. At the start, the first draft doesn't fit the goal ("get ready for" means spread out, not on the day). At the end, the feedback the user gives is never shown being received or used. Trust is earned in the middle and lost at both ends. Every acknowledgment moment (chat reply, check-in Save) needs to show something visible, ideally the effect on the next step.
- **Fix this first:** On the Calendar check-in card, replace the silent close after Save with an inline confirmation in the existing alert region that repeats what Tangent kept and what it will do with it. For example: "Got it: Okay, about right. I'll point 'Review notes on weakest units' at units 6 and 8." Also show the note on that next step, as a Why or note line. This is the one change that would have turned this run from "unresolved" into "resolved".

**Tangent-specific checks**
- **Context (did Tangent use what this person said?):** Partly. It used her schedule constraints: the revised plan put Tuesday at 5:30 PM with the line "Why Debate fills Tuesday 3:30-5", kept every step before 11 PM, and spread 5 steps over Nov 22-29 instead of one session on Dec 17. It found the Dec 17 date by itself, but that may come from data already on the shared account. On screen, it did not use her check-in note: "unit 6 and 8 are my weakest, start there" left "Review notes on weakest units" unchanged (step 8). It also never replied in words to her correction. The Why lines quoting "lock in when there's a real deadline", Gatsby/Macbeth and the Sunday upload came from the shared account (test artifact). They still confused her about what Tangent knows.
- **Different from generic apps (Todoist/Notion/ChatGPT):** Yes, in the middle of the flow. Todoist or Notion would have made her schedule five sessions by hand around debate. ChatGPT could write a study plan but can't put it in her calendar, explain each time slot against her real week, or ask how a session went. Tangent did all of that: "Saved 5 steps to your calendar", per-step Why lines, and the automatic "How did it go?" card. Where it fell to generic or below: the first draft (one session on the final day is worse than a ChatGPT answer), the silent revision, and the check-in note that went nowhere visible, which made it "a form".
- **Follow-through (check-ins, round review, daily bubble):** The check-in appeared on its own right after the tick (step 6), which she valued ("relieved it asked me on its own"). Its weak point is the missing confirmation and the card expanding after the first tap. Round review: the plan is labelled round 1, ending Nov 29, with "round 2" mentioned, but the run did not get that far, so it can't be judged here. That label is also where her uncertainty about coverage up to Dec 17 came from. Daily bubble: not seen in this run.
- **Trust (what is stored, can they control it):** Not shown on her path. "What is stored about her" is a required item in her profile, and no screen in this run showed it or let her review or edit remembered facts. Why lines cite remembered facts with no visible source, so she kept asking herself "where is it getting that?" (steps 2, 3, 4). Trust in scheduling was earned (debate and the 11pm limit were respected). Trust in memory was not, partly because of the shared-account artifacts, and partly because there was no visible source or control at the point where facts are quoted. The run does not show whether controls exist elsewhere in the product.

## Potential improvements

| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Calendar, "How did it go?" card, after Save (step 8) | After Save, show an inline confirmation in the alert region ("Got it: Okay, about right. Next: 'Review notes on weakest units' will start with units 6 and 8") and add the note to the next related step | The missing confirmation alone made a completed task "unresolved", and it teaches users that notes are pointless. |
| 2 | Planning with Tangent: Brief, first draft (step 2) | When the capture is a test or final with a known date, don't place the only step on the exam day. Spread the first draft over the days before it, with at least one step this week, and keep exam-day steps to a light review | The first draft worked against the user's main goal. A tap-the-primary-button user would have saved a cram plan. |
| 3 | Planning with Tangent: chat, after a correction (step 3) | Post a one-line reply with the revised plan that repeats the constraints back ("Spread over this week, Tuesday after debate, nothing after 11pm") | Fast skimmers need proof their message was understood without comparing two plans step by step. |
| 4 | Planning with Tangent: Brief and saved screen, round label (steps 3-4) | Next to "round 1", add one line that covers the whole run-up: "This week: 5 steps. Round 2 plans Nov 30 – Dec 6, up to your final on Dec 17" | Her ongoing doubt was whether the plan stops at Nov 29, and that undercuts trust in the whole schedule. |
| 5 | Why lines that quote remembered facts (steps 2-4) | Make a quoted fact tappable, showing "From: [where it was said]" with Edit and Forget options, or drop personal-fact quotes from Why lines when their source can't be shown | "Where is it getting that?" came up on three screens. Without a visible source and control, remembered context feels creepy instead of helpful. |

Evidence screenshots: `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-step1.png` through `maya-okafor-r2-step8.png` (same folder). Step log: `D:\TANGENT showcase\TANGENT demo\docs\overnight2\sims\maya-okafor-r2-steps.md`. Profile: `D:\TANGENT showcase\TANGENT demo\user-simulation-tests\simulation\profiles\maya-okafor-j3a.md`.
