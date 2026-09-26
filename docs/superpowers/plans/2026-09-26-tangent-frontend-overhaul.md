# TANGENT Frontend Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the interface's repeated facts and actions, and replace its visual system with the Mix 7 palette and typography.

**Architecture:** Change presentation only. `globals.css` holds the token layer every component already reads, so the palette and type swap happens once at the top and propagates. Structural work is deletion and consolidation in `AppShell`, the five route files, and the dashboard components — no store, API, or pipeline code is touched.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18.3, TypeScript 5.5, plain CSS custom properties, `motion`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-09-26-tangent-frontend-overhaul-design.md`

## Global Constraints

- **There is no test runner.** `package.json` scripts are `dev`, `build`, `start`, `lint` only. Do not add one — it is out of scope. Every task verifies with `npx tsc --noEmit`, a browser check on the running dev server, and where useful `npm run build`.
- Work directly on local `main`. Commit after every task. Do not push.
- Do not modify anything under `app/api/`, `lib/store.ts`, `lib/canvas*.ts`, `lib/gmail.ts`, `lib/deepgram.ts`, `lib/voice-*.ts`, `lib/proactive.ts`, `lib/daily-brief.ts`, or `lib/cron-auth.ts`.
- Do not change stored task-kind values. Display strings only.
- `npm install` in this repo may fail with `EACCES` on `~/.npm/_cacache`. If it does, use `npm install --cache /tmp/claude-501/-Users-juann/c8edad76-b846-4868-91d6-db772cee72d4/scratchpad/npm-cache`.
- Dev server: `npm run dev` on `http://localhost:3000`. Onboarding gates `/` on a fresh profile; complete it once with any name.
- **Verify the browser viewport is at least 1160px CSS** before judging desktop layout. Below that the sidebar intentionally collapses.
- No tracked all-caps anywhere in new or edited CSS.

---

### Task 1: Install the Mix 7 token and type system

**Files:**
- Modify: `app/globals.css:1` (font import), `app/globals.css:2-70` (`:root`), and the `[data-theme="dark"]` block

**Interfaces:**
- Produces: the token names every other task relies on — `--bg`, `--bg-sunken`, `--surface`, `--elev-2`, `--layer-3`, `--accent-soft`, `--line`, `--text`, `--text-2`, `--accent`, `--accent-ink`, `--highlight`, `--highlight-ink`, `--font-display`, `--font-body`, `--font-mono`, `--r-sm`, `--r-md`, `--r-lg`.

- [ ] **Step 1: Replace the font import**

Replace line 1 of `app/globals.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&family=Onest:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

- [ ] **Step 2: Replace the light palette and type tokens in `:root`**

In the `:root` block, replace the existing color, font, and radius declarations with:

```css
  --bg:          #f5f3fa;
  --bg-sunken:   #f5f3fa;
  --surface:     #ffffff;
  --elev-2:      #ece8f6;
  --accent-soft: #ece8f6;
  --layer-3:     #d9d1ee;
  --line:        #e2ddf0;
  --line-strong: #d9d1ee;
  --text:        #1c1830;
  --text-2:      #575170;
  --text-3:      #7d7797;
  --accent:      #4b3a8c;
  --accent-hover:#3d2e76;
  --accent-ink:  #ffffff;
  --accent-line: rgba(75,58,140,0.20);
  --highlight:   #1f7a74;
  --highlight-ink: #ffffff;

  --font-display: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif;
  --font-body:    'Onest', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, Menlo, monospace;

  --r-sm: 10px; --r-md: 15px; --r-lg: 18px;
```

Leave `--green`, `--amber`, `--red`, the `--kind-*` block, `--rail-w`, `--topbar-h`, `--content-max`, `--page-gutter`, the shadow tokens, and the legacy alias block exactly as they are — they already alias onto the names above.

- [ ] **Step 3: Replace the dark palette**

In the `[data-theme="dark"]` block, set:

```css
  --bg:          #13111d;
  --bg-sunken:   #13111d;
  --surface:     #1b1829;
  --elev-2:      #252136;
  --accent-soft: #252136;
  --layer-3:     #332d4a;
  --line:        #2c2740;
  --line-strong: #332d4a;
  --text:        #eeebf7;
  --text-2:      #a9a3c2;
  --accent:      #b3a5f0;
  --accent-ink:  #17132a;
  --highlight:   #5cc8bd;
  --highlight-ink: #062623;
```

- [ ] **Step 4: Remove every tracked all-caps treatment**

Find them:

```bash
grep -n "text-transform: *uppercase" app/globals.css
```

For each hit, delete the `text-transform` line and any `letter-spacing` above `0.02em` on the same rule. If the rule also sets `font-family: var(--font-mono)`, change it to `var(--font-body)`. The only rule permitted to keep `--font-mono` is the `⌘K` chip (`.topbar-search kbd`, `.rail-capture-key`).

- [ ] **Step 5: Verify types and appearance**

```bash
npx tsc --noEmit
```

Expected: exit 0.

Then load `http://localhost:3000/` at 1440px in both themes. Confirm the purple is the deeper `#4b3a8c` (light) / `#b3a5f0` (dark), headings render in Bricolage Grotesque, body in Onest, and no all-caps label remains anywhere.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "style: adopt Mix 7 palette and typography, drop all-caps labels"
```

---

### Task 2: Collapse the doubled header

**Files:**
- Modify: `components/AppShell.tsx:153-190`
- Modify: `components/ui/PageHeader.tsx`
- Modify: `app/page.tsx:245`, `app/tasks/page.tsx`, `app/calendar/page.tsx`, `app/settings/page.tsx`
- Modify: `app/globals.css` (`.topbar-context`, `.page-header-eyebrow` rules)

**Interfaces:**
- Consumes: Task 1's tokens.
- Produces: `PageHeader({ title, description?, actions? })` — the `eyebrow` prop is removed. Every call site must drop it.

- [ ] **Step 1: Drop the eyebrow from `PageHeader`**

Replace `components/ui/PageHeader.tsx` with:

```tsx
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <h1 className="page-header-title">{title}</h1>
        {description && <div className="page-header-description">{description}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 2: Remove every `eyebrow` prop at the call sites**

```bash
grep -rn "eyebrow" app components
```

Delete each `eyebrow={...}` line. `npx tsc --noEmit` must exit 0 afterwards — it will name any you missed.

- [ ] **Step 3: Strip the topbar's duplicate title and action**

In `components/AppShell.tsx`, delete the `topbar-context` block entirely:

```tsx
          <div className="topbar-context">
            <span className="topbar-eyebrow">Workspace</span>
            <span className="topbar-title">{title}</span>
          </div>
```

and delete the `topbar-new-task` button block:

```tsx
            <button type="button" className="topbar-new-task" onClick={openPalette}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              <span>New task</span>
            </button>
```

Remove the now-unused `Plus` import if nothing else in the file uses it, and remove the now-unused `title` prop plumbing if it has no other consumer. `npx tsc --noEmit` will confirm.

- [ ] **Step 4: Move `Connect Canvas` out of the topbar**

Delete the `topbar-canvas-connect` button from `AppShell.tsx`. Keep `CanvasConnectGuide` mounted and keep `canvasGuideOpen` state — the Settings → Integrations tab already links to it. Verify the Settings entry point opens the guide; if no entry point exists there, add one button labelled `Connect Canvas` in the Integrations section that calls the same handler.

- [ ] **Step 5: Tidy the orphaned CSS**

Delete the `.topbar-context`, `.topbar-eyebrow`, `.topbar-title`, `.topbar-new-task`, `.topbar-canvas-connect`, and `.page-header-eyebrow` rules from `app/globals.css`. Adjust `.topbar` to `justify-content: flex-end` so the remaining controls sit right.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

Load every route at 1440px. Confirm exactly one page title and exactly one `New task` button are visible per route, and the topbar holds only date/time, Search, notifications, and avatar.

- [ ] **Step 7: Commit**

```bash
git add components/AppShell.tsx components/ui/PageHeader.tsx app/globals.css app/page.tsx app/tasks/page.tsx app/calendar/page.tsx app/settings/page.tsx
git commit -m "refactor(shell): one header and one primary action per page"
```

---

### Task 3: Remove the floating mic and the 3D sphere

**Files:**
- Modify: `components/AppShell.tsx:21,219`
- Delete: `components/VoiceCaptureFab.tsx`
- Delete: `components/dashboard/UrgencyOrbScene.tsx`
- Modify: `components/dashboard/UrgencyHero.tsx:9,25,44,89-91`
- Modify: `package.json`
- Modify: `app/globals.css` (FAB and orb rules)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `UrgencyHero` with the same props and no 3D child.

- [ ] **Step 1: Unmount and delete the FAB**

In `components/AppShell.tsx`, delete the import on line 21 and the render on line 219 including its comment:

```tsx
      {/* The AI console has its own mic in the composer; the FAB would cover Send. */}
      {pathname !== "/ai" && <VoiceCaptureFab />}
```

Then:

```bash
git rm components/VoiceCaptureFab.tsx
```

- [ ] **Step 2: Remove the sphere from the hero**

In `components/dashboard/UrgencyHero.tsx`, delete the `UrgencyOrbScene` dynamic import (line 9), the `SceneBoundary` class (around line 44), the `<SceneBoundary>` render block (lines 89–91), and any `ready`/`failed` state that now has no reader. Keep the hero's text, score, and layout.

```bash
git rm components/dashboard/UrgencyOrbScene.tsx
```

- [ ] **Step 3: Confirm nothing else imports three.js**

```bash
grep -rn "@react-three\|from \"three\"" app components lib
```

Expected: no output. Only then remove `three`, `@react-three/fiber`, and `@react-three/drei` from the `dependencies` block in `package.json`, and run:

```bash
npm install --cache /tmp/claude-501/-Users-juann/c8edad76-b846-4868-91d6-db772cee72d4/scratchpad/npm-cache
```

- [ ] **Step 4: Delete the orphaned CSS**

Remove the FAB and orb rules from `app/globals.css`:

```bash
grep -n "voice-fab\|urgency-orb\|orb-" app/globals.css
```

Delete each rule the grep names.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run build
```

Expected: both exit 0. Load `/`, `/tasks`, `/calendar`, `/settings` and confirm no floating button covers content anywhere, and the Today hero renders without a sphere or an empty gap where it was.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove voice FAB, 3D orb, and three.js dependencies"
```

---

### Task 4: Give Today one empty state and one density view

**Files:**
- Modify: `app/page.tsx:264-320`
- Modify: `components/dashboard/WeekAhead.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PageHeader` from Task 2, `UrgencyHero` from Task 3.
- Produces: Today no longer renders `MonthRhythm`; Task 6 mounts it on Calendar.

- [ ] **Step 1: Remove `MonthRhythm` from Today**

In `app/page.tsx`, delete the import on line 10 and the render on line 279:

```tsx
        <MonthRhythm tasks={tasks} year={now.getFullYear()} monthIndex={now.getMonth()} today={today} />
```

Change the two-column wrapper that held `WeekAhead` and `MonthRhythm` to a single-column block so `WeekAhead` spans the content width rather than sitting in a half-width column.

- [ ] **Step 2: Collapse the three empty statements into one**

Today currently says the schedule is empty three times: the hero (`Nothing needs you right now.`), `WeekAhead` (`0 open tasks`), and the day list (`Nothing is scheduled for today.`).

Keep the hero's statement. In `app/page.tsx`, when there are no tasks today, render the day-list section without its own empty sentence — heading and the `Add a task` button only. In `components/dashboard/WeekAhead.tsx`, render the `0 open tasks` count only when the count is greater than zero.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Load `/` with an empty schedule at 1440px. Confirm the page states the empty condition exactly once and offers exactly one way to act on it. Add one task through `⌘K` and confirm the hero, the week strip, and the day list all update and now show real content.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/dashboard/WeekAhead.tsx app/globals.css
git commit -m "refactor(today): one empty state, one density view"
```

---

### Task 5: De-duplicate the Tasks page

**Files:**
- Modify: `app/tasks/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PageHeader` from Task 2.

- [ ] **Step 1: Cut the empty state from four statements to one**

The page currently renders `0 of 0 complete` in the subtitle, `All clear today. Add a task when you're ready.` in a banner, `Your day is ready.` as a line, and `No incomplete tasks for today.` in the list.

Keep the page subtitle's completion summary — it is useful when tasks exist. Delete the banner and the `Your day is ready.` line entirely. Keep the list's empty row as the single empty statement, paired with the existing `Add a task` button.

- [ ] **Step 2: Remove the redundant section count**

The `To do` heading carries a count that the page subtitle already states. Delete the count from the heading; leave the heading text.

- [ ] **Step 3: Delete the orphaned CSS**

Remove any rule that only styled the deleted banner and line.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Load `/tasks` empty: exactly one sentence explains the empty state. Add two tasks, complete one, and confirm the completion summary, the grouping, and completion feedback all still work.

- [ ] **Step 5: Commit**

```bash
git add app/tasks/page.tsx app/globals.css
git commit -m "refactor(tasks): single empty state and one completion count"
```

---

### Task 6: Merge the Calendar toolbars and resolve the taxonomy collision

**Files:**
- Modify: `app/calendar/page.tsx`
- Modify: `lib/task-colors.ts:20`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `MonthRhythm` released by Task 4, `PageHeader` from Task 2.
- Produces: Calendar renders `MonthRhythm({ tasks, year, monthIndex, today })` with the same props Today used.

- [ ] **Step 1: Rename the colliding display string**

In `lib/task-colors.ts`, line 20, change the label only:

```ts
  personal: "Personal time",
```

The key stays `personal`, so no stored value changes. Confirm with:

```bash
grep -rn "\"Personal\"" app components lib
```

Any remaining hit that refers to a *calendar* named Personal is correct and must be left alone.

- [ ] **Step 2: Merge the three toolbars into one**

Combine the month navigation row (`Today`, `‹`, `›`, month label), the calendar filter row (`All Calendars`, `Personal`, `Work`, `+`), and the task-kind legend into a single toolbar row. Keep every control and its existing handler.

Move the five-dot task-kind legend into a popover opened by one button labelled `Kinds`, so it no longer occupies a permanent row.

- [ ] **Step 3: Lighten the month grid**

Reduce full per-cell borders to a single light grid. Render leading and trailing month days at `--text-3`. Distinguish today from the selected day with two different indicators rather than a large tinted fill on either.

- [ ] **Step 4: Mount `MonthRhythm` on Calendar**

Import `MonthRhythm` into `app/calendar/page.tsx` and render it below the grid with the currently displayed year and month, not today's:

```tsx
<MonthRhythm tasks={tasks} year={viewYear} monthIndex={viewMonthIndex} today={today} />
```

Use whatever the file already calls its displayed year and month state.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Load `/calendar` at 1440px. Confirm one toolbar row, the `Kinds` popover opens and closes on Escape, the legend reads `Personal time` for the task kind while the calendar filter still reads `Personal`, month navigation works, and `MonthRhythm` follows the displayed month rather than the current one.

- [ ] **Step 6: Commit**

```bash
git add app/calendar/page.tsx lib/task-colors.ts app/globals.css
git commit -m "refactor(calendar): one toolbar, lighter grid, resolve Personal collision"
```

---

### Task 7: Give the Console one header

**Files:**
- Modify: `app/ai/page.tsx:473,487-506`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `ModeSwitch` unchanged from `components/console/ModeSwitch`.

- [ ] **Step 1: Remove the duplicated mode statement**

The console states its mode twice — a `Calendar mode` / `Plan mode` pill in the header (around line 493) and the `ModeSwitch` in the composer toolbar (line 473). Delete the header pill. Keep `ModeSwitch`.

- [ ] **Step 2: Fold the console bar into the page header**

Merge the `tg-main-title` bar into the standard page header so the route has one heading. Keep the `Your Brief` button and the chat-management control, moved into the header's action group.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Load `/ai`. Confirm one heading, mode stated once, `Your Brief` still opens, the composer still sends, the mic still works, and starter prompts still appear only before the first turn. Do not send a paid request beyond one short message.

- [ ] **Step 4: Commit**

```bash
git add app/ai/page.tsx app/globals.css
git commit -m "refactor(console): single header, mode stated once"
```

---

### Task 8: Responsive, contrast, and keyboard pass

**Files:**
- Modify: `app/globals.css:5521`
- Modify: only other files with issues found during this pass

- [ ] **Step 1: Move the sidebar collapse breakpoint**

At `app/globals.css:5521`, change:

```css
@media (max-width: 1160px) {
```

to:

```css
@media (max-width: 1024px) {
```

Load the app at 1280px and confirm the sidebar shows labels; at 1000px confirm it collapses to icons with working tooltips.

- [ ] **Step 2: Confirm the contrast figures**

These were computed against WCAG 2.1 and all pass AA for normal text. Re-check them in browser devtools after the palette landed, and record any rule that fails:

| Pair | Ratio | Needs |
|---|---|---|
| `--text-2` `#575170` on `--bg` `#f5f3fa` | 6.77:1 | 4.5:1 |
| `--accent` `#4b3a8c` with `--accent-ink` `#ffffff` | 9.20:1 | 4.5:1 |
| dark `--text-2` `#a9a3c2` on dark `--bg` `#13111d` | 7.66:1 | 4.5:1 |

Also check `--text-3` `#7d7797` on `--bg` `#f5f3fa`, which is the most likely failure; if it is below 4.5:1 and used for readable text rather than decoration, darken it within the Mix 7 family and note the new value in the spec.

- [ ] **Step 3: Run the route matrix**

Load `/`, `/tasks`, `/calendar`, `/ai`, `/settings` at 1440, 1024, 768, and 390px, in both themes. Record and fix: horizontal page scroll, clipped overlays, any element covering content, and any text that wraps badly.

- [ ] **Step 4: Run the keyboard matrix**

Tab through every route and every overlay — command palette, notifications, add task, task chat, calendar day peek, Kinds popover. Confirm a visible focus ring on every stop, focus order matching visual order, Escape dismissal, and focus returning to the trigger on close.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: responsive breakpoint, contrast, and keyboard pass"
```

---

### Task 9: Final verification

**Files:**
- Modify: only files needed to resolve failures

- [ ] **Step 1: Types**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 3: Confirm each removal actually landed**

```bash
grep -rn "VoiceCaptureFab\|UrgencyOrbScene\|@react-three\|topbar-new-task\|page-header-eyebrow" app components lib package.json
```

Expected: no output.

```bash
grep -n "text-transform: *uppercase" app/globals.css
```

Expected: no output.

- [ ] **Step 4: Review the diff for scope violations**

```bash
git diff b3a8db1..HEAD --stat -- app/api lib/store.ts lib/canvas.ts lib/gmail.ts lib/deepgram.ts lib/voice-handler.ts lib/proactive.ts
```

Expected: no output. If any file above appears, revert that portion.

- [ ] **Step 5: Smoke test**

With the dev server running, load all five routes, create a task, complete it, open the calendar day peek, and open the command palette. Confirm no blocking console errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: final verification pass for frontend overhaul"
```
