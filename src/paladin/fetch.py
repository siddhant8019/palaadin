"""Polite website fetcher: robots.txt, timeouts, size caps, no JS execution."""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "PaladinResearchBot/1.0 (+https://github.com/siddhant8019/palaadin)"
SITE_PATHS = ["/", "/about", "/about-us", "/company", "/careers", "/jobs", "/customers", "/pricing"]
MAX_BYTES = 2_000_000
MAX_TEXT_CHARS = 40_000
TIMEOUT = httpx.Timeout(10.0, connect=5.0)


@dataclass
class Page:
    url: str
    requested_url: str
    status: int | None = None
    text: str = ""
    error: str | None = None
    latency_ms: int = 0

    def ok(self) -> bool:
        return self.error is None and self.status is not None and 200 <= self.status < 300 and bool(self.text)


@dataclass
class SiteResult:
    domain: str
    robots: str
    pages: list[Page] = field(default_factory=list)

    def ok_pages(self) -> list[Page]:
        return [p for p in self.pages if p.ok()]

    def summary(self) -> list[dict]:
        return [{k: v for k, v in asdict(p).items() if k != "text"} | {"chars": len(p.text)} for p in self.pages]


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "template", "iframe"]):
        tag.decompose()
    parts = []
    if soup.title and soup.title.string:
        parts.append(soup.title.string.strip())
    for meta_name in ("description", "og:description"):
        meta = soup.find("meta", attrs={"name": meta_name}) or soup.find("meta", attrs={"property": meta_name})
        if meta and meta.get("content"):
            parts.append(meta["content"].strip())
    parts.append(soup.get_text(" ", strip=True))
    return " ".join(parts)[:MAX_TEXT_CHARS]


class SiteFetcher:
    def __init__(self, transport: httpx.BaseTransport | None = None, timeout: httpx.Timeout = TIMEOUT):
        self.client = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.9"},
            follow_redirects=True,
            timeout=timeout,
            transport=transport,
        )

    def _get(self, url: str) -> Page:
        start = time.perf_counter()
        page = Page(url=url, requested_url=url)
        try:
            with self.client.stream("GET", url) as resp:
                page.status = resp.status_code
                page.url = str(resp.url)
                ctype = resp.headers.get("content-type", "")
                if resp.status_code >= 400:
                    page.error = f"http {resp.status_code}"
                elif "html" not in ctype and "text" not in ctype:
                    page.error = f"unsupported content-type {ctype!r}"
                else:
                    body = bytearray()
                    for chunk in resp.iter_bytes():
                        body.extend(chunk)
                        if len(body) > MAX_BYTES:
                            page.error = f"body over {MAX_BYTES} bytes, truncated"
                            break
                    encoding = resp.encoding or "utf-8"
                    raw = bytes(body[:MAX_BYTES]).decode(encoding, errors="replace")
                    page.text = html_to_text(raw) if "html" in ctype else raw[:MAX_TEXT_CHARS]
                    if page.error and page.text:
                        page.error = None  # truncation is not fatal
        except httpx.TimeoutException as exc:
            page.error = f"timeout: {type(exc).__name__}"
        except httpx.HTTPError as exc:
            page.error = f"network: {type(exc).__name__}: {str(exc)[:160]}"
        page.latency_ms = int((time.perf_counter() - start) * 1000)
        return page

    def _robots(self, base: str) -> tuple[RobotFileParser | None, str]:
        """RFC 9309: 4xx means no restrictions, 5xx or unreachable means disallow everything."""
        page = self._get(urljoin(base, "/robots.txt"))
        parser = RobotFileParser()
        if page.status is not None and 200 <= page.status < 300:
            parser.parse(page.text.splitlines())
            return parser, "parsed"
        if page.status is not None and 400 <= page.status < 500:
            parser.parse([])
            return parser, f"absent (http {page.status}), allow all"
        return None, f"unreachable ({page.error}), disallow all"

    def resolve_redirect(self, url: str, max_hops: int = 3) -> str:
        """Follow Location headers without downloading bodies, so robots.txt is checked on the real site."""
        current = url
        for _ in range(max_hops):
            try:
                resp = self.client.get(current, follow_redirects=False)
            except httpx.HTTPError:
                return current
            location = resp.headers.get("location")
            if resp.status_code not in (301, 302, 303, 307, 308) or not location:
                return current
            current = urljoin(current, location)
        return current

    def fetch_url(self, url: str) -> Page:
        parts = urlsplit(url)
        base = f"{parts.scheme}://{parts.netloc}"
        robots, _ = self._robots(base)
        if robots is None or not robots.can_fetch(USER_AGENT, url):
            return Page(url=url, requested_url=url, error="blocked by robots.txt")
        return self._get(url)

    def fetch_site(self, domain: str, paths: list[str] = SITE_PATHS) -> SiteResult:
        base = f"https://{domain}"
        robots, robots_note = self._robots(base)
        if robots is None:
            # Try the www host before giving up.
            alt = f"https://www.{domain}"
            robots, robots_note = self._robots(alt)
            if robots is not None:
                base = alt
        result = SiteResult(domain=domain, robots=robots_note)
        if robots is None:
            result.pages.append(Page(url=base + "/", requested_url=base + "/", error=f"skipped: robots {robots_note}"))
            return result
        seen_final: set[str] = set()
        for path in paths:
            url = urljoin(base, path)
            if not robots.can_fetch(USER_AGENT, url):
                result.pages.append(Page(url=url, requested_url=url, error="blocked by robots.txt"))
                continue
            page = self._get(url)
            final = page.url.rstrip("/")
            if page.ok() and final in seen_final:
                continue  # redirected to a page we already have
            seen_final.add(final)
            result.pages.append(page)
            if path == "/" and page.error and page.error.startswith(("timeout", "network")):
                result.pages.append(
                    Page(url=base, requested_url=base, error="site unreachable, remaining paths skipped")
                )
                break
        return result
