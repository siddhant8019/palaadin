"""Runtime settings. Everything comes from environment variables."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env", override=False)

# Price constants in USD per 1M tokens.
# ASSUMPTION: these are placeholders copied from the published Gemini 2.5 Flash
# paid-tier list price (input 0.30, output incl. thinking 2.50 per 1M tokens).
# The configured model may be priced differently. Verify against
# https://ai.google.dev/gemini-api/docs/pricing before quoting cost externally.
PRICE_INPUT_PER_M = float(os.getenv("PALADIN_PRICE_INPUT_PER_M", "0.30"))
PRICE_OUTPUT_PER_M = float(os.getenv("PALADIN_PRICE_OUTPUT_PER_M", "2.50"))
# ASSUMPTION: Google Search grounding list price of 35 USD per 1,000 grounded
# requests (older published paid-tier price). Verify before quoting.
PRICE_GROUNDED_REQUEST = float(os.getenv("PALADIN_PRICE_GROUNDED_REQUEST", "0.035"))


def estimate_cost(tokens_in: int, tokens_out: int, grounded_requests: int = 0) -> float:
    return round(
        tokens_in / 1_000_000 * PRICE_INPUT_PER_M
        + tokens_out / 1_000_000 * PRICE_OUTPUT_PER_M
        + grounded_requests * PRICE_GROUNDED_REQUEST,
        6,
    )


@dataclass
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    model_extract: str = field(default_factory=lambda: os.getenv("PALADIN_MODEL_EXTRACT", "gemini-3.5-flash"))
    model_brief: str = field(default_factory=lambda: os.getenv("PALADIN_MODEL_BRIEF", "gemini-3.5-flash"))
    model_grounded: str = field(default_factory=lambda: os.getenv("PALADIN_MODEL_GROUNDED", "gemini-3.5-flash"))
    grounded_search: bool = field(default_factory=lambda: os.getenv("PALADIN_GROUNDED_SEARCH", "1") == "1")
    apollo_api_key: str = field(default_factory=lambda: os.getenv("APOLLO_API_KEY", ""))
    tavily_api_key: str = field(default_factory=lambda: os.getenv("TAVILY_API_KEY", ""))
    session_secret: str = field(default_factory=lambda: os.getenv("PALADIN_SESSION_SECRET", "dev-only-change-me"))
    icp_config_path: Path = field(
        default_factory=lambda: Path(os.getenv("PALADIN_ICP_CONFIG", str(ROOT / "config" / "icp.json")))
    )
    log_dir: Path = field(default_factory=lambda: Path(os.getenv("PALADIN_LOG_DIR", str(ROOT / "logs"))))

    def icp_config(self) -> dict:
        return json.loads(self.icp_config_path.read_text())


def get_settings() -> Settings:
    return Settings()
