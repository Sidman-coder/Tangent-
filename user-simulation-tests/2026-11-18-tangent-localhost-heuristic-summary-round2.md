# 🧪 tangent-localhost — Site

> 2026-11-18 · Heuristic review (round 2, same 7 screens, after the overnight fixes) · 🌐 Playwright

**In one line:** The 7 screens mostly hold up. The Calendar's "next 7 days" count contradicts its own agenda, which breaks trust in a confirmed plan.

## 🎯 What to do
| # | Action | Fixes | Seen by | Criticality |
|---|--------|-------|---------|-------------|
| 1 | Make Calendar's "Your next 7 days" count match the agenda items listed | F1 | `Power` `Avg` `Low-lit` | 🔴 High |
| 2 | Add a privacy and safety footer to Sign-in; add Help to Settings nav | F2 | `Low-lit` | 🟠 Medium |
| 3 | Let Calendar agenda task titles wrap to two lines | F3 | `Power` `Avg` | 🟠 Medium |
| 4 | Use Delete for server removal and Clear for device-only; add confirm dialogs | F4 | `Low-lit` | 🟠 Medium |

## 🔎 What we found
| ID | What happens | Where | Seen by | Criticality |
|----|--------------|-------|---------|-------------|
| F1 | Panel says 6 things due this week; agenda shows one | Calendar, Home | `Power` `Avg` `Low-lit` | 🔴 High |
| F2 | No privacy, safety or help page reachable; parent can't judge | Sign-in, Settings | `Low-lit` | 🟠 Medium |
| F3 | Three Sundays show the same cut-off title | Calendar | `Power` `Avg` | 🟠 Medium |
| F4 | Forget, Clear, Delete sound alike; no visible confirmation | What Tangent knows, Your data | `Low-lit` | 🟠 Medium |

## 💭 How they felt
| Persona | Result | Top finding | In their words |
|---------|--------|-------------|----------------|
| Power | 2 of 11 findings marked important | F1 | "A count of 6 against one visible item makes me doubt the Canvas feed reconciles." |
| Avg | 4 of 11 findings marked important | F1 | "The panel says 6 things are due this week but the agenda shows one." |
| Low-lit | 7 of 11 findings marked important | F2 | "I find no privacy, safety or help page to read, so I would likely say no." |

## 🧭 Where it breaks most
| Heuristic | Findings | Worst case |
|-----------|----------|------------|
| Consistency and standards | 3 | Forget / Clear / Delete / Remove used inconsistently (F4) |
| Recognition rather than recall | 2 | Agenda titles cut off; capture icons have no labels (F3) |
| Aesthetic and minimalist design | 2 | What Tangent knows map repeats the same counts three times |

## ✅ What works (don't touch)
| What | Seen by |
|------|---------|
| Cancel, Skip and Undo found nowhere missing on the 7 captured screens | 🔍 |
| No efficiency gaps found on the 7 captured screens | 🔍 |

---
**📄 Reports:** [Heuristic](heuristic/results/2026-11-18-heuristic-tangent-localhost-site-round2.md)
