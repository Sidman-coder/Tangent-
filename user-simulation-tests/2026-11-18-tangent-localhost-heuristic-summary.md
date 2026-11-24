# 🧪 tangent-localhost — Site

> 2026-11-18 · Heuristic review · 🌐 Playwright

**In one line:** 7 screens reviewed. Students can't tell where a new capture went, and parents get no safety or privacy information.

## 🎯 What to do
| # | Action | Fixes | Seen by | Criticality |
|---|--------|-------|---------|-------------|
| 1 | On Home, show where each capture was saved, with a link | F01 | `Power` `Avg` | 🔴 High |
| 2 | Add a "For parents" privacy and deletion link on Sign-in | F16 | `Low-lit` | 🟠 Medium |
| 3 | Make Calendar's 7-day panel and week grid use the same data (verify first) | F02 | `Power` `Avg` | 🟠 Medium |
| 4 | Add a confirm step naming what goes to Delete data, Delete account, Forget everything | F10 | `Low-lit` | 🟠 Medium |

## 🔎 What we found
| ID | What happens | Where | Seen by | Criticality |
|----|--------------|-------|---------|-------------|
| F01 | Home says "all caught up" while an Undo for the new item exists | Home | `Power` `Avg` | 🔴 High |
| F16 | Sign-in gives parents no safety, privacy or consent information | Sign-in | `Low-lit` | 🟠 Medium |
| F02 | Calendar's 7-day panel says 6 things; the week grid is empty (low confidence) | Calendar | `Power` `Avg` | 🟠 Medium |
| F10 | Delete and Forget buttons carry no confirmation or undo note | Your data, What Tangent knows | `Low-lit` | 🟠 Medium |

## 💭 How they felt
| Persona | Result | Strongest concern | In their words |
|---------|--------|-------------------|----------------|
| `Power` · daily capturer | Rated 17/17 findings, top rating 3 on F01 | Item vanishes into "all caught up" | "I'd go back to my notes app." |
| `Avg` · typical student | Rated 17/17 findings, top rating 3 on F01, F02 | Can't find the confirmed plan again | "I'd quietly stop opening the app." |
| `Low-lit` · parent view | Rated 17/17 findings, top rating 3 on 5 findings | No privacy info, unguarded delete buttons | "A reason to say no." |

## 🧭 Where it breaks most
| Heuristic | Findings | Worst case |
|-----------|----------|------------|
| Consistency and standards | 4 | "Personal" on Home vs "Short-term" on Calendar |
| Match between system and the real world | 3 | Unexplained "Goes to: Auto" chip on capture |
| Aesthetic and minimalist design | 3 | Canvas promo card outweighs capture on Home |

## ✅ What works (don't touch)
| What | Seen by |
|------|---------|
| Home Undo, "Not now" and per-fact Forget/Edit give control | 🔍 |
| Short lists, suggested-question chips and Calendar view switching | 🔍 |

---
**📄 Reports:** [Heuristic](heuristic/results/2026-11-18-heuristic-tangent-localhost-site.md)
