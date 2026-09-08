import { describe, expect, test } from "bun:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CloudpediaService,
  type CloudpediaResult,
} from "../../src/cloudpedia/service"

type Row = Record<string, unknown>
type QueryResult = { data: unknown; error: Row | null }

class MemoryQuery implements PromiseLike<QueryResult> {
  private readonly filters: Array<{
    kind: "eq" | "in"
    key: string
    value: unknown
  }> = []
  private maximum: number | null = null

  constructor(private readonly rows: Row[]) {}

  select() {
    return this
  }

  eq(key: string, value: unknown) {
    this.filters.push({ kind: "eq", key, value })
    return this
  }

  in(key: string, value: unknown[]) {
    this.filters.push({ kind: "in", key, value })
    return this
  }

  order() {
    return this
  }

  limit(value: number) {
    this.maximum = value
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const filtered = this.rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.kind === "eq") return row[filter.key] === filter.value
        return (
          Array.isArray(filter.value) && filter.value.includes(row[filter.key])
        )
      })
    )
    const data =
      this.maximum === null ? filtered : filtered.slice(0, this.maximum)
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected)
  }
}

class MemoryDatabase {
  constructor(private readonly rows: Row[]) {}

  from() {
    return new MemoryQuery(this.rows)
  }
}

const projection = (
  organizationId: string,
  projectionType: string,
  subjectKey: string,
  payload: Row
): Row => ({
  id: `${projectionType}-${subjectKey}`,
  organization_id: organizationId,
  projection_type: projectionType,
  subject_key: subjectKey,
  source_event_id: "11111111-1111-4111-8111-111111111101",
  payload,
  updated_at: "2026-09-08T10:01:00Z",
})

describe("CloudpediaService", () => {
  test("returns only projections for the requested organization", async () => {
    const database = new MemoryDatabase([
      projection("org-a", "update", "event-a", {
        source: "slack",
        event_type: "message",
        title: "A decision",
        detail: "Use Supabase Auth.",
        occurred_at: "2026-09-08T10:00:00Z",
        external_url: null,
      }),
      projection("org-a", "project", "cloudberry", {
        source: "linear",
        event_type: "issue",
        title: "Auth task",
        detail: "Implement Auth.",
        occurred_at: "2026-09-08T09:00:00Z",
        name: "Cloudberry",
        status: "In progress",
      }),
      projection("org-b", "update", "event-b", {
        source: "linear",
        event_type: "issue",
        title: "Other company",
        detail: "Must not leak.",
        occurred_at: "2026-09-08T10:00:00Z",
        external_url: null,
      }),
    ])

    const result: CloudpediaResult = await new CloudpediaService(
      database as unknown as SupabaseClient
    ).list("org-a")

    expect(result.updates).toHaveLength(1)
    expect(result.updates[0]?.title).toBe("A decision")
    expect(result.projects).toEqual([
      expect.objectContaining({ name: "Cloudberry", status: "In progress" }),
    ])
    expect(JSON.stringify(result)).not.toContain("Other company")
  })
})
