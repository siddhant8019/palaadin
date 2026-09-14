from paladin.brief import validate
from paladin.research import assign_ids, verify_candidates

from .conftest import ACME_CAREERS, ACME_EXTRACT, ACME_HOME

ACCOUNT = {"name": "Acme", "domain": "acme.test"}


def _facts():
    pages = {p.url: p for p in (ACME_HOME, ACME_CAREERS)}
    kept, dropped = verify_candidates(ACME_EXTRACT["facts"], pages)
    # The funding "quote" is not in the page, so research already drops it.
    assert [d["type"] for d in dropped] == ["funding"]
    facts = assign_ids(kept)
    sources = {f["source_url"]: pages[f["source_url"]].text for f in facts}
    return facts, sources


def test_unsupported_claims_are_stripped_and_counted():
    facts, sources = _facts()  # f1 product, f2 hq, f3 headcount
    draft = {
        "summary": [
            {"text": "Acme sells workflow automation software for operations teams.", "fact_ids": ["f1"]},
            {"text": "Acme recently raised a $40M Series B.", "fact_ids": ["f1"]},  # invented specifics
            {"text": "Acme is expanding into Europe.", "fact_ids": []},  # no citation
            {"text": "Acme is based in Denver, Colorado.", "fact_ids": ["f9"]},  # unknown id
        ],
        "first_line": {"text": "Congrats on the Series B, Acme team.", "fact_ids": ["f2"]},
    }
    out = validate(draft, facts, sources, ACCOUNT)
    assert out["claims_total"] == 5
    assert out["claims_unsupported"] == 4
    assert out["unsupported_rate_before"] == 0.8
    assert [c["text"] for c in out["brief"]["summary"]] == ["Acme sells workflow automation software for operations teams."]
    assert out["brief"]["first_line"] is None
    reasons = " | ".join(d["reason"] for d in out["dropped"])
    assert "specific terms not in cited facts" in reasons
    assert "cites no fact ids" in reasons
    assert "unknown fact ids" in reasons


def test_claim_fails_when_stored_source_no_longer_contains_quote():
    facts, sources = _facts()
    tampered = {url: "page changed" for url in sources}
    draft = {"summary": [{"text": "Acme sells workflow automation software for operations teams.", "fact_ids": ["f1"]}],
             "first_line": {}}
    out = validate(draft, facts, tampered, ACCOUNT)
    assert out["claims_unsupported"] == 1
    assert "not found in stored source text" in out["dropped"][0]["reason"]


def test_alphanumeric_tokens_are_not_numbers():
    """Regression: the eval stripped a claim because "B2B" was read as the number "2B"."""
    from paladin.brief import _specific_terms

    assert "2B" not in _specific_terms("Front serves B2B teams.")
    assert "$40M" in _specific_terms("They raised $40M last year.")
    assert "200" in _specific_terms("Over 200 employees.")


def test_supported_numbers_and_names_pass():
    facts, sources = _facts()
    draft = {"summary": [{"text": "Acme has over 200 employees and is headquartered in Denver, Colorado.",
                          "fact_ids": ["f2", "f3"]}], "first_line": {}}
    out = validate(draft, facts, sources, ACCOUNT)
    assert out["claims_unsupported"] == 0
