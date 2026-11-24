# Launch review (overnight Phase 4.4)

Report only, except one safe copy fix (section 6). Written 2026-11-18 from the code in this repo, the migrations, and Playwright device emulation against the production build. Nothing here was checked on a real phone, and the live database and Vercel/Supabase settings were not (and must not be) read.

## 0. Verdict

| Target | Ready? | Why, in one line |
|---|---|---|
| **(a) PWA** (home-screen install from the browser, closed beta) | **Ready for a small invited pilot, not for the open web.** | Core flows work on phone-size screens and sign-in is gated by an allowlist. Open blockers: no public privacy policy or terms page, and no offline behavior at all. |
| **(b) App Store wrapper** | **Not ready.** | Needs a public privacy policy URL, a reviewer demo account, a decision on Sign in with Apple, a decision on the Kids Category and on how parents pay, an app that does more than wrap the site (Guideline 4.2), and the Anthropic credit balance topped up. |

## 1. Issues, ranked

"Found by" names the file, command or screenshot. "Signed-in" checks used the test account; "signed-out" checks are labelled.

### Blockers

| # | Issue | Found by | Applies to |
|---|---|---|---|
| B1 | **No public privacy policy or terms page exists.** `git ls-files` lists no `/privacy`, `/terms`, `/pricing` or `/parents` route (a correction: NEEDS-SID C06 described them as existing and bouncing to sign-in; they do not exist, and middleware sends every unknown signed-out path to `/signin`). App Store Connect needs a privacy policy URL, and 5.1.1(i) requires it in the metadata and in the app. Draft copy is in NEEDS-SID C06. | `git ls-files \| grep -i -E "privacy\|terms\|pricing\|parents"` (no output); signed-out `curl localhost:3000/capture` returns 307 to `/signin` | PWA (before any non-invited user), App Store |
| B2 | **The Anthropic API credit balance is empty.** Every AI feature (planning, chat, briefs) fails until topped up. | 4.3 after-eval: 96 HTTP 400 "credit balance is too low" (DECISIONS D6) | both |
| B3 | **A reviewer cannot get in.** Sign-in is an email allowlist (`ALLOWED_EMAILS`, `lib/auth/access.ts`); anyone else lands on the waitlist page. Apple 2.1(a) (verbatim): if the app has a login, include demo account info and turn on the back-end service. A demo account must be on the allowlist, hold sample data, and the AI credits must be on. | `lib/auth/gate.ts` (`accessOf`), `lib/auth/access.ts` | App Store |
| B4 | **Guideline 4.2 risk (repackaged website).** The app is the website in a wrapper. Apple 4.2 (verbatim): the app "should include features, content, and UI that elevate it beyond a repackaged website." As it stands, the wrapper would add nothing native. Options: native microphone hold-to-talk, native notifications, a home-screen widget or Siri/Shortcuts capture, offline capture queue. | manifest only (`app/manifest.ts`); no native code in the repo | App Store |

### Should-fix

| # | Issue | Found by |
|---|---|---|
| S1 | **Nothing works offline, and the app does not say so.** There is no service worker (`public/sw.js` absent) and no offline page. Reloading offline shows the browser's own "no internet" page. Typing a capture while offline showed the raw browser text "Failed to fetch" (copy now fixed, section 6) and the text is not queued, so it is lost on reload. For a phone-first planner this is the loudest gap. Suggested: a small service worker with an offline page now; a queued capture later. | Playwright, iPhone 390x844 emulation, `setOffline(true)`: reload gave `net::ERR_INTERNET_DISCONNECTED`; screenshots `docs/overnight/screens/launch/iphone-offline-reload.png`, `iphone-offline-submit.png` |
| S2 | **Microphone denied showed "Permission denied".** Now says what to do (copy fix, section 6). Notifications: `Notification.permission` is "default" and the app does not prompt on load. The path when notifications are denied was not exercised. | Playwright, `getUserMedia` rejecting `NotAllowedError`; screenshot `iphone-mic-denied.png` |
| S3 | **Sign in with Apple (Guideline 4.8) may be required.** The app offers Google sign-in (`SignInForm.tsx`, `signInWithOAuth` provider "google"), plus its own email code and password. 4.8's verbatim opening: an app using a third-party or social login as its primary account login "must also offer as an equivalent option another login service" that meets Apple's privacy rules (the text I received cuts off there). Apple has exempted apps that use only their own account system; Tangent mixes both. Whether Tangent's own email sign-in counts as the equivalent option is a reviewer judgment I cannot settle from the page. Cheapest safe answers: add Sign in with Apple, or drop Google in the wrapper build. | `app/(auth)/signin/SignInForm.tsx:107`; Apple guidelines page (4.8 partly unverified, see section 3) |
| S4 | **No security response headers.** `next.config.mjs` sets none, and `curl -I /signin` showed no `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options` or `Referrer-Policy`. Clickjacking and content sniffing are open. Fix is a few lines in `next.config` `headers()` (a CSP needs testing against fonts and the Deepgram websocket). I did not change it: report-only rule. | `curl -sI localhost:3000/signin` (signed-out) |
| S5 | **No request rate limiting except the daily AI budget.** The only limit is `lib/ai/call.ts` (per-user daily AI budget, returns 429). The email-sending routes (`/auth/magic-link`, `/auth/signup`) and the API routes have no app-level throttle. Supabase applies its own limits to sign-in emails; I did not verify them (not allowed to read project settings). Low risk while the allowlist keeps the beta closed, rising once open. | `git grep -i "rateLimit"` finds nothing outside the AI budget |
| S6 | **Input validation is hand-rolled and uneven.** `zod` is used in 2 of 42 API routes. Most routes trim and `slice` strings (for example `app/api/context/route.ts` caps a fact at 300 and an import at 80,000 characters; `changesets` caps at 20,000; chat caps the plan goal at 2,000). Nothing was found to be exploitable, but caps differ per route and `/capture` has no client-side limit: a 30,270-character paste was accepted by the text box (see section 4). | `git grep` of `slice(0,`; `docs/overnight/screens/launch/iphone-long-text.png` |
| S7 | **Parent payments and the Kids Category are undecided** (sections 3 and 5). They change what the app may collect and what it may link to. | Apple guidelines 1.3, 3.1.1, 3.1.3 |
| S8 | **Account email is shown in clear on `/settings/account`.** Fine for the owner of the account, but remember it when taking App Store screenshots (use a throwaway reviewer account). | NEEDS-SID privacy entry |

### Nice-to-have

| # | Issue | Found by |
|---|---|---|
| N1 | Settings sub-nav on a 360px Android viewport clips one element at the right edge (`/settings/context`). It is the known phone sub-nav issue from JUDGMENT-1; no page scrolls sideways. | Playwright, Android 360x780: `clipped: 1` on `/settings/context`, `0` on the five other pages; `android-home-360.png` |
| N2 | A very long capture is not capped in the text box. The server caps later (2,000 to 20,000 characters depending on route). A visible counter or a cap near 2,000 would be kinder. | `iphone-long-text.png` |
| N3 | Slow-3G cold load of `/capture` was 2.4 s to an interactive button in emulation. This is indicative only: Chromium's emulation throttled the document and about 45 KB of resources, and a real phone on a real network will differ. | Playwright CDP `Network.emulateNetworkConditions` (latency 400 ms, 50 KB/s down), cache disabled |
| N4 | "Delete my account" exists in Settings (Your data) and is the Apple 5.1.1(v) requirement; the privacy policy must describe it. | `components/settings/YourDataSection.tsx:158`, `lib/account-delete.test.ts` |
| N5 | The one Phase 4.3 gap: observed habits are not visible in "You, mapped" and survive "Forget everything" (NEEDS-SID). Matters for the privacy policy sentence "you can see and delete what Tangent learns." | CONTEXT-REVIEW.md section 6 |

## 2. Security basics

| Check | Result | Evidence |
|---|---|---|
| Secrets in the repo | **None found in tracked files.** Patterns for Anthropic, JWT-shaped, Google API, private-key, GitHub and Slack tokens returned no files. The only tracked env file is `.env.example`, which I did not open (never read `.env*`). | `git grep -I -l -E "sk-ant-...|eyJhbGciOi...|AIza...|BEGIN PRIVATE KEY|ghp_...|xox[bp]-"` (no output); `git ls-files \| grep -i "^\.env"` lists `.env.example` only |
| Secrets in the client bundle | Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design; RLS protects the data), plus `NEXT_PUBLIC_BASE_URL` and `NEXT_PUBLIC_API_URL`. No file with `"use client"` imports the admin (service-role) client. | `git grep -o "NEXT_PUBLIC_[A-Z_]+"`; loop over `createAdminClient` importers checking for `"use client"` (none) |
| Row-level security | **Enabled on all 26 tables** created in `supabase/migrations/` (the 15 init tables plus `paths` and `path_nodes` by loop, and `ai_decisions, ai_usage, change_sets, context_slots, events, grill_questions, plan_aliases, step_events, waitlist` individually). Policies are "own rows" by `user_id = auth.uid()`; `waitlist` is service-only. **Caveat: read from migration files, not the live database** (I may not run SQL). The live state could differ if a migration was skipped or edited by hand. Sid: confirm in the Supabase dashboard that every table shows "RLS enabled". Also not individually read: the policy text of the 9 tables enabled one by one. | `grep -i "enable row level security" supabase/migrations/*.sql` and the two loop blocks in `20260926000000_init_schema.sql:291` and `20260927030000_paths_and_task_external_id.sql:71` |
| Every API route needs a session | All 42 route folders use `withUser` or the cron secret. Signed-out `GET /api/tasks` returned **401** (signed-out). `/api/cron/*` skips the session check and uses its own `CRON_SECRET` with a constant-time compare; fails closed if the variable is unset. | `lib/cron-auth.ts`; `curl localhost:3000/api/tasks` (signed-out) |
| Closed beta | `ALLOWED_EMAILS` plus owner approval; under-13 flag in `app_metadata` (service-role only). | `lib/auth/gate.ts` |
| Google tools | Gmail and Calendar run on the owner's token and are blocked for other users (`currentUserIsOwner`). | `lib/voice-agent-tools.ts:317` |
| Security headers | **Missing** (S4). | |
| Rate limits | **Only the daily AI budget** (S5). | |
| Input validation | Hand-rolled caps (S6). | |
| Third-party analytics or ad SDKs | **None.** Dependencies are Anthropic SDK, Supabase, Next, React, motion, lucide, node-ical, zod, fonts. | `package.json` |

### The pen upload key (add to NEEDS-SID; rotation is yours)

- **Where it is used.** Not in this app. The pen's upload server lives in a separate folder, `D:\TANGENT showcase\tangent-pen-server\` (its own git repo; not this repo). `server.py` reads the shared secret from the environment variable **`PEN_KEY`** and the pen sends it in the `X-Pen-Key` header on `POST /upload` and `GET /recent`. The same value is baked into the **pen firmware**. `test_client.py` takes the key as a command-line argument, so it can also sit in shell history. This app has a `pen_devices` table (hashed per-device keys) that is schema only and not wired.
- **Where it was seen in plain text.** The showcase-level `README.md` (line 73) contains a 64-character hex `PEN_KEY=` value under an "example only" comment. I did not print it. If that value was ever set as the real key, treat it as exposed.
- **Rotation steps (yours).** Generate a new key, set it as `PEN_KEY` in the pen server's deploy environment, flash it into the pen firmware, then delete the old value from the README. The server returns 401 for the old key once the environment variable changes, so rotate the server and the pen together.
- **Longer term.** One shared secret for every pen cannot be revoked per device. The planned design (per-device keys hashed in `pen_devices`, a revoke column) fixes that.
- **Also outside the repo:** a file named `TANGENT google cloud secrets.json` sits in `D:\TANGENT showcase\`. It is not in a git repo and I did not open it. Keep it out of any zip or share, and rotate the Google credentials if it was ever sent anywhere.

## 3. Apple App Review Guidelines (read from developer.apple.com tonight)

Source: https://developer.apple.com/app-store/review/guidelines/, fetched through a web-reading helper. **Confidence differs by section.** The helper returned verbatim text for 1.3, 2.1, 3.1.1, 3.1.2, 3.1.3 and 4.2. For **4.8** only the opening clause came through verbatim, and **5.1.1 and 5.1.2 and 5.1.4 came only as summaries that may not be word-exact.** The page's "last updated" date (the summary said October 16, 2026) is unconfirmed. **Re-read 4.8, 5.1.1, 5.1.2 and 5.1.4 on the live page before submitting.**

| Guideline | What it says (verbatim unless marked summary) | Tangent today |
|---|---|---|
| **2.1** App completeness | Submissions "should be final versions with all necessary metadata and fully functional URLs included." If the app has a login, include demo account info "and turn on your back-end service!" | Needs a demo account on the allowlist, sample data, working URLs (privacy policy), and AI credits on (B1, B2, B3). |
| **5.1.1(i)** privacy policy (summary) | A privacy policy link in App Store Connect metadata and in the app; say what is collected, how and all uses. | None exists (B1). |
| **5.1.1(v)** account deletion (summary) | An app that supports account creation must offer account deletion in the app. | **Met in the app:** Settings, Your data, "Delete my account" (N4). Policy text must describe it. |
| **5.1.2(i)** third-party data sharing (summary) | Disclose and get permission before sharing personal data with third parties, "including with third-party AI." | The student's text goes to Anthropic (plans, replies) and audio goes to Deepgram (voice). Needs a plain consent line in onboarding and the policy. Not present as a distinct consent step today. |
| **4.8** login services (opening verbatim, rest summary) | An app using a third-party or social login as its primary login "must also offer as an equivalent option another login service..." | Google plus own email code/password (S3). |
| **4.2** minimum functionality | "Your app should include features, content, and UI that elevate it beyond a repackaged website." 4.2.2: apps shouldn't be primarily "marketing materials, advertisements, web clippings, content aggregators, or a collection of links." | B4. |
| **3.1.1** in-app purchase | Unlocking features or content (subscriptions, premium content, full versions) must use IAP; "Apps may not use their own mechanisms to unlock content or functionality, such as license keys." Outside the US storefront and entitled storefronts, no buttons, external links or calls to action pointing to other purchase methods (3.1.1(a)). | No billing exists. Any paid tier inside the wrapper must use IAP (below). |
| **3.1.2** subscriptions | Period at least seven days; available across the user's devices; describe what the user gets before asking them to subscribe; upgrades and downgrades seamless. | Applies if there is a paid tier. |
| **3.1.3(c)** | "Consumer, single user, or family sales must use in-app purchase." | A parent paying for a student's plan is a consumer or family sale. |
| **1.3 / 5.1.4** Kids | Kids Category apps (verbatim 1.3): no links out of the app, purchasing opportunities or distractions unless behind a parental gate; "may not send personally identifiable information or device information to third parties"; "should not include third-party analytics or third-party advertising." 5.1.4 (summary): privacy policy and children's privacy statutes apply. | See section 5. |

### 3.1.1 / 3.1.2: the parent-pays options (explained, not decided)

Tangent is for students 13 and up (`/not-yet` gate), so the buyer is a student or a parent. Apple's text says a family or consumer purchase inside the app must use in-app purchase (3.1.3(c)), and the 3.1.1 text I received does not address "a parent pays for a child" separately. Options:

1. **Student buys inside the app with IAP** (a subscription). Simplest for Apple, but a teenager may not hold a payment method, and Apple takes its commission. Family Sharing and Ask to Buy can route approval to a parent.
2. **Free in the app, paid on the web** (the parent subscribes on a website and the student's account unlocks). Apple allows telling users about other purchase methods only outside the app, and in-app links or calls to action to non-IAP purchases are restricted by 3.1.1(a) outside the entitled storefronts. The app can still honor an account already paid for elsewhere; check the current rules for a "reader"-style entitlement before relying on this.
3. **No payment in the wrapper at all for launch** (the pilot is free). Lowest review risk, and consistent with there being no billing in the code today.
4. **School or parent sale** (a school pays): 3.1.3(c) treats enterprise sales differently from consumer and family sales, but "school" may not count as enterprise without a business arrangement. Needs the live text checked.

Decision belongs to Sid. Evidence that would change a recommendation: the live 3.1.1 and 3.1.3 text, and whether students actually own payment methods in the pilot.

## 4. Phone and device emulation results

Method: the Playwright MCP browser, signed in as the test account, against the production build. iPhone: CDP `Emulation.setDeviceMetricsOverride` 390x844 at 3x, mobile, touch, iOS Safari user agent. Android: 360x780, Pixel 7 user agent. This is **emulation in a desktop Chromium, not WebKit and not a real device**, so iOS-specific behavior (Safari safe areas, home-screen install, keyboard) is not covered. Screenshots are in `docs/overnight/screens/launch/`. The account email appears on none of the pages captured (no `/settings/account`).

| Scenario | Result | Evidence |
|---|---|---|
| iPhone 390px: `/capture` | No sideways scroll (`scrollWidth` = `innerWidth` = 390); 1 small tap target (under 40 px) found among buttons, links and inputs | script output; `iphone-capture.png` |
| Android 360px: `/`, `/capture`, `/calendar`, `/projects`, `/settings/context`, `/settings/data` | No sideways scroll on any; 1 element past the right edge on `/settings/context` (N1) | script output; `android-home-360.png` |
| Offline reload | Browser error page `net::ERR_INTERNET_DISCONNECTED`; no offline page (S1) | `iphone-offline-reload.png` |
| Offline, submit a typed capture (page already loaded) | Showed "Failed to fetch" (fixed, section 6); text not queued | `iphone-offline-submit.png` |
| Slow 3G (400 ms latency, 50 KB/s, cache off) | Capture interactive in 2.4 s (domReady 2.3 s), about 45 KB measured transfer; indicative only (N3) | script output; `iphone-slow3g-capture.png` |
| Microphone denied | Capture shows "NOT ADDED" and the text "Permission denied" (fixed, section 6); typing still works | `iphone-mic-denied.png` |
| Notification permission denied | **Not exercised.** Only confirmed `Notification.permission` is "default" and the page does not prompt on load. | script output |
| Very long text (30,270 characters incl. a 1,000-character unbroken word, in the capture box) | Layout holds: no sideways scroll, text box 132 px tall, Add stays on screen; box accepts it (N2) | `iphone-long-text.png` |
| Empty new account | **Not re-run tonight.** The test account currently holds the Leo persona's data, so it is not empty. Empty-state screens (Today, Calendar, School) were checked in Phase 4 group 3. I will capture an empty account in Phase 5 after the test account's own "Delete all my data" reset. | `docs/overnight/screens/` (group 3) |
| Signed-out API and pages | `GET /api/tasks` returned 401; `/capture` returned 307 to `/signin?next=%2Fcapture` (signed-out) | `curl` output |

## 5. Kids Category (1.3 and 5.1.4): report only, no pick

Tangent is for ages 13 and up and says so (`/not-yet` for under-13s; nothing is stored for 13 and up except that the answer was given). The Kids Category in the App Store is for under-13 apps (ages 5 and under, 6 to 8, 9 to 11), so a 13+ app does not belong in it and would be misfiled.

| Option | Effect |
|---|---|
| **Do not use the Kids Category** (13+ high school planner; set the age rating accordingly) | No third-party-analytics ban, no parental gate for outbound links. Still subject to 5.1.4 where it touches minors' data and to COPPA/GDPR-K style rules in practice. Matches the product today. |
| **Kids Category** | Not applicable for the 13+ audience and not recommended. If chosen it forbids sending personal or device information to third parties; Tangent sends text to Anthropic and audio to Deepgram, which would conflict. |

Consequence of 13+: 2.3.8 (verbatim) reserves terms like "For Kids" and "For Children" in metadata for the Kids Category, so avoid them in the listing. High-school students are minors in most places, so the privacy policy should be written for a student reader and a parent reader.

## 6. Safe copy fix made tonight

Raw browser errors reached students. `lib/friendly-error.ts` now maps them to plain sentences, used in `lib/capture-outcome.ts` (the voice and capture error card), `components/add/AddFlow.tsx` (3 sites) and the two Tangents pages (5 sites):

- offline ("Failed to fetch", "Load failed" and similar): **"No connection. Check your internet and try again."**
- microphone denied ("Permission denied", `NotAllowedError`): **"Tangent can't use the microphone. Allow it in your browser settings, or tap to type instead."**
- anything else passes through unchanged, so server messages written for students are kept.

Tests: `lib/friendly-error.test.ts` (3) and one updated expectation in `lib/capture-outcome.test.ts`. `npm test`: 976 pass, 0 fail; `npm run typecheck` clean. The fix is not yet re-checked in the browser (production server was stopped for the build); verify the two screens on the next run.

## 7. Privacy nutrition label: draft answers

Draft for App Store Connect. Every row needs Sid's confirmation; I could not see the live database or vendor settings.

**Do you or your third-party partners collect data from this app?** Yes.

| Data type (Apple's list) | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info: email address | Yes | Yes | No | App functionality (sign-in) |
| Contact info: name | Yes (first name) | Yes | No | App functionality |
| User content: other user content (tasks, plans, goals, chat, the short notes about how the student works) | Yes | Yes | No | App functionality, personalization |
| User content: audio data (voice capture) | Yes (sent for transcription; the app does not keep the audio, but `voice_logs` stores the transcript, to be confirmed) | Yes | No | App functionality |
| Identifiers: user ID | Yes | Yes | No | App functionality |
| Usage data: product interaction (step done/skipped events, AI usage counts) | Yes | Yes | No | App functionality, analytics owned by Tangent, personalization |
| Health and fitness, financial info, precise or coarse location, contacts, photos, browsing history, search history, purchases | No | | | |
| Diagnostics | No third-party crash or analytics SDK | | | Confirm Vercel logs |
| Sensitive info | Not stored by design (health and family facts are refused at write time) | | | |

**Tracking:** No (no ad or analytics SDKs; nothing is shared with data brokers).

**Third parties that receive student data (name them in the policy):** Anthropic (text for plans and replies), Deepgram (audio for transcription), Supabase (database and sign-in), Vercel (hosting), and Google only for sign-in. CONFIRM each vendor's current retention and training terms from their own pages; I did not look them up tonight.

## 8. Notes for Review (draft)

> Tangent is a planner for high-school students (13 and up). A student captures what is due by voice or text, and Tangent turns it into a plan on their calendar.
>
> **Demo account:** Email: [reviewer account, Sid to create and add to the allowlist]. Sign-in: use "Email me a code" (the code arrives at that inbox) or the password below. Password: [Sid to set]. The account has sample classes, tasks and one plan.
>
> **Back end:** live, AI enabled for this account.
>
> **To see the main flow:** open Capture, tap "Hold to talk, or tap to type", type "Chem test Friday, read chapter 4 by Wednesday", and confirm. Tangent saves the items, asks at most two short questions, and shows the plan on the Calendar tab.
>
> **Permissions:** the microphone is used only while the student holds the talk button. Notifications are optional and requested only when the student turns on reminders.
>
> **Account deletion:** Settings, Your data, "Delete my account". **Privacy policy:** [URL, Sid to publish].
>
> **Not in this version:** no purchases, no ads, no third-party analytics. The Canvas connection is optional and uses the student's own read-only calendar link.

## 9. What Sid should check on real devices

1. **iPhone Safari, then Add to Home Screen:** icon, name "Tangent", opens full-screen, status bar style, the notch and home-bar spacing on Capture, Today and Calendar.
2. **Microphone:** hold to talk on an iPhone (Safari and installed app) and on Android Chrome; deny the permission once and read the new message; check the transcript is right in a noisy room.
3. **Keyboard:** typing a capture with the on-screen keyboard open; the Add button and the text must stay visible.
4. **Offline:** airplane mode with the app open and with the app closed (S1).
5. **Sign-in on a phone:** the email code (does the mail app switch back to the right app), Google sign-in in the installed app, and the waitlist screen for a non-approved email.
6. **Canvas link:** paste a real school feed from a phone using the two-step guide.
7. **Notifications:** permission prompt, allow and deny, and whether a reminder arrives at all (the web push path was not verified).
8. **Real network:** a cold load on mobile data in a low-signal spot.
9. **Light and dark system theme** on an OLED phone; text size set to large.
10. **Tap targets** with a real thumb on the Today row actions and the Calendar chips (one small target was measured on Capture).
11. **A parent's view:** read the privacy policy page once it exists, on a phone.

## 10. Added to NEEDS-SID

Rotate the pen `PEN_KEY` and tidy the README; keep the Google secrets JSON out of any share; publish privacy and terms pages (route-guard change, C06); create the reviewer demo account; decide Sign in with Apple and the parent-payment path; confirm RLS in the Supabase dashboard; consider security headers and rate limits; top up Anthropic credit.
