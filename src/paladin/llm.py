"""The only model provider: Google Gemini via google-genai.

JSON calls retry once on malformed output and then raise, so the caller can fail closed.
Transport errors (429, 5xx) back off and retry separately.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass, field

from google import genai
from google.genai import errors as genai_errors
from google.genai import types


class MalformedModelOutput(Exception):
    pass


class ProviderUnavailable(Exception):
    pass


@dataclass
class LLMResult:
    data: object = None
    text: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    attempts: int = 0
    latency_ms: int = 0
    model: str = ""
    sources: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _usage(resp) -> tuple[int, int]:
    u = getattr(resp, "usage_metadata", None)
    if not u:
        return 0, 0
    out = (u.candidates_token_count or 0) + (u.thoughts_token_count or 0)
    return u.prompt_token_count or 0, out


def _fault_active(purpose: str, context_domain: str | None) -> bool:
    """Test hook for failure engineering. PALADIN_FAULT_MALFORMED_JSON=brief (or extract) corrupts
    every model response for that purpose. PALADIN_FAULT_DOMAIN limits it to one account."""
    purposes = {p.strip() for p in os.getenv("PALADIN_FAULT_MALFORMED_JSON", "").split(",") if p.strip()}
    if purpose not in purposes:
        return False
    only = os.getenv("PALADIN_FAULT_DOMAIN")
    return not only or only == context_domain


def parse_json_text(text: str):
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.S)
    if fence:
        cleaned = fence.group(1)
    return json.loads(cleaned)


class GeminiClient:
    def __init__(self, api_key: str | None = None, max_transport_retries: int = 4):
        self.client = genai.Client(api_key=api_key or os.getenv("GEMINI_API_KEY"))
        self.max_transport_retries = max_transport_retries
        self.calls = 0

    def _call(self, model: str, contents: str, config: types.GenerateContentConfig):
        delay = 5.0
        for attempt in range(self.max_transport_retries + 1):
            try:
                self.calls += 1
                return self.client.models.generate_content(model=model, contents=contents, config=config)
            except genai_errors.APIError as exc:
                code = getattr(exc, "code", None)
                retryable = code in (429, 500, 502, 503, 504)
                if not retryable or attempt == self.max_transport_retries:
                    raise ProviderUnavailable(f"gemini {code}: {str(exc)[:200]}") from exc
                time.sleep(delay)
                delay = min(delay * 2, 60)

    def generate_json(
        self,
        model: str,
        prompt: str,
        schema: dict,
        purpose: str,
        context_domain: str | None = None,
        max_attempts: int = 2,
    ) -> LLMResult:
        result = LLMResult(model=model)
        start = time.perf_counter()
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=schema,
            temperature=0.0,
        )
        for attempt in range(1, max_attempts + 1):
            result.attempts = attempt
            resp = self._call(model, prompt, config)
            tin, tout = _usage(resp)
            result.tokens_in += tin
            result.tokens_out += tout
            text = resp.text or ""
            if _fault_active(purpose, context_domain):
                text = text[: max(1, len(text) // 2)] + "<<injected-corruption"
            result.text = text
            try:
                result.data = parse_json_text(text)
                result.latency_ms = int((time.perf_counter() - start) * 1000)
                return result
            except (json.JSONDecodeError, ValueError) as exc:
                result.errors.append(f"attempt {attempt}: malformed JSON: {exc}")
        result.latency_ms = int((time.perf_counter() - start) * 1000)
        raise MalformedModelOutput("; ".join(result.errors))

    def grounded_search(self, model: str, prompt: str) -> LLMResult:
        """Gemini with the Google Search tool. Returns text plus the web sources Google attached."""
        result = LLMResult(model=model, attempts=1)
        start = time.perf_counter()
        config = types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())], temperature=0.0
        )
        resp = self._call(model, prompt, config)
        result.tokens_in, result.tokens_out = _usage(resp)
        result.text = resp.text or ""
        gm = resp.candidates[0].grounding_metadata if resp.candidates else None
        for chunk in (gm.grounding_chunks if gm and gm.grounding_chunks else []):
            if chunk.web and chunk.web.uri:
                result.sources.append({"uri": chunk.web.uri, "title": chunk.web.title})
        result.latency_ms = int((time.perf_counter() - start) * 1000)
        return result
