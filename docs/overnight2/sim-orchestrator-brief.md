# Persona sim orchestrator brief (overnight 2, Phase 1 and Phase 8)

You run ONE synthetic-user simulation over the live Tangent app, following
`C:\Users\sidha\.claude\plugins\cache\pablom-plugins\user-simulation\5.0.0\skills\simulation-run\SKILL.md`
exactly (read it first), in handoff mode: ask nothing.

- url: http://localhost:3000/ (already running; the Playwright browser is already signed in to the test account. Do not sign out, never type a password.)
- browser: Playwright MCP (`mcp__playwright__*`; load the schemas with ToolSearch "select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_press_key,mcp__playwright__browser_wait_for,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_resize").
- viewport: 390x844 (phone) for Maya, Jordan, Sam; 1440x900 for Leo, Priya. Resize first.
- task (same for all): "Add something from your week that you need to get ready for, get Tangent to plan it into your calendar, save the plan, then mark the first step done and tell Tangent how it went."
- step cap: 15.

Loop per SKILL.md Step 3: READ (browser_snapshot; pass the evaluator the readable text + roles, not the yml path) → spawn `user-simulation:synthetic-screen-evaluator` with the full profile + task + "Current screen, step N" + visible content + previous memory → record the full JSON → stop checks → ACT the declared action by ref (a missing element is NOT fixed; the next step perceives it) → WAIT on a visible signal (AI replies can take 5-30 s: wait for the text to change, up to 40 s). Don't steer, don't add project knowledge to the evaluator.

Persistence (context can be lost): after EVERY step append the step number, screen name and the full returned JSON to `docs/overnight2/sims/<slug>-steps.md`. Take a screenshot each step to `docs/overnight2/sims/<slug>-step<N>.png`.

Safety: never Delete anything, never use "Forget everything", Disconnect, Sign out or account settings. If the persona declares one of those, record "not executed (safety rail)" and stop with that as the stop reason. Never write an email address into any file (the account email is private; write "[test account]").

The account is a shared test account (greeting says "Leo"; it already has a "Python Competitive Programming Basics" project and other items). Tell the synthesizer this is a test artifact, not product behaviour.

End: spawn `user-simulation:synthetic-flow-synthesizer` with all step JSONs + profile + task + stop reason; save its report to `user-simulation-tests/simulation/results/2026-11-22-<slug>.md` (overwrite if it exists). Add a first line under the title: "Run: overnight 2 <phase>, Playwright, <viewport>, production build on push-v1."
Skip the summary-synthesizer (deliver=none).

Reply to the caller in at most 150 words: result (goal reached / abandoned / cap), steps, the 3 worst frictions with step numbers, and whether Tangent used what the persona said (Context) — quote one line.
