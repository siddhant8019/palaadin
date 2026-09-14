"""Optional paid enrichment providers. Disabled unless their key is set.

Both return "source documents" (url + text) that go through the same extraction and
quote verification as the company website. Nothing from a provider is trusted as a fact
until a quote is found verbatim in its returned text.
"""

from __future__ import annotations

import json
import time

import httpx

from .fetch import Page

DISABLED = "provider disabled: no key"


class ApolloProvider:
    name = "apollo"
    endpoint = "https://api.apollo.io/api/v1/organizations/enrich"

    def __init__(self, api_key: str, transport: httpx.BaseTransport | None = None):
        self.api_key = api_key
        self.transport = transport

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def fetch(self, domain: str) -> Page:
        url = f"{self.endpoint}?domain={domain}"
        start = time.perf_counter()
        page = Page(url=url, requested_url=url)
        try:
            with httpx.Client(timeout=15.0, transport=self.transport) as client:
                resp = client.get(self.endpoint, params={"domain": domain},
                                  headers={"X-Api-Key": self.api_key, "Cache-Control": "no-cache"})
            page.status = resp.status_code
            if resp.status_code >= 400:
                page.error = f"http {resp.status_code}"
            else:
                org = (resp.json() or {}).get("organization") or {}
                keep = {k: org.get(k) for k in ("name", "industry", "estimated_num_employees", "city", "state",
                                                "country", "short_description", "keywords") if org.get(k)}
                # Flatten to "key: value" lines so quotes can be verified as plain text.
                page.text = "\n".join(f"{k}: {json.dumps(v) if isinstance(v, list) else v}" for k, v in keep.items())
        except httpx.HTTPError as exc:
            page.error = f"network: {type(exc).__name__}"
        page.latency_ms = int((time.perf_counter() - start) * 1000)
        return page


class TavilyProvider:
    name = "tavily"
    endpoint = "https://api.tavily.com/search"

    def __init__(self, api_key: str, transport: httpx.BaseTransport | None = None):
        self.api_key = api_key
        self.transport = transport

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def fetch(self, name: str, domain: str, max_results: int = 5) -> list[Page]:
        start = time.perf_counter()
        try:
            with httpx.Client(timeout=20.0, transport=self.transport) as client:
                resp = client.post(
                    self.endpoint,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"query": f"{name} ({domain}) company headquarters products", "max_results": max_results,
                          "search_depth": "basic"},
                )
            if resp.status_code >= 400:
                return [Page(url=self.endpoint, requested_url=self.endpoint, status=resp.status_code,
                             error=f"http {resp.status_code}")]
            pages = []
            for r in (resp.json() or {}).get("results", []):
                pages.append(Page(url=r.get("url", ""), requested_url=r.get("url", ""), status=200,
                                  text=r.get("content", ""),
                                  latency_ms=int((time.perf_counter() - start) * 1000)))
            return pages
        except httpx.HTTPError as exc:
            return [Page(url=self.endpoint, requested_url=self.endpoint, error=f"network: {type(exc).__name__}")]
