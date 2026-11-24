# Judge: Design, round 3

Reviewer role: design (visual system, layout, interaction, copy). This was a read-only review from files. I did not run the app, made no AI calls and edited no code.

**Evidence read:**
- The round-2 sims: `user-simulation-tests/simulation/results/2026-11-22-{maya-okafor,jordan-reyes,leo-brandt,priya-nair,sam-patel}-r2.md`, plus step screenshots in `docs/overnight2/sims/`. The ones I opened are `sam-patel-r2-step6.png` and the Maya and Jordan steps.
- The heuristic round 3 report: `user-simulation-tests/heuristic/results/2026-11-22-heuristic-tangent-localhost-site-round3.md`, with screenshots in `docs/overnight2/screens/heuristic3/`.
- The Phase 5 screens: `docs/overnight2/screens/p5-{home,calendar,you-mapped}-390-light.png`.
- The Phase 6 screens: `docs/overnight2/screens/phase6/{onboarding-consent-390,privacy-controls-390,noticed-390}.png`.
- `docs/overnight2/live/LIVE-NOTES.md`, `docs/overnight2/AI-RESULTS.md`, `docs/overnight2/PROGRESS.md`, `docs/overnight2/DECISIONS.md`.
- My round-2 file: `docs/overnight/judges/judge-design-2.md`.

**Limits:**
- **Shared test account.** Every sim ran on one test account (the greeting says "Leo"). Personas see each other's items, notifications and remembered facts.
  - I discount "this isn't mine" reactions.
  - I still count layout, density and state bugs, because a real student with a backlog would hit them too.
- **Headless browser, no microphone.** Voice was never exercised. Jordan's silent "Say it" is a test limit. That it gave *no feedback at all* is still a design point.
- **No real phone.** "390" means a 390x844 Playwright viewport. There was no touch, safe-area, keyboard or real-device check.
- **Empty account.** No first run on an empty account was captured this round.
- **Coverage gaps.**
  - Heuristic round 3 covers 1440 dark only.
  - There is no 390 capture of the Settings sub-tab strip or the phone Projects list.
- **Labels.** Each claim is tagged **[fact]** (seen in a named file or screenshot), **[inf]** (inference) or **[op]** (opinion).

---

## 1. Scores (round 2 → round 3)

| Area | R2 | R3 | Evidence |
|---|---|---|---|
| First-use | 4 (provisional) | **5** | **Better:**<br>• **[fact]** Sign-in now has Sign in / Create account tabs, "or sign in with email", and Privacy, Terms and For parents links (`heuristic3/heur-signin.png`).<br>• **[fact]** Onboarding step 1 says in plain words what goes to Claude and Deepgram, with "How we handle your data" (`phase6/onboarding-consent-390.png`).<br>**Still weak:**<br>• **[fact]** Onboarding is "1 of 9" steps.<br>• **[fact]** The first capture can mangle text. Leo's sentence became "Get ready" and "I still have to film and edit 's video" (Leo r2 step 2; both visible in `heur-home.png`).<br>• **[fact]** "Goes to: Auto" went unexplained for 4 of 5 personas (Jordan, Leo, Priya, Sam).<br>• **[inf]** With a name entered, Continue is pale lavender and reads as disabled.<br>**Provisional:** there is still no empty-account first run. |
| Chat | 5 (not re-scored) | **5** | **Better:**<br>• **[fact]** Talk answers are specific (LIVE-NOTES Phase 2: L1, L6 and L11 PASS).<br>• **[fact]** Eval 62/64, 0 banned phrases (AI-RESULTS.md).<br>**Weak where it counts, inside plan and task chats:**<br>• **[fact]** Plan revisions arrive with no chat reply (Maya r2; Priya r2 step 3: "Tangent never answered in the chat").<br>• **[fact]** Leo gave a concrete report-back. The reply was a generic "Logged how … went. Thanks for telling me" and nothing changed (Leo r2 step 13).<br>• **[fact]** /capture shows raw `##` markdown (LIVE-NOTES 3.4).<br>• **[op]** The talk route is good. A plan chat that doesn't answer stops being a conversation. |
| Planning quality | 6 (not re-scored) | **5** | **Good:**<br>• **[fact]** Plans now carry dated steps, Because/Why rows, a "Used" list of stored facts, and a "nothing is on your calendar until you confirm" gate (Leo r2 step 4; Priya r2 step 2).<br>**But:**<br>• **[fact]** First drafts broke a stated limit in 4 of 5 runs:<br>&nbsp;&nbsp;– Maya: a step on the day of the final.<br>&nbsp;&nbsp;– Leo: 2 steps after Friday's test, one on his upload day.<br>&nbsp;&nbsp;– Priya: Wed 6:30 PM, inside her stated 4–9 shift.<br>&nbsp;&nbsp;– Jordan: a quiz at Fri 4:30, inside practice.<br>• **[fact]** Priya's regenerated plan kept the same slot. Its Why line now said it "comes after your 4-9pm hours" (Priya r2 step 3).<br>• **[fact]** Leo's summary bullets contradicted the step dates (Leo r2 step 5).<br>• **[op]** A reason line that contradicts the step's own time is worse than no reason. This is why the score went down, not up. |
| Today (Home) | 6 | **5** | **Good:**<br>• **[fact]** Category filter All / School / Projects / Personal.<br>• **[fact]** The question strip now sits under the first section with a labelled "Hide" (`p5-home-390-light.png`).<br>**But at 390:**<br>• **[fact]** Two stacked "Draft plan" pills cover the Evening section (`p5-home-390-light.png`).<br>• **[fact]** The header "next" is a goal sentence at 6:00 PM ("Keeping a weekly Sunday video upload going without my chem and algebra grades slipping"). It is not the next open item (same file; heuristic F01).<br>• **[fact]** The Next up card shipped in code only and was not rendered (PROGRESS 5.3).<br>• **[fact]** Morning shows "0" right next to an open question card.<br>• **[op]** You can't scan this in 3 seconds. |
| Calendar | 7 | **6** | **Good:**<br>• **[fact]** "Changes" replaced the icon-only history control.<br>• **[fact]** The category legend shows School, a 3-dot Projects chip and Personal (`p5-calendar-390-light.png`).<br>• **[fact]** Titles wrap at 1440 (heuristic: R2 F08 gone).<br>• **[fact]** Ticking the circle opens the check-in, which got the run's only High clarity (Sam r2 step 5).<br>**But at 390:**<br>• **[fact]** Two draft pills and the mic FAB sit over agenda rows; "Ask first teacher to be…" is under the mic (`p5-calendar-390-light.png`).<br>• **[fact]** The mic FAB overlaps the check-in card and the next row (`sims/sam-patel-r2-step6.png`).<br>• **[fact]** Rows still end in "…" after two lines.<br>• **[fact]** Agenda rows drop the project name (heuristic F12). |
| Projects | 5 | **5** | **Good:**<br>• **[fact]** Cards show a "Next: … · day, time" line and a progress bar (`heuristic3/heur-projects.png`).<br>**But:**<br>• **[fact]** The card "goal" is often the student's raw chat message ("Can you plan my studying for this into my week before Friday? I'm editing Sunday's video too.").<br>• **[fact]** "Solve 10 limit problems" sits in an Algebra 2 sprint (same file; Leo r2 step 11).<br>• **[fact]** The New project button is a pale filled violet.<br>• **[fact]** Tangents vs "path" jargon persists (heuristic F04).<br>• **[fact]** Phone Projects was not captured, so the two-mic issue can't be judged. |
| Settings / You | 6 | **6** | **Good (privacy, the best design work this round):**<br>• **[fact]** "What you can take back" (`phase6/privacy-controls-390.png`).<br>• **[fact]** A Disconnect Canvas panel with focus on Cancel and 44px buttons (PROGRESS 6.1).<br>• **[fact]** "Tangent noticed" rows (`phase6/noticed-390.png`).<br>**But:**<br>• **[fact]** "Forget" is small grey text and doesn't look like a control (`noticed-390.png`).<br>• **[fact]** You, mapped still glows, and its labels overlap or clip: "Python Competitive Pr…" sits on "Commitments", and fragments like "C" and "Prep" show (`heur-settings-context.png`; heuristic F15).<br>• **[fact]** The draft pill covers the map card at 390 (`p5-you-mapped-390-light.png`). |
| Overall polish | 7 | **5** | **Good:**<br>• **[fact]** No sideways scroll on any p5 screen.<br>• **[fact]** npm test 1053/0 and tsc clean (PROGRESS 6).<br>**But:**<br>• **[fact]** A floating "Draft plan · … · 5 steps ×" pill appears on every captured screen at both widths, and stacks two-high at 390 (`p5-*-390-light.png`, `heuristic3/*.png`).<br>• **[fact]** It stays after Confirm (Priya, Sam).<br>• **[fact]** Its only control is an × that discards (heuristic F07, 3/3 raters).<br>• **[fact]** It covers Home's Answer/Hide and the map chips (F14).<br>• **[fact]** "Later" removed the whole Added card, including Undo (Leo r2 step 10).<br>• **[fact]** A text column collapsed to one character per line (Leo r2 step 5).<br>• **[op]** One leaked overlay plus overlaps undo a round of careful token work. |
| Differentiation | 6 (not re-scored) | **7** | **Good:**<br>• **[fact]** Priya and Sam both judged it "Different from generic apps: Yes": one sentence became a dated plan with reasons, a confirm gate, Undo, and a check-in right after Done that asks "How long it took".<br>• **[fact]** Leo named the "Used" list as the reason it wasn't generic (Leo r2 step 4).<br>• **[fact]** The round review "Last round you said X" and Too big → split both PASS (LIVE-NOTES 3.4).<br>**But:**<br>• **[fact]** The AI differentiation judge gave 6/10 (AI-RESULTS.md).<br>• **[fact]** The loop's last beat fails. Check-in Save is silent (3 of 5), and Leo's report-back changed nothing ("a fancier version of the same thing").<br>• **[op]** The idea is clearly different now. The finish isn't yet. |

Mean of the nine: 49 / 9 = **5.4** (round 2: my 5.8; chair 5.67).

**[inf]** The drop is mostly exposure, not regression. This round's screens and sims show more of the real loop on a loaded account. That surfaced state bugs (draft pill, silent save, overlays) that round 2's lighter captures didn't reach. The one true visual regression is the draft pill.

---

## 2. Status of my round-2 issues

| Issue | Status | Evidence |
|---|---|---|
| D10 / #3 Sign-in trust | **FIXED (mostly)** | **[fact]** Sign in / Create account tabs, "or sign in with email", and Privacy / Terms / For parents links (`heur-signin.png`; O2-D26). Heuristic R2 F11 is gone. |
| D11 / C19 / #1 Map off-system | **OPEN** | **[fact]** The restyle was not done (O2-D51). The glow orbs and ivory/dark card remain (`heur-settings-context.png`). |
| #2 Map labels clipped/tiny | **PARTLY** | **[fact]** Pills are at least 12px and kept inside the stage (O2-D51). Labels still overlap and clip: "Python Competitive Pr…" over "Commitments", "C", "Prep" (`heur-settings-context.png`; heuristic F15). |
| #13 Map "0" vs "Not asked yet" | **FIXED (per DECISIONS)** | **[fact]** O2-D51 says "Not asked yet". **[inf]** Not seen on a screenshot I opened. |
| D13 / C17 / #6 Calendar mic over content | **OPEN** | **[fact]** The mic sits over an agenda row (`p5-calendar-390-light.png`) and over the check-in card (`sam-patel-r2-step6.png`). |
| D13 / #12a Icon-only history | **FIXED** | **[fact]** The text button "Changes" (`p5-calendar-390-light.png`; O2-D50). |
| #12b "Goes to: Auto" | **OPEN** | **[fact]** Heuristic F05 (4.0). Unexplained to Jordan, Leo, Priya and Sam. |
| D15 / #4 Phone Settings tab strip clipped | **OPEN (not evidenced)** | **[fact]** No 390 capture of the sub-tab strip this round. I can't call it fixed. |
| #5 Projects two mics / clipped placeholder | **PARTLY / unknown** | **[fact]** The rail placeholder is now "Can I fit a run in?" (O2-D53). Phone Projects was not captured. |
| C11 / #7 Capture "0 things" vs Home | **PARTLY** | **[fact]** Capture now reports a count ("Found 3 things and added them", Leo r2 step 2). That status vanished before Leo could read it, and the items were mangled. |
| #8 Today's next step is a sentence | **OPEN** | **[fact]** The header "next" is a long goal sentence at 6:00 PM (`p5-home-390-light.png`; heuristic F01). Next up was not rendered. |
| #9 Stale screenshots | **FIXED** | **[fact]** A fresh dated p5 set at 390 and 1440, light and dark (PROGRESS 5.5). |
| #10 Agenda titles truncate | **PARTLY** | **[fact]** Titles wrap at 1440 (R2 F08 gone). At 390 they still end in "…" after two lines (`p5-calendar-390-light.png`). |
| #11 Destructive looks like neutral | **PARTLY** | **[fact]** Removal words are now Delete / Clear / Dismiss all (O2-D52), and Disconnect asks first. The draft pill's × still discards with no Undo (F07). |
| #14 Type scale (11 sizes) | **OPEN (not re-checked)** | **[fact]** Nothing in DECISIONS addresses it. |
| #15 Tangents / "path" jargon | **OPEN** | **[fact]** Heuristic F04 (2.7). "Tangents" still sits beside Projects (`heur-projects.png`). |
| C20 Capture/question honesty | **PARTLY** | **[fact]** A "Tangent has a question about this" row opened a dialog with no question (Leo r2 step 3). |

---

## 3. Top 5 next fixes (ranked)

1. **Kill the leaked "Draft plan" pill.** Remove it on Confirm. Never stack it. Keep it clear of content. Never discard without Undo. **[fact]** Two stacked pills appear on Home, Calendar and You at 390 (`p5-*-390-light.png`). It stayed after Confirm for Priya and Sam. Heuristic F07 and F14 cover the discard-only × and the overlap.
2. **Acknowledge the check-in Save.** Show "Got it, logged as Okay. Next: step 2, day time" and keep the card's space for it. **[fact]** A silent close hit 3 of 5 (Maya, Priya, Sam). Two of them marked the task unresolved for this reason alone. The code is at `components/today/StepFollowUp.tsx:59-78` (O2-D61).
3. **Make plan claims true.**
   - Treat stated busy times and deadlines as hard blocks.
   - Rewrite any Why line the placed time contradicts.
   - Post a one-line reply on every revision.

   **[fact]** Priya r2 steps 2–3 (shift plus a false Why line), Leo r2 step 4 (steps after the test), Maya r2 (step on the final's day), Jordan r2 (practice clash).
4. **Make Today's header name the next open item as a short title, and render Next up.** **[fact]** The header currently shows "next: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping at 6:00 PM" while earlier items are open (`p5-home-390-light.png`; heuristic F01). Next up is code-only (PROGRESS 5.3).
5. **Clear the phone overlays.** Give the mic FAB reserved bottom padding and hide it while a sheet or check-in card is open. **[fact]** The mic sits over an agenda row (`p5-calendar-390-light.png`) and over the check-in card (`sims/sam-patel-r2-step6.png`).
   - Runner-up: flatten You, mapped and fix the label overlap (`heur-settings-context.png`).

---

## 4. Verdict

**5.5 / 10.** The loop now works and is clearly different from a to-do app: 4 of 5 sims did every action, against 1 of 5 before. But a leaked draft pill, a silent check-in Save and plan reasons that contradict their own times make the finish feel untrustworthy. Fix those three before any new surface. **[op]**
