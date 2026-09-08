import json
import unittest
from pathlib import Path

from app.contracts import (
    ContractValidationError,
    validate_company_event,
    validate_knowledge_search_request,
    validate_knowledge_search_result,
)


class CompanyEventContractTests(unittest.TestCase):
    def setUp(self) -> None:
        fixture_path = (
            Path(__file__).resolve().parents[2]
            / "packages"
            / "contracts"
            / "fixtures"
            / "company-event.valid.json"
        )
        self.event = json.loads(fixture_path.read_text(encoding="utf-8"))

    def test_accepts_the_shared_fixture(self) -> None:
        validate_company_event(self.event)

    def test_rejects_an_event_without_organization_scope(self) -> None:
        self.event.pop("organization_id")

        with self.assertRaises(ContractValidationError):
            validate_company_event(self.event)

    def test_accepts_the_shared_search_contract(self) -> None:
        request = {
            "organization_id": self.event["organization_id"],
            "query": "authentication provider",
            "limit": 10,
        }
        result = {
            "organization_id": request["organization_id"],
            "query": request["query"],
            "retrieved_at": "2025-01-20T16:00:00Z",
            "results": [
                {
                    "id": self.event["id"],
                    "type": "DECIDED",
                    "content": "The team chose Supabase Auth.",
                    "score": 1.0,
                    "source_event_ids": [self.event["id"]],
                }
            ],
        }

        validate_knowledge_search_request(request)
        validate_knowledge_search_result(result)


if __name__ == "__main__":
    unittest.main()
