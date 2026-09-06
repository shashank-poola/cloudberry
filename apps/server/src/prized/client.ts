export const DEFAULT_PRIZED_API_BASE_URL = "https://api.prized.dev/api/v1"
export const DEFAULT_PRIZED_TIMEOUT_MS = 12_000

export type PrizedBox = {
  id: string
  hostname?: string
  tier?: string
  desiredState?: string
  observedState?: string
  region?: string
  [key: string]: unknown
}

export type PrizedMe = {
  edge: {
    url: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type PrizedBoxResponse = {
  box: PrizedBox
  [key: string]: unknown
}

export type PrizedBoxDetails = PrizedBoxResponse & {
  state?: unknown
  vitals?: unknown
  events?: unknown
  job?: unknown
}

type RequestOptions = {
  method: "GET" | "POST"
  body?: unknown
}

export type PrizedClientOptions = {
  baseUrl?: string
  token?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export type PrizedClientErrorKind =
  "configuration" | "network" | "timeout" | "http" | "invalid_response"

export class PrizedClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null = null,
    readonly kind: PrizedClientErrorKind = "network"
  ) {
    super(code)
    this.name = "PrizedClientError"
  }
}

const invalidResponse = () =>
  new PrizedClientError("PRIZED_INVALID_RESPONSE", null, "invalid_response")

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResponse()
  }

  return value as Record<string, unknown>
}

const asNonEmptyString = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidResponse()
  }

  return value.trim()
}

const normalizeBaseUrl = (value: string) => {
  const normalized = value.trim().replace(/\/+$/, "")

  try {
    const url = new URL(normalized)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported URL protocol")
    }
  } catch {
    throw new PrizedClientError("PRIZED_NOT_CONFIGURED", null, "configuration")
  }

  return normalized
}

const validateUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported URL protocol")
    }
  } catch {
    throw invalidResponse()
  }

  return value.replace(/\/+$/, "")
}

const joinUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`

const parseBox = (value: unknown): PrizedBox => {
  const box = asRecord(value)
  const id = asNonEmptyString(box.id ?? box.box_id)
  return { ...box, id } as PrizedBox
}

const parseBoxResponse = (value: unknown): PrizedBoxResponse => {
  const response = asRecord(value)
  const data = response.data
  const dataRecord = typeof data === "object" && data !== null ? data : null
  const candidate =
    response.box ??
    (dataRecord && "box" in dataRecord
      ? dataRecord.box
      : (dataRecord ?? response))

  return {
    ...response,
    box: parseBox(candidate),
  } as PrizedBoxResponse
}

export const getPrizedApiBaseUrl = () =>
  normalizeBaseUrl(
    process.env.PRIZED_API_BASE_URL || DEFAULT_PRIZED_API_BASE_URL
  )

export class PrizedClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: PrizedClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl ||
        process.env.PRIZED_API_BASE_URL ||
        DEFAULT_PRIZED_API_BASE_URL
    )

    const token = (options.token || process.env.PRIZED_API_TOKEN || "").trim()
    if (!token) {
      throw new PrizedClientError(
        "PRIZED_NOT_CONFIGURED",
        null,
        "configuration"
      )
    }

    this.token = token
    this.fetchImpl = options.fetchImpl || fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_PRIZED_TIMEOUT_MS

    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new PrizedClientError(
        "PRIZED_NOT_CONFIGURED",
        null,
        "configuration"
      )
    }
  }

  async getMe(): Promise<PrizedMe> {
    const response = asRecord(
      await this.request<unknown>("/me", { method: "GET" })
    )
    const data = response.data
    const payload =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : response
    const edge = asRecord(payload.edge)
    const url = validateUrl(asNonEmptyString(edge.url))

    return { ...payload, edge: { ...edge, url } } as PrizedMe
  }

  async createBox(
    body: Record<string, unknown> = {}
  ): Promise<PrizedBoxResponse> {
    return parseBoxResponse(
      await this.request<unknown>("/boxes", { method: "POST", body })
    )
  }

  async getBox(boxId: string): Promise<PrizedBoxDetails> {
    return parseBoxResponse(
      await this.request<unknown>(`/boxes/${encodeURIComponent(boxId)}`, {
        method: "GET",
      })
    ) as PrizedBoxDetails
  }

  async wakeBox(boxId: string): Promise<PrizedBoxResponse> {
    return parseBoxResponse(
      await this.request<unknown>(`/boxes/${encodeURIComponent(boxId)}/wake`, {
        method: "POST",
      })
    )
  }

  private request<T>(path: string, options: RequestOptions) {
    return this.requestUrl<T>(joinUrl(this.baseUrl, path), options)
  }

  private async requestUrl<T>(
    url: string,
    options: RequestOptions
  ): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.token}`,
    }

    if (options.body !== undefined) headers["Content-Type"] = "application/json"

    try {
      const response = await this.fetchImpl(url, {
        method: options.method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const kind =
          response.status === 401 || response.status === 403
            ? "configuration"
            : "http"
        throw new PrizedClientError(
          "PRIZED_REQUEST_FAILED",
          response.status,
          kind
        )
      }

      if (response.status === 204) return null as T

      try {
        return (await response.json()) as T
      } catch {
        throw new PrizedClientError(
          "PRIZED_INVALID_RESPONSE",
          response.status,
          "invalid_response"
        )
      }
    } catch (error) {
      if (error instanceof PrizedClientError) throw error

      if (controller.signal.aborted) {
        throw new PrizedClientError("PRIZED_TIMEOUT", null, "timeout")
      }

      throw new PrizedClientError("PRIZED_UNAVAILABLE", null, "network")
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const createPrizedClient = (
  options: PrizedClientOptions = {}
): PrizedClient => new PrizedClient(options)
