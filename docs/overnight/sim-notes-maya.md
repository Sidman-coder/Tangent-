# Maya run: orchestrator notes (feeds the Tangent-specific section of the report)

Run on the production build, `push-v1`, signed in as the test account (populated, not reset; see DECISIONS D5). The test account's name is "Sid", so the greeting says "Still up, Sid?" to Maya. That is a test artifact, not a product finding.

Evidence (screenshots in `docs/overnight/screens/before/`):
- `sim-maya-step2-tour-modal.png`: second modal ("Tangent in two minutes", 1 of 12).
- `sim-maya-step3-draft-plan.png`: the draft plan after the first capture.

## Observed (steps 1-3)
1. Home opens with a "One question" modal. Dismissing it ("Not now") brings up a second modal, "Tangent in two minutes" (12-step tour). Two stacked prompts before the add box is usable. Evaluator emotional state: irritated, "if one more thing blocks me I'm out".
2. Typed "AP Chem unit exam Friday, Precalc quiz Tuesday" into the add box and pressed Enter. The box showed "Placing “…”…" for roughly 30 seconds (WAIT on text gone) before the draft plan appeared. 30 s is slow for a phone student who "notices when something feels slow".
3. The draft plan ("Planning with Tangent") shows:
   - One step only: "AP Chem unit exam prep", Wed, Nov 18, 7:00 PM. The Precalc quiz is not in the plan.
   - "What I assumed": "No day given, so Tangent picked the lightest day with room" and "No time given". The typed text contained "Friday" and "Tuesday", so this reads as ignoring what Maya said.
   - "What I used about you": 6 facts from the test account (e.g. "You do your best work late at night"). Good: the reasons are visible. Gap: they are the account's facts, not Maya's.
   - "Nothing is on your calendar until you confirm." Good: the draft state is explicit.
   - A 7:00 PM step on Wed Nov 18, while the clock reads 1:00 AM Wed: the step is about 18 hours away, fine.
   - Buttons: Confirm, Edit, Discard; a "Reply to Tangent" box ("Ask about it, or tell me what to change…").

## Open for later steps
- Does "Reply to Tangent" count as "the chat"? Maya's task says "ask the chat how to prepare for the Chem final".
- Does the plan avoid Tuesday debate 3:30-5:00 after she tells Tangent about it?
- Cost: each capture is one real AI call (Haiku, plus planner). Tally in the spend log once the run ends.

## Observed (steps 4-6)
4. Maya tapped Confirm. Result: "Added 1 step to your calendar." with Undo. Clear, but only one step went in. Friday exam and Tuesday Precalc quiz are not on the calendar ("Coming up 0").
5. The page looked unchanged, so the evaluator only looked at the reply box (no tap).
6. Declared action: type "how do I prep for the AP Chem final? it's Thursday Dec 17, and I have debate Tuesday 3:30-5" into "Reply to Tangent" and send. NOT EXECUTED: by the time I took a fresh snapshot (about 40-60 s after Confirm) the "Planning with Tangent" view had closed on its own and Home was showing. Cause unknown (timer or navigation); observed, not investigated. The reply box was therefore gone after Confirm. Recorded as friction per the skill ("element doesn't exist: let the next step perceive it").
   - Home now shows "1 left today", Evening: "AP Chem unit exam prep, 7:00 PM", grouped under **Personal** (it is school work). Finding: school exam prep filed as Personal.

## Observed (step 7-8)
7. Maya typed into the Home box (Auto routing): "How do I prepare for the AP Chem final on Thu Dec 17? I have debate Tuesday 3:30-5:00" and pressed Enter.
8. Result (no wait needed; screenshot `sim-maya-step8-asks-when.png`): it was NOT answered as chat. Tangent opened "A few quick questions so this fits you." with a "Tangent knows enough: 25%" bar and the question **"When is this?"** (This week / 2 weeks / 1 month / End of term / Type answer; "If you skip: about 2 weeks"; Skip; Stop and plan).
   - **Finding (high):** the date ("Thu Dec 17") and the debate time were in the sentence. Asking "When is this?" is asking what Tangent already knows (AGENTS.md guardrail: "never what's known"). The Skip default "about 2 weeks" is wrong for a Dec 17 final (4 weeks away).
   - **Finding:** a "How do I..." question did not get an answer. For a phone student who asked for help, the chat answer is the value; she got an intake form. Skip and Stop and plan are present and never block (guardrail met).
   - Good: "Skip" and "Stop and plan" are visible; the progress bar says what Tangent knows.

## Observed (step 8 evaluated, step 9 screen)
8. Evaluator: Maya taps "Stop and plan" ("not answering questions before I see a plan"). Annoyed; "one question away from leaving". Executed.
9. Result (screenshot `sim-maya-step9-stop-and-plan-asks-again.png`): the screen is now "Talk with Tangent" (chat). Her message is shown, and Tangent's reply is **another question**: "Which AP Chem units feel shakiest right now (like equilibrium, kinetics, or thermodynamics)?" No plan, no answer to "how do I prepare".
   - **Finding (high):** "Stop and plan" did not plan. After a visible "Stop", the user got a second question. This breaks the guardrail "always stoppable: Skip and Stop that never block". It also counts as the 2nd question before any value; Maya's own threshold is "more than two".
   - Positive: it is a real chat, and the question is specific and relevant (not already known). It has a free-text reply box ("Reply, or ask anything…").
   - Open: whether "Stop and plan" produced a plan elsewhere (Home "Draft plans" region, nothing visible); a waited 30 s with no plan.

## Observed (step 9 evaluated, step 10 screen)
9. Evaluator: Maya types "Equilibrium and kinetics. Just give me the plan, no more questions, and nothing during debate Tuesday 3:30-5:00 or after 11pm." and sends. Executed. Plan appeared in under 25 s (waited on "Confirm" signal).
10. Result (screenshot `sim-maya-step10-real-plan.png`, full page): a real 5-step "Round 1" plan for the AP Chem final:
   - Wed Nov 18 5:00 PM Rework kinetics rate laws; Fri Nov 20 7:00 PM 8 kinetics mechanism problems; Sat Nov 21 7:00 PM equilibrium Q vs K; Mon Nov 23 7:00 PM timed equilibrium FRQ set; Tue Nov 24 7:00 PM review FRQ gaps ("waits until after debate").
   - Each step has a **Why** sentence (debate-aware, evening, 3 hrs school night) and an "You'll have ..." outcome. Strong: this is the trust moment the persona wanted. Debate respected, nothing after 11 PM, Tuesday step after 5 PM.
   - "What I used about you" is now only 3 facts and all match what she said (cleaner than the first draft's 6 unrelated account facts).
   - Weak spots: (a) assumptions list leaks a project template: "Starting from the idea stage", "Standard milestones: idea, research, build, write-up, practice", "Working on your own, with check-ins you can share with a teacher" (none of that is about studying for a final). (b) "Your goal runs to Tue, Dec 15" while the final is Thu Dec 17, and only 7 days are planned ("later rounds cover the rest"); the 4-week lead-up is not visible. (c) The new plan was made AFTER the earlier "AP Chem unit exam prep" step existed; it references it ("Tonight's 7pm exam prep is already on your calendar") which is good continuity. (d) The Friday AP Chem unit exam and Tuesday Precalc quiz from her first capture are still missing from the calendar.
   - Total questions before value: 2 (When is this? + which units). 2 is at Maya's threshold, but the first was already answered by her sentence.
   - Conclusion for the task: "ask the chat how to prepare" -> got intake questions, then a plan; no standalone prep advice text was ever shown.

## Observed (step 10 evaluated, step 11 screen)
10. Evaluator: Maya taps Confirm ("plan looks workable ... I want to see some sign afterward that it's actually on my calendar"). Relief, still annoyed by the wall of assumptions and the missing Friday exam. Executed.
11. Result (screenshot `sim-maya-step11-confirmed.png`): status "Added 5 steps to your calendar." with an Undo button. The plan page stays open. Good: explicit confirmation + Undo (matches her "sign afterward" need).
   - Time from first keystroke to confirmed plan: about 10 minutes of wall clock for the orchestrator, but the product-side waits were ~30 s (first capture), 0 s (question panel), ~25 s (plan after chat answer).
   - Overall for the run: task reached (tests captured partly, prep plan made around debate, confirmed) but the "tests" capture lost the Friday exam and Tuesday Precalc quiz, and "ask the chat how to prepare" produced two questions, not advice.

## Summary of findings for the Tangent-specific section
- Context: first draft used the account's 6 stored facts, not what Maya typed; second plan used 3 facts and all were on point. Transparency ("What I used about you" / "What I assumed") is a strength; the leaked "idea stage / research / build / write-up" milestone template is a weakness for exam prep.
- Different from generic apps: a plan with a Why per step and a confirmed draft state is unlike a to-do list; but the chat did not answer "how do I prepare" with advice.
- Follow-through: "tell me how they went and I'll plan round 2" is shown; no reminder or check-in time is stated on this screen.
- Trust: draft-until-confirm, Undo, debate and 11 PM respected in the second plan; first plan ignored Friday/Tuesday words.
