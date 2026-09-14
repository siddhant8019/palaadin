"""Text normalization shared by fact verification and claim validation."""

from __future__ import annotations

import re

_TRANSLATE = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2013": "-",
        "\u2014": "-",
        "\u00a0": " ",
        "\u2009": " ",
        "\u202f": " ",
        "\u200b": "",
    }
)
_WS = re.compile(r"\s+")


def norm(text: str) -> str:
    return _WS.sub(" ", (text or "").translate(_TRANSLATE)).strip().lower()


def quote_in_source(quote: str, source_text: str, min_len: int = 8) -> bool:
    """A quote counts only if it is long enough to mean something and appears verbatim (after normalization)."""
    q = norm(quote)
    return len(q) >= min_len and q in norm(source_text)
