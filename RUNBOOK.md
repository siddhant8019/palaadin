# PALADIN runbook

All commands run from the repo root. Configuration is environment variables (see `.env.example`).

## Model auth: Vertex AI or API key

Gemini is the only model provider, reached through `google-genai` in one of two modes, chosen by environment:

| mode | set | notes |
|---|---|---|
| Vertex AI | `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` (`global`, or `us-central1` as a fallback) | Uses Application Default Credentials. Google Search grounding works. Takes precedence when enabled. |
| API key | `GEMINI_API_KEY` | AI Studio key. A free-tier key allows about 20 requests per day per model and did not allow grounded requests during this build. |

Check which backend a run used: the eval writes it to `eval/results/meta.json` (`backend`). If Vertex returns `404` for a model id in `global`, set `GOOGLE_CLOUD_LOCATION=us-central1` or pick another id in `PALADIN_MODEL_*`.

## Re-run a list

Uploading the same CSV again is safe: accounts are keyed on the normalized domain, so nothing duplicates.

```bash
# UI: Lists > Run research on the batch row.
# CLI, by file (creates a batch record, reuses existing accounts):
uv run python -m paladin.cli run --csv accounts.csv
# CLI, by batch id:
uv run python -m paladin.cli run --batch 3
```

A re-run skips accounts that already have a run in `pending_approval`, `approved`, or `rejected`. Accounts that ended `failed` or `refused` are retried. To research everything again (for example after changing ICP rules or prompts), add `--force`; each account gets a new run and the old runs stay for audit.

## Add or change ICP rules

Rules live in `config/icp.json` (path override: `PALADIN_ICP_CONFIG`). The model never scores. Rule types:

| type | fields | matches when |
|---|---|---|
| `keywords` | `fact_types`, `keywords`, `weight` | a keyword appears as a whole word in a fact value of one of those types |
| `fact_present` | `fact_types`, `weight` | at least one fact of those types exists |
| `headcount_band` | `fact_types`, `min`, `max`, `weight` | a number parsed from a headcount fact (midpoint for ranges) is inside the band |

Steps: edit the JSON, bump `version`, run `uv run pytest tests/test_icp.py`, then re-run affected batches with `--force`. Each run stores `icp.config_version`, so old and new scores stay distinguishable. A new rule *type* needs a branch in `src/paladin/icp.py` plus a test.

## A provider is down

Look at `runs.providers` or the run's trace page (`/runs/<id>`).

- **Company website (403, timeout, DNS).** Per-page errors are in the `site_fetched` event. An account with no usable documents is `refused` with no model call. Nothing to fix on our side for a bot wall; do not spoof user agents. Re-run later with `run --batch`.
- **Gemini per-minute limit.** The client waits for the server's `retry in Ns` hint and retries (up to 4 times). Slower, not failed.
- **Gemini daily quota.** Not retried (every retry is a counted request). Extraction or drafting ends the account as `failed` with `model provider unavailable ... daily quota exhausted`. Fix the quota or switch `PALADIN_MODEL_EXTRACT` / `PALADIN_MODEL_BRIEF`, then re-run the batch; failed accounts are retried automatically.
- **Grounded search quota.** After the first quota error in a process, later accounts show `skipped: quota exhausted earlier in this process`. Research continues on the website path. To turn it off entirely: `PALADIN_GROUNDED_SEARCH=0`.
- **Malformed model output.** Retried once, then the account is `failed` with both parse errors stored. The batch continues.
- **Postgres down.** Nothing runs; the web app returns errors. Runs waiting for approval are safe in the checkpoint tables and resume when the database is back.

## Read a trace

Every run has one row in `runs` (current state and totals) and ordered rows in `trace_events`. The same events are written as JSON lines to stdout and `logs/paladin.jsonl`.

```sql
SELECT node, event, latency_ms, tokens_in, tokens_out, left(data::text, 200)
FROM trace_events WHERE run_id = '<run id>' ORDER BY id;
```

Events in order for a healthy run: `run.started`, `research.site_fetched` (robots result, every URL with status and latency), `research.grounded_search*`, `research.extracted` (candidates, attempts, model), `research.facts_verified` (kept, dropped with reasons), `research.node_done` (providers used or disabled), `score.node_done` (full breakdown), `draft.node_done` (claims total, unsupported, each dropped claim with its reason), `run.paused_or_finished` (end-to-end latency). After review: `approval.decision` (action, reviewer, reason, whether edited). Tokens and estimated cost (placeholder prices in `src/paladin/config.py`) are totaled on the `runs` row. The raw text of every fetched document is in `source_documents`, so any claim can be re-checked later.

JSON: `GET /api/runs/<id>` returns the run plus its events.

## Enable Apollo or Tavily

Set the key and restart. No code change.

```bash
APOLLO_API_KEY=...   # organization enrich by domain
TAVILY_API_KEY=...   # web search, top 5 results
```

Their responses become source documents and go through the same extraction and quote verification as the website: a fact from a provider is kept only if its quote appears in that provider's returned text. With no key, traces show `provider disabled: no key`. These adapters were written against the providers' public API docs and have not been exercised with real keys in this build.

## Decide from the CLI

```bash
uv run python -m paladin.cli decide <run_id> approve --by you@company.com
uv run python -m paladin.cli decide <run_id> reject --by you@company.com --reason "not in segment"
uv run python -m paladin.cli export --out hubspot.csv
```

## HubSpot import

`/export.csv` (or `cli export`) contains approved runs only, latest per account. In HubSpot: Settings > Properties > Company, create single-line text properties `paladin_first_line`, `paladin_sources`, `paladin_approved_by`, `paladin_approved_at`, `paladin_run_id` and a number property `paladin_icp_score`. Then Import > File from computer > Companies, and map `Company Domain Name` as the unique key so re-imports update rather than duplicate.

## Deploy to Vercel + Supabase

Not deployed as part of this build. Steps:

1. **Supabase.** Create a project. Copy the pooled connection string (Transaction pooler, port 6543) with `?sslmode=require`. Run migrations once from your machine: `DATABASE_URL=<supabase url> uv run python -m paladin.cli migrate`, then `PALADIN_OPERATOR_PASSWORD=... uv run python -m paladin.cli seed`. Note: LangGraph's `PostgresSaver` expects session semantics for its setup; run `migrate` against the direct (port 5432) connection string if the pooler rejects it.
2. **Vercel.** `vercel link`, then set env vars: `DATABASE_URL`, `GEMINI_API_KEY`, `PALADIN_SESSION_SECRET`, model ids, and optional provider keys (`vercel env add ...`). Export requirements for the Python runtime: `uv export --no-dev --no-hashes > requirements.txt`. Deploy with `vercel deploy`. `vercel.json` routes every path to `api/index.py`, which serves the FastAPI app.
3. **Timeout constraint.** A Vercel function has a hard `maxDuration` (60 s configured here; plan limits apply). One account measured tens of seconds end to end in the eval, and a batch is many accounts, so on Vercel do not use `POST /batches/{id}/run` (it runs in a background thread that a serverless platform may freeze or kill after the response). Use `POST /api/accounts/{id}/run`, one account per request. The approval pause needs no long-lived process: it is a Postgres checkpoint, and approval is its own short request. For real volume, move research to a worker (see README, "What would I change before production").
4. **Logs.** The file log handler is skipped on read-only filesystems; JSON lines still go to stdout and show in Vercel logs. The durable trace is in Postgres either way.
