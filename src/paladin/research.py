"""Research: collect source documents, extract candidate facts with Gemini, keep only verified ones.

A fact survives only if its quote appears verbatim (after whitespace and punctuation
normalization) in the text of the source document it cites.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field

from .fetch import Page, SiteFetcher
from .llm import MalformedModelOutput, ProviderUnavailable
from .text import norm, quote_in_source

FACT_TYPES = ["industry", "product", "customer_segment", "hq_location", "headcount", "hiring", "funding",
              "notable_customer"]
MAX_PROMPT_CHARS = 60_000

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "facts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": FACT_TYPES},
                    "value": {"type": "string"},
                    "quote": {"type": "string"},
                    "source_url": {"type": "string"},
                },
                "required": ["type", "value", "quote", "source_url"],
            },
        }
    },
    "required": ["facts"],
}

EXTRACT_PROMPT = """You extract facts about a company from source documents for a B2B sales researcher.

Company: {name} ({domain})

Rules:
- Use ONLY the documents below. Do not use outside knowledge.
- Every fact needs a "quote": a short span copied character for character from the document text (8 to 200 characters). If you cannot copy a supporting span, do not output the fact.
- "source_url" must be the URL of the document the quote was copied from, exactly as given.
- "value" is a short plain statement of the fact, for example "Project management software for engineering teams".
- Fact types: industry (market or category), product (what they sell), customer_segment (who buys it), hq_location (only if the headquarters or head office is explicitly stated), headcount (only if an employee count is stated), hiring (open roles or an active careers page), funding (only if stated), notable_customer (named customer stated on the page).
- Do not use em dashes or en dashes.
- At most 3 facts per type. If the documents say nothing useful, return an empty list.

Documents:
{documents}
"""

_HIRING_RE = re.compile(
    r"(open roles|open positions|see open positions|we(?:'|’)?re hiring|join (?:our|the) team|current openings"
    r"|view (?:all )?(?:jobs|openings)|careers at|job openings|explore (?:exciting )?career opportunities)",
    re.I,
)


@dataclass
class ResearchOutcome:
    facts: list[dict] = field(default_factory=list)
    dropped: list[dict] = field(default_factory=list)
    sources: dict[str, str] = field(default_factory=dict)  # url -> text, only sources backing kept facts
    documents: list[Page] = field(default_factory=list)
    providers: dict[str, str] = field(default_factory=dict)
    tokens_in: int = 0
    tokens_out: int = 0
    grounded_requests: int = 0
    extract_attempts: int = 0
    failure: str | None = None


def _format_documents(pages: list[Page]) -> str:
    out, budget = [], MAX_PROMPT_CHARS
    for p in pages:
        chunk = p.text[: max(0, budget)]
        if not chunk:
            break
        out.append(f"<document url=\"{p.url}\">\n{chunk}\n</document>")
        budget -= len(chunk)
    return "\n\n".join(out)


def hiring_fact_from_pages(pages: list[Page]) -> dict | None:
    """Code-derived hiring signal: a careers or jobs URL that loaded and contains hiring language."""
    for p in pages:
        if not p.ok():
            continue
        path = p.url.lower()
        if not any(seg in path for seg in ("/careers", "/jobs")):
            continue
        m = _HIRING_RE.search(p.text)
        if not m:
            continue
        # Widen to whole words so the quote reads cleanly and still appears verbatim in the page.
        start = max(0, m.start() - 30)
        end = min(len(p.text), m.end() + 30)
        while start > 0 and not p.text[start - 1].isspace():
            start -= 1
        while end < len(p.text) and not p.text[end].isspace():
            end += 1
        quote = p.text[start:end].strip()
        return {"type": "hiring", "value": "Careers page with hiring language is live", "quote": quote,
                "source_url": p.url, "extracted_by": "code"}
    return None


def verify_candidates(candidates: list[dict], pages_by_url: dict[str, Page]) -> tuple[list[dict], list[dict]]:
    kept, dropped = [], []
    for c in candidates:
        url = (c.get("source_url") or "").strip()
        page = pages_by_url.get(url) or pages_by_url.get(url.rstrip("/")) or pages_by_url.get(url + "/")
        if c.get("type") not in FACT_TYPES:
            dropped.append({**c, "reason": "unknown fact type"})
        elif page is None:
            dropped.append({**c, "reason": "source_url is not a fetched document"})
        elif not quote_in_source(c.get("quote", ""), page.text):
            dropped.append({**c, "reason": "quote not found in source text"})
        else:
            kept.append({**c, "source_url": page.url})
    return kept, dropped


def assign_ids(facts: list[dict]) -> list[dict]:
    seen, out = set(), []
    for f in facts:
        key = (f["type"], norm(f["value"]))
        if key in seen:
            continue
        seen.add(key)
        out.append({"id": f"f{len(out) + 1}", "type": f["type"], "value": f["value"], "quote": f["quote"],
                    "source_url": f["source_url"], "extracted_by": f.get("extracted_by", "gemini")})
    return out


def run_research(account: dict, fetcher: SiteFetcher, llm, settings, tracer=None, apollo=None, tavily=None,
                 site_result=None) -> ResearchOutcome:
    out = ResearchOutcome()
    name, domain = account["name"], account["domain"]

    def ev(event, data=None, **kw):
        if tracer:
            tracer.event("research", event, data, **kw)

    # 1. Company website (default path, no keys needed).
    t0 = time.perf_counter()
    site = site_result or fetcher.fetch_site(domain)
    ok_pages = site.ok_pages()
    out.documents.extend(site.pages)
    out.providers["website"] = f"used: {len(ok_pages)}/{len(site.pages)} pages ok" if ok_pages else "no usable pages"
    ev("site_fetched", {"robots": site.robots, "pages": site.summary()}, latency_ms=int((time.perf_counter() - t0) * 1000))

    pages = list(ok_pages)

    # 2. Optional providers.
    if apollo is not None and apollo.enabled:
        p = apollo.fetch(domain)
        out.documents.append(p)
        out.providers["apollo"] = "used" if p.ok() else f"error: {p.error}"
        if p.ok():
            pages.append(p)
    else:
        out.providers["apollo"] = "provider disabled: no key"
    if tavily is not None and tavily.enabled:
        tp = tavily.fetch(name, domain)
        out.documents.extend(tp)
        good = [p for p in tp if p.ok()]
        out.providers["tavily"] = f"used: {len(good)} results" if good else f"error: {tp[0].error if tp else 'empty'}"
        pages.extend(good)
    else:
        out.providers["tavily"] = "provider disabled: no key"

    # 3. Gemini grounded search: ask for public facts, then fetch each cited page ourselves and verify.
    breaker = getattr(llm, "grounded_disabled_reason", None)
    if settings.grounded_search and breaker:
        out.providers["gemini_grounded_search"] = f"skipped: {breaker}"
        ev("grounded_search_skipped", {"reason": breaker})
    elif settings.grounded_search:
        t1 = time.perf_counter()
        try:
            g = llm.grounded_search(
                settings.model_grounded,
                f"Using Google Search, find public facts about the company {name} with website {domain}: "
                f"what it sells, its industry, where it is headquartered, and approximate employee count. "
                f"Answer in at most 5 short sentences. Do not use dashes.",
            )
            out.grounded_requests += 1
            out.tokens_in += g.tokens_in
            out.tokens_out += g.tokens_out
            fetched = 0
            for src in g.sources[:4]:
                p = fetcher.fetch_url(src["uri"])
                out.documents.append(p)
                if p.ok():
                    fetched += 1
                    pages.append(p)
            out.providers["gemini_grounded_search"] = (
                f"used: {len(g.sources)} sources, {fetched} fetched" if g.sources else "used: returned no sources"
            )
            ev("grounded_search", {"sources": g.sources, "fetched_ok": fetched},
               latency_ms=int((time.perf_counter() - t1) * 1000), tokens_in=g.tokens_in, tokens_out=g.tokens_out)
        except ProviderUnavailable as exc:
            out.providers["gemini_grounded_search"] = f"error: {exc}"
            if "quota" in str(exc).lower():
                # Circuit breaker: stop calling a quota-exhausted provider for the rest of this process.
                try:
                    llm.grounded_disabled_reason = "quota exhausted earlier in this process"
                except AttributeError:
                    pass
            ev("grounded_search_error", {"error": str(exc)}, latency_ms=int((time.perf_counter() - t1) * 1000))
    else:
        out.providers["gemini_grounded_search"] = "disabled: PALADIN_GROUNDED_SEARCH=0"

    candidates: list[dict] = []
    code_hiring = hiring_fact_from_pages(pages)
    if code_hiring:
        candidates.append(code_hiring)

    pages_by_url = {}
    for p in pages:
        pages_by_url[p.url] = p
        pages_by_url[p.url.rstrip("/")] = p

    # 4. Extraction. No usable documents means no model call.
    if pages:
        t2 = time.perf_counter()
        prompt = EXTRACT_PROMPT.format(name=name, domain=domain, documents=_format_documents(pages))
        try:
            r = llm.generate_json(settings.model_extract, prompt, EXTRACT_SCHEMA, purpose="extract",
                                  context_domain=domain)
            out.extract_attempts = r.attempts
            out.tokens_in += r.tokens_in
            out.tokens_out += r.tokens_out
            model_facts = [dict(f, extracted_by="gemini") for f in (r.data or {}).get("facts", [])]
            candidates.extend(model_facts)
            ev("extracted", {"candidates": len(model_facts), "attempts": r.attempts, "model": r.model},
               latency_ms=int((time.perf_counter() - t2) * 1000), tokens_in=r.tokens_in, tokens_out=r.tokens_out)
        except MalformedModelOutput as exc:
            out.failure = f"extraction returned malformed JSON twice: {exc}"
            ev("extract_failed", {"error": str(exc)}, latency_ms=int((time.perf_counter() - t2) * 1000))
            return out
        except ProviderUnavailable as exc:
            out.failure = f"model provider unavailable during extraction: {exc}"
            ev("extract_failed", {"error": str(exc)})
            return out
    else:
        ev("extract_skipped", {"reason": "no usable source documents"})

    kept, dropped = verify_candidates(candidates, pages_by_url)
    out.facts = assign_ids(kept)
    out.dropped = dropped
    out.sources = {f["source_url"]: pages_by_url[f["source_url"]].text for f in out.facts}
    ev("facts_verified", {"kept": len(out.facts), "dropped": len(dropped),
                          "dropped_reasons": [{"type": d.get("type"), "reason": d["reason"]} for d in dropped]})
    return out
