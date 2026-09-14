# Discovery Brief: PALADIN account research for a small outbound team

Status: written before any code on the `fde-vertical-slice` branch. The customer below is fictional. It is a composite used to force concrete requirements. Every number in this document is an assumption and is labeled as one. Measured numbers live only in `docs/EVAL_RESULTS.md`.

## Customer

"Northbeam Ops" (fictional), a roughly 25-person B2B SaaS company selling workflow software to mid-market operations teams. The go-to-market team is one sales lead, 2 account executives, and 4 SDRs. RevOps is a part-time responsibility of the sales lead. They use HubSpot as the CRM and import accounts by CSV.

## Current workflow

1. The sales lead exports a target account list (company name, domain) from a list tool or a spreadsheet as CSV.
2. Each SDR takes a slice of the list. For each account the SDR opens the company website, skims the About, Product, and Careers pages, maybe searches the news, and writes a two-line note plus a personalized first line.
3. The SDR pastes notes into a spreadsheet, and someone later imports it into HubSpot.

Assumption (not measured): an SDR spends about 20 minutes researching each account before first touch and handles about 40 new accounts per week. That is roughly 13 hours per SDR per week, or about 53 SDR hours per week across the team, on research alone.

## Pain

- Research is shallow or skipped when the week is busy. The note becomes "saw you are growing".
- First lines invent facts about the prospect ("congrats on the Series B" when there was none). This is the failure that burns accounts.
- Nothing is traceable. Nobody can tell where a claim in the CRM came from or when it was true.
- The CRM gets junk: duplicate companies from re-imported lists, stale notes, inconsistent fields.

## Systems

- Input: account list CSV export (company name + domain).
- Sources: the company's own website, the public web.
- Optional paid providers the team may buy later: Apollo (firmographics), Tavily (search API).
- Output: HubSpot company CSV import.

## Constraints

- No invented facts about a prospect. Every claim that reaches a human must point to a source URL and a quote that actually appears in the fetched source.
- A human approves anything before it reaches the CRM. Nothing is written or exported without an approval decision recorded with who and when.
- Sites are flaky: timeouts, 403s, bot walls, huge pages. Search APIs rate limit. One bad account must not kill a batch.
- Re-running a list must not duplicate accounts.
- Cost must be visible per account.

## Success metrics

1. Unsupported-claim rate in briefs: share of claims in a drafted brief that are not backed by an extracted fact whose quote appears in the source text. Target: 0 after validation, and the pre-validation rate is reported so the value of validation is visible.
2. Fact accuracy against a hand-labeled set: precision and recall of extracted facts (industry, what they sell, HQ, hiring page present).
3. Minutes per account: wall-clock pipeline latency per account (p50, p95) plus human review time. Review time is not measured in this slice.
4. Stability: the ICP score for the same facts must be identical across reruns.

## Non-goals, with reasons

- No sending email. Deliverability and consent risk (CAN-SPAM, GDPR) belong to a sequencing tool the team already controls, with a human pressing send.
- No scraping personal contact data. Names, emails, and phone numbers of individuals carry privacy and legal risk and are not needed for account-level research.
- No auto-writing to the CRM without approval. The CRM is the system of record, junk there is expensive to clean, and the team explicitly wants a human gate.
- No lead scoring by the model. The ICP score must be explainable and stable, so it is computed in code from a config file.
