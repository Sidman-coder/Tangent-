# Tangent style: Quiet Violet

> **Mood:** a clean desk on a school morning. Near-white paper, thin pencil lines, one violet pen for the thing you should press, and small colored stickers that say which project something belongs to. Calm, light, friendly, obvious. A student opens it on a phone between classes and knows what to do in 3 seconds.

Round 3, Phase 1 design spec. It is written for people and for coding agents. It is the single reference for Phases 2–4. Research notes live in [REFERENCE-NOTES.md](REFERENCE-NOTES.md); wireframes and the build plan live in [WIREFRAMES.md](WIREFRAMES.md) and [PLAN.md](PLAN.md).

---

## 1. Direction debate

The brief offered three directions. The logo and the violet brand stay in every option.

### A. Visitors: white blueprint

White canvas, lavender `#918df6`, pill buttons, hairline rules, a "blueprint" grid feel.

| Pros | Cons |
|---|---|
| Very calm and light; it reads as "nothing urgent here", which suits a planner | Lavender `#918df6` is only 2.9:1 on white: it fails AA for text and white-on-lavender button labels |
| Hairlines and lots of white let many project colors coexist without noise | The blueprint grid motif is decorative; on a 390px phone it becomes clutter |
| Pill buttons and pill tabs are friendly and thumb-shaped (44px tall is natural) | Pills everywhere flatten hierarchy: chips, tabs and buttons can look alike |
| Near-zero shadows means no muddy elevation in dark mode | It has no defined dark theme; we would have to invent one |

### B. Dimension: dark glass

Near-black `#0a0a0a`, frosted glass panels, weight-500 type.

| Pros | Cons |
|---|---|
| Looks premium in a demo; glass bars feel native on iOS | Dark-first contradicts "light is the default"; most students use school laptops in bright rooms |
| Weight-500 text is crisp on dark | Frosted glass over moving lists costs GPU on low-end phones and Chromebooks, and blurred backdrops lower text contrast |
| Project colors glow nicely on black | Pure black plus glass is what Tangent already has (the "Apple pass" and `liquid-glass.css`), and the audit shows it makes chrome louder than content |
| | Glass layered on glass makes it hard to tell sheet, card and page apart |

### C. Flox: crisp ink

White, `#020817` ink, a violet→pink gradient CTA, 6px buttons, 12px cards, Geist.

| Pros | Cons |
|---|---|
| Strong, disciplined component system; small radii read as "tool", not "toy" | The gradient CTA is loud and fights project colors; the audit already flags a gradient "New project" button as noise |
| Very high text contrast with near-black ink | 6px buttons feel corporate and less friendly to a 15-year-old; it reads as SaaS admin |
| 12px cards are a good middle radius | Geist would be a third typeface; Tangent already ships Bricolage and Figtree |
| Clear states (hover, focus, disabled) are part of the system | Pink in the gradient collides with the rose project hue |

### Decision: a blend called "Quiet Violet"

| Take from | What |
|---|---|
| **Visitors** | The structure: a near-white canvas, hairlines instead of boxes, pill buttons, pill segmented tabs, almost no shadows |
| **Flox** | The discipline: near-black violet ink for text, 12px cards, one clear button family with full states, solid (never gradient) primary |
| **Dimension** | Dark-theme parity only: a calm slate-violet dark (not pure black), weight 500 for UI labels, glass kept **only** on the two bars (top bar and phone bottom nav) |
| **Tangent** | The logo, Bricolage Grotesque for display, deep violet `#5641b8` as the one action color, and the 10-hue project palette from `lib/task-colors.ts` |

Why it fits students: the screen is mostly white space and dark text, so many project colors can sit on it without noise. Exactly one thing per screen is violet and filled (the next action). Pill controls are 44px and thumb-shaped. The dark theme is a soft slate-violet for late-night homework, not an OLED void.

What would change this: if pilot students say the app "looks empty" or "looks like a school form", add warmth through illustration in empty states before adding color to chrome.

---

## 2. Theme summary

| | Light (default) | Dark |
|---|---|---|
| Canvas | `#f7f6fb` near-white with a hint of violet | `#121119` slate-violet, never `#000` |
| Surfaces | White cards on hairlines | `#1b1a24` cards on hairlines |
| Ink | `#1c1a26` | `#f1eff8` |
| Action | Solid violet `#5641b8`, white label | Soft violet `#b3a5f0`, dark label |
| Project color | Dots, a 3px stripe, and 14% tints with ink text | Dots, stripe, and 20% tints with light text |
| Elevation | Hairline + very faint shadow only on floating layers | Hairline + a lighter surface; no shadows |

Theme switching stays as it is: `data-theme="light|dark"` on `<html>`, set by `THEME_BOOTSTRAP` from `localStorage["tangent-theme"]`, light by default. Update the `theme-color` meta to `#f7f6fb` / `#121119`.

---

## 3. Color tokens

All pairs below were measured (WCAG 2.x relative luminance). "Text" pairs need 4.5:1, UI boundaries 3:1.

### Core

| Token | Light | Dark | Use | Contrast (checked) |
|---|---|---|---|---|
| `--bg` | `#f7f6fb` | `#121119` | Page canvas | — |
| `--surface` | `#ffffff` | `#1b1a24` | Cards, sheets, rows, composer | — |
| `--elev-2` | `#f1eff7` | `#24222f` | Sunken fills: segmented track, hover row, input fill, skeleton base | — |
| `--layer-3` | `#e9e6f1` | `#2e2b3a` | Pressed / selected fill, skeleton shimmer peak | — |
| `--line` | `#e6e3ee` | `#2c2a38` | Hairlines between rows, card borders | decorative |
| `--line-strong` | `#c9c4d8` | `#4a4659` | Dividers that must show (table head, sheet grabber) | decorative |
| `--field-line` | `#8f8aa3` | `#6f6a84` | Input and checkbox borders (must be visible) | 3.32 / 3.34 ✓ |
| `--text` | `#1c1a26` | `#f1eff8` | Titles, body | 17.1 / 15.1 ✓ |
| `--text-2` | `#555068` | `#bdb9cc` | Secondary text, labels | 7.7 / 9.0 ✓ |
| `--text-3` | `#6b667c` | `#9d99ae` | Meta: times, counts, placeholders | 5.5 / 6.2 ✓ (4.8 / 5.7 on `--elev-2`) |
| `--accent` | `#5641b8` | `#b3a5f0` | Primary button fill, active nav icon, focus ring, checkbox fill | — |
| `--accent-hover` | `#47349f` | `#c4b9f5` | Primary hover | — |
| `--accent-ink` | `#ffffff` | `#17132a` | Text on `--accent` | 7.4 / 8.2 ✓ |
| `--accent-text` | `#4a37a3` | `#c4b9f5` | Violet text and links on surfaces | 8.9 / 9.5 ✓ |
| `--accent-soft` | `#efecfb` | `#2a2540` | Selected chip, active nav pill, user chat bubble | text on it 7.6 / 8.1 ✓ |
| `--accent-line` | `#cfc7f2` | `#463d6e` | Border of selected chip and focused composer | decorative |
| `--focus` | `#5641b8` | `#b3a5f0` | 2px focus ring + 2px offset | 6.9 / 8.5 vs canvas ✓ |
| `--green` | `#1e7a52` | `#5cc8a0` | Done check, "On track", success toast icon | 5.3 / 8.4 ✓ |
| `--green-soft` | `#e3f1ea` | `#1d3229` | Success tint (rare) | — |
| `--amber` | `#94600a` | `#e0b15c` | "Planned for Mon" (flexible, slipped), "Behind" | 5.3 / 8.7 ✓ |
| `--amber-soft` | `#f6eedf` | `#3a3022` | Warning tint (rare) | — |
| `--red` | `#c0364a` | `#f2707f` | Past due fixed items, reminders, danger buttons, Now line | 5.4 / 6.1 ✓ |
| `--red-soft` | `#f9e6e9` | `#3a2129` | Danger confirm panel fill | — |
| `--red-ink` | `#ffffff` | `#17132a` | Text on `--red` | 5.4 / 6.4 ✓ |
| `--highlight` | `= --green` | `= --green` | Legacy alias, kept until Phase 4 removes callers | — |

### Project palette (10 hues + 2 quiet)

These come unchanged from `SERIES_PALETTE` / `QUIET_SERIES` in `lib/task-colors.ts`, which already emits `--series-<key>` and `--series-<key>-ink`. **Project colors are used as dots, a 3px left stripe, and tinted blocks only. Never as text on a tint, never as a page or chrome color.**

| Key | Light | Dark | Light tint (14%) | Dark tint (20%) | Dot vs surface L / D |
|---|---|---|---|---|---|
| violet | `#6d55c7` | `#a08ff0` | `#ebe7f7` | `#36314d` | 5.6 / 6.3 |
| teal | `#0f7f76` | `#4cc4b8` | `#ddedec` | `#253c42` | 4.9 / 8.1 |
| rose | `#c43c5c` | `#f0708b` | `#f7e4e8` | `#462b39` | 5.1 / 6.1 |
| blue | `#2f6dcc` | `#6ba4f2` | `#e2ebf8` | `#2b364d` | 5.0 / 6.7 |
| amber | `#9c660a` | `#e0b04c` | `#f1eadd` | `#42382c` | 4.9 / 8.6 |
| green | `#2b8249` | `#62c585` | `#e1eee6` | `#293c37` | 4.8 / 8.1 |
| magenta | `#ad38a1` | `#e078d6` | `#f4e3f2` | `#422d48` | 5.4 / 6.4 |
| indigo | `#3f4cb8` | `#8a95ee` | `#e4e6f5` | `#31334c` | 7.2 / 6.2 |
| orange | `#c2541a` | `#f08f55` | `#f6e7df` | `#46312e` | 4.6 / 7.2 |
| cyan | `#0d7a98` | `#4cbcdc` | `#ddecf1` | `#253a49` | 4.9 / 7.8 |
| personal (quiet) | `#64708a` | `#94a0b8` | `#e9ebef` | `#333542` | 5.0 / 6.5 |
| neutral (quiet) | `#8a8699` | `#6f6b80` | — | — | dot only |

Tinted blocks put `--text` on the tint: 13.8–14.4:1 in light and 10.1–11.1:1 in dark. The series color itself on its own tint is only 3.8–5.8:1, so it is **not** allowed as body text. The tint is computed in CSS: `color-mix(in srgb, var(--series-teal) 14%, var(--surface))` (20% in dark), exposed as `--series-tint` on the block.

---

## 4. Typography

| Role | Family | Weights | Loaded by |
|---|---|---|---|
| Display (`--font-display`) | Bricolage Grotesque Variable | 600 (titles), 700 (big numbers only) | `@fontsource-variable/bricolage-grotesque/opsz.css` (already imported in `app/layout.tsx`) |
| Body / UI (`--font-body`) | Figtree Variable | 400 body, 500 labels and buttons, 600 row titles and headers | `@fontsource-variable/figtree` (already a dependency; import it in `app/layout.tsx`) |
| Mono (`--font-mono`) | IBM Plex Mono | 400 | Only for code and IDs in Settings › Your data; times use Figtree `tabular-nums` |

Fallbacks: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Use `font-display: swap` (fontsource default) and `font-variant-numeric: tabular-nums` for times, counts and stats.

### Type scale

| Token | Size / line | Weight | Family | Use |
|---|---|---|---|---|
| `--t-display` | 30 / 36 (phone 26 / 32) | 600 | Display | Page title ("Today", project name) |
| `--t-title` | 20 / 26 | 600 | Display | Section titles, sheet titles, big stat numbers (700) |
| `--t-head` | 15 / 20 | 600 | Body | Group headers (Morning, project name in a group) |
| `--t-body` | 15 / 22 (phone 16 / 22 in inputs) | 400 | Body | Rows, chat text, settings rows |
| `--t-label` | 13 / 18 | 500 | Body | Buttons (small), chips, tabs, meta |
| `--t-caption` | 12 / 16 | 500 | Body | Nav labels (phone), timestamps, helper text. Never below 12px |

Rules: one display weight (600). Sentence case everywhere; only the small group labels ("PAST DUE", "COMING UP") use uppercase 12px / 500 / 0.04em tracking in `--text-3`. Inputs use 16px on phones so iOS does not zoom.

---

## 5. Spacing, shape and layout

**Spacing:** a 4px base. Tokens `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40, `--s-12` 48. Row padding is 10px × 12px; card padding 16px (phone) / 20px (desktop); page gutter 16px (phone) / 32px (tablet) / 40px (desktop).

### Radius

| Token | Value (old → new) | Use |
|---|---|---|
| `--r-xs` | — → 6px | Tags, tiny badges, calendar blocks |
| `--r-sm` | 10 → 8px | Inputs, rows (hover fill), menu items |
| `--r-md` | 15 → 12px | Cards, toasts, popovers, preview cards |
| `--r-lg` | 18 → 16px | Composer, sheets (top corners), chat bubble |
| `--r-pill` | — → 999px | Buttons, chips, segmented tabs, bottom nav, FAB |

### Shadows (minimal)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--shadow-sm` | `0 1px 2px rgb(28 26 38 / .06)` | `none` | Raised segmented pill, composer at rest |
| `--shadow-md` | `0 4px 16px rgb(28 26 38 / .08)` | `0 0 0 1px var(--line)` | Popovers, toasts, menus |
| `--shadow-lg` | `0 12px 40px rgb(28 26 38 / .14)` | `0 0 0 1px var(--line-strong)` | Sheets, modals |

Cards on the page get **no** shadow: a 1px `--line` border only.

### Layout widths

| Token | Value | Use |
|---|---|---|
| `--rail-w` | 232px (was 216) | Desktop sidebar |
| `--content-max` | 760px for lists (Home, Today, Project, Chat); 1180px for Calendar and Settings | Main column |
| `--page-gutter` | 16 / 32 / 40px | Phone / tablet / desktop |
| `--topbar-h` | 56px | Desktop and phone top bar |
| `--bottom-nav-h` | 64px + `env(safe-area-inset-bottom)` | Phone bottom nav |
| `--tap` | 44px | Minimum hit area for anything you can press |

Breakpoints: phone `< 768px` (bottom nav, sheets, one column), tablet `768–1099px` (collapsed icon rail, one column), desktop `≥ 1100px` (full sidebar, optional right panel on Project and Calendar).

---

## 6. Surfaces and elevation

| Level | What | Light | Dark |
|---|---|---|---|
| 0 Canvas | Page background | `--bg` | `--bg` |
| 1 Surface | Cards, list containers, composer, settings groups | `--surface` + 1px `--line` | `--surface` + 1px `--line` |
| 1s Sunken | Segmented track, input fill, row hover | `--elev-2` | `--elev-2` |
| 2 Floating | Popover, menu, toast | `--surface` + `--shadow-md` | `--elev-2` + 1px `--line` |
| 3 Overlay | Sheet, modal, task detail | `--surface` + `--shadow-lg`, scrim `rgb(18 17 25 / .32)` | `--elev-2`, scrim `rgb(0 0 0 / .55)` |
| Bars | Top bar, phone bottom nav | `--glass` = `rgb(255 255 255 / .82)` + `blur(16px) saturate(1.4)` + hairline | `rgb(27 26 36 / .82)` + same blur |

Glass appears **only** on the two bars, and has a solid fallback under `@supports not (backdrop-filter: blur(1px))` and under `prefers-reduced-transparency: reduce`. Neumorphism (`--neu-*`) is retired.

---

## 7. Iconography

- **lucide-react** only, `strokeWidth={1.75}`, size 18px in rows and buttons, 20px in nav, 16px in chips. Color `currentColor`.
- Icon-only buttons always have an `aria-label` and a 44px hit area (the icon stays 18–20px).
- A small fixed set, so the same thing always has the same icon:

| Meaning | Icon |
|---|---|
| Home (capture + today) | `House` |
| Calendar | `CalendarDays` |
| Projects | `FolderKanban` |
| Chats | `MessagesSquare` |
| Settings | `Settings` |
| Notifications | `Bell` |
| Mic / listening | `Mic` / `AudioLines` |
| Send | `ArrowUp` |
| Done | `Check` (in a circle checkbox) |
| Not today | `CalendarArrowUp` |
| Too big | `Scissors` |
| Fresh start | `RotateCcw` |
| Morning / Afternoon / Evening / Night / Anytime | `Sunrise` / `Sun` / `Sunset` / `Moon` / `Infinity` |
| AI suggestion | `Sparkles` (small, `--text-3`; never as decoration) |
| More | `Ellipsis` |

---

## 8. Components

Every component below lives in `components/ui/` (Phase 2), uses only tokens, and has a 44px minimum hit area. States listed for each: default, hover (desktop), pressed, focus-visible, disabled, and loading where it applies. Focus is always `outline: 2px solid var(--focus); outline-offset: 2px`.

### Button

| Variant | Default | Hover | Pressed | Disabled |
|---|---|---|---|---|
| `primary` | `--accent` fill, `--accent-ink` label | `--accent-hover` | scale .98 | 40% opacity, no pointer |
| `secondary` | `--surface`, 1px `--field-line`, `--text` | `--elev-2` fill | `--layer-3` | 40% |
| `ghost` | transparent, `--text-2` | `--elev-2` fill, `--text` | `--layer-3` | 40% |
| `danger` | `--red` fill, `--red-ink` | darken 8% | scale .98 | 40% |
| `danger-quiet` | transparent, `--red` text | `--red-soft` fill | — | 40% |

Sizes: `md` 44px tall, 16px padding, 15px / 500 label; `sm` 36px visible with a 44px hit area (pseudo-element), 13px / 500. Shape: `--r-pill`. Icon left at 18px, 8px gap. Loading: the label stays, a 16px spinner replaces the icon, `aria-busy="true"`. **One primary per view.** No gradients.

### IconButton

A 44 × 44 round hit area; the visible round fill is 36px for `ghost` (fill on hover only) and 44px for `filled` (`--accent`, used for Send). Required `label` prop → `aria-label` + tooltip on desktop after 500ms.

### Chip / Tag

| Variant | Look | Use |
|---|---|---|
| `filter` | 32px pill, `--elev-2`; selected: `--accent-soft` + 1px `--accent-line` + `--accent-text` | Answer options in Grill, filters |
| `project` | 24px pill, 8px series dot + name, `--surface` + 1px `--line`, 13px `--text-2` | Project chips on cards and in task detail |
| `meta` | 24px, no border, `--elev-2`, 12px `--text-2`, optional 14px icon | "Tue 4:00 PM", "45 min", "Fixed" |
| `status` | 24px, tone icon + word, tone color text on `--surface` | "On track" (green), "Behind" (amber), "Past due" (red) |

Chips never wrap their text; long names truncate with an ellipsis and a `title`.

### SegmentedTabs

A `--elev-2` track (`--r-pill`, 4px padding, 44px tall) with a white `--surface` active pill (`--shadow-sm`, dark: `--layer-3`) that slides with Motion `layoutId` (200ms). Labels 13px / 500; the active one is `--text`, the others `--text-2`. Optional 16px icon. Keyboard: arrow keys move, `role="tablist"`. **Underline variant** for Settings sub-tabs and the Chats library: text tabs with a 2px `--accent` underline under the active one and a hairline row.

Home view tabs: **All · School · Projects · Personal**. The last choice is remembered in `localStorage["tangent-home-view"]`.

### Input with mic (Composer)

One component for Home capture, Home chat, and task/project chats.

```
╭────────────────────────────────────────────────────────╮
│ Type or say anything…                                  │  ← textarea, 1–6 lines, 16px
│                                                        │
│ [Auto ▾]                                    (🎙)  (↑)  │  ← destination pill · mic · send
╰────────────────────────────────────────────────────────╯
```

- `--surface`, 1px `--line`, `--r-lg`, `--shadow-sm`. Focus: border `--accent-line` + 3px `--accent-soft` ring.
- **Auto ▾ pill** (Home only): a `ghost` chip that opens a menu: Auto · Today · Calendar · a project… Its label shows the choice.
- **Mic**: a 44px ghost IconButton. Listening: the icon turns into `AudioLines` in `--red` with a calm 1.2s pulse (scale 1 → 1.06, off under reduced motion), and **live words** stream into the textarea in `--text-3` until final.
- **Send**: a 44px `filled` IconButton, `ArrowUp`, disabled (40%) when empty.
- Enter sends; Shift+Enter makes a new line; Esc stops listening.
- Inputs have an `id` and a `name`, and a visually hidden `<label>`.

### Task row

```
[○]  Unit 3 LEQ Essay                      4:00 PM   ⋯
     ● AP World History · 45 min                         ← subline only where useful
```

- 48px minimum height (56 with a subline), 10px × 12px padding, hairline below (not on the last row).
- **Left:** a 22px circle checkbox (1.5px `--field-line`; done: `--green` fill + white check), 44px hit area.
- **Title:** `cleanTaskTitle()` output, 15px / 500 `--text`, one line, ellipsis. Must-do rows: 600 weight and a 3px `--red` (fixed deadline) or `--accent` (must-do) left stripe inside the row. **No red tint background.**
- **Right:** a time in 13px `tabular-nums` `--text-3`; past due shows a red dot + "Mon" in `--red`; slipped flexible steps show "Planned for Mon" in `--amber`.
- **No project name and no tags in grouped views** (the group header carries them). The ungrouped Calendar agenda shows the series dot before the title.
- Done: title `--text-3` with a line-through at 60% opacity; the row stays in place.
- **Actions:**
  - Desktop: on hover or focus-within, three ghost IconButtons appear at the right (Done · Not today · Too big) plus `⋯`.
  - Phone: swipe right to complete (green), swipe left to reveal Not today / Too big. A tap opens task detail, which has the same three actions as buttons.
- Motion: check-off (react-todo-list): the check draws in 150ms, the row fades to the done style in 200ms; removal collapses height in 200ms.

### Project group header

`● Project name` with an 8px series dot, 15px / 600 `--text`, an optional count in `--text-3`, and a hairline. 36px tall; links to the project (the whole header is a link with a `ChevronRight` on hover).

### Time-of-day header

`☀ Afternoon   12 PM – 5 PM            3` with an 18px lucide icon in `--text-3`, 15px / 600 label, the range in 13px `--text-3`, and the count at the right. Collapsible when empty or done (chevron). The **Now line** is a 1px `--red` rule with a 6px dot and a "2:40 PM" caption, between rows.

### Card

`--surface`, 1px `--line`, `--r-md`, 16/20px padding, no shadow. Variants: `plain` (no border, for inside a sheet), `outlined` (default), `muted` (`--elev-2` fill, no border) for tips and "How this was planned". A header slot (title 15px / 600 + optional action) and a body. Cards never nest inside cards.

### Sheet / modal

- **Phone:** a bottom sheet (react-sheet-modal): `--r-lg` top corners, a 36 × 4px `--line-strong` grabber, drag to dismiss, max height 92dvh, content scrolls inside **one** scroller, sticky footer for actions above `safe-area-inset-bottom`.
- **Desktop:** a right side sheet 440px wide for task detail and notifications; a centered modal (560px max) for confirms that need focus.
- Scrim fades in 200ms; the sheet slides 250ms with an ease-out curve. Focus is trapped; Esc and the scrim close it; focus returns to the opener. A title is always present (visually or `aria-labelledby`).

### Toast

Bottom-center on phone (above the bottom nav), bottom-left on desktop. `--surface`, `--shadow-md`, `--r-md`, max 400px. A tone icon (green check / violet info / amber warning / red error) carries the meaning; the card stays neutral. Text: what happened ("Moved to tomorrow"); optional **Undo** as a `sm` secondary button at the right. Stack up to 3 with a slight offset (react-toast-stack). Auto-dismiss after 5s (8s with Undo), paused on hover/focus. `role="status"` (errors: `role="alert"`).

### Empty state

A 40px soft square (`--elev-2`, `--r-md`) with a 20px lucide icon in `--text-3`, a title at 15px / 600, one or two lines at 13px `--text-2`, and at most one `secondary` button. Centered in its container, never a tinted card. Copy is friendly and specific ("You're all caught up. Anything on your mind? Say it above.").

### Skeleton

Blocks in `--elev-2` with a shimmer gradient to `--layer-3` sweeping in 1.2s (react-skeleton-shimmer); static under reduced motion. Skeletons match the real layout (row height, title width ~60%, time width 48px) so nothing shifts when data lands. Show after 150ms only, to avoid a flash on fast loads.

### Nav: desktop sidebar + phone bottom bar

**Desktop sidebar** (`--rail-w` 232px, `--bg` with a 1px `--line` right edge, no glass):
- Top: logo + wordmark, then a 40px "New" ghost button (focuses the Home composer).
- Items: Home · Calendar · Projects · Chats. **Home is `/`: the composer plus today's list** (it replaces the old "Today" item, so capture and today live on one screen; `/today` keeps redirecting to `/`). Each row is 40px tall (44px hit), a 20px icon and a 14px / 500 label. Active: `--accent-soft` pill with `--accent-text` icon and label. Counts in 12px `--text-3` at the right (Home shows today's open count).
- A "PROJECTS" section label, then up to 8 projects with a series dot and a small progress pie, then "All projects".
- Bottom: Notifications (bell + unread dot), Settings, and the user avatar row.
- Tablet: collapses to a 72px icon rail with tooltips.

**Phone bottom bar** (glass, `--bottom-nav-h`, full width, hairline on top, not floating):
- 5 items: **Home · Calendar · Projects · Chats · Settings**. Each is a 20px icon over a **12px / 500 label**, at least 64px wide and 48px tall. Active: an `--accent-soft` pill behind the icon plus `--accent-text`.
- The bell moves to the phone top bar and opens the Notifications sheet.
- **No global floating mic.** The mic lives in the composer. On Calendar and the Projects list (no composer on screen), a 56px round `--accent` mic FAB sits 16px above the bottom bar at the right and opens Home with listening started (react-floating-action-button). It never covers the last row: those lists get `padding-bottom: calc(var(--bottom-nav-h) + 88px)`. Home, chats, project pages and Settings have no FAB.

### Chat bubble + composer

- A Claude/ChatGPT-style column, `--content-max` 760px, centered.
- **User:** right-aligned bubble, `--accent-soft` fill, `--text`, `--r-lg` (bottom-right 6px), max 85% width.
- **Tangent:** full-width plain text on the canvas, no bubble, rendered markdown (paragraph spacing 8px, lists with 4px gaps, bold lead lines, inline code in `--elev-2`). Small ghost actions under the message (Copy, Retry) on hover.
- **Preview cards** (plan preview, task changes) are full-width `outlined` Cards inside the column, never wider than the column.
- **Typing indicator:** three 6px `--text-3` dots, staggered bounce at 150ms, under reduced motion a static "Thinking…".
- **Auto-scroll** while at the bottom; when the user scrolls up, a round "Jump to latest ↓" IconButton appears above the composer.
- The composer is pinned at the bottom of the chat container (sticky, not fixed) and sits above the on-screen keyboard (`interactive-widget=resizes-content` in the viewport meta + `dvh` units).
- The header has the chat title, a back/close, and **Done** (collapses an expanded Home chat back to Home).

### Progress / pace

- **Big number:** "3 of 7" in Bricolage 700 / 20px with "steps done" in `--text-3`; a 6px `--elev-2` bar with an `--accent` fill (`--green` at 100%).
- **This week's dots:** one 10px circle per planned session this week: filled `--accent` = done, ring `--field-line` = planned, a ring with `--red` = missed. Labelled "This week" with `aria-label="2 of 4 sessions done this week"`.
- **One sentence** of encouraging pace copy, whole numbers only: "On track: 2 of 4 sessions done this week." "A little behind: catch up with 1 extra session." "Starts Tue, Nov 17." Never a raw float; "On track" only when the stats say so.
- Number changes animate with react-number-trend (200ms), static under reduced motion.

### Calendar block

A `--r-xs` block filled with the series tint, a 3px left stripe in the series color, a title in 13px / 600 `--text` and the time in 12px `--text-2`. Past blocks at 60% opacity. Blocks under 30 minutes show the title only. Fixed items (classes, deadlines) get a solid stripe; flexible steps get a 2px dashed left stripe. Text never sits on a solid project color. Drag: the block lifts with `--shadow-md` and the slot under it shows an `--accent-line` dashed outline.

### Settings row

A 56px row inside an `outlined` Card group: a title (15px / 500), an optional one-line description (13px `--text-2`), and one control at the right: a Switch, a `secondary sm` button, a select (custom-styled, 44px), or a `ChevronRight` for navigation. Exactly one action per row; destructive rows use `danger-quiet` and expand an inline **ConfirmPanel** (`--red-soft` panel, a sentence saying what will be lost, Cancel + `danger` button). Never `window.confirm`.

---

## 9. Motion

Library: `motion` (v13, already installed), wrapped by the existing `MotionProvider`, which must set `reducedMotion="user"`.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 150ms | Hover, press, check draw, tooltip |
| `--dur` | 200ms | Tab pill slide, fade, row collapse, toast |
| `--dur-slow` | 250ms | Sheet and modal enter |
| `--ease` | `cubic-bezier(.2, .8, .2, 1)` | Everything that enters |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | Exits |

| Pattern (motion.dev example) | Where |
|---|---|
| react-todo-list | Task check-off and removal |
| react-toast-stack | Undo toasts |
| react-sheet-modal | Phone sheets: task detail, notifications, Grill card |
| react-base-tabs | SegmentedTabs sliding pill |
| react-animate-presence-modes | `popLayout` for list changes, `wait` for view-tab switches |
| react-skeleton-shimmer | Skeletons |
| react-number-trend | Project stats and pace counts |
| react-floating-action-button | The phone mic FAB on Today and Calendar |

Rules: nothing over 250ms; nothing moves on its own except the mic pulse while listening and the typing dots. Under `prefers-reduced-motion: reduce`, everything becomes an opacity fade of 0–100ms or none.

---

## 10. Voice and copy

- **"Project", never "plan" or "path"** for a goal with steps. "New project", "Project steps", "How this was planned" (the verb is fine; the noun is "project"). The preview is "Review project", not "New plan".
- Short, warm, second person: "You're all caught up." "Moved to tomorrow." "Want to split this up?"
- Verb-first task titles, 2–6 words, no project name in the title: "Draft intro paragraph", not "Bio Lab: Draft the introduction paragraph for the lab report".
- Whole numbers and real words: "2 of 4 sessions", "about 45 min", never "1.51 steps".
- Dates: "Tue, Nov 17", "Today", "Tomorrow", "Mon"; times "4:00 PM". Relative only when near: "in 15 min", "2h ago".
- Encouraging, not guilty: "A little behind" not "Overdue by 3 days"; "Fresh start" moves old items, it does not scold.
- Questions follow the contract: ask only when the answer changes the project, always with **Skip** and **Stop**, never blocking.
- Buttons say what happens: "Add 6 steps", "Move to tomorrow", "Delete project". Never "OK" or "Submit".

---

## 11. Do's and Don'ts

**Do**
1. Use exactly one filled violet button per view, for the next action.
2. Show project identity with a dot, a stripe or a tint, and put the project name in the group header once.
3. Keep every pressable thing at 44px or more, with a visible focus ring.
4. Use hairlines (`--line`) to separate, and white space to group.
5. Show loading as skeletons in the real layout, and empty states with one friendly next step.
6. Keep task titles short with `cleanTaskTitle()`; keep the original text in task detail.
7. Check both themes and 390px for every change.

**Don't**
1. Don't use gradients, glow, or neumorphic shadows; glass only on the two bars.
2. Don't put text on a solid project color, or use a project color as text on its tint.
3. Don't tint whole rows red; a dot, stripe or red time is enough.
4. Don't nest a card inside a card, or a scroller inside a scroller.
5. Don't repeat the project name or tags on rows inside a project group.
6. Don't use `window.confirm`, `alert`, or native-looking selects.
7. Don't say "plan" or "path" for a project, or show raw decimals.

---

## 12. Agent Prompt Guide

Paste this into a coding agent before any UI work on Tangent.

> You are editing Tangent's UI (Next.js 14 App Router, TypeScript, plain CSS with custom properties, `motion`, `lucide-react`). Follow `docs/design/TANGENT-STYLE.md`.
> - Use only tokens (`var(--…)`) for color, radius, spacing, shadow, font and duration. No new hex values outside `app/styles/tokens.css`. Project colors only through `--series-*`.
> - Reuse `components/ui/*` (Button, IconButton, Chip, SegmentedTabs, TaskRow, GroupHeader, Card, Sheet, Toast, EmptyState, Skeleton, ProgressPace, Composer). Do not write a new button style.
> - Light is the default; check `[data-theme="dark"]` too. Contrast: text 4.5:1, UI borders 3:1.
> - Every interactive element: 44px hit area, `:focus-visible` ring, an accessible name, keyboard support. Every form field: `id` and `name`.
> - Motion: 150–250ms, `--ease`, and respect `prefers-reduced-motion`.
> - Copy: "project", never "plan"/"path"; verb-first short titles; whole numbers.
> - Do not change data fetching, API routes, auth, the DB, or AI logic. Behavior must stay identical; only the look and layout change.
> - At 390px: no horizontal scroll, nothing under the bottom nav, sheets instead of popovers, one scroller per screen.

---

## 13. Quick Start: CSS custom properties

This becomes `app/styles/tokens.css` in Phase 2: the **only** place colors and base values are defined. The names are the ones the codebase already uses, so existing rules keep working; legacy aliases sit at the bottom until Phase 4 deletes their last callers. `--series-*` stays in `SERIES_CSS` (`lib/task-colors.ts`).

```css
:root,
[data-theme="light"] {
  color-scheme: light;

  /* surfaces */
  --bg: #f7f6fb;
  --surface: #ffffff;
  --elev-2: #f1eff7;
  --layer-3: #e9e6f1;
  --line: #e6e3ee;
  --line-strong: #c9c4d8;
  --field-line: #8f8aa3;

  /* text */
  --text: #1c1a26;
  --text-2: #555068;
  --text-3: #6b667c;

  /* action */
  --accent: #5641b8;
  --accent-hover: #47349f;
  --accent-ink: #ffffff;
  --accent-text: #4a37a3;
  --accent-soft: #efecfb;
  --accent-line: #cfc7f2;
  --focus: #5641b8;

  /* status */
  --green: #1e7a52;
  --green-soft: #e3f1ea;
  --amber: #94600a;
  --amber-soft: #f6eedf;
  --red: #c0364a;
  --red-soft: #f9e6e9;
  --red-ink: #ffffff;

  /* bars */
  --glass: rgb(255 255 255 / 0.82);
  --glass-edge: var(--line);
  --glass-blur: blur(16px) saturate(1.4);

  /* elevation */
  --shadow-sm: 0 1px 2px rgb(28 26 38 / 0.06);
  --shadow-md: 0 4px 16px rgb(28 26 38 / 0.08);
  --shadow-lg: 0 12px 40px rgb(28 26 38 / 0.14);
  --scrim: rgb(18 17 25 / 0.32);
  --tint-amount: 14%;

  /* type */
  --font-display: "Bricolage Grotesque Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-body: "Figtree Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "Cascadia Mono", monospace;
  --t-display: 30px; --t-title: 20px; --t-head: 15px;
  --t-body: 15px; --t-label: 13px; --t-caption: 12px;

  /* shape */
  --r-xs: 6px; --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-pill: 999px;

  /* spacing */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px;
  --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px;

  /* layout */
  --tap: 44px;
  --rail-w: 232px;
  --topbar-h: 56px;
  --bottom-nav-h: calc(64px + env(safe-area-inset-bottom));
  --content-max: 760px;
  --content-wide: 1180px;
  --page-gutter: 16px;

  /* motion */
  --dur-fast: 150ms; --dur: 200ms; --dur-slow: 250ms;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}

[data-theme="dark"] {
  color-scheme: dark;

  --bg: #121119;
  --surface: #1b1a24;
  --elev-2: #24222f;
  --layer-3: #2e2b3a;
  --line: #2c2a38;
  --line-strong: #4a4659;
  --field-line: #6f6a84;

  --text: #f1eff8;
  --text-2: #bdb9cc;
  --text-3: #9d99ae;

  --accent: #b3a5f0;
  --accent-hover: #c4b9f5;
  --accent-ink: #17132a;
  --accent-text: #c4b9f5;
  --accent-soft: #2a2540;
  --accent-line: #463d6e;
  --focus: #b3a5f0;

  --green: #5cc8a0;
  --green-soft: #1d3229;
  --amber: #e0b15c;
  --amber-soft: #3a3022;
  --red: #f2707f;
  --red-soft: #3a2129;
  --red-ink: #17132a;

  --glass: rgb(27 26 36 / 0.82);

  --shadow-sm: none;
  --shadow-md: 0 0 0 1px var(--line);
  --shadow-lg: 0 0 0 1px var(--line-strong);
  --scrim: rgb(0 0 0 / 0.55);
  --tint-amount: 20%;
}

@media (min-width: 768px)  { :root { --page-gutter: 32px; } }
@media (min-width: 1100px) { :root { --page-gutter: 40px; --t-display: 30px; } }
@media (max-width: 767px)  { :root { --t-display: 26px; } }

@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur: 0ms; --dur-slow: 0ms; }
}

/* Legacy aliases: remove each once grep finds no callers (Phase 4). */
:root, [data-theme="light"], [data-theme="dark"] {
  --highlight: var(--green);
  --bg-elevated: var(--surface);
  --bg-sunken: var(--elev-2);
  --surface-2: var(--elev-2);
  --elev-1: var(--surface);
  --elev-3: var(--layer-3);
  --border: var(--line);
  --muted: var(--text-2);
  --secondary: var(--text-2);
  --faint: var(--text-3);
  --purple: var(--accent);
  --purple-deep: var(--accent-hover);
  --purple-glow: var(--accent-soft);
  --radius: var(--r-md);
  --glass-thick: var(--glass);
}
```

Retired with no alias (callers are rewritten in Phase 2): `--neu-fill`, `--neu-dark`, `--neu-light`, `--cal-work`, `--cal-personal`, `--cal-all` (use `--series-*`), and the `--kind-*` set (map to `--series-*` through `lib/task-colors.ts`).
