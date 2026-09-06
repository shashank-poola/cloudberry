import { describe, expect, test } from "bun:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ChatService,
  type ChatServiceDependencies,
} from "../../src/chat/service"

type Row = Record<string, unknown>
type QueryResult = { data: Row[]; error: null }
type RpcResult = { data: Row[]; error: null }

class ChatListQuery implements PromiseLike<QueryResult> {
  private readonly filters: Array<{ key: string; value: unknown }> = []
  private readonly orders: Array<{
    key: string
    ascending: boolean
  }> = []
  private maximum: number | null = null

  constructor(private readonly rows: Row[]) {}

  select() {
    return this
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, value })
    return this
  }

  order(key: string, options: { ascending: boolean }) {
    this.orders.push({ key, ascending: options.ascending })
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
    const filtered = this.rows
      .filter((row) =>
        this.filters.every((filter) => row[filter.key] === filter.value)
      )
      .sort((left, right) => {
        for (const order of this.orders) {
          const leftValue = String(left[order.key] ?? "")
          const rightValue = String(right[order.key] ?? "")
          if (leftValue === rightValue) continue
          const comparison = leftValue < rightValue ? -1 : 1
          return order.ascending ? comparison : -comparison
        }
        return 0
      })

    const result = {
      data: this.maximum === null ? filtered : filtered.slice(0, this.maximum),
      error: null,
    } as QueryResult
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

class ChatDatabase {
  lastRpc: { name: string; parameters: Record<string, unknown> } | null = null

  constructor(
    private readonly rows: Row[],
    private readonly searchRows: Row[] = []
  ) {}

  from(table: string) {
    if (table !== "chat_conversations") throw new Error("Unexpected table")
    return new ChatListQuery(this.rows)
  }

  rpc(name: string, parameters: Record<string, unknown>): Promise<RpcResult> {
    this.lastRpc = { name, parameters }
    return Promise.resolve({ data: this.searchRows, error: null })
  }
}

const chat = (
  id: string,
  organizationId: string,
  lastMessageAt: string,
  status: "active" | "archived" = "active"
): Row => ({
  id,
  organization_id: organizationId,
  created_by: "user-1",
  title: id,
  provider: "hosted",
  model: "gpt-oss-120b",
  reasoning_effort: null,
  status,
  last_message_at: lastMessageAt,
  created_at: lastMessageAt,
  updated_at: lastMessageAt,
})

describe("ChatService chat history", () => {
  test("searches through the tenant-scoped database function", async () => {
    const database = new ChatDatabase(
      [],
      [
        {
          chat_id: "chat-a",
          title: "Hey there",
          status: "active",
          message_id: null,
          match_type: "title",
          snippet: "Hey there",
          last_message_at: "2026-09-06T12:00:00.000Z",
        },
      ]
    )
    const dependencies: ChatServiceDependencies = {
      database: database as unknown as SupabaseClient,
      knowledge: { search: async () => ({}) as never },
      generalCompute: { createChatCompletion: async () => ({}) as never },
    }

    const result = await new ChatService(dependencies).searchChats(
      "org-a",
      "hey there"
    )

    expect(result.results).toEqual([
      {
        chat_id: "chat-a",
        title: "Hey there",
        status: "active",
        message_id: null,
        match_type: "title",
        snippet: "Hey there",
        last_message_at: "2026-09-06T12:00:00.000Z",
      },
    ])
    expect(database.lastRpc).toEqual({
      name: "search_chat_content",
      parameters: {
        p_organization_id: "org-a",
        p_query: "hey there",
        p_limit: 20,
      },
    })
  })

  test("lists only active chats from the requested organization by recency", async () => {
    const database = new ChatDatabase([
      chat("org-a-old", "org-a", "2026-09-06T10:00:00.000Z"),
      chat("org-b-new", "org-b", "2026-09-06T13:00:00.000Z"),
      chat("org-a-new", "org-a", "2026-09-06T12:00:00.000Z"),
      chat("org-a-archived", "org-a", "2026-09-06T14:00:00.000Z", "archived"),
    ])
    const dependencies: ChatServiceDependencies = {
      database: database as unknown as SupabaseClient,
      knowledge: { search: async () => ({}) as never },
      generalCompute: { createChatCompletion: async () => ({}) as never },
    }

    const result = await new ChatService(dependencies).listChats("org-a")

    expect(result.chats.map((entry) => entry.id)).toEqual([
      "org-a-new",
      "org-a-old",
    ])
  })
})
