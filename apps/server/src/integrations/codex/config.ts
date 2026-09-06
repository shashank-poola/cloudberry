import { CodexAuthClientError } from "./errors"

export const DEFAULT_CODEX_AUTH_BASE_URL = "https://auth.openai.com"
export const DEFAULT_CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
export const DEFAULT_CODEX_DEVICE_AUTH_TTL_SECONDS = 15 * 60
export const DEFAULT_CODEX_POLL_INTERVAL_SECONDS = 5
export const DEFAULT_CODEX_AUTH_TIMEOUT_MS = 12_000

export const normalizeCodexAuthBaseUrl = (value: string) => {
  const normalized = value.trim().replace(/\/+$/, "")
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new CodexAuthClientError(
      "CODEX_AUTH_NOT_CONFIGURED",
      null,
      "configuration"
    )
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CodexAuthClientError(
      "CODEX_AUTH_NOT_CONFIGURED",
      null,
      "configuration"
    )
  }

  return normalized
}

export const getCodexAuthBaseUrl = () =>
  normalizeCodexAuthBaseUrl(
    process.env.CODEX_AUTH_BASE_URL?.trim() || DEFAULT_CODEX_AUTH_BASE_URL
  )

export const getCodexClientId = () =>
  process.env.CODEX_CLIENT_ID?.trim() || DEFAULT_CODEX_CLIENT_ID

export const getCodexAuthTimeoutMs = () => {
  const raw = process.env.CODEX_AUTH_TIMEOUT_MS?.trim()
  if (!raw) return DEFAULT_CODEX_AUTH_TIMEOUT_MS

  const timeout = Number(raw)
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new CodexAuthClientError(
      "CODEX_AUTH_NOT_CONFIGURED",
      null,
      "configuration"
    )
  }
  return timeout
}
