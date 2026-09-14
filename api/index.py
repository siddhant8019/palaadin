"""Vercel Python function entry point. Vercel serves the ASGI `app` object.

Serverless constraint: a function invocation is capped (maxDuration in vercel.json). One account
takes tens of seconds (measured p95 in docs/EVAL_RESULTS.md), so on Vercel the batch endpoint
must not be used. Call POST /api/accounts/{id}/run once per account (from the UI loop or a
queue consumer); each call is one bounded invocation, and the approval interrupt is already
durable in Postgres, so nothing needs to stay in memory between requests.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from paladin.web import app  # noqa: E402,F401
