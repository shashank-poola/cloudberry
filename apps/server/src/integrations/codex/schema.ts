import { codexInvalidResponse } from "./errors"
import {
  DEFAULT_CODEX_POLL_INTERVAL_SECONDS,
  normalizeCodexAuthBaseUrl,
} from "./config"
import type {
  CodexCredentialSet,
  CodexDeviceAuthorization,
  CodexDeviceCode,
  CodexDeviceCompletion,
  CodexIdentity,
} from "./types"

export type CodexAuthResponse = Record<string, unknown>

export const asCodexRecord = (value: unknown): CodexAuthResponse => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw codexInvalidResponse()
  }
  return value as CodexAuthResponse
}

export const codexString = (value: unknown, maximum = 2_048): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maximum) : null
}

export const requiredCodexString = (value: unknown, maximum = 2_048) => {
  const result = codexString(value, maximum)
  if (!result) throw codexInvalidResponse()
  return result
}

const codexNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const parseCodexDeviceCode = (
  value: unknown,
  verificationUrl: string
): CodexDeviceCode => {
  const payload = asCodexRecord(value)
  const deviceAuthId = requiredCodexString(payload.device_auth_id)
  const userCode = requiredCodexString(
    payload.user_code ?? payload.usercode,
    128
  )
  const interval = Math.max(
    1,
    Math.min(
      30,
      Math.floor(
        codexNumber(payload.interval) ?? DEFAULT_CODEX_POLL_INTERVAL_SECONDS
      )
    )
  )

  return {
    device_auth_id: deviceAuthId,
    user_code: userCode,
    interval_seconds: interval,
    verification_url: normalizeCodexAuthBaseUrl(verificationUrl),
  }
}

export const parseCodexDeviceAuthorization = (
  value: unknown
): CodexDeviceAuthorization => {
  const payload = asCodexRecord(value)
  return {
    authorization_code: requiredCodexString(payload.authorization_code),
    code_challenge: requiredCodexString(payload.code_challenge),
    code_verifier: requiredCodexString(payload.code_verifier),
  }
}

const decodeJwtPayload = (token: string): CodexAuthResponse => {
  const parts = token.split(".")
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw codexInvalidResponse()
  }

  try {
    const encodedPayload = Buffer.from(parts[1]!, "base64url").toString("utf8")
    return asCodexRecord(JSON.parse(encodedPayload))
  } catch {
    throw codexInvalidResponse()
  }
}

const nestedRecord = (
  payload: CodexAuthResponse,
  key: string
): CodexAuthResponse => {
  const value = payload[key]
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as CodexAuthResponse)
    : {}
}

export const parseCodexIdentity = (value: unknown): CodexIdentity => {
  const payload = asCodexRecord(value)
  const idToken = requiredCodexString(payload.id_token, 16_384)
  const claims = decodeJwtPayload(idToken)
  const auth = nestedRecord(claims, "https://api.openai.com/auth")
  const profile = nestedRecord(claims, "https://api.openai.com/profile")
  const accountId =
    codexString(auth.chatgpt_account_id, 512) ||
    codexString(auth.account_id, 512) ||
    codexString(claims.sub, 512)

  if (!accountId) throw codexInvalidResponse()

  return {
    account_id: accountId,
    email: codexString(claims.email) || codexString(profile.email),
    plan_type: codexString(auth.chatgpt_plan_type, 128),
  }
}

export const parseCodexDeviceCompletion = (
  value: unknown
): CodexDeviceCompletion => {
  const payload = asCodexRecord(value)
  const identity = parseCodexIdentity(payload)
  return {
    identity,
    credentials: {
      access_token: requiredCodexString(payload.access_token, 16_384),
      refresh_token: codexString(payload.refresh_token, 16_384),
      account_id: identity.account_id,
      email: identity.email,
      plan_type: identity.plan_type,
    },
  }
}

export const parseCodexCredentialRefresh = (
  value: unknown,
  previous: CodexCredentialSet
): CodexCredentialSet => {
  const payload = asCodexRecord(value)
  const accessToken = requiredCodexString(payload.access_token, 16_384)
  const refreshToken =
    codexString(payload.refresh_token, 16_384) || previous.refresh_token
  const idToken = codexString(payload.id_token, 16_384)

  if (idToken) {
    const identity = parseCodexIdentity({ id_token: idToken })
    if (identity.account_id !== previous.account_id) {
      throw codexInvalidResponse()
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      account_id: identity.account_id,
      email: identity.email,
      plan_type: identity.plan_type,
    }
  }

  return {
    ...previous,
    access_token: accessToken,
    refresh_token: refreshToken,
  }
}
