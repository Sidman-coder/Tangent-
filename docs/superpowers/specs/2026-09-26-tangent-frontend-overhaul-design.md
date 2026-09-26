# TANGENT Frontend Overhaul Design

**Status:** Approved in conversation on 2026-09-26
**Supersedes:** the visual system of `2026-09-10-tangent-product-redesign-design.md`. That spec's structural and accessibility decisions remain in force except where this document changes them.

## Purpose

Two problems, one pass:

1. The interface repeats itself. The same fact and the same action appear three to five times per screen, which reads as clutter rather than density.
2. The visual system is a generic indigo-on-near-black that looks like every other AI product.

This overhaul removes the duplication and replaces the visual system with the Mix 7 palette from the Tangent Theme Lab.

## Goals

- Every fact appears once per screen. Every action has one obvious home.
- Navigation is legible without clicking.
- Mix 7 is the single source of visual truth, in both light and dark themes.
- Typography drops the tracked all-caps mono treatment entirely.
- No regression in task, calendar, chat, voice, Canvas, or notification behavior.

## Non-goals

- No API, store, Canvas, Gmail, Deepgram, cron, or voice-pipeline logic changes.
- No new product features, and no new onboarding questions.
- No copy rewrite beyond removing duplicated and redundant strings.
- No landing page or marketing surface.

## Audit findings this design answers

Observed at 1440px on the running app at `d369c4f`, all five routes.

### Global

- **Doubled headers.** The topbar states `Workspace / <Page>`; the page then restates it as an eyebrow plus an H1, with a second `New task` button directly below the topbar's.
- **Five concurrent create paths:** topbar `New task`, page-header `New task`, the floating mic FAB, `⌘K`, and an inline `Add a task` in the empty state.
- **The sidebar collapses to icons too early.** `globals.css:5521` collapses the rail to 72px and hides every label below `1160px`. At 1440px the sidebar is correctly labeled; a 1280×800 laptop — a common student machine — gets six unlabeled icons.
- **The mic FAB overlaps content** on every route, including the Calendar grid's Saturday column.
- **`Connect Canvas` occupies permanent topbar space** for a one-time setup action.
- **Eyebrow labels restate their own headings:** `Workspace`, `Your day`, `Daily plan`, `Next 7 days`, `Today`.

### Today

- Three stacked surfaces each announce an empty schedule: the hero (`Nothing needs you right now.`), `Week ahead` (`0 open tasks`), and `Your day` (`Nothing is scheduled for today.`).
- `Week ahead` and `Monthly rhythm` are two density visualizations of the same task data, side by side.
- A decorative 3D sphere carries `three`, `@react-three/fiber`, and `@react-three/drei` for no informational purpose.

### Tasks

- Four empty-state strings on one screen: `0 of 0 complete`, `All clear today. Add a task when you're ready.`, `Your day is ready.`, `No incomplete tasks for today.`
- The `To do` section header repeats a count already in the page subtitle.

### Calendar

- Three stacked toolbars precede the grid: month navigation, calendar filters, and a five-dot task-kind legend.
- Two overlapping taxonomies are shown at once — calendars (`Personal`, `Work`) and task kinds (`School`, `Academics`, `Commitment`, `Activities`, `Personal`). **`Personal` appears in both with different meanings.**
- Every cell carries a full border, and leading/trailing month days occupy the same visual weight as real ones.

### Console

- Two headers (workspace topbar plus a `Tangent AI` bar), and mode is stated twice — a `Calendar mode` pill in the header and a `Plan`/`Calendar` toggle inside the composer.

### Settings

- Structurally sound. Receives the visual system only.

## Visual system

### Color — Mix 7

Light:

| Token | Value |
|---|---|
| `--bg`, `--bg-sunken` | `#f5f3fa` |
| `--surface` | `#ffffff` |
| `--elev-2`, `--accent-soft` | `#ece8f6` |
| `--layer-3` | `#d9d1ee` |
| `--line` | `#e2ddf0` |
| `--text` | `#1c1830` |
| `--text-2` | `#575170` |
| `--accent` | `#4b3a8c` |
| `--accent-ink` | `#ffffff` |
| `--highlight` | `#1f7a74` |
| `--highlight-ink` | `#ffffff` |

Dark (`[data-theme="dark"]`):

| Token | Value |
|---|---|
| `--bg`, `--bg-sunken` | `#13111d` |
| `--surface` | `#1b1829` |
| `--elev-2`, `--accent-soft` | `#252136` |
| `--layer-3` | `#332d4a` |
| `--line` | `#2c2740` |
| `--text` | `#eeebf7` |
| `--text-2` | `#a9a3c2` |
| `--accent` | `#b3a5f0` |
| `--accent-ink` | `#17132a` |
| `--highlight` | `#5cc8bd` |
| `--highlight-ink` | `#062623` |

`--highlight` is the secondary accent, reserved for success, completion, and positive schedule states. Existing task-kind colors survive as metadata only — rails, dots, and calendar ribbons — never as panel fills.

Legacy semantic aliases (`--border`, `--muted`, `--surface-2`, `--elev-3`, `--bg-elevated`) are kept as aliases onto the new tokens so a palette change stays single-source.

### Typography

- **Bricolage Grotesque** — page titles, hero statements, and large numbers.
- **Onest** — everything else: navigation, body, rows, labels, forms, buttons, metadata.
- **JetBrains Mono** — the `⌘K` chip only.

Rules:

- **No tracked all-caps anywhere.** Sentence case throughout, including weekday headers and section labels.
- Metadata that previously used all-caps mono becomes 12–13px Onest in `--text-2`.
- Scale: page title 30–34px/700; section title 16–18px/600; body and task title 14–15px; metadata 12–13px.

### Shape and motion

- `--r-md: 15px` as specified by Mix 7. Controls 10px; large focus surfaces 18px.
- Flat sections by default; shadow only on floating overlays.
- Hover/focus 120–160ms; overlays 180–220ms; `prefers-reduced-motion` honored.

## Structural changes

### 1. One header per page

The topbar keeps identity, search, `⌘K`, notifications, and avatar. It **loses** the page title and the duplicate `New task`.

The page keeps one heading and one primary action. **All eyebrow labels are removed.**

`Connect Canvas` moves out of the topbar into Settings → Integrations, surfacing on Today as a dismissible one-time prompt only while unconnected.

### 2. Sidebar collapses later

The labeled 216px sidebar already exists and is correct. Only its breakpoint changes: the collapse at `globals.css:5521` moves from `max-width: 1160px` to `max-width: 1024px`, so laptops at 1280×800 keep labels. Tooltips on the collapsed rail and the mobile bottom navigation are unchanged.

### 3. One create path

Page-header `New task` plus `⌘K`. **The floating mic FAB is removed** — voice already exists inside the Console composer and remains reachable there and through the palette. Inline `Add a task` survives only inside an empty state, never alongside a header button.

### 4. One empty state per surface

One sentence and at most one action. Today, Tasks, and Calendar each state an empty schedule once.

### 5. Today answers one question

Order: next task → today's list → one density strip.

- The hero presents the next incomplete task, or one calm line when there is none.
- **The 3D sphere is removed**, along with the `three`, `@react-three/fiber`, and `@react-three/drei` dependencies if nothing else imports them.
- **`MonthRhythm` moves to Calendar.** Today keeps the seven-day strip only.

### 6. Calendar gets one toolbar

Month label, previous/next, `Today`, calendar filters, and `New task` merge into a single row. The task-kind legend becomes a popover rather than a permanent strip.

**Taxonomy collision:** the task-kind `Personal` is renamed `Personal time` so it no longer collides with the `Personal` calendar. This is a display-string change only; stored values are untouched.

Grid: cell borders reduce to a light grid, leading and trailing month days recede, and today versus selected day are distinguished by two different indicators rather than a large fill. `MonthRhythm` density arrives here.

### 7. Console gets one header

The `Tangent AI` bar merges into the page header. Mode is expressed **once** — the in-composer `Plan`/`Calendar` toggle stays, the header `Calendar mode` pill goes. `Your Brief` and chat management remain, one level down.

## Components

Adapt in place rather than replacing:

- `AppShell` — sidebar, single topbar, responsive navigation.
- `components/ui/*` — existing primitives absorb the new tokens.
- `MonthRhythm` — moves to the Calendar route unchanged in logic.
- `VoiceCaptureFab` — removed; its call sites drop.
- `components/dashboard/*` — `UrgencyHero` loses the sphere, `WeekAhead` stays, the second density view goes.

## Data flow

`AppStateProvider` remains the source of tasks, calendars, plans, and user data. `lib/schedule-insights.ts` is unchanged. Every API route, Canvas ingestion path, Gmail path, Deepgram path, cron, and voice handler is untouched.

## Accessibility

- Semantic headings and landmarks; one `h1` per page.
- Every control has an accessible name; focus rings are a visible 2px perimeter.
- Overlays trap focus, close on Escape, restore focus to trigger.
- Keyboard order follows visual order.
- Touch targets 44px where space allows.
- **Mix 7 contrast must be verified, not assumed** — `--text-2` `#575170` on `--bg` `#f5f3fa`, and `--accent` `#4b3a8c` with `--accent-ink` `#ffffff`, both against WCAG AA. Any pair that fails is darkened or lightened within the Mix 7 family and the change is recorded here.

## Verification

- Every route at 1440, 1024, 768, and 390px, in both themes.
- No horizontal page scroll; no overlay clipping; no element covering content.
- Tab through every route and overlay with focus visible throughout.
- Confirm each removed duplicate is genuinely gone and its single remaining instance works.
- `npx tsc --noEmit` exits 0.
- `npm run build` exits 0.
- `git diff` reviewed for accidental API, store, voice, or ingestion changes.
