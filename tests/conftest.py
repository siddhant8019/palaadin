"""Test fixtures. Fakes here are LABELED FAKES used only in tests; the shipped path uses Gemini and httpx."""

from __future__ import annotations

import copy
import os

import pytest

os.environ.setdefault("TEST_DATABASE_URL", "postgresql://postgres@localhost:5545/paladin_test")
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["PALADIN_GROUNDED_SEARCH"] = "0"
os.environ.pop("GOOGLE_GENAI_USE_VERTEXAI", None)  # tests never call a real model
os.environ.pop("APOLLO_API_KEY", None)
os.environ.pop("TAVILY_API_KEY", None)

from paladin.config import get_settings  # noqa: E402
from paladin.db import connect, migrate  # noqa: E402
from paladin.fetch import Page, SiteResult  # noqa: E402
from paladin.graph import Deps  # noqa: E402
from paladin.llm import LLMResult, MalformedModelOutput  # noqa: E402

TABLES = "trace_events, source_documents, runs, batch_accounts, accounts, batches, operators"


@pytest.fixture(scope="session")
def settings():
    s = get_settings()
    migrate(s.database_url)
    return s


@pytest.fixture
def conn(settings):
    c = connect(settings.database_url)
    c.execute(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE")
    for t in ("checkpoint_writes", "checkpoint_blobs", "checkpoints"):
        c.execute(f"TRUNCATE {t}")
    yield c
    c.close()


class FakeLLM:
    """LABELED FAKE. Scripted responses per purpose; records every call."""

    def __init__(self, extract=None, brief=None, malformed=()):
        self.extract = extract
        self.brief = brief
        self.malformed = set(malformed)
        self.calls: list[str] = []

    def generate_json(self, model, prompt, schema, purpose, context_domain=None, max_attempts=2):
        self.calls.append(purpose)
        if purpose in self.malformed:
            raise MalformedModelOutput("attempt 1: malformed JSON; attempt 2: malformed JSON")
        data = self.extract if purpose == "extract" else self.brief
        return LLMResult(data=copy.deepcopy(data), tokens_in=100, tokens_out=20, attempts=1, model="fake")

    def grounded_search(self, model, prompt):
        self.calls.append("grounded")
        raise AssertionError("grounded search is disabled in tests")


class FakeFetcher:
    """LABELED FAKE. Returns canned pages instead of hitting the network."""

    def __init__(self, pages_by_domain: dict[str, list[Page]]):
        self.pages_by_domain = pages_by_domain
        self.calls: list[str] = []

    def fetch_site(self, domain):
        self.calls.append(domain)
        return SiteResult(domain=domain, robots="fake", pages=self.pages_by_domain.get(domain, []))

    def fetch_url(self, url):
        return Page(url=url, requested_url=url, error="fake: not available")


ACME_HOME = Page(
    url="https://acme.test/",
    requested_url="https://acme.test/",
    status=200,
    text="Acme Flow. Acme builds workflow automation software for operations teams. "
    "Headquartered in Denver, Colorado. Over 200 employees worldwide.",
)
ACME_CAREERS = Page(
    url="https://acme.test/careers",
    requested_url="https://acme.test/careers",
    status=200,
    text="Careers at Acme. We're hiring across engineering and sales. View all jobs.",
)

ACME_EXTRACT = {
    "facts": [
        {"type": "product", "value": "Workflow automation software for operations teams",
         "quote": "workflow automation software for operations teams", "source_url": "https://acme.test/"},
        {"type": "hq_location", "value": "Denver, Colorado", "quote": "Headquartered in Denver, Colorado",
         "source_url": "https://acme.test/"},
        {"type": "headcount", "value": "Over 200 employees", "quote": "Over 200 employees worldwide",
         "source_url": "https://acme.test/"},
        {"type": "funding", "value": "Raised a Series B", "quote": "raised a $40M Series B",
         "source_url": "https://acme.test/"},
    ]
}


def acme_brief(first_line_ids=("f2",)):
    return {
        "summary": [
            {"text": "Acme sells workflow automation software for operations teams.", "fact_ids": ["f2"]},
            {"text": "Acme is headquartered in Denver, Colorado.", "fact_ids": ["f3"]},
        ],
        "first_line": {"text": "Saw Acme builds workflow automation for operations teams.", "fact_ids": list(first_line_ids)},
    }


@pytest.fixture
def make_deps(conn, settings):
    def _make(llm, fetcher):
        return Deps(conn=conn, settings=settings, llm=llm, fetcher=fetcher)

    return _make


@pytest.fixture
def acme_account(conn):
    from paladin.ingest import ingest

    res = ingest(conn, "t.csv", "company name,domain\nAcme,acme.test\n", "test")
    row = conn.execute("SELECT id, name, domain FROM accounts WHERE domain = 'acme.test'").fetchone()
    return {**row, "batch_id": res["batch_id"]}
