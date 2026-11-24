# 🧪 tangent-localhost — Flow: Capture ED II essays and shifts, connect Canvas, plan the essays

> 2026-11-18 · Simulation (own user) · 🌐 Playwright

**In one line:** Priya got a good plan and confirmed it, but Canvas stayed blocked and Confirm gave no feedback. The run hit the 15-step cap.

## 🎯 What to do
| # | Action | Fixes | Seen by | Criticality |
|---|--------|-------|---------|-------------|
| 1 | Show a "Plan saved" banner with step count and "View plan" link on Home after Confirm | F1 | U1 | 🔴 High |
| 2 | Add "what's stored, who sees it, disconnect anytime" to the Connect Canvas wizard and Settings > Schedule | F3 | U1 | 🔴 High |
| 3 | Stop the notification toast covering Next in the Canvas wizard; label Canvas in Settings | F2 | U1 | 🔴 High |
| 4 | Show "read in Canvas and Gmail" on the plan only when connected | F4 | U1 | 🟠 Medium |

## 🔎 What we found
| ID | What happens | Where | Seen by | Criticality |
|----|--------------|-------|---------|-------------|
| F1 | Confirm gives silence: no message, no link, essays not visible | Home after Confirm | U1 | 🔴 High |
| F2 | Canvas is blocked: no feed link, Next covered by toast | Settings > Schedule, Canvas wizard | U1 | 🔴 High |
| F3 | Nothing says what is stored or how to disconnect | Canvas wizard, Settings | U1 | 🔴 High |
| F4 | Plan claims it read Canvas and Gmail, and first draft said Jan 1 | Plan view | U1 | 🟠 Medium |

## 💭 How they felt
| User | Result | Start → end | Turning point | In their words |
|------|--------|-------------|---------------|----------------|
| U1 · ED II applicant, bakery job | ⏱️ Cap (step 15) | 😤 → 😟 | Step 14 · Home after Confirm | "I pressed Confirm and got silence." |

## 🧭 Friction map
| Screen | U1 |
|--------|----|
| Plan page with stacked popups (steps 1-3) | 🟡 |
| Connect Canvas wizard (steps 6-8) | 🟡 |
| Home question cards (steps 11-12) | 🟡 |
| Plan view (step 13) | 🟡 |
| Home after Confirm (step 14) | 🔴 |

🟢 clear · 🟡 hesitated · 🔴 confused · ⛔ gave up · — didn't reach

## ✅ What works (don't touch)
| What | Seen by |
|------|---------|
| Plan avoids her shifts and ends before Jan 5 | U1 |
| Light questions with visible Skip and Stop | U1 |
| "Nothing is on your calendar until you confirm" | U1 |

---
**👤 Users:** [U1 · ED II applicant, bakery job](simulation/results/2026-11-18-priya-nair-e2n.md)
**📄 Reports:** none besides the user report (single user, no heuristic review)
