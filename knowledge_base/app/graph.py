"""Long-lived Graphiti/FalkorDB access for the knowledge service."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from falkordb.asyncio import FalkorDB
from graphiti_core import Graphiti
from graphiti_core.driver.falkordb_driver import FalkorDriver
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.nodes import EpisodeType

from .config import Settings
from .embeddings import EmbeddingReranker, FastEmbedder
from .ontology import (
    ENTITY_TYPES,
    ONTOLOGY_INSTRUCTIONS,
    RELATIONSHIP_TYPE_MAP,
    RELATIONSHIP_TYPES,
)


class KnowledgeGraph:
    """Own one Graphiti client and serialize operations through it.

    Graphiti 0.30.x changes its active driver when an episode is added to a
    FalkorDB group. A single lock keeps that call-scoped mutation safe while
    the root driver remains available for health checks and group setup.
    """

    def __init__(self, settings: Settings):
        if not settings.graph_configured:
            missing = ", ".join(settings.missing_graph_configuration)
            raise ValueError(f"Knowledge graph configuration is incomplete: {missing}")

        falkor_client = FalkorDB(
            host=settings.falkordb_host,
            port=settings.falkordb_port,
            username=settings.falkordb_username,
            password=settings.falkordb_password,
            ssl=settings.falkordb_ssl,
        )
        self._root_driver = FalkorDriver(
            falkor_db=falkor_client,
            database=settings.falkordb_database,
        )

        llm_client = OpenAIGenericClient(
            config=LLMConfig(
                api_key=settings.graphiti_llm_api_key,
                base_url=settings.graphiti_llm_base_url,
                model=settings.graphiti_llm_model,
                small_model=settings.graphiti_llm_small_model,
                temperature=0,
            ),
            # General Compute documents JSON mode, but not OpenAI's strict
            # json_schema response format. The generic client injects the
            # Pydantic schema into the prompt in this mode.
            structured_output_mode="json_object",
        )
        self._embedder = FastEmbedder(
            model_name=settings.graphiti_embedding_model,
            embedding_dim=settings.graphiti_embedding_dim,
            cache_dir=settings.graphiti_embedding_cache_dir,
        )
        self._graphiti = Graphiti(
            graph_driver=self._root_driver,
            llm_client=llm_client,
            embedder=self._embedder,
            cross_encoder=EmbeddingReranker(self._embedder),
        )
        self._group_drivers: dict[str, FalkorDriver] = {}
        self._operation_lock = asyncio.Lock()

    async def start(self) -> None:
        """Validate embeddings and initialize indexes before serving requests."""
        await self._embedder.warm_up()
        await _wait_for_index_initialization(self._root_driver)

    async def health_check(self) -> None:
        """Raise when the hosted FalkorDB connection is unavailable."""
        await self._root_driver.health_check()

    async def close(self) -> None:
        await self._root_driver.close()

    async def ingest_event(self, event: Mapping[str, Any]) -> bool:
        """Add one normalized event and return whether a new episode was written."""
        organization_id = str(event["organization_id"])
        event_id = str(event["id"])

        async with self._operation_lock:
            await self._ensure_group(organization_id)

            if await self._episode_exists(organization_id, event_id):
                return False

            await self._graphiti.add_episode(
                name=event_id,
                episode_body=build_episode_body(event),
                source_description=f"{event['source']} {event['event_type']}",
                reference_time=_parse_datetime(str(event["occurred_at"])),
                source=_episode_type(event),
                group_id=organization_id,
                entity_types=ENTITY_TYPES,
                excluded_entity_types=["Entity"],
                edge_types=RELATIONSHIP_TYPES,
                edge_type_map=RELATIONSHIP_TYPE_MAP,
                custom_extraction_instructions=ONTOLOGY_INSTRUCTIONS,
            )
            return True

    async def search(
        self,
        organization_id: str,
        query: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        async with self._operation_lock:
            await self._ensure_group(organization_id)
            edges = await self._graphiti.search(
                query,
                group_ids=[organization_id],
                num_results=limit,
            )
            episode_event_ids = await self._episode_event_ids(
                organization_id,
                {
                    str(episode_id)
                    for edge in edges[:limit]
                    for episode_id in edge.episodes
                },
            )
            return search_results_to_contract(edges, limit, episode_event_ids)

    async def _ensure_group(self, organization_id: str) -> None:
        group_driver = await self._get_group_driver(organization_id)

        # Graphiti clones its active driver when group_id differs from the
        # driver's database. Activate our tracked driver first so that clone's
        # background index task remains owned and awaited by this service.
        self._graphiti.driver = group_driver
        self._graphiti.clients.driver = group_driver

    async def _get_group_driver(self, organization_id: str) -> FalkorDriver:
        group_driver = self._group_drivers.get(organization_id)
        if group_driver is None:
            group_driver = self._root_driver.clone(database=organization_id)
            await _wait_for_index_initialization(group_driver)
            self._group_drivers[organization_id] = group_driver
        return group_driver

    async def _episode_exists(self, organization_id: str, event_id: str) -> bool:
        group_driver = await self._get_group_driver(organization_id)
        records, _, _ = await group_driver.execute_query(
            """
            MATCH (episode:Episodic {name: $event_id})
            WHERE episode.group_id = $organization_id
            RETURN episode.uuid AS uuid
            LIMIT 1
            """,
            event_id=event_id,
            organization_id=organization_id,
        )
        return bool(records)

    async def _episode_event_ids(
        self,
        organization_id: str,
        episode_uuids: set[str],
    ) -> dict[str, str]:
        if not episode_uuids:
            return {}

        group_driver = await self._get_group_driver(organization_id)
        records, _, _ = await group_driver.execute_query(
            """
            MATCH (episode:Episodic)
            WHERE episode.group_id = $organization_id
              AND episode.uuid IN $episode_uuids
            RETURN episode.uuid AS uuid, episode.name AS name
            """,
            episode_uuids=list(episode_uuids),
            organization_id=organization_id,
        )
        return {
            str(record["uuid"]): str(record["name"])
            for record in records
            if record.get("uuid") is not None and record.get("name") is not None
        }


def build_episode_body(event: Mapping[str, Any]) -> str:
    """Build the normalized text Graphiti receives, excluding raw provider data."""
    actor = event.get("actor")
    actor_text = ""
    if isinstance(actor, Mapping):
        actor_text = str(
            actor.get("name") or actor.get("email") or actor.get("id") or ""
        )

    lines = [
        f"Source event ID: {event['id']}",
        f"External event ID: {event['external_event_id']}",
        f"Source: {event['source']}",
        f"Event type: {event['event_type']}",
        f"Occurred at: {event['occurred_at']}",
    ]

    if event.get("external_url"):
        lines.append(f"Source URL: {event['external_url']}")
    if actor_text:
        lines.append(f"Actor: {actor_text}")
    if event.get("title"):
        lines.append(f"Title: {event['title']}")

    metadata = event.get("metadata")
    if isinstance(metadata, Mapping) and metadata:
        lines.append(f"Metadata: {json.dumps(metadata, sort_keys=True)}")

    lines.extend(["Content:", str(event["content"])])
    return "\n".join(lines)


def search_results_to_contract(
    edges: list[Any],
    limit: int,
    episode_event_ids: Mapping[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Convert Graphiti edges to the shared result contract with episode provenance."""
    results: list[dict[str, Any]] = []
    episode_event_ids = episode_event_ids or {}

    for position, edge in enumerate(edges[:limit]):
        source_event_ids = list(
            dict.fromkeys(
                episode_event_ids.get(str(episode_id), str(episode_id))
                for episode_id in edge.episodes
            )
        )
        if not source_event_ids:
            # A result without an episode cannot satisfy Cloudberry's provenance
            # contract, so it is safer to omit it than return an untraceable fact.
            continue

        results.append(
            {
                "id": str(edge.uuid),
                "type": str(edge.name),
                "content": str(edge.fact),
                # Graphiti's basic search returns ranked edges but not scores.
                # Expose a stable rank score until the service adopts search_.
                "score": 1.0 / (position + 1),
                "source_event_ids": source_event_ids,
            }
        )

    return results


async def _wait_for_index_initialization(driver: FalkorDriver) -> None:
    initialization_task = getattr(driver, "_init_task", None)
    if initialization_task is not None:
        await initialization_task
        return

    await driver.build_indices_and_constraints()


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _episode_type(event: Mapping[str, Any]) -> EpisodeType:
    if event.get("source") == "slack" and event.get("event_type") == "message":
        return EpisodeType.message
    return EpisodeType.text
