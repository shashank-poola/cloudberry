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
    case "KNOWLEDGE_UNAVAILABLE":
    case "KNOWLEDGE_TIMEOUT":
      return "Cloudberry's company knowledge is temporarily unavailable."
    case "CODEX_NOT_AUTHENTICATED":
      return "Codex is not authenticated on the company computer yet."
    case "CODEX_BUSY":
      return "Codex is already working on another request. Try again shortly."
    case "CODEX_START_FAILED":
    case "CODEX_RUN_FAILED":
      return "Codex could not start or complete the request."
    case "SESSION_NOT_RUNNING":
      return "That Codex session is no longer running."
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
  if (error instanceof BrowserApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong while contacting Cloudberry."
}
