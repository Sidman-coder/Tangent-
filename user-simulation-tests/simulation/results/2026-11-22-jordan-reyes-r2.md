# Simulation report — Jordan Reyes (varsity soccer player, 10th grade, end user)

Run: overnight 2 Phase 8 (round 2), Playwright, 390x844, production build on push-v1.

**Task:** Add something from your week that you need to get ready for, get Tangent to plan it into your calendar, save the plan, then mark the first step done and tell Tangent how it went.
**Result:** Abandoned
**Steps:** 4 (cap 15) · **Total estimated time:** 46 s

> **Run context:** Playwright, phone viewport 390x844, production build. The test account is shared. The greeting says "Leo", and other personas' projects and items, including the ones at 3:30 and 4:30 PM in "Coming up", are left over from earlier runs. The account has no record of Jordan's soccer schedule. The Playwright browser has no microphone, so "Say it" logged one console error. This report covers what the persona saw (no feedback at all), not the missing mic. The persona said it would tap Undo at step 4, but the run stops on abandonment, so Undo was never tapped. The "Geometry quiz" item is still on the account for Fri, Nov 27, 4:30 PM.
>
> **Role-task fit:** Fits, with a caveat. The profile's suitable tasks centre on the Environmental Club plan around soccer. This task is a general add-and-plan for a school item. It still tests Jordan's main trust condition (no steps during 3:30-5:30 Mon-Fri or Saturday mornings), so the run is valid. It does not tell us anything about the club-plan path.

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | Home (Capture / Today feed) | Skims the times, taps "Type or say anything…", taps "Say it" and speaks "Geometry quiz Friday, I need to study for it" | Medium | Yes |
| 2 | Home after tapping "Say it" (no visible response) | Taps "Say it" again and speaks again. Nothing appears, so gives up on voice and types "geometry quiz friday" | Low | Yes |
| 3 | Home with "geometry quiz friday" typed | Taps the round Add arrow and leaves "Auto" alone | Medium | Yes |
| 4 | Home with "Added Geometry quiz for Friday at 4:30 PM" status | Reads the time, sees it is during practice, says it will tap Undo and close the app (abandons) | Medium | Yes |

## Per-screen detail

### Step 1 — Home (Capture / Today feed)
- **Action & thinking:** I check the times first. The box at the top that says "Type or say anything…" is obviously where to start, so I tap it, hit "Say it" and say "Geometry quiz Friday, I need to study for it". I'll tap Add after. "Coming up" has a lot of stuff at 3:30 and 4:30 PM on weekdays and Saturday morning, which is exactly practice and game time. I don't know what "Goes to: Auto" means, so I'm ignoring it.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 14s
- **Emotional state:** Suspicious from the start. All those 3:30 PM steps make me wary, because that's practice, and if Tangent puts my stuff there too I'm done. The box at the top is easy, so I'll give it one shot.
- **Accumulated memory:** "Opened Tangent and the home screen is a giant list. What jumped out was a ton of steps at 3:30 and 4:30 on weekdays, and that's when I'm at practice. I'm adding my geometry quiz with the mic and hoping it actually plans around soccer, because if it sticks a step in 3:30-5:30 I'm out. No clue what 'Goes to: Auto' is, I'm just leaving it." *(Baseline. Trust is already conditional before the first input.)*

### Step 2 — Home after tapping "Say it" (no visible response)
- **Action & thinking:** I tap "Say it" one more time and talk again. The box is still empty, so I give up on the mic and type "geometry quiz friday" with my thumbs. I talked and nothing happened: no words in the box, no listening sign, no error, no permission popup. I can't tell if it heard me, if it's still working, or if it's just broken.
- **Clarity:** Low · **Doubt:** Yes · **Time:** 20s
- **Emotional state:** Annoyed. I said the whole thing and nothing came out, like I was talking to nobody. Voice was the whole reason this seemed easy, so now I'm typing, and I already trust the app less.
- **Accumulated memory:** "...I tried to add my geometry quiz with the mic and nothing happened. No words, no 'listening', no error, so I don't know if it's broken or I did something wrong. I'm typing it now. If it plans anything during 3:30-5:30 after all this, I'm done..." *(Change from step 1: the practice-time worry is now joined by a broken-tool feeling. The threshold sharpens from "hoping it plans around soccer" to "if it does, I'm done.")*

### Step 3 — Home with "geometry quiz friday" typed
- **Action & thinking:** The Add arrow lit up once I typed, so I tap it to send "geometry quiz friday". I still don't know if the mic is broken, and "Goes to: Auto" means nothing to me, so I'm hoping Auto works out that it's school stuff.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 6s
- **Emotional state:** A bit relieved that the arrow turned on, because at least something reacted to me. Still annoyed about typing after the mic failed twice, and bracing for it to put my studying into practice time.
- **Accumulated memory:** "...I tapped the mic twice and got nothing, no listening sign and no error, so I gave up and typed 'geometry quiz friday'. The Add arrow finally lit up, so I'm sending it and ignoring 'Goes to: Auto' because I have no clue what it does. If it puts quiz studying anywhere in 3:30-5:30 or on Saturday morning, I'm out." *(Change from step 2: the hard line now includes Saturday morning. "Auto" moves from ignored to a small hope.)*

### Step 4 — Home with "Added Geometry quiz for Friday at 4:30 PM" status
- **Action & thinking:** I read the time first: "Geometry quiz for Friday at 4:30 PM". That's the middle of practice, so I tap Undo and close the app. The confirmation is easy to read, but I never gave it a time, so it picked one, and the one it picked shows it doesn't know my schedule. "Heads up: Friday is now over your usual load" doesn't tell me what to do next either.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 6s
- **Emotional state:** "Seriously, 4:30 on Friday? I'm on the field then." It invented a time that lands on practice and then told me Friday is "over my usual load," which feels like blaming me. Done.
- **Accumulated memory:** "...It said it added it for Friday at 4:30 PM, which is smack in the middle of practice, plus some warning about my load. Nobody asked me when I'm free. It just guessed and guessed wrong, so I undid it and I'm out. It never even got to planning, and I never saved a plan or finished a step." *(Change from step 3: the hard line from step 1 is crossed. Trust goes from conditional to gone, and the task is marked unresolved.)*

## Synthesis
- **Highest friction point:** Step 4, the add confirmation. The persona typed no time, but the app silently gave the item a specific clock time (4:30 PM) without asking. That time breaks the persona's one non-negotiable rule. The only follow-ups offered were Undo and a load warning, with no way to change the time and no route into planning. This is where the flow broke.
- **Highest emotional friction point:** Also step 4. The silent mic at step 2 started the loss of trust ("like I was talking to nobody"), but the invented 4:30 PM time ended it at once. The "over your usual load" line made it worse, because it read as blame for a problem the app created.
- **Final decision:** Abandoned at step 4 of 15, right after the first add. The persona never reached planning, saving a plan, marking a step done or the check-in. It said it would tap Undo, but the run stopped first.
- **Emotional summary:** I opened it already uneasy, because the first thing I saw was a pile of stuff at 3:30 and 4:30, which is when I'm at practice. I gave it one shot anyway because the box at the top looked easy. Then I talked into the mic twice and got nothing, not even a "listening" or an error, and I felt kind of stupid. So I typed it, and at least the arrow lit up. Then it told me it put my quiz on Friday at 4:30. I never said 4:30. It just made that up, and it landed right on practice, the one thing I said would make me quit. And then it warned me my Friday was overloaded, like that was my fault. It never asked me anything. I didn't even get to the planning part.
- **Detected risks:**
  - Students with fixed after-school commitments (sports, jobs, care duties) get times they never gave, and the first wrong time ends the session for anyone with a hard line.
  - "Say it" gives no listening state, no permission prompt and no error when the mic isn't available. Voice-first users (on the walk home) decide the app is broken before they add anything. The missing mic here comes from the test environment, but the lack of any feedback is a product issue.
  - "Auto" (perceived as "Goes to: Auto") is never explained. Users ignore it and can't predict where items land.
  - The add flow ends at a toast. Nothing visibly leads from "Added X" to "plan this", so the "plan → done" half of the product never shows up for a first-time user.
  - The load warning describes a problem without offering a fix. Users who dislike being lectured take it as blame.
  - Users like Jordan assume Tangent already knows their practice schedule (a listed wrong assumption). Nothing on screen tells them it doesn't, or invites them to say so.
- **Structural insight:** The capture step defaults to inventing details instead of asking. That goes against the project's own rule to "ask only when the answer would change the plan". A clock time for a deadline item is exactly the kind of answer that changes the plan. The Home screen already has a "A few questions to sharpen your plans — Answer / Hide" card (visible in the step 1 and step 4 screenshots), but it sits apart from the add action, and the persona never connected the two. Asking already exists in the product. It just isn't attached to the moment where its answer matters.
- **Fix this first:** When a capture has a date but no time (for example "geometry quiz friday"), don't assign a clock time. Save it as all-day/deadline "Fri, Nov 27". Replace the toast with one inline question that has a Skip: "Added Geometry quiz · Fri, Nov 27. When are you busy that week? [Add my schedule] [Skip]". Show "Plan study time" as the main button next to Undo.

## Potential improvements

| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | Home, add confirmation after capture (step 4) | If the input contains no time, store the item as a date-only deadline ("Fri, Nov 27") instead of "4:30 PM". Change the toast to "Added Geometry quiz · Fri, Nov 27" with a main button "Plan study time" and a secondary Undo. | The invented time broke the persona's only trust rule, and nothing in the toast pointed toward planning, which is the rest of the task. |
| 2 | Home, add confirmation / first planning hand-off | When the account has no recurring busy blocks, ask one skippable question before placing anything: "Any times you're always busy? (e.g. practice Mon-Fri 3:30-5:30)" with Skip and Stop. Treat the answer as a hard constraint in all later planning. | Students assume their fixed schedule is already known. One question would have avoided the 4:30 PM clash and is the kind of question the project's ask rule allows. |
| 3 | Home, "Say it" button (steps 1-2) | On tap, immediately show a visible "Listening…" state with a live waveform or transcript. If mic access fails or is denied, show inline text: "Can't use the mic. Check permissions or type instead." Don't fail silently. | Two silent attempts cost 20 seconds and much of the persona's trust before anything was added. Voice is this profile's preferred input. |
| 4 | Home, load warning in the add toast (step 4) | Replace "Heads up: Friday is now over your usual load." with a concrete next action, e.g. "Friday is full. Move to Thursday?" with a one-tap option. | A warning with no action reads as blame to someone who hates being lectured, and gives no "one clear next action". |
| 5 | Home, "Auto" destination selector next to the capture box (steps 1, 3) | Show what Auto resolved to after each add (e.g. "Saved to School"), and add a one-line hint on first use: "Auto picks School, Projects or Personal for you." | The persona ignored the control at every step and couldn't tell where the item would go. Showing the result builds trust in Auto without extra effort. |

## Tangent calibration checks

- **Context (did Tangent use what this person said?):** Partially, and it failed where it counted. Tangent parsed "geometry quiz" and "friday" correctly and resolved Friday to Fri, Nov 27. Then it added a time (4:30 PM) that Jordan never gave. It did not ask about availability, and it did not show whether it would use the "I need to study for it" intent (that part was spoken, and the mic captured nothing). The account has no soccer schedule, so Tangent couldn't have known practice times. But it also didn't say it didn't know, and it didn't ask. Caveat: the 3:30 and 4:30 PM items that alarmed Jordan at step 1 belong to earlier test personas.
- **Different from generic apps (Todoist/Notion/ChatGPT):** Not shown in this run. What Jordan saw (natural-language quick-add with a parsed date and an Undo toast) looks like Todoist's quick add, plus a made-up time. The one Tangent-specific behaviour, the load warning, came across as a scolding with no fix rather than a strength. Planning, questions and check-ins, the features meant to set Tangent apart, were never reached.
- **Follow-through (check-ins, round review, daily bubble):** Not reached. The run ended before planning, so no plan was saved, no step was completed, and no check-in, round review or daily bubble appeared. The "A few questions to sharpen your plans" card was on Home throughout (step 1 and step 4 screenshots), but the persona never noticed or used it.
- **Trust (what is stored, can they control it?):** Low. Control: Undo was right there and clear, which is a plus, though the run never tapped it. Transparency: nothing told Jordan what Tangent knows about their schedule, why it chose 4:30 PM, or what "Auto" does. The mic gave no permission prompt or status. The hard line (no steps during practice) was broken on the first add, and the profile treats that as the end.

**Evidence:**
- Step log: docs/overnight2/sims/jordan-reyes-r2-steps.md
- Profile: user-simulation-tests/simulation/profiles/jordan-reyes-s8k.md
- Screenshots: docs/overnight2/sims/jordan-reyes-r2-step1.png through jordan-reyes-r2-step4.png. Step 4 shows the toast "Added Geometry quiz for Friday at 4:30 PM. Heads up: Friday is now over your usual load." with Undo and "On your calendar · Fri, Nov 27".
