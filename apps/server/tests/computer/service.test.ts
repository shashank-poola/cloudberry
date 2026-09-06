import { describe, expect, test } from "bun:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ComputerService,
  type ComputerServiceDependencies,
} from "../../src/computer/service"
import type { PrizedClient } from "../../src/prized/client"

type Row = Record<string, unknown>
type QueryResult = { data: unknown; error: Row | null }

class MemoryQuery {
  private operation: "select" | "update" = "select"
  private values: Row | null = null
  private readonly filters: Array<{ key: string; value: unknown }> = []
  private maximum: number | null = null

  constructor(private readonly rows: Row[]) {}

  select() {
    return this
  }

  update(values: Row) {
    this.operation = "update"
    this.values = values
    return this
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, value })
    return this
  }

  limit(value: number) {
    this.maximum = value
    return this
  }

  async maybeSingle(): Promise<QueryResult> {
    const result = await this.execute()
    if (result.error) return result
    const rows = Array.isArray(result.data) ? result.data : []
    return { data: rows[0] ?? null, error: null }
  }

  async single(): Promise<QueryResult> {
    const result = await this.execute()
    if (result.error) return result
    const rows = Array.isArray(result.data) ? result.data : []
    return { data: rows[0] ?? null, error: null }
  }

  private matchingRows() {
    const filtered = this.rows.filter((row) =>
      this.filters.every((filter) => row[filter.key] === filter.value)
    )
    return this.maximum === null ? filtered : filtered.slice(0, this.maximum)
  }

  private async execute(): Promise<QueryResult> {
    const matching = this.matchingRows()
    if (this.operation === "update") {
      for (const row of matching) Object.assign(row, this.values ?? {})
    }
    return { data: matching, error: null }
  }
}

class MemoryDatabase {
  constructor(readonly rows: Row[]) {}

  from() {
    return new MemoryQuery(this.rows)
  }
}

describe("ComputerService", () => {
  test("keeps Prized status independent from legacy Codex metadata", async () => {
    const database = new MemoryDatabase([
      {
        id: "computer-1",
        organization_id: "organization-1",
        provider: "prized",
        external_box_id: "box-1",
        edge_url: "https://edge.prized.test",
        status: "paused",
        metadata: {
          codex_connected: true,
          retained_setting: "keep-me",
        },
      },
    ])
    const prized = {
      getBox: async (boxId: string) => {
        expect(boxId).toBe("box-1")
        return {
          box: {
            id: "box-1",
            observedState: "running",
          },
        }
      },
    } as unknown as PrizedClient
    const dependencies: ComputerServiceDependencies = {
      database: database as unknown as SupabaseClient,
      prized,
    }

    const result = await new ComputerService(dependencies).getStatus(
      "organization-1"
    )

    expect(result.computer).toMatchObject({
      organization_id: "organization-1",
      provider: "prized",
      box_id: "box-1",
      status: "running",
      metadata: {
        retained_setting: "keep-me",
        observedState: "running",
      },
    })
    expect(result.computer?.metadata).not.toHaveProperty("codex_connected")
    expect(database.rows[0]?.metadata).not.toHaveProperty("codex_connected")
  })
})
