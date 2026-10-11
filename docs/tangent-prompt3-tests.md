# Prompt 3 + fixes: hands-on tests

Mark each test ✅ or ❌. If one fails, note its ID (for example A1.3), take a screenshot, and copy anything red from the `npm run dev` window.

---

## 0. Setup (10 min)

1. `.env.local` contains `TANGENT_PIPELINE_V2=true`. Stop and restart `npm run dev`, then open http://localhost:3000 and sign in.
2. Create the test data by typing these in Tangent AI, confirming each preview:
   - "Make me a 1-week SAT writing plan" → Confirm. Note its title (for example "SAT Writing Skills Sprint").
   - "Make me a 1-week SAT math plan" → Confirm.
   - "Make me a 1-week ICF prep plan" → Confirm. If it's titled something else, rename it to **ICF Prep**.
   - Quick add: "Saturday soccer practice at 9am" (used to check that "SAT" never matches "Saturday").
3. In Supabase, run `select count(*) from ai_decisions;` and note the number.

---

## A1. Clarifying questions remember the question

| ID | Type this | Expected |
|---|---|---|
| A1.1 | `Take out all of my SAT tasks` | A **"Which one?"** card with buttons: *SAT Writing…*, *SAT Math…*, **All of these**, **Cancel**. **Saturday soccer practice is NOT offered.** |
| A1.2 | Type `the writing stuff` | A **delete preview** with **only** the writing plan's tasks (count + titles). Nothing deleted yet. → Click **Discard** |
| A1.3 | `Take out all of my SAT tasks`, then **tap** "SAT Math…" | A delete preview with only the math tasks. → **Discard** |
| A1.4 | `Take out all of my SAT tasks`, then type `all of them` | A preview with **both** SAT plans' tasks, and still no Saturday soccer. → **Discard** |
| A1.5 | `Take out all of my SAT tasks`, then type `never mind` | "Okay, nothing changed" (or similar). No preview |
| A1.6 | `Take out all of my SAT tasks`, then type `the SAT writing skills sprint one` | A **delete** preview for the writing plan. **Must NOT** be a "New plan" preview. → **Discard** |
| A1.7 | `my SAT tasks` | Anything **except** "You have 4 calendars…" (it should list, ask, or offer what to do) |
| A1.8 | `show me my calendars` | The calendar list appears (the real calendar request still works) |
| A1.9 | `Take out all of my SAT tasks`, wait for the card, then type `add dentist tomorrow at 3pm` | The question is dropped. The dentist task is handled normally |

## A2. "Also remove the plan"

| ID | Do this | Expected |
|---|---|---|
| A2.1 | `Take out all of my SAT tasks` → tap **SAT Writing…** | The preview shows ☑ **Also remove the plan** (checked) |
| A2.2 | Click **Confirm** | The writing tasks are gone **and** the plan is gone from your plans/projects list |
| A2.3 | Click **Undo** (on the card, or in Recent changes) | The plan **and** all its tasks are back |
| A2.4 | Repeat A2.1, **uncheck** "Also remove the plan", then Confirm | The tasks are gone, the plan still exists (empty). → **Undo** |

## A3. Clean titles

| ID | Type this | Expected title | Expected time |
|---|---|---|---|
| A3.1 | `I have a soccer coaching appointment coming up tomorrow 10pm` | **Soccer coaching appointment** | Tomorrow **10:00 PM** |
| A3.2 | `I have a dentists appointment tomorrow` | **Dentists appointment** | An open time chosen by spacing (not made up) |
| A3.3 | `remind me to call grandma on friday` | **Call grandma** | Friday |
| A3.4 | `I need to finish chem lab report by thursday` | **Finish chem lab report** | Thursday |
| A3.5 | `Add math notes to binder tomorrow` | **Add math notes to binder** (keeps "Add") | Tomorrow |
| A3.6 | Cmd-K capture: `don't forget to return library book` | **Return library book** | — |

After A3, **Undo** or delete these test tasks.

## A4. "Just talking" → "Ready to add?"

| ID | Do this | Expected |
|---|---|---|
| A4.1 | `Help me prepare for my history test` | It asks questions (Juann's flow) or shows a preview |
| A4.2 | When a preview appears, click **Just talking, don't add** | The card goes away, and it asks **one** short follow-up question |
| A4.3 | Answer it (for example `about 3 hours a week, the test is next Friday`) | It asks another question **or** shows a full schedule |
| A4.4 | Once a full schedule appears | **"Ready to add this to your calendar?"** with **Yes, show preview** / **Keep talking** |
| A4.5 | Click **Keep talking**, then type `make it 4 days instead` | A new schedule, and the readiness row appears again |
| A4.6 | Click **Yes, show preview** | A preview whose tasks **match** the schedule. → **Confirm** → **Undo** |

## A5. Undo doesn't wipe later edits

| ID | Do this | Expected |
|---|---|---|
| A5.1 | `add a study session to my ICF prep` → **Confirm** | One task is added to ICF Prep |
| A5.2 | Rename the ICF Prep plan/project by hand (for example to "ICF Prep Finals") | Saved |
| A5.3 | Undo the change from A5.1 (Recent changes) | The added task disappears, and **the new name "ICF Prep Finals" stays**. Rename it back to ICF Prep afterwards |

## A6. Projects preview before saving

| ID | Do this | Expected |
|---|---|---|
| A6.1 | Open the **ICF Prep** project page → in its chat type `add a step to review my notes` | A compact **Confirm / Discard** row. Nothing is saved yet |
| A6.2 | Click **Confirm** | The step is added. Undo works |
| A6.3 | In the project's **Ask** box, ask it to add a step | Confirm / Discard appears (no direct save) |

---

## B1. Router (understanding what you mean)

| ID | Type this | Expected |
|---|---|---|
| B1.1 | `I have a test next week` | **One task** (not a 7-day plan) |
| B1.2 | `should I schedule study time for the SAT?` | A **chat answer**, with no preview |
| B1.3 | `what's my plan for today?` | A chat answer, with no preview |
| B1.4 | `help me get ready for the SAT in 4 weeks` | Questions first or a **new plan** preview |
| B1.5 | `I want to learn guitar this year` | Sent to **Tangents** (long-range goal), or offers to |
| B1.6 | `I want to build a robotics project over the next 6 weeks` | Treated as a **new project** |
| B1.7 | `stuff for tomorrow maybe` | **"What did you mean?"** with *Make a plan / Just add one task / Just talking* |
| B1.8 | Tap **Just add one task** on B1.7's card | A single task is drafted |
| B1.9 | `done with math hw` (with a Math homework task present) | Completes **instantly** (no AI), with Undo |

## B2–B3. Plan matcher + nicknames

| ID | Type this | Expected |
|---|---|---|
| B2.1 | `add 2 checkpoints to my iCF prep before friday` | The preview says **Updating ICF Prep** (not a new plan) |
| B2.2 | **Mic:** "add two checkpoints to my eye see eff prep" | Also matches **ICF Prep**. → **Discard** |
| B2.3 | `add a review session to my I.C.F. thing` → **Confirm** | Matches ICF Prep. This saves the nickname "icf thing" |
| B2.4 | `add one more session to my icf thing` | Matches **straight away** (from the nickname). Supabase: `select alias_normalized from plan_aliases;` shows it |
| B2.5 | Create a plan **ICF Essay**, then `add a session to my ICF` | Asks **"Which one?"**: ICF Prep / ICF Essay |
| B2.6 | `add a session to my saturday plan` | Does **not** match the SAT plans |

## B4. Adding to an existing plan

| ID | Do this | Expected |
|---|---|---|
| B4.1 | `add 2 study sessions to my ICF prep this week` | Header **"Updating ICF Prep · N tasks → N+2 tasks"** |
| B4.2 | Look at the times | **Not during school hours** (8am–3pm on weekdays) and not on an already full day. The card notes when a time was chosen for you |
| B4.3 | Check the tasks | No duplicates of existing ICF tasks. → **Confirm** → **Undo** |

## B9. Decision log (Supabase)

| ID | Run this | Expected |
|---|---|---|
| B9.1 | `select route, intent, via, outcome, created_at from ai_decisions order by created_at desc limit 15;` | One row per request you just made |
| B9.2 | Look at the outcomes | They match what you did: **confirmed**, **discarded**, **undone**, **asked**, **answered**, **applied_instantly** |
| B9.3 | `select count(*) from ai_decisions where request_text = '';` | Low or 0 |

---

## Part 3. AI Activity

| ID | Do this | Expected |
|---|---|---|
| C1 | AI page → the small **clock icon** left of "Your Brief" (hover it) | Tooltip "AI activity". Clicking opens **Settings → AI Activity** |
| C2 | Look at the table | Columns: When / You asked / Tangent understood / Plan / Changes / Result. Your requests are listed, newest first |
| C3 | Click a row | **"Why Tangent did this"**: intent, confidence, plan candidates, questions, changes |
| C4 | Use the filters (Result = Discarded, last 7 days) and the search box (`SAT`) | The list narrows correctly |
| C5 | Expand a **confirmed** row that's still undoable → **Undo** | The change is undone on the calendar. The row shows Undone |
| C6 | Confirm a new preview → on the collapsed card, click **Details** | It opens AI Activity with **that row** expanded |
| C7 | Recent changes panel → an AI item → **Details** | Opens the right row (from a page other than Settings) |
| C8 | On your **owner** account: Models / Tokens / Est. cost columns | Visible |
| C9 | Sign in as your **second Gmail** (not the owner) | AI Activity shows that account's rows only, and **no** cost columns |
| C10 | **Delete** one row | The row disappears. The calendar doesn't change |
| C11 | **Clear activity** | The dialog says *"This clears the log. Your calendar stays the same."* → Confirm → the log is empty and **all tasks are still there** |
| C12 | Shrink the browser to phone width | Rows become stacked cards |
| C13 | Settings → **What Tangent knows** | Has a link to AI Activity (and AI Activity links back) |

## Undo across pages

| ID | Do this | Expected |
|---|---|---|
| U1 | Confirm any preview, go to **Calendar**, then come back to the AI page | The card still shows Undo (or "Undone" / "Can't undo anymore") |
| U2 | Calendar → **Recent changes** icon (or Ctrl+K → "Undo recent change") → Undo the latest | It works |
| U3 | Make a change, then switch pages within 8 seconds | The **Undo toast** follows you |

---

## Switch OFF checks (stop the server, remove the `TANGENT_PIPELINE_V2` line, restart)

| ID | Do this | Expected |
|---|---|---|
| F1 | `Take out all of my SAT tasks` | Still asks **which one** with buttons, and nothing is deleted without confirming |
| F2 | Type `the writing stuff` | Confirmation for **only** the writing plan's tasks, mentioning the plan removal. → **Cancel** |
| F3 | `I have a soccer coaching appointment coming up tomorrow 10pm` | Title **Soccer coaching appointment**. → Undo |
| F4 | Settings and the AI page | **No** AI Activity tab, **no** clock icon, **no** preview cards |
| F5 | Juann's features: Projects page, a question card, Cmd-K capture, feature tour | All work |
| F6 | Supabase: `select count(*) from ai_decisions;` before and after a request | **Doesn't go up** with the switch off |

---

## Done?

- All ✅ → ship: push, PR → main, merge, Vercel **Ready**, live check (F1, F3, Undo), then tell Juann.
- Any ❌ → send the ID, a screenshot and any red terminal text. **Don't merge yet.**
