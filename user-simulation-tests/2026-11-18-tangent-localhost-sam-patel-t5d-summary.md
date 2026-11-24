# 🧪 tangent-localhost — Flow: Capture three missed assignments by typing

> 2026-11-18 · Simulation (own user) · 🌐 Playwright

**In one line:** Sam's one typed sentence became a good plan, but he stalled at step 7 of 15 with 1 of 3 assignments captured. Popups blocked the start, and a false "All done" ended it.

## 🎯 What to do
| # | Action | Fixes | Seen by | Criticality |
|---|--------|-------|---------|-------------|
| 1 | Show one overlay at a time on chat first load; keep the reply box free | F1 | U1 | 🔴 High |
| 2 | Ask "Did you finish this?" on Done; drop "Nice work" for unstarted steps | F2 | U1 | 🔴 High |
| 3 | Replace "Based on Canvas and Gmail" with "Based on what you told me" on the plan page | F3 | U1 | 🟠 Medium |
| 4 | Add "Saved. First step: …" plus "Add another assignment" after Confirm | F4 | U1 | 🟡 Low |

## 🔎 What we found
| ID | What happens | Where | Seen by | Criticality |
|----|--------------|-------|---------|-------------|
| F1 | Three popups stack up; notification "Not now" is hidden behind one | Chat, first load | U1 | 🔴 High |
| F2 | Done on an unstarted step brings "Nice work" and a quiz; run stalls | Home after Confirm | U1 | 🔴 High |
| F3 | Plan claims it read Canvas and Gmail; neither is connected | Planning page | U1 | 🟠 Medium |
| F4 | No "saved" message; Thursday and Friday steps hidden under "Coming up 2" | Home | U1 | 🟡 Low |

## 💭 How they felt
| User | Result | Start → end | Turning point | In their words |
|------|--------|-------------|---------------|----------------|
| U1 · 9th-grade procrastinator | ⏱️ Stalled (step 7 of 15, no tap named) | 😤 → 😟 | Step 6 · Home "Nice work today" | "It feels fake and I'm close to closing the app." |

## 🧭 Friction map
| Screen | U1 |
|--------|----|
| Chat first load (steps 1-2) | 🔴 |
| Chat reply box (step 3) | 🟡 |
| Planning page (step 4) | 🟡 |
| Home after Confirm (step 5) | 🟡 |
| Home "All done" and check-in (steps 6-7) | 🔴 |

🟢 clear · 🟡 hesitated · 🔴 confused · ⛔ gave up · — didn't reach

## ✅ What works (don't touch)
| What | Seen by |
|------|---------|
| One typed sentence becomes a dated 3-step plan | U1 |
| Plan uses school hours, evenings and focus length from onboarding | U1 |

---
**👤 Users:** [U1 · 9th-grade procrastinator](simulation/results/2026-11-18-sam-patel-t5d.md)
**📄 Reports:** none besides the user report. This run had no consolidated or heuristic report.
