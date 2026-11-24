# Proactive notifications, cheaper (Phase 4)

Tags: **[ran]** = measured from server logs on the test account; **[code]** = read in code or unit-tested only.
Design and code: DECISIONS O2-D24. Code: `lib/proactive.ts`, `lib/proactive-rules.ts`; tests in `lib/proactive-rules.test.ts`.

## What changed
| | Before | After |
|---|---|---|
| Where it runs | `NotificationBell` on every app page load | Home (`/`) and Calendar (`/calendar*`) only [code]; a visit to `/projects` on server9 logged no trigger [ran] |
| How often | every load | at most once per 4 h per student, any trigger; `proactiveAt` in `profiles.notification_prefs`, no schema change [code]; 6 later loads logged `skipped: within 4h` [ran] |
| Who decides | Haiku, every time | plain-code rules: overdue, due within 48 h, a goal step that slipped [code, 6 tests] |
| Wording | Haiku | templates for overdue and due-soon; Haiku only writes the reschedule suggestion, picking one of 3 slots code found [code] |
| Nothing qualifies | Haiku call anyway | no call (`nothing qualifies, no AI`) [code] |
| Daily cron | same Haiku call | same rules and gate; students with nothing get no call [code] |

## Calls per visit [ran]
- **Before** (`server-phase1.log`, Phase 1): 16 page-load triggers → **16 Haiku calls**, 1,499 tokens in and 114–160 out each, **$0.00026 per call** on average, $0.0041 in total. All 16 notices were then **deduped**: money spent and nothing shown.
- **After** (`server3.log` to `server9.log`, builds 3–8): 7 page-load triggers → **0 Haiku calls**. One full run (server3: `Generated: 1 notifications | AI calls: 0`, templates only) and 6 gate skips.
- A reschedule run (the only case that calls Haiku) didn't occur live tonight. The test account had no slipped goal step at a run. Its cost is estimated from the prompt [code]: about 600 tokens in and at most 400 out, **≤ $0.00026 per run**.

## Estimated monthly cost per active student
Assumes 10 app page loads a day (an assumption, not measured), Haiku at $0.10 / $0.50 per million tokens (`lib/ai/models.ts`).

| | Calls a month | Cost a month |
|---|---|---|
| Before | 10 × 30 page loads + 30 cron = 330 | **≈ $0.085** [ran per-call cost × assumed visits] |
| After, nothing slipped | 0 | **$0** |
| After, typical (one slipped step a day) | ≈ 30 | **≈ $0.008** [code estimate] |
| After, worst case (a slipped step at every allowed run, 6 a day) | ≤ 180 | **≤ $0.047** [code estimate] |

The worst case is capped by the 4-hour gate. Before, it grew with every page load.
