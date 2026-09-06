import {
  isHostedModelId,
  parseHostedModelId,
  type HostedModelId,
} from "./catalog"

export const DEFAULT_GENERALCOMPUTE_BASE_URL =
  "https://api.generalcompute.com/v1"
export const DEFAULT_GENERALCOMPUTE_TIMEOUT_MS = 30_000
export const MAX_GENERALCOMPUTE_TIMEOUT_MS = 120_000
export const MAX_CHAT_MESSAGES = 32
export const MAX_CHAT_MESSAGE_LENGTH = 16_000
export const MAX_CHAT_INPUT_CHARACTERS = 64_000
export const MAX_CHAT_REQUEST_BYTES = 320 * 1024
export const MAX_CHAT_COMPLETION_TOKENS = 4_096
export const MAX_CHAT_COMPLETION_CONTENT_LENGTH = 32_000
export const MAX_CHAT_RESPONSE_BYTES = 192 * 1024

const MAX_BASE_URL_LENGTH = 2_048
const MAX_API_KEY_LENGTH = 1_024
const MAX_COMPLETION_ID_LENGTH = 256
const MAX_FINISH_REASON_LENGTH = 64
const MAX_USAGE_TOKENS = 1_000_000

type FetchLike = typeof fetch

type ChatMessageRole = "system" | "user" | "assistant"

type ValidatedChatCompletionRequest = {
  model: HostedModelId
  messages: GeneralComputeChatMessage[]
  temperature?: number
  maxTokens?: number
}

export type GeneralComputeChatMessage = {
  role: ChatMessageRole
  content: string
}

export type GeneralComputeChatCompletionRequest = {
  model: HostedModelId
  messages: readonly GeneralComputeChatMessage[]
  temperature?: number
  maxTokens?: number
}

export type GeneralComputeUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type GeneralComputeChatCompletion = {
  id: string
  model: HostedModelId
  content: string
  finishReason: string | null
  usage?: GeneralComputeUsage
}

export type GeneralComputeClientOptions = {
  baseUrl?: string
  apiKey?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
}

export type GeneralComputeClientErrorKind =
  | "configuration"
  | "validation"
  | "network"
  | "timeout"
  | "http"
  | "invalid_response"

export class GeneralComputeClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null = null,
    readonly kind: GeneralComputeClientErrorKind = "network"
  ) {
    super(code)
    this.name = "GeneralComputeClientError"
  }
}

const configurationError = () =>
  new GeneralComputeClientError(
    "GENERALCOMPUTE_NOT_CONFIGURED",
    null,
    "configuration"
  )

const invalidRequest = () =>
  new GeneralComputeClientError(
    "GENERALCOMPUTE_INVALID_REQUEST",
    null,
    "validation"
  )

const invalidResponse = () =>
  new GeneralComputeClientError(
    "GENERALCOMPUTE_INVALID_RESPONSE",
    null,
    "invalid_response"
  )

const timeoutError = () =>
  new GeneralComputeClientError("GENERALCOMPUTE_TIMEOUT", null, "timeout")

const normalizeBaseUrl = (value: string) => {
  const normalized = value.trim()

  if (!normalized || normalized.length > MAX_BASE_URL_LENGTH) {
    throw configurationError()
  }

  try {
    const url = new URL(normalized)
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid General Compute base URL")
    }

    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
  } catch {
    throw configurationError()
  }
}

const normalizeApiKey = (value: string | undefined) => {
  const apiKey = value?.trim() ?? ""

  if (
    !apiKey ||
    apiKey.length > MAX_API_KEY_LENGTH ||
    /[\u0000\r\n]/.test(apiKey)
  ) {
    throw configurationError()
  }

  return apiKey
}

const isChatMessageRole = (value: unknown): value is ChatMessageRole =>
  value === "system" || value === "user" || value === "assistant"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const parseMessages = (value: unknown): GeneralComputeChatMessage[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CHAT_MESSAGES) {
    throw invalidRequest()
  }

  let totalCharacters = 0
  const messages: GeneralComputeChatMessage[] = []

  for (const messageValue of value) {
    if (!isRecord(messageValue)) throw invalidRequest()

    const role = messageValue.role
    const content = messageValue.content
    if (
      !isChatMessageRole(role) ||
      typeof content !== "string" ||
      content.length > MAX_CHAT_MESSAGE_LENGTH ||
      content.trim().length === 0 ||
      content.includes("\u0000")
    ) {
      throw invalidRequest()
    }

    totalCharacters += content.length
    if (totalCharacters > MAX_CHAT_INPUT_CHARACTERS) {
      throw invalidRequest()
    }

    messages.push({ role, content })
  }

  return messages
}

const parseChatCompletionRequest = (
  value: GeneralComputeChatCompletionRequest
): ValidatedChatCompletionRequest => {
  if (!isRecord(value)) throw invalidRequest()

  let model: HostedModelId
  try {
    model = parseHostedModelId(value.model)
  } catch {
    throw invalidRequest()
  }

  const messages = parseMessages(value.messages)
  const temperature = value.temperature
  if (
    temperature !== undefined &&
    (typeof temperature !== "number" ||
      !Number.isFinite(temperature) ||
      temperature < 0 ||
      temperature > 2)
  ) {
    throw invalidRequest()
  }

  const maxTokens = value.maxTokens
  if (
    maxTokens !== undefined &&
    (typeof maxTokens !== "number" ||
      !Number.isSafeInteger(maxTokens) ||
      maxTokens < 1 ||
      maxTokens > MAX_CHAT_COMPLETION_TOKENS)
  ) {
    throw invalidRequest()
  }

  return { model, messages, temperature, maxTokens }
}

const buildChatCompletionBody = (request: GeneralComputeChatCompletionRequest) => {
  const validated = parseChatCompletionRequest(request)
  const body: Record<string, unknown> = {
    model: validated.model,
    messages: validated.messages,
    stream: false,
  }

  if (validated.temperature !== undefined) {
    body.temperature = validated.temperature
  }
  if (validated.maxTokens !== undefined) {
    body.max_tokens = validated.maxTokens
  }

  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).byteLength > MAX_CHAT_REQUEST_BYTES) {
    throw invalidRequest()
  }

  return { model: validated.model, body: serialized }
}

const readResponseText = async (response: Response) => {
  const contentLength = response.headers.get("content-length")
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) ||
      Number(contentLength) > MAX_CHAT_RESPONSE_BYTES)
  ) {
    throw invalidResponse()
  }

  const reader = response.body?.getReader()
  if (!reader) return ""

  const decoder = new TextDecoder()
  const chunks: string[] = []
  let receivedBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      receivedBytes += value.byteLength
      if (receivedBytes > MAX_CHAT_RESPONSE_BYTES) {
        try {
          await reader.cancel()
        } catch {}
        throw invalidResponse()
      }

      chunks.push(decoder.decode(value, { stream: true }))
    }

    chunks.push(decoder.decode())
    return chunks.join("")
  } finally {
    reader.releaseLock()
  }
}

const parseCompletionId = (value: unknown) => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_COMPLETION_ID_LENGTH ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    throw invalidResponse()
  }

  return value
}

const parseFinishReason = (value: unknown) => {
  if (value === null) return null

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_FINISH_REASON_LENGTH ||
    !/^[a-z][a-z0-9_-]*$/.test(value)
  ) {
    throw invalidResponse()
  }

  return value
}

const parseUsageValue = (value: unknown) => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_USAGE_TOKENS
  ) {
    throw invalidResponse()
  }

  return value
}

const parseUsage = (value: unknown): GeneralComputeUsage | undefined => {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw invalidResponse()

  const promptTokens = parseUsageValue(value.prompt_tokens)
  const completionTokens = parseUsageValue(value.completion_tokens)
  const totalTokens = parseUsageValue(value.total_tokens)

  if (totalTokens < promptTokens || totalTokens < completionTokens) {
    throw invalidResponse()
  }

  return { promptTokens, completionTokens, totalTokens }
}

const parseChatCompletion = (
  value: unknown,
  expectedModel: HostedModelId
): GeneralComputeChatCompletion => {
  if (!isRecord(value)) throw invalidResponse()

  const model = value.model
  if (!isHostedModelId(model) || model !== expectedModel) {
    throw invalidResponse()
  }

  const choices = value.choices
  if (!Array.isArray(choices) || choices.length !== 1 || !isRecord(choices[0])) {
    throw invalidResponse()
  }

  const choice = choices[0]
  if (choice.index !== 0 || !isRecord(choice.message)) {
    throw invalidResponse()
  }

  const message = choice.message
  const content = message.content
  if (
    message.role !== "assistant" ||
    typeof content !== "string" ||
    content.length > MAX_CHAT_COMPLETION_CONTENT_LENGTH ||
    content.includes("\u0000")
  ) {
    throw invalidResponse()
  }

  return {
    id: parseCompletionId(value.id),
    model,
    content,
    finishReason: parseFinishReason(choice.finish_reason),
    usage: parseUsage(value.usage),
  }
}

const joinUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`

export const getGeneralComputeBaseUrl = () =>
  normalizeBaseUrl(
    process.env.GENERALCOMPUTE_BASE_URL ?? DEFAULT_GENERALCOMPUTE_BASE_URL
  )

export class GeneralComputeClient {
  readonly #baseUrl: string
  readonly #apiKey: string
  readonly #fetchImpl: FetchLike
  readonly #timeoutMs: number

  constructor(options: GeneralComputeClientOptions = {}) {
    this.#baseUrl = normalizeBaseUrl(
      options.baseUrl ??
        process.env.GENERALCOMPUTE_BASE_URL ??
        DEFAULT_GENERALCOMPUTE_BASE_URL
    )
    this.#apiKey = normalizeApiKey(
      options.apiKey ?? process.env.GENERALCOMPUTE_API_KEY
    )
    this.#fetchImpl = options.fetchImpl ?? fetch
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_GENERALCOMPUTE_TIMEOUT_MS

    if (
      !Number.isSafeInteger(this.#timeoutMs) ||
      this.#timeoutMs < 1 ||
      this.#timeoutMs > MAX_GENERALCOMPUTE_TIMEOUT_MS
    ) {
      throw configurationError()
    }
  }

  async createChatCompletion(
    request: GeneralComputeChatCompletionRequest
  ): Promise<GeneralComputeChatCompletion> {
    const { model, body } = buildChatCompletionBody(request)
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort()
        reject(timeoutError())
      }, this.#timeoutMs)
    })

    try {
      const response = await Promise.race([
        this.#fetchImpl(joinUrl(this.#baseUrl, "/chat/completions"), {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.#apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: controller.signal,
        }),
        timeoutPromise,
      ])

      if (!response.ok) {
        const kind =
          response.status === 401 || response.status === 403
            ? "configuration"
            : "http"
        throw new GeneralComputeClientError(
          "GENERALCOMPUTE_REQUEST_FAILED",
          response.status,
          kind
        )
      }

      const responseText = await readResponseText(response)
      let payload: unknown
      try {
        payload = JSON.parse(responseText)
      } catch {
        throw invalidResponse()
      }

      return parseChatCompletion(payload, model)
    } catch (error) {
      if (error instanceof GeneralComputeClientError) throw error

      if (controller.signal.aborted) {
        throw timeoutError()
      }

      throw new GeneralComputeClientError(
        "GENERALCOMPUTE_UNAVAILABLE",
        null,
        "network"
      )
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
    }
  }
}

export const createGeneralComputeClient = (
  options: GeneralComputeClientOptions = {}
): GeneralComputeClient => new GeneralComputeClient(options)
