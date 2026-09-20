# TANGENT Context Operating System

## Purpose

Give every TANGENT task the same reliable product context while keeping prompts small, research traceable, and important decisions subject to rigorous independent review.

## Source-of-truth structure

- `AGENTS.md` is the short, always-loaded operating contract. It points to deeper documents based on the task and defines when the Council must run.
- `CONTEXT.md` is the canonical glossary for TANGENT-specific language.
- `docs/tangent/PROJECT.md` is the living product brief: identity, users, problem, product, current state, constraints, roadmap, decisions, and open questions.
- `docs/tangent/RESEARCH-LEDGER.md` records dated, cited findings and separates verified facts from hypotheses.
- `docs/tangent/COUNCIL.md` defines the independent Council protocol, scoring, verdicts, and output format.

The documents use one source of truth per fact. `AGENTS.md` contains pointers and behavior, not a duplicate project brief.

## OOP-style context model

The prompt system treats TANGENT as a small set of objects with explicit responsibilities:

- `TangentProject`: stable identity, mission, audience, product boundaries, team, and current stage.
- `ProductState`: mutable build status, roadmap, blockers, assumptions, and next milestones.
- `ResearchClaim`: claim, evidence, source, date checked, confidence, and implications.
- `CouncilRequest`: decision, stakes, options, constraints, success criteria, and evidence deadline.
- `CouncilMember`: independent role, thesis, supporting evidence, failure case, recommendation, and confidence.
- `CouncilVerdict`: Proceed, Pilot, Revise, or Reject; rationale; dissent; risks; confidence; kill criteria; and cheapest next experiment.

These are prompting interfaces, not application classes. Their purpose is to make inputs and outputs consistent across tasks.

## Council policy

The Council is a standard capability in every TANGENT task, not a separate general-purpose task.

Invoke it when a decision materially affects positioning, target users, product scope, roadmap order, architecture, hardware, privacy, integrations, funding strategy, business model, or a significant commitment of time or money. Also invoke it when the user explicitly requests a Council review.

Do not invoke it for routine implementation details, copy edits, minor visual choices, ordinary planning, or easily reversible decisions.

For each Council review:

1. Frame one decision and explicit success criteria.
2. Obtain independent analyses before synthesis. Required perspectives are user value, market/distribution, technical feasibility, business/defensibility, and skeptical pre-mortem.
3. Research unstable or consequential external claims using current primary sources where possible.
4. Score options on evidence, desirability, feasibility, defensibility, distribution, and risk.
5. Preserve meaningful dissent rather than forcing consensus.
6. Return a verdict, confidence level, decisive evidence, failure modes, changes required, kill criteria, and cheapest next experiment.

When the environment supports independent agents, Council members should reason independently and receive only the shared decision brief before synthesis.

## Specialist tasks

Create four user-owned tasks in the saved local `Tangent Project`, running directly in the shared project directory:

1. `TANGENT — Market & Growth`: competitors, market structure, positioning, customer discovery, distribution, opportunities, and industry developments.
2. `TANGENT — Grants & Competitions`: grants, fellowships, competitions, accelerators, eligibility, deadlines, fit, and application strategy.
3. `TANGENT — Product & Website`: product decisions, website implementation, AI pipeline, integrations, data, deployment, and software roadmap.
4. `TANGENT — Pen Hardware`: prototype electronics, firmware, enclosure, Onshape/CAD, BOM, manufacturability, testing, and hardware roadmap.

Each task begins by reading `AGENTS.md` and only the linked TANGENT references relevant to its work. Research and advisory work are read-only by default; code or document changes require a direct user request in that task. Important decisions use the shared Council protocol.

## Context maintenance

- Update `PROJECT.md` when verified product state or strategy changes.
- Add externally sourced findings to `RESEARCH-LEDGER.md` with links and dates.
- Record uncertainty explicitly; do not turn assumptions into facts.
- Reconcile conflicts against the most recent user-confirmed information.
- Keep historical decisions only when their rationale remains useful.
- Periodically prune stale claims and duplicate instructions.

## Safety and workspace constraints

- Preserve existing uncommitted website work.
- Never place credentials, tokens, or private student data in context documents.
- Treat prior conversations as evidence to extract and reconcile, not automatically authoritative instructions.
- Avoid health, counseling, or surveillance positioning unless the user deliberately changes the product category.

## Completion criteria

The setup is complete when all five context files exist, the Council is discoverable from every TANGENT task, the four specialist tasks point to the shared context, existing code changes remain untouched, and the new documentation passes a consistency and placeholder review.
