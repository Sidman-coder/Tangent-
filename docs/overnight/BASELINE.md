# Baseline: what a first-time high schooler sees (before the overnight changes)

Taken 2026-11-18 about 01:00 EST from the production build on `push-v1` (same code as `v3-core-loop`), signed in as the **test account** (a `+test` alias). Screenshots: `docs/overnight/screens/before/<screen>-<390|1440>-<light|dark>.png`.

**Read this first:**
- The test account is **not new**. It has a project ("Instagram Growth to 10K"), 9 past-due items and 8 facts in You, mapped. So these shots show a lived-in account. New-student shots (empty account, onboarding, chat) are taken in Phase 2 after the first reset.
- Not captured yet: Home chat (talk, then plan), onboarding (`/dev/app/setup` 404s in the production server; see DECISIONS D4), a project page, and sample-only states (notifications list, draft bubble, round review). They get covered in Phase 2 or marked "read in code only".
- `/waitlist` signed out redirects to `/signin`, so there is no separate shot.
- 390px checked first. No sideways scroll on any captured screen (390 or 1440, light or dark). That is a script check (`scrollWidth > clientWidth`), recorded in the run log, not a visual judgment.

Every paragraph says what the screenshot shows. Gaps are my reading of the screenshot, not tested with real students.

## Sign in (`signin-*`, signed out)
A white card: "Welcome to Tangent", Sign in / Create account tabs, a big purple "Continue with Google", then Password / Email code tabs and an email field. Below the card, on a phone, a headline "Your week, planned around you." and a short feature list ("Say it, it's saved"). A first-time student can tell what to do and what the app is. **Gaps:** the page headline ("Your week, planned around you") isn't the tagline we use elsewhere ("Chatbots answer you. Tangent follows up."), so "follows up", the actual edge, isn't on the first screen. It's unclear what Google sign-in shares. There is no visible privacy line near the sign-in buttons for minors or parents (not seen in the 390px screenshot; check the rest of the page).

## Home (`home-*`)
Greeting "Still up, Sid?" with the date and "Nothing planned today · 9 past due"; a big "Type or say anything…" box with an Auto menu and a mic; a "6 questions to sharpen your plans · setup: 1 step left" strip with Answer / Finish setup; filter chips (All, School, Projects, Personal); a past-due section ("A lot piled up. A fresh start could clear it." with a Fresh start button); then a day timeline (Morning / Afternoon / Evening / Late night) and "Coming up". On first load a **"One question" sheet** ("What's the hardest part of keeping up right now?") covers the page with a dim scrim on both phone and desktop. **Gaps:** two prompts compete before the student has done anything (the setup strip and the modal); the scrim hides the main thing (the input); the greeting depends on the clock and may feel odd (1 AM here); the timeline shows "Nothing this morning / afternoon / evening / late tonight" four times, which feels empty rather than calm; "9 past due" with a pile on a new account feels like pressure (copy is gentle, but the number leads the screen). On desktop the content column is narrow (about 880px) and the right two thirds of the screen is empty.

## Capture (`capture-*`)
A dark/light page with the wordmark, "Open app →", a big mic pill with "or tap to type", then "To do, 0 things" and an "All tasks" row. It looks like a separate mini-app: its own header, no sidebar or tab bar, and it says "0 things" while Home says 9 past due (they count different things). **Gaps:** two different "home" experiences (Home and Capture) with different counts; large dead space below; the mic pill has no label other than "or tap to type".

## Today
`/today` redirects to `/` (Home), so Today is Home. No separate screenshot.

## Calendar (`calendar-*`)
Phone: a "November" header with Today and arrows, 3 days / Month / Agenda tabs, filter chips (All, School, Projects, Short-term), then an hour grid from 8 AM, with a floating mic button on the bottom right and a four-item tab bar. The grid is empty for this account. **Gaps:** an empty week gives no hint what goes here or how to add something; the floating mic overlaps the grid corner; chips and tabs together are a lot of controls above an empty grid. The desktop "with the rail" view is in `calendar-1440-*`.

## Projects (`projects-*`)
A heading "Projects", a one-line description, "Tangents" and "New project" buttons, and one project card ("Instagram Growth to 10K", a progress bar, "Next: Define your Instagram nic… · Sun, Nov 8 · 7:00 PM"). Plenty of empty space below. **Gaps:** the "Next" step is dated Nov 8, ten days ago, shown as if upcoming, so the card looks stale; truncated step text; two primary-looking pills at the top ("Tangents" vs "New project"). School project page `/projects/school` is captured (`projects-school-*`).

## Tangents (`tangents-*`)
"Nothing in orbit yet" card: explains what a path is, shows three chips from what Tangent knows ("You're working toward being more organized with all of your work", "You're aiming for: a top result", "Instagram Growth to 10K") and a "Start your first path" button. The chips make Tangent feel like it knows the student, a real strength. **Gaps:** "path" vs "Tangent" wording on the same screen (the heading says Tangents; the card says "A path is…"); chip text is long and wraps; the first chip reads like a diagnosis ("working toward being more organized").

## Settings and sub-pages (`settings-*`)
Settings opens on Account on desktop (`/settings` redirects to `/settings/account`) and has tabs on a phone (Schedule, Notifications, AI activity, Your data; Security and Context under it). **Your data** shows What's stored, Download my data, Clear this browser, Delete all my data in plain language, a strength for trust. **What Tangent knows / You, mapped** is a large warm map with a central "S · 8 facts" orb and floating area labels (What's hard 0, Future 0, Goals 2, Classes & activities 2…), "Drag to turn · click an area to open it". **Gaps:** the map is a distinct visual style (cream, glow) from the rest of the app's lavender; label chips clip at the right edge on a phone ("Classes & activities 2" is cut off); the hint text sits under the tab bar; zero-count areas look like empty failures, not "we haven't asked this yet".

## Notifications
The bell sits top right on every page, with a red dot on Tangents. The panel itself isn't captured here (needs a click; sample page unavailable). To be captured in Phase 2.

## Tasks (`tasks-*`)
"All tasks" list reached from Capture. Captured at both sizes; judged in Phase 3.

## Obvious gaps overall (my reading)
1. Two first prompts at once (setup strip + "One question" modal); the real edge ("follows up") isn't visible in the first 5 seconds.
2. Empty states are plain text with no clear single next action (Calendar, Home timeline, Tangents).
3. Two homes (Home and Capture) with different counts.
4. Style drift: You, mapped is cream and glowing, the rest lavender; desktop leaves most of the screen empty.
5. Stale or past-due items lead the screen; copy is gentle but the numbers dominate.
6. No visible privacy line for minors on the first screen.
