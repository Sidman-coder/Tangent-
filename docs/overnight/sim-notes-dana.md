# Sim notes: Dana (Phase 2.2, round 1) - SIGNED-OUT ONLY
Profile: user-simulation-tests/simulation/profiles/dana-whitfield-p1r.md
Task: open the signed-out pages; find price, what is stored about a teen, whether chats train AI, how to delete; decide if she'd let her 9th grader use it. Do NOT create an account.
Context: isolated Tab 2 (signed-out context). No account created, no email typed, no Google clicked. Label: all checks below are SIGNED-OUT.

## Loop (task cap 15)
- Step 1 evaluator: clarity Medium, doubt yes, ABANDONED = true, ~40 s. Screen: /signin (sim-dana-step1-signin.png). Read from the DOM: left pitch panel (5 feature claims), "Welcome to Tangent", Sign in / Create account tabs, Continue with Google, email-code box. No price, no privacy/terms link, no footer, no maker, nothing on stored data, AI training or deleting. Action: scan for those, find none, will not sign in or create an account with her daughter's info, stops and marks unresolved. Emotion: uneasy/annoyed; "listens" and "asks questions" make her think of AI talking to her kid; the page wants an email or Google login before telling her anything about her kid's data; "a stop sign". Answer now: no.
- Run stopped at step 1 of 15 (abandoned). No click executed.

## Orchestrator checks AFTER the stop (signed-out, not shown to the simulator)
- Signed-out probe of /privacy, /terms, /pricing, /about, /security, /help, /delete, /legal/privacy, /privacy-policy: every one answered HTTP 200 but landed on /signin?next=<path>, showing the same sign-in page. So no public privacy, terms, pricing or deletion page is reachable without an account (either they do not exist or they sit behind sign-in; not tested further).
- /signin contains zero `<a>` links (checked with a DOM query).
- Product finding (high, trust): the only signed-out page gives a parent no price, privacy, data, AI-training or delete information and no link to any. The signed-in app does have Settings > Your data (Delete data) but a parent cannot see that before signing up.

## Tangent-specific (Dana)
- **Context:** Nothing to use: signed out, nobody told Tangent anything. The page says "built from what it already knows about you" and "listens", which a parent reads as monitoring/AI.
- **Different from generic apps:** Todoist/Notion/ChatGPT all link a privacy policy and pricing from the first page; Tangent shows neither.
- **Follow-through:** Not reached (never signed in).
- **Trust:** Fails the 5-minute test. No maker, price, stored-data, training or deletion statement is reachable signed out; the page asks for an email or Google login first.
