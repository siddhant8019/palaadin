"""Failure drills: trigger each failure mode for real and capture the JSON log lines it produced.

Writes eval/results/failure_drills.json. Uses live websites and live Gemini (small call budget).
Run: DATABASE_URL=... PALADIN_MODEL_EXTRACT=... PALADIN_MODEL_BRIEF=... uv run python eval/failure_drills.py
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path

import httpx

from paladin.config import get_settings
from paladin.db import connect, migrate
from paladin.export import approved_rows, to_hubspot_csv
from paladin.fetch import SiteFetcher
from paladin.ingest import ingest
from paladin.runner import Runner, make_deps, run_batch
from paladin.trace import setup_logging

HERE = Path(__file__).parent


class Capture(logging.Handler):
    def __init__(self):
        super().__init__()
        self.lines: list[dict] = []

    def emit(self, record):
        try:
            self.lines.append(json.loads(record.getMessage()))
        except ValueError:
            pass


def take(cap: Capture, **match) -> list[dict]:
    out = [ln for ln in cap.lines if all(ln.get(k) == v for k, v in match.items())]
    cap.lines.clear()
    return out


def trim(line: dict, keep=("ts", "domain", "node", "event", "latency_ms", "data")) -> dict:
    line = {k: line.get(k) for k in keep if k in line}
    s = json.dumps(line.get("data"), default=str)
    if len(s) > 900:
        line["data"] = s[:900] + "...(truncated)"
    return line


def main() -> None:
    settings = get_settings()
    setup_logging(None)
    cap = Capture()
    logging.getLogger("paladin").addHandler(cap)
    migrate(settings.database_url)
    conn = connect(settings.database_url)
    for t in ("trace_events", "source_documents", "runs", "batch_accounts", "accounts", "batches"):
        conn.execute(f"TRUNCATE {t} RESTART IDENTITY CASCADE")
    drills = {"run_at": datetime.now(UTC).isoformat(timespec="seconds"),
              "models": {"extract": settings.model_extract, "brief": settings.model_brief}}

    def account(domain, name):
        ingest(conn, "drill.csv", f"company name,domain\n{name},{domain}\n", "drill")
        return conn.execute("SELECT id, name, domain FROM accounts WHERE domain = %s", (domain,)).fetchone()

    # 1a. Site returns 403 to our bot (real: gusto.com).
    runner = Runner(make_deps(settings))
    res = runner.start(account("gusto.com", "Gusto"))
    drills["site_403"] = {"status": res["status"], "reason": res["status_reason"],
                          "log": [trim(x) for x in take(cap) if x.get("event") in ("site_fetched", "extract_skipped", "refused")]}

    # 1b. Site times out (real request to linear.app with a 50 ms budget, forcing the timeout path).
    tight = Runner(make_deps(settings, fetcher=SiteFetcher(timeout=httpx.Timeout(0.05, connect=0.05))))
    res = tight.start(account("linear.app", "Linear"))
    drills["site_timeout"] = {"status": res["status"], "reason": res["status_reason"],
                              "log": [trim(x) for x in take(cap) if x.get("event") in ("site_fetched", "extract_skipped", "refused")]}
    tight.close()

    # 2. Malformed model JSON on one account, injected via the test hook; the batch continues.
    os.environ["PALADIN_FAULT_MALFORMED_JSON"] = "brief"
    os.environ["PALADIN_FAULT_DOMAIN"] = "attio.com"
    b = ingest(conn, "malformed_drill.csv", "company name,domain\nAttio,attio.com\nClose,close.com\n", "drill")
    results = run_batch(runner, b["batch_id"])
    os.environ.pop("PALADIN_FAULT_MALFORMED_JSON")
    os.environ.pop("PALADIN_FAULT_DOMAIN")
    drills["malformed_json"] = {
        "results": [{k: r[k] for k in ("domain", "status", "status_reason")} for r in results],
        "log": [trim(x) for x in take(cap) if x.get("event") in ("malformed_output", "failed_closed", "batch_done")],
    }
    close_run = next(r["run_id"] for r in results if r["domain"] == "close.com")

    # 3. No evidence from any provider (grounded search enabled; see EVAL notes for its quota) -> refusal.
    grounded = get_settings()
    grounded.grounded_search = True
    gr = Runner(make_deps(grounded))
    res = gr.start(account("paladin-eval-nonexistent.invalid", "Nonexistent Co"))
    drills["no_evidence_refusal"] = {
        "status": res["status"], "reason": res["status_reason"],
        "log": [trim(x) for x in take(cap) if x.get("event") in ("site_fetched", "grounded_search", "grounded_search_error",
                                                                 "grounded_search_skipped", "extract_skipped", "refused")]}
    gr.close()

    # 4. Duplicate CSV upload.
    csv_text = (HERE.parent / "examples" / "accounts_5.csv").read_text()
    first = ingest(conn, "accounts_5.csv", csv_text, "drill")
    second = ingest(conn, "accounts_5.csv", csv_text, "drill")
    drills["duplicate_upload"] = {"first": {k: v for k, v in first.items() if k != "invalid"},
                                  "second": {k: v for k, v in second.items() if k != "invalid"},
                                  "accounts_in_db": conn.execute("SELECT count(*) c FROM accounts").fetchone()["c"]}

    # 5. Reviewer rejects: reason stored, nothing exported.
    status = runner.decide(close_run, "reject", by="drill-reviewer", reason="Not our segment: sells to SMB sales teams")
    row = conn.execute("SELECT status, decision, decided_by, decision_reason FROM runs WHERE id = %s", (close_run,)).fetchone()
    export = to_hubspot_csv(approved_rows(conn))
    drills["reviewer_reject"] = {"status": status, "row": row, "export_csv": export,
                                 "log": [trim(x) for x in take(cap) if x.get("event") == "decision"]}
    runner.close()

    out = HERE / "results" / "failure_drills.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(drills, indent=2, default=str, ensure_ascii=False))
    print(json.dumps({k: (v.get("status") if isinstance(v, dict) else v) for k, v in drills.items()}, indent=2, default=str))


if __name__ == "__main__":
    main()
