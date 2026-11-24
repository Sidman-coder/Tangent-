# INVESTOR-REVIEW: three independent reviewers, merged

Date: 2026-11-18. Three fresh subagents with no shared context and no personal details were given only file paths in this repo (JUDGMENT-1/2, LAUNCH-REVIEW, CONTEXT-REVIEW, NEEDS-SID, AI-SPEND, the six persona sims and summaries, and the `screens/after/` screenshots): **(Y)** a YC-style partner, **(V)** a seed VC for consumer and education apps, **(C)** a high-school counselor and teacher. Each wrote its review in its own words. This file is the merge. I did not change any verdict.

Labels: **FACT** = in a repo file or screenshot (named). **INFERENCE** = reasoned from facts. **OPINION** = a reviewer's judgment or background knowledge about markets, not a fact about Tangent.

**There are no real user numbers.** Tangent has no users, no retention, no revenue and no interviews. Nothing below invents any. The persona sims are six synthetic AI-driven personas, one run each, in round 1 (before most fixes). They show where friction might be, not what real students feel.

## Verdicts

| Reviewer | Verdict | Would students like it? |
|---|---|---|
| Y (YC-style partner) | **NOT YET** | **Partly** (planning yes; follow-up and trust no) |
| V (seed VC, consumer / edu) | **NOT YET** | **Partly** |
| C (counselor / teacher) | **NOT YET** as a product worth backing at pre-seed | **Partly** |

Unanimous. All three call the shell credible and the engine unproven.

Student verdict by persona (FACT from the sim summaries, as cited by the reviewers): Maya liked it ("Finally got a plan that fits my week"). Priya liked the plan, then hit silence after Confirm. Sam got a good plan, then called false praise "fake". Jordan gave up ("I tapped Done and got a questionnaire"). Leo gave up ("In Notion I'd at least have a page"). Dana (synthetic parent) left at sign-in ("I'm not typing my email").

## Where all three agree

**Strengths**
1. **Plans fit real constraints** (SIGNIFICANT, positive). FACT: Maya's plan avoided debate Tuesday 3:30 to 5 and her 11 pm cutoff; Priya's avoided her shifts and ended before Jan 5; Jordan's first step landed at 7 PM, clear of practice (persona summaries, "What works"). INFERENCE: the only evidence of a real product edge, and it is round-1, one run each.
2. **A trust pattern teens can read** (MINOR to SIGNIFICANT). FACT: nothing is saved until Confirm; Undo; a per-step "Why"; Skip and Stop on questions; facts can be seen and forgotten (JUDGMENT-1 s5, CONTEXT-REVIEW s6). C: "I would keep this."
3. **Calm shell, no guilt copy** (MINOR). FACT: `final-home-390.png` shows one status line and no past-due count; C10 FIXED in JUDGMENT-2. Caveat (C, FACT): the test account had nothing overdue, so the "behind" state was never shown.
4. **AI cost looks disciplined** (Y, V). FACT: one context assembler, a token budget per call, no analytics or ad SDKs, about $0.27 for a 147-call eval, plan brief is 65% of cost (CONTEXT-REVIEW s1, s2). Cost per student is "argued, not measured" and `ai_usage` does not record the task.

**Weaknesses**

| # | Weakness | Rank | Evidence |
|---|---|---|---|
| 1 | **The core loop was never seen working end to end.** The AI credit balance was empty, so the plan, chat and capture fixes are code and unit tests only. | **FATAL** (Y, V, C) | DECISIONS D6; JUDGMENT-2 N02. Round-1 sims: Maya's capture dropped a quiz and overrode her days; Leo's Confirm said "6 steps" and made no project. |
| 2 | **No evidence anyone comes back.** "Follows up" is half the pitch and was never observed (C21 NOT FIXED). Home is calm but gives no reason to open it tomorrow (N06). None of the six reports records an intent to return. | **FATAL** (Y, V; C: significant) | JUDGMENT-2 C21, N06; Jordan, Sam, Leo, Priya summaries; `final-home-390.png`. |
| 3 | **No public privacy, terms or parent page.** A parent cannot read anything before signing in. Student text goes to Anthropic and audio to Deepgram with no distinct consent step. Sign-in copy has been softened in code (N04) but not seen signed out. | **FATAL for distribution** (C, V); significant (Y) | LAUNCH-REVIEW B1 and 5.1.2; JUDGMENT-2 N03; Dana summary. |
| 4 | **AI is a single point of failure.** With credit empty every AI feature fails; offline or on failure the typed words are lost (N01, N05). | SIGNIFICANT | LAUNCH-REVIEW B2, S1. |
| 5 | **Business model is blank.** No billing code; who pays and how much is undecided; a parent-paid subscription inside an iOS wrapper falls under Apple's in-app-purchase rules. | SIGNIFICANT (all three) | LAUNCH-REVIEW s3, NEEDS-SID. |
| 6 | **Differentiation is thin and copyable.** Scored 6 and never re-tested. Leo (power user) saw no edge over Notion. OPINION: voice capture, AI scheduling and Canvas import are crowded and copyable; a moat would be a per-student history that does not exist yet. | SIGNIFICANT | JUDGMENT-2 s1; Leo summary. |
| 7 | **Not launchable on the App Store.** Web wrapper with no native features, no reviewer account, Sign in with Apple undecided. Also no security headers or rate limits. | SIGNIFICANT for launch, MINOR for a pilot | LAUNCH-REVIEW B3, B4, S4, S5. |
| 8 | **Minors' data and wellbeing** (C). Observed habits are not cleared by "Forget everything"; no per-connection Canvas disconnect. The "Tangent knows enough: 33%" meter could read as grading; planned post-event reviews could feel like pressure. | SIGNIFICANT (C) | CONTEXT-REVIEW s6; NEEDS-SID; JUDGMENT-2 N12. |
| 9 | **Small polish gaps in the reviewers' screenshots.** Capture said "Nothing to do" while Home showed an item; identical truncated titles on Calendar; the You-map clips a label; two mics on Projects. | MINOR | `final-capture-390.png`, `final-calendar-390.png`, `settings-context-390-dark.png`, `final-projects-390.png` as the reviewers saw them. **Since fixed in the last commit** except the You-map label clip (see MORNING-REPORT). |

## Criteria, one line each

| Criterion | What the reviewers said |
|---|---|
| Problem reality | **No evidence in the files** (no interviews, survey or usage). OPINION (all three): overload and poor spacing of work is plausible and familiar; a planner is a low-urgency "vitamin" unless it lowers real stress. |
| Why now, alternatives | OPINION: cheap LLMs make per-student planning affordable (founder's own estimate $0.04 to $0.20 per student per month, unverified). Alternatives students already have: Canvas, Google Calendar, Apple Reminders, Notion, Todoist, ChatGPT pasted directly. The real test is beating a free ChatGPT habit. |
| Differentiation, defensibility | The claimed edge is a context engine plus follow-up. INFERENCE: the context engine is real in code; follow-up is unbuilt. OPINION: defensibility is low until student data and habit exist. |
| Would users come back | **Very weak evidence.** Only negative retention-adjacent signals in the sims (Sam near closing the app, Leo and Jordan gave up, Priya hit the step cap). Round 1, synthetic, one run each. |
| Business model | Undecided. LAUNCH-REVIEW lists four options (student IAP, free in app plus paid on web, free pilot, school sale). OPINION: the parent is buyer and the student is user, yet the parent has nothing to read; a teen often has no payment method; Apple's cut applies; the viable first path is a free, invited pilot. |
| Risks | Minors' data is the most serious (no public policy, no consent line for AI or voice). App Store review is blocked. AI cost is cheap on paper but unmeasured, and the demo breaks the day credit lapses. |

## Riskiest assumption and the cheapest test (all three converge)

**Assumption:** a student types one real sentence, gets a plan they trust and confirm unaided, and opens the app on day 2 without a nudge.

**Cheapest test, in order (about a day and a few dollars):**
1. Top up the API credit (about $5). Run one real sentence from typing to Confirm to next-day Home. Re-run the six persona sims and `npm run eval:pipeline` (about $0.30).
2. Publish a minimal privacy and parents page. (C adds: ask 3 parents and 2 teachers "would you let a 15-year-old use this?")
3. Run a 10-student, 3-day concierge pilot with a human sending the follow-ups. Measure first-session unaided confirm rate, unprompted day-2 open rate, check-in answer rate, and AI cost per student per day (needs the `ai_usage.task` migration, NEEDS-SID). OPINION (Y, V): pass bar of at least half confirming unaided and at least half returning on day 2.

## What would change their minds (merged)

1. A recorded live run where a check-in answer visibly changes tomorrow's plan.
2. A real pilot where over half confirm unaided and return on day 2 (their bar, not a measured number).
3. Measured cost per student.
4. A public privacy and parents page, a consent line for AI and voice, and a working Canvas disconnect.
5. A stated payer and a simple price path.
6. (C) A school or counselor willing to say where it sits: a tool students bring themselves versus a school-approved one.
7. (V) Any sign students prefer this over pasting into ChatGPT.

## Where the reviewers differ

- **Severity of the missing parent page:** C and V rank it FATAL for distribution; Y ranks it SIGNIFICANT. It is not fatal for an invited pilot.
- **Retention:** Y and V call it FATAL for an investment case; C calls it SIGNIFICANT.
- **Wellbeing and school policy:** only C raises them (AI reliance, the "33%" meter, post-event reviews as pressure, district rules on AI tools). These are OPINION and untested; no school or parent has been asked.
- **Cost as a strength:** Y and V rate it a positive; C does not weigh it.

## Method notes and limits

- Reviewers read repo files and six screenshots; Y did not open the full persona transcripts.
- They saw some screenshots from before the final fix commit (`18518ab`). Item 9 above was fixed there. Not re-reviewed.
- The internal scores (4.7 to 5.7) were produced by an AI panel scoring itself. Chat, planning quality and differentiation were carried over unchanged. None of the reviewers treats them as evidence.
- Reviewer text above is paraphrased from their reports; the rankings and labels are theirs.
