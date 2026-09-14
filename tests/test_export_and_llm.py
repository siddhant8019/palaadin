import csv
import io
from types import SimpleNamespace

import pytest

from paladin.export import COLUMNS, approved_rows, to_hubspot_csv
from paladin.llm import GeminiClient, MalformedModelOutput
from paladin.runner import Runner

from .conftest import ACME_CAREERS, ACME_EXTRACT, ACME_HOME, FakeFetcher, FakeLLM, acme_brief


def test_export_contains_only_approved_in_hubspot_format(conn, make_deps, acme_account):
    from paladin.ingest import ingest

    ingest(conn, "b.csv", "company name,domain\nZed,zed.test\n", "test")
    zed = conn.execute("SELECT id, name, domain FROM accounts WHERE domain = 'zed.test'").fetchone()
    zed_home = ACME_HOME.__class__(url="https://zed.test/", requested_url="https://zed.test/", status=200,
                                          text="Zed builds workflow automation software for operations teams.")
    fetcher = FakeFetcher({"acme.test": [ACME_HOME, ACME_CAREERS], "zed.test": [zed_home]})

    class ZedExtract(FakeLLM):
        def generate_json(self, model, prompt, schema, purpose, context_domain=None, max_attempts=2):
            if purpose == "extract" and context_domain == "zed.test":
                self.extract = {"facts": [{"type": "product", "value": "Workflow automation software",
                                           "quote": "workflow automation software for operations teams",
                                           "source_url": "https://zed.test/"}]}
                self.brief = {"summary": [{"text": "Zed builds workflow automation software.", "fact_ids": ["f1"]}],
                              "first_line": {}}
            return super().generate_json(model, prompt, schema, purpose, context_domain, max_attempts)

    runner = Runner(make_deps(ZedExtract(extract=ACME_EXTRACT, brief=acme_brief()), fetcher))
    acme_run = runner.start(acme_account)["run_id"]
    zed_run = runner.start(zed)["run_id"]
    runner.decide(acme_run, "approve", by="rev@example.com")
    runner.decide(zed_run, "reject", by="rev@example.com", reason="too small")

    body = to_hubspot_csv(approved_rows(conn))
    rows = list(csv.DictReader(io.StringIO(body)))
    assert list(rows[0].keys()) == COLUMNS
    assert len(rows) == 1
    r = rows[0]
    assert r["Company name"] == "Acme" and r["Company Domain Name"] == "acme.test"
    assert r["Description"].startswith("Acme sells workflow automation software")
    assert r["paladin_icp_score"] == "100"
    assert r["paladin_sources"] == "https://acme.test/"
    assert r["paladin_approved_by"] == "rev@example.com"


def test_gemini_client_retries_once_then_fails_closed():
    """LABELED FAKE transport: a stub genai client that always returns broken JSON."""
    client = GeminiClient(api_key="test-not-a-real-key")
    responses = []

    def fake_generate(model, contents, config):
        responses.append(model)
        return SimpleNamespace(text='{"facts": [ {"type": "product"', usage_metadata=None, candidates=[])

    client.client = SimpleNamespace(models=SimpleNamespace(generate_content=fake_generate))
    with pytest.raises(MalformedModelOutput) as exc:
        client.generate_json("gemini-test", "p", {"type": "object"}, purpose="brief")
    assert len(responses) == 2
    assert "attempt 2" in str(exc.value)


def test_gemini_client_recovers_on_second_attempt():
    client = GeminiClient(api_key="test-not-a-real-key")
    texts = iter(['{"summary": [', '{"summary": [], "first_line": {"text": "", "fact_ids": []}}'])
    client.client = SimpleNamespace(models=SimpleNamespace(
        generate_content=lambda model, contents, config: SimpleNamespace(text=next(texts), usage_metadata=None)))
    r = client.generate_json("gemini-test", "p", {"type": "object"}, purpose="brief")
    assert r.attempts == 2 and r.data["summary"] == []
