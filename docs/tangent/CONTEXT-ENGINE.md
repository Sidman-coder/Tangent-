# Part 2: The context engine, Tangent's black box

## The short answer to your question

You asked whether projects should build on the results of earlier tasks, or ask more specific questions first. **Do both, in this order:**

1. **Ask a few high-value questions up front**, and stop as soon as you have *enough* (not a set number).
2. **Plan a short first round** (about a week, 3–7 steps). Call it "Round 1", not "the plan".
3. **After each step, collect the outcome** in one tap: how it went, what came out of it, how long it took.
4. **Plan the next round from those outcomes** plus everything Tangent knows about the student.

| Approach | Strengths | Weaknesses |
|---|---|---|
| **More questions only** | Better first plan | Still a guess. Students quit long question flows, and anyone can copy questions. |
| **Build on outcomes only** | Learns what actually works for this student | Round 1 is generic, and it's slow to get good |
| **Both (recommended)** | A good first round, then each round gets more personal. Outcome data is the part no one can copy. | More to build: check-ins, rounds, a question engine |

**Why this is the moat:** prompts and UI can be copied in a week. What can't be copied is **months of one student's real behaviour**: how long their steps actually take, when they actually work, what they skip, and what worked last time. On top of that comes **high-school-specific knowledge** refined across many students. Every week a student uses Tangent, it gets harder for them to leave and harder for a competitor to match.

## What actually makes it hard to copy (honest ranking)

| # | Advantage | Why it's hard to copy | Weakness |
|---|---|---|---|
| 1 | **Each student's outcome history** (planned vs actual, check-ins, skips) | A new app starts at zero for that student | Only builds up if students actually do check-ins, so they must be 1 tap |
| 2 | **Calibration** (time multiplier, best hours, step size per student) | Comes from #1, gets better over time | Needs a few weeks of data per student |
| 3 | **High-school playbooks** (AP, SAT, college apps, clubs, sports, creator goals) with typical steps, timing and failure points | Takes real research plus outcome data across students | Must be maintained every year (dates change) |
| 4 | **School-aware context** (Canvas, school hours, finals and AP season, sports seasons) | Integrations and calendars are tedious to build | Each school is a bit different |
| 5 | **Eval suite** ("swap test", rubric graders) | Quality bar competitors don't have | Needs upkeep; paid runs cost money |
| 6 | **Prompts and UI** | Easy to copy | **Not a moat.** Keep them private, but don't rely on them. |

**Keeping it a black box in practice:**
- Prompts, playbooks and grading rules stay **server-side only**, never sent to the browser.
- Keep the repo **private**.
- AI activity shows *which facts were used*, never the prompt itself.

## The engine: 6 layers

### Layer 1: Student model (who they are)
A structured profile, not a pile of text. Every fact stores:
- **value**: e.g. "Can focus about 30 min"
- **category**: Identity, Schedule, Goals, Classes & activities, How you work, What's hard, Future
- **source**:
  - *said*: the student told us
  - *seen*: Tangent observed it from behaviour
  - *guessed*: the AI inferred it, needs confirming
- **confidence** and **last confirmed** date
- **used in**: which plans used it

Rules:
- **Seen beats said** when they conflict. Example: they say "I work best in the morning" but finish 80% of steps after 8 PM. Tangent then asks: "Looks like evenings work better for you. Plan there?"
- **Guessed** facts are never shown as truth until confirmed.
- Facts get stale. Anything older than about 60 days gets a light re-check.
- Facts are written **in the second person and specifically**: "You do your best work late at night", not "Does their best work: Late at night". Vague facts like "A big test" trigger a follow-up ("Which test, and when?").

High-school categories to fill over time:
- **Identity:** grade, age, school type, first name
- **Schedule:** school hours, recurring commitments (practice, work, tutoring, lessons, family), seasons
- **Classes & activities:** AP/honors classes, clubs (TSA etc.), sports, job
- **Goals:** this year (grades, AP exams, SAT, varsity, a project), and the future (major, career, dream)
- **How you work:** best hours, focus length, hours per school night, planner or not
- **What's hard:** *forgets things* / *overwhelmed by too much* / *procrastinates* / *starts strong, fades* / *doesn't know where to start* / *perfectionist*
- **How to push:** gentle, direct accountability, or only when asked

### Layer 2: Observation log (what they actually do)
Record every meaningful event:
- step created, done, skipped, "Not today" (with a one-tap reason), "Too big", rescheduled, dragged
- what time it was done, and how long it took (from the check-in)

From this, compute per student:
- **time multiplier**: actual ÷ planned
- **completion rate by time of day and by day**
- **ideal step size**: how often they hit "Too big"
- **slip pattern**: what kind of step gets skipped

These feed the planner automatically.

### Layer 3: Question engine (ask only what's missing)
Every goal type has a list of **slots** to fill:

| Slot (all goals) | Example question |
|---|---|
| Outcome: what "done" looks like | "What would make this a win for you?" |
| Why | "What's this for? College, fun, money, something else?" |
| Starting point / level | "Where are you starting from?" |
| Horizon / deadline | "Is there a date this has to be done by?" |
| Time available | "How much time a week can you give this?" |
| What's worked or failed before | "Have you tried this before? What happened?" |

Goal-type extras:
- **Exam:** test date, current score or practice score, weak topics
- **Creator / social:** platform, current followers, niche, how often you post now, what's done well
- **Club / team:** approval steps at your school, how many members, advisor
- **Essay / application:** deadline, prompt, drafts so far

**Rules:**
- A **"Tell me anything about this"** box is visible from the start, beside the questions. Whatever they type there gets read first, and slots it fills are skipped.
- Ask 1–3 questions at a time. Each question is tied to a slot.
- **Stop when the must-have slots are filled.** Say: "I have enough to start round 1. Add anything else anytime." No endless "I still need more."
- Skip and Stop stay available but are small and quiet.
- Answers save as **facts** (Layer 1), so the student is never asked the same thing twice across projects.

**Your Instagram example:** Tangent should have asked roughly 3 things before planning: *How many followers now? What's your niche? How much time a week?* It asked nothing, so the plan was generic.

### Layer 4: Planner in rounds (build on outcomes)
- **Round 1:** 3–7 steps, about 1 week, sized to the student's step size and placed in their best hours. The project page says "Round 1 · started Nov 8", not "Ends Nov 15".
- Each step has a **"what you'll have after this"** line, e.g. "A written niche statement". That makes outcomes easy to check.
- **On Done:** a 1-tap check-in, which can be skipped:
  - How did it go? (Nailed it / Okay / Struggled)
  - What came out of it? (short text, optional)
  - Did it take less, about the same, or more time than planned?
- **On repeated "Not today":** one tap for the reason (no time / unclear / not feeling it / blocked).
- **Round review:** when about 70% of a round is done, or the round ends, show a card summarising how it went with **Round 2 proposed**, using the usual preview, confirm and undo. Round 2 uses the outcomes ("Your first Reel got 120 views, so Round 2 focuses on hooks").

### Layer 5: Context pack (what the AI sees each time)
Every AI call (planning, chat, project chat, re-plan) gets a **context pack** built by one function, with a size budget:
1. **Top 10–15 relevant facts**, ranked by relevance to this goal plus confidence plus recency
2. **This project's state:** steps, outcomes, round, open questions, and the prior Q&A
3. **Calendar load for the next 14 days**, plus fixed commitments
4. **School calendar context:** finals week, AP season, the sports season they're in
5. **Calibration numbers** (Layer 2)
6. **The matching playbook** (Layer 6)

The pack records **which facts were used**. "How this was planned" and AI activity show them in plain words ("Used: you can give 4 hrs a week · you work best late at night"). Being transparent about this builds trust, and it shows students that Tangent *gets* them.

### Layer 6: High-school knowledge (playbooks)
Server-side JSON files, one per common high-school goal:
- AP exam prep (by subject)
- SAT / ACT
- college essay
- college applications
- scholarship
- starting a club
- a TSA or other competition project
- sports season
- learning an instrument or skill
- social / creator growth
- a part-time job search
- a class grade rescue

Each playbook has:
- typical phases
- typical step sizes and durations
- common failure points
- key questions (slots)
- date anchors, e.g. "AP exams are in early May", "Early Action is usually Nov 1". **Re-check these every year.**

Start with **5 playbooks** (AP exam, SAT, college essay, club, creator growth) and grow from outcome data.

## Making the AI more specific (techniques)

1. **Use the student's own words** in step titles and notes ("your TSA robotics build", not "the project").
2. **Grade-aware:** a 9th grader and a 12th grader get different advice and timing for the same goal.
3. **Structured output** with a required `personal_reason` per step: *why this step, for this student*. Reject a step if the reason is generic.
4. **The swap test (key eval):** run the same goal with two different student profiles. If the plans are nearly the same, the test fails. Track this score each round.
5. **Calibrated estimates:** planned minutes × the student's time multiplier.
6. **Tone:** short, warm, direct, teen-appropriate. No lectures, no "As an AI".
7. **One chat per place:** planning continues in the chat where it started, and the project chat keeps all its Q&A history. The AI always sees what was already asked.

## Metrics to track

- **Questions per plan:** aim for 2–5
- **Personal facts used per plan:** aim for 3 or more
- **Swap-test pass rate**
- **Check-in answer rate:** aim for over 50%
- **Round 2 rate:** % of projects that reach Round 2. This is the core "Tangent follows up" metric.
- **Time-estimate accuracy over weeks:** should improve
- **7-day and 30-day return rate**

## Privacy and safety for teens (important; not legal advice)

- **Age gate:** ask age in onboarding. **Under 13: don't create the account** (US COPPA rules). Show a friendly message.
- **Store the minimum.** Never store health, mental health, family conflict or other sensitive details as facts, even if a student types them. If a message shows real distress, respond kindly and point to help (a trusted adult, or 988 in the US). Don't turn it into a task.
- Students can **see, edit and delete** every fact (What Tangent knows), export their data, and delete everything.
- Never sell or share student data. If you later work with schools, FERPA rules apply. Get advice before school pilots.

## Roadmap

| When | What |
|---|---|
| **Round 4 (now)** | Student model fields (source, confidence), slot-based questions with "enough" stopping, the always-visible context box, rounds plus 1-tap check-ins plus round review, the context pack plus "facts used", fixing fact wording, deeper onboarding, the swap test in evals |
| **Round 5–6** | Calibration from the observation log, the first 5 playbooks, a school-calendar layer (finals, AP season), "seen beats said" prompts |
| **Later** | Cross-student learning for playbooks (anonymized, with consent), Canvas grades and due dates in planning, Tange as the persistent companion that runs check-ins |
