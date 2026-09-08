"""FastAPI entry point for the hosted knowledge service."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from .api.health import router as health_router
from .api.ingest import router as ingest_router
from .api.search import router as search_router
from .config import Settings
from .graph import KnowledgeGraph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    settings = Settings.from_env()
    application.state.settings = settings
    application.state.knowledge_graph = None

    if settings.graph_configured:
        try:
            graph = KnowledgeGraph(settings)
            await graph.start()
            application.state.knowledge_graph = graph
            logger.info("Knowledge graph initialized")
        except Exception:
            # Keep /health available so a deployment can report the real
            # dependency failure instead of claiming the service is ready.
            logger.exception("Knowledge graph initialization failed")
    else:
        logger.warning(
            "Knowledge graph is not configured; missing %s",
            ", ".join(settings.missing_graph_configuration),
        )

    try:
        yield
    finally:
        graph = application.state.knowledge_graph
        if isinstance(graph, KnowledgeGraph):
            await graph.close()


app = FastAPI(
    title="Cloudberry Knowledge Service",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(search_router)


if __name__ == "__main__":
    import uvicorn

    settings = Settings.from_env()
    uvicorn.run(
        "app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=False,
    )
