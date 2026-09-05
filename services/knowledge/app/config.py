"""Runtime configuration for the hosted knowledge service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_SERVICE_DIRECTORY = Path(__file__).resolve().parents[1]
load_dotenv(_SERVICE_DIRECTORY / ".env")

GENERALCOMPUTE_BASE_URL = "https://api.generalcompute.com/v1"
DEFAULT_LLM_MODEL = "gpt-oss-120b"
DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
DEFAULT_EMBEDDING_DIM = 384


class ConfigurationError(ValueError):
    """Raised when an environment variable has an invalid value."""


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default

    try:
        parsed = int(value)
    except ValueError as error:
        raise ConfigurationError(f"{name} must be an integer") from error

    if parsed <= 0:
        raise ConfigurationError(f"{name} must be greater than zero")

    return parsed


def _read_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False

    raise ConfigurationError(f"{name} must be a boolean")


def _read_optional(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def _read_first(*names: str) -> str | None:
    for name in names:
        value = _read_optional(name)
        if value:
            return value
    return None


@dataclass(frozen=True)
class Settings:
    knowledge_service_token: str | None
    falkordb_host: str | None
    falkordb_port: int
    falkordb_username: str | None
    falkordb_password: str | None
    falkordb_database: str
    falkordb_ssl: bool
    graphiti_llm_api_key: str | None
    graphiti_llm_base_url: str | None
    graphiti_llm_model: str
    graphiti_llm_small_model: str
    graphiti_embedding_provider: str
    graphiti_embedding_model: str
    graphiti_embedding_dim: int
    graphiti_embedding_cache_dir: str | None
    service_host: str
    service_port: int

    @classmethod
    def from_env(cls) -> "Settings":
        llm_api_key = _read_first(
            "GRAPHITI_LLM_API_KEY",
            "GENERALCOMPUTE_API_KEY",
            # Keep the old name as a migration alias. A gc_ key defaults to
            # General Compute when no provider URL is supplied below.
            "OPENAI_API_KEY",
        )
        llm_base_url = _read_optional("GRAPHITI_LLM_BASE_URL")
        if llm_base_url is None and llm_api_key and llm_api_key.startswith("gc_"):
            llm_base_url = GENERALCOMPUTE_BASE_URL

        llm_model = _read_optional("GRAPHITI_LLM_MODEL") or DEFAULT_LLM_MODEL

        return cls(
            knowledge_service_token=_read_optional("KNOWLEDGE_SERVICE_TOKEN"),
            falkordb_host=_read_optional("FALKORDB_HOST"),
            falkordb_port=_read_int("FALKORDB_PORT", 6379),
            falkordb_username=_read_optional("FALKORDB_USERNAME"),
            falkordb_password=_read_optional("FALKORDB_PASSWORD"),
            falkordb_database=_read_optional("FALKORDB_DATABASE") or "default_db",
            falkordb_ssl=_read_bool("FALKORDB_SSL", False),
            graphiti_llm_api_key=llm_api_key,
            graphiti_llm_base_url=llm_base_url,
            graphiti_llm_model=llm_model,
            graphiti_llm_small_model=(
                _read_optional("GRAPHITI_LLM_SMALL_MODEL") or llm_model
            ),
            graphiti_embedding_provider=(
                _read_optional("GRAPHITI_EMBEDDING_PROVIDER") or "fastembed"
            ),
            graphiti_embedding_model=(
                _read_optional("GRAPHITI_EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL
            ),
            graphiti_embedding_dim=_read_int(
                "GRAPHITI_EMBEDDING_DIM", DEFAULT_EMBEDDING_DIM
            ),
            graphiti_embedding_cache_dir=_read_optional(
                "GRAPHITI_EMBEDDING_CACHE_DIR"
            ),
            service_host=_read_optional("KNOWLEDGE_SERVICE_HOST") or "0.0.0.0",
            service_port=_read_int("KNOWLEDGE_SERVICE_PORT", 8001),
        )

    @property
    def falkordb_configured(self) -> bool:
        return bool(
            self.falkordb_host
            and self.falkordb_username
            and self.falkordb_password
            and self.falkordb_database
        )

    @property
    def llm_configured(self) -> bool:
        return bool(
            self.graphiti_llm_api_key
            and self.graphiti_llm_base_url
            and self.graphiti_llm_model
            and self.graphiti_llm_small_model
        )

    @property
    def embedding_configured(self) -> bool:
        return bool(
            self.graphiti_embedding_provider == "fastembed"
            and self.graphiti_embedding_model
            and self.graphiti_embedding_dim > 0
        )

    @property
    def service_token_configured(self) -> bool:
        return bool(self.knowledge_service_token)

    @property
    def graph_configured(self) -> bool:
        return (
            self.falkordb_configured
            and self.llm_configured
            and self.embedding_configured
        )

    @property
    def missing_graph_configuration(self) -> list[str]:
        missing: list[str] = []
        if not self.falkordb_host:
            missing.append("FALKORDB_HOST")
        if not self.falkordb_username:
            missing.append("FALKORDB_USERNAME")
        if not self.falkordb_password:
            missing.append("FALKORDB_PASSWORD")
        if not self.falkordb_database:
            missing.append("FALKORDB_DATABASE")
        if not self.graphiti_llm_api_key:
            missing.append("GRAPHITI_LLM_API_KEY")
        if not self.graphiti_llm_base_url:
            missing.append("GRAPHITI_LLM_BASE_URL")
        if not self.graphiti_llm_model:
            missing.append("GRAPHITI_LLM_MODEL")
        if not self.graphiti_llm_small_model:
            missing.append("GRAPHITI_LLM_SMALL_MODEL")
        if self.graphiti_embedding_provider != "fastembed":
            missing.append("GRAPHITI_EMBEDDING_PROVIDER=fastembed")
        if not self.graphiti_embedding_model:
            missing.append("GRAPHITI_EMBEDDING_MODEL")
        if self.graphiti_embedding_dim <= 0:
            missing.append("GRAPHITI_EMBEDDING_DIM")
        return missing
