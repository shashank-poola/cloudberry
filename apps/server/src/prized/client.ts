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

export type PrizedPromptRun = {
  id: string
  provider?: string
  model?: string | null
  reasoningEffort?: string | null
  auto?: boolean
  status?: string
  exitCode?: number | null
  pid?: number | null
  cwd?: string
  startedAt?: string | null
  finishedAt?: string | null
  sessionId?: string | null
  resumedFrom?: string | null
  parent?: string | null
  eventCount?: number
  prompt?: string
  stderr?: string
  stderrTruncated?: boolean
  [key: string]: unknown
}

export type PrizedPromptStarted = {
  run?: PrizedPromptRun
  queued?: boolean
  active?: unknown
  [key: string]: unknown
}

export type PrizedPromptEvent = {
  seq: number
  at: string
  type: string
  text?: string
  tool?: {
    name?: string
    input?: unknown
    [key: string]: unknown
  } | null
  raw?: unknown
  [key: string]: unknown
}

export type PrizedPromptEvents = {
  run?: PrizedPromptRun
  events: PrizedPromptEvent[]
  next: number
  finished: boolean
  [key: string]: unknown
}

export type PrizedInterruptResponse = {
  id: string
  wasRunning?: boolean
  signal?: string
  [key: string]: unknown
}

export type PrizedCodexPromptRequest = {
  prompt: string
  cwd?: string
  continue?: boolean
  queue?: boolean
}

type FetchLike = typeof fetch

type RequestOptions = {
  method: "GET" | "POST"
  body?: unknown
}

export type PrizedClientOptions = {
  baseUrl?: string
  token?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}

export type PrizedClientErrorKind =
  "configuration" | "network" | "timeout" | "http" | "invalid_response"

export class PrizedClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null = null,
    readonly kind: PrizedClientErrorKind = "network",
    readonly providerCode: string | null = null
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

const parseRun = (value: unknown): PrizedPromptRun => {
  const run = asRecord(value)
  const id = asNonEmptyString(run.id ?? run.run_id)
  return { ...run, id } as PrizedPromptRun
}

const parsePromptStarted = (value: unknown): PrizedPromptStarted => {
  const response = asRecord(value)
  const data = response.data
  const dataRecord =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null
  const candidate =
    dataRecord && "run" in dataRecord ? dataRecord.run : response.run
  const runValue =
    candidate ??
    (typeof response.id === "string" || typeof response.run_id === "string"
      ? response
      : undefined)
  const run = runValue === undefined ? undefined : parseRun(runValue)
  const queued = response.queued === true || dataRecord?.queued === true

  if (!run && !queued) {
    throw invalidResponse()
  }

  return { ...response, run, queued } as PrizedPromptStarted
}

const parsePromptEvents = (value: unknown): PrizedPromptEvents => {
  const response = asRecord(value)
  const data = response.data
  const payload =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : response
  const rawEvents = payload.events

  if (!Array.isArray(rawEvents)) {
    throw invalidResponse()
  }

  const events = rawEvents.map((event) => {
    const parsedEvent = asRecord(event)
    if (
      typeof parsedEvent.seq !== "number" ||
      !Number.isSafeInteger(parsedEvent.seq) ||
      typeof parsedEvent.at !== "string" ||
      typeof parsedEvent.type !== "string"
    ) {
      throw invalidResponse()
    }

    return parsedEvent as PrizedPromptEvent
  })

  if (
    typeof payload.next !== "number" ||
    !Number.isSafeInteger(payload.next) ||
    typeof payload.finished !== "boolean"
  ) {
    throw invalidResponse()
  }

  const runValue = payload.run
  const run = runValue === undefined ? undefined : parseRun(runValue)
  return { ...payload, run, events } as PrizedPromptEvents
}

const providerErrorCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const code = value.trim().toLowerCase()
  return /^[a-z][a-z0-9_]{0,63}$/.test(code) ? code : null
}

const readProviderErrorCode = async (response: Response) => {
  try {
    const payload = await response.json()
    if (typeof payload !== "object" || payload === null) return null

    const record = payload as Record<string, unknown>
    const error = record.error
    if (typeof error === "object" && error !== null) {
      return providerErrorCode((error as Record<string, unknown>).code)
    }

    return providerErrorCode(record.code)
  } catch {
    return null
  }
}

const parseInterruptResponse = (
  value: unknown,
  fallbackId: string
): PrizedInterruptResponse => {
  if (value === null || value === undefined) {
    return { id: fallbackId }
  }

  const response = asRecord(value)
  return {
    ...response,
    id: asNonEmptyString(response.id ?? response.run_id ?? fallbackId),
  } as PrizedInterruptResponse
}

export const getPrizedApiBaseUrl = () =>
  normalizeBaseUrl(
    process.env.PRIZED_API_BASE_URL || DEFAULT_PRIZED_API_BASE_URL
  )

export class PrizedClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly fetchImpl: FetchLike
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

  async postCodexPrompt(
    edgeUrl: string,
    boxId: string,
    request: PrizedCodexPromptRequest
  ): Promise<PrizedPromptStarted> {
    const body: Record<string, unknown> = {
      provider: "codex",
      prompt: request.prompt,
    }

    if (request.cwd !== undefined) body.cwd = request.cwd
    if (request.continue !== undefined) body.continue = request.continue
    if (request.queue !== undefined) body.queue = request.queue

    return parsePromptStarted(
      await this.requestEdge<unknown>(
        validateUrl(edgeUrl),
        `/v1/box/${encodeURIComponent(boxId)}/prompts`,
        { method: "POST", body }
      )
    )
  }

  async getPromptStatus(
    edgeUrl: string,
    boxId: string,
    runId: string
  ): Promise<{ run: PrizedPromptRun }> {
    const response = asRecord(
      await this.requestEdge<unknown>(
        validateUrl(edgeUrl),
        `/v1/box/${encodeURIComponent(boxId)}/prompts/${encodeURIComponent(runId)}`,
        { method: "GET" }
      )
    )
    const data = response.data
    const payload =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : response
    const runValue = payload.run ?? payload

    return { run: parseRun(runValue) }
  }

  async getPromptEvents(
    edgeUrl: string,
    boxId: string,
    runId: string,
    after?: number
  ): Promise<PrizedPromptEvents> {
    const query =
      after === undefined ? "" : `?after=${encodeURIComponent(after)}`
    return parsePromptEvents(
      await this.requestEdge<unknown>(
        validateUrl(edgeUrl),
        `/v1/box/${encodeURIComponent(boxId)}/prompts/${encodeURIComponent(
          runId
        )}/events${query}`,
        { method: "GET" }
      )
    )
  }

  async interruptPrompt(
    edgeUrl: string,
    boxId: string,
    runId: string
  ): Promise<PrizedInterruptResponse> {
    return parseInterruptResponse(
      await this.requestEdge<unknown>(
        validateUrl(edgeUrl),
        `/v1/box/${encodeURIComponent(boxId)}/prompts/${encodeURIComponent(
          runId
        )}/interrupt`,
        { method: "POST" }
      ),
      runId
    )
  }

  private requestEdge<T>(
    edgeUrl: string,
    path: string,
    options: RequestOptions
  ) {
    return this.requestUrl<T>(joinUrl(edgeUrl, path), options)
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
        const providerCode = await readProviderErrorCode(response)
        throw new PrizedClientError(
          "PRIZED_REQUEST_FAILED",
          response.status,
          kind,
          providerCode
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
