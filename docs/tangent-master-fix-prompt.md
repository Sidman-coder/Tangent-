# Tangent: Master fix prompt (bugs from Prompt 3 testing + chat experience + calendar polish)

Paste the whole block below into Claude Code (local, TANGENT demo folder, on branch `pipeline-v2/3-understanding` with everything committed). It's long on purpose. It works in phases and runs tests between them.

```
MASTER FIX: Tangent AI experience. Work through Phases 0–7 in order. After each phase, run npm run build + npm test and fix anything you broke before moving on. Don't commit, push, or touch Supabase. New migrations go in new files after 20261012000000 and are NOT run (add each one to section A of docs/tangent-pipeline-final-checks.md). Only stop to ask me if something is truly ambiguous or destructive. Otherwise make the best call, note it, and keep going. At the end, give me one combined summary.

North star: talking to Tangent AI should feel like talking to Claude, ChatGPT or Gemini (fast, streamed, natural, minimal UI), but better at PLANNING because it knows the student's calendar, projects, capacity and history. Every change to the calendar is visible, understandable and undoable. TANGENT_PIPELINE_V2 stays the gate for pipeline behavior; UI and calendar polish apply in both flag states unless noted.

READ FIRST (then write a short plan per phase before coding):
- lib/pipeline/* (intent, understand, match, pending-question, intake, changeset, apply, apply-core, undo-core, draft, extend-plan, titles, decisions, activity, grade, fixtures), lib/chat-reply.ts, lib/voice-handler.ts, lib/voice-agent-tools.ts, lib/ai/models.ts, lib/ai/call.ts, lib/ai/router.ts
- Juann's systems: lib/spacing.ts, lib/load.ts, projects (addTasksToPlan, ProjectChat, ProjectAsk, InlinePreview), the questions-before-acting flow (question cards, ClarifyCard, answers handling in app/api/chat/route.ts, questions inbox), student context builder, What Tangent knows
- UI: app/(app)/ai/page.tsx, components/console/* (ChatThread, turns, composer), components/PreviewCard.tsx, components/ActionReceipt.tsx, components/RecentChanges.tsx, components/UndoToast.tsx, components/CommandPalette.tsx, the chat sessions list/sidebar, app/(app)/calendar/page.tsx and its day/slot components, globals.css design tokens (Liquid Glass)

══════════ PHASE 0: Reproduce before fixing ══════════
Write automated reproductions (unit/integration tests with a mocked model) for each bug in Phase 2 BEFORE fixing it, so every fix is proven. Also confirm, by reading the code, which path produced each screenshot behavior below with the flag ON.

══════════ PHASE 1: Model upgrade (FAST tier → Claude Haiku 5.5) ══════════
- Context: Claude Haiku 5.5 (model id reported as "claude-haiku-5-5", released Oct 7, 2026) is reported at $0.10 input / $0.50 output per MTok for prompts ≤100K tokens ($0.50 / $2.50 above 100K). Cache read is $0.01 and the 5-minute cache write $0.125 (≤100K). Its tokenizer produces ~30% more tokens than Haiku 4.5's. Haiku 4.5 ($1 / $5) may be retired after Oct 15, 2026. VERIFY the model id and prices against Anthropic's official docs/pricing before changing anything, and tell me if anything differs.
- Switch the FAST tier in lib/ai/models.ts to Haiku 5.5. Update the PRICES table used for ai_usage cost and budgets (including the >100K tier rule, even though our prompts are far below it), the eval cost estimate, and the minimum-cacheable-length comment.
- If Haiku 5.5 has an effort setting, use the lowest effort for router/classification calls and default effort for anything that writes student-facing text. Document your choice.
- Check prompts and JSON-schema calls still validate (stricter or looser output). Keep a one-line fallback to Haiku 4.5 if a Haiku 5.5 call errors with model-not-found, so a bad id can't break the app.
- SMART tier: Sonnet 5.5 is listed at the same price as Sonnet 5 ($2 / $10). Switch SMART to Sonnet 5.5 if the official docs confirm it, with the same not-found fallback.
- Re-estimate cost per request in the eval --check output.

══════════ PHASE 2: Bugs from testing (flag ON unless noted) ══════════
Transcript 1 (no plan contains "writing"; the SAT plans are "SAT Reading Score Boost" and "SAT Math Geometry Sprint"):
  me: take out all my SAT tasks
  ai: "sat" matches more than one plan: "SAT Reading Score Boost", "SAT Math Geometry Sprint". Which one should I delete?
  me: The writing thingie   → ai: Sorry, which one? "SAT Reading Score Boost", "SAT Math Geometry Sprint", or "all of these".
  me: the writing stuff     → ai: I still couldn't tell which one, so I didn't delete anything.
  me: deltet my writing stuff for sat → ai: (nothing deleted, no useful reply)

Transcript 2:
  me: (a delete) → tapped "All of these"
  ai: Deleted 19 tasks and the plans "...", "...", "...".   ← saved WITHOUT a preview card, and the same text appears twice (message + receipt)
  me: Help me prepare for ISEF
  ai: A few quick questions so this fits you. (questions shown as plain bullet text, not the question card)
  me: STEM research · 2-3 months · Just starting
  ai: Added "ISEF STEM Research Prep": 30 sessions... Created plan... Undo   ← saved WITHOUT a preview card; the student never saw the plan

Fix all of these:
B1. Every AI write goes through the preview when the flag is on. Audit EVERY path that creates, changes or deletes tasks/plans/projects, and route each one through a ChangeSet + preview: the questions-answered path, clarify-answer deletes ("All of these"), project creation from the main box, voice-agent tools, the dock and the palette. List each path and how it previews now. Only instant quick adds/completes stay instant. Recurring tasks and Gmail/Canvas get a preview too (they were known gaps).
B2. No duplicate text. A change shows ONE message: a short natural sentence plus the card/receipt, never the same sentence twice.
B3. Questions always render as the question card (never plain bullet text), in the AI page, project chat, palette hand-off and calendar day chat.
B4. After the questions are answered, the student SEES THE PLAN before it's saved. Show the full preview card (every session with day/time, the assumptions including "spaced around busy days / moved off full days", and Confirm / Edit / Discard / Just talking).
B5. Smarter answer resolution for clarify questions:
   - Typo-tolerant intent words ("deltet", "delte", "remvoe", "cancle").
   - Semantic fallback: when fuzzy matching can't decide, ask the FAST model to pick from the candidate list (ids + titles + a one-line description of each plan's tasks) and return candidate ids or "none". Never let it invent ids.
   - When the student names something that doesn't exist ("writing" when only Reading and Math exist), say so plainly and offer the closest match: "You don't have an SAT writing plan. The closest is SAT Reading Score Boost (reading & writing). Delete that?" with buttons [Delete SAT Reading Score Boost] [Pick another] [Cancel].
   - Never end with "I couldn't tell" twice in a row. The second time, show the candidates as buttons plus a free-text "Other…".
B6. Multi-select in delete (and any pick-many) questions: candidates are toggle chips; the student can select several (e.g. SAT Writing + SAT Math, not Desmos) and press "Delete selected (2)". "All of these" selects all and deselects the individual chips; "Cancel" clears. Typed answers can name several ("writing and math"). The preview then lists exactly the selected plans' tasks, with "Also remove these plans".
B7. Re-check everything from the earlier Prompt 3 fixes and make sure it works end to end in the real UI flow, not just in unit tests: titles (A3), the Just talking → readiness flow (A4), compare-and-restore undo (A5), project previews (A6), the "my SAT tasks" calendar-list bug. Add an integration test per item.

══════════ PHASE 3: Adaptive "grill me" planning (this replaces the old Prompt 5) ══════════
Goal: Tangent asks the RIGHT questions, the right number, based on what it already knows. It shouldn't always ask 3.
- Build on Juann's questions-before-acting flow and question cards. Don't build a parallel system.
- Give each request type a "plan brief": the details a good plan needs. For example:
  - Exam/test prep: test date, subjects/sections, current level or target score, hours/week, preferred times.
  - Competition/project (ISEF, science fair, robotics): deadline, topic/category, stage, milestones required (proposal, data, poster, judging), mentor/lab access, hours/week.
  - Skill/sport: goal level, timeframe, sessions/week, equipment/coach access, safety constraints.
  - Habit/routine: frequency, time of day, duration, start date.
  - Single task: none (just do it).
- Fill every slot it can FIRST from context: calendar (busy times, school), capacity (lib/load.ts), existing projects/plans (avoid duplicates; offer "add to your existing X project?"), What Tangent knows, earlier chat turns, Canvas deadlines if connected.
- Ask only the missing REQUIRED slots, ordered by how much they change the plan. Usually 0–2 questions for simple asks and up to 4–5 for big multi-month goals, in one card with tap answers + "Other…", plus "Just do it" (fill the rest with sensible defaults and show them as assumptions in the preview).
- Question quality: specific to the request ("Which ISEF category: biology, engineering, CS…?") rather than generic. Never ask something the context already answers; say what it assumed instead ("I see you have school until 3pm and soccer Mon/Wed").
- Silly or unclear goals ("fight Mike Tyson in 2 weeks"): one light clarifying question with options, as it already does, then a safe, realistic plan (e.g. boxing fundamentals), with a gentle note about safety/realism when relevant.
- After the answers: show the preview (B4). Save the answers as context for that project.
- Tests: the brief slot-filling per type, "no question when context already answers", the max question count per type, "Just do it" defaults appearing as assumptions.

══════════ PHASE 4: Chat experience like Claude / ChatGPT / Gemini (both flag states) ══════════
Keep Juann's Liquid Glass tokens. The aim is MINIMAL and CONSISTENT.
- Streaming: assistant text streams token by token, with a subtle typing indicator before the first token and a Stop button while generating.
- Markdown rendering for replies: lists, bold, headings kept small, no raw "- " bullets.
- Message actions on hover (assistant): Copy, Retry (regenerate), and a thumbs up/down (logged as an event, no free text). User messages: Edit the last message and resend.
- Scrolling: auto-scroll only when the user is at the bottom; a "Jump to latest" pill otherwise; keep the composer pinned.
- ONE component system for everything Tangent shows in chat, all with the same radius, spacing, type scale and button styles:
  - Question card (tap answers, multi-select, Other…, Continue, Just do it)
  - Preview card (changes to approve)
  - Action summary (what happened)
  - Small inline status (e.g. "Moved 1 session off a full day")
  Buttons: one primary per card max; secondary actions as quiet text buttons; no stacked pill rows. Redesign the current receipt + Undo button so it's a quiet inline row, not a separate floating button.
- Action summaries (what happened), richer than today but easy to read:
  - A one-line headline ("Created ISEF STEM Research Prep · 30 sessions over 10 weeks")
  - 2–4 short lines: when it starts/ends, sessions per week and typical times, what was moved and why (spacing), what it assumed
  - Collapsed "See all sessions" (the full list, grouped by week)
  - Quiet actions: Undo · Open project · Details (AI Activity)
  Use the same summary for deletes ("Removed SAT Math Geometry Sprint · 11 tasks · Undo") and edits.
- Chat titles: auto-name each chat from its content after the first meaningful exchange: the project/plan name if one was created or targeted ("ISEF STEM Research Prep"), otherwise a short 3–6 word topic from a FAST model call ("SAT reading plan"), never the raw first message. Rename when a chat's main project changes. Keep manual rename. Update the sidebar list titles and the second line (the project name or last action).
- New topic → suggest a new chat: when a message is clearly about a different project/goal than the chat's current one (from the router + matcher), show a quiet inline suggestion: "This looks like a new topic. Start a new chat for it?" [Start new chat] [Keep here]. Starting one carries the message over. Never force it, and don't suggest it more than once per chat for the same topic.
- Empty state and hints: keep them short and consistent with the router ("Ask, add, or plan anything. You'll always see what changes.").
- Accessibility: buttons have labels, keyboard works (Enter send, Shift+Enter newline, Esc closes cards), focus is visible.

══════════ PHASE 5: Calendar polish (both flag states) ══════════
- Hovering a task in a calendar slot shows a tooltip with the title, time, and the PROJECT/PLAN it belongs to (with the project color dot), plus the calendar (School / No school). Use the same tooltip on the week and month views and the day panel.
- Show at least 3–4 tasks per slot/day cell before "+N more" (measure the cell height and fit as many as fit, minimum 3; 4 on desktop). "+N more" opens the day panel.
- Clicking a task in a calendar delete flow uses the same multi-select chips as B6.

══════════ PHASE 6: Tests, eval, docs ══════════
- Fixtures: add Transcript 1 and 2 (exact turns), multi-select deletes, the "closest match" case, typo intents, the ISEF and Mike Tyson grill cases, the new-topic suggestion, and chat-title cases. Update gradeCase as needed.
- npm run build, npm test, npm run eval:pipeline -- --check must pass.
- Update docs/tangent-pipeline-final-checks.md with a new section "K. Master fix" holding one hands-on check per item above (short and specific, no duplicates of old checks).

══════════ PHASE 7: Final summary ══════════
- What changed per phase, with root causes for the Phase 2 bugs
- The verified Haiku 5.5 / Sonnet 5.5 facts, plus the new cost per request
- The list of AI write paths and how each previews now (B1)
- New migrations (if any)
- EXACT changed lines in Juann's files (ai/page.tsx, console/*, PreviewCard, ActionReceipt, RecentChanges, UndoToast, CommandPalette, ProjectChat, ProjectAsk, InlinePreview, calendar components, globals.css, chat sidebar)
- Anything you decided on your own, and known gaps
```
