"""Refusal, fail-closed, and durable interrupt/resume across a simulated process restart."""

from paladin.db import connect
from paladin.fetch import Page
from paladin.graph import Deps
from paladin.runner import Runner, run_batch

from .conftest import ACME_CAREERS, ACME_EXTRACT, ACME_HOME, FakeFetcher, FakeLLM, acme_brief


def test_zero_facts_refuses_without_any_model_call(conn, make_deps, acme_account):
    dead = Page(url="https://acme.test/", requested_url="https://acme.test/", error="timeout: ConnectTimeout")
    llm = FakeLLM(extract=ACME_EXTRACT, brief=acme_brief())
    runner = Runner(make_deps(llm, FakeFetcher({"acme.test": [dead]})))
    result = runner.start(acme_account)
    assert result["status"] == "refused"
    assert llm.calls == []  # neither extraction nor drafting was attempted
    events = [r["event"] for r in conn.execute("SELECT event FROM trace_events WHERE run_id = %s ORDER BY id",
                                               (result["run_id"],)).fetchall()]
    assert "extract_skipped" in events and "refused" in events


def test_extracted_but_unverifiable_facts_refuse_before_drafting(conn, make_deps, acme_account):
    bogus = {"facts": [{"type": "product", "value": "x", "quote": "text that is not on the page",
                        "source_url": "https://acme.test/"}]}
    llm = FakeLLM(extract=bogus, brief=acme_brief())
    result = Runner(make_deps(llm, FakeFetcher({"acme.test": [ACME_HOME]}))).start(acme_account)
    assert result["status"] == "refused"
    assert llm.calls == ["extract"]  # the brief model was never called


def test_malformed_brief_fails_closed_and_batch_continues(conn, make_deps):
    from paladin.ingest import ingest

    batch = ingest(conn, "b.csv", "company name,domain\nAcme,acme.test\nBeta,beta.test\n", "test")["batch_id"]
    beta_home = Page(url="https://beta.test/", requested_url="https://beta.test/", status=200,
                     text="Beta makes workflow automation software for operations teams.")
    fetcher = FakeFetcher({"acme.test": [ACME_HOME], "beta.test": [beta_home]})

    class OneBadAccount(FakeLLM):
        def generate_json(self, model, prompt, schema, purpose, context_domain=None, max_attempts=2):
            self.malformed = {"brief"} if context_domain == "acme.test" else set()
            if purpose == "extract" and context_domain == "beta.test":
                self.calls.append(purpose)
                from paladin.llm import LLMResult
                return LLMResult(data={"facts": [{"type": "product", "value": "Workflow automation software",
                                                  "quote": "workflow automation software for operations teams",
                                                  "source_url": "https://beta.test/"}]}, attempts=1)
            return super().generate_json(model, prompt, schema, purpose, context_domain, max_attempts)

    llm = OneBadAccount(extract=ACME_EXTRACT,
                        brief={"summary": [{"text": "Beta makes workflow automation software.", "fact_ids": ["f1"]}],
                               "first_line": {}})
    results = run_batch(Runner(make_deps(llm, fetcher)), batch)
    by_domain = {r["domain"]: r for r in results}
    assert by_domain["acme.test"]["status"] == "failed"
    assert "malformed JSON" in by_domain["acme.test"]["status_reason"]
    assert by_domain["beta.test"]["status"] == "pending_approval"


def test_interrupt_resume_survives_process_restart(settings, conn, acme_account):
    llm = FakeLLM(extract=ACME_EXTRACT, brief=acme_brief())
    fetcher = FakeFetcher({"acme.test": [ACME_HOME, ACME_CAREERS]})

    # "Process 1": its own connection, runs until the approval interrupt, then goes away.
    conn1 = connect(settings.database_url)
    runner1 = Runner(Deps(conn=conn1, settings=settings, llm=llm, fetcher=fetcher))
    started = runner1.start(acme_account)
    assert started["status"] == "pending_approval"
    run_id = started["run_id"]
    calls_before = list(llm.calls)
    conn1.close()
    del runner1

    # "Process 2": brand new connection, graph, and checkpointer. Nothing shared in memory.
    llm2 = FakeLLM()
    conn2 = connect(settings.database_url)
    runner2 = Runner(Deps(conn=conn2, settings=settings, llm=llm2, fetcher=FakeFetcher({})))
    assert runner2.pending_interrupt(run_id)
    status = runner2.decide(run_id, "approve", by="reviewer@example.com")
    assert status == "approved"
    assert llm2.calls == []  # resume did not redo research or drafting
    assert calls_before == ["extract", "brief"]
    row = conn2.execute("SELECT decided_by, final_brief FROM runs WHERE id = %s", (run_id,)).fetchone()
    assert row["decided_by"] == "reviewer@example.com"
    assert row["final_brief"]["summary"][0]["fact_ids"] == ["f2"]
    assert not runner2.pending_interrupt(run_id)
    conn2.close()


def test_reject_requires_and_stores_reason(conn, make_deps, acme_account):
    runner = Runner(make_deps(FakeLLM(extract=ACME_EXTRACT, brief=acme_brief()),
                              FakeFetcher({"acme.test": [ACME_HOME]})))
    run_id = runner.start(acme_account)["run_id"]
    try:
        runner.decide(run_id, "reject", by="rev")
        raise AssertionError("reject without a reason must fail")
    except ValueError:
        pass
    assert runner.decide(run_id, "reject", by="rev", reason="not in our segment") == "rejected"
    row = conn.execute("SELECT decision, decision_reason FROM runs WHERE id = %s", (run_id,)).fetchone()
    assert row == {"decision": "rejected", "decision_reason": "not in our segment"}
