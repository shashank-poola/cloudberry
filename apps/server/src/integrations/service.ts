import type { SupabaseClient } from "@supabase/supabase-js"
import { ConversationEngine } from "../channels"
import {
  getComposioClient,
  getComposioAuthConfigsFor,
  getComposioCallbackUrl,
  getComposioWebhookSecret,
  getComposioWebhookUrl,
  getTriggerDefinitionsFor,
  IntegrationConfigurationError,
  providerName,
  normalizeComposioTrigger,
  withOrganizationScope,
  type ComposioClientLike,
} from "./composio"
import {
  CodexAuthClientError,
  CodexRuntimeError,
  DEFAULT_CODEX_DEVICE_AUTH_TTL_SECONDS,
  getCodexAuthClient,
  getCodexRuntime,
  type CodexAuthClientLike,
  type CodexDevicePollResult,
  type CodexRuntimeLike,
} from "./codex"

import {
  INTEGRATION_PROVIDER_LABELS,
  SUPPORTED_INTEGRATION_PROVIDERS,
  type CodexConnectionStartResult,
  type CodexConnectionStatus,
  type CodexConnectionStatusResult,
  type ConnectionCompletionResult,
  type ConnectionStartResult,
  type IntegrationListResult,
  type IntegrationProvider,
  type IntegrationStatus,
  type IntegrationTriggerStatus,
  type PublicIntegration,
  type WebhookResult,
} from "./types"

const INTEGRATIONS_TABLE = "integrations"
const ATTEMPTS_TABLE = "integration_connection_attempts"
const COMPANY_EVENTS_TABLE = "company_events"
const ATTEMPT_TTL_MS = 10 * 60 * 1_000
const CODEX_AUTH_CANCELLED = "CODEX_AUTH_CANCELLED"
const CODEX_AUTH_EXPIRED = "CODEX_AUTH_EXPIRED"

export class IntegrationServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code)
    this.name = "IntegrationServiceError"
  }
}

type DatabaseRow = Record<string, unknown>

type IntegrationRow = {
  id: string
  organization_id: string
  provider: IntegrationProvider
  external_account_id: string
  status: IntegrationStatus
  metadata: unknown
  created_at: string | null
  updated_at: string | null
}

type ConnectionAttemptRow = {
  id: string
  organization_id: string
  provider: IntegrationProvider
  requested_by: string | null
  state: string
  status: "pending" | "processing" | "completed" | "failed"
  connected_account_id: string | null
  error_code: string | null
  expires_at: string
  metadata: DatabaseRow
}

export type IntegrationServiceDependencies = {
  database: SupabaseClient
  composio?: ComposioClientLike
  conversationEngine?: ConversationEngine
  codex?: CodexAuthClientLike
  codexRuntime?: CodexRuntimeLike
  now?: () => Date
  createState?: () => string
}

export type IntegrationServiceLike = {
  list(organizationId: string): Promise<IntegrationListResult>
  startConnection(
    organizationId: string,
    userId: string,
    provider: IntegrationProvider,
    reconnect?: boolean
  ): Promise<ConnectionStartResult>
  completeConnection(
    state: string,
    status: "success" | "failed",
    connectedAccountId?: string
  ): Promise<ConnectionCompletionResult>
  getCodexConnectionStatus(
    organizationId: string,
    attemptId: string
  ): Promise<CodexConnectionStatusResult>
  cancelCodexConnection(
    organizationId: string,
    attemptId: string
  ): Promise<CodexConnectionStatusResult>
  retry(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<PublicIntegration>
  reconnect(
    organizationId: string,
    userId: string,
    provider: IntegrationProvider
  ): Promise<ConnectionStartResult>
  disconnect(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<PublicIntegration>
  handleWebhook(body: unknown, headers: unknown): Promise<WebhookResult>
}

const asRecord = (value: unknown): DatabaseRow | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DatabaseRow)
    : null

const stringValue = (value: unknown, maximum = 512): string | null => {
  if (typeof value !== "string") return null
  const valueTrimmed = value.trim()
  return valueTrimmed ? valueTrimmed.slice(0, maximum) : null
}

const firstString = (
  record: DatabaseRow | null,
  keys: readonly string[],
  maximum = 512
) => {
  if (!record) return null
  for (const key of keys) {
    const value = stringValue(record[key], maximum)
    if (value) return value
  }
  return null
}

const metadataRecord = (value: unknown): DatabaseRow => asRecord(value) ?? {}

const supportedProvider = (value: unknown): value is IntegrationProvider =>
  typeof value === "string" &&
  (SUPPORTED_INTEGRATION_PROVIDERS as readonly string[]).includes(value)

const integrationStatus = (value: unknown): IntegrationStatus | null => {
  if (
    value === "active" ||
    value === "disabled" ||
    value === "error" ||
    value === "reauthorization_required"
  ) {
    return value
  }
  return null
}

const triggerStatus = (value: unknown): IntegrationTriggerStatus | null => {
  if (
    value === "active" ||
    value === "disabled" ||
    value === "error" ||
    value === "not_configured"
  ) {
    return value
  }
  return null
}

const parseIntegrationRow = (value: unknown): IntegrationRow => {
  const row = asRecord(value)
  const id = stringValue(row?.id)
  const organizationId = stringValue(row?.organization_id)
  const provider = row?.provider
  const externalAccountId = stringValue(row?.external_account_id)
  const status = integrationStatus(row?.status)

  if (
    !id ||
    !organizationId ||
    !supportedProvider(provider) ||
    !externalAccountId ||
    !status
  ) {
    throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
  }

  return {
    id,
    organization_id: organizationId,
    provider,
    external_account_id: externalAccountId,
    status,
    metadata: row?.metadata,
    created_at: stringValue(row?.created_at, 128),
    updated_at: stringValue(row?.updated_at, 128),
  }
}

const parseAttemptRow = (value: unknown): ConnectionAttemptRow => {
  const row = asRecord(value)
  const id = stringValue(row?.id)
  const organizationId = stringValue(row?.organization_id)
  const provider = row?.provider
  const state = stringValue(row?.state, 256)
  const status = row?.status
  const expiresAt = stringValue(row?.expires_at, 128)

  if (
    !id ||
    !organizationId ||
    !supportedProvider(provider) ||
    !state ||
    (status !== "pending" &&
      status !== "processing" &&
      status !== "completed" &&
      status !== "failed") ||
    !expiresAt
  ) {
    throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
  }

  return {
    id,
    organization_id: organizationId,
    provider,
    requested_by: stringValue(row?.requested_by),
    state,
    status,
    connected_account_id: stringValue(row?.connected_account_id),
    error_code: stringValue(row?.error_code, 128),
    expires_at: expiresAt,
    metadata: metadataRecord(row?.metadata),
  }
}

const triggerIdsFromMetadata = (metadata: unknown): string[] => {
  const value = metadataRecord(metadata).trigger_ids
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (typeof entry === "string") return entry
      return stringValue(asRecord(entry)?.id)
    })
    .filter((id): id is string => Boolean(id))
}

const codexServiceError = (
  error: unknown,
  fallback = "CODEX_CONNECTION_FAILED"
) => {
  if (error instanceof IntegrationServiceError) return error
  if (error instanceof CodexAuthClientError) {
    if (error.kind === "configuration") {
      return new IntegrationServiceError("CODEX_AUTH_NOT_CONFIGURED", 503)
    }
    if (error.kind === "timeout") {
      return new IntegrationServiceError("CODEX_AUTH_TIMEOUT", 504)
    }
    if (error.kind === "invalid_response") {
      return new IntegrationServiceError("CODEX_AUTH_INVALID_RESPONSE", 502)
    }
    if (error.status === 401 || error.status === 403) {
      return new IntegrationServiceError("CODEX_AUTH_NOT_AUTHORIZED", 409)
    }
  }
  if (error instanceof CodexRuntimeError) {
    return new IntegrationServiceError(error.code, error.status ?? 502)
  }
  return new IntegrationServiceError(fallback, 502)
}

const errorCode = (error: unknown, fallback: string) => {
  if (error instanceof IntegrationServiceError) return error.code
  if (error instanceof IntegrationConfigurationError) {
    return "INTEGRATION_NOT_CONFIGURED"
  }
  if (error instanceof CodexAuthClientError) {
    return codexServiceError(error).code
  }
  if (error instanceof CodexRuntimeError) {
    return error.code
  }
  return fallback
}

const isNotFoundError = (error: unknown) => {
  const record = asRecord(error)
  if (!record) return false
  return record.status === 404 || record.code === "NOT_FOUND"
}

const providerFromPayload = (
  value: string | null
): IntegrationProvider | null => {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (normalized.includes("github")) return "github"
  if (normalized.includes("slack")) return "slack"
  if (normalized.includes("linear")) return "linear"
  return null
}

export class IntegrationService implements IntegrationServiceLike {
  private readonly conversationEngine: ConversationEngine

  constructor(readonly dependencies: IntegrationServiceDependencies) {
    this.conversationEngine =
      dependencies.conversationEngine ?? new ConversationEngine()
  }

  private now() {
    return this.dependencies.now?.() ?? new Date()
  }

  private composio() {
    return this.dependencies.composio ?? getComposioClient()
  }

  private codex() {
    return this.dependencies.codex ?? getCodexAuthClient()
  }

  private codexRuntime() {
    return this.dependencies.codexRuntime ?? getCodexRuntime()
  }

  private state() {
    return this.dependencies.createState?.() ?? globalThis.crypto.randomUUID()
  }

  private async findOrganizationIntegration(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationRow | null> {
    const { data, error } = await this.dependencies.database
      .from(INTEGRATIONS_TABLE)
      .select(
        "id, organization_id, provider, external_account_id, status, metadata, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }

    return data ? parseIntegrationRow(data) : null
  }

  private async findExternalIntegration(
    externalAccountId: string
  ): Promise<IntegrationRow | null> {
    const { data, error } = await this.dependencies.database
      .from(INTEGRATIONS_TABLE)
      .select(
        "id, organization_id, provider, external_account_id, status, metadata, created_at, updated_at"
      )
      .eq("external_account_id", externalAccountId)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }

    return data ? parseIntegrationRow(data) : null
  }

  private async findAttempt(
    organizationId: string,
    state: string
  ): Promise<ConnectionAttemptRow | null> {
    const { data, error } = await this.dependencies.database
      .from(ATTEMPTS_TABLE)
      .select(
        "id, organization_id, provider, requested_by, state, status, connected_account_id, error_code, expires_at, metadata"
      )
      .eq("organization_id", organizationId)
      .eq("state", state)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }

    return data ? parseAttemptRow(data) : null
  }

  private publicIntegration(row: IntegrationRow): PublicIntegration {
    const metadata = metadataRecord(row.metadata)
    const runtimeMissing =
      row.provider === "codex" &&
      row.status === "active" &&
      !this.hasCodexRuntimeSession(row.organization_id)
    const exposedStatus: IntegrationStatus = runtimeMissing
      ? "reauthorization_required"
      : row.status
    const storedTriggerStatus = triggerStatus(metadata.trigger_status)
    const resolvedTriggerStatus: IntegrationTriggerStatus = runtimeMissing
      ? "error"
      : (storedTriggerStatus ??
        (row.status === "disabled" ? "disabled" : "not_configured"))
    const connected =
      exposedStatus !== "disabled" &&
      exposedStatus !== "reauthorization_required"

    return {
      provider: row.provider,
      name: INTEGRATION_PROVIDER_LABELS[row.provider],
      status: exposedStatus,
      connected,
      trigger_status: resolvedTriggerStatus,
      account_label: stringValue(metadata.external_account_label),
      last_event_at: stringValue(metadata.last_event_at, 128),
      last_error: runtimeMissing
        ? "CODEX_RUNTIME_SESSION_MISSING"
        : stringValue(metadata.last_error, 2_000),
      updated_at: row.updated_at,
    }
  }

  private hasCodexRuntimeSession(organizationId: string) {
    try {
      return this.codexRuntime().isConnected(organizationId)
    } catch {
      return false
    }
  }

  private async reconcileComposioConnections(organizationId: string) {
    try {
      const session = await this.composio().sessions.create(organizationId, {
        toolkits: ["slack", "linear", "github"],
        manageConnections: false,
        sandbox: { enable: false },
      })
      const connectedToolkits = await session.toolkits({ isConnected: true })

      for (const toolkit of connectedToolkits.items) {
        const provider = providerFromPayload(toolkit.slug)
        const connectedAccountId = stringValue(
          toolkit.connection?.connectedAccount?.id
        )
        if (
          !provider ||
          provider === "codex" ||
          !toolkit.connection?.isActive ||
          !connectedAccountId
        ) {
          continue
        }

        // A locally disabled or failed integration is intentional state. Do not
        // overwrite it simply because Composio still has an account.
        const existing = await this.findOrganizationIntegration(
          organizationId,
          provider
        )
        if (existing) continue

        // A Composio account must never be adopted by a second organization.
        const assigned = await this.findExternalIntegration(connectedAccountId)
        if (assigned) continue

        await this.upsertIntegration(
          organizationId,
          provider,
          connectedAccountId,
          "active",
          {
            composio_user_id: organizationId,
            composio_connected_account_id: connectedAccountId,
            trigger_status: "not_configured",
            trigger_ids: [],
            trigger_slugs: [],
            last_error: null,
          }
        )
      }
    } catch {
      // Listing persisted integrations must remain available if Composio is
      // unavailable or the dashboard account belongs to a different identity.
    }
  }

  async list(organizationId: string): Promise<IntegrationListResult> {
    await this.reconcileComposioConnections(organizationId)

    const { data, error } = await this.dependencies.database
      .from(INTEGRATIONS_TABLE)
      .select(
        "id, organization_id, provider, external_account_id, status, metadata, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }

    const byProvider = new Map<IntegrationProvider, IntegrationRow>()
    for (const value of Array.isArray(data) ? data : []) {
      const row = parseIntegrationRow(value)
      if (!byProvider.has(row.provider)) byProvider.set(row.provider, row)
    }

    return {
      integrations: SUPPORTED_INTEGRATION_PROVIDERS.map((provider) => {
        const row = byProvider.get(provider)
        if (row) return this.publicIntegration(row)

        return {
          provider,
          name: providerName(provider),
          status: "not_connected",
          connected: false,
          trigger_status: "not_configured",
          account_label: null,
          last_event_at: null,
          last_error: null,
          updated_at: null,
        }
      }),
    }
  }

  private async insertAttempt(
    organizationId: string,
    userId: string,
    provider: IntegrationProvider,
    state: string
  ) {
    const expiresAt = new Date(
      this.now().getTime() + ATTEMPT_TTL_MS
    ).toISOString()
    const { error } = await this.dependencies.database
      .from(ATTEMPTS_TABLE)
      .insert({
        organization_id: organizationId,
        provider,
        requested_by: userId,
        state,
        status: "pending",
        expires_at: expiresAt,
      })

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }
  }

  private async updateAttempt(state: string, values: DatabaseRow) {
    const { error } = await this.dependencies.database
      .from(ATTEMPTS_TABLE)
      .update(values)
      .eq("state", state)

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }
  }

  private async claimAttempt(state: string): Promise<ConnectionAttemptRow> {
    const { data, error } = await this.dependencies.database
      .from(ATTEMPTS_TABLE)
      .update({ status: "processing" })
      .eq("state", state)
      .eq("status", "pending")
      .gt("expires_at", this.now().toISOString())
      .select(
        "id, organization_id, provider, requested_by, state, status, connected_account_id, error_code, expires_at, metadata"
      )
      .maybeSingle()

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }
    if (!data) {
      throw new IntegrationServiceError("INTEGRATION_CALLBACK_INVALID", 400)
    }

    return parseAttemptRow(data)
  }

  private async upsertIntegration(
    organizationId: string,
    provider: IntegrationProvider,
    externalAccountId: string,
    status: IntegrationStatus,
    metadataPatch: DatabaseRow
  ): Promise<IntegrationRow> {
    const existing = await this.findOrganizationIntegration(
      organizationId,
      provider
    )
    const metadata = {
      ...(existing ? metadataRecord(existing.metadata) : {}),
      ...metadataPatch,
    }

    if (existing) {
      const { data, error } = await this.dependencies.database
        .from(INTEGRATIONS_TABLE)
        .update({
          external_account_id: externalAccountId,
          status,
          metadata,
        })
        .eq("id", existing.id)
        .select(
          "id, organization_id, provider, external_account_id, status, metadata, created_at, updated_at"
        )
        .single()

      if (error || !data) {
        throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
      }

      return parseIntegrationRow(data)
    }

    const { data, error } = await this.dependencies.database
      .from(INTEGRATIONS_TABLE)
      .insert({
        organization_id: organizationId,
        provider,
        external_account_id: externalAccountId,
        status,
        metadata,
      })
      .select(
        "id, organization_id, provider, external_account_id, status, metadata, created_at, updated_at"
      )
      .single()

    if (error || !data) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }

    return parseIntegrationRow(data)
  }

  private async updateIntegration(
    row: IntegrationRow,
    status: IntegrationStatus,
    metadataPatch: DatabaseRow
  ) {
    const metadata = {
      ...metadataRecord(row.metadata),
      ...metadataPatch,
    }
    const { error } = await this.dependencies.database
      .from(INTEGRATIONS_TABLE)
      .update({ status, metadata })
      .eq("id", row.id)

    if (error) {
      throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
    }

    return {
      ...row,
      status,
      metadata,
    }
  }

  private async deleteTriggerInstances(metadata: unknown) {
    const ids = triggerIdsFromMetadata(metadata)
    if (!ids.length) return

    const composio = this.composio()
    for (const id of ids) {
      try {
        await composio.triggers.delete(id)
      } catch (error) {
        if (!isNotFoundError(error)) throw error
      }
    }
  }

  private async prepareReconnect(row: IntegrationRow) {
    if (row.provider !== "codex") {
      await this.deleteTriggerInstances(row.metadata)

      if (row.external_account_id) {
        try {
          await this.composio().connectedAccounts.disable(
            row.external_account_id
          )
        } catch (error) {
          if (!isNotFoundError(error)) throw error
        }
      }
    } else {
      try {
        await this.codexRuntime().disconnect(row.organization_id)
      } catch {
        // A missing in-memory runtime session should not block reauth.
      }
    }

    await this.updateIntegration(row, "disabled", {
      trigger_status: "disabled",
      trigger_ids: [],
      trigger_slugs: [],
      last_error: null,
    })
  }

  private async startCodexConnection(
    state: string
  ): Promise<CodexConnectionStartResult> {
    try {
      const device = await this.codex().requestDeviceCode()
      const expiresAt = new Date(
        this.now().getTime() + DEFAULT_CODEX_DEVICE_AUTH_TTL_SECONDS * 1_000
      ).toISOString()

      await this.updateAttempt(state, {
        metadata: {
          device_auth_id: device.device_auth_id,
          user_code: device.user_code,
          interval_seconds: device.interval_seconds,
          verification_url: device.verification_url,
        },
      })

      return {
        provider: "codex",
        auth_method: "device_code",
        attempt_id: state,
        device_url: device.verification_url,
        user_code: device.user_code,
        expires_at: expiresAt,
        poll_after_seconds: device.interval_seconds,
      }
    } catch (error) {
      const failure = codexServiceError(error)
      try {
        await this.updateAttempt(state, {
          status: "failed",
          error_code: failure.code,
        })
      } catch {
        // Preserve the original device-auth failure.
      }
      throw failure
    }
  }

  async startConnection(
    organizationId: string,
    userId: string,
    provider: IntegrationProvider,
    reconnect = false
  ): Promise<ConnectionStartResult> {
    const existing = await this.findOrganizationIntegration(
      organizationId,
      provider
    )

    if (!reconnect && existing && existing.status !== "disabled") {
      throw new IntegrationServiceError("INTEGRATION_ALREADY_CONNECTED", 409)
    }

    if (reconnect && existing) {
      await this.prepareReconnect(existing)
    }

    const state = this.state()
    await this.insertAttempt(organizationId, userId, provider, state)

    try {
      if (provider === "codex") {
        return await this.startCodexConnection(state)
      }

      const callbackUrl = getComposioCallbackUrl(state)
      const authConfigs = getComposioAuthConfigsFor(provider)
      const session = await this.composio().sessions.create(organizationId, {
        toolkits: [provider],
        ...(authConfigs ? { authConfigs } : {}),
        manageConnections: false,
        sandbox: { enable: false },
      })
      const request = await session.authorize(provider, { callbackUrl })
      const connectedAccountId = stringValue(request.id)
      const redirectUrl = stringValue(request.redirectUrl, 2_048)

      if (!connectedAccountId || !redirectUrl) {
        throw new IntegrationServiceError("INTEGRATION_CONNECT_FAILED", 502)
      }

      try {
        const parsedUrl = new URL(redirectUrl)
        if (parsedUrl.protocol !== "https:") {
          throw new Error("Connect Link must use HTTPS")
        }
      } catch {
        throw new IntegrationServiceError("INTEGRATION_CONNECT_FAILED", 502)
      }

      await this.updateAttempt(state, {
        connected_account_id: connectedAccountId,
      })

      return {
        provider,
        redirect_url: redirectUrl,
      }
    } catch (error) {
      try {
        await this.updateAttempt(state, {
          status: "failed",
          error_code: errorCode(error, "INTEGRATION_CONNECT_FAILED"),
        })
      } catch {
        // Preserve the original connection error if the failure record cannot
        // be written.
      }

      if (error instanceof IntegrationServiceError) throw error
      if (error instanceof IntegrationConfigurationError) {
        throw new IntegrationServiceError("INTEGRATION_NOT_CONFIGURED", 503)
      }
      throw new IntegrationServiceError("INTEGRATION_CONNECT_FAILED", 502)
    }
  }

  private accountToolkit(value: DatabaseRow) {
    const toolkit = asRecord(value.toolkit)
    return firstString(toolkit, ["slug", "name"])
  }

  private async provisionTriggers(
    organizationId: string,
    provider: IntegrationProvider,
    connectedAccountId: string,
    previousMetadata: unknown
  ) {
    await this.deleteTriggerInstances(previousMetadata)
    const definitions = getTriggerDefinitionsFor(provider)

    if (!definitions.length) {
      return {
        status: "not_configured" as const,
        triggerIds: [] as string[],
        triggerSlugs: [] as string[],
      }
    }

    try {
      getComposioWebhookSecret()
      const webhookUrl = getComposioWebhookUrl()
      await this.composio().triggers.setWebhookSubscription({
        webhookUrl,
        enabledEvents: [
          "composio.trigger.message",
          "composio.connected_account.expired",
        ],
        version: "V3",
      })
    } catch (error) {
      if (error instanceof IntegrationConfigurationError) {
        throw new IntegrationServiceError("INTEGRATION_NOT_CONFIGURED", 503)
      }
      throw new IntegrationServiceError("INTEGRATION_WEBHOOK_SETUP_FAILED", 502)
    }

    const createdIds: string[] = []
    try {
      for (const definition of definitions) {
        const result = await this.composio().triggers.create(
          organizationId,
          definition.slug,
          {
            connectedAccountId,
            triggerConfig: definition.config,
          }
        )
        const triggerId = stringValue(result.triggerId)
        if (!triggerId) {
          throw new Error("Composio returned an invalid trigger ID")
        }
        createdIds.push(triggerId)
      }
    } catch (error) {
      for (const triggerId of createdIds) {
        try {
          await this.composio().triggers.delete(triggerId)
        } catch {
          // Best-effort cleanup; the integration remains in an error state.
        }
      }

      if (error instanceof IntegrationServiceError) throw error
      throw new IntegrationServiceError("INTEGRATION_TRIGGER_SETUP_FAILED", 502)
    }

    return {
      status: "active" as const,
      triggerIds: createdIds,
      triggerSlugs: definitions.map((definition) => definition.slug),
    }
  }

  private codexPollInterval(attempt: ConnectionAttemptRow) {
    const interval = attempt.metadata.interval_seconds
    if (typeof interval !== "number" || !Number.isSafeInteger(interval)) {
      return 5
    }
    return Math.max(1, Math.min(30, interval))
  }

  private codexStatus(
    attempt: ConnectionAttemptRow,
    status: CodexConnectionStatus,
    reason: string | null,
    integration: PublicIntegration | null = null
  ): CodexConnectionStatusResult {
    return {
      provider: "codex",
      attempt_id: attempt.state,
      status,
      expires_at: attempt.expires_at,
      poll_after_seconds: this.codexPollInterval(attempt),
      reason,
      integration,
    }
  }

  private async storedCodexStatus(attempt: ConnectionAttemptRow) {
    if (attempt.status === "completed") {
      const integration = await this.findOrganizationIntegration(
        attempt.organization_id,
        "codex"
      )
      if (!integration) {
        throw new IntegrationServiceError("INTEGRATION_STORAGE_FAILED", 503)
      }
      return this.codexStatus(
        attempt,
        "connected",
        null,
        this.publicIntegration(integration)
      )
    }

    if (attempt.status !== "failed") {
      return this.codexStatus(attempt, "pending", null)
    }

    if (attempt.error_code === CODEX_AUTH_EXPIRED) {
      return this.codexStatus(attempt, "expired", attempt.error_code)
    }
    if (attempt.error_code === CODEX_AUTH_CANCELLED) {
      return this.codexStatus(attempt, "cancelled", attempt.error_code)
    }
    return this.codexStatus(
      attempt,
      "failed",
      attempt.error_code || "CODEX_CONNECTION_FAILED"
    )
  }

  private async failCodexAttempt(
    attempt: ConnectionAttemptRow,
    code: string
  ): Promise<CodexConnectionStatusResult> {
    await this.updateAttempt(attempt.state, {
      status: "failed",
      error_code: code,
      metadata: {},
    })
    return this.codexStatus(
      { ...attempt, status: "failed", error_code: code, metadata: {} },
      code === CODEX_AUTH_EXPIRED ? "expired" : "failed",
      code
    )
  }

  async getCodexConnectionStatus(
    organizationId: string,
    attemptId: string
  ): Promise<CodexConnectionStatusResult> {
    const attempt = await this.findAttempt(organizationId, attemptId)
    if (!attempt || attempt.provider !== "codex") {
      throw new IntegrationServiceError("CODEX_CONNECTION_NOT_FOUND", 404)
    }

    if (attempt.status === "completed" || attempt.status === "failed") {
      return this.storedCodexStatus(attempt)
    }

    if (new Date(attempt.expires_at).getTime() <= this.now().getTime()) {
      return this.failCodexAttempt(attempt, CODEX_AUTH_EXPIRED)
    }

    if (attempt.status === "processing") {
      return this.codexStatus(attempt, "pending", null)
    }

    const deviceAuthId = firstString(attempt.metadata, ["device_auth_id"], 512)
    const userCode = firstString(attempt.metadata, ["user_code"], 128)
    if (!deviceAuthId || !userCode) {
      return this.failCodexAttempt(attempt, "CODEX_AUTH_INVALID_RESPONSE")
    }

    let result: CodexDevicePollResult
    try {
      result = await this.codex().pollDeviceCode(deviceAuthId, userCode)
    } catch (error) {
      const failure = codexServiceError(error)
      if (failure.status >= 500) throw failure
      return this.failCodexAttempt(attempt, failure.code)
    }

    if (result.status === "pending") {
      return this.codexStatus(attempt, "pending", null)
    }

    let claimed: ConnectionAttemptRow
    try {
      claimed = await this.claimAttempt(attempt.state)
    } catch (error) {
      const latest = await this.findAttempt(organizationId, attempt.state)
      if (
        latest &&
        (latest.status === "completed" || latest.status === "failed")
      ) {
        return this.storedCodexStatus(latest)
      }
      throw error
    }

    let runtimeConnected = false
    let integrationPersisted = false
    try {
      const codexClient = this.codex()
      const completeWithCredentials =
        codexClient.completeDeviceCodeWithCredentials
      if (!completeWithCredentials) {
        throw new CodexRuntimeError(
          "CODEX_RUNTIME_NOT_CONFIGURED",
          503,
          "configuration"
        )
      }

      const completion = await completeWithCredentials.call(
        codexClient,
        result.authorization
      )
      const identity = completion.identity
      const credentials = completion.credentials
      const accountId = stringValue(identity.account_id, 512)
      if (!accountId || credentials.account_id !== accountId) {
        throw new CodexAuthClientError(
          "CODEX_AUTH_INVALID_RESPONSE",
          null,
          "invalid_response"
        )
      }

      // The runtime is authenticated before the integration row is marked
      // active. Credentials stay inside this process and are never part of the
      // integration metadata written below.
      await this.codexRuntime().connect(organizationId, credentials)
      runtimeConnected = true
      const availableModels =
        await this.codexRuntime().listModels(organizationId)
      if (!availableModels.length) {
        throw new CodexRuntimeError("CODEX_MODEL_UNAVAILABLE", 409, "model")
      }

      const integration = await this.upsertIntegration(
        organizationId,
        "codex",
        accountId,
        "active",
        {
          auth_mode: "chatgpt",
          codex_account_id: accountId,
          external_account_label:
            stringValue(identity.email, 512) || "OpenAI Codex",
          plan_type: stringValue(identity.plan_type, 128),
          trigger_status: "not_configured",
          trigger_ids: [],
          trigger_slugs: [],
          last_error: null,
        }
      )
      integrationPersisted = true

      await this.updateAttempt(claimed.state, {
        status: "completed",
        connected_account_id: accountId,
        completed_at: this.now().toISOString(),
        error_code: null,
        metadata: {},
      })

      return this.codexStatus(
        { ...claimed, status: "completed", connected_account_id: accountId },
        "connected",
        null,
        this.publicIntegration(integration)
      )
    } catch (error) {
      if (runtimeConnected && !integrationPersisted) {
        try {
          await this.codexRuntime().disconnect(organizationId)
        } catch {
          // The runtime is process-local and will be replaced on the next auth.
        }
      }
      const failure = codexServiceError(error)
      if (
        failure.code === "INTEGRATION_STORAGE_FAILED" ||
        failure.code === "INTEGRATION_NOT_CONFIGURED"
      ) {
        throw failure
      }

      return this.failCodexAttempt(claimed, failure.code)
    }
  }

  async cancelCodexConnection(
    organizationId: string,
    attemptId: string
  ): Promise<CodexConnectionStatusResult> {
    const attempt = await this.findAttempt(organizationId, attemptId)
    if (!attempt || attempt.provider !== "codex") {
      throw new IntegrationServiceError("CODEX_CONNECTION_NOT_FOUND", 404)
    }

    if (attempt.status === "completed" || attempt.status === "failed") {
      return this.storedCodexStatus(attempt)
    }

    return this.failCodexAttempt(attempt, CODEX_AUTH_CANCELLED).then(
      (result) => ({
        ...result,
        status: "cancelled",
      })
    )
  }

  async completeConnection(
    state: string,
    status: "success" | "failed",
    connectedAccountId?: string
  ): Promise<ConnectionCompletionResult> {
    const attempt = await this.claimAttempt(state)
    if (attempt.provider === "codex") {
      await this.updateAttempt(state, {
        status: "failed",
        error_code: "INTEGRATION_CALLBACK_INVALID",
        metadata: {},
      })
      throw new IntegrationServiceError("INTEGRATION_CALLBACK_INVALID", 400)
    }

    const resolvedConnectedAccountId =
      stringValue(connectedAccountId) || attempt.connected_account_id

    if (status !== "success" || !resolvedConnectedAccountId) {
      await this.updateAttempt(state, {
        status: "failed",
        error_code: "INTEGRATION_OAUTH_FAILED",
      })
      return {
        provider: attempt.provider,
        success: false,
        reason: "INTEGRATION_OAUTH_FAILED",
      }
    }

    if (
      attempt.connected_account_id &&
      attempt.connected_account_id !== resolvedConnectedAccountId
    ) {
      await this.updateAttempt(state, {
        status: "failed",
        error_code: "INTEGRATION_CALLBACK_INVALID",
      })
      throw new IntegrationServiceError("INTEGRATION_CALLBACK_INVALID", 400)
    }

    try {
      const account = asRecord(
        await this.composio().connectedAccounts.get(resolvedConnectedAccountId)
      )
      if (!account) {
        throw new IntegrationServiceError("INTEGRATION_CONNECTION_INVALID", 502)
      }

      const accountStatus = firstString(account, ["status"])
      if (accountStatus && accountStatus.toUpperCase() !== "ACTIVE") {
        throw new IntegrationServiceError(
          "INTEGRATION_CONNECTION_INACTIVE",
          409
        )
      }

      const toolkit = this.accountToolkit(account)
      if (toolkit && providerFromPayload(toolkit) !== attempt.provider) {
        throw new IntegrationServiceError("INTEGRATION_CALLBACK_INVALID", 400)
      }

      const composioUserId = firstString(account, ["userId", "user_id"])
      if (composioUserId && composioUserId !== attempt.organization_id) {
        throw new IntegrationServiceError("INTEGRATION_CALLBACK_INVALID", 400)
      }

      let integration = await this.upsertIntegration(
        attempt.organization_id,
        attempt.provider,
        resolvedConnectedAccountId,
        "error",
        {
          composio_user_id: attempt.organization_id,
          composio_connected_account_id: resolvedConnectedAccountId,
          trigger_status: "not_configured",
          trigger_ids: [],
          trigger_slugs: [],
          last_error: null,
        }
      )

      try {
        const triggers = await this.provisionTriggers(
          attempt.organization_id,
          attempt.provider,
          resolvedConnectedAccountId,
          integration.metadata
        )
        integration = await this.updateIntegration(integration, "active", {
          trigger_status: triggers.status,
          trigger_ids: triggers.triggerIds,
          trigger_slugs: triggers.triggerSlugs,
          last_error: null,
        })
      } catch (error) {
        const reason = errorCode(error, "INTEGRATION_TRIGGER_SETUP_FAILED")
        await this.updateIntegration(integration, "error", {
          trigger_status: "error",
          trigger_ids: [],
          trigger_slugs: [],
          last_error: reason,
        })
        await this.updateAttempt(state, {
          status: "failed",
          connected_account_id: resolvedConnectedAccountId,
          error_code: reason,
        })
        return {
          provider: attempt.provider,
          success: false,
          reason,
        }
      }

      await this.updateAttempt(state, {
        status: "completed",
        connected_account_id: resolvedConnectedAccountId,
        completed_at: this.now().toISOString(),
        error_code: null,
      })

      return {
        provider: integration.provider,
        success: true,
        reason: null,
      }
    } catch (error) {
      try {
        await this.updateAttempt(state, {
          status: "failed",
          connected_account_id: resolvedConnectedAccountId,
          error_code: errorCode(error, "INTEGRATION_CALLBACK_FAILED"),
        })
      } catch {
        // Preserve the original callback error.
      }

      if (error instanceof IntegrationServiceError) throw error
      if (error instanceof IntegrationConfigurationError) {
        throw new IntegrationServiceError("INTEGRATION_NOT_CONFIGURED", 503)
      }
      throw new IntegrationServiceError("INTEGRATION_CALLBACK_FAILED", 502)
    }
  }

  async retry(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<PublicIntegration> {
    const row = await this.findOrganizationIntegration(organizationId, provider)
    if (!row || !row.external_account_id) {
      throw new IntegrationServiceError("INTEGRATION_NOT_FOUND", 404)
    }
    if (row.status === "disabled") {
      throw new IntegrationServiceError("INTEGRATION_NOT_CONNECTED", 409)
    }

    if (provider === "codex") {
      if (!this.hasCodexRuntimeSession(organizationId)) {
        throw new IntegrationServiceError("CODEX_RUNTIME_SESSION_MISSING", 409)
      }
      try {
        const models = await this.codexRuntime().listModels(organizationId)
        if (!models.length)
          throw new IntegrationServiceError("CODEX_MODEL_UNAVAILABLE", 409)
        const updated = await this.updateIntegration(row, "active", {
          last_error: null,
        })
        return this.publicIntegration(updated)
      } catch (error) {
        const reason = errorCode(error, "CODEX_RUNTIME_UNAVAILABLE")
        await this.updateIntegration(row, "error", { last_error: reason })
        if (error instanceof IntegrationServiceError) throw error
        throw new IntegrationServiceError(reason, 502)
      }
    }

    try {
      const triggers = await this.provisionTriggers(
        organizationId,
        provider,
        row.external_account_id,
        row.metadata
      )
      const updated = await this.updateIntegration(row, "active", {
        trigger_status: triggers.status,
        trigger_ids: triggers.triggerIds,
        trigger_slugs: triggers.triggerSlugs,
        last_error: null,
      })
      return this.publicIntegration(updated)
    } catch (error) {
      const reason = errorCode(error, "INTEGRATION_TRIGGER_SETUP_FAILED")
      const updated = await this.updateIntegration(row, "error", {
        trigger_status: "error",
        trigger_ids: [],
        trigger_slugs: [],
        last_error: reason,
      })
      if (error instanceof IntegrationServiceError) throw error
      throw new IntegrationServiceError(reason, 502)
    }
  }

  async reconnect(
    organizationId: string,
    userId: string,
    provider: IntegrationProvider
  ): Promise<ConnectionStartResult> {
    return this.startConnection(organizationId, userId, provider, true)
  }

  async disconnect(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<PublicIntegration> {
    const row = await this.findOrganizationIntegration(organizationId, provider)
    if (!row) {
      return {
        provider,
        name: providerName(provider),
        status: "disabled",
        connected: false,
        trigger_status: "disabled",
        account_label: null,
        last_event_at: null,
        last_error: null,
        updated_at: null,
      }
    }

    if (row.provider !== "codex") {
      await this.deleteTriggerInstances(row.metadata)

      try {
        await this.composio().connectedAccounts.delete(row.external_account_id)
      } catch (error) {
        if (!isNotFoundError(error)) throw error
      }
    } else {
      try {
        await this.codexRuntime().disconnect(organizationId)
      } catch {
        // Credentials are in memory only; a missing runtime is already safe.
      }
    }

    const updated = await this.updateIntegration(row, "disabled", {
      trigger_status: "disabled",
      trigger_ids: [],
      trigger_slugs: [],
      last_error: null,
    })
    return this.publicIntegration(updated)
  }

  private async handleConnectionExpired(rawPayload: DatabaseRow) {
    const data = asRecord(rawPayload.data)
    const connectedAccountId = firstString(data, ["id", "connected_account_id"])
    if (!connectedAccountId)
      return { kind: "ignored" as const, inserted: false }

    const integration = await this.findExternalIntegration(connectedAccountId)
    if (!integration) return { kind: "ignored" as const, inserted: false }

    await this.updateIntegration(integration, "reauthorization_required", {
      trigger_status: "error",
      last_error: "INTEGRATION_REAUTHORIZATION_REQUIRED",
    })
    return { kind: "connection_expired" as const, inserted: false }
  }

  async handleWebhook(body: unknown, headers: unknown): Promise<WebhookResult> {
    const secret = getComposioWebhookSecret()
    let parsed: DatabaseRow | null

    try {
      const result = await this.composio().triggers.parse(
        { body, headers },
        { verifySecret: secret }
      )
      parsed = asRecord(result)
    } catch (error) {
      if (error instanceof IntegrationConfigurationError) throw error
      throw new IntegrationServiceError("INTEGRATION_WEBHOOK_INVALID", 401)
    }

    if (!parsed) {
      throw new IntegrationServiceError("INTEGRATION_WEBHOOK_INVALID", 400)
    }

    const rawPayload = asRecord(parsed.rawPayload) ?? {}
    const rawType = firstString(rawPayload, ["type"], 128)
    if (rawType === "composio.connected_account.expired") {
      return this.handleConnectionExpired(rawPayload)
    }

    const normalizedPayload = asRecord(parsed.payload)
    const normalizedMetadata = asRecord(normalizedPayload?.metadata)
    const connectedAccount = asRecord(
      normalizedMetadata?.connectedAccount ??
        normalizedMetadata?.connected_account
    )
    const rawMetadata = asRecord(rawPayload.metadata)
    const connectedAccountId =
      firstString(connectedAccount, ["id", "connectedAccountId"]) ||
      firstString(rawMetadata, ["connected_account_id", "connectedAccountId"])
    const triggerSlug =
      firstString(normalizedPayload, ["triggerSlug", "trigger_slug"], 256) ||
      firstString(rawMetadata, ["trigger_slug", "triggerSlug"], 256)
    const triggerId =
      firstString(normalizedPayload, ["id", "trigger_id"], 512) ||
      firstString(rawMetadata, ["trigger_id", "triggerId"], 512)
    const toolkitSlug = firstString(normalizedPayload, [
      "toolkitSlug",
      "toolkit_slug",
    ])
    const provider = providerFromPayload(toolkitSlug || triggerSlug)

    if (
      !connectedAccountId ||
      !triggerSlug ||
      !triggerId ||
      !provider ||
      provider === "codex"
    ) {
      return { kind: "ignored", inserted: false }
    }

    const integration = await this.findExternalIntegration(connectedAccountId)
    if (!integration || integration.status !== "active") {
      return { kind: "ignored", inserted: false }
    }
    if (!triggerIdsFromMetadata(integration.metadata).includes(triggerId)) {
      return { kind: "ignored", inserted: false }
    }
    if (integration.provider !== provider) {
      throw new IntegrationServiceError(
        "INTEGRATION_WEBHOOK_SCOPE_MISMATCH",
        400
      )
    }

    const composioUserId =
      firstString(normalizedPayload, ["userId", "user_id"]) ||
      firstString(connectedAccount, ["userId", "user_id"]) ||
      firstString(rawMetadata, ["user_id", "userId"])
    const configuredUserId = firstString(metadataRecord(integration.metadata), [
      "composio_user_id",
    ])
    if (
      configuredUserId &&
      composioUserId &&
      configuredUserId !== composioUserId
    ) {
      throw new IntegrationServiceError(
        "INTEGRATION_WEBHOOK_SCOPE_MISMATCH",
        400
      )
    }

    const payload = normalizedPayload?.payload ?? rawPayload.data ?? {}
    const messageId =
      firstString(rawPayload, ["id", "log_id", "logId"], 512) ||
      firstString(normalizedPayload, ["id"], 512)
    let event = withOrganizationScope(
      normalizeComposioTrigger({
        provider,
        triggerSlug,
        triggerId,
        connectedAccountId,
        composioUserId,
        messageId,
        payload,
        rawPayload,
        version: stringValue(parsed.version, 32) ?? undefined,
      }),
      integration.organization_id
    )

    try {
      const conversation = this.conversationEngine.route(event, payload)
      if (conversation.kind === "accepted") {
        const turn = conversation.turn
        event = {
          ...event,
          metadata: {
            ...event.metadata,
            channel_conversation: {
              provider: turn.provider,
              conversation_id: turn.conversationId,
              message_id: turn.messageId,
              thread_id: turn.threadId,
              sender_id: turn.senderId,
              reply_mode: turn.replyMode,
            },
          },
        }
      }
    } catch {
      // Conversation routing enriches events but must not block knowledge
      // ingestion when a future channel adapter fails.
    }

    const { error } = await this.dependencies.database
      .from(COMPANY_EVENTS_TABLE)
      .insert({
        organization_id: integration.organization_id,
        integration_id: integration.id,
        source: event.source,
        external_event_id: event.external_event_id,
        external_url: event.external_url,
        event_type: event.event_type,
        occurred_at: event.occurred_at,
        received_at: event.received_at,
        actor: event.actor,
        title: event.title,
        content: event.content,
        metadata: event.metadata,
        raw_payload: event.raw_payload,
        normalized_payload: event,
      })

    if (error && error.code !== "23505") {
      throw new IntegrationServiceError("INTEGRATION_EVENT_STORAGE_FAILED", 503)
    }

    await this.updateIntegration(integration, "active", {
      last_event_at: event.received_at,
      last_error: null,
    })

    return {
      kind: "event",
      inserted: !error,
    }
  }
}
