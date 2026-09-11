# TANGENT Product Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild TANGENT's interface into a professional hybrid of Linear-like precision and Notion-like calm while preserving existing product behavior.

**Architecture:** Keep the existing Next.js App Router, `AppStateProvider`, API routes, store, voice pipeline, and intent behavior. Introduce a small presentational component layer and pure schedule-insight helpers, then migrate the shell and five routes onto one tokenized CSS system. Verify each independently in the live browser before moving to the next route.

**Tech Stack:** Next.js 14, React 18, TypeScript 5.5, plain CSS custom properties, Lucide React, existing app state and API routes.

**Spec:** `docs/superpowers/specs/2026-09-10-tangent-product-redesign-design.md`

## Global Constraints

- Preserve existing API route logic, store semantics, voice pipeline behavior, and intent classification.
- Do not add backend services, analytics collection, peer benchmarking, or speculative productivity features.
- Preserve the working package manager, dependencies, App Router structure, and local development flow.
- Treat the existing dirty worktree as user-owned; do not overwrite or discard unrelated changes.
- Use the existing TANGENT accent `#5B3DF0` and existing task-kind colors as metadata accents.
- Verify routes at 1440px, 1024px, 768px, and 390px.
- Maintain keyboard navigation, visible focus, Escape dismissal, reduced motion, and WCAG AA contrast.

---

### Task 1: Rebuild the application shell and core visual tokens

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: existing `NAV_LINKS`, notification state, command-palette event, theme initialization, and onboarding gate.
- Produces: responsive `.app-sidebar`, `.app-topbar`, `.app-content`, `.mobile-nav`, and global action styling used by every page.

- [ ] **Step 1: Capture shell baselines**

Use the live browser at 1440px and 390px on `/`, `/tasks`, and `/calendar`. Save screenshots under `.playwright-mcp/redesign-before-*` and record sidebar, topbar, and main-content bounding boxes.

- [ ] **Step 2: Replace icon-only shell markup**

Update `AppShell.tsx` so the desktop navigation renders a labeled 216px sidebar with the existing destinations and command-palette trigger. Keep the same links, notification state, and `tangent:open-palette` event. Add a compact mobile navigation using the same routes; do not add destinations or new stateful behavior.

- [ ] **Step 3: Normalize metadata**

Update `app/layout.tsx` metadata description to describe TANGENT as a focused student productivity workspace without naming an AI vendor.

- [ ] **Step 4: Replace shell and global token CSS**

In `globals.css`, define the approved canvas, surface, text, border, accent, type, radius, and motion tokens. Remove shell dependence on neumorphic utilities. Implement desktop sidebar, collapsed tablet rail, mobile bottom navigation, consistent content gutters, and topbar actions.

- [ ] **Step 5: Verify the shell**

Browser-check active navigation, tooltips in collapsed mode, command-palette trigger, notification trigger, page-title context, and no horizontal overflow at all four widths. Confirm all shell controls show visible hover and focus states.

### Task 2: Add reusable presentational primitives

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/PageHeader.tsx`
- Create: `components/ui/FocusPanel.tsx`
- Create: `components/ui/TaskRow.tsx`
- Create: `components/ui/SidePeek.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `Button({ variant: "primary" | "secondary" | "quiet" | "danger", size?: "sm" | "md", loading?: boolean, ...buttonProps })`
- `PageHeader({ title, description?, actions? })`
- `FocusPanel({ task, kindColor, relativeLabel, onComplete, onOpen? })`
- `TaskRow({ task, kindColor, selected?, expanded?, onComplete, onOpen?, actions?, children? })`
- `SidePeek({ open, titleId, onClose, children })`

- [ ] **Step 1: Implement component contracts**

Create typed presentational components that render native semantic controls and accept behavior through callbacks. Do not fetch data or import store functions inside these components.

- [ ] **Step 2: Implement shared component CSS**

Add one button hierarchy, one row hierarchy, one focus panel, and one overlay/peek system. Include disabled, loading, hover, focus-visible, selected, expanded, and destructive states.

- [ ] **Step 3: Implement focus management for `SidePeek`**

On open, focus the close button or first meaningful heading; contain Tab and Shift+Tab while modal; close on Escape; restore focus to the trigger after close. On mobile, render the same DOM as a full-height sheet through CSS.

- [ ] **Step 4: Verify primitives in real routes**

Temporarily migrate one representative control or row in an existing page, reload, and verify semantics and visual states. Keep only the migration if it is complete and does not leave mixed styling in the same context.

### Task 3: Build schedule insight derivations and Today page

**Files:**
- Create: `lib/schedule-insights.ts`
- Create: `components/SchedulePulse.tsx`
- Create: `components/MonthRhythm.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `getSchedulePulse(tasks: Task[], now?: Date): ScheduleInsight`
- `getMonthDensity(tasks: Task[], year: number, monthIndex: number): Map<string, number>`
- `ScheduleInsight = { title: string; detail: string; tone: "neutral" | "positive" | "warning" }`
- `SchedulePulse({ insight }: { insight: ScheduleInsight })`
- `MonthRhythm({ tasks, year, monthIndex }: { tasks: Task[]; year: number; monthIndex: number })`

- [ ] **Step 1: Implement deterministic insight helpers**

Create pure functions for busiest weekday, open evenings, monthly completion percentage, current-week load versus the previous four-week average, and academic-work time concentration. Choose one insight by a stable priority order: overload warning, available space, recurring pattern, completion progress, neutral fallback.

- [ ] **Step 2: Implement `MonthRhythm`**

Render a compact calendar density grid from existing tasks. Use accessible day labels and four restrained intensity levels. Do not imply peer comparison or precise available-hour capacity that existing data cannot support.

- [ ] **Step 3: Implement `SchedulePulse`**

Render one concise title and one supporting sentence. Use tone only to change a small icon or border accent, not the entire background.

- [ ] **Step 4: Recompose Today**

Update `app/page.tsx` to render `PageHeader`, one `FocusPanel`, a chronological dayline of today's tasks, `MonthRhythm`, `SchedulePulse`, a compact week preview, and collapsed recent activity. Preserve complete-task and undo API calls exactly.

- [ ] **Step 5: Handle Today states**

Provide geometry-matched loading, populated, no-current-task, no-tasks-today, and no-task-history states. Empty copy must offer one relevant action without rendering an oversized placeholder.

- [ ] **Step 6: Browser-verify Today**

Check hierarchy, long titles, current/completed rows, focus completion, recent disclosure, keyboard order, responsive stacking, and no overflow at all four widths. Capture final screenshots.

### Task 4: Recompose Tasks into a focused list workspace

**Files:**
- Modify: `app/tasks/page.tsx`
- Modify: `components/AddTaskModal.tsx`
- Modify: `components/TaskChatModal.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: shared `PageHeader`, `Button`, `FocusPanel`, and `TaskRow`.
- Produces: one current-focus row, one task-creation entry, grouped incomplete/completed lists, and existing task-detail/chat/delete behavior.

- [ ] **Step 1: Remove duplicate priority surfaces**

Remove `WhatToDoNow` from Tasks and remove the bottom “Add another task” button. Keep the sticky current-focus row and the header New task action.

- [ ] **Step 2: Migrate task rendering**

Use shared task rows for completion, title, time, kind, recurrence, expansion, resource links, task chat, and deletion. Move secondary actions into a quiet action group that remains keyboard reachable.

- [ ] **Step 3: Clarify grouping and utilities**

Group incomplete and completed tasks visually. Keep Shuffle and Reset as quiet utilities beside the completion summary rather than primary actions.

- [ ] **Step 4: Restyle existing task dialogs**

Apply the shared button and dialog hierarchy to Add task, recurring deletion, and task chat. Preserve their request payloads and existing loading labels.

- [ ] **Step 5: Browser-verify Tasks**

Test sticky positioning during scroll, completion feedback, expansion, modal focus, Escape/backdrop dismissal, recurring confirmation, task-chat loading, long titles, and all four widths. Capture final screenshots.

### Task 5: Rebuild Calendar with a responsive day peek

**Files:**
- Modify: `app/calendar/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: shared `PageHeader`, `Button`, `TaskRow`, and `SidePeek`.
- Produces: integrated calendar toolbar, month grid, task-kind ribbons, responsive selected-day peek, and collapsed contextual day chat.

- [ ] **Step 1: Integrate the calendar toolbar**

Place calendar filters, month label, previous/next controls, and New task in one coherent header area. Preserve existing calendar selection and add-calendar behavior.

- [ ] **Step 2: Simplify the month grid**

Reduce cell borders, maintain clear weekday and date hierarchy, preserve task-kind ribbons and task counts, and distinguish today from selection with separate indicators.

- [ ] **Step 3: Replace the day modal with `SidePeek`**

Move selected-day content into the shared right-side peek. Preserve task completion, recurrence editing/deletion, plan filtering, resource links, and date-prefilled task creation.

- [ ] **Step 4: Consolidate calendar AI**

Remove the permanent Agent edge tab from default layout. Keep “Ask about this day” as a collapsed disclosure inside the day peek using the existing general chat request logic.

- [ ] **Step 5: Browser-verify Calendar**

Test real task ribbons, month navigation, filters, add-calendar form, selected-day peek, focus containment, task creation without panel overlap, recurrence flows, collapsed day chat, and all four widths. Capture final screenshots.

### Task 6: Turn Console into a professional conversation workspace

**Files:**
- Modify: `app/ai/page.tsx`
- Modify: `components/VoiceRecordButton.tsx`
- Modify: `components/ActionReceipt.tsx` only for presentation consistency
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing `/api/chat`, session APIs, action receipts, and voice button behavior.
- Produces: conversation stream, anchored composer, initial suggestions, tool/action feedback, and existing confirmation behavior.

- [ ] **Step 1: Remove the cosmetic mode control**

Delete Ask/Do state and controls because they currently alter only placeholder copy. Use one direct composer placeholder.

- [ ] **Step 2: Recompose Console layout**

Render a readable conversation column with initial guidance and starter prompts only when no turns exist. Anchor the composer to the bottom of the content region without obscuring turns.

- [ ] **Step 3: Integrate voice and action feedback**

Place the existing voice action inside the composer action group. Preserve loading steps, confirmations, errors, tool chips, and undo receipts with the new hierarchy.

- [ ] **Step 4: Browser-verify Console**

Test empty state, suggestion selection, input focus, disabled send, safe loading-state presentation without unnecessary paid requests, command palette relationship, long responses, and all four widths. Capture final screenshots.

### Task 7: Rebuild Settings and onboarding presentation

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `components/FirstRun.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing theme/font functions, profile state, onboarding local-storage keys, and recurring-school setup request.
- Produces: sectioned settings workspace and full-height onboarding presentation with unchanged question behavior.

- [ ] **Step 1: Recompose Settings**

Create a two-column desktop layout with visible section navigation and a single content column. Group profile, appearance, typography, onboarding, and account controls. Stack groups on mobile.

- [ ] **Step 2: Remove misleading AI configuration UI**

Remove browser-only OpenAI key and model fields and their localStorage save behavior from the Settings page. Do not alter server environment handling or any AI route.

- [ ] **Step 3: Restyle onboarding**

Preserve the existing login, schedule, confirm, and splash state transitions. Add visible progress and full-height composition using the shared controls. Do not add the future personalization questions in this implementation.

- [ ] **Step 4: Browser-verify Settings and onboarding**

Test profile save, theme change, font mode, sign-out/reset behavior, every onboarding screen, disabled/loading states, keyboard order, and all four widths. Avoid creating unnecessary recurring tasks during repeated checks.

### Task 8: Unify global overlays and command interactions

**Files:**
- Modify: `components/CommandPalette.tsx`
- Modify: `components/NotificationBell.tsx`
- Modify: `components/AddTaskModal.tsx`
- Modify: `components/TaskChatModal.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing open/close state and request behavior.
- Produces: consistent overlay geometry, focus containment, keyboard dismissal, and action feedback.

- [ ] **Step 1: Align overlay presentation**

Apply one radius, border, shadow, spacing, title, action, and backdrop system to command palette, notifications, task creation, task chat, and confirmations.

- [ ] **Step 2: Normalize keyboard behavior**

Confirm initial focus, contained tab order where modal, Escape dismissal, backdrop dismissal where safe, and focus restoration for every overlay.

- [ ] **Step 3: Verify global overlays**

Open each overlay from relevant routes, test viewport-edge clipping, nested-panel prevention, loading states, and keyboard traversal at desktop and mobile widths.

### Task 9: Responsive, accessibility, and visual QA pass

**Files:**
- Modify: only files with issues discovered during this pass

**Interfaces:**
- Consumes: completed routes and components.
- Produces: verified final responsive and accessibility behavior.

- [ ] **Step 1: Run route matrix**

Audit `/`, `/tasks`, `/calendar`, `/ai`, and `/settings` at 1440px, 1024px, 768px, and 390px. Record overflow, clipping, sticky overlap, and dialog issues.

- [ ] **Step 2: Run keyboard matrix**

Tab through every page and overlay. Confirm focus visibility, visual-order parity, no hidden tabbable controls, and no sticky element obscuring focus.

- [ ] **Step 3: Run interaction-state matrix**

Check hover, active, selected, disabled, loading, empty, error, and completion states. Fix only verified mismatches and recheck after each change.

- [ ] **Step 4: Capture final screenshots**

Save final desktop and mobile screenshots for every route and visually critique hierarchy, alignment, density, copy, and unnecessary decoration.

### Task 10: Final technical verification

**Files:**
- Modify: only files required to resolve verification failures

**Interfaces:**
- Consumes: full redesign.
- Produces: type-safe, buildable, browser-verified application.

- [ ] **Step 1: Run TypeScript validation**

Run `npx tsc --noEmit`. Fix all errors introduced by the redesign and rerun until exit code 0.

- [ ] **Step 2: Run production build**

Run `npm run build`. Fix blocking compile or runtime-generation failures and rerun until exit code 0.

- [ ] **Step 3: Run final browser smoke test**

Load all five routes from the healthy development server, exercise primary actions without destructive side effects, and confirm no console-level blocking errors.

- [ ] **Step 4: Review the diff**

Run `git diff --check` and inspect the redesign diff for accidental API, store, voice, or intent changes. Preserve all unrelated pre-existing worktree changes.
