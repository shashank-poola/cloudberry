import { describe, expect, test } from "bun:test"
import { assertCompanyEvent } from "@cloudberry/contracts"
import {
  normalizeComposioTrigger,
  withOrganizationScope,
} from "../../src/integrations/composio/normalizer"

describe("Composio event normalization", () => {
  test("creates a company event from a provider payload", () => {
    const event = withOrganizationScope(
      normalizeComposioTrigger({
        provider: "github",
        triggerSlug: "GITHUB_COMMIT_EVENT",
        triggerId: "ti_commit",
        connectedAccountId: "ca_github",
        composioUserId: "11111111-1111-4111-8111-111111111111",
        messageId: "msg_123",
        payload: {
          sha: "abc123",
          message: "Fix the integration flow",
          html_url: "https://github.com/acme/cloudberry/commit/abc123",
          author: {
            id: "42",
            login: "octocat",
            email: "octocat@example.com",
          },
          timestamp: "2026-09-06T12:00:00Z",
        },
        rawPayload: {
          id: "msg_123",
          type: "composio.trigger.message",
        },
        version: "V3",
        now: () => new Date("2026-09-06T12:01:00Z"),
        createId: () => "11111111-1111-4111-8111-111111111111",
      }),
      "11111111-1111-4111-8111-111111111111"
    )

    expect(assertCompanyEvent(event)).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      organization_id: "11111111-1111-4111-8111-111111111111",
      source: "github",
      external_event_id: "ca_github:msg_123",
      event_type: "github_commit_event",
      external_url: "https://github.com/acme/cloudberry/commit/abc123",
      title: null,
      content: "Fix the integration flow",
      actor: {
        id: "42",
        name: "octocat",
        email: "octocat@example.com",
      },
      occurred_at: "2026-09-06T12:00:00.000Z",
      received_at: "2026-09-06T12:01:00.000Z",
    })
  })

  test("keeps events valid when provider payloads have no known text fields", () => {
    const event = withOrganizationScope(
      normalizeComposioTrigger({
        provider: "linear",
        triggerSlug: "LINEAR_ISSUE_UPDATED",
        triggerId: "ti_issue",
        connectedAccountId: "ca_linear",
        composioUserId: null,
        messageId: "msg_issue",
        payload: { issue: { id: "issue-1", state: "started" } },
        rawPayload: { id: "msg_issue" },
        now: () => new Date("2026-09-06T12:01:00Z"),
        createId: () => "22222222-2222-4222-8222-222222222222",
      }),
      "11111111-1111-4111-8111-111111111111"
    )

    expect(assertCompanyEvent(event).content).toContain("issue-1")
    expect(event.external_url).toBeNull()
    expect(event.actor).toBeNull()
  })
})
