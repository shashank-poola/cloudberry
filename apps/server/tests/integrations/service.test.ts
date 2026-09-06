import { describe, expect, test } from "bun:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  IntegrationService,
  type IntegrationServiceDependencies,
} from "../../src/integrations/service"
import type { ComposioClientLike } from "../../src/integrations/composio"
import {
  CodexAuthClientError,
  type CodexAuthClientLike,
  type CodexRuntimeLike,
} from "../../src/integrations/codex"

type Row = Record<string, unknown>
type QueryResult = { data: unknown; error: Row | null }

type MemoryTables = {
  integrations: Row[]
  integration_connection_attempts: Row[]
  company_events: Row[]
}

class MemoryQuery implements PromiseLike<QueryResult> {
  private operation: "select" | "insert" | "update" = "select"
  private values: Row | null = null
  private selectRequested = false
  private filters: Array<{ key: string; kind: "eq" | "gt"; value: unknown }> =
    []
  private maximum: number | null = null

  constructor(
    private readonly tables: MemoryTables,
    private readonly table: keyof MemoryTables
  ) {}

  select() {
    this.selectRequested = true
    return this
  }

  insert(values: Row) {
    this.operation = "insert"
    this.values = values
    return this
  }

  update(values: Row) {
    this.operation = "update"
    this.values = values
    return this
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, kind: "eq", value })
    return this
  }

  gt(key: string, value: unknown) {
    this.filters.push({ key, kind: "gt", value })
    return this
  }

  order() {
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

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private matchingRows() {
    const rows = this.tables[this.table]
    const filtered = rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.kind === "eq") return row[filter.key] === filter.value
        const rowValue = row[filter.key]
        return (
          typeof rowValue === "string" &&
          typeof filter.value === "string" &&
          rowValue > filter.value
        )
      })
    )
    return this.maximum === null ? filtered : filtered.slice(0, this.maximum)
  }

  private async execute(): Promise<QueryResult> {
    if (this.operation === "select") {
      return { data: this.matchingRows(), error: null }
    }

    if (this.operation === "update") {
      const rows = this.matchingRows()
      for (const row of rows) Object.assign(row, this.values ?? {})
      return { data: this.selectRequested ? rows : null, error: null }
    }

    const inserted = { ...(this.values ?? {}) }
    if (this.table === "integrations" && !inserted.id) {
      inserted.id = "generated-integration-id"
    }
    if (this.table === "integration_connection_attempts" && !inserted.id) {
      inserted.id = "generated-attempt-id"
      inserted.status ??= "pending"
    }
    if (this.table === "company_events") {
      const duplicate = this.tables.company_events.some(
        (row) =>
          row.organization_id === inserted.organization_id &&
          row.source === inserted.source &&
          row.external_event_id === inserted.external_event_id
      )
      if (duplicate) return { data: null, error: { code: "23505" } }
    }

    this.tables[this.table].push(inserted)
    return { data: this.selectRequested ? [inserted] : null, error: null }
  }
}

class MemoryDatabase {
  readonly tables: MemoryTables = {
    integrations: [],
    integration_connection_attempts: [],
    company_events: [],
  }

  from(table: keyof MemoryTables) {
    return new MemoryQuery(this.tables, table)
  }
}

const createComposio = (parseResult: unknown = null) => {
  const calls = {
    sessionUserId: null as string | null,
    authorizedToolkit: null as string | null,
    webhookSubscription: 0,
  }

  const client: ComposioClientLike = {
    sessions: {
      create: async (userId) => {
        calls.sessionUserId = userId
        return {
          authorize: async (toolkit) => {
            calls.authorizedToolkit = toolkit
            return {
              id: "ca_github",
              redirectUrl: "https://connect.composio.dev/link/test",
            }
          },
        }
      },
    },
    connectedAccounts: {
      get: async () => ({
        id: "ca_github",
        status: "ACTIVE",
        userId: "11111111-1111-4111-8111-111111111111",
        toolkit: { slug: "github" },
      }),
      delete: async () => null,
      disable: async () => null,
    },
    triggers: {
      create: async () => ({ triggerId: "ti_github" }),
      delete: async () => null,
      setWebhookSubscription: async () => {
        calls.webhookSubscription += 1
        return null
      },
      parse: async () => parseResult,
    },
  }

  return { calls, client }
}

const createCodex = (
  pollDeviceCode: CodexAuthClientLike["pollDeviceCode"],
  identity: Awaited<ReturnType<CodexAuthClientLike["completeDeviceCode"]>> = {
    account_id: "account-1",
    email: "owner@example.com",
    plan_type: "pro",
  }
): CodexAuthClientLike => ({
  requestDeviceCode: async () => ({
    device_auth_id: "device-1",
    user_code: "ABCD-EFGH",
    interval_seconds: 5,
    verification_url: "https://auth.openai.com/codex/device",
  }),
  pollDeviceCode,
  completeDeviceCode: async () => identity,
  completeDeviceCodeWithCredentials: async () => ({
    identity,
    credentials: {
      access_token: "access-token",
      refresh_token: "refresh-token",
      account_id: identity.account_id,
      email: identity.email,
      plan_type: identity.plan_type,
    },
  }),
  refreshCredentials: async (credentials) => credentials,
})

const createCodexRuntime = (): CodexRuntimeLike => {
  const connectedOrganizations = new Set<string>()
  return {
    connect: async (organizationId) => {
      connectedOrganizations.add(organizationId)
    },
    disconnect: async (organizationId) => {
      connectedOrganizations.delete(organizationId)
    },
    isConnected: (organizationId) => connectedOrganizations.has(organizationId),
    listModels: async () => [
      {
        id: "gpt-5.6-terra",
        name: "GPT-5.6-Terra",
        reasoning_effort: "high",
        input_modalities: ["text"],
      },
    ],
    createChatCompletion: async (_organizationId, request) => ({
      id: "turn-1",
      model: request.model,
      content: "A Codex response",
      thread_id: "thread-1",
      turn_id: "turn-1",
    }),
  }
}

const withEnvironment = async (
  values: Record<string, string | undefined>,
  callback: () => Promise<void>
) => {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    await callback()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe("integration service", () => {
  test("creates an organization-scoped Composio Connect Link", async () => {
    await withEnvironment(
      {
        COMPOSIO_CALLBACK_URL:
          "http://localhost:8000/api/v1/integrations/composio/callback",
        COMPOSIO_TRIGGER_DEFINITIONS: undefined,
      },
      async () => {
        const database = new MemoryDatabase()
        const { calls, client } = createComposio()
        const dependencies: IntegrationServiceDependencies = {
          database: database as unknown as SupabaseClient,
          composio: client,
          createState: () => "1234567890123456",
        }
        const service = new IntegrationService(dependencies)

        const result = await service.startConnection(
          "11111111-1111-4111-8111-111111111111",
          "owner-id",
          "github"
        )

        expect(result.provider).toBe("github")
        if (result.provider === "codex") {
          throw new Error("Expected an OAuth connection start result")
        }
        expect(result.redirect_url).toBe(
          "https://connect.composio.dev/link/test"
        )
        expect(calls.sessionUserId).toBe("11111111-1111-4111-8111-111111111111")
        expect(calls.authorizedToolkit).toBe("github")
        expect(database.tables.integration_connection_attempts).toMatchObject([
          {
            organization_id: "11111111-1111-4111-8111-111111111111",
            requested_by: "owner-id",
            provider: "github",
            state: "1234567890123456",
            connected_account_id: "ca_github",
            status: "pending",
          },
        ])
      }
    )
  })

  test("completes OAuth and activates a connection without guessed triggers", async () => {
    await withEnvironment(
      {
        COMPOSIO_CALLBACK_URL:
          "http://localhost:8000/api/v1/integrations/composio/callback",
        COMPOSIO_TRIGGER_DEFINITIONS: undefined,
      },
      async () => {
        const database = new MemoryDatabase()
        const { client } = createComposio()
        const service = new IntegrationService({
          database: database as unknown as SupabaseClient,
          composio: client,
          createState: () => "1234567890123456",
        })
        await service.startConnection(
          "11111111-1111-4111-8111-111111111111",
          "owner-id",
          "github"
        )

        const result = await service.completeConnection(
          "1234567890123456",
          "success"
        )

        expect(result).toEqual({
          provider: "github",
          success: true,
          reason: null,
        })
        expect(database.tables.integrations).toMatchObject([
          {
            organization_id: "11111111-1111-4111-8111-111111111111",
            provider: "github",
            external_account_id: "ca_github",
            status: "active",
            metadata: {
              composio_user_id: "11111111-1111-4111-8111-111111111111",
              trigger_status: "not_configured",
            },
          },
        ])
        expect(database.tables.integration_connection_attempts[0]?.status).toBe(
          "completed"
        )
      }
    )
  })

  test("runs Codex device auth without persisting provider tokens", async () => {
    const database = new MemoryDatabase()
    let pollCount = 0
    const codex = createCodex(async () => {
      pollCount += 1
      if (pollCount === 1) return { status: "pending" }
      return {
        status: "authorized",
        authorization: {
          authorization_code: "authorization-code",
          code_challenge: "challenge",
          code_verifier: "verifier",
        },
      }
    })
    const service = new IntegrationService({
      database: database as unknown as SupabaseClient,
      codex,
      codexRuntime: createCodexRuntime(),
      createState: () => "codex-state-123456",
      now: () => new Date("2026-09-06T12:00:00.000Z"),
    })

    const started = await service.startConnection(
      "11111111-1111-4111-8111-111111111111",
      "owner-id",
      "codex"
    )
    expect(started).toMatchObject({
      provider: "codex",
      auth_method: "device_code",
      attempt_id: "codex-state-123456",
      device_url: "https://auth.openai.com/codex/device",
      user_code: "ABCD-EFGH",
    })
    expect(database.tables.integration_connection_attempts[0]).toMatchObject({
      provider: "codex",
      metadata: {
        device_auth_id: "device-1",
        user_code: "ABCD-EFGH",
      },
    })

    await expect(
      service.getCodexConnectionStatus(
        "11111111-1111-4111-8111-111111111111",
        "codex-state-123456"
      )
    ).resolves.toMatchObject({ status: "pending" })

    const completed = await service.getCodexConnectionStatus(
      "11111111-1111-4111-8111-111111111111",
      "codex-state-123456"
    )
    expect(completed).toMatchObject({
      status: "connected",
      integration: {
        provider: "codex",
        status: "active",
        account_label: "owner@example.com",
      },
    })
    expect(
      database.tables.integration_connection_attempts[0]?.metadata
    ).toEqual({})
    expect(database.tables.integrations[0]?.metadata).toMatchObject({
      auth_mode: "chatgpt",
      codex_account_id: "account-1",
      plan_type: "pro",
    })
    expect(JSON.stringify(database.tables)).not.toContain("access_token")
    expect(JSON.stringify(database.tables)).not.toContain("refresh_token")
    expect(JSON.stringify(database.tables)).not.toContain("id_token")
  })

  test("expires, cancels, and isolates Codex connection attempts", async () => {
    const database = new MemoryDatabase()
    let now = new Date("2026-09-06T12:00:00.000Z")
    let stateNumber = 0
    const codex = createCodex(async () => ({ status: "pending" }))
    const service = new IntegrationService({
      database: database as unknown as SupabaseClient,
      codex,
      createState: () => `codex-state-${++stateNumber}-123456`,
      now: () => now,
    })

    const started = await service.startConnection(
      "11111111-1111-4111-8111-111111111111",
      "owner-id",
      "codex"
    )
    if (started.provider !== "codex") throw new Error("Expected Codex start")
    const isolated = service.getCodexConnectionStatus(
      "22222222-2222-4222-8222-222222222222",
      started.attempt_id
    )
    await expect(isolated).rejects.toMatchObject({
      code: "CODEX_CONNECTION_NOT_FOUND",
    })

    now = new Date("2026-09-06T12:16:00.000Z")
    await expect(
      service.getCodexConnectionStatus(
        "11111111-1111-4111-8111-111111111111",
        started.attempt_id
      )
    ).resolves.toMatchObject({
      status: "expired",
      reason: "CODEX_AUTH_EXPIRED",
    })

    const cancelledStart = await service.startConnection(
      "11111111-1111-4111-8111-111111111111",
      "owner-id",
      "codex"
    )
    await expect(
      service.cancelCodexConnection(
        "11111111-1111-4111-8111-111111111111",
        cancelledStart.provider === "codex"
          ? cancelledStart.attempt_id
          : "invalid-attempt-id"
      )
    ).resolves.toMatchObject({
      status: "cancelled",
      reason: "CODEX_AUTH_CANCELLED",
    })
  })

  test("marks a Codex poll authorization error as failed", async () => {
    const database = new MemoryDatabase()
    const codex = createCodex(async () => {
      throw new CodexAuthClientError("CODEX_AUTH_NOT_AUTHORIZED", 403, "http")
    })
    const service = new IntegrationService({
      database: database as unknown as SupabaseClient,
      codex,
      createState: () => "codex-state-123456",
      now: () => new Date("2026-09-06T12:00:00.000Z"),
    })
    const started = await service.startConnection(
      "11111111-1111-4111-8111-111111111111",
      "owner-id",
      "codex"
    )
    if (started.provider !== "codex") throw new Error("Expected Codex start")

    await expect(
      service.getCodexConnectionStatus(
        "11111111-1111-4111-8111-111111111111",
        started.attempt_id
      )
    ).resolves.toMatchObject({
      status: "failed",
      reason: "CODEX_AUTH_NOT_AUTHORIZED",
    })
  })

  test("normalizes a signed trigger event and deduplicates redelivery", async () => {
    await withEnvironment(
      {
        COMPOSIO_WEBHOOK_SECRET: "test-webhook-secret",
        COMPOSIO_TRIGGER_DEFINITIONS: undefined,
      },
      async () => {
        const database = new MemoryDatabase()
        const { client } = createComposio({
          version: "V3",
          rawPayload: {
            id: "msg_123",
            type: "composio.trigger.message",
            metadata: {
              trigger_id: "ti_github",
              trigger_slug: "GITHUB_COMMIT_EVENT",
              connected_account_id: "ca_github",
              user_id: "11111111-1111-4111-8111-111111111111",
            },
          },
          payload: {
            id: "ti_github",
            triggerSlug: "GITHUB_COMMIT_EVENT",
            toolkitSlug: "GITHUB",
            userId: "11111111-1111-4111-8111-111111111111",
            payload: {
              message: "Ship the integration",
              html_url: "https://github.com/acme/cloudberry/commit/abc123",
            },
            metadata: {
              connectedAccount: { id: "ca_github" },
            },
          },
        })
        database.tables.integrations.push({
          id: "integration-id",
          organization_id: "11111111-1111-4111-8111-111111111111",
          provider: "github",
          external_account_id: "ca_github",
          status: "active",
          metadata: {
            composio_user_id: "11111111-1111-4111-8111-111111111111",
            trigger_status: "active",
            trigger_ids: ["ti_github"],
          },
          updated_at: "2026-09-06T12:00:00.000Z",
        })
        const service = new IntegrationService({
          database: database as unknown as SupabaseClient,
          composio: client,
        })

        const first = await service.handleWebhook(
          Buffer.from('{"signed":"payload"}'),
          {}
        )
        const second = await service.handleWebhook(
          Buffer.from('{"signed":"payload"}'),
          {}
        )

        expect(first).toEqual({ kind: "event", inserted: true })
        expect(second).toEqual({ kind: "event", inserted: false })
        expect(database.tables.company_events).toHaveLength(1)
        expect(database.tables.company_events[0]).toMatchObject({
          organization_id: "11111111-1111-4111-8111-111111111111",
          integration_id: "integration-id",
          source: "github",
          external_event_id: "ca_github:msg_123",
          event_type: "github_commit_event",
          content: "Ship the integration",
        })
      }
    )
  })
})
