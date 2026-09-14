"""The run graph. LangGraph is here for one reason: a durable human-approval interrupt.

research -> (refuse | fail | score) -> draft -> (refuse | fail | approval) -> finalize

`approval` calls interrupt(). The state up to that point is checkpointed in Postgres by
PostgresSaver, so a reviewer can approve hours later from a different process and the run
resumes from the checkpoint without redoing research or drafting.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from . import brief as brief_mod
from . import icp as icp_mod
from .llm import MalformedModelOutput, ProviderUnavailable
from .research import run_research
from .trace import Tracer


class RunState(TypedDict, total=False):
    run_id: str
    account: dict
    facts: list[dict]
    sources: dict[str, str]
    providers: dict[str, str]
    icp: dict
    validation: dict
    failure: str | None
    refusal: str | None
    decision: dict | None
    status: str


@dataclass
class Deps:
    conn: Any
    settings: Any
    llm: Any
    fetcher: Any
    apollo: Any = None
    tavily: Any = None
    site_override: Any = None  # eval only: callable(domain) -> SiteResult replayed from snapshots


def build_graph(deps: Deps, checkpointer):
    def tracer(state: RunState) -> Tracer:
        return Tracer(deps.conn, state["run_id"], state["account"]["domain"])

    def research(state: RunState) -> dict:
        t = tracer(state)
        start = time.perf_counter()
        site = deps.site_override(state["account"]["domain"]) if deps.site_override else None
        out = run_research(state["account"], deps.fetcher, deps.llm, deps.settings, tracer=t,
                           apollo=deps.apollo, tavily=deps.tavily, site_result=site)
        t.add_usage(out.tokens_in, out.tokens_out, out.grounded_requests)
        for doc in out.documents:
            deps.conn.execute(
                "INSERT INTO source_documents(run_id, url, provider, http_status, error, text) VALUES (%s,%s,%s,%s,%s,%s)",
                (state["run_id"], doc.url, "fetch", doc.status, doc.error, doc.text),
            )
        t.update_run(facts=out.facts, providers=out.providers)
        t.event("research", "node_done", {"facts": len(out.facts), "dropped": len(out.dropped),
                                          "providers": out.providers, "failure": out.failure},
                latency_ms=int((time.perf_counter() - start) * 1000), tokens_in=out.tokens_in,
                tokens_out=out.tokens_out)
        return {"facts": out.facts, "sources": out.sources, "providers": out.providers, "failure": out.failure}

    def after_research(state: RunState) -> str:
        if state.get("failure"):
            return "fail"
        if not state.get("facts"):
            return "refuse"
        return "score"

    def refuse(state: RunState) -> dict:
        reason = state.get("refusal") or "zero verified facts: no brief drafted, no model call made"
        t = tracer(state)
        t.update_run(status="refused", status_reason=reason)
        t.event("refuse", "refused", {"reason": reason})
        return {"status": "refused", "refusal": reason}

    def fail(state: RunState) -> dict:
        t = tracer(state)
        t.update_run(status="failed", status_reason=state.get("failure"))
        t.event("fail", "failed_closed", {"reason": state.get("failure")})
        return {"status": "failed"}

    def score(state: RunState) -> dict:
        t = tracer(state)
        start = time.perf_counter()
        result = icp_mod.score(state["facts"], deps.settings.icp_config())
        t.update_run(icp=result)
        t.event("score", "node_done", result, latency_ms=int((time.perf_counter() - start) * 1000))
        return {"icp": result}

    def draft(state: RunState) -> dict:
        t = tracer(state)
        start = time.perf_counter()
        facts = state["facts"]
        if not facts:  # defense in depth: never call the model without facts
            return {"refusal": "zero verified facts: no brief drafted, no model call made"}
        prompt = brief_mod.build_prompt(state["account"], facts)
        try:
            r = deps.llm.generate_json(deps.settings.model_brief, prompt, brief_mod.BRIEF_SCHEMA, purpose="brief",
                                       context_domain=state["account"]["domain"])
        except MalformedModelOutput as exc:
            t.event("draft", "malformed_output", {"error": str(exc)}, latency_ms=int((time.perf_counter() - start) * 1000))
            return {"failure": f"brief model returned malformed JSON twice: {exc}"}
        except ProviderUnavailable as exc:
            return {"failure": f"model provider unavailable during drafting: {exc}"}
        t.add_usage(r.tokens_in, r.tokens_out)
        validation = brief_mod.validate(r.data or {}, facts, state["sources"], state["account"])
        validation["raw_draft"] = r.data
        validation["model"] = r.model
        validation["attempts"] = r.attempts
        t.update_run(brief=validation["brief"], validation=validation)
        t.event("draft", "node_done", {"claims_total": validation["claims_total"],
                                       "claims_unsupported": validation["claims_unsupported"],
                                       "dropped": validation["dropped"], "attempts": r.attempts},
                latency_ms=int((time.perf_counter() - start) * 1000), tokens_in=r.tokens_in, tokens_out=r.tokens_out)
        kept = validation["brief"]
        if not kept["summary"] and not kept["first_line"]:
            return {"validation": validation, "refusal": "every drafted claim was unsupported and stripped"}
        return {"validation": validation}

    def after_draft(state: RunState) -> str:
        if state.get("failure"):
            return "fail"
        if state.get("refusal"):
            return "refuse"
        return "approval"

    def approval(state: RunState) -> dict:
        t = tracer(state)
        # This node re-runs from the top on resume, so everything before interrupt() is idempotent.
        t.update_run(status="pending_approval")
        decision = interrupt({"run_id": state["run_id"], "brief": state["validation"]["brief"],
                              "icp_total": state["icp"]["total"]})
        return {"decision": decision}

    def finalize(state: RunState) -> dict:
        t = tracer(state)
        d = state.get("decision") or {}
        action = d.get("action")
        if action == "approve":
            final = d.get("edited_brief") or state["validation"]["brief"]
            t.update_run(status="approved", decision="approved", decided_by=d.get("by"), decided_at=d.get("at"),
                         final_brief={**final, "edited_by_human": bool(d.get("edited_brief"))},
                         decision_reason=d.get("reason"))
        elif action == "reject":
            t.update_run(status="rejected", decision="rejected", decided_by=d.get("by"), decided_at=d.get("at"),
                         decision_reason=d.get("reason") or "no reason given")
        else:
            raise ValueError(f"unknown decision {d!r}")
        t.event("approval", "decision", {"action": action, "by": d.get("by"), "reason": d.get("reason"),
                                         "edited": bool(d.get("edited_brief"))})
        return {"status": "approved" if action == "approve" else "rejected"}

    g = StateGraph(RunState)
    for name, fn in [("research", research), ("refuse", refuse), ("fail", fail), ("score", score),
                     ("draft", draft), ("approval", approval), ("finalize", finalize)]:
        g.add_node(name, fn)
    g.add_edge(START, "research")
    g.add_conditional_edges("research", after_research, {"fail": "fail", "refuse": "refuse", "score": "score"})
    g.add_edge("score", "draft")
    g.add_conditional_edges("draft", after_draft, {"fail": "fail", "refuse": "refuse", "approval": "approval"})
    g.add_edge("approval", "finalize")
    g.add_edge("finalize", END)
    g.add_edge("refuse", END)
    g.add_edge("fail", END)
    return g.compile(checkpointer=checkpointer)
