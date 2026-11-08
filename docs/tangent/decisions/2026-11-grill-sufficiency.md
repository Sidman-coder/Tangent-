# Decision: Grill me asks until enough, not up to three

**Date:** 2026-11-05 · **Status:** Accepted (Round 2, Phase C)

## Context

Grill me used to ask at most three questions in a row. The cap protected students from long interviews, but it was the wrong limit in both directions: a vague request ("help me with my project") got a weak plan after three questions, while a clear one ("chem test Friday, chapter 4") still got questions it didn't need.

## Decision

- Tangent tracks **context slots** for each request (deadline, what's done, time available and so on), fills them from what the student said and what Tangent already knows, and scores **sufficiency**.
- It asks one question at a time, about the slot that would change the plan most, until the plan is good enough, then drafts it.
- It never asks what it already knows. Every question has **Skip**, and the student can **Stop** at any time and get a plan from what Tangent has.
- AGENTS.md now says: "Ask until enough, never what's known, always stoppable."

## Alternatives considered

- **Keep the three-question cap.** Predictable, but it under-asks on vague requests and over-asks on clear ones.
- **One long form up front.** Fast to build, but it reads like a survey and asks things the student already said.
- **Never ask; always guess.** Calmest, but plans built on guesses get rejected, and a rejected plan costs more than a question.

## Consequences

- Clear requests now go straight to a plan; vague ones get as many questions as they need, with Stop always available.
- The risk is asking too much. The pilot measures the **Grill stop rate** (`docs/tangent/pilot-metrics.sql`, query 4); a high rate means the sufficiency bar is too high.
