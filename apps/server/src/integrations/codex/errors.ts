import type { CodexAuthClientErrorKind } from "./types"

export class CodexAuthClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null = null,
    readonly kind: CodexAuthClientErrorKind = "network"
  ) {
    super(code)
    this.name = "CodexAuthClientError"
  }
}

export const codexResponseError = (status: number) => {
  if (status === 401 || status === 403) {
    return new CodexAuthClientError("CODEX_AUTH_NOT_AUTHORIZED", status, "http")
  }
  if (status === 404) {
    return new CodexAuthClientError("CODEX_AUTH_NOT_AVAILABLE", status, "http")
  }
  return new CodexAuthClientError("CODEX_AUTH_REQUEST_FAILED", status, "http")
}

export const codexInvalidResponse = (status: number | null = null) =>
  new CodexAuthClientError(
    "CODEX_AUTH_INVALID_RESPONSE",
    status,
    "invalid_response"
  )
