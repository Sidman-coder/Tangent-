# 🧪 tangent-localhost — Flow: Get the club plan around soccer practice, finish two steps, and do the end-of-round review

> 2026-11-18 · Simulation (own user) · 🌐 Playwright

**In one line:** Jordan confirmed the plan and finished step one, but no second step appeared, so the run stalled at step 8.

## 🎯 What to do
| # | Action | Fixes | Seen by | Criticality |
|---|--------|-------|---------|-------------|
| 1 | On Home, after Done, show the next club step in Evening | F1 | U1 | 🔴 High |
| 2 | On the plan page, generate 2-3 steps: advisor, signatures, room | F2 | U1 | 🔴 High |
| 3 | In onboarding, let users name a time "Game"; show "Kept free" on the plan page | F3 | U1 | 🟡 Low |
| 4 | Skip the sport modal if onboarding has it; delay notifications until after confirm | F4 | U1 | 🟡 Low |

## 🔎 What we found
| ID | What happens | Where | Seen by | Criticality |
|----|--------------|-------|---------|-------------|
| F1 | Step marked Done, then nothing new appears, Evening shows 0 items | Home (steps 7-8) | U1 | 🔴 High |
| F2 | Round 1 has one step, but the goal needs advisor, signatures, room | Plan page (step 3) | U1 | 🔴 High |
| F3 | Saturday 8 AM game time (entered as practice) shows as "Practice"; no "kept free" note | Coming up (step 8) | U1 | 🟡 Low |
| F4 | Two pop-ups and a repeated sport question before any content | First chat screen (step 1) | U1 | 🟡 Low |

## 💭 How they felt
| User | Result | Start → end | Turning point | In their words |
|------|--------|-------------|---------------|----------------|
| U1 · Varsity soccer player | ⛔ Gave up (step 8) | 😤 → 😤 | Step 8 · Coming up has no second step | "I tapped Done and got a questionnaire." |

## 🧭 Friction map
| Screen | U1 |
|--------|----|
| First chat with two pop-ups | 🔴 |
| Plan page (Round 1) | 🟡 |
| Home after confirm | 🟡 |
| "How did it go?" check-in | 🟡 |
| Coming up (expanded) | ⛔ |

🟢 clear · 🟡 hesitated · 🔴 confused · ⛔ gave up · — didn't reach

## ✅ What works (don't touch)
| What | Seen by |
|------|---------|
| "Skip and plan it anyway" on the advisor question was easy | U1 |
| First step landed at 7 PM, clear of practice | U1 |
| Practice times were already known on Home | U1 |

---
**👤 Users:** [U1 · Varsity soccer player](simulation/results/2026-11-18-jordan-reyes-s8k.md)
