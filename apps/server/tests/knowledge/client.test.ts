import { describe, expect, test } from "bun:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  KnowledgeClient,
  KnowledgeClientError,
} from "../../src/knowledge/client"

const organizationId = "33ab7c10-8567-4e77-88ff-699e21e4e3d6"
const eventId = "6db5f9e6-f7a8-41b8-a9e5-6ac1cf16de64"

const fakeDatabase = (result: { data: unknown; error: unknown }) => {
  const calls: { name: string; args: unknown }[] = []
  const database = {
    rpc: (name: string, args: unknown) => {
      calls.push({ name, args })
      return {
        abortSignal: () => Promise.resolve(result),
      }
    },
  } as unknown as SupabaseClient

  return { database, calls }
}

describe("KnowledgeClient", () => {
  test("searches company events through the Postgres function", async () => {
    const { database, calls } = fakeDatabase({
      data: [
        {
          id: eventId,
          type: "linear_issue",
          content: "Implement Google SSO\n\nImplement Google SSO with WorkOS.",
          score: 0.4,
          source_event_ids: [eventId],
        },
      ],
      error: null,
    })

    const result = await new KnowledgeClient({ database }).search(
      organizationId,
      "Which SSO provider did we pick?"
    )

    expect(calls).toEqual([
      {
        name: "search_company_knowledge",
        args: {
          p_organization_id: organizationId,
          p_query: "Which SSO provider did we pick?",
          p_limit: 8,
        },
      },
    ])
    expect(result.organization_id).toBe(organizationId)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.source_event_ids).toEqual([eventId])
  })

  test("returns no results when nothing matches", async () => {
    const { database } = fakeDatabase({ data: [], error: null })

    const result = await new KnowledgeClient({ database }).search(
      organizationId,
      "anything"
    )

    expect(result.results).toEqual([])
  })

  test("maps database errors to a knowledge request failure", async () => {
    const { database } = fakeDatabase({
      data: null,
      error: { message: "function does not exist" },
    })

    const error = await new KnowledgeClient({ database })
      .search(organizationId, "anything")
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(KnowledgeClientError)
    expect(error.code).toBe("KNOWLEDGE_REQUEST_FAILED")
  })

  test("rejects rows that break the search result contract", async () => {
    const { database } = fakeDatabase({
      data: [{ id: eventId, type: "linear_issue", content: "", score: -1 }],
      error: null,
    })

    const error = await new KnowledgeClient({ database })
      .search(organizationId, "anything")
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(KnowledgeClientError)
    expect(error.code).toBe("KNOWLEDGE_INVALID_RESPONSE")
  })

  test("rejects an empty query before calling the database", async () => {
    const { database, calls } = fakeDatabase({ data: [], error: null })

    const error = await new KnowledgeClient({ database })
      .search(organizationId, "   ")
      .catch((caught) => caught)

    expect(error.code).toBe("KNOWLEDGE_INVALID_REQUEST")
    expect(calls).toEqual([])
  })
})
