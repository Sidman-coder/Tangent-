# 🧪 tangent-localhost: Flow: Create a project for his channel with a weekly Sunday upload, ask the chat for a growth plan, then plan it around homework

> 2026-11-18 · Simulation (own user) · 🌐 Playwright

**In one line:** Leo gave up at step 12 of 15. Confirm said "Added 6 steps", but the panel still showed one item and no channel project appeared.

## 🎯 What to do
| # | Action | Fixes | Seen by | Criticality |
|---|--------|-------|---------|-------------|
| 1 | Keep the plan panel open after Confirm; show "Added 6 steps to [name]" with a link | F1, F3 | U1 | 🔴 High |
| 2 | Show one popup at a time on Home; add "Skip tour" to every tour card | F2 | U1 | 🟠 Medium |
| 3 | In plan edit mode, make the title editable and refresh "What I assumed" after a time is set | F3 | U1 | 🟠 Medium |
| 4 | Label the draft plan "Project" or "Repeating reminder" before Confirm | F4 | U1 | 🟠 Medium |

## 🔎 What we found
| ID | What happens | Where | Seen by | Criticality |
|----|--------------|-------|---------|-------------|
| F1 | Confirm says "6 steps added", but the panel shows 1 item and no project exists | Plan panel after Confirm | U1 | 🔴 High |
| F2 | Three popups, then a 12-card tour with no visible exit | Home, Tour | U1 | 🟠 Medium |
| F3 | Old lines ("No time given") stay after edits; title is locked | Plan edit mode | U1 | 🟠 Medium |
| F4 | He can't tell whether Confirm makes a project or a reminder | Plan panel before Confirm | U1 | 🟠 Medium |

## 💭 How they felt
| User | Result | Start → end | Turning point | In their words |
|------|--------|-------------|---------------|----------------|
| U1 · 11th grader, YouTube project | ⛔ Gave up (step 12) | 😕 → 😞 | Step 12 · plan panel after Confirm | "In Notion I'd at least have a page." |

## 🧭 Friction map
| Screen | U1 |
|--------|----|
| Home with stacked popups (step 1) | 🔴 |
| Tour (steps 2-6) | 🟡 |
| Plan panel after Esc (step 7) | 🟡 |
| Plan edit mode, then Confirm (steps 8-11) | 🟡 |
| Plan panel after Confirm (step 12) | ⛔ |

🟢 clear · 🟡 hesitated · 🔴 confused · ⛔ gave up · — didn't reach

## ✅ What works (don't touch)
| What | Seen by |
|------|---------|
| Nothing saved until Confirm; Edit, Discard and Undo are clear | U1 |
| Sunday cadence picked up as a recurring commitment | U1 |
| Setting a time updates the Sunday chips right away | U1 |

---
**👤 Users:** [U1 · 11th grader, YouTube project](simulation/results/2026-11-18-leo-brandt-c9v.md)
**📄 Reports:** none besides the user report (single user, no heuristic review)
