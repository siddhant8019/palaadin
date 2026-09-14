"""Run tracing: every event goes to Postgres (trace_events) and to a JSON log line."""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

from psycopg.types.json import Jsonb

_logger = logging.getLogger("paladin")


def setup_logging(log_dir: Path | None = None) -> None:
    if _logger.handlers:
        return
    _logger.setLevel(logging.INFO)
    _logger.propagate = False
    fmt = logging.Formatter("%(message)s")
    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(fmt)
    _logger.addHandler(stream)
    if log_dir is not None:
        try:
            log_dir.mkdir(parents=True, exist_ok=True)
            fh = logging.FileHandler(log_dir / "paladin.jsonl")
            fh.setFormatter(fmt)
            _logger.addHandler(fh)
        except OSError:
            pass  # read-only filesystems (serverless) log to stdout only


def log_json(**fields) -> None:
    fields.setdefault("ts", datetime.now(UTC).isoformat(timespec="milliseconds"))
    _logger.info(json.dumps(fields, default=str))


class Tracer:
    def __init__(self, conn, run_id: str, domain: str):
        self.conn = conn
        self.run_id = str(run_id)
        self.domain = domain

    def event(self, node: str, event: str, data: dict | None = None, latency_ms: int | None = None,
              tokens_in: int | None = None, tokens_out: int | None = None) -> None:
        data = data or {}
        self.conn.execute(
            "INSERT INTO trace_events(run_id, node, event, latency_ms, tokens_in, tokens_out, data)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (self.run_id, node, event, latency_ms, tokens_in, tokens_out, Jsonb(data)),
        )
        log_json(run_id=self.run_id, domain=self.domain, node=node, event=event, latency_ms=latency_ms,
                 tokens_in=tokens_in, tokens_out=tokens_out, data=data)

    def add_usage(self, tokens_in: int, tokens_out: int, grounded: int = 0) -> None:
        from .config import estimate_cost

        self.conn.execute(
            "UPDATE runs SET tokens_in = tokens_in + %s, tokens_out = tokens_out + %s,"
            " grounded_requests = grounded_requests + %s, cost_usd = cost_usd + %s, updated_at = now() WHERE id = %s",
            (tokens_in, tokens_out, grounded, estimate_cost(tokens_in, tokens_out, grounded), self.run_id),
        )

    def update_run(self, **cols) -> None:
        sets, vals = [], []
        for k, v in cols.items():
            sets.append(f"{k} = %s")
            vals.append(Jsonb(v) if isinstance(v, (dict, list)) else v)
        vals.append(self.run_id)
        self.conn.execute(f"UPDATE runs SET {', '.join(sets)}, updated_at = now() WHERE id = %s", vals)
