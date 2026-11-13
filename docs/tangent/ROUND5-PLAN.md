# Round 5 plan (backlog started during Round 4)

Fixes and follow-ups to build after Round 4 ships. Round 4 progress lives in `docs/tangent/ROUND4-PLAN.md`; the context engine spec is `docs/tangent/CONTEXT-ENGINE.md`.

## Contents

1. [Commitment: basic onboarding before sign-in](#1-commitment-basic-onboarding-before-sign-in)
2. [Research: the under-13 age gate and why Round 4's version is temporary](#2-research-the-under-13-age-gate)

---

## 1. Commitment: basic onboarding before sign-in

**Decided by the user on 2026-11-08.**

Once the separate landing page exists, the order a new student goes through becomes:

1. **Landing page** → "Get started".
2. **Basic onboarding, before any account exists.** A few light screens that need no sign-in. At minimum this includes the **age check**. It may also include first name and the starting goal, so the product feels personal before the student commits.
3. **Sign in / create account.** Only students who passed the age check reach this step.
4. **Real onboarding**, signed in: the deeper Round 4 questions (commitments, what matters, what slips, how your brain works, what you're building toward, how to push).

What carries across the sign-in step: the basic answers are held in the browser only (for example `sessionStorage`), never sent to the server before the account exists. They are saved once the account is created, then cleared. Under-13s never send anything to the server.

Why: it puts the age check before the account is created, which is what the spec asks for (see section 2). It also lets students see that Tangent "gets them" before they hand over an email.

Work for Round 5:

- Basic onboarding screens on the public side (no session), reachable from the landing page's "Get started".
- Move the age question there; the in-app age screen from Round 4 stays as a fallback for anyone who reaches sign-in another way (Google, an old link).
- Carry the basic answers through sign-in and save them as `said` facts on the first signed-in load.
- Remove anything Round 4 had to store to keep an under-13 account blocked (see 2.4).
- Update `middleware.ts` public paths for the new pages, and the access tests.

---

## 2. Research: the under-13 age gate

This is the full write-up from the Round 4 Phase 0 discussion (2026-11-08). It is not legal advice.

### 2.1 What the spec says and where the conflict comes from

- `docs/tangent/CONTEXT-ENGINE.md` (Part 2 of the Round 4 report), "Privacy and safety for teens": **"Age gate: ask age in onboarding. Under 13: don't create the account (US COPPA rules). Show a friendly message."**
- The Round 4 master prompt, Phase 1.2: "collect age (or birth year) during **onboarding**, not sign-up. Under 13 → a friendly 'Tangent is for students 13 and up' screen. Don't store more than needed."
- COPPA (the US Children's Online Privacy Protection Act) puts strict rules on collecting personal information from children under 13, including needing verifiable parental consent. An email address counts as personal information.

The conflict is about **order**. Today, onboarding (`components/FirstRun.tsx`, `app/api/onboarding`) only runs **after** sign-in. By the time a student says they are 12, a Supabase auth user already exists, with their email stored. So "don't create the account" cannot be met by an onboarding-time question: the account is already created. The only question left is what to do with it.

### 2.2 The options

| Option | What happens | Downside |
|---|---|---|
| **A. Delete the account** | Friendly screen; a server route deletes the auth user with the service-role key (server-only) and signs them out. Nothing kept. | They can sign up again and lie. Every self-reported age gate has this. Deleting accounts needs care (it must only ever delete the caller's own, brand-new account). |
| **B. Keep it, blocked** | Friendly screen; the account stays, marked as under 13, and every page and API is blocked. | We hold a child's email (and some marker of their age), which is exactly what COPPA is about. |
| **C. Ask age at sign-up** | The account is never created for under-13s. | Goes against the Round 4 prompt (age in onboarding, not sign-up) and adds a field to sign-up. |

Recommendation at the time: **A**, because it matches the spec's intent with the least data kept.

### 2.3 What the user chose for Round 4

**Keep it as the master prompt says for now (option B in practice).** The age question stays in onboarding; under 13 shows the friendly "Tangent is for students 13 and up" screen and the student cannot go further. The proper fix is the flow in section 1, where age is asked **before** sign-in, so the account is never created. That is effectively option C, but without crowding the sign-up form.

### 2.4 What may go wrong with the Round 4 approach, and why it's wrong

1. **The account still exists.** A child's email sits in Supabase Auth. This is the core thing the spec says to avoid, and it is the main reason this is temporary.
2. **We have to store something to keep blocking them.** If nothing is stored, the next visit shows onboarding again and they can just pick an older age. So Round 4 must keep a marker. To keep it minimal, store only a yes/no "under 13" flag (not the birth year or age). Even a flag tied to an email is personal information about a child.
3. **Lie-and-retry.** A student who sees the stop screen can redo onboarding in another browser or with another email and pick a different year. Self-reported age gates can't prevent this; the aim is to not knowingly collect a child's data. Asking with a neutral picker (birth year, no hint that 13 is the cutoff) reduces nudging. Re-asking after a "too young" answer does the opposite, so the stop screen must not offer "change my answer".
4. **Google sign-in.** Google creates the account immediately with name and email, so the same problem applies and the same block must cover it.
5. **Blocked account still has a valid session.** Like the waitlist, a blocked under-13 user holds a Supabase token. RLS limits them to their own rows, but middleware must treat "under 13" like "not invited": every page goes to the stop screen, every API returns 403, `/dev/*` included.
6. **Other data could slip in before the age question.** Anything collected before the age screen (first name, the starting goal, chat) would be stored for a child. So in Round 4 the age question must be on the **first** onboarding screen, and nothing earlier should be saved.
7. **Waitlist and age gate interact.** An under-13 student whose email isn't invited lands on the waitlist and may never see the age question. Fine for now (they can't use the app), but the Round 5 flow fixes it by asking age first.
8. **No deletion path.** With option B, nothing ever removes these accounts. Round 5 should add either automatic cleanup of blocked under-13 accounts or move fully to the pre-sign-in age check and delete the leftovers once.
9. **Schools.** If Tangent ever pilots with schools, FERPA and school-specific consent rules apply. Get advice before any school pilot.

### 2.5 Evidence that would change this

- Legal advice saying a blocked account with only a flag is acceptable → B could stay.
- Legal advice saying any account creation before the age check is a problem → section 1 becomes urgent, ahead of other Round 5 work.
- Data showing many sign-ups hitting the under-13 screen → prioritise the cleanup in 2.4 item 8.
