# TANGENT Council Protocol

The Council is a decision mechanism for consequential TANGENT choices. It is not a standing meeting, a generic brainstorming format, or a reason to slow routine work.

## Invocation boundary

Run a Council Review when a choice materially affects target users, positioning, product scope, roadmap order, architecture, hardware, privacy, integrations, funding strategy, business model, external reputation, or another costly or difficult-to-reverse commitment. Run it whenever the user explicitly asks for the Council.

Skip the Council for routine coding, copy edits, minor visual changes, ordinary planning, and easily reversible experiments.

**Hard exemption:** `TANGENT — Resource Preparation` never reads, invokes, or simulates the Council. It sends strategic questions or conflicting source material back to the head task.

## Prompting interfaces

### `CouncilRequest`

```text
decision: one decision stated as a question
stakes: what becomes costly, risky, or constrained
options: the real choices, including "do nothing" when valid
constraints: time, money, people, technology, privacy, and commitments
success_criteria: observable conditions for a good choice
known_evidence: verified facts with sources
unknowns: missing evidence that could change the verdict
decision_date: when a commitment is actually needed
```

### `CouncilMember`

```text
role: assigned independent perspective
thesis: direct answer to the decision
evidence: sourced facts and clearly labeled inferences
success_path: how and why the option could work
failure_modes: concrete ways it could fail
assumptions: beliefs the thesis depends on
recommendation: option and required changes
confidence: 0-100 with the reason for uncertainty
disconfirming_evidence: what would change the recommendation
```

### `CouncilVerdict`

```text
verdict: Proceed | Pilot | Revise | Reject
recommended_option: the chosen option or experiment
rationale: decisive evidence and reasoning
dissent: material disagreement preserved accurately
scorecard: evidence, desirability, feasibility, defensibility, distribution, risk
required_changes: conditions before commitment
failure_modes: prioritized risks and early warning signs
kill_criteria: observable reasons to stop
next_experiment: cheapest test that reduces the largest uncertainty
confidence: 0-100 with remaining unknowns
```

## Independent members

Every full Council uses these perspectives:

1. **Student Value:** repeated problem intensity, workflow fit, adoption friction, and harms to the student.
2. **Market and Distribution:** alternatives, competitors, buyer, reach, timing, and channel reality.
3. **Technical and Hardware Feasibility:** engineering complexity, reliability, dependencies, privacy, safety, cost, and sequencing.
4. **Business and Defensibility:** willingness to pay, economics, differentiation, copying risk, and durable advantage.
5. **Skeptical Pre-mortem:** assumes the decision failed and identifies the most plausible causal chain, ignored evidence, and exit signals.

Add a specialist only when the decision genuinely needs one, such as education policy, privacy law, manufacturing, or grant eligibility.

## Independence protocol

When independent agents are available, give each member the same `CouncilRequest` and shared evidence, without other members' conclusions. Collect every report before synthesis. Members may research their assigned uncertainties, but each sourced fact must be distinguishable from inference.

Call the result a **full Council** only when the members reasoned independently. If independent agents are unavailable, provide a clearly labeled **single-model structured review** rather than implying independent consensus.

## Research standard

- Verify unstable and consequential claims at decision time.
- Prefer primary sources: official product documentation, program rules, original research, public filings, and direct competitor materials.
- Use independent evidence for demand and outcomes; a competitor's marketing establishes its claim, not that the claim is true.
- Include dates and direct links near the claims they support.
- State when evidence is absent, weak, conflicting, or too old.
- Record durable findings in `RESEARCH-LEDGER.md` after the user accepts the synthesis or asks to preserve them.

## Scorecard

Score every option from 1 to 5:

- **Evidence:** quality and relevance of support.
- **Desirability:** strength and frequency of student value.
- **Feasibility:** ability to deliver reliably with current resources.
- **Defensibility:** resistance to substitution or easy copying.
- **Distribution:** credible path to adoption by students or buyers.
- **Risk:** privacy, safety, technical, financial, and reputational exposure; 5 means highest risk.

Scores organize judgment but never replace the underlying evidence. Explain the two scores that most strongly drive the verdict.

## Synthesis procedure

1. Freeze one `CouncilRequest`; do not let members answer different questions.
2. Collect independent member reports.
3. Challenge unsupported claims and resolve factual disagreements with research when practical.
4. Compare options using the scorecard and success criteria.
5. Preserve dissent that depends on a real uncertainty or tradeoff.
6. Issue one `CouncilVerdict` with required changes, kill criteria, and the cheapest next experiment.
7. Ask for commitment only when the verdict requires a material action; otherwise run the reversible experiment.
