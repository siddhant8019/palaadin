"""Capture real website snapshots for the eval, using the production fetcher.

Writes eval/snapshots/<domain>.json with the capture timestamp, robots result, per-page
status, errors, latency, and extracted text. The eval replays these files so results are
reproducible without re-hitting the sites. Run: uv run python eval/snapshot.py
"""

from __future__ import annotations

import csv
import json
import sys
import time
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from paladin.fetch import SiteFetcher, SiteResult, Page

HERE = Path(__file__).parent
SNAP_DIR = HERE / "snapshots"


def load_companies() -> list[dict]:
    with open(HERE / "companies.csv") as f:
        return list(csv.DictReader(f))


def load_snapshot(domain: str) -> SiteResult:
    data = json.loads((SNAP_DIR / f"{domain}.json").read_text())
    return SiteResult(domain=domain, robots=data["robots"], pages=[Page(**p) for p in data["pages"]])


def main() -> None:
    SNAP_DIR.mkdir(exist_ok=True)
    only = set(sys.argv[1:])
    fetcher = SiteFetcher()
    for c in load_companies():
        if only and c["domain"] not in only:
            continue
        start = time.perf_counter()
        site = fetcher.fetch_site(c["domain"])
        elapsed = int((time.perf_counter() - start) * 1000)
        out = {
            "domain": c["domain"],
            "company": c["company name"],
            "captured_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "fetch_wall_ms": elapsed,
            "robots": site.robots,
            "pages": [asdict(p) for p in site.pages],
        }
        (SNAP_DIR / f"{c['domain']}.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
        ok = len(site.ok_pages())
        print(f"{c['domain']}: {ok}/{len(site.pages)} pages ok, {elapsed} ms, robots={site.robots}")


if __name__ == "__main__":
    main()
