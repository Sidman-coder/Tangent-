# TANGENT Operating Contract

## Project authority

- Treat `docs/tangent/PROJECT.md` as the source of truth for TANGENT's product, current state, constraints, roadmap, and open questions.
- Use `CONTEXT.md` for canonical TANGENT terminology.
- Use `docs/tangent/RESEARCH-LEDGER.md` for durable external claims and `docs/tangent/COUNCIL.md` for consequential decision reviews.
- Prefer the most recent user-confirmed information when sources conflict; record unresolved conflicts instead of silently choosing.

## Context routing

- Product, strategy, hardware, marketing, funding, or presentation work: read `docs/tangent/PROJECT.md` first.
- Terminology or domain-model work: also read `CONTEXT.md`.
- Competitor, market, grant, trend, pricing, legal, or other time-sensitive work: also read `docs/tangent/RESEARCH-LEDGER.md` and verify the current facts.
- Material decisions: read and follow `docs/tangent/COUNCIL.md` before recommending commitment.
- Routine implementation and easily reversible choices: work directly without a Council Review.

## Research discipline

- Separate verified facts, user statements, inferences, and hypotheses.
- For unstable or consequential claims, use current primary sources when available and cite the page supporting each claim.
- Record only durable, decision-relevant findings in the Research Ledger, including the date checked and confidence.
- State what evidence would change a recommendation.

## Council trigger

Use a Council Review for decisions that materially affect target users, positioning, product scope, roadmap order, architecture, hardware, privacy, integrations, funding strategy, business model, external reputation, or a costly commitment. Use it whenever the user explicitly requests the Council. Preserve independent reasoning and meaningful dissent.

## Resource Preparation exemption

`TANGENT — Resource Preparation` is a production-only task. It reads approved context and explicitly linked sources, then creates requested deliverables. It does not invoke the Council, spawn agents, conduct open-ended strategy research, revise product decisions, or update the five source-of-truth context files. It flags gaps and conflicts for the head task. It produces proposed schedules but does not publish, send, or schedule externally without an explicit request.

## Source maintenance

- Update `docs/tangent/PROJECT.md` only when product state or strategy is verified by the repository or confirmed by the user.
- Update `CONTEXT.md` when a TANGENT-specific term is resolved or changed.
- Keep one authoritative location per fact; use links rather than duplicated explanations.
- Remove stale claims when replacing them and preserve rationale only when it remains decision-relevant.

## Workspace safety

- Preserve unrelated and pre-existing changes.
- Inspect current code before describing implementation state or editing it.
- Keep credentials, access tokens, private student data, and private calendar or school data out of documentation.
- Research and advice are read-only by default. Modify code, files, external systems, or messages only when the user requests that action.
