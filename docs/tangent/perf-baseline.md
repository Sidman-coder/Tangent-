# AI cost and speed — baseline

Captured 2026-09-27 on `feat/ai-cost-speed` before any change (base `e7be442`). This is the "before" half of [perf-after.md](perf-after.md).

## Method

- Each scenario is sent through `POST /api/chat` (Calendar mode), in-process, as a throwaway student created for the run and deleted afterwards. The student is freshly onboarded (America/New_York, high school), with no Canvas feed and an empty calendar.
- The calls are real: real Claude API calls and real Supabase (RLS session client).
- Usage comes from each Claude response's `usage` block, captured by wrapping `fetch` in the measurement script. The dev-only `[perf]` trace lines agreed with it. No app code was changed to measure.
- **Total** is wall time for the `/api/chat` request.
- **Time to first task** equals the total today: plan tasks are inserted only after the whole planner response arrives, and the response returns after the inserts.
- **DB** is the sum of PostgREST call durations. Parallel reads overlap, so this sum can exceed wall time.
- **Background** calls are fire-and-forget context extraction (`lib/context-extract.ts`), which runs after the response is sent. It isn't in the total, but it is in the cost.
- **Est. cost** uses list prices. Sonnet 4.5 is $3 / $15 per M input/output tokens; Haiku 4.5 is $1 / $5.
- Cache columns are all 0: no request uses `cache_control` today.

## Results

| Scenario | Total | Claude calls (in request) | DB | Est. cost |
|---|---|---|---|---|
| "help me get better at chess" | **46.5 s** | 2: voice command + plan generator | 33r / 22w, 5.4 s | $0.0440 |
| "2 week AP Bio plan" | **53.3 s** | 1: plan generator | 28r / 22w, 5.1 s | $0.0480 |
| "remind me to call the dentist tomorrow at 3pm" | **7.7 s** | 1: voice command | 15r / 4w, 2.0 s | $0.0119 |
| "soccer every Tuesday and Thursday" | **1.2 s** | 0 (deterministic recurring path) | 12r / 6w, 1.7 s | $0.0005 |
| "what's due this week?" | **5.8 s** | 2: agent tool loop, 2 turns | 16r / 2w, 1.8 s | $0.0223 |

### Per call

"in" is uncached input tokens. Cache write and cache read were 0 for every call.

| Scenario | Call | Model | max_tokens | in | out | ms |
|---|---|---|---|---|---|---|
| chess | voice command (classifier) | claude-sonnet-4-5 | 4096 | 3017 | 23 | 2330 |
| chess | plan generator | claude-sonnet-4-5 | 4096 | 1582 | 1956 | 39237 |
| chess | context extraction (bg) | claude-haiku-4-5 | 300 | 407 | 26 | 1817 |
| AP Bio | plan generator | claude-sonnet-4-5 | 4096 | 1583 | 2842 | 48096 |
| AP Bio | context extraction (bg) | claude-haiku-4-5 | 300 | 408 | 32 | 1067 |
| dentist | voice command | claude-sonnet-4-5 | 4096 | 3045 | 151 | 6006 |
| dentist | context extraction (bg) | claude-haiku-4-5 | 300 | 409 | 8 | 1341 |
| soccer | context extraction (bg) | claude-haiku-4-5 | 300 | 406 | 26 | 1343 |
| due this week | agent tool loop turn 1 | claude-sonnet-4-5 | 2048 | 3320 | 58 | 2117 |
| due this week | agent tool loop turn 2 | claude-sonnet-4-5 | 2048 | 3418 | 49 | 2153 |
| due this week | context extraction (bg) | claude-haiku-4-5 | 300 | 438 | 8 | 761 |

## Observations

- **Plans are dominated by one call.** The plan generator is 84% of the chess total and 90% of the AP Bio total. It streams out 2.0–2.8K output tokens at about 50–59 tok/s.
- **Chess pays for a classifier first.** "help me get better at chess" matches none of the plan keywords, so it goes through the 3K-token voice-command classifier (2.3 s) before re-entering as a plan.
- **Plan inserts are chatty.** The DB work is 20+ writes per plan:
  - one `addTask` per task
  - then `addPlan`
  - then one `updateTask(planId)` per task
  - plus a `getCalendars` read per task
- **The dentist reminder uses the full Sonnet classifier.** That's a 3K-token prompt and 6.0 s for a single task with an explicit date and time.
- **"What's due this week?" takes two Sonnet agent turns** (6.7K input tokens total). The answer could come from the DB with a template.
- **Every chat turn also fires a Haiku context-extraction call** (≈400 in / ≤32 out), even when there's nothing durable to learn.
- **Nothing is cached.** The 3K-token voice and agent prompts are resent in full on every request.
