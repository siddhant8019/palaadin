"""Render the number tables for docs/EVAL_RESULTS.md straight from eval/results/*.json.

Numbers are copied by code, never retyped. The narrative sections of EVAL_RESULTS.md live between
the generated block markers and are left untouched.
Run: uv run python eval/render_results.py
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).parent
RESULTS = HERE / "results"
DOC = HERE.parent / "docs" / "EVAL_RESULTS.md"
START, END = "<!-- generated:start -->", "<!-- generated:end -->"


def load(name: str) -> dict:
    return json.loads((RESULTS / f"{name}.json").read_text())


def pct(x) -> str:
    return "n/a" if x is None else f"{x * 100:.1f}%"


def render() -> str:
    meta, facts, claims = load("meta"), load("facts"), load("claims")
    icp, ref, perf = load("icp_stability"), load("refusals"), load("latency_cost")
    prod, abl = claims["production"], claims["ablation"]
    lines = [
        START,
        f"Run: {meta['run_started']} to {meta['run_finished']} (UTC). Backend: `{meta.get('backend', 'n/a')}`. "
        f"Snapshots captured: {', '.join(meta['snapshot_capture_dates'])}. "
        f"Companies: {meta['companies_real']} real, {meta['companies_garbage']} garbage. "
        f"Model calls: {meta['model_calls_total']}.",
        "",
        "Models: " + ", ".join(f"{k} `{v}`" for k, v in meta["models"].items()) + ".",
        "",
        "| Measurement | Result | Detail |",
        "|---|---|---|",
        f"| Research fact precision | {pct(facts['precision'])} | {facts['facts_correct']} of {facts['facts_scored']} extracted industry, product, HQ, hiring facts match labels |",
        f"| Research fact recall | {pct(facts['recall'])} | {facts['fields_covered']} of {facts['labeled_positive_fields']} positive labeled fields covered |",
        f"| Claims failing the code check, production prompt | {pct(prod['unsupported_rate_before'])} | {prod['claims_unsupported_before_validation']} of {prod['claims_total']} claims in {prod['briefs']} briefs |",
        f"| Claims failing the code check after validation | {pct(prod['unsupported_rate_after'])} | 0 by construction (failing claims are stripped); {prod['claims_kept']} claims kept. The code check is not a full support check: see the human audit below |",
        f"| Ablation: production prompt, same facts, claims failing the code check | {pct(abl['constrained']['unsupported_rate_before'])} | {abl['constrained']['claims_unsupported_before_validation']} of {abl['constrained']['claims_total']} claims, {abl['constrained']['briefs']} briefs, {abl['constrained']['errors']} errors |",
        f"| Ablation: loose prompt (outside knowledge allowed), same facts, claims failing the code check | {pct(abl['loose']['unsupported_rate_before'])} | {abl['loose']['claims_unsupported_before_validation']} of {abl['loose']['claims_total']} claims, {abl['loose']['briefs']} briefs, {abl['loose']['errors']} errors |",
        f"| ICP score identical across {icp['reruns']} reruns | {icp['accounts_identical_score']} of {icp['accounts_complete']} accounts | max spread {icp['max_spread']} points out of 100 |",
        f"| Refusal correctness on garbage domains | {ref['correct']} of {ref['cases']} | refused, and brief model never called |",
        f"| Latency per account, p50 / p95 (snapshot replay) | {perf['pipeline_latency_ms']['p50']} ms / {perf['pipeline_latency_ms']['p95']} ms | {perf['accounts_measured']} accounts that reached approval |",
        f"| Latency per account incl. live site fetch, p50 / p95 | {perf['pipeline_plus_live_fetch_ms']['p50']} ms / {perf['pipeline_plus_live_fetch_ms']['p95']} ms | adds fetch wall time measured at capture |",
        f"| Estimated cost per account, mean (p95) | ${perf['cost_usd_per_account']['mean']} (${perf['cost_usd_per_account']['p95']}) | placeholder prices: ${perf['price_assumption_usd_per_m']['input']}/M input, ${perf['price_assumption_usd_per_m']['output_incl_thinking']}/M output |",
        f"| Tokens per account, mean | {perf['tokens_per_account']['in_mean']} in / {perf['tokens_per_account']['out_mean']} out | output includes thinking tokens |",
        "",
        "ICP scores per rerun:",
        "",
        "| Account | Scores |",
        "|---|---|",
    ]
    for domain, runs in icp["runs"].items():
        lines.append(f"| {domain} | {', '.join(str(r.get('total', 'error')) for r in runs)} |")
    lines += ["", "Refusal cases:", "", "| Domain | Status | Model calls made |", "|---|---|---|"]
    for r in ref["rows"]:
        lines.append(f"| {r['domain']} | {r['status']} | {', '.join(r['model_calls']) or 'none'} |")
    lines += ["", "Claims stripped by the code check (production prompt):", ""]
    if prod["dropped"]:
        lines += ["| Account | Claim | Reason |", "|---|---|---|"]
        for d in prod["dropped"]:
            lines.append(f"| {d['domain']} | {d['text']} | {d['reason']} |")
    else:
        lines.append("None.")
    lines += ["", "Claims stripped by the code check (loose-prompt ablation):", ""]
    loose_drops = [dict(d, domain=r["domain"]) for r in abl["loose"]["rows"] if "dropped" in r for d in r["dropped"]]
    if loose_drops:
        lines += ["| Account | Claim | Reason |", "|---|---|---|"]
        for d in loose_drops:
            lines.append(f"| {d['domain']} | {d['text']} | {d['reason']} |")
    else:
        lines.append("None.")
    lines.append(END)
    return "\n".join(lines)


def main() -> None:
    block = render()
    doc = DOC.read_text() if DOC.exists() else f"# Evaluation results\n\n{START}\n{END}\n"
    head, rest = doc.split(START, 1)
    _, tail = rest.split(END, 1)
    DOC.write_text(head + block + tail)
    print(block)


if __name__ == "__main__":
    main()
