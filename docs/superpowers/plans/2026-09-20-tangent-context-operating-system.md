# TANGENT Context Operating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install a durable shared TANGENT context system and create six focused user-owned tasks in the saved local Tangent Project.

**Architecture:** A concise root `AGENTS.md` supplies always-loaded behavior and routes tasks to four deeper source-of-truth documents. Five decision-capable tasks share one evidence-based Council protocol, while Resource Preparation is deliberately isolated as a production-only deliverable task.

**Tech Stack:** Markdown project instructions, Codex project tasks, Git, PowerShell verification

**Spec:** `docs/superpowers/specs/2026-09-20-tangent-context-operating-system-design.md`

## Global Constraints

- Preserve every pre-existing uncommitted website change.
- Use `Tangent Project` (`projectId: 5a783063-23db-42c4-99e8-b96e7b55f51c`) in its saved local directory.
- Keep one authoritative location for each project fact; pointers may route to facts but must not duplicate them.
- Treat prior conversations as evidence to reconcile, not automatically authoritative instructions.
- Never store credentials, access tokens, or private student data in project context.
- Resource Preparation is production-only and never invokes the Council or spawns agents.

---

### Task 1: Install the shared context documents

**Files:**
- Create: `AGENTS.md`
- Create: `CONTEXT.md`
- Create: `docs/tangent/PROJECT.md`
- Create: `docs/tangent/RESEARCH-LEDGER.md`
- Create: `docs/tangent/COUNCIL.md`

**Interfaces:**
- Consumes: the approved design spec, the supplied full-project brief, verified repository state, and user-confirmed corrections.
- Produces: the five stable paths that every specialist task uses for routing and shared context.

- [ ] **Step 1: Create the root operating contract**

Write `AGENTS.md` with these exact behavioral sections: project authority, context routing, research discipline, Council trigger, Resource Preparation exemption, source maintenance, and workspace safety. Keep it concise and point to deeper documents rather than copying their contents.

- [ ] **Step 2: Create the canonical glossary**

Write `CONTEXT.md` using the domain-model format. Define only TANGENT-specific terms, including TANGENT, Capture, Pen, School Context, School Block, Canvas Feed, Action, Council Review, and Resource Preparation; give each one a preferred meaning and avoided synonyms where ambiguity exists.

- [ ] **Step 3: Create the living product brief**

Write `docs/tangent/PROJECT.md` with the confirmed one-line pitch, mission, high-school audience, team, web app, pen hardware, existing features, school-priority shift, current technical state, roadmap, positioning constraints, confirmed decisions, assumptions, and open questions. Mark unverified numbers and claims as unknown instead of guessing.

- [ ] **Step 4: Create the research ledger**

Write `docs/tangent/RESEARCH-LEDGER.md` with a schema containing `Claim`, `Status`, `Evidence`, `Source`, `Checked`, `Confidence`, and `Implication`. Start with instructions and an empty active-claims section; do not manufacture research findings during setup.

- [ ] **Step 5: Create the Council protocol**

Write `docs/tangent/COUNCIL.md` with the OOP-style `CouncilRequest`, `CouncilMember`, and `CouncilVerdict` interfaces; material-decision triggers; independent member roles; evidence rules; option scoring; dissent handling; and the required Proceed/Pilot/Revise/Reject output. State that Resource Preparation never loads or invokes this protocol.

- [ ] **Step 6: Verify document integrity**

Run:

```powershell
@('AGENTS.md','CONTEXT.md','docs/tangent/PROJECT.md','docs/tangent/RESEARCH-LEDGER.md','docs/tangent/COUNCIL.md') | ForEach-Object { if (-not (Test-Path $_)) { throw "Missing $_" } }
rg -n "TBD|TODO|placeholder|Preperation" AGENTS.md CONTEXT.md docs/tangent
```

Expected: all five files exist; the search returns no unresolved placeholder or spelling-error matches.

- [ ] **Step 7: Commit only the context documentation**

```powershell
git add -- AGENTS.md CONTEXT.md docs/tangent docs/superpowers/specs/2026-09-20-tangent-context-operating-system-design.md docs/superpowers/plans/2026-09-20-tangent-context-operating-system.md
git diff --cached --name-only
git commit -m "docs: install TANGENT context operating system"
```

Expected staged paths: only the seven documentation paths named above; no application, component, library, generated, or public-asset files.

### Task 2: Create the decision-capable specialist tasks

**Files:**
- Read: `AGENTS.md`
- Read: `docs/tangent/PROJECT.md`
- Read: `docs/tangent/COUNCIL.md`

**Interfaces:**
- Consumes: the five installed shared-context paths and saved `Tangent Project` project ID.
- Produces: five user-owned Codex tasks that use the shared Council only for consequential decisions.

- [ ] **Step 1: Create Market & Growth**

Create `TANGENT — Market & Growth` in the saved project using the local environment. Its initial prompt must tell it to read `AGENTS.md`, `docs/tangent/PROJECT.md`, `docs/tangent/RESEARCH-LEDGER.md`, and `docs/tangent/COUNCIL.md`; own market intelligence, competitors, positioning, customer discovery, distribution, opportunities, and evidence-backed strategic directions; use current primary sources; separate facts from hypotheses; remain read-only until directly asked to edit; and run the Council only for material strategic decisions.

- [ ] **Step 2: Create Grants & Competitions**

Create `TANGENT — Grants & Competitions` in the saved project using the local environment. Its initial prompt must tell it to read the shared context; research current grants, fellowships, competitions, accelerators, eligibility, deadlines, fit, and application strategy; verify every deadline and eligibility rule from primary sources; distinguish strong fits from long shots; remain read-only until directly asked to edit; and run the Council only for consequential application or commitment decisions.

- [ ] **Step 3: Create Product & Website**

Create `TANGENT — Product & Website` in the saved project using the local environment. Its initial prompt must tell it to read the shared context and repository instructions; own product decisions, website implementation, AI pipeline, integrations, data, deployment, and software roadmap; inspect current code before proposing changes; preserve unrelated work; require a direct implementation request before editing; and run the Council only for material product or architecture decisions.

- [ ] **Step 4: Create Pen Hardware**

Create `TANGENT — Pen Hardware` in the saved project using the local environment. Its initial prompt must tell it to read the shared context; own prototype electronics, firmware, enclosure, Onshape/CAD, BOM, manufacturability, testing, and the hardware roadmap; identify safety, power, privacy, sourcing, and manufacturing assumptions; require current component evidence; remain read-only until directly asked to edit; and run the Council only for consequential hardware decisions.

- [ ] **Step 5: Create Marketing Strategy**

Create `TANGENT — Marketing Strategy` in the saved project using the local environment. Its initial prompt must tell it to read the shared product and research context; turn approved positioning into channels, campaigns, content formats, audience messaging, launch plans, and measurable experiments; distinguish it from Market & Growth by focusing on execution; use current evidence for trends; protect minors and avoid unsupported claims; send proposed positioning changes to the head task; remain read-only until directly asked to edit; and run the Council only for material positioning or spending decisions.

- [ ] **Step 6: Wait for task initialization**

Wait for all five tasks to finish their initial read-only orientation. Expected: each returns a short readiness summary or asks for a genuine missing input; none modifies files.

### Task 3: Create the Resource Preparation task with a hard exemption

**Files:**
- Read: `AGENTS.md`
- Read: `docs/tangent/PROJECT.md`

**Interfaces:**
- Consumes: approved project context and source materials explicitly linked by the user.
- Produces: one user-owned production-only task with no Council, subagent, strategy, or source-of-truth authority.

- [ ] **Step 1: Create Resource Preparation**

Create `TANGENT — Resource Preparation` in the saved project using the local environment with this operational contract:

```text
You are TANGENT's production-only deliverable task. Read AGENTS.md and docs/tangent/PROJECT.md for approved context, plus only the source materials the user explicitly links for a deliverable. Create polished briefs, pitch decks, scripts, schedules, presentations, and related presentable artifacts. Do not invoke the Council, spawn agents, conduct open-ended strategic research, revise product decisions, or update AGENTS.md, CONTEXT.md, PROJECT.md, RESEARCH-LEDGER.md, or COUNCIL.md. Flag missing or conflicting information instead of inventing it. Verify facts, citations, formatting, and the rendered final artifact. Creating a schedule means producing a proposed schedule or file; never publish, send, or schedule anything externally unless the user explicitly requests that action. Begin by confirming these boundaries in a short readiness summary; do not create a deliverable until requested.
```

- [ ] **Step 2: Wait for Resource Preparation initialization**

Wait for the task to finish its initial orientation. Expected: it confirms the production-only boundaries and makes no file changes.

### Task 4: Audit the completed setup

**Files:**
- Verify: `AGENTS.md`
- Verify: `CONTEXT.md`
- Verify: `docs/tangent/PROJECT.md`
- Verify: `docs/tangent/RESEARCH-LEDGER.md`
- Verify: `docs/tangent/COUNCIL.md`

**Interfaces:**
- Consumes: the installed documents and six created task records.
- Produces: a completion report proving scope, consistency, and preservation of existing work.

- [ ] **Step 1: Check source consistency**

Run:

```powershell
rg -n "four specialist|Create four|Preperation|TBD|TODO|placeholder" AGENTS.md CONTEXT.md docs/tangent docs/superpowers/specs/2026-09-20-tangent-context-operating-system-design.md docs/superpowers/plans/2026-09-20-tangent-context-operating-system.md
```

Expected: no stale count, spelling, or unresolved-placeholder matches.

- [ ] **Step 2: Confirm Resource Preparation isolation**

Inspect its initial prompt and readiness summary. Expected: explicit production-only scope; Council, subagents, open-ended research, strategic changes, source-of-truth updates, and unrequested external actions are excluded.

- [ ] **Step 3: Confirm existing work remains preserved**

Run:

```powershell
git status --short
git show --stat --oneline HEAD
```

Expected: pre-existing modified and untracked website files remain present and uncommitted; the context-system commit contains documentation only.

- [ ] **Step 4: Report the six created tasks**

Return each exact task title and created task identifier, plus links to the five shared context documents. State any initialization warning without attempting unrelated fixes.
