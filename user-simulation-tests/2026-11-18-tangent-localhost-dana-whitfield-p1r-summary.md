# 🧪 tangent-localhost: Flow: Find price, teen data, AI training and deletion, signed out

> 2026-11-18 · Simulation (own user) · 🌐 Playwright

**In one line:** Dana stopped at the sign-in page. It has no links to price, privacy, maker or deletion, so her answer is "no for now".

## 🎯 What to do
| # | Action | Fixes | Seen by | Criticality |
|---|--------|-------|---------|-------------|
| 1 | Add footer on /signin linking Privacy, Terms, Pricing, About; serve them signed out | F1 | U1 | 🔴 High |
| 2 | Write public privacy page: data stored, who sees it, AI training yes/no, deletion | F2 | U1 | 🔴 High |
| 3 | Add price line and "why email or Google" note above "Continue with Google" | F3 | U1 | 🟠 Medium |
| 4 | Add "Made by …" line and parent link on /signin | F1, F4 | U1 | 🟠 Medium |

## 🔎 What we found
| ID | What happens | Where | Seen by | Criticality |
|----|--------------|-------|---------|-------------|
| F1 | No price, privacy, terms or maker link; /privacy, /terms, /pricing redirect to sign-in | /signin | U1 | 🔴 High |
| F2 | Nothing on stored teen data, AI training or account deletion | /signin | U1 | 🔴 High |
| F3 | Email or Google login asked with no price or reason given | /signin right panel | U1 | 🟠 Medium |
| F4 | "Listens" and "knows about you" read as monitoring to a parent | /signin left panel | U1 | 🟡 Low |

## 💭 How they felt
| User | Result | Start → end | Turning point | In their words |
|------|--------|-------------|---------------|----------------|
| U1 · Parent of 9th grader | ⛔ Gave up (step 1) | 😟 → 😤 | Step 1 · /signin, no links found | "I'm not typing my email or letting her log in with Google." |

## 🧭 Friction map
| Screen | U1 |
|--------|----|
| Sign-in page /signin | ⛔ |

🟢 clear · 🟡 hesitated · 🔴 confused · ⛔ gave up · — didn't reach

## ✅ What works (don't touch)
| What | Seen by |
|------|---------|
| Left panel explains what Tangent does in plain words | U1 |
| Sign in / Create account split is clear | U1 |

---
**👤 Users:** [U1 · Parent evaluating for a 9th grader](simulation/results/2026-11-18-dana-whitfield-p1r.md)
**📄 Reports:** none besides the user report (single user, no heuristic review).
