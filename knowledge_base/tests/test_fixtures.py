import json
import unittest
from pathlib import Path

from app.contracts import validate_company_event
from app.graph import build_episode_body


FIXTURE_DIRECTORY = Path(__file__).parent / "fixtures"
FIXTURE_NAMES = (
    "slack-decision.json",
    "linear-task.json",
    "github-pull-request.json",
    "auth-provider-change.json",
)


class SeedFixtureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.events = []
        for fixture_name in FIXTURE_NAMES:
            event = json.loads(
                (FIXTURE_DIRECTORY / fixture_name).read_text(encoding="utf-8")
            )
            validate_company_event(event)
            self.events.append(event)

    def test_fixtures_form_one_organization_scoped_chain(self) -> None:
        organization_ids = {event["organization_id"] for event in self.events}
        self.assertEqual(
            organization_ids,
            {"11111111-1111-4111-8111-111111111111"},
        )
        self.assertEqual(
            [event["source"] for event in self.events],
            ["slack", "linear", "github", "slack"],
        )

    def test_cross_tool_references_are_explicit(self) -> None:
        linear_event = self.events[1]
        github_event = self.events[2]
        change_event = self.events[3]

        self.assertIn(self.events[0]["id"], linear_event["content"])
        self.assertIn("AUTH-123", github_event["content"])
        self.assertIn(self.events[0]["id"], change_event["metadata"]["supersedes_event_id"])

    def test_episode_body_contains_normalized_provenance_but_not_raw_payload(self) -> None:
        event = self.events[0]
        body = build_episode_body(event)

        self.assertIn(event["id"], body)
        self.assertIn(event["external_url"], body)
        self.assertIn(event["content"], body)
        self.assertNotIn(json.dumps(event["raw_payload"], sort_keys=True), body)


if __name__ == "__main__":
    unittest.main()
