# Decision: Talk first, plan only when asked

**Date:** 2026-11-14 · **Status:** Accepted in code (Round 5A, Phase 2), pending Sid's phase sign-off · **Supersedes in part:** [2026-11-grill-sufficiency.md](2026-11-grill-sufficiency.md) for goals typed on Home, `/capture`, task and project chats, and ⌘K

## Context

From Round 4, "help me…", "get better at" and "how do I…" were treated as plan requests. A student asking a question got grill cards and then a calendar plan they hadn't asked for. Sid's Round 5A prompt says the AI chat should answer first, like a person would, and only plan when the student says so.

## Decision

- One router for every entry point, `lib/pipeline/talk-route.ts` `routeMessage`: `action | add | answer | plan`.
- A goal ("help me get better at competitive programming") gets a real, topic-specific **answer** in markdown, using what Tangent knows (with "Since you mentioned…" recall, `lib/student/recall.ts`). If the goal could go on the calendar, the answer ends with **Plan this into my calendar · Not now**.
- **Plan** only on an explicit phrase ("plan it", "put this on my calendar", "make me a schedule for…") or the button.
- Planning asks **at most one** question, as plain text in the thread, with a skip. Everything else becomes a stated assumption in the brief. Grill cards no longer show for Home goals.
- The plan is a draft (preview → Confirm / Edit / Discard) every time, whatever `TANGENT_PIPELINE_V2` says (Sid's Q3).

## What still holds from grill-sufficiency

Never ask what's known, and always stoppable. The "until enough" loop still runs for the paths that use it (project chats' Grill me). Talk-first replaces only the automatic grill on a typed goal.

## Alternatives considered

- **Keep planning on "help me…".** Fastest to a plan, but it's the behaviour Sid flagged. A question deserves an answer.
- **Ask whether to plan or talk before answering.** One more tap for every message. The button after the answer gives the same choice without the delay.
- **Keep the Plan it / Just talk toggle.** Redundant once the answer offers the button. Removed (Phase 0 default a).

## Consequences

- The eval fixtures that expected "help me…" to plan (`requests.json` `r4-help-me-sat`, `r4-how-do-i-get`; `round2.json` `route-help-me-prepare-for-the-sat-in-december`) test the plan pipeline's classifier, which only runs once planning was asked for, so their expectations stay. The talk-level routing for the same phrases is pinned in `lib/pipeline/fixtures/talk-first.json`.
- PROJECT.md's "Plan: 2–3 questions" and the "Clear goal phrasings skip the intent classifier" line need updating once Phase 2 is accepted.
- Risk: students who wanted a plan have to tap once more. Watch how often **Plan this** is tapped after an answer. A high rate on goal answers means the router should offer planning sooner.
