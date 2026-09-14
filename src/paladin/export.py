"""HubSpot company import CSV. Only approved runs are exported.

HubSpot matches companies on "Company Domain Name", so re-importing updates rather than
duplicates. Columns prefixed paladin_ must exist as custom company properties (see RUNBOOK).
"""

from __future__ import annotations

import csv
import io

COLUMNS = [
    "Company name",
    "Company Domain Name",
    "Description",
    "paladin_first_line",
    "paladin_icp_score",
    "paladin_sources",
    "paladin_approved_by",
    "paladin_approved_at",
    "paladin_run_id",
]


def approved_rows(conn) -> list[dict]:
    return conn.execute(
        "SELECT DISTINCT ON (a.id) a.name, a.domain, r.id AS run_id, r.final_brief, r.icp, r.facts,"
        " r.decided_by, r.decided_at"
        " FROM runs r JOIN accounts a ON a.id = r.account_id"
        " WHERE r.status = 'approved' ORDER BY a.id, r.decided_at DESC"
    ).fetchall()


def to_hubspot_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLUMNS, lineterminator="\n")
    w.writeheader()
    for r in rows:
        brief = r["final_brief"] or {}
        facts = {f["id"]: f for f in (r["facts"] or [])}
        cited = []
        for claim in (brief.get("summary") or []) + ([brief["first_line"]] if brief.get("first_line") else []):
            for fid in claim.get("fact_ids") or []:
                url = facts.get(fid, {}).get("source_url")
                if url and url not in cited:
                    cited.append(url)
        w.writerow({
            "Company name": r["name"],
            "Company Domain Name": r["domain"],
            "Description": " ".join(c["text"] for c in brief.get("summary") or []),
            "paladin_first_line": (brief.get("first_line") or {}).get("text", ""),
            "paladin_icp_score": (r["icp"] or {}).get("total", ""),
            "paladin_sources": " ".join(cited),
            "paladin_approved_by": r["decided_by"] or "",
            "paladin_approved_at": r["decided_at"].isoformat() if r["decided_at"] else "",
            "paladin_run_id": str(r["run_id"]),
        })
    return buf.getvalue()
