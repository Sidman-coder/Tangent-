# Decisions made unattended

Format: question, options, what I chose, why.

## D1. Test account not signed in in the Playwright browser (00:50)
- Question: opening http://localhost:3000 redirected to /signin, so the test account isn't signed in. What do I run simulations on?
- Options: (a) halt, (b) run on /dev/app/* sample pages, (c) try to sign in myself.
- Chose: (b). The prompt says to mark those "signed-out sample" and log it. (c) is out: I never type passwords.
- Why: it keeps the run moving. If Sid signs in later, I re-check Home and switch to signed-in runs.

## D2. Build memory (00:55)
- Question: `npm run build` died with a JS heap OOM while the dev server was also running (about 1.2 GB virtual memory free, 4 GB pagefile).
- Chose: stop dev server, run build with NODE_OPTIONS=--max-old-space-size=3072, restart dev after. Build then passed. Rule for the rest of the run: stop dev before each `npm run build`.
- Why: dev and build share `.next` and both use memory; this PC is memory-tight.

## D1 update (00:52): Playwright browser IS now signed in
- At 00:47 the app redirected to /signin. At 00:50 `http://localhost:3000` loaded the signed-in shell and landed on /capture ("To do, 0 things" = empty account). Evidence: screens/signin-check-home.png and the page snapshot showing the sidebar and "Your account" link.
- So: simulations run SIGNED IN on real routes. /dev/app/* sample pages are used only for states the empty account can't show (notifications, draft, round review), labelled "signed-out sample".
- Who/what is the account? Unknown to me. I treat it as the test account and will not touch its credentials. I will reset it only through Settings > "Delete all my data", as allowed.

## D3. Dev server memory (00:55)
- Dev server died with a V8 OOM ("Committing semi space failed") when heap limit was 3 GB: the PC has about 2.4 GB commit headroom. Chose --max-old-space-size=1536 and NEXT_TELEMETRY_DISABLED=1. Not touching the pagefile or any Windows setting.

## D4. Use the production server (`next start`) for screenshots and simulations (01:05)
- Dev server crashed twice with V8 OOM at about 850 MB heap (the PC has about 2.3 GB commit headroom; VS Code, Chrome, Claude use the rest).
- Chose: `npm run build` (3 GB heap, nothing else running) then `next start` with a 768 MB cap. After each code change group: stop server, rebuild, restart.
- Cost: /dev/app/* sample pages 404 in production (middleware only allows /dev in development). So samples are used only if a dev server can be kept alive briefly; otherwise states like draft/notifications/round-review are covered by the signed-in app or read from code (labelled "read in code only").
- Also noticed: each page load fires a proactive Haiku call (`[perf] claude proactive`, about 1.7k tokens in), so screenshot batches cost a little AI money. Keep batches small. Logged as a context-review finding.

## D5. Which account is signed in (01:15)
- The signed-in account's email is a "+test" alias, not Sid's own address (read from /settings/account at runtime; address not copied here). So it is the test account, and the allowed reset (Settings > "Delete all my data") applies to it.
- It is NOT empty: greeting "Sid", an "Instagram Growth to 10K" project, 9 past-due items, 8 facts in You, mapped. First-run screenshots therefore show a lived-in account, not what a new student sees. I will take new-student screenshots after the first reset in Phase 2 and label them.

## D6. The Anthropic credit balance ran out during the 4.3 after-eval (Phase 4.3)
- Seen: after about 39 good calls the API returned `400 invalid_request_error: Your credit balance is too low to access the Anthropic API` for every later call (96 failed calls in the run). The before-eval an hour earlier was clean.
- Default chosen: do not re-run (it would fail the same way), do not touch billing (gated and not mine), report the after-eval as invalid rather than as a regression (CONTEXT-REVIEW.md section 0), and continue with every step that needs no app AI: 4.4 launch review, 4.5 plan and mockups, and the doc work.
- Effect on Phase 5: the round-2 persona simulations call the app's AI for plans and replies. If credits are still empty then, I will run what can run (signed-in screens, empty states, light theme, 1440px, contrast, heuristic crawl) and mark each AI-dependent step "not run: no credits" in JUDGMENT-2.md instead of recording failures as findings.

## D7. Juann's three questions (Phase 6)
- Seen: the brief names "push", Liquid Glass and `TANGENT_FOCUS_MODE`. `CONTEXT.md` defines Push as "One suggested next step"; the UI says "step". Liquid Glass comments and `backdrop-filter` rules remain in several CSS files (36 in the Tangents space). No `FOCUS_MODE` string exists in the repo.
- Default chosen: change nothing, add no glass, delete no flag; write the three questions with the facts in `QUESTIONS-FOR-JUANN.md`.
- Why: each is a product-naming or design-direction call for Juann, not a safe code fix.

## D8. Investor panel verdicts are reported as given (Phase 6)
- Seen: all three reviewers said NOT YET; would students like it: PARTLY.
- Default chosen: merge as written into `INVESTOR-REVIEW.md`, label fact / inference / opinion, add no metrics, and note that the reviewers saw some screens from before the last fix commit.
