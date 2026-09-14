"""Deterministic ICP scoring in code. Weights live in config/icp.json. The model never scores."""

from __future__ import annotations

import re

from .text import norm

_NUM = re.compile(r"\d[\d,]*")


def _headcount_estimate(value: str) -> int | None:
    nums = [int(n.replace(",", "")) for n in _NUM.findall(value or "")]
    nums = [n for n in nums if 0 < n < 5_000_000]
    if not nums:
        return None
    if len(nums) >= 2:
        return (nums[0] + nums[1]) // 2
    return nums[0]


def score(facts: list[dict], config: dict) -> dict:
    rules_out = []
    total = 0
    max_total = 0
    for rule in config["rules"]:
        weight = int(rule["weight"])
        max_total += weight
        relevant = [f for f in facts if f["type"] in rule.get("fact_types", [])]
        matched_ids: list[str] = []
        detail = "no supporting fact"
        if rule["type"] == "keywords":
            kws = [k.lower() for k in rule["keywords"]]
            hits = set()
            for f in relevant:
                text = norm(f["value"])
                found = [k for k in kws if re.search(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])", text)]
                if found:
                    matched_ids.append(f["id"])
                    hits.update(found)
            if hits:
                detail = "keywords: " + ", ".join(sorted(hits))
        elif rule["type"] == "fact_present":
            matched_ids = [f["id"] for f in relevant]
            if matched_ids:
                detail = f"{len(matched_ids)} fact(s)"
        elif rule["type"] == "headcount_band":
            for f in relevant:
                est = _headcount_estimate(f["value"])
                if est is None:
                    continue
                if rule["min"] <= est <= rule["max"]:
                    matched_ids.append(f["id"])
                    detail = f"estimate {est} in band {rule['min']} to {rule['max']}"
                    break
                detail = f"estimate {est} outside band {rule['min']} to {rule['max']}"
        else:
            raise ValueError(f"unknown rule type {rule['type']}")
        matched = bool(matched_ids)
        points = weight if matched else 0
        total += points
        rules_out.append(
            {"id": rule["id"], "weight": weight, "matched": matched, "points": points,
             "evidence_fact_ids": sorted(matched_ids), "detail": detail}
        )
    return {"total": total, "max": max_total, "config_version": config.get("version"), "rules": rules_out}
