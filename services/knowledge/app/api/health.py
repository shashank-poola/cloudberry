"""Health endpoint for the knowledge service."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health(request: Request) -> JSONResponse:
    settings = request.app.state.settings
    graph = request.app.state.knowledge_graph
    graph_available = False

    if graph is not None:
        try:
            await graph.health_check()
            graph_available = True
        except Exception:
            logger.warning("FalkorDB health check failed", exc_info=False)

    healthy = (
        graph_available
        and settings.llm_configured
        and settings.embedding_configured
        and settings.service_token_configured
    )
    payload = {
        "status": "ok" if healthy else "degraded",
        "api": "ok",
        "falkordb": {
            "configured": settings.falkordb_configured,
            "available": graph_available,
        },
        "llm": {
            "configured": settings.llm_configured,
            "base_url": settings.graphiti_llm_base_url,
            "model": settings.graphiti_llm_model,
        },
        "embedding": {
            "configured": settings.embedding_configured,
            "provider": settings.graphiti_embedding_provider,
            "model": settings.graphiti_embedding_model,
            "dimensions": settings.graphiti_embedding_dim,
        },
        "authentication": {"configured": settings.service_token_configured},
    }
    return JSONResponse(status_code=200 if healthy else 503, content=payload)
