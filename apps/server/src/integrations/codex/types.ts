export type FetchLike = typeof fetch

export type CodexAuthClientErrorKind =
  "configuration" | "network" | "timeout" | "http" | "invalid_response"

export type CodexDeviceCode = {
  device_auth_id: string
  user_code: string
  interval_seconds: number
  verification_url: string
}

export type CodexDeviceAuthorization = {
  authorization_code: string
  code_challenge: string
  code_verifier: string
}

export type CodexIdentity = {
  account_id: string
  email: string | null
  plan_type: string | null
}

/**
 * Credentials are deliberately kept separate from CodexIdentity. They may be
 * passed to the in-memory app-server runtime, but must never be serialized to
 * Supabase rows or returned to the browser.
 */
export type CodexCredentialSet = {
  access_token: string
  refresh_token: string | null
  account_id: string
  email: string | null
  plan_type: string | null
}

export type CodexDeviceCompletion = {
  identity: CodexIdentity
  credentials: CodexCredentialSet
}

export type CodexDevicePollResult =
  | { status: "pending" }
  | { status: "authorized"; authorization: CodexDeviceAuthorization }

export type CodexAuthClientOptions = {
  baseUrl?: string
  clientId?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}

export type CodexAuthClientLike = {
  requestDeviceCode(): Promise<CodexDeviceCode>
  pollDeviceCode(
    deviceAuthId: string,
    userCode: string
  ): Promise<CodexDevicePollResult>
  completeDeviceCode(
    authorization: CodexDeviceAuthorization
  ): Promise<CodexIdentity>
  completeDeviceCodeWithCredentials(
    authorization: CodexDeviceAuthorization
  ): Promise<CodexDeviceCompletion>
  refreshCredentials(
    credentials: CodexCredentialSet
  ): Promise<CodexCredentialSet>
}
