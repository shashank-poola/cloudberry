"""Internal organization-scoped knowledge search endpoint."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from ..auth import require_service_token
from ..contracts import (
    ContractValidationError,
    validate_knowledge_search_request,
    validate_knowledge_search_result,
)
from ..graph import KnowledgeGraph

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/internal/v1/search",
    dependencies=[Depends(require_service_token)],
)
async def search_knowledge(
    request: Request,
    payload: Any = Body(...),
) -> dict[str, Any]:
    try:
        validate_knowledge_search_request(payload)
    except ContractValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    graph = request.app.state.knowledge_graph
    if not isinstance(graph, KnowledgeGraph):
        raise HTTPException(status_code=503, detail="Knowledge graph is unavailable")

    try:
        results = await graph.search(
            organization_id=payload["organization_id"],
            query=payload["query"],
            limit=payload["limit"],
        )
    except Exception as error:
        logger.exception("Knowledge search failed")
        raise HTTPException(status_code=502, detail="Knowledge search failed") from error

    response = {
        "organization_id": payload["organization_id"],
        "query": payload["query"],
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }

    try:
        validate_knowledge_search_result(response)
    except ContractValidationError as error:
        logger.exception("Knowledge search returned an invalid contract")
        raise HTTPException(
            status_code=502,
            detail="Knowledge search returned invalid data",
        ) from error

    return response
