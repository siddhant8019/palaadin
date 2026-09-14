import json
import random

from paladin.icp import score

FACTS = [
    {"id": "f1", "type": "product", "value": "Workflow automation software for operations teams"},
    {"id": "f2", "type": "hq_location", "value": "Denver, Colorado"},
    {"id": "f3", "type": "headcount", "value": "201-500 employees"},
    {"id": "f4", "type": "hiring", "value": "Careers page with hiring language is live"},
]


def test_icp_score_is_deterministic(settings):
    config = settings.icp_config()
    first = score(FACTS, config)
    for _ in range(50):
        assert score(FACTS, config) == first
    assert first["total"] == 100
    assert [r["id"] for r in first["rules"] if r["matched"]] == ["headcount_band", "industry_match", "hiring_signal", "geography"]


def test_icp_score_ignores_fact_order(settings):
    config = settings.icp_config()
    base = json.dumps(score(FACTS, config), sort_keys=True)
    rng = random.Random(7)
    for _ in range(20):
        shuffled = FACTS[:]
        rng.shuffle(shuffled)
        assert json.dumps(score(shuffled, config), sort_keys=True) == base


def test_icp_no_evidence_scores_zero(settings):
    out = score([], settings.icp_config())
    assert out["total"] == 0
    assert all(not r["matched"] and r["detail"] == "no supporting fact" for r in out["rules"])


def test_headcount_outside_band(settings):
    out = score([{"id": "f1", "type": "headcount", "value": "12 employees"}], settings.icp_config())
    rule = next(r for r in out["rules"] if r["id"] == "headcount_band")
    assert not rule["matched"] and "outside band" in rule["detail"]
