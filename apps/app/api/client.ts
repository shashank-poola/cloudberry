import { createBrowserSupabaseClient } from "@/lib/supabase/supabase"

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

/** The browser only knows the public Cloudberry API origin. */
export const API_BASE_URL = (
  configuredApiUrl || "http://localhost:8000"
).replace(/\/+$/, "")

const API_VERSION_PREFIX = API_BASE_URL.endsWith("/api/v1") ? "" : "/api/v1"

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
}

export class BrowserApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly details: unknown

  constructor(
    message: string,
    status = 0,
    code: string | null = null,
    details: unknown = null
  ) {
    super(message)
    this.name = "BrowserApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function errorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (!isRecord(value)) return null

  for (const key of ["message", "detail", "error"]) {
    const message = errorMessage(value[key])
    if (message) return message
  }

  return null
}

function friendlyErrorMessage(code: string | null, fallback: string) {
  switch (code) {
    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again."
    case "ORGANIZATION_REQUIRED":
      return "Your Cloudberry workspace is not ready yet."
    case "INTEGRATION_OWNER_REQUIRED":
      return "Only the workspace owner can manage integrations."
    case "INTEGRATION_ALREADY_CONNECTED":
      return "This integration is already connected."
    case "INTEGRATION_NOT_CONFIGURED":
      return "Cloudberry's integration service is not configured yet."
    case "INTEGRATION_TRIGGER_SETUP_FAILED":
    case "INTEGRATION_WEBHOOK_SETUP_FAILED":
      return "The integration connected, but event delivery could not be configured."
    case "INTEGRATION_REAUTHORIZATION_REQUIRED":
      return "This integration needs to be authorized again."
    case "COMPUTER_NOT_PROVISIONED":
      return "Cloudberry's computer has not been provisioned yet."
    case "COMPUTER_UNAVAILABLE":
    case "COMPUTER_NOT_FOUND":
      return "Cloudberry's computer is unavailable right now."
    case "PRIZED_NOT_CONFIGURED":
    case "SERVER_NOT_CONFIGURED":
      return "Cloudberry's computer service is not configured yet."
    case "PRIZED_TIMEOUT":
      return "Cloudberry's computer took too long to respond."
    case "KNOWLEDGE_NOT_CONFIGURED":
      return "Cloudberry's company knowledge service is not configured yet. Configure it or use your connected Codex account."
    case "KNOWLEDGE_UNAVAILABLE":
    case "KNOWLEDGE_TIMEOUT":
      return "Cloudberry's company knowledge is temporarily unavailable."
    case "CHAT_NOT_FOUND":
      return "This chat is unavailable in your current workspace."
    case "CHAT_ARCHIVED":
      return "This chat has been archived and can no longer receive messages."
    case "CHAT_IN_PROGRESS":
      return "Cloudberry is still processing that message."
    case "CHAT_STORAGE_FAILED":
      return "Cloudberry could not save this chat. Apply the latest Supabase migrations and try again."
    case "HOSTED_CHAT_NOT_CONFIGURED":
      return "Cloudberry's hosted model service is not configured yet."
    case "HOSTED_CHAT_TIMEOUT":
    case "HOSTED_CHAT_UNAVAILABLE":
    case "HOSTED_CHAT_INVALID_RESPONSE":
    case "HOSTED_CHAT_EMPTY_RESPONSE":
      return "Cloudberry's hosted model is temporarily unavailable."
    case "CODEX_RUNTIME_NOT_CONFIGURED":
      return "Cloudberry's official Codex runtime is not configured on the server."
    case "CODEX_RUNTIME_SESSION_MISSING":
      return "Reconnect Codex to start a new server-side Codex session."
    case "CODEX_MODEL_UNAVAILABLE":
      return "That Codex model is not available for the connected account."
    case "CODEX_CHAT_TIMEOUT":
    case "CODEX_RUNTIME_TIMEOUT":
      return "Codex took too long to respond. Please try again."
    case "CODEX_CHAT_INVALID_RESPONSE":
    case "CODEX_CHAT_EMPTY_RESPONSE":
      return "Codex returned an invalid response. Please try again."
    case "CODEX_CHAT_UNAVAILABLE":
    case "CODEX_RUNTIME_UNAVAILABLE":
      return "Codex is temporarily unavailable. Please try again."
    case "CODEX_AUTH_NOT_CONFIGURED":
      return "Codex sign-in is not configured yet."
    case "CODEX_AUTH_TIMEOUT":
      return "Codex sign-in took too long. Please try again."
    case "CODEX_AUTH_NOT_AUTHORIZED":
      return "OpenAI could not authorize this Codex connection."
    case "CODEX_AUTH_INVALID_RESPONSE":
    case "CODEX_AUTH_UNAVAILABLE":
    case "CODEX_AUTH_REQUEST_FAILED":
    case "CODEX_CONNECTION_FAILED":
      return "Codex could not complete the connection. Please try again."
    default:
      return fallback
  }
}

function getEnvelopeError(payload: unknown) {
  if (!isRecord(payload)) {
    return { code: null, message: "The API request failed." }
  }

  const code = typeof payload.error === "string" ? payload.error : null
  const message =
    errorMessage(payload.error) ??
    errorMessage(payload.message) ??
    "The API request failed."

  return { code, message: friendlyErrorMessage(code, message) }
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function getAccessToken() {
  try {
    const {
      data: { session },
      error,
    } = await createBrowserSupabaseClient().auth.getSession()

    if (error) {
      throw new BrowserApiError(
        "Your session could not be read. Please sign in again.",
        401,
        "AUTH_SESSION_ERROR"
      )
    }

    const accessToken = session?.access_token
    if (!accessToken) {
      throw new BrowserApiError(
        "Please sign in again to use Cloudberry.",
        401,
        "UNAUTHORIZED"
      )
    }

    return accessToken
  } catch (error) {
    if (error instanceof BrowserApiError) throw error

    throw new BrowserApiError(
      "Your session could not be read. Please sign in again.",
      401,
      "AUTH_SESSION_ERROR"
    )
  }
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${API_VERSION_PREFIX}${normalizedPath}`
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const accessToken = await getAccessToken()
  const { body, ...requestInit } = options
  const headers = new Headers(requestInit.headers)

  headers.set("Accept", "application/json")
  headers.set("Authorization", `Bearer ${accessToken}`)

  let requestBody: BodyInit | undefined
  if (body !== undefined) {
    headers.set("Content-Type", "application/json")
    requestBody = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(getApiUrl(path), {
      ...requestInit,
      body: requestBody,
      credentials: "omit",
      headers,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    throw new BrowserApiError(
      "Cloudberry's API could not be reached. Check that the server is running.",
      0,
      "NETWORK_ERROR"
    )
  }

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    const { code, message } = getEnvelopeError(payload)
    throw new BrowserApiError(
      friendlyErrorMessage(code, message),
      response.status,
      code,
      payload
    )
  }

  if (isRecord(payload) && "success" in payload) {
    if (payload.success !== true) {
      const { code, message } = getEnvelopeError(payload)
      throw new BrowserApiError(
        friendlyErrorMessage(code, message),
        response.status,
        code,
        payload
      )
    }

    return payload.data as T
  }

  return payload as T
}

export function getApiErrorMessage(error: unknown) {
  if (typeof error === "string") return friendlyErrorMessage(error, error)
  if (error instanceof BrowserApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong while contacting Cloudberry."
}
