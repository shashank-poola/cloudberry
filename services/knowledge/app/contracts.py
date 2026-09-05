"""Validation for contracts shared with the TypeScript application."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


_ROOT_DIRECTORY = Path(__file__).resolve().parents[3]
_SCHEMA_DIRECTORY = _ROOT_DIRECTORY / "packages" / "contracts" / "schemas"


class ContractValidationError(ValueError):
    """Raised when a payload does not conform to a Cloudberry contract."""


@lru_cache(maxsize=None)
def _validator(schema_name: str) -> Draft202012Validator:
    schema_path = _SCHEMA_DIRECTORY / schema_name

    with schema_path.open(encoding="utf-8") as schema_file:
        schema = json.load(schema_file)

    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_contract(schema_name: str, payload: Any) -> None:
    """Validate a payload against a canonical JSON Schema contract."""

    errors = sorted(
        _validator(schema_name).iter_errors(payload),
        key=lambda error: list(error.path),
    )

    if not errors:
        return

    details = "; ".join(
        f"/{'/'.join(str(part) for part in error.path) or ''} {error.message}"
        for error in errors
    )
    raise ContractValidationError(details)


def validate_company_event(payload: Any) -> None:
    validate_contract("company-event.v1.json", payload)


def validate_knowledge_search_request(payload: Any) -> None:
    validate_contract("knowledge-search.v1.json", payload)


def validate_knowledge_search_result(payload: Any) -> None:
    validate_contract("knowledge-result.v1.json", payload)
