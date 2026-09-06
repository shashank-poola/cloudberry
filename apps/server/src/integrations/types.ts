export const SUPPORTED_INTEGRATION_PROVIDERS = [
  "codex",
  "github",
  "slack",
  "linear",
] as const

export type IntegrationProvider =
  (typeof SUPPORTED_INTEGRATION_PROVIDERS)[number]

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> =
  {
    codex: "Codex",
    github: "GitHub",
    slack: "Slack",
    linear: "Linear",
  }

export type IntegrationStatus =
  "active" | "disabled" | "error" | "reauthorization_required"

export type IntegrationTriggerStatus =
  "active" | "disabled" | "error" | "not_configured"

export type PublicIntegration = {
  provider: IntegrationProvider
  name: string
  status: IntegrationStatus | "not_connected"
  connected: boolean
  trigger_status: IntegrationTriggerStatus
  account_label: string | null
  last_event_at: string | null
  last_error: string | null
  updated_at: string | null
}

export type IntegrationListResult = {
  integrations: PublicIntegration[]
}

export type OAuthConnectionStartResult = {
  provider: Exclude<IntegrationProvider, "codex">
  redirect_url: string
}

export type CodexConnectionStartResult = {
  provider: "codex"
  auth_method: "device_code"
  attempt_id: string
  device_url: string
  user_code: string
  expires_at: string
  poll_after_seconds: number
}

export type ConnectionStartResult =
  OAuthConnectionStartResult | CodexConnectionStartResult

export type CodexConnectionStatus =
  "pending" | "connected" | "expired" | "failed" | "cancelled"

export type CodexConnectionStatusResult = {
  provider: "codex"
  attempt_id: string
  status: CodexConnectionStatus
  expires_at: string
  poll_after_seconds: number
  reason: string | null
  integration: PublicIntegration | null
}

export type ConnectionCompletionResult = {
  provider: IntegrationProvider
  success: boolean
  reason: string | null
}

export type WebhookResult = {
  kind: "event" | "connection_expired" | "ignored"
  inserted: boolean
}
