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
- 2026-11-15 Phase 2 done (signed-out /dev/app/settings-context and settings-context-dense):
  - `YouOrbit.tsx` replaced by `components/settings/YouMap.tsx`: levels root → area → fact; one rAF loop writes transform/opacity/z-index to plain `.you-map-node` wrapper divs, and one canvas draws trails and links
  - link rules in `lib/you-map-links.ts`, tested in `lib/you-map-links.test.ts`; project satellites use GET `/api/context/usage` (`change_sets.facts_used`; empty when the column is missing)
  - perf, dense page (150 facts, 162 points; Playwright CDP `Performance.getMetrics` plus an in-page rAF counter):
    - before: 37fps idle, 29fps dragging, 16.7ms of style recalc per frame
    - after: 60fps idle, 60.4fps dragging, 2.39ms of style recalc per frame
    - the fix: no inline `--c` on moving elements (`data-c` rules on the static children instead); the loop writes to divs, not `<button>`s
  - interaction (Playwright evaluate):
    - an area click spreads its facts with labels
    - a fact click opens the card, and focus lands on `.you-map-light.is-open`
    - Esc goes fact → area → root
    - reduced motion: transforms unchanged over 1.5s
  - fixed a Phase 1 bug: at ≤860px the takeover grid (`0 1fr`) put `.settings-main` in the 0-wide column (0px at 390). The takeover grid is now desktop-only (`components/ui/settings.css`); at 390 in takeover, main is 352px wide and scrollWidth is 384
  - screenshots in `docs/design/screens/round5b/`:
    - `p2-map-root-1440-{light,dark}`
    - `p2-map-dense-1440-dark`
    - `p2-map-area-1440-{light,dark}`
    - `p2-map-fact-1440-{light,dark}`
    - `p2-map-reduced-1440-light`
    - `p2-map-root-390-{light,dark}`
    - `p2-map-area-390-dark`
  - tsc clean; `npm test` 929 pass; eslint clean on the touched files
  - TANGENT-STYLE: Round 5B exception added (idle drift, glow, map palette)
  - known gaps:
    - in the dense sample, facts bunch into bands near the top and bottom of the sphere
    - at 390, an outer satellite label can clip at the stage edge
  - EXTRA:
    - the dev sample pages `/dev/app/settings-context` and `settings-context-dense` (`lib/dev/sample-knows.ts`)
    - the route `/api/context/usage` and `FactUsage` in `lib/store.ts` (needed for the satellite links)
- 2026-11-15 Phase 3 done (signed-out /dev/app/settings-context; in the sample, all writes are local only):
  - cards: no coloured left border (computed `border-left-width` 0.67px, the hairline); icon, title and count kept; a pastel wash and border in the area's `--map-*` colour
  - "+ Add" in each of the six area cards opens an inline auto-growing row with the area preset (`lib/you-map-edit.ts AREA_CATEGORY`), through the sensitive filter:
    - server: `remember` → `addContextEntry` → `prepareFact`
    - sample: `localFact`, which runs `prepareFact`
    - Playwright check: "I take ADHD meds every morning" shows the not-kept message inline
  - edit in place: the `<p>` becomes a textarea with the same font (14px Figtree) in the same spot, multi-line and auto-growing. Enter or ✓ saves, Esc or ✕ cancels. A save keeps the old `factCategory` and `projectId`, then drops the old fact
  - Forget gives an inline "Forgotten. Undo" row (`role=status`) for `UNDO_TOAST_MS` (8s); the forget is sent after that, or on pagehide or unmount, with `keepalive`. Confirm is unchanged
  - Tell pill (`components/settings/KnowsTell.tsx`):
    - full content width (1040 = cards width at 1440), 65px tall, pastel oval, mic and send
    - the thread sits above it
    - real mode: `extract`, falling back to `remember`
    - distress gives `DISTRESS_REPLY`; sensitive text gives the not-kept message with no write
    - new facts glow on the map (`glowIds` → `.you-map-light.is-new`) and in their card
  - "Forget everything" is last in the "You, mapped" section, after the Tell pill
  - Playwright run (signed-out /dev/app):
    - add, sensitive add, edit cancel and save, forget then undo (5 → 5 facts), Tell, then a sensitive Tell all behave as above
    - 0 POSTs to /api/context in the sample
    - no sideways scroll at 1440 or 390, light or dark
    - 44px tap targets at 390
    - console: only signed-out 401s
  - screenshots in `docs/design/screens/round5b/`:
    - `p3-add-row-1440-light`
    - `p3-edit-1440-light`
    - `p3-forget-undo-1440-light`
    - `p3-cards-{1440,390}-{light,dark}`
    - `p3-tell-{1440,390}-{light,dark}`
    - `p3-map-glow-{1440,390}-{light,dark}`
  - tests: `lib/you-map-edit.test.ts` (8); `npm test` 937 pass; tsc clean; eslint clean
  - replaced, not removed: the old one-line "Tell Tangent something" input card is now the Tell pill. The old one-line edit `<input>` is now the in-place field
  - interpretation for Sid: "at the very bottom" is read as the bottom of the "You, mapped" section. The "Bring in what you already have" and "Getting to know you" sections still follow it on the page, as before
  - not built: project cards have no "+ Add" (the spec says "every area"; projects aren't areas)
  - EXTRA:
    - POST /api/context `remember` now passes `factCategory` and `projectId` through (needed for area adds and edits)
    - the keepalive deferred forget
    - fixed the fact sorter: "after school" no longer files a fact under Future; only "after high school" does (`lib/student/facts.ts`). Found when "I work best right after school" went to Future
    - a fact also glows in its card when new
- 2026-11-15 Phase 4 done (all UI checks are signed-out /dev/app/settings-context; nothing below was checked signed in):
  - spec-verifier (base f7019e1^, Phases 1–3): every requirement MET. Its flags are listed under "For Sid" below
  - ui-checker: 1440 and 390, light and dark, plus the scroll and drill-in sequence. Screenshots: `docs/design/screens/round5b/p4-{top,scroll1,scroll2,scroll3,drill-area,drill-fact,drill-back}-{1440,390}-{light,dark}.png`, `p4-tell-1440-light.png`, `p4-drill-area-map-1440-light.png`. No sideways scroll in any view; console only signed-out 401s
  - fixed from the ui-checker findings (re-checked, see the proof table):
    - fact labels ran past the map edge (1440: 50px left; 390: 57px above the stage, and satellite labels 21–27px past the right). Now: a wider margin for the open area ring (`YouMap.tsx` squeeze `- 64`); on a phone, top-half labels sit below their light (`data-side="b"`); satellites on the right put their name on the inside (`data-flip="l"`)
    - an area chip scrolled the page down to its card, so the map's area view was off screen and Escape did nothing. Now a chip opens the area on the map and marks its card, with no scroll; Escape on a chip steps back. **Behaviour change** (Phase 3 had added the scroll)
    - the phone sticky "< Settings" pill now has a solid surface and a soft shadow, so text scrolling under it doesn't show through
    - 16px (was 4px) between the cards and the Tell pill
    - dark mode: card wash 12% (was 7%), so the area colour still reads
    - the Tell pill focus ring uses the map ink, not the purple accent
  - proof table:

    | Requirement | Evidence |
    |---|---|
    | Cards: no left border, pastel wash | Phase 3 Playwright (`border-left-width` 0.67px); `p3-cards-*`; dark bg `color(srgb 0.213 0.183 0.2)` vs plain surface, `p4-fix-tell-*-dark.png` |
    | + Add per area, filtered | `lib/you-map-edit.test.ts` "+ Add in each area…", "the sensitive filter stops…"; `p3-add-row-1440-light.png` |
    | Edit in place, same font, multi-line | Phase 3 Playwright; `p3-edit-1440-light.png` |
    | Forget with Undo | Phase 3 Playwright (5 → 5 after Undo); `p3-forget-undo-1440-light.png` |
    | Tell pill, thread, glow, distress, not-kept | `you-map-edit.test.ts` "distress gets…", "Tangent's reply…", "nothing kept…"; `p3-tell-*`, `p3-map-glow-*` |
    | "Forget everything" last in the section | Phase 3 Playwright DOM order; `p4-fix-tell-*` |
    | Map labels inside the stage | Playwright: label/sat rects vs stage rect at 1440 and 390, idle, area open, fact open → 0 outside (2px tolerance) |
    | Chip keeps the map in view, Escape works | Playwright: `scrollY` 0 → 0 after the chip click, stage top 151 (1440) / 251 (390), chip `aria-pressed`, card `is-focus`; after Escape, 0 pressed. `p4-fix-chip-{1440,390}-{light,dark}.png` |
    | Tell gap | Playwright: 16px at 1440 and 390; `p4-fix-tell-{1440,390}-{light,dark}.png` |
    | Phone back pill opaque | Playwright: computed background `rgb(27, 26, 36)` (dark surface), display flex at 390 |
    | No sideways scroll | Playwright: `scrollWidth ≤ innerWidth` in all 4 views |
    | Code checks | `npx tsc --noEmit` clean; `npx eslint components/settings components/ui` clean; `npm test` 937 pass, 0 fail |

  - not verified (needs Sid, or real hardware):
    - signed in: add, edit, forget (the deferred forget POST), Tell with the real AI `extract`
    - the `facts_used` migration and the "used by" satellites on real data
    - touch hold to pin on a real phone; the mic in the Tell pill
    - 60fps on real hardware after the new per-frame `data-flip` write (it is written only when it changes)
  - still open from ui-checker (noted, not fixed):
    - the map isn't sticky at 1440; it scrolls away with the page. The spec doesn't ask for it
    - labels can overlap each other while the sphere turns
    - at 1440 the hero "Tangent knows…" line can sit over map points; at 390 it isn't shown
    - the Tell placeholder wraps to two lines at 390
  - For Sid (flags from spec-verifier):
    - the Round 4 scroll story was removed from `YouMapHero.tsx` in Phase 1. Please confirm that's wanted
    - the fact sorter change ("after school" is no longer Future) affects every surface that sorts facts
    - "at the very bottom" read as the bottom of "You, mapped"
    - project cards have no "+ Add"
    - edit saves a new fact and forgets the old one; Undo isn't offered for the old one
    - Confirm and Undo buttons on cards still use the accent purple (not the map)
    - the dev sample includes "Family dinner most nights around 7" (dev only, not stored)
  - EXTRA: the Escape handler on the area chips; the dark-mode card tint; the phone back pill shadow
