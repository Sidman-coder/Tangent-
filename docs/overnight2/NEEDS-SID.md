# Needs Sid (overnight 2)

Still gated tonight: billing, any auth or sign-in change other than the approved public-path gate change, any data deletion other than the approved Disconnect and "Forget everything" changes, and schema changes. Proposed migrations go in `docs/overnight2/proposed-migrations/` and are not applied.


## Home header "next:" (L3, O2-D14)
The line under the greeting names the next fixed item and skips plan steps, on purpose (a pinned test). In L3 it said "next: weekly video upload at 6:00 PM" while a plan step at 9:30 AM came first. Should the header name the next plan step instead? One-line change in `lib/today-sections.ts` `glanceLine` plus its test.

## SMART (Sonnet) features left, for the free tier (O2-D17)
- Still on SMART: plan, planOutline, agent, chatPlan, dailyBrief, pathBranches, clarify (plan questions), contextImport, pathIntake, grillNext, extendPlan, planBrief, planFix.
- To apply "free users get Haiku only" to these too, Tangent needs a plan field per student. That's billing or schema, so it's gated.
- Proposal: `callClaude` takes `opts.plan`; for "free", every SMART feature downgrades the same way the daily-budget downgrade does now (`lib/ai/call.ts:205`).

## Voice token 502 on the local build (overnight 2, Jordan sim)
- `/api/voice-token` returned 502 ("Deepgram grant failed") during the sim. Live streaming then falls back to record-and-upload. Please check on a phone that "Say it to Tangent" shows a listening state, and that the Deepgram key can call `/v1/auth/grant` (a key without that permission gets 403 → our 502). I didn't read or change any key.

## Stated weekly busy times aren't kept for later captures (Jordan, Maya)
- "Soccer practice Mon-Fri 3:30-5:30" shaped the first plan, but nothing stores it as a busy block, so a later single capture can still land at 3:30. Proposal: when a request states a weekly time with an activity, offer "Add soccer practice as a busy block?" (a one-tap draft through the existing commitments path, `cmt_` series). It's a product choice, so I haven't built it.

## Legal pages (Phase 5): what I changed from the draft, and what's still open
These pages are live in the code at `/privacy`, `/terms` and `/parents`, effective 2026-11-22. They aren't legal advice; please have someone review them before a wider launch.

Checked against the code and changed [code]:
- Age: 13+ stores nothing; under 13 stores only that flag (`app/api/age/route.ts`). The draft said "we keep your answer". Now: "If you're 13 or older, the answer isn't stored."
- Voice: Tangent doesn't keep audio. It keeps the words of the last 100 voice commands (`MAX_VOICE_LOGS` in `lib/store.ts`), so the policy says so.
- AI decision records are deleted after 90 days (`app/api/cron/proactive/route.ts`). Kept.
- Canvas link: masked in the UI and left out of the export (`lib/canvas-feed-security.ts`). **I did not claim it's encrypted.** Encryption happens only if `CANVAS_FEED_KEY` is set, and I can't see production env. If it's set in Vercel, you can add "stored encrypted" to the Canvas row.
- Removed the draft's line that sign-in emails come "from Google". I couldn't verify the sender. Supabase Auth sends magic links unless a custom SMTP is configured.

Open, needs you:
1. **"Within 30 days, including logs"** is a promise. The code deletes immediately (`/api/reset`, `/api/account/delete`), but Vercel and Supabase log retention isn't something I can see. Check both plans' log retention is ≤30 days, or soften the line.
2. **Anthropic Usage Policy and minors.** The AUP (effective Nov 12, 2026) treats under-18s as minors. It says products serving minors must follow additional safeguards in a support article. Tangent serves 13–17. Please read it and confirm we meet it (age gate, sensitive-topic handling, disclosure that it's AI). https://www.anthropic.com/legal/aup
3. Governing law "State of Georgia, USA" is from the draft; confirm.
4. A parent "deletion request by email" is a manual process; someone has to own that inbox.

Sources checked 2026-11-22:
- Anthropic, no training on commercial or API data: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training ("By default, we will not use your inputs or outputs from our commercial products"), and the Commercial Terms https://www.anthropic.com/legal/commercial-terms ("Anthropic may not train models on Customer Content from Services").
- Anthropic, 30-day API deletion: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data ("For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days", except zero-retention agreements and Usage Policy enforcement; flagged content up to 2 years).
- Deepgram opt-out: https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program ("Add `mip_opt_out=true` as a query parameter of all API requests"; "retained only for the duration necessary to process the request"). The streaming parameter is at https://developers.deepgram.com/reference/speech-to-text-api/listen-streaming. The opt-out may change Deepgram pricing (the docs don't state it); check the next invoice.

## AI routing questions from the Phase 2 fix loop
- **A goal with no deadline: plan or talk?** Eval `r4-help-me-sat` ("help me get ready for the SAT", no date) passes 1 time in 4. The plan pipeline's classifier sometimes calls it a question. The live talk-first route answers first and offers "Plan this into my calendar", which I think is right. Should the eval expect talk-first (answer + offer) for a goal with no deadline, or a plan straight away? A one-line fixture change either way.
- **Round2 fixture misses** (`--round2`, 55/66, [ran] `docs/overnight2/eval-round2-phase2.log`):
  - title 7/12: mostly the title repeats the project name, or no title is extracted. The fixtures may be stricter than needed.
  - slot 13/16.
  - route 15/16: the only miss is "what's due this week". It's answered by rules on purpose (O2-D39), so the fixture should probably expect the rules route.
  - Tell me whether to loosen these fixtures or tighten the prompt.

## AI judge proposals left for Sid (AI-JUDGMENT-1)
- **Weekly busy times** (all 3 judges): remember stated practice and shift times as recurring commitments. This needs a write path from talk to `commitment` tasks, so it's a product call.
- **One plan per goal** (student, coach): when a new goal matches an open project ("Algebra 2 final" vs a live round-2 project), offer "Add to <project>?" instead of a second plan.
- **The check-in changes the next step** (differentiation): "Struggled" could add a 10-minute review before the next step and say so in one line. This is a new rule on top of the check-in, so it needs Sid.
- **Question pile** (student, coach): cap open capture questions per project (e.g. 3) and drop stale ones after a week. The Home line now says "a few" (O2-D43); the pile itself is unchanged.
- **Plans cover the first round only** (coach, dissent): the coach wants every plan to reach the deadline. The rounds design says later rounds cover the rest. The chair kept rounds; flagged in case Sid wants a whole-goal outline line in the brief.

## Planner: a fact from one project steering another (3.4 live)
- The chess plan's step 3 used the Python CP round-1 answer "More practice" as its reason. The wording is fixed (O2-D45), but whether review answers should apply only to their own project is a product choice. Option: tag review facts with the project id and let the brief see them only for that project.

## Phase 5 follow-ups
- **Store the commitment kind on tasks.** Work colour is inferred from the Work project plus a job-like title (O2-D47). A `commitment_kind` column would make it exact. Schema change, so not done.
- **You, mapped restyle** (JUDGMENT-2 N11 LATER, F09 rest): bring the map onto the app's flat surface (no cream stage, glow or brown dark tint) so editable facts start in the first viewport. A design call for Sid.
- **Next up after Confirm**: the card shows only when nothing is left today. Whether it should also lead right after a new plan is confirmed is open.

## Phase 6 follow-ups
- **Google Disconnect**: Gmail and Calendar use one server-side token, not a per-student link, so there is nothing per student to disconnect yet. Add it when Google becomes per-student (Sid approved the pattern).
- **Run one real Canvas Disconnect** on a test account that has a real feed. "Remove the items" was proved by store tests only (O2-D55), because the test account has no feed and only `*.instructure.com` links are accepted.
- **Consent wording**: "Continuing means you're OK with that" is notice-and-continue, not a separate checkbox. If Apple review or a lawyer wants explicit consent, it becomes a checkbox on the same screen.
## Phase 7 follow-ups (CONTEXT-ENGINE-NOW.md)
- **Habits missing from "Download your data"**: `step_events` is not in `EXPORT_TABLES` (`lib/settings/data-export.ts`). The student can see and forget the habits in You but can't download them. Adding the table is one line, but export is data handling, so it waits for you.
- **Log the pack size per call**: `picture.tokens` is computed and never logged. A `[perf] pack <purpose>: N tok, dropped [...]` line would show the pack's real share of each call and any `fitBudget` drops. No AI cost, but it touches every AI route's logging.
- **Profile document**: section 6 lists 12 gaps (no merge or dedup, no expiry for dated facts, stated shifts never become busy blocks, grill duplicates, no learned project names). Which of them to build is a product call.
- **Project matching**: "practise dancing", "my dances", "coding", "insta" and "SAT" all miss their project (section 5 probe table). Options: stem both sides the same way, count 3-letter acronyms, save a `plan_aliases` row when the student picks a project after a miss. Your call on which.
