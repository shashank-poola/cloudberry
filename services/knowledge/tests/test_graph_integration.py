import json
import os
from pathlib import Path

import pytest
import pytest_asyncio

from app.config import Settings
from app.graph import KnowledgeGraph


FIXTURE_DIRECTORY = Path(__file__).parent / "fixtures"
FIXTURE_NAMES = (
    "slack-decision.json",
    "linear-task.json",
    "github-pull-request.json",
    "auth-provider-change.json",
)
LIVE_GRAPH_CONFIGURED = (
    Settings.from_env().graph_configured
    and os.getenv("RUN_LIVE_GRAPH_TESTS", "").strip().lower()
    in {"1", "true", "yes", "on"}
)

pytestmark = pytest.mark.skipif(
    not LIVE_GRAPH_CONFIGURED,
    reason=(
        "requires hosted FalkorDB/provider configuration and "
        "RUN_LIVE_GRAPH_TESTS=true"
    ),
)


@pytest_asyncio.fixture
async def knowledge_graph():
    graph = KnowledgeGraph(Settings.from_env())
    await graph.start()
    try:
        yield graph
    finally:
        await graph.close()


def load_events() -> list[dict]:
    return [
        json.loads((FIXTURE_DIRECTORY / name).read_text(encoding="utf-8"))
        for name in FIXTURE_NAMES
    ]


@pytest.mark.asyncio
async def test_seed_chain_is_idempotent_scoped_and_traceable(knowledge_graph):
    events = load_events()
    organization_id = events[0]["organization_id"]

    for event in events:
        await knowledge_graph.ingest_event(event)

    assert await knowledge_graph.ingest_event(events[0]) is False
    assert await knowledge_graph._episode_exists(organization_id, events[0]["id"])
    assert not await knowledge_graph._episode_exists(
        "22222222-2222-4222-8222-222222222222", events[0]["id"]
    )

    results = await knowledge_graph.search(organization_id, "authentication provider", 10)
    source_ids = {
        source_id
        for result in results
        for source_id in result["source_event_ids"]
    }

    assert source_ids.intersection({event["id"] for event in events})
    assert any(events[3]["id"] in result["source_event_ids"] for result in results)

    other_results = await knowledge_graph.search(
        "22222222-2222-4222-8222-222222222222",
        "authentication provider",
        10,
    )
    assert all(
        not set(result["source_event_ids"]).intersection(source_ids)
        for result in other_results
    )
