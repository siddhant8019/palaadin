# Failure engineering

Cases 1 to 5 were triggered for real on 2026-09-14 by `eval/failure_drills.py` against live websites and live Gemini (`gemini-3.5-flash` on Vertex AI). Full captured output: [`eval/results/failure_drills.json`](../eval/results/failure_drills.json). Case 6 was not a drill: it happened during an earlier local end-to-end run, and its log lines are saved in [`eval/results/provider_outage_2026-09-14.jsonl`](../eval/results/provider_outage_2026-09-14.jsonl). Log excerpts below are copied from those files and trimmed for width.

The rule behind all of them: an account that cannot be researched or drafted safely ends in a terminal status with a stored reason (`refused` or `failed`), never in a guess, and never takes the rest of the batch down with it.

## 1. Company site times out or returns 403

**403 (real, not simulated).** `gusto.com` returns HTTP 403 to our bot user agent on every path. With no usable documents the extraction model is never called, and with zero verified facts the brief model is never called either.

```json
{"domain": "gusto.com", "node": "research", "event": "site_fetched", "latency_ms": 791,
 "data": {"robots": "absent (http 403), allow all", "pages": [{"url": "https://gusto.com/", "status": 403, "error": "http 403", "latency_ms": 72}, {"url": "https://gusto.com/about", "status": 403, "error": "http 403", "latency_ms": 65}, "..."]}}
{"domain": "gusto.com", "node": "research", "event": "extract_skipped", "data": {"reason": "no usable source documents"}}
{"domain": "gusto.com", "node": "refuse", "event": "refused", "data": {"reason": "zero verified facts: no brief drafted, no model call made"}}
```

We do not work around bot walls (no user-agent spoofing). The account stays `refused` and can be re-run later.

**Timeout.** A real request to `linear.app` with the fetch budget cut to 50 ms (the only artificial part of this drill is the budget). The homepage times out, the fetcher skips the remaining paths for that site, and the account is refused.

```json
{"domain": "linear.app", "node": "research", "event": "site_fetched", "latency_ms": 232,
 "data": {"robots": "parsed", "pages": [{"url": "https://linear.app/", "status": null, "error": "timeout: ReadTimeout", "latency_ms": 52}, {"url": "https://linear.app", "error": "site unreachable, remaining paths skipped"}]}}
{"domain": "linear.app", "node": "refuse", "event": "refused", "data": {"reason": "zero verified facts: no brief drafted, no model call made"}}
```

Also handled in the fetcher: robots.txt unreachable (5xx or network error) means disallow all, per RFC 9309. Bodies over 2 MB are truncated, and non-HTML content types are skipped.

## 2. Model returns malformed JSON

Injected through the test hook `PALADIN_FAULT_MALFORMED_JSON=brief` with `PALADIN_FAULT_DOMAIN=attio.com`, which corrupts the real Gemini response text for that one account. The client retries once, then raises. The graph routes to `fail` and stores the reason. The next account in the same batch (`close.com`) completes normally.

```json
{"domain": "attio.com", "node": "draft", "event": "malformed_output", "latency_ms": 18672,
 "data": {"error": "attempt 1: malformed JSON: Expecting ',' delimiter: line 10 column 3 (char 397); attempt 2: malformed JSON: Expecting ',' delimiter: line 10 column 3 (char 397)"}}
{"domain": "attio.com", "node": "fail", "event": "failed_closed", "data": {"reason": "brief model returned malformed JSON twice: ..."}}
```

Batch result: `attio.com` `failed`, `close.com` `pending_approval`.

Both attempts show the same corruption offset because the hook corrupts every attempt. A real one-off malformation would usually clear on the retry, which is covered by `tests/test_export_and_llm.py::test_gemini_client_recovers_on_second_attempt`.

## 3. Grounded search returns nothing, so no draft

For a company that does not exist (`paladin-eval-nonexistent.invalid`), the site is unreachable and Gemini with Google Search grounding returned **zero sources**. With no documents there is nothing to extract, zero verified facts, and a refusal without a brief model call.

```json
{"domain": "paladin-eval-nonexistent.invalid", "node": "research", "event": "site_fetched", "latency_ms": 3,
 "data": {"robots": "unreachable (network: ConnectError: [Errno 8] nodename nor servname provided, or not known), disallow all"}}
{"domain": "paladin-eval-nonexistent.invalid", "node": "research", "event": "grounded_search", "latency_ms": 37221,
 "data": {"answer": "Nonexistent Co is a fictional entity and does not exist. ...", "sources": [], "fetched_ok": 0, "rejected": []}}
{"domain": "paladin-eval-nonexistent.invalid", "node": "research", "event": "extract_skipped", "data": {"reason": "no usable source documents"}}
{"domain": "paladin-eval-nonexistent.invalid", "node": "refuse", "event": "refused", "data": {"reason": "zero verified facts: no brief drafted, no model call made"}}
```

The grounded *answer text* is recorded in the trace but is never used as evidence. Only pages we fetch ourselves, that are the company's site or name the company, and that contain the exact quote, can produce facts. This matters: in the local end-to-end run the grounded answer for `cal.com` said the company is "headquartered in San Francisco, California", while cal.com's own About page says it has no physical headquarters.

The "no model call" part is asserted in `tests/test_graph.py::test_zero_facts_refuses_without_any_model_call`. A related refusal path: if the model extracts candidates but none of their quotes are found in the source text, research keeps zero facts and the brief model is not called (`test_extracted_but_unverifiable_facts_refuse_before_drafting`). Pages about a different company are rejected before extraction (`tests/test_grounded_guard.py`).

## 4. Duplicate CSV upload

The same 5-row CSV uploaded twice into the drill database (3 of its domains were new; 2 already existed from earlier drill steps):

```json
{"first":  {"batch_id": 5, "rows_total": 5, "rows_new": 3, "rows_duplicate": 2, "rows_invalid": 0},
 "second": {"batch_id": 6, "rows_total": 5, "rows_new": 0, "rows_duplicate": 5, "rows_invalid": 0},
 "accounts_in_db": 8}
```

The normalized domain is a unique key, so a re-upload creates a new batch record that points at the existing accounts. Re-running a batch skips accounts that already have a run pending approval, approved, or rejected (unless `--force`). `failed` and `refused` accounts are retried.

## 5. Reviewer rejects

A reviewer rejected the `close.com` brief. A rejection without a reason is refused by the API. The decision, reviewer, and reason are stored on the run and in the trace, and the HubSpot export contains only the header row.

```json
{"domain": "close.com", "node": "approval", "event": "decision",
 "data": {"action": "reject", "by": "drill-reviewer", "reason": "Not our segment: sells to SMB sales teams", "edited": false}}
```

```
Company name,Company Domain Name,Description,paladin_first_line,paladin_icp_score,paladin_sources,paladin_approved_by,paladin_approved_at,paladin_run_id
```

## 6. Model provider down (captured live, not a drill)

During the first local end-to-end run (Gemini API-key mode, model `gemini-flash-latest`), the provider first returned `503 UNAVAILABLE` ("high demand") and then daily-quota 429s. From the saved log lines:

```json
{"domain": "posthog.com", "node": "research", "event": "extract_failed",
 "data": {"error": "gemini 503 error: 503 UNAVAILABLE. {'error': {'code': 503, 'message': 'This model is currently experiencing high demand. ...'}}"}}
{"domain": "posthog.com", "node": "run", "event": "paused_or_finished", "latency_ms": 247821, "data": {"status": "failed"}}
{"domain": "cal.com", "node": "research", "event": "extract_failed",
 "data": {"error": "gemini 429 daily quota exhausted: 429 RESOURCE_EXHAUSTED. ..."}}
{"domain": "cal.com", "node": "run", "event": "paused_or_finished", "latency_ms": 3201, "data": {"status": "failed"}}
```

The 503 was retried with backoff (4 retries), then failed closed, which cost 248 s for that account. The daily-quota 429s were not retried, so those accounts failed in about 3 s. The one account that reached `pending_approval` before the outage was unaffected. Re-running the batch with the model setting pointed at a model with quota retried only the four `failed` accounts, and all four reached `pending_approval`. Retries are now also logged as `gemini_retry` events, so a slow account explains itself.

## Found in live runs, not drills

- **Checkpointer and trace writes on one Postgres connection.** The first live batch crashed with `psycopg.OperationalError: sending query and params failed: another command is already in progress`: `PostgresSaver` uses pipeline mode and cannot share a connection. The runner now gives the checkpointer its own connection. The unhandled error was still caught per account and recorded as `failed`, so the batch survived.
- **Retrying an unrecoverable quota.** The first live run retried grounded-search 429s with backoff, which cost about 76 s per account and, because each retry is a counted request, used up that model's daily quota on a free-tier key. The client now does not retry daily-quota 429s, honors the server's `retry in Ns` hint for per-minute limits, and research trips a per-process circuit breaker so later accounts skip grounded search with `skipped: quota exhausted earlier in this process`.
- **Validator false positives.** Real drafts were stripped for `PostHog's` (possessive of the account name) and `London-based` (the HQ fact said London). Both are now handled.
