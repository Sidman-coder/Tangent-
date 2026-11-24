# Questions for Juann

Each has the default I used overnight, so nothing is blocked.

## 1. The word "push"
- **Source:** the overnight brief says Juann's email says "pushes" and to use the glossary's word.
- **Found (read in `CONTEXT.md`):** `CONTEXT.md` does define **Push** ("One suggested next step. Avoid: Notification, nudge when referring to the step itself"). The same file defines **Goal step** as the word shown in the UI, and says it replaces "Plan step" and "Flexible step".
- **Default used:** I kept the current UI wording ("step", "Goal step", "Next: ..."). I did not introduce "push" anywhere in the UI.
- **Ask:** should students see "push" at all, or is it an internal word for one suggested next step? If yes, where (the Home "Next" line? the notification text?).

## 2. Liquid Glass
- **Brief:** Liquid Glass was removed in Round 3; don't reintroduce it; log it.
- **Found (read in code only):** `app/(app)/tangents/tangents.css` still describes floating controls as "Liquid Glass (dark)" (comments near lines 1601 and 1658) and has 36 `backdrop-filter` rules. `backdrop-filter` also appears in `app/globals.css`, `app/styles/shell.css`, `app/styles/controls.css`, `app/(auth)/auth.css` and `components/capture/capture.css` (I did not inspect which of those are glass-style and which are plain blur behind a modal or bar). The You, mapped map was pulled back into the app's own style (C19).
- **Default used:** I did not add any glass styling and did not touch the Tangents space.
- **Ask:** should the Tangents space keep its blur, or be flattened to match the rest of the app? And is the blur elsewhere (shell, controls, capture, sign-in) acceptable, or part of what Round 3 meant to remove?

## 3. `TANGENT_FOCUS_MODE`
- **Brief:** don't delete code behind feature flags such as `TANGENT_FOCUS_MODE`, if it exists, for 30 days.
- **Found (searched the repo's code, docs and JSON):** no `FOCUS_MODE` or `TANGENT_FOCUS_MODE` string anywhere. Searched by text, not by running the app.
- **Default used:** nothing to preserve; I deleted no flag.
- **Ask:** was this flag renamed or removed earlier? If it lives in another branch or in Vercel settings (which I cannot read), tell me where.
