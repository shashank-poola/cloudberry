import { describe, expect, test } from "bun:test"
import fixture from "../fixtures/company-event.valid.json"
import {
  assertCompanyEvent,
  assertKnowledgeSearchRequest,
  assertKnowledgeSearchResult,
  ContractValidationError,
  validateCompanyEvent,
} from "../src"

describe("CompanyEvent contract", () => {
  test("accepts a complete event", () => {
    expect(validateCompanyEvent(fixture)).toBe(true)
    expect(assertCompanyEvent(fixture)).toEqual(fixture)
  })

  test("rejects a duplicate-prone event without an external id", () => {
    const invalidEvent = {
      ...fixture,
      external_event_id: "",
    }

    expect(validateCompanyEvent(invalidEvent)).toBe(false)
    expect(() => assertCompanyEvent(invalidEvent)).toThrow(
      ContractValidationError
    )
  })

  test("rejects events without organization scope", () => {
    const { organization_id: _organizationId, ...invalidEvent } = fixture

    expect(validateCompanyEvent(invalidEvent)).toBe(false)
  })

  test("accepts the shared search request and result contracts", () => {
    const request = {
      organization_id: fixture.organization_id,
      query: "authentication provider",
      limit: 10,
    }
    const result = {
      organization_id: fixture.organization_id,
      query: request.query,
      retrieved_at: fixture.occurred_at,
      results: [
        {
          id: fixture.id,
          type: "DECIDED",
          content: "The team chose Supabase Auth.",
          score: 1,
          source_event_ids: [fixture.id],
        },
      ],
    }

    expect(assertKnowledgeSearchRequest(request)).toEqual(request)
    expect(assertKnowledgeSearchResult(result)).toEqual(result)
  })
})
