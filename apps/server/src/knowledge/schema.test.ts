import { describe, expect, test } from "bun:test"
import { InvalidCompanyEventError, parseCompanyEvent } from "./schema"

const event = {
  id: "6db5f9e6-f7a8-41b8-a9e5-6ac1cf16de64",
  organization_id: "33ab7c10-8567-4e77-88ff-699e21e4e3d6",
  source: "linear",
  external_event_id: "AUTH-42",
  external_url: "https://linear.app/cloudberry/issue/AUTH-42",
  event_type: "issue",
  occurred_at: "2026-09-05T06:30:12Z",
  received_at: "2026-09-05T06:30:16Z",
  actor: null,
  title: "Implement Google SSO",
  content: "Implement Google SSO with WorkOS.",
  metadata: {},
  raw_payload: {},
}

describe("parseCompanyEvent", () => {
  test("accepts a canonical event", () => {
    expect(parseCompanyEvent(event)).toEqual(event)
  })

  test("rejects an event without organization scope", () => {
    const { organization_id: _organizationId, ...invalidEvent } = event

    expect(() => parseCompanyEvent(invalidEvent)).toThrow(
      InvalidCompanyEventError
    )
  })
})
