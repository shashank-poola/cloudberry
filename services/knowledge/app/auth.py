"""Authentication for service-to-service knowledge endpoints."""

from __future__ import annotations

import hmac

from fastapi import HTTPException, Request


def require_service_token(request: Request) -> None:
    """Require the shared token used by the worker and internal API clients."""
    settings = request.app.state.settings
    expected_token = settings.knowledge_service_token

    if not expected_token:
        raise HTTPException(
            status_code=503,
            detail="Knowledge service authentication is not configured",
        )

    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")

    if (
        scheme.lower() != "bearer"
        or not token
        or not hmac.compare_digest(token, expected_token)
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")
