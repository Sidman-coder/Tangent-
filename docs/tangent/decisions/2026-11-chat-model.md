# Decision: one start point, chats that carry their context

**Date:** 2026-11-05 · **Status:** Accepted (Round 2, Phase D)

## Context

Round 1 cut TANGENT down to two chats: capture and the AI page ("Ask Tangent"). An "Ask" on a task or project opened the AI page with that item attached, and the older per-task chats were hidden. In use, that meant every question about a task started from nothing: the student had to re-explain the task, and the answer landed in a general chat they couldn't find again from the task.

## Decision

- Every new chat starts on **Home** (the capture input on Today). There is no other top-level AI surface.
- A **task chat** and a **project chat** belong to their task or project, open from it, and carry its context (title, dates, steps, notes) automatically.
- The **Chats library** at `/ai` lists every chat with a short running summary, so nothing gets lost.
- "Ask Tangent" as a separate chat is retired. AGENTS.md now says: "No new top-level AI surfaces; start on Home, continue in task/project chats."

## Alternatives considered

- **Keep two chats and attach context.** Simple, but the conversation about a task lived away from the task, and attaching had to be done by hand each time.
- **A chat on every screen.** Maximum reach, but several places to start a conversation and no clear answer to "where did I ask that?"
- **No chat at all, capture only.** Calmest, but students do ask follow-up questions about their work, and those need somewhere to go.

## Consequences

- Chats are more useful because their context is already attached, and one start point keeps the app simple.
- Running summaries cost a small fast-model call per chat now and then.
- Old task chat history in `task_chat_messages` is not migrated into the new chats (an open question in PROJECT.md).
- Revisit if the pilot shows students rarely open task or project chats (`chat_started` events by kind).
