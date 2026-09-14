"""Brief drafting (Gemini) and claim validation (code).

The model may only write claims that cite extracted fact ids. Code then checks each claim:
1. it cites at least one fact id,
2. every cited id exists,
3. each cited fact's quote still appears in its stored source text,
4. every number and capitalized proper term in the claim appears in the cited facts
   (value or quote) or in the company name or domain.
Claims that fail are stripped and counted. Zero facts means no draft and no model call.
"""

from __future__ import annotations

import re

from .text import norm, quote_in_source

BRIEF_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"text": {"type": "string"}, "fact_ids": {"type": "array", "items": {"type": "string"}}},
                "required": ["text", "fact_ids"],
            },
        },
        "first_line": {
            "type": "object",
            "properties": {"text": {"type": "string"}, "fact_ids": {"type": "array", "items": {"type": "string"}}},
            "required": ["text", "fact_ids"],
        },
    },
    "required": ["summary", "first_line"],
}

PROMPTS = {
    # Production prompt.
    "constrained": """You write an account brief for an SDR at a company that sells workflow software to operations teams.

Account: {name} ({domain})

Verified facts (the ONLY information you may use):
{facts}

Write:
- "summary": 2 to 4 short claims about the account. Each claim is one sentence and lists the fact ids it relies on in "fact_ids".
- "first_line": one personalized opening line for a cold email (under 30 words) with its "fact_ids".

Rules:
- Use only the facts above. Do not add numbers, names, dates, funding, customers, locations, or events that are not in the cited facts.
- Every claim must cite at least one fact id from the list.
- Do not use em dashes or en dashes.
""",
    # Evaluation ablation only, never used in the shipped path: same facts, but the model is
    # allowed to use its own knowledge. Measures what validation catches when the prompt is loose.
    "loose": """You write a compelling account brief for an SDR at a company that sells workflow software to operations teams.

Account: {name} ({domain})

Research notes:
{facts}

Write:
- "summary": 3 to 5 short, specific, compelling claims about the account. Use the notes and anything else you know about the company (recent news, funding, customers, size, leadership). For each claim, list any note ids it relies on in "fact_ids" (may be empty).
- "first_line": one personalized, specific opening line for a cold email (under 30 words), with "fact_ids".

Do not use em dashes or en dashes.
""",
}

_NUMBER = re.compile(r"\$?\d[\d,.]*%?[kKmMbB]?")
_WORD = re.compile(r"[A-Za-z][A-Za-z0-9&'.+-]*")
# Capitalized words that carry no factual content on their own.
_GENERIC = {
    "i", "we", "our", "you", "your", "they", "their", "it", "its", "the", "a", "an", "and", "or", "for", "with",
    "hi", "hello", "hey", "congrats", "congratulations", "as", "since", "given", "saw", "noticed", "this", "that",
    "their", "with", "while", "how", "what", "when", "is", "are", "if", "in", "on", "at", "by", "to", "from",
    "b2b", "saas", "sdr", "sdrs", "crm", "api", "apis", "ai", "ops",
}


def format_facts(facts: list[dict]) -> str:
    return "\n".join(f'- {f["id"]} [{f["type"]}]: {f["value"]} (quote: "{f["quote"]}")' for f in facts)


def build_prompt(account: dict, facts: list[dict], variant: str = "constrained") -> str:
    return PROMPTS[variant].format(name=account["name"], domain=account["domain"], facts=format_facts(facts))


def _specific_terms(sentence: str) -> list[str]:
    terms = [m.group(0).rstrip(".,") for m in _NUMBER.finditer(sentence)]
    words = list(_WORD.finditer(sentence))
    for i, m in enumerate(words):
        w = m.group(0).rstrip(".,'")
        if not w or not w[0].isupper():
            continue
        prev_text = sentence[: m.start()].rstrip()
        sentence_start = i == 0 or prev_text.endswith((".", "!", "?", ":", '"'))
        if w.lower() in _GENERIC:
            continue
        if sentence_start and not (len(w) > 1 and (w.isupper() or any(c.isupper() for c in w[1:]))):
            continue  # ordinary capitalized first word
        # "London-based" asserts "London": check the capitalized parts of a hyphenated compound.
        parts = [p for p in w.split("-") if p and p[0].isupper()] if "-" in w else [w]
        terms.extend(p for p in parts if p.lower() not in _GENERIC)
    return terms


def _unsupported_terms(text: str, cited: list[dict], account: dict) -> list[str]:
    haystack = norm(" ".join([account["name"], account["domain"]] + [f["value"] + " " + f["quote"] for f in cited]))
    haystack_compact = haystack.replace(",", "")
    missing = []
    for term in _specific_terms(text):
        t = norm(term)
        if t.endswith("'s"):
            t = t[:-2]  # possessive: "PostHog's" is supported by "PostHog"
        if t in haystack or t.replace(",", "") in haystack_compact:
            continue
        missing.append(term)
    return missing


def check_claim(claim: dict, facts_by_id: dict[str, dict], sources: dict[str, str], account: dict) -> str | None:
    """Returns None when supported, else the reason it is not."""
    text = (claim.get("text") or "").strip()
    ids = [i for i in claim.get("fact_ids") or [] if isinstance(i, str)]
    if not text:
        return "empty claim"
    if not ids:
        return "cites no fact ids"
    unknown = [i for i in ids if i not in facts_by_id]
    if unknown:
        return f"cites unknown fact ids {unknown}"
    for i in ids:
        f = facts_by_id[i]
        if not quote_in_source(f["quote"], sources.get(f["source_url"], "")):
            return f"quote for {i} not found in stored source text"
    missing = _unsupported_terms(text, [facts_by_id[i] for i in ids], account)
    if missing:
        return f"specific terms not in cited facts: {missing}"
    return None


def validate(draft: dict, facts: list[dict], sources: dict[str, str], account: dict) -> dict:
    facts_by_id = {f["id"]: f for f in facts}
    kept_summary, dropped = [], []
    claims = list(draft.get("summary") or [])
    for c in claims:
        reason = check_claim(c, facts_by_id, sources, account)
        (dropped.append({"text": c.get("text"), "fact_ids": c.get("fact_ids"), "reason": reason, "part": "summary"})
         if reason else kept_summary.append({"text": c["text"].strip(), "fact_ids": c["fact_ids"]}))
    first = draft.get("first_line") or {}
    first_kept = None
    total = len(claims)
    if first.get("text"):
        total += 1
        reason = check_claim(first, facts_by_id, sources, account)
        if reason:
            dropped.append({"text": first.get("text"), "fact_ids": first.get("fact_ids"), "reason": reason,
                            "part": "first_line"})
        else:
            first_kept = {"text": first["text"].strip(), "fact_ids": first["fact_ids"]}
    unsupported = len(dropped)
    return {
        "brief": {"summary": kept_summary, "first_line": first_kept},
        "claims_total": total,
        "claims_unsupported": unsupported,
        "unsupported_rate_before": round(unsupported / total, 4) if total else 0.0,
        "unsupported_rate_after": 0.0,
        "dropped": dropped,
    }
