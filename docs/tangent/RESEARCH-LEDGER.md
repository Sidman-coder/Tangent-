# TANGENT Research Ledger

Last reviewed: 2026-11-03

This ledger stores durable external findings that can change TANGENT decisions. It is not a scratchpad, link dump, or substitute for the Project brief.

## Entry schema

Every entry must contain:

- **Claim:** One falsifiable statement.
- **Status:** Verified, Partially verified, Disputed, Superseded, or Hypothesis. Use Hypothesis for a modeled or untested estimate that no external source establishes.
- **Evidence:** The specific evidence supporting or challenging the claim.
- **Source:** A direct link to the primary source when available.
- **Checked:** The date the source and claim were checked.
- **Confidence:** High, Medium, or Low, with a short reason.
- **Implication:** What the finding changes—or does not change—for TANGENT.

Keep facts separate from interpretation. Use multiple entries when one source supports several distinct claims. Add secondary sources only when primary evidence is unavailable, and label that limitation. Replace stale entries by marking them Superseded and linking the newer entry.

## Active claims

### Freemium conversion

- **Claim:** Freemium apps convert about 2.0–2.4% of downloads to paid by day 35.
- **Status:** Verified
- **Evidence:** State of Subscription Apps 2026 gives a freemium day-35 median of 2.1% (top quartile above 4.5%) and a global median of 2.0%. The 2.4% upper end is the Asia-Pacific regional median, not a freemium figure.
- **Source:** [RevenueCat, State of Subscription Apps 2026](https://www.revenuecat.com/report)
- **Checked:** 2026-11-03
- **Confidence:** High. Primary report; use 2.1% when a single freemium figure is needed.
- **Implication:** Sign-up volume has to carry revenue. A small pilot can't measure conversion reliably.

### Education pricing and renewal

- **Claim:** Education apps have a median price of $9.99 per month and $44.99 per year, with first renewal rates of about 56% for monthly and 24% for annual plans.
- **Status:** Verified
- **Evidence:** The Education report states the $9.99 monthly and $44.99 yearly medians. RevenueCat's renewal article gives Education first-renewal medians of 56% monthly (quartiles 48–66%) and 24% annual (quartiles 17–32%). Its collection dates aren't stated; it was last updated 2026-04-24.
- **Source:** [RevenueCat, Education report](https://www.revenuecat.com/state-of-subscription-apps-2026-education); [RevenueCat, renewal rates by category](https://revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category)
- **Checked:** 2026-11-03
- **Confidence:** High. Primary source.
- **Implication:** $4.99 and $39 sit below the category median. Annual plans lock in revenue but renew far less often, so a year-one annual sale can't be counted as recurring.

### AI app revenue and churn

- **Claim:** AI-powered apps earn about 41% more per payer but churn about 30% faster than non-AI apps.
- **Status:** Verified
- **Evidence:** RevenueCat's key insights state both figures, "per payer" rather than "per user". PPC Land's secondary report adds year-one realized LTV per payer of $30.16 versus $21.37, and 12-month retention of 6.1% versus 9.5% on monthly plans and 21.1% versus 30.7% on annual plans. RevenueCat's definition of "30% faster" wasn't visible on the page checked.
- **Source:** [RevenueCat, State of Subscription Apps 2026](https://www.revenuecat.com/report); [PPC Land (secondary)](https://ppc.land/ai-apps-earn-41-more-per-user-but-churn-30-faster-revenuecat-finds/)
- **Checked:** 2026-11-03
- **Confidence:** Medium. The headline figures are primary; the breakdown is secondary and the churn definition is unconfirmed.
- **Implication:** Follow-through has to justify staying after month one. AI output alone doesn't hold subscribers.

### Education app retention

- **Claim:** Education apps have a day-7 return rate of about 17.8% and a day-30 return rate of about 8.0%.
- **Status:** Partially verified
- **Evidence:** Stream reports 17.76% and 8.02%, attributing them to OneSignal benchmarks published in 2024. The original OneSignal benchmark wasn't checked.
- **Source:** [Stream, app retention guide](https://getstream.io/blog/app-retention-guide)
- **Checked:** 2026-11-03
- **Confidence:** Medium. Aggregated secondary source using 2024 data.
- **Implication:** Gives the 14-day pilot a rough baseline. Treat it as a reference point, not a target.

### Seasonality

- **Claim:** Student apps are nearly dormant in summer and spike at back-to-school.
- **Status:** Verified
- **Evidence:** OneSignal describes "a summer of near-total dormancy" but gives no June–August figures. Its 2025 Education data shows click-through of about 0.4–0.6% from January to May and about 0.9–1.2% from September through December.
- **Source:** [OneSignal, back to school](https://onesignal.com/blog/back-to-school-isnt-just-for-retail-apps/)
- **Checked:** 2026-11-03
- **Confidence:** Medium. The dormancy is a vendor's description; only the fall rise is quantified.
- **Implication:** Monthly plans will likely lapse over summer. This supports a School-Year Pass and a back-to-school push.

### Pricing simulation

- **Claim:** In a simulation calibrated to the claims above, a $4.99/$9.99/$69-pass ladder with annual pre-selected performs best. $9.99-only roughly breaks even over 24 months; free Canvas import, free re-plan and reliable nudges raise active users about 30%; sign-ups (creators, ambassadors) and conversion matter far more than price changes; unlimited free AI plans lose money.
- **Status:** Hypothesis
- **Evidence:** A MiroFish-style simulation supplied by the user. The model and its inputs aren't in this repository and weren't reviewed.
- **Source:** User-supplied simulation; no public source.
- **Checked:** 2026-11-03
- **Confidence:** Low–Medium. Simulation, not real users.
- **Implication:** Directional input for pricing only. Replace with pilot data.

## Superseded claims

No superseded claims have been recorded yet.
