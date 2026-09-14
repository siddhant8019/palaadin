"""Idempotent CSV ingest. The normalized domain is the dedupe key."""

from __future__ import annotations

import csv
import io
import re
from urllib.parse import urlsplit

NAME_HEADERS = ("company name", "company", "name", "account name")
DOMAIN_HEADERS = ("domain", "company domain", "website", "company domain name", "url")

_DOMAIN_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


def normalize_domain(raw: str) -> str | None:
    """'https://WWW.Linear.app/about?x=1' -> 'linear.app'. Returns None when invalid."""
    if not raw:
        return None
    value = raw.strip().lower()
    if "://" not in value:
        value = "http://" + value
    host = urlsplit(value).hostname or ""
    host = host.strip(".")
    if host.startswith("www."):
        host = host[4:]
    return host if _DOMAIN_RE.match(host) else None


def parse_csv(content: bytes | str) -> tuple[list[dict], list[dict]]:
    """Returns (rows, invalid). Each row is {'name', 'domain'} with a normalized domain."""
    text = content.decode("utf-8-sig") if isinstance(content, bytes) else content
    reader = csv.DictReader(io.StringIO(text))
    headers = {h.strip().lower(): h for h in (reader.fieldnames or [])}
    name_h = next((headers[h] for h in NAME_HEADERS if h in headers), None)
    domain_h = next((headers[h] for h in DOMAIN_HEADERS if h in headers), None)
    if not domain_h:
        raise ValueError("CSV needs a domain column (one of: " + ", ".join(DOMAIN_HEADERS) + ")")
    rows, invalid = [], []
    for i, rec in enumerate(reader, start=2):
        domain = normalize_domain(rec.get(domain_h) or "")
        name = (rec.get(name_h) or "").strip() if name_h else ""
        if not domain:
            invalid.append({"line": i, "value": rec.get(domain_h)})
            continue
        rows.append({"name": name or domain, "domain": domain})
    return rows, invalid


def ingest(conn, filename: str, content: bytes | str, uploaded_by: str) -> dict:
    rows, invalid = parse_csv(content)
    # Dedupe within the file first, keeping the first occurrence.
    seen: dict[str, dict] = {}
    for r in rows:
        seen.setdefault(r["domain"], r)
    with conn.transaction():
        batch = conn.execute(
            "INSERT INTO batches(filename, uploaded_by, rows_total, rows_new, rows_duplicate, rows_invalid)"
            " VALUES (%s, %s, %s, 0, 0, %s) RETURNING id",
            (filename, uploaded_by, len(rows) + len(invalid), len(invalid)),
        ).fetchone()
        batch_id = batch["id"]
        new = 0
        for r in seen.values():
            inserted = conn.execute(
                "INSERT INTO accounts(name, domain, first_batch_id) VALUES (%s, %s, %s)"
                " ON CONFLICT (domain) DO NOTHING RETURNING id",
                (r["name"], r["domain"], batch_id),
            ).fetchone()
            if inserted:
                new += 1
                account_id = inserted["id"]
            else:
                account_id = conn.execute("SELECT id FROM accounts WHERE domain = %s", (r["domain"],)).fetchone()["id"]
            conn.execute(
                "INSERT INTO batch_accounts(batch_id, account_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (batch_id, account_id),
            )
        duplicate = len(rows) - new
        conn.execute(
            "UPDATE batches SET rows_new = %s, rows_duplicate = %s WHERE id = %s", (new, duplicate, batch_id)
        )
    return {
        "batch_id": batch_id,
        "rows_total": len(rows) + len(invalid),
        "rows_new": new,
        "rows_duplicate": duplicate,
        "rows_invalid": len(invalid),
        "invalid": invalid,
    }
