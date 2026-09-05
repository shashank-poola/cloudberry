import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config import GENERALCOMPUTE_BASE_URL, Settings
from app.main import app


class KnowledgeApiTests(unittest.TestCase):
    def test_legacy_gc_key_defaults_to_general_compute(self) -> None:
        with patch.dict(
            os.environ,
            {
                "GRAPHITI_LLM_API_KEY": "",
                "GENERALCOMPUTE_API_KEY": "",
                "OPENAI_API_KEY": "gc_test-key",
                "GRAPHITI_LLM_BASE_URL": "",
                "GRAPHITI_LLM_MODEL": "",
                "GRAPHITI_LLM_SMALL_MODEL": "",
                "GRAPHITI_EMBEDDING_PROVIDER": "fastembed",
                "GRAPHITI_EMBEDDING_MODEL": "BAAI/bge-small-en-v1.5",
                "GRAPHITI_EMBEDDING_DIM": "384",
            },
            clear=False,
        ):
            settings = Settings.from_env()

        self.assertTrue(settings.llm_configured)
        self.assertEqual(settings.graphiti_llm_base_url, GENERALCOMPUTE_BASE_URL)
        self.assertEqual(settings.graphiti_llm_model, "gpt-oss-120b")

    def test_health_is_degraded_without_hosted_dependencies(self) -> None:
        names = (
            "KNOWLEDGE_SERVICE_TOKEN",
            "FALKORDB_HOST",
            "FALKORDB_USERNAME",
            "FALKORDB_PASSWORD",
            "FALKORDB_DATABASE",
            "GRAPHITI_LLM_API_KEY",
            "GENERALCOMPUTE_API_KEY",
            "OPENAI_API_KEY",
            "GRAPHITI_LLM_BASE_URL",
            "GRAPHITI_LLM_MODEL",
            "GRAPHITI_LLM_SMALL_MODEL",
            "GRAPHITI_EMBEDDING_PROVIDER",
            "GRAPHITI_EMBEDDING_MODEL",
            "GRAPHITI_EMBEDDING_DIM",
        )
        environment = {name: os.environ.pop(name, None) for name in names}

        try:
            with TestClient(app) as client:
                response = client.get("/health")
        finally:
            for name, value in environment.items():
                if value is not None:
                    os.environ[name] = value

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "degraded")
        self.assertFalse(response.json()["falkordb"]["available"])

    def test_internal_routes_require_the_service_token(self) -> None:
        with patch.dict(
            os.environ,
            {
                "KNOWLEDGE_SERVICE_TOKEN": "test-token",
                "FALKORDB_HOST": "",
                "FALKORDB_USERNAME": "",
                "FALKORDB_PASSWORD": "",
                "GRAPHITI_LLM_API_KEY": "",
                "GENERALCOMPUTE_API_KEY": "",
                "OPENAI_API_KEY": "",
                "GRAPHITI_LLM_BASE_URL": "",
                "GRAPHITI_LLM_MODEL": "",
                "GRAPHITI_LLM_SMALL_MODEL": "",
                "GRAPHITI_EMBEDDING_PROVIDER": "",
                "GRAPHITI_EMBEDDING_MODEL": "",
                "GRAPHITI_EMBEDDING_DIM": "",
            },
            clear=False,
        ):
            with TestClient(app) as client:
                response = client.post("/internal/v1/search", json={})
                invalid_response = client.post(
                    "/internal/v1/search",
                    headers={"Authorization": "Bearer wrong-token"},
                    json={},
                )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(invalid_response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
