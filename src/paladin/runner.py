"""Starting, resuming, and batching runs."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime

from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import Command

from .db import connect
from .fetch import SiteFetcher
from .graph import Deps, build_graph
from .providers import ApolloProvider, TavilyProvider
from .trace import Tracer, log_json

TERMINAL_OR_WAITING = ("pending_approval", "approved", "rejected")


def make_deps(settings, conn=None, llm=None, fetcher=None) -> Deps:
    if llm is None:
        from .llm import GeminiClient

        llm = GeminiClient(settings.gemini_api_key)
    return Deps(
        conn=conn or connect(settings.database_url),
        settings=settings,
        llm=llm,
        fetcher=fetcher or SiteFetcher(),
        apollo=ApolloProvider(settings.apollo_api_key),
        tavily=TavilyProvider(settings.tavily_api_key),
    )


class Runner:
    def __init__(self, deps: Deps):
        self.deps = deps
        self.checkpointer = PostgresSaver(deps.conn)
        self.graph = build_graph(deps, self.checkpointer)

    def start(self, account: dict) -> dict:
        run_id = str(uuid.uuid4())
        conn = self.deps.conn
        conn.execute("INSERT INTO runs(id, account_id, status) VALUES (%s, %s, 'running')", (run_id, account["id"]))
        tracer = Tracer(conn, run_id, account["domain"])
        tracer.event("run", "started", {"account": account})
        start = time.perf_counter()
        config = {"configurable": {"thread_id": run_id}}
        try:
            self.graph.invoke({"run_id": run_id, "account": {k: account[k] for k in ("id", "name", "domain")}}, config)
        except Exception as exc:  # one account must never kill a batch
            tracer.update_run(status="failed", status_reason=f"unhandled: {type(exc).__name__}: {exc}")
            tracer.event("run", "crashed", {"error": f"{type(exc).__name__}: {exc}"})
        latency = int((time.perf_counter() - start) * 1000)
        row = conn.execute("SELECT status, status_reason, tokens_in, tokens_out, cost_usd FROM runs WHERE id = %s",
                           (run_id,)).fetchone()
        tracer.event("run", "paused_or_finished", {"status": row["status"]}, latency_ms=latency)
        return {"run_id": run_id, "latency_ms": latency, **row}

    def pending_interrupt(self, run_id: str) -> bool:
        state = self.graph.get_state({"configurable": {"thread_id": run_id}})
        return "approval" in (state.next or ())

    def decide(self, run_id: str, action: str, by: str, reason: str | None = None,
               edited_brief: dict | None = None) -> str:
        if action not in ("approve", "reject"):
            raise ValueError("action must be approve or reject")
        if action == "reject" and not (reason or "").strip():
            raise ValueError("a rejection needs a reason")
        if not self.pending_interrupt(run_id):
            raise LookupError(f"run {run_id} is not waiting for approval")
        decision = {"action": action, "by": by, "reason": reason, "edited_brief": edited_brief,
                    "at": datetime.now(UTC).isoformat()}
        self.graph.invoke(Command(resume=decision), {"configurable": {"thread_id": run_id}})
        return self.deps.conn.execute("SELECT status FROM runs WHERE id = %s", (run_id,)).fetchone()["status"]


def accounts_to_run(conn, batch_id: int, force: bool = False) -> list[dict]:
    rows = conn.execute(
        "SELECT a.id, a.name, a.domain FROM batch_accounts ba JOIN accounts a ON a.id = ba.account_id"
        " WHERE ba.batch_id = %s ORDER BY a.id",
        (batch_id,),
    ).fetchall()
    if force:
        return rows
    out = []
    for a in rows:
        existing = conn.execute(
            "SELECT 1 FROM runs WHERE account_id = %s AND status = ANY(%s) LIMIT 1", (a["id"], list(TERMINAL_OR_WAITING))
        ).fetchone()
        if not existing:
            out.append(a)
    return out


def run_batch(runner: Runner, batch_id: int, force: bool = False) -> list[dict]:
    todo = accounts_to_run(runner.deps.conn, batch_id, force)
    log_json(event="batch_start", batch_id=batch_id, accounts=len(todo), force=force)
    results = []
    for account in todo:
        results.append({"domain": account["domain"], **runner.start(account)})
    log_json(event="batch_done", batch_id=batch_id, results=[{k: r[k] for k in ("domain", "status")} for r in results])
    return results
