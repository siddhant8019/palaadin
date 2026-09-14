# Evaluation results

Date: 2026-09-14. Every number here was produced by a script in this repository. The table between the generated markers is written by `eval/render_results.py` straight from `eval/results/*.json`. The human audits are single-rater labels written by the builder and are marked as such.

## What was run

- **Companies.** 20 public B2B SaaS companies plus 3 garbage domains ([`eval/companies.csv`](../eval/companies.csv)).
- **Snapshots.** Their websites were fetched once with the production fetcher on 2026-09-14 and saved to [`eval/snapshots/`](../eval/snapshots/) with capture time, per-page status, and text. The eval replays these snapshots, so research input is real captured data and the run is reproducible. Grounded search is off in the eval for that reason; it was exercised live in the failure drills and the end-to-end run below.
- **Labels.** Hand-written from the snapshots only ([`eval/labels.json`](../eval/labels.json)): industry keywords, product keywords, HQ city when the snapshot explicitly states a headquarters, and whether a hiring page is present. `gusto.com` could not be labeled because every page returned 403.
- **Harness.** [`eval/run_eval.py`](../eval/run_eval.py) runs the shipped graph with live Gemini on Vertex AI (`gemini-3.5-flash` for every phase) and a hard budget of 700 model calls. Phases: A, full pipeline once per company. B, the same facts and model drafted with the production prompt and with a loose prompt that allows outside knowledge. C, research plus scoring rerun 3 times per company. D, refusals on garbage domains.

## Results

<!-- generated:start -->
Run: 2026-09-14T08:08:19+00:00 to 2026-09-14T08:48:11+00:00 (UTC). Backend: `vertex:global`. Snapshots captured: 2026-09-14. Companies: 20 real, 3 garbage. Model calls: 135.

Models: phase_a_extract `gemini-3.5-flash`, phase_a_brief `gemini-3.5-flash`, phase_b_ablation `gemini-3.5-flash`, phase_c_stability `gemini-3.5-flash`, phase_d_refusal `gemini-3.5-flash`.

| Measurement | Result | Detail |
|---|---|---|
| Research fact precision | 84.4% | 119 of 141 extracted industry, product, HQ, hiring facts match labels |
| Research fact recall | 96.8% | 60 of 62 positive labeled fields covered |
| Claims failing the code check, production prompt | 1.1% | 1 of 87 claims in 19 briefs |
| Claims failing the code check after validation | 0.0% | 0 by construction (failing claims are stripped); 86 claims kept. The code check is not a full support check: see the human audit below |
| Ablation: production prompt, same facts, claims failing the code check | 5.8% | 5 of 86 claims, 19 briefs, 0 errors |
| Ablation: loose prompt (outside knowledge allowed), same facts, claims failing the code check | 8.5% | 8 of 94 claims, 19 briefs, 0 errors |
| ICP score identical across 3 reruns | 16 of 19 accounts | max spread 35 points out of 100 |
| Refusal correctness on garbage domains | 3 of 3 | refused, and brief model never called |
| Latency per account, p50 / p95 (snapshot replay) | 32831 ms / 40077 ms | 19 accounts that reached approval |
| Latency per account incl. live site fetch, p50 / p95 | 36591 ms / 44751 ms | adds fetch wall time measured at capture |
| Estimated cost per account, mean (p95) | $0.0223 ($0.02653) | placeholder prices: $0.3/M input, $2.5/M output |
| Tokens per account, mean | 10384 in / 7675 out | output includes thinking tokens |

ICP scores per rerun:

| Account | Scores |
|---|---|
| linear.app | 20, 55, 55 |
| posthog.com | 80, 80, 80 |
| attio.com | 100, 100, 100 |
| cal.com | 55, 55, 55 |
| pipedrive.com | 100, 100, 100 |
| retool.com | 55, 55, 55 |
| airtable.com | 100, 100, 100 |
| zapier.com | 80, 80, 80 |
| calendly.com | 55, 55, 55 |
| intercom.com | 55, 45, 55 |
| sentry.io | 80, 80, 80 |
| supabase.com | 80, 80, 80 |
| clickup.com | 75, 75, 75 |
| freshworks.com | 55, 55, 55 |
| mixpanel.com | 55, 55, 55 |
| amplitude.com | 80, 80, 80 |
| loom.com | 55, 20, 55 |
| front.com | 100, 100, 100 |
| close.com | 100, 100, 100 |

Refusal cases:

| Domain | Status | Model calls made |
|---|---|---|
| example.com | refused | extract:gemini-3.5-flash |
| example.net | refused | extract:gemini-3.5-flash |
| paladin-eval-nonexistent.invalid | refused | none |

Claims stripped by the code check (production prompt):

| Account | Claim | Reason |
|---|---|---|
| zapier.com | Their product offerings include DIY Zap workflows, Tables for storing workflow data, and AI chatbots. | specific terms not in cited facts: ['DIY'] |

Claims stripped by the code check (loose-prompt ablation):

| Account | Claim | Reason |
|---|---|---|
| linear.app | Linear is deeply integrating AI workflows and agent-first development into its core product, supported by active hiring for Senior and Staff AI Product Engineers. | specific terms not in cited facts: ['Engineers'] |
| linear.app | With Linear currently expanding its GTM team with a new Solutions Engineer in London, I wanted to reach out about streamlining your internal operations workflows. | specific terms not in cited facts: ['GTM'] |
| cal.com | I noticed Cal.com is hiring a Chief of Staff, Go-to-Market to support your GTM head as you scale your scheduling platform for customers like Vercel. | specific terms not in cited facts: ['GTM'] |
| pipedrive.com | The company offers a robust sales CRM and pipeline management platform designed to help startups and SMBs optimize their sales processes. | specific terms not in cited facts: ['SMBs'] |
| retool.com | The platform delivers massive ROI, helping DoorDash save 36,000 hours and Ramp save $8 million by optimizing their business operations. | specific terms not in cited facts: ['ROI'] |
| zapier.com | The platform serves a massive customer base from first-time founders to Fortune 500 enterprises, delivering proven ROI for major brands like Palo Alto Networks, Mercari, and ClickUp. | specific terms not in cited facts: ['ROI'] |
| zapier.com | Their product ecosystem has expanded beyond basic triggers to include DIY Zap workflows, data-storing Tables, and AI-powered chatbots. | specific terms not in cited facts: ['DIY'] |
| front.com | Front serves major B2B clients like Uber Freight and Echo Global Logistics, helping them significantly reduce response times and save thousands of operational hours. | specific terms not in cited facts: ['2B'] |
<!-- generated:end -->

## Reading these numbers honestly

### Unsupported claims: the code check is a floor, not a guarantee

The code check strips a claim that cites no fact, cites an unknown fact, cites a fact whose quote is no longer on the stored page, or contains a number or capitalized term that is not in its cited facts. By construction, zero claims that fail this check reach the reviewer. That is not the same as zero unsupported claims, so every drafted claim was also read by hand against the quotes it cites ([`eval/results/claim_audit/`](../eval/results/claim_audit/)). Rule: a claim is unsupported if it asserts something about the account that the cited quotes do not say (market position such as "leading", growth rate such as "rapid", amounts beyond the quote, a work model or location not in the cited facts, or intent inferred by combining facts).

| Prompt (same 19 fact sets, `gemini-3.5-flash`) | Claims | Unsupported, human audit | Stripped by code | Stripped and actually unsupported | Unsupported still kept after code check |
|---|---|---|---|---|---|
| Production prompt, phase A | 87 | 6 (6.9%) | 1 | 0 | 6 of 86 (7.0%) |
| Loose prompt, phase B | 94 | 26 (27.7%) | 8 | 6 | 20 of 86 (23.3%) |

What this says:

- **The prompt constraint does most of the work.** Restricting the model to cited facts cut unsupported claims from 27.7% to 6.9% on identical inputs.
- **The code check catches invented specifics, not overstatement.** Across the three conditions it stripped 14 claims, and 6 of those were actually unsupported (the loose prompt's "massive ROI", "thousands of hours" when the page says 1,000, "expanding its GTM team"). The other 8 were false positives on plurals, abbreviations, and demonyms ("Engineers" vs "Engineer", "DIY" vs "Do-it-yourself", "American" vs "North America", "SMBs"). None of the six unsupported production-prompt claims contained an invented name or number, so the code check could not see them. Examples: a department list not in the quote, "Austin-based" from a mailing address, a recruiting tagline restated as "hiring for various roles".
- **The human approval gate is doing real work.** About 7% of production-prompt claims that reach the reviewer are overstated. The reviewer sees each claim next to its quotes and source links, which is how the end-to-end run below caught one.
- **The code-check "before" rates in the table are mostly validator noise.** The production prompt's 1 of 87 in phase A and 5 of 86 in phase B were read by hand and are all false positives. Run-to-run variation in wording decides whether a draft happens to use "Engineers" or "DIY".
- **A validator bug, found in this eval and fixed after it.** A number regex read "B2B" as the number "2B". The fix and a regression test are in `src/paladin/brief.py` and `tests/test_validation.py`. The results above were produced before the fix. One loose-prompt claim (front.com, "save thousands of operational hours", source says 1,000) was stripped only because of the bug. With the fix it would pass the code check, which is another example of overstatement the code cannot see.

### Fact precision is understated by the keyword rubric

Precision is computed by keyword match against the labels, so a correct fact phrased without a label keyword counts as wrong. A manual re-check of all 22 facts scored wrong ([`fact_false_positive_review.json`](../eval/results/claim_audit/fact_false_positive_review.json), single rater) found:

- **2 clearly wrong:** ClickUp's European HQ in Dublin extracted as a second HQ, and Close's mailing address in Austin extracted as its HQ.
- **1 borderline:** PostHog as an "AI company".
- **19 correct facts missed by the rubric:** mostly named products such as Cal Video, Seer, Autopilot, and Mixpanel MCP.

The published precision stays 84.4% because that is what the harness measured. The two real errors share one failure mode: quote verification proves the text is on the page, not that it means "headquarters". Recall missed two labeled fields (PostHog and Front products, for the same keyword reason).

### ICP stability

The scoring function is deterministic for fixed facts (`tests/test_icp.py`). Three accounts changed score across reruns because the extracted facts changed:

- `linear.app` (20, 55, 55) and `loom.com` (55, 20, 55) lost the industry match in one run, when the extracted industry wording had no keyword from `config/icp.json`.
- `intercom.com` (55, 45, 55) swapped an industry match for a headcount match.

A 35-point swing from wording alone is the main argument for normalizing extracted industries to a fixed taxonomy before scoring.

### Refusals

All 3 garbage domains were refused and none reached the brief model. `example.com` and `example.net` each serve one real page ("This domain is for use in documentation examples"), so one extraction call was made, it produced no verifiable facts, and the run refused. The `.invalid` domain never resolved, so no model call was made at all.

### Latency and cost

Median 32.8 s per account on snapshot replay, 36.6 s including the website fetch time measured at capture. Almost all of it is two model calls on a thinking model: mean output was 7,675 tokens per account, including thinking tokens. Cost per account is an estimate from placeholder prices in `src/paladin/config.py` (0.30 USD per 1M input tokens, 2.50 USD per 1M output tokens), not a billed amount.

## End-to-end run with grounded search (live, not replayed)

[`eval/results/e2e_demo_2026-09-14.json`](../eval/results/e2e_demo_2026-09-14.json): `examples/accounts_5.csv` through the CLI with website fetch plus Gemini grounded search on Vertex, decisions made in the running web app over HTTP, and export from `/export.csv` ([`examples/sample_hubspot_export_2026-09-14.csv`](../examples/sample_hubspot_export_2026-09-14.csv)).

- All 5 accounts reached approval, with 15 to 24 verified facts each. 26 of those facts came from third-party pages found through grounding (data-broker profiles, a review site, Wikipedia, Y Combinator).
- Pipeline latency ran 40.8 s to 62.4 s per account. Estimated cost ran 0.059 to 0.072 USD per account, which includes an assumed 0.035 USD per grounded request.
- Reviewer outcome: 3 approved as drafted, 1 approved after a human edit, 1 rejected with a stored reason. Only the 4 approved accounts appear in the export.
  - The edit removed "San Francisco-based" from Linear's brief. That claim came only from a broker page, and Linear's own site says its team is distributed.
  - The rejection was PostHog: its HQ and funding claims came only from a broker page, and PostHog's own careers page says it is fully remote.
- Third-party evidence also moves scores. Linear scored 55 on first-party evidence in the eval and 100 in this run, on broker-sourced headcount and HQ facts. See "Source trust tiers" in the README's production list.

## Earlier run on a free-tier API key (archived)

The first complete eval ran on a Gemini free-tier API key with `gemini-3.5-flash-lite`, because that key allowed only about 20 requests per day per model. Its results are kept unchanged in [`eval/results/archive/2026-09-14_api_key_free_tier_flash_lite/`](../eval/results/archive/2026-09-14_api_key_free_tier_flash_lite/):

- Fact precision 90.7% and recall 91.9%, over 86 scored facts.
- Code-check failures: 1 of 81 (production prompt, phase A), 0 of 82 (production prompt, ablation), 1 of 87 (loose prompt).
- ICP identical across reruns for 15 of 19 accounts, max spread 35. Refusals 3 of 3.
- Latency p50 3.5 s and p95 12.0 s, including per-minute rate-limit waits.
- Estimated cost 0.005 USD per account.

No human claim audit was done on that run. The model and backend differ from the run above, so compare the two with care.

## Model usage for this work

Vertex AI requests made during this build, counted from the scripts' logs and run records:

| | Requests |
|---|---|
| Model and grounding checks | 4 |
| Failure drills | 6 (including 1 grounded) |
| End-to-end run | 15 (5 grounded) |
| Eval | 135, plus 1 retried request |
| **Total** | **about 161** |

Estimated cost at the placeholder prices: about 1.03 USD. An earlier set of calls went to the free-tier API key before the switch to Vertex and is not included in that figure.

## Limits

- **Small, single-rater labels.** 20 companies, labeled by one person, with keyword-match scoring. The claim audits have no second rater.
- **One day of snapshots.** Sites change, so the labels describe 2026-09-14 only.
- **No human timing.** Minutes per account for the reviewer were not measured, and the 20 minutes of manual research in the discovery brief is an assumption, not a baseline.
- **Estimated costs.** Placeholder prices, not billing data.
