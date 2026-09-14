"""Dump every drafted claim with the facts it cites, for a human support audit.

Run from the repo root: uv run python eval/claim_audit_dump.py > eval/results/claim_audit/production_claims.txt
"""

import json
import os

import psycopg
from psycopg.rows import dict_row

conn = psycopg.connect("postgresql://postgres@localhost:5545/paladin_eval", row_factory=dict_row)
rows = conn.execute(
    "SELECT a.domain, r.facts, r.validation FROM runs r JOIN accounts a ON a.id = r.account_id"
    " WHERE r.status = 'pending_approval' ORDER BY a.id"
).fetchall()
facts = {r["domain"]: {f["id"]: f for f in r["facts"]} for r in rows}


def show(tag, domain, claim):
    fs = facts.get(domain, {})
    cited = " ; ".join(
        f'{i}={fs[i]["value"]} ["{fs[i]["quote"][:140]}"]' for i in claim.get("fact_ids") or [] if i in fs
    )
    print(f"{tag} {domain}: {claim.get('text')}\n    CITES: {cited or '(none)'}")


n = 0
for r in rows:
    raw = r["validation"]["raw_draft"] or {}
    claims = list(raw.get("summary") or [])
    if (raw.get("first_line") or {}).get("text"):
        claims.append(raw["first_line"])
    for c in claims:
        n += 1
        show(f"P{n}", r["domain"], c)


if not os.path.exists("eval/results/claims.json"):
    raise SystemExit(0)
claims_json = json.load(open("eval/results/claims.json"))
n = 0
for row in claims_json["ablation"]["loose"]["rows"]:
    if "error" in row:
        continue
    kept = row["kept"]
    for c in (kept.get("summary") or []) + ([kept["first_line"]] if kept.get("first_line") else []):
        n += 1
        show(f"L{n}", row["domain"], c)
    for d in row["dropped"]:
        n += 1
        show(f"L{n}-DROPPED", row["domain"], d)
