import { describe, expect, test } from "bun:test"
import type { CompanyEvent } from "@cloudberry/contracts"
import { scopeSeedEvents } from "./seed"

const fixtureOrganizationId = "11111111-1111-4111-8111-111111111111"
const targetOrganizationId = "22222222-2222-4222-8222-222222222222"
const firstEventId = "11111111-1111-4111-8111-111111111101"
const secondEventId = "11111111-1111-4111-8111-111111111102"

const events: CompanyEvent[] = [
  {
    id: firstEventId,
    organization_id: fixtureOrganizationId,
    source: "slack",
    external_event_id: "message-1",
    external_url: null,
    event_type: "message",
    occurred_at: "2026-09-08T10:00:00Z",
    received_at: "2026-09-08T10:01:00Z",
    actor: null,
    title: "Decision",
    content: "The team made a decision.",
    metadata: {},
    raw_payload: {},
  },
  {
    id: secondEventId,
    organization_id: fixtureOrganizationId,
    source: "linear",
    external_event_id: "issue-1",
    external_url: null,
    event_type: "issue",
    occurred_at: "2026-09-08T11:00:00Z",
    received_at: "2026-09-08T11:01:00Z",
    actor: null,
    title: "Follow-up",
    content: `This follows ${firstEventId}.`,
    metadata: { supersedes_event_id: firstEventId },
    raw_payload: { related_event_id: firstEventId },
  },
]

describe("fixture organization scoping", () => {
  test("rewrites organization and internal event references", () => {
    const scoped = scopeSeedEvents(events, targetOrganizationId)
    const scopedFirst = scoped[0]
    const scopedSecond = scoped[1]

    const scopedFirstId = scopedFirst?.id ?? ""
    expect(scopedFirst?.organization_id).toBe(targetOrganizationId)
    expect(scopedSecond?.organization_id).toBe(targetOrganizationId)
    expect(scopedFirstId).not.toBe(firstEventId)
    expect(scopedSecond?.id).not.toBe(secondEventId)
    expect(scopedSecond?.content).toContain(scopedFirstId)
    expect(scopedSecond?.metadata.supersedes_event_id).toBe(scopedFirstId)
    expect(scopedSecond?.raw_payload).toEqual({
      related_event_id: scopedFirstId,
    })
  })

  test("keeps fixture IDs when explicitly targeting the fixture organization", () => {
    expect(scopeSeedEvents(events, fixtureOrganizationId)).toEqual(events)
  })
})
