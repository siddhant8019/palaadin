# Failure engineering

Every case below was triggered for real on 2026-09-14 by `eval/failure_drills.py` against live websites and live Gemini (`gemini-3.1-flash-lite-preview` for this drill, chosen to stay inside the free-tier daily cap). Full captured output: [`eval/results/failure_drills.json`](../eval/results/failure_drills.json). Log excerpts below are copied from that file and trimmed for width.

The rule behind all of them: an account that cannot be researched or drafted safely ends in a terminal status with a stored reason (`refused` or `failed`), never in a guess, and never takes the rest of the batch down with it.

## 1. Company site times out or returns 403

**403 (real, not simulated).** `gusto.com` returns HTTP 403 to our bot user agent on every path. No usable documents means the extraction model is never called, and with zero verified facts the brief model is never called either.

```json
{"domain": "gusto.com", "node": "research", "event": "site_fetched", "latency_ms": 940,
 "data": {"robots": "absent (http 403), allow all", "pages": [{"url": "https://gusto.com/", "status": 403, "error": "http 403"}, {"url": "https://gusto.com/about", "status": 403, "error": "http 403"}, "..."]}}
{"domain": "gusto.com", "node": "research", "event": "extract_skipped", "data": {"reason": "no usable source documents"}}
{"domain": "gusto.com", "node": "refuse", "event": "refused", "data": {"reason": "zero verified facts: no brief drafted, no model call made"}}
```

**Timeout.** A real request to `linear.app` with the fetch budget cut to 50 ms (the drill's only artificial part is the budget). The homepage times out, the fetcher stops trying the remaining paths for that site, and the account is refused.

```json
{"domain": "linear.app", "node": "research", "event": "site_fetched", "latency_ms": 145,
 "data": {"robots": "parsed", "pages": [{"url": "https://linear.app/", "status": null, "error": "timeout: ReadTimeout", "latency_ms": 52}, {"url": "https://linear.app", "error": "site unreachable, remaining paths skipped"}]}}
{"domain": "linear.app", "node": "refuse", "event": "refused", "data": {"reason": "zero verified facts: no brief drafted, no model call made"}}
```

Also handled in the fetcher: robots.txt unreachable (5xx or network error) means disallow all, per RFC 9309; bodies over 2 MB are truncated; non-HTML content types are skipped.

## 2. Model returns malformed JSON

Injected through the test hook `PALADIN_FAULT_MALFORMED_JSON=brief` with `PALADIN_FAULT_DOMAIN=attio.com`, which corrupts the real Gemini response text for that one account. The client retries once, then raises; the graph routes to `fail` and stores the reason. The next account in the same batch (`close.com`) completes normally.

```json
{"domain": "attio.com", "node": "draft", "event": "malformed_output", "latency_ms": 3546,
 "data": {"error": "attempt 1: malformed JSON: Unterminated string starting at: line 12 column 15 (char 353); attempt 2: malformed JSON: Unterminated string starting at: line 12 column 15 (char 353)"}}
{"domain": "attio.com", "node": "fail", "event": "failed_closed", "data": {"reason": "brief model returned malformed JSON twice: ..."}}
{"event": "batch_done", "results": [{"domain": "attio.com", "status": "failed"}, {"domain": "close.com", "status": "pending_approval"}]}
```

Both attempts show the same corruption offset because the hook corrupts every attempt; a real transient malformation would usually clear on the retry (covered by `tests/test_export_and_llm.py::test_gemini_client_recovers_on_second_attempt`).

## 3. Grounded search returns nothing, so no draft

Honest scope note: on the key available for this build, every Gemini grounded-search request returned `429 RESOURCE_EXHAUSTED`, so a grounded search that *succeeds with zero results* could not be produced live. What was triggered for real is the case that matters for safety: no provider produced evidence (site unreachable, grounded search errored), so there are zero verified facts, and the run refuses without calling the brief model.

```json
{"domain": "paladin-eval-nonexistent.invalid", "node": "research", "event": "site_fetched", "latency_ms": 2,
 "data": {"robots": "unreachable (network: ConnectError: [Errno 8] nodename nor servname provided, or not known), disallow all"}}
{"domain": "paladin-eval-nonexistent.invalid", "node": "research", "event": "grounded_search_error", "latency_ms": 274,
 "data": {"error": "gemini 429 quota exhausted: 429 RESOURCE_EXHAUSTED. ..."}}
{"domain": "paladin-eval-nonexistent.invalid", "node": "research", "event": "extract_skipped", "data": {"reason": "no usable source documents"}}
{"domain": "paladin-eval-nonexistent.invalid", "node": "refuse", "event": "refused", "data": {"reason": "zero verified facts: no brief drafted, no model call made"}}
```

The "no model call" part is asserted in `tests/test_graph.py::test_zero_facts_refuses_without_any_model_call`. A related refusal path: if the model extracts candidates but none of their quotes are found in the source text, research keeps zero facts and the brief model is not called (`test_extracted_but_unverifiable_facts_refuse_before_drafting`).

Found along the way: the first live run retried grounded-search 429s with backoff, which cost about 76 s per account and, because each retry is a counted request, used up that model's daily quota. The client now refuses to retry daily-quota 429s, honors the server's `retry in Ns` hint for per-minute limits, and research trips a per-process circuit breaker so later accounts skip grounded search with `skipped: quota exhausted earlier in this process` in the trace.

## 4. Duplicate CSV upload

The same 5-row CSV uploaded twice in the drill database (3 of its domains already existed from earlier drills):

```json
{"first":  {"batch_id": 5, "rows_total": 5, "rows_new": 3, "rows_duplicate": 2, "rows_invalid": 0},
 "second": {"batch_id": 6, "rows_total": 5, "rows_new": 0, "rows_duplicate": 5, "rows_invalid": 0},
 "accounts_in_db": 8}
```

The normalized domain (`https://WWW.Linear.app/about` becomes `linear.app`) is a unique key, so a re-upload creates a new batch record that points at the existing accounts. Re-running a batch skips accounts that already have a run pending approval, approved, or rejected (unless `--force`); `failed` and `refused` accounts are retried.

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

During the local end-to-end run on 2026-09-14 the configured model (`gemini-flash-latest`) first returned `503 UNAVAILABLE` ("high demand"), then daily-quota 429s. From the demo database's `trace_events`:

```json
{"ts": "2026-09-14T00:41:41-07:00", "domain": "posthog.com", "node": "research", "event": "extract_failed",
 "data": {"error": "gemini 503 error: 503 UNAVAILABLE. {'error': {'code': 503, 'message': 'This model is currently experiencing high demand. ...'}}"}}
{"domain": "posthog.com", "node": "run", "event": "paused_or_finished", "latency_ms": 247821, "data": {"status": "failed"}}
{"ts": "2026-09-14T00:47:38-07:00", "domain": "cal.com", "node": "research", "event": "extract_failed",
 "data": {"error": "gemini 429 daily quota exhausted: 429 RESOURCE_EXHAUSTED. ..."}}
{"domain": "cal.com", "node": "run", "event": "paused_or_finished", "latency_ms": 3201, "data": {"status": "failed"}}
```

The 503 was retried with backoff (4 retries) and then failed closed, which cost 248 s for that account. The daily-quota 429s were not retried, so those accounts failed in about 3 s. One of five accounts had reached `pending_approval` before the provider went down, and it was unaffected. Re-running the batch (`run --batch 1` with `PALADIN_MODEL_EXTRACT/BRIEF` pointed at a model with quota) retried only the four `failed` accounts, and all four reached `pending_approval`. Retries are now also logged as `gemini_retry` events, so a slow account explains itself.

## Found in live runs, not drills

- **Checkpointer and trace writes on one Postgres connection.** The first live batch crashed with `psycopg.OperationalError: sending query and params failed: another command is already in progress`: `PostgresSaver` uses pipeline mode and cannot share a connection. The runner now gives the checkpointer its own connection. The unhandled error was still caught per account and recorded as `failed`, so the batch survived.
- **Validator false positives.** Real drafts were stripped for `PostHog's` (possessive of the account name) and `London-based` (the HQ fact said London). Both are now handled; the eval reports how many stripped claims were actually supported.
