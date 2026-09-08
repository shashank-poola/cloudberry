"""Internal event-to-episode endpoint."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from ..auth import require_service_token
from ..contracts import ContractValidationError, validate_company_event
from ..graph import KnowledgeGraph

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/internal/v1/episodes",
    dependencies=[Depends(require_service_token)],
)
async def ingest_episode(
    request: Request,
    payload: Any = Body(...),
) -> dict[str, Any]:
    try:
        validate_company_event(payload)
    except ContractValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    graph = request.app.state.knowledge_graph
    if not isinstance(graph, KnowledgeGraph):
        raise HTTPException(status_code=503, detail="Knowledge graph is unavailable")

    try:
        created = await graph.ingest_event(payload)
    except Exception as error:
        logger.exception("Knowledge episode ingestion failed")
        raise HTTPException(status_code=502, detail="Knowledge episode ingestion failed") from error

    return {
        "event_id": payload["id"],
        "organization_id": payload["organization_id"],
        "ingested": created,
    }
