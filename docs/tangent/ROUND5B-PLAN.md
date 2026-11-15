# Round 5B — "You, mapped" (Settings → What Tangent knows)

Spec: `D:\TANGENT showcase\Round 5\tangent-round5B-prompt.md`. This file is the plan and the log.

## Approval
- 2026-11-15: Sid: "if you are doing it, do the entire thing as I will be away from my computer". Read as approval to run Phases 0–4 end to end, one commit per phase, no push.

## Library
None. The map uses the DOM for points plus one `<canvas>` for trails and lines; motion/react is already installed. Added gzipped KB: 0.

## Art style: "ivory constellation"
- Ivory stage (`--map-bg`) with a faint paper grain (an SVG feTurbulence filter, inline, no image file).
- Fine, tilted elliptical orbit trails in very light warm grey (`--map-ring`), drawn on canvas.
- Centre: a pearl-shaded circle (radial gradient of warm white tokens), the student's initials in the display face. No purple.
- Facts are small emerging lights: a 5px core plus a soft radial bloom, pastel and tinted by area.
- Area pills are white with a small pastel dot. No tinted backgrounds or gradients.
- Dark mode: a deep warm-charcoal stage; the same pastels glow a little brighter.

### Pastel tokens (`app/styles/tokens.css`, light and dark)
`--map-bg`, `--map-ring`, `--map-line`, `--map-core-1/2`, and per area `--map-goals` (apricot), `--map-classes` (sky), `--map-commitments` (butter), `--map-work` (sage), `--map-hard` (blush), `--map-future` (aqua). `lib/you-map.ts` colours point to these instead of `--series-*`.

## Phase 1: settings nav and scroll takeover
- `SettingsNav.tsx`: "What Tangent knows" first, with `featured` (larger link and icon).
- `SettingsFrame.tsx`: on the context page, `is-takeover` is set once the page scrolls past 24px. The sub-nav slides left and fades within 250ms; the grid collapses to the map. Back at the top, it returns.
- Reduced motion: no slide; a "‹ Settings" back button shows in takeover and returns to the top.
- Phone (≤860px): on the context page the tabs hide and a "‹ Settings" link goes to /settings.

## Phase 2: the map
- Rendering: `YouOrbit` rebuilt as a level state machine (root → area → fact). Positions lerp toward each level's target.
- Interaction: drag to rotate (pointer capture only after the pointer moves); hover label; click or a 450ms hold drills in; Esc or the back chip goes up a level.
- Connection rules (`lib/you-map-links.ts`, pure, tested). Faint lines, at most 3 per fact:
  - commitments ↔ how you work: they share a time band (morning/afternoon/evening/night) or a weekday
  - goals ↔ projects: keyword overlap with the project title
  - what's hard ↔ goals: keyword overlap
  - same `slotKey` on both facts
- Satellites: active projects on an outer ring, linked to facts they used (GET `/api/context/usage`, from `change_sets.facts_used`; empty when the column is missing).
- 60fps with ~150 points: one rAF loop writing transforms; a dev dense sample checks it.
- Reduced motion: a still layout with no spin; drill-in is instant.
- Accessibility: a roving tabindex across the points (arrows, Enter, Esc). The cards below stay the full accessible list.

## Phase 3: cards and the chat pill
- Cards: no left border; icon chip, title and count in the pastel palette.
- "+ Add" in every area: an inline auto-growing row saved with that area's fact category, through the sensitive filter.
- Edit in place: the fact text becomes an auto-growing textarea in the same font and spot. Enter or ✓ saves, Esc cancels. The category is kept.
- Confirm (guesses) and Forget with Undo stay.
- "Tell Tangent something" pill: full width, taller, a pastel oval with mic and send; the thread sits above it. New facts glow briefly on the map.
- "Forget everything" stays at the bottom as the danger action.

## Phase 4: final check
spec-verifier; ui-checker at 1440 and 390, light and dark; scroll and drill-in screenshots; proof table; commit.

## Conflicts
1. TANGENT-STYLE uses the purple accent everywhere; the spec says no purple on the map. The map uses its own pastel tokens; the rest of Settings is unchanged.
2. TANGENT-STYLE says nothing moves on its own. The map's slow idle drift and the new-fact glow are written up as an exception (like the 5A notification spring). Both are off under reduced motion.

## Log
- 2026-11-15 Phase 0: plan written.
- 2026-11-15 Phase 1 done (signed-out /dev/app/settings-context):
  - featured link first: `docs/design/screens/round5b/p1-knows-1440-top.png`
  - takeover at scrollY 600: class `is-takeover`, sub-nav opacity 0, grid `0px 1040px` (Playwright evaluate); `p1-knows-1440-takeover.png`
  - back at the top: sub-nav opacity 1
  - reduced motion: the "Settings" chip shows (display flex, sticky top 12px), sub-nav hidden; `p1-knows-1440-reduced-takeover.png`
  - 390: back link shown, tabs hidden, scrollWidth 384 ≤ 390; `p1-knows-390.png`
  - tsc clean; `npm test` 922 pass; eslint clean on both files
  - EXTRA: a sticky "Settings" back link on the phone (the spec asks for a link; sticky is my choice); hysteresis (on at 48px, off at 8px) so the layout change can't flicker
