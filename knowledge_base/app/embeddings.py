"""Local embedding and reranking clients used by Graphiti."""

from __future__ import annotations

import asyncio
import math
from collections.abc import Iterable
from typing import Any

from graphiti_core.cross_encoder.client import CrossEncoderClient
from graphiti_core.embedder.client import EmbedderClient


class FastEmbedder(EmbedderClient):
    """Run a small CPU-friendly FastEmbed model behind Graphiti's async API."""

    def __init__(
        self,
        model_name: str,
        embedding_dim: int,
        cache_dir: str | None = None,
    ) -> None:
        try:
            from fastembed import TextEmbedding
        except ImportError as error:
            raise RuntimeError(
                "fastembed is required for local Graphiti embeddings; "
                "install the knowledge service dependencies first"
            ) from error

        self.model_name = model_name
        self.embedding_dim = embedding_dim
        self._model: Any = TextEmbedding(
            model_name=model_name,
            cache_dir=cache_dir,
            lazy_load=True,
        )
        self._model_lock = asyncio.Lock()

    async def warm_up(self) -> None:
        """Load the model and validate its dimension before serving requests."""
        await self.create("Cloudberry embedding health check")

    async def create(
        self,
        input_data: str | list[str] | Iterable[int] | Iterable[Iterable[int]],
    ) -> list[float]:
        texts = _coerce_texts(input_data)
        vectors = await self._encode(texts)
        return vectors[0]

    async def create_batch(self, input_data_list: list[str]) -> list[list[float]]:
        if not input_data_list:
            return []
        return await self._encode(input_data_list)

    async def _encode(self, texts: list[str]) -> list[list[float]]:
        async with self._model_lock:
            raw_vectors = await asyncio.to_thread(
                lambda: list(self._model.embed(texts))
            )

        vectors: list[list[float]] = []
        for raw_vector in raw_vectors:
            vector = raw_vector.tolist() if hasattr(raw_vector, "tolist") else raw_vector
            normalized = [float(value) for value in vector]
            if len(normalized) != self.embedding_dim:
                raise ValueError(
                    f"Embedding model {self.model_name!r} returned "
                    f"{len(normalized)} dimensions; expected {self.embedding_dim}"
                )
            if not all(math.isfinite(value) for value in normalized):
                raise ValueError(
                    f"Embedding model {self.model_name!r} returned a non-finite value"
                )
            vectors.append(normalized)

        if len(vectors) != len(texts):
            raise ValueError(
                f"Embedding model {self.model_name!r} returned {len(vectors)} vectors "
                f"for {len(texts)} inputs"
            )

        return vectors


class EmbeddingReranker(CrossEncoderClient):
    """Rerank candidates with the same local embedding model used for search."""

    def __init__(self, embedder: FastEmbedder) -> None:
        self._embedder = embedder

    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        if not passages:
            return []

        vectors = await self._embedder.create_batch([query, *passages])
        query_vector = vectors[0]
        ranked = [
            (passage, _cosine_similarity(query_vector, passage_vector))
            for passage, passage_vector in zip(passages, vectors[1:], strict=True)
        ]
        ranked.sort(key=lambda result: result[1], reverse=True)
        return ranked


def _coerce_texts(
    input_data: str | list[str] | Iterable[int] | Iterable[Iterable[int]],
) -> list[str]:
    if isinstance(input_data, str):
        return [input_data]

    texts = list(input_data)
    if not all(isinstance(text, str) for text in texts):
        raise TypeError("FastEmbedder accepts text strings only")
    if not texts:
        raise ValueError("At least one text is required for embedding")
    return texts


def _cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    dot_product = sum(a * b for a, b in zip(vector_a, vector_b, strict=True))
    norm_a = math.sqrt(sum(value * value for value in vector_a))
    norm_b = math.sqrt(sum(value * value for value in vector_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)
