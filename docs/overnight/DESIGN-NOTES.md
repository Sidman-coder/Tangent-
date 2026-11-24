# Design notes (overnight Phase 4.1)

What I looked at, what the rules are now, what changed tonight, and what is left. Screens behind feature flags (Tangent/Path screens) were not touched.

## 1. What I studied

| Source | How read | Status |
|---|---|---|
| linear.app, notion.com, culturedcode.com/things, foundable.com | One fetch each. I got page text and markup, not rendered CSS, so spacing and type notes below are **inferred from structure**, not measured. | done |
| `Images/References/REFERENCES.md` (Tiimo, Things, Todoist, Sunsama, Linear, Finch, 21st.dev components) | Read the index. Its list of "problems in Tangent's UI" (two inputs on Today, heavy red rows, raw floats, huge "What Tangent knows" paragraph) was already fixed in Rounds 4 to 5B; I re-checked the live screens against it. | done |
| 21st.dev | Covered by the REFERENCES.md component list (tabs, empty state, toast with undo, list item). | done (via the index) |
| refero.design, mobbin.com | Skipped. They need a login and the Playwright browser is only signed in to Tangent's test account. | skipped, logged |
| Repo skills (design-taste-frontend, minimalist-ui, web-design-guidelines, ui-ux-pro-max) | Used as the checklist for the anti-slop and accessibility rules below. | done |

### Patterns taken (never visuals)
- One dominant action per view, with a quieter secondary beside it (all four sites). Tangent: the composer on Home, "Connect Canvas" on an empty School, "Add something" on an empty Calendar.
- One idea per section; hierarchy from size and position, not heavy weight (Things, Notion). Tangent: Today shows one "Next" line, not a second list.
- Product screens illustrate, not decoration (Linear, Notion). Tangent has no stock art; empty states are one line plus one action.
- Compact in the product, airy around it (Linear). Tangent rows are 44px on phone, with a 16px gutter.
- Explicit confirmation before anything is saved (Foundable's "nothing goes public until you approve"). Tangent already does this with preview cards; kept as is.

## 2. The rules (one token set)

All values live in `app/styles/tokens.css`. CSS must read the token, never a raw number.

- **Spacing:** 4/8 scale: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40, `--s-12` 48.
- **Type (target six sizes):** caption 12, label 13, body 15, title 20, display 30 (26 on phone), plus 14 as the one dense-UI size. Tonight's pass removed every fractional size (10, 11, 11.5, 12.5, 13.5, 14.5 now round to 12, 13, 14 or 15).
- **Radii:** `--r-xs` 6 (small marks), `--r-sm` 8 (controls, chips), `--r-md` 12 (cards), `--r-lg` 16 (hero, sheets), `--r-xl` 22 (phone sheet top corners), `--r-pill`. Tonight 224 raw `border-radius` values were switched to these tokens (10 and 9 became 8, 14 became 12, 18 became 16).
- **Icons:** lucide only, `strokeWidth={1.75}`. Tiny check glyphs keep 2.4 to 3 so they stay legible. Tonight 40 icons with 2, 1.8, 1.9, 2.2 or 2.25 were set to 1.75. The Sparkles icon is gone from the live UI (Home "Auto" pill now uses Compass, the "build on this" dialog uses ListPlus). Sparkles remains in `components/path/*`, which is behind a flag and was left alone.
- **Motion:** three durations and two easings. `--dur-fast` 120ms (hover, press), `--dur` 200ms (open, close, reveal), `--dur-slow` 320ms (sheet, page-level). `--ease` out, `--ease-in` in. They are 0ms under `prefers-reduced-motion`. Motion only answers input; the loops that remain (skeleton shimmer, the You-map idle drift) are slow, are stopped by reduce-motion, and carry information (loading) or are on one flag-free screen only.
- **Color:** "Quiet Violet" accent on neutral surfaces, status colors for state only, no gradients, no glass on content. Dark mode has its own tokens (flat, bordered, no shadows).
- **Targets and focus:** 44px for everything pressed on phone (`--tap`); small marks get an invisible hit area. Every interactive element has a visible focus ring (`--focus`).

## 3. What changed tonight (all in commits `7c8dea8`, `19c6b59`, `924e907` and the 4.1 commit)

Groups 1 to 3 already changed many states (see PROGRESS.md). Phase 4.1 itself:
1. Tokens: durations moved to 120/200/320ms. 224 radii, 111 font sizes and the transition durations in all stylesheets now read the tokens.
2. Icons: one stroke width; Sparkles removed from the live Home pill and the build dialog.
3. Phone hit areas: tabs, calendar toggles, Undo, agenda rows, the Settings back link, the destination pill, and the You-map pills now meet 44px (rule at the end of `app/styles/shell.css`).
4. Copy sweep for guilt, pressure and streak wording: nothing in the app UI. The only matches are options the student picks themselves ("Tell me when I'm falling behind", `lib/onboarding.ts`) and an internal regex. Left as is: it is their choice and their wording.
5. Empty and error states (from groups 1 to 3; Calendar and School loading skeletons were added in 4.1): Today (nothing today, with the Next line), Calendar (empty line plus Add something), Projects (zero steps, no project), School (Connect Canvas), You map ("Not asked yet"), Canvas row (Connect or Not now), slow capture ("Still working").

## 4. Not done, and why (honest list)

- **Type scale is not yet six sizes.** After rounding, the CSS still uses 12, 13, 14, 15, 16, 17, 18, 20, 22, 26 and 30. Collapsing 16/17/18 and 22 needs a look at each use; it is a visual change on many screens, so I did not do it blind overnight. Next step: map 17 and 18 to 16 or 20 per screen.
- **Hover-only affordances** were not audited on touch.
- **Contrast** was checked by token design (text tokens were chosen for AA on `--bg` and `--surface` in both themes), not re-measured tonight with a tool. A measured pass belongs in Phase 5 with the screenshots.
- **Loading states:** Today (`TodayHome.tsx:378`) and Projects (placeholder cards with `is-loading`) have one; "What Tangent knows" and AI activity use `components/ui/Skeleton.tsx`. Calendar and School now use `Skeleton` too (added in 4.1; they showed a blank frame before).
- The 4.1 pass was checked in the production build at 390px, signed in as the test account. Evidence: tap-target audit (every button/link on Home, Calendar, Projects, School, You map, Notifications and Schedule is now 44px or has a 44px hit area; the exceptions are one inline text link inside a sentence, which WCAG exempts, and the Settings back link, raised to 44px afterwards), no sideways scroll on any of them, and screenshots `t41-home-*.png` and `t41-cal-*.png` in the session scratchpad. **Only the dark theme was actually seen**: the "light" captures also rendered dark because the app's saved theme overrides media emulation. A light-theme pass and 1440px screenshots for every changed screen belong in Phase 5 (`docs/overnight/screens/after/`).
