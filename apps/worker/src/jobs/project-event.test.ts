import { describe, expect, test } from "bun:test"
import type { CompanyEvent } from "@cloudberry/contracts"
import { buildEventProjections } from "./project-event"

const event: CompanyEvent = {
  id: "11111111-1111-4111-8111-111111111101",
  organization_id: "11111111-1111-4111-8111-111111111111",
  source: "slack",
  external_event_id: "message-1",
  external_url: "https://slack.example.test/message-1",
  event_type: "message",
  occurred_at: "2026-09-08T10:00:00Z",
  received_at: "2026-09-08T10:01:00Z",
  actor: { name: "Maya Chen" },
  title: "Authentication decision",
  content: "The team decided to use Supabase Auth.",
  metadata: {
    decision_key: "authentication-provider",
    project: "Cloudberry authentication",
    status: "In Progress",
  },
  raw_payload: { message: "The team decided to use Supabase Auth." },
}

describe("Cloudpedia event projections", () => {
  test("creates an update, project, and decision projection", () => {
    const projections = buildEventProjections(event, "2026-09-08T10:02:00.000Z")

    expect(projections.map((projection) => projection.projection_type)).toEqual(
      ["update", "project", "decision"]
    )
    expect(projections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organization_id: event.organization_id,
          source_event_id: event.id,
          projection_type: "project",
          subject_key: "cloudberry authentication",
          payload: expect.objectContaining({
            name: "Cloudberry authentication",
            status: "In progress",
          }),
        }),
        expect.objectContaining({
          projection_type: "decision",
          subject_key: "authentication-provider",
          payload: expect.objectContaining({
            project: "Cloudberry authentication",
          }),
        }),
      ])
    )
  })

  test("always retains the source event and organization scope", () => {
    const projections = buildEventProjections(event)

    for (const projection of projections) {
      expect(projection.source_event_id).toBe(event.id)
      expect(projection.organization_id).toBe(event.organization_id)
    }
  })

  test("derives Linear project context from a Composio V3 payload", () => {
    const projections = buildEventProjections({
      ...event,
      id: "11111111-1111-4111-8111-111111111105",
      source: "linear",
      event_type: "linear_public_team_issue_created",
      title: "Implement Supabase Auth",
      content: "Implement Supabase Auth for the Cloudberry workspace.",
      metadata: {
        provider: "linear",
        trigger_slug: "LINEAR_PUBLIC_TEAM_ISSUE_CREATED",
        trigger_id: "ti_linear",
        connected_account_id: "ca_linear",
      },
      raw_payload: {
        id: "msg_linear",
        type: "composio.trigger.message",
        timestamp: "2026-09-08T10:00:00Z",
        metadata: {
          trigger_slug: "LINEAR_PUBLIC_TEAM_ISSUE_CREATED",
          trigger_id: "ti_linear",
          connected_account_id: "ca_linear",
        },
        data: {
          action: "create",
          data: {
            identifier: "AUTH-123",
            title: "Implement Supabase Auth",
            project: {
              id: "linear-project-1",
              name: "Cloudberry authentication",
            },
            state: { id: "linear-state-1", name: "In Progress" },
          },
        },
      },
    })

    expect(projections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projection_type: "project",
          subject_key: "cloudberry authentication",
          payload: expect.objectContaining({
            name: "Cloudberry authentication",
            status: "In progress",
          }),
        }),
      ])
    )
  })

  test("derives GitHub repository context from a Composio V3 payload", () => {
    const projections = buildEventProjections({
      ...event,
      id: "11111111-1111-4111-8111-111111111106",
      source: "github",
      event_type: "github_commit_event",
      title: "Add Supabase Auth integration",
      content: "The commit adds the Supabase Auth integration.",
      external_url: "https://github.com/cloudberry/app/commit/abc123",
      metadata: {
        provider: "github",
        trigger_slug: "GITHUB_COMMIT_EVENT",
        trigger_id: "ti_github",
        connected_account_id: "ca_github",
      },
      raw_payload: {
        id: "msg_github",
        type: "composio.trigger.message",
        timestamp: "2026-09-08T10:00:00Z",
        metadata: {
          trigger_slug: "GITHUB_COMMIT_EVENT",
          trigger_id: "ti_github",
          connected_account_id: "ca_github",
        },
        data: {
          author: "Lee Park",
          id: "abc123",
          message: "Add Supabase Auth integration",
          url: "https://github.com/cloudberry/app/commit/abc123",
        },
      },
    })

    expect(projections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projection_type: "project",
          subject_key: "cloudberry/app",
          payload: expect.objectContaining({
            name: "cloudberry/app",
            status: "Planning",
          }),
        }),
      ])
    )
  })
})
