> **Orchestrator notes (added by the run controller, not by the synthesizer)**
> - Signed-out only, run in the isolated browser context (Tab 2). No account was created, no email typed, Google not clicked.
> - The screen text sent to the simulator was read from the page DOM of /signin. The evaluator declared a look, then stopped (abandoned = true), so no click was executed.
> - The signed-out probe of nine public paths and the "zero links" DOM query happened AFTER the stop and were not shown to the simulator.
> - Screenshot: `docs/overnight/screens/before/sim-dana-step1-signin.png`. Notes: `docs/overnight/sim-notes-dana.md`.

# Simulation report: Dana Whitfield (dana-whitfield-p1r), parent evaluator of a 9th grader

**Task:** Open the signed-out pages, find what it costs, what data it keeps about a teen, whether it uses her child's data to train AI, and how to delete an account. Do NOT create an account. Decide: would she let her 9th grader use it, and why or why not.
**Result:** Abandoned (stopped at step 1, task marked unresolved; no click executed, no sign-in, no account created)
**Steps:** 1 · **Total estimated time:** 40 s

## Step-by-step walkthrough
| # | Screen | Action | Clarity | Doubt |
|---|--------|--------|---------|-------|
| 1 | /signin (signed out) | Scanned for price, privacy/terms link, footer, maker. Found none. Did not type email or tap Google. Stopped and marked the task unresolved. | Medium | Yes |

## Per-screen detail

### Step 1 — /signin (signed out)
- **Action & thinking:** I scan the sign-in page for a price, a privacy or terms link, a footer, or anything saying who made it. I find none. I don't type my email or tap Google. I would look for a way to a privacy page, but nothing visible leads there. I stop on this page and mark the task unresolved. The page explains what the product does (the left panel "What Tangent is", "Your week, planned around you.", and five claims: "Say it, it's saved", "It asks before it guesses ... built from what it already knows about you", "No day gets buried", "Canvas, handled", "Built for big goals"). It has no price, no privacy or terms link, no mention of what is stored about a teen, no statement on training with data, no delete option, and no maker. The right panel only offers "Welcome to Tangent", the Sign in / Create account tabs, "Continue with Google", and an email box with a disabled "Email me a code". The only visible next steps are sign in or create an account, and I won't do either with my daughter's information.
- **Clarity:** Medium · **Doubt:** Yes · **Time:** 40s
- **Emotional state:** I'm uneasy and a bit annoyed. The page sells me on features (listens, asks questions, Canvas flows in), but I can't find a single link about privacy, price or who runs it. It wants an email or a Google login before telling me anything about my kid's data. For a 9th grader that is a stop sign.
- **Accumulated memory:** I opened Tangent's first page to check if it's safe for my 9th grader, and all I got was a pitch and a sign-in box. No price, no privacy link, no "who made this", nothing about deleting an account. "Listens" and "asks questions" made me think of AI talking to my kid, and there's nothing here about what it keeps or whether it trains on her chats. I won't make an account just to find out, so right now my answer is no. I only have a few minutes at lunch and I'm not going to hunt for it. (First step, so there is no earlier memory to compare against.)

## Tangent-specific
- **Context:** Nothing to use, because she is signed out and never gave Tangent any input. What she did read worked against it: "built from what it already knows about you" and "listens" read to a parent as monitoring and as AI talking to her child, not as a convenience.
- **Different from generic apps (Todoist / Notion / ChatGPT):** As a general expectation, not a verified fact, apps like these link a privacy policy and pricing from the first page. Tangent's first page has neither, so it stands out for the worse on exactly what this parent checks first.
- **Follow-through:** Not reached. The run ended on the first screen, so check-ins, round review and the daily bubble were never seen.
- **Trust:** Fails the 5-minute test. Within about 40 seconds she found no price, no privacy or terms link, no maker, no statement on stored data, AI training or deletion. Her trust pattern ("low until she finds a plain privacy page") was never given anything to move it.

## Synthesis
- **Highest friction point:** /signin (the only screen). It is the entry point and a dead end for an evaluator. It has zero links, no footer, and no path to price, privacy, terms, maker or deletion information. The only forward actions require sharing an email or a Google login.
- **Highest emotional friction point:** /signin. The page asks for an identity (email or Google) before saying anything about what happens to a teen's data. For a parent with very low tolerance for ambiguity about children's data, that read as a stop sign, and the AI-flavored copy ("listens", "asks questions") made it worse.
- **Final decision:** Abandons at step 1. Would she let her 9th grader use it? No, not on this evidence. She will not create an account to find out.
- **Emotional summary:** "I came in just wanting five minutes of answers: what does it cost, what does it keep about my daughter, does it train on her chats, how do I delete it. Instead I got a nice pitch and a sign-in box. Nothing about who made it. It says it 'listens' and 'asks questions', and all I could think was that some AI is going to be talking to my kid. I looked for a link, any link, and there wasn't one. I'm not typing my email or letting her log in with Google just to learn the basics. It's a no for now. I'm at work on my lunch break and I'm not going to go digging."
- **Detected risks:**
  - Parents who evaluate before approving will leave at the first screen, and the teen never gets to use the product.
  - Copy like "listens" and "built from what it already knows about you" reads as surveillance or unmoderated AI chat to a low-AI-expertise parent.
  - A sign-in page with no price can be read as "free" (one of her known wrong assumptions) or as a hidden subscription trap, and both hurt trust.
  - No maker is shown, so a parent may wrongly assume the school runs it, or may not trust it at all.
  - The page asks for an email or Google login with no reason given for the data, which is one of her stop conditions.
- **Structural insight:** The signed-out surface is a single sign-in page with no outbound links, so it serves only the person who has already decided to join. Parents decide before the teen signs up, and they need a public layer (price, what is stored, AI training, deletion, who made it, who sees the data) that is reachable without an account. Orchestrator check after the stop (signed out, not seen by the simulator): /privacy, /terms, /pricing, /about, /security, /help, /delete, /legal/privacy and /privacy-policy all returned HTTP 200 but ended on /signin?next=<path>. So no public privacy, terms, pricing or deletion page is reachable without an account. They either don't exist or sit behind sign-in (not tested further). /signin has zero links. Screenshot: docs/overnight/screens/before/sim-dana-step1-signin.png.
- **Fix this first:** Add a footer to /signin with working public links to Privacy, Terms and Pricing, plus a "Who makes Tangent" line, and make those pages load without an account (so the /privacy, /terms and /pricing paths stop redirecting to /signin).

## Potential improvements
| # | Screen / moment | Actionable change | Why it matters |
|---|-----------------|-------------------|----------------|
| 1 | /signin footer and the public routes /privacy, /terms, /pricing | Add a footer with "Privacy", "Terms", "Pricing" and "About" links, and serve those pages signed out instead of redirecting to /signin?next=. | Without these, a parent cannot evaluate Tangent at all, which is what ended this run. |
| 2 | New public privacy page, linked from /signin | Write a plain-language page with four short answers near the top: what is stored about a student, who can see it, whether chats are used to train AI (yes or no), and how to delete the account and all data. | These are Dana's four required items, and she needs them in a form she can read in five minutes. |
| 3 | /signin right panel, above "Continue with Google" | Add one line under "Welcome to Tangent" such as "Free to try / $X per month" (use the real price) and a short note on why an email or Google login is needed. | Removes the "sign-in means free" assumption and the unexplained request for personal details. |
| 4 | /signin left panel, claims "Say it, it's saved" and "It asks before it guesses ... built from what it already knows about you" | Add a one-line clarifier next to the claim, for example saying what the AI is, who can see what a student says, and that it is not used for training (only if true). | Without it, "listens" and "knows about you" read as monitoring to a parent. |
| 5 | /signin, a parent-facing entry point | Add a "Parent or guardian? See how Tangent handles your teen's data" link to the privacy page and a maker line ("Made by ..."). | Gives evaluators a clear path that does not require creating an account, and shows who is accountable. |
