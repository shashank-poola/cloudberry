import { apiRequest, BrowserApiError } from "../client"

export const INTEGRATION_PROVIDERS = [
  "codex",
  "github",
  "slack",
  "linear",
] as const
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

export type IntegrationStatus =
  "not_connected" | "active" | "disabled" | "error" | "reauthorization_required"

export type IntegrationTriggerStatus =
  "active" | "disabled" | "error" | "not_configured"

export type Integration = {
  provider: IntegrationProvider
  name: string
  status: IntegrationStatus
  connected: boolean
  trigger_status: IntegrationTriggerStatus
  account_label: string | null
  last_event_at: string | null
  last_error: string | null
  updated_at: string | null
}

type OAuthConnectionStart = {
  provider: Exclude<IntegrationProvider, "codex">
  redirect_url: string
}

export type CodexConnectionStart = {
  provider: "codex"
  auth_method: "device_code"
  attempt_id: string
  device_url: string
  user_code: string
  expires_at: string
  poll_after_seconds: number
}

export type ConnectionStart = OAuthConnectionStart | CodexConnectionStart

export type CodexConnectionStatus =
  "pending" | "connected" | "expired" | "failed" | "cancelled"

export type CodexConnectionStatusResult = {
  provider: "codex"
  attempt_id: string
  status: CodexConnectionStatus
  expires_at: string
  poll_after_seconds: number
  reason: string | null
  integration: Integration | null
}

const integrationsPath = "/integrations"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, maximum = 2_048): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maximum) : null
}

function providerValue(value: unknown): IntegrationProvider | null {
  return typeof value === "string" &&
    (INTEGRATION_PROVIDERS as readonly string[]).includes(value)
    ? (value as IntegrationProvider)
    : null
}

function statusValue(value: unknown): IntegrationStatus | null {
  if (
    value === "not_connected" ||
    value === "active" ||
    value === "disabled" ||
    value === "error" ||
    value === "reauthorization_required"
  ) {
    return value
  }
  return null
}

function triggerStatusValue(value: unknown): IntegrationTriggerStatus | null {
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

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

function normaliseIntegration(value: unknown): Integration | null {
  if (!isRecord(value)) return null

  const provider = providerValue(value.provider)
  const status = statusValue(value.status)
  const triggerStatus = triggerStatusValue(value.trigger_status)
  const name = stringValue(value.name, 128)
  if (!provider || !status || !triggerStatus || !name) return null

  return {
    provider,
    name,
    status,
    connected: value.connected === true,
    trigger_status: triggerStatus,
    account_label: stringValue(value.account_label, 512),
    last_event_at: stringValue(value.last_event_at, 128),
    last_error: stringValue(value.last_error, 2_000),
    updated_at: stringValue(value.updated_at, 128),
  }
}

function invalidResponse(resource: string): never {
  throw new BrowserApiError(
    `Cloudberry returned an invalid ${resource}.`,
    502,
    "INTEGRATION_INVALID_RESPONSE"
  )
}

export async function getIntegrations(
  signal?: AbortSignal
): Promise<Integration[]> {
  const value = await apiRequest<unknown>(integrationsPath, { signal })
  if (!isRecord(value) || !Array.isArray(value.integrations)) {
    return invalidResponse("integrations response")
  }

  const integrations = value.integrations
    .map(normaliseIntegration)
    .filter((integration): integration is Integration => Boolean(integration))
  if (integrations.length !== value.integrations.length) {
    return invalidResponse("integration")
  }

  return integrations
}

function normaliseCodexConnectionStart(
  value: unknown
): CodexConnectionStart | null {
  if (!isRecord(value)) return null
  const provider = providerValue(value.provider)
  const authMethod = value.auth_method
  const attemptId = stringValue(value.attempt_id, 256)
  const deviceUrl = stringValue(value.device_url)
  const userCode = stringValue(value.user_code, 128)
  const expiresAt = stringValue(value.expires_at, 128)
  const pollAfterSeconds = numberValue(value.poll_after_seconds)

  if (
    provider !== "codex" ||
    authMethod !== "device_code" ||
    !attemptId ||
    !deviceUrl ||
    !isHttpsUrl(deviceUrl) ||
    !userCode ||
    !expiresAt ||
    pollAfterSeconds === null ||
    pollAfterSeconds < 1 ||
    pollAfterSeconds > 30
  ) {
    return null
  }

  return {
    provider,
    auth_method: authMethod,
    attempt_id: attemptId,
    device_url: deviceUrl,
    user_code: userCode,
    expires_at: expiresAt,
    poll_after_seconds: pollAfterSeconds,
  }
}

function normaliseOAuthConnectionStart(
  value: unknown,
  provider: Exclude<IntegrationProvider, "codex">
): OAuthConnectionStart | null {
  if (!isRecord(value)) return null
  const returnedProvider = providerValue(value.provider)
  const redirectUrl = stringValue(value.redirect_url)
  if (
    returnedProvider !== provider ||
    !redirectUrl ||
    !isHttpsUrl(redirectUrl)
  ) {
    return null
  }

  return { provider, redirect_url: redirectUrl }
}

function normaliseConnectionStart(
  value: unknown,
  provider: IntegrationProvider
): ConnectionStart | null {
  if (provider === "codex") return normaliseCodexConnectionStart(value)
  return normaliseOAuthConnectionStart(value, provider)
}

export async function startIntegration(
  provider: IntegrationProvider,
  signal?: AbortSignal
): Promise<ConnectionStart> {
  const value = await apiRequest<unknown>(
    `${integrationsPath}/${provider}/connect`,
    { method: "POST", signal }
  )
  return (
    normaliseConnectionStart(value, provider) ??
    invalidResponse("connection response")
  )
}

export async function reconnectIntegration(
  provider: IntegrationProvider,
  signal?: AbortSignal
): Promise<ConnectionStart> {
  const value = await apiRequest<unknown>(
    `${integrationsPath}/${provider}/reconnect`,
    { method: "POST", signal }
  )
  return (
    normaliseConnectionStart(value, provider) ??
    invalidResponse("reconnection response")
  )
}

export async function retryIntegration(
  provider: IntegrationProvider,
  signal?: AbortSignal
): Promise<Integration> {
  const value = await apiRequest<unknown>(
    `${integrationsPath}/${provider}/retry`,
    { method: "POST", signal }
  )
  const integration = normaliseIntegration(value)
  return integration ?? invalidResponse("integration retry response")
}

function normaliseCodexConnectionStatus(
  value: unknown
): CodexConnectionStatusResult | null {
  if (!isRecord(value)) return null
  const provider = providerValue(value.provider)
  const attemptId = stringValue(value.attempt_id, 256)
  const status = value.status
  const expiresAt = stringValue(value.expires_at, 128)
  const pollAfterSeconds = numberValue(value.poll_after_seconds)
  const reason = value.reason === null ? null : stringValue(value.reason, 256)
  const integration =
    value.integration === null ? null : normaliseIntegration(value.integration)

  if (
    provider !== "codex" ||
    !attemptId ||
    (status !== "pending" &&
      status !== "connected" &&
      status !== "expired" &&
      status !== "failed" &&
      status !== "cancelled") ||
    !expiresAt ||
    pollAfterSeconds === null ||
    pollAfterSeconds < 1 ||
    pollAfterSeconds > 30 ||
    (value.integration !== null && !integration)
  ) {
    return null
  }

  return {
    provider,
    attempt_id: attemptId,
    status,
    expires_at: expiresAt,
    poll_after_seconds: pollAfterSeconds,
    reason,
    integration,
  }
}

export async function pollCodexConnection(
  attemptId: string,
  signal?: AbortSignal
): Promise<CodexConnectionStatusResult> {
  const value = await apiRequest<unknown>(
    `${integrationsPath}/codex/connect/${encodeURIComponent(attemptId)}`,
    { signal }
  )
  const result = normaliseCodexConnectionStatus(value)
  if (!result || result.attempt_id !== attemptId) {
    return invalidResponse("Codex connection status")
  }
  return result
}

export async function cancelCodexConnection(
  attemptId: string,
  signal?: AbortSignal
): Promise<CodexConnectionStatusResult> {
  const value = await apiRequest<unknown>(
    `${integrationsPath}/codex/connect/${encodeURIComponent(attemptId)}/cancel`,
    { method: "POST", signal }
  )
  const result = normaliseCodexConnectionStatus(value)
  if (!result || result.attempt_id !== attemptId) {
    return invalidResponse("Codex connection cancellation")
  }
  return result
}

export async function disconnectIntegration(
  provider: IntegrationProvider,
  signal?: AbortSignal
): Promise<Integration> {
  const value = await apiRequest<unknown>(
    `${integrationsPath}/${provider}/disconnect`,
    { method: "POST", signal }
  )
  const integration = normaliseIntegration(value)
  return integration ?? invalidResponse("integration disconnect response")
}
