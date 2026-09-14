"""PALADIN evaluation. Replays real captured snapshots through the shipped code with live Gemini.

Constraint that shaped this design: the only key available is a Gemini free-tier key, capped at
about 20 generate requests per day per model (observed: "generate_content_free_tier_requests,
limit: 20" on gemini-3.5-flash) plus per-minute limits. So each measurement runs on ONE model
and stays under that cap, and different measurements use different models. Models are recorded
in results/meta.json. Phases:

  A. full graph, 1 run per company: fact precision/recall, production-prompt unsupported-claim
     rate before/after validation, latency, cost                   (extract model + brief model)
  B. ablation on the same facts and the same model: production prompt vs loose prompt
  C. ICP stability: research + scoring rerun 3 times on a subset, same model
  D. refusals on garbage domains through the full graph, counting model calls

Run: python -m paladin.cli run-eval   (uses EVAL_DATABASE_URL if set, else DATABASE_URL)
"""

from __future__ import annotations

import dataclasses
import json
import os
import statistics
import sys
import threading
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

if os.getenv("EVAL_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["EVAL_DATABASE_URL"]
# Grounded search is off in the eval: results must be reproducible from snapshots, and this key
# returned 429 quota errors for every grounded request.
os.environ["PALADIN_GROUNDED_SEARCH"] = "0"

from snapshot import load_companies, load_snapshot  # noqa: E402

from paladin import brief as brief_mod  # noqa: E402
from paladin import icp as icp_mod  # noqa: E402
from paladin.config import PRICE_INPUT_PER_M, PRICE_OUTPUT_PER_M, estimate_cost, get_settings  # noqa: E402
from paladin.db import connect, migrate  # noqa: E402
from paladin.fetch import SiteFetcher  # noqa: E402
from paladin.ingest import ingest  # noqa: E402
from paladin.llm import GeminiClient, MalformedModelOutput, ProviderUnavailable  # noqa: E402
from paladin.research import run_research  # noqa: E402
from paladin.runner import Runner, make_deps  # noqa: E402
from paladin.text import norm  # noqa: E402
from paladin.trace import setup_logging  # noqa: E402

M_EXTRACT = os.getenv("EVAL_MODEL_EXTRACT", "gemini-3.6-flash")
M_BRIEF = os.getenv("EVAL_MODEL_BRIEF", "gemini-3-flash-preview")
M_ABLATION = os.getenv("EVAL_MODEL_ABLATION", "gemini-3.8-flash")
M_STABILITY = os.getenv("EVAL_MODEL_STABILITY", "gemini-3.7-flash")
M_REFUSAL = os.getenv("EVAL_MODEL_REFUSAL", "gemini-3.1-flash-lite")
ABLATION_N = int(os.getenv("EVAL_ABLATION_N", "9"))
STABILITY_N = int(os.getenv("EVAL_STABILITY_N", "6"))
RERUNS = int(os.getenv("EVAL_RERUNS", "3"))
RESULTS = HERE / "results"


class CountingGemini(GeminiClient):
    """The real Gemini client, with per-domain call counting (used for the refusal check)."""

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.by_domain: dict[str, list[str]] = {}
        self._lock = threading.Lock()

    def generate_json(self, model, prompt, schema, purpose, context_domain=None, max_attempts=2):
        with self._lock:
            self.by_domain.setdefault(context_domain or "?", []).append(f"{purpose}:{model}")
        return super().generate_json(model, prompt, schema, purpose, context_domain, max_attempts)


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def fact_matches(field: str, fact: dict, label) -> bool:
    if field == "hiring":
        return bool(label)
    if field == "hq_location":
        return label is not None and norm(label) in norm(fact["value"] + " " + fact["quote"])
    return any(norm(k) in norm(fact["value"]) for k in label)


def score_facts(facts: list[dict], label: dict) -> dict:
    fields = {"industry": label["industry"], "product": label["product"], "hq_location": label["hq"],
              "hiring": label["hiring_page"]}
    tp = fp = covered = positives = 0
    per_field = {}
    for field, lab in fields.items():
        mine = [f for f in facts if f["type"] == field]
        correct = [f for f in mine if fact_matches(field, f, lab)]
        tp += len(correct)
        fp += len(mine) - len(correct)
        positive = bool(lab)
        if positive:
            positives += 1
            covered += 1 if correct else 0
        per_field[field] = {"extracted": len(mine), "correct": len(correct), "label_positive": positive,
                            "wrong_values": [f["value"] for f in mine if f not in correct]}
    return {"tp_facts": tp, "fp_facts": fp, "covered": covered, "positives": positives, "per_field": per_field}


def main() -> None:
    base = get_settings()
    setup_logging(None)
    migrate(base.database_url)
    started = datetime.now(UTC)
    labels = json.loads((HERE / "labels.json").read_text())
    companies = load_companies()
    kinds = {c["domain"]: c["kind"] for c in companies}
    llm = CountingGemini(base.gemini_api_key)

    conn = connect(base.database_url)
    for t in ("trace_events", "source_documents", "runs", "batch_accounts", "accounts", "batches"):
        conn.execute(f"TRUNCATE {t} RESTART IDENTITY CASCADE")
    csv_text = "company name,domain\n" + "".join(f"{c['company name']},{c['domain']}\n" for c in companies)
    ingest(conn, "eval_companies.csv", csv_text, "eval")
    accounts = {r["domain"]: r for r in conn.execute("SELECT id, name, domain FROM accounts").fetchall()}

    def runner_for(settings):
        deps = make_deps(settings, llm=llm)
        deps.site_override = load_snapshot
        return Runner(deps)

    def start(runner, domain):
        res = runner.start(accounts[domain])
        run = runner.deps.conn.execute("SELECT * FROM runs WHERE id = %s", (res["run_id"],)).fetchone()
        print(f"[{domain}] {run['status']} facts={len(run['facts'])} icp={(run['icp'] or {}).get('total')} "
              f"{res['latency_ms']} ms {run['status_reason'] or ''}", flush=True)
        return {"domain": domain, "latency_ms": res["latency_ms"], "run": run}

    # Phase A.
    settings_a = dataclasses.replace(base, model_extract=M_EXTRACT, model_brief=M_BRIEF)
    ra = runner_for(settings_a)
    real = [start(ra, d) for d in accounts if kinds[d] == "real"]

    fact_rows, tp, fp, cov, pos = [], 0, 0, 0, 0
    for o in real:
        lab = labels[o["domain"]]
        if lab.get("unlabelable") or o["run"]["status"] == "failed":
            fact_rows.append({"domain": o["domain"], "skipped": lab.get("reason") or o["run"]["status_reason"]})
            continue
        s = score_facts(o["run"]["facts"], lab)
        tp += s["tp_facts"]; fp += s["fp_facts"]; cov += s["covered"]; pos += s["positives"]
        fact_rows.append({"domain": o["domain"], **s})
    facts_result = {
        "model": M_EXTRACT,
        "precision": round(tp / (tp + fp), 4) if tp + fp else None,
        "recall": round(cov / pos, 4) if pos else None,
        "facts_scored": tp + fp, "facts_correct": tp, "labeled_positive_fields": pos, "fields_covered": cov,
        "method": "precision: share of extracted industry/product/hq_location/hiring facts that match the label; "
                  "recall: share of positive labeled fields with at least one matching fact; "
                  "match = a label keyword (or the HQ city) appears in the fact value",
        "rows": fact_rows,
    }

    usable = [o for o in real if o["run"]["validation"]]
    claims_total = sum(o["run"]["validation"]["claims_total"] for o in usable)
    claims_unsup = sum(o["run"]["validation"]["claims_unsupported"] for o in usable)
    production = {
        "model": M_BRIEF, "briefs": len(usable), "claims_total": claims_total,
        "claims_unsupported_before_validation": claims_unsup,
        "unsupported_rate_before": round(claims_unsup / claims_total, 4) if claims_total else None,
        "unsupported_rate_after": 0.0,
        "claims_kept": claims_total - claims_unsup,
        "note": "the after rate is 0 by construction (unsupported claims are stripped); kept claims shows what survived",
        "dropped": [dict(d, domain=o["domain"]) for o in usable for d in o["run"]["validation"]["dropped"]],
    }

    # Phase B: same facts, same model, two prompts.
    ablation_rows = {"constrained": [], "loose": []}
    ab_tokens = [0, 0]
    for o in [o for o in usable][:ABLATION_N]:
        account = {"name": accounts[o["domain"]]["name"], "domain": o["domain"]}
        sources = {p.url: p.text for p in load_snapshot(o["domain"]).pages}
        for variant in ("constrained", "loose"):
            prompt = brief_mod.build_prompt(account, o["run"]["facts"], variant=variant)
            try:
                r = llm.generate_json(M_ABLATION, prompt, brief_mod.BRIEF_SCHEMA, purpose=f"ablation_{variant}",
                                      context_domain=o["domain"])
            except (MalformedModelOutput, ProviderUnavailable) as exc:
                ablation_rows[variant].append({"domain": o["domain"], "error": str(exc)[:200]})
                continue
            ab_tokens[0] += r.tokens_in; ab_tokens[1] += r.tokens_out
            v = brief_mod.validate(r.data or {}, o["run"]["facts"], sources, account)
            ablation_rows[variant].append({"domain": o["domain"], "claims_total": v["claims_total"],
                                           "claims_unsupported": v["claims_unsupported"], "dropped": v["dropped"],
                                           "kept": v["brief"]})
    ablation = {"model": M_ABLATION, "accounts": ABLATION_N}
    for variant, rows in ablation_rows.items():
        ok = [r for r in rows if "error" not in r]
        t = sum(r["claims_total"] for r in ok); u = sum(r["claims_unsupported"] for r in ok)
        ablation[variant] = {"briefs": len(ok), "errors": len(rows) - len(ok), "claims_total": t,
                             "claims_unsupported_before_validation": u,
                             "unsupported_rate_before": round(u / t, 4) if t else None,
                             "unsupported_rate_after": 0.0, "rows": rows}
    ablation["cost_usd"] = estimate_cost(*ab_tokens)

    # Phase C: ICP stability, research + scoring rerun on a subset with one model.
    settings_c = dataclasses.replace(base, model_extract=M_STABILITY)
    icp_config = base.icp_config()
    stability = {}
    subset = [o["domain"] for o in usable][:STABILITY_N]
    for domain in subset:
        runs = []
        for i in range(RERUNS):
            try:
                out = run_research(accounts[domain], SiteFetcher(), llm, settings_c, site_result=load_snapshot(domain))
            except ProviderUnavailable as exc:
                runs.append({"error": str(exc)[:200]})
                continue
            if out.failure:
                runs.append({"error": out.failure[:200]})
                continue
            s = icp_mod.score(out.facts, icp_config)
            runs.append({"total": s["total"], "facts": len(out.facts),
                         "matched_rules": [r["id"] for r in s["rules"] if r["matched"]]})
            print(f"[stability {domain} #{i}] icp={s['total']} facts={len(out.facts)}", flush=True)
        stability[domain] = runs
    complete = {d: [r["total"] for r in runs] for d, runs in stability.items()
                if len(runs) == RERUNS and all("total" in r for r in runs)}
    identical = sum(1 for v in complete.values() if len(set(v)) == 1)
    icp_result = {
        "model": M_STABILITY, "reruns": RERUNS, "accounts_attempted": len(subset), "accounts_complete": len(complete),
        "accounts_identical_score": identical,
        "stability_rate": round(identical / len(complete), 4) if complete else None,
        "max_spread": max((max(v) - min(v)) for v in complete.values()) if complete else None,
        "runs": stability,
        "note": "the scoring function is deterministic for fixed facts (tests/test_icp.py); any spread comes "
                "from run-to-run variation in what the model extracts",
    }

    # Phase D: refusals through the full graph.
    settings_d = dataclasses.replace(base, model_extract=M_REFUSAL, model_brief=M_REFUSAL)
    rd = runner_for(settings_d)
    refusal_rows = []
    for domain in [d for d in accounts if kinds[d] == "garbage"]:
        o = start(rd, domain)
        calls = llm.by_domain.get(domain, [])
        brief_called = any(c.startswith("brief") for c in calls)
        refusal_rows.append({"domain": domain, "status": o["run"]["status"], "reason": o["run"]["status_reason"],
                             "facts": o["run"]["facts"], "model_calls": calls, "brief_model_called": brief_called,
                             "correct": o["run"]["status"] == "refused" and not brief_called})
    refusal_result = {"model": M_REFUSAL, "cases": len(refusal_rows),
                      "correct": sum(r["correct"] for r in refusal_rows), "rows": refusal_rows}

    # Latency and cost from phase A.
    snap_ms = {d: json.loads((HERE / "snapshots" / f"{d}.json").read_text())["fetch_wall_ms"] for d in accounts}
    drafted = [o for o in real if o["run"]["status"] == "pending_approval"]
    lat = [o["latency_ms"] for o in drafted]
    lat_live = [o["latency_ms"] + snap_ms[o["domain"]] for o in drafted]
    costs = [float(o["run"]["cost_usd"]) for o in drafted]
    perf = {
        "models": {"extract": M_EXTRACT, "brief": M_BRIEF},
        "accounts_measured": len(drafted), "measured_on": "accounts that reached pending_approval in phase A",
        "pipeline_latency_ms": {"p50": round(pct(lat, 0.5)), "p95": round(pct(lat, 0.95))},
        "pipeline_plus_live_fetch_ms": {"p50": round(pct(lat_live, 0.5)), "p95": round(pct(lat_live, 0.95))},
        "cost_usd_per_account": {"mean": round(statistics.mean(costs), 5) if costs else None,
                                 "p50": round(pct(costs, 0.5), 5), "p95": round(pct(costs, 0.95), 5)},
        "tokens_per_account": {"in_mean": round(statistics.mean(o["run"]["tokens_in"] for o in drafted)) if drafted else None,
                               "out_mean": round(statistics.mean(o["run"]["tokens_out"] for o in drafted)) if drafted else None},
        "price_assumption_usd_per_m": {"input": PRICE_INPUT_PER_M, "output_incl_thinking": PRICE_OUTPUT_PER_M,
                                       "note": "placeholder prices, see src/paladin/config.py"},
        "phase_a_statuses": {s: sum(1 for o in real if o["run"]["status"] == s) for s in {o["run"]["status"] for o in real}},
        "note": "pipeline latency replays snapshots (no website fetching) with workers=1 and includes any "
                "per-minute rate-limit waits; pipeline_plus_live_fetch adds the fetch wall time measured at capture",
    }

    meta = {
        "run_started": started.isoformat(timespec="seconds"),
        "run_finished": datetime.now(UTC).isoformat(timespec="seconds"),
        "models": {"phase_a_extract": M_EXTRACT, "phase_a_brief": M_BRIEF, "phase_b_ablation": M_ABLATION,
                   "phase_c_stability": M_STABILITY, "phase_d_refusal": M_REFUSAL},
        "why_multiple_models": "free-tier key, about 20 requests/day per model; each measurement uses one model",
        "grounded_search": "disabled (reproducibility; key returned 429 quota on grounded requests)",
        "snapshot_capture_dates": sorted({json.loads(p.read_text())["captured_at"][:10]
                                          for p in (HERE / "snapshots").glob("*.json")}),
        "companies_real": len(real), "companies_garbage": len(refusal_rows),
        "model_calls_total": sum(len(v) for v in llm.by_domain.values()),
    }
    RESULTS.mkdir(exist_ok=True)
    for name, obj in [("meta", meta), ("facts", facts_result), ("claims", {"production": production, "ablation": ablation}),
                      ("icp_stability", icp_result), ("refusals", refusal_result), ("latency_cost", perf)]:
        (RESULTS / f"{name}.json").write_text(json.dumps(obj, indent=2, default=str, ensure_ascii=False))
    summary = {
        "date": meta["run_finished"], "models": meta["models"],
        "fact_precision": facts_result["precision"], "fact_recall": facts_result["recall"],
        "facts_scored": facts_result["facts_scored"],
        "production_unsupported_rate_before": production["unsupported_rate_before"],
        "production_claims": f"{production['claims_unsupported_before_validation']}/{production['claims_total']}",
        "ablation_constrained_rate_before": ablation["constrained"]["unsupported_rate_before"],
        "ablation_constrained_claims": f"{ablation['constrained']['claims_unsupported_before_validation']}/{ablation['constrained']['claims_total']}",
        "ablation_loose_rate_before": ablation["loose"]["unsupported_rate_before"],
        "ablation_loose_claims": f"{ablation['loose']['claims_unsupported_before_validation']}/{ablation['loose']['claims_total']}",
        "unsupported_rate_after": 0.0,
        "icp_identical_across_reruns": f"{identical}/{len(complete)}", "icp_max_spread": icp_result["max_spread"],
        "refusals_correct": f"{refusal_result['correct']}/{refusal_result['cases']}",
        "latency_p50_ms": perf["pipeline_latency_ms"]["p50"], "latency_p95_ms": perf["pipeline_latency_ms"]["p95"],
        "latency_with_live_fetch_p50_ms": perf["pipeline_plus_live_fetch_ms"]["p50"],
        "latency_with_live_fetch_p95_ms": perf["pipeline_plus_live_fetch_ms"]["p95"],
        "cost_per_account_mean_usd": perf["cost_usd_per_account"]["mean"],
        "phase_a_statuses": perf["phase_a_statuses"], "model_calls_total": meta["model_calls_total"],
    }
    (RESULTS / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    ra.close(); rd.close()


if __name__ == "__main__":
    main()
