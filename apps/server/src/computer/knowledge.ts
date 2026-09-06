import {
  assertKnowledgeSearchResult,
  type KnowledgeSearchResult,
} from "@cloudberry/contracts"

export const KNOWLEDGE_QUERY_MAX_LENGTH = 2_000
export const DEFAULT_KNOWLEDGE_TIMEOUT_MS = 8_000
export const DEFAULT_KNOWLEDGE_RESULT_LIMIT = 8

export type KnowledgeClientOptions = {
  baseUrl?: string
  token?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export class KnowledgeClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null = null,
    readonly kind:
      | "configuration"
      | "network"
      | "timeout"
      | "http"
      | "invalid_response" = "network"
  ) {
    super(code)
    this.name = "KnowledgeClientError"
  }
}

const normalizeBaseUrl = (value: string) => {
  const normalized = value.replace(/\/+$/, "")

  try {
    const url = new URL(normalized)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported URL protocol")
    }
  } catch {
    throw new KnowledgeClientError(
      "KNOWLEDGE_NOT_CONFIGURED",
      null,
      "configuration"
    )
  }

  return normalized
}

const assertSearchInput = (
  organizationId: string,
  query: string,
  limit: number
) => {
  if (
    organizationId.length === 0 ||
    query.trim().length === 0 ||
    query.length > KNOWLEDGE_QUERY_MAX_LENGTH ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 25
  ) {
    throw new KnowledgeClientError(
      "KNOWLEDGE_INVALID_REQUEST",
      null,
      "configuration"
    )
  }
}

export class KnowledgeClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: KnowledgeClientOptions = {}) {
    const baseUrl = options.baseUrl || process.env.KNOWLEDGE_SERVICE_URL
    const token = options.token || process.env.KNOWLEDGE_SERVICE_TOKEN

    if (!baseUrl || !token) {
      throw new KnowledgeClientError(
        "KNOWLEDGE_NOT_CONFIGURED",
        null,
        "configuration"
      )
    }

    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.token = token
    this.fetchImpl = options.fetchImpl || fetch
    this.timeoutMs = options.timeoutMs || DEFAULT_KNOWLEDGE_TIMEOUT_MS

    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new KnowledgeClientError(
        "KNOWLEDGE_NOT_CONFIGURED",
        null,
        "configuration"
      )
    }
  }

  async search(
    organizationId: string,
    query: string,
    limit = DEFAULT_KNOWLEDGE_RESULT_LIMIT
  ): Promise<KnowledgeSearchResult> {
    assertSearchInput(organizationId, query, limit)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/internal/v1/search`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            organization_id: organizationId,
            query,
            limit,
          }),
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        throw new KnowledgeClientError(
          "KNOWLEDGE_REQUEST_FAILED",
          response.status,
          "http"
        )
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new KnowledgeClientError(
          "KNOWLEDGE_INVALID_RESPONSE",
          response.status,
          "invalid_response"
        )
      }

      let result: KnowledgeSearchResult
      try {
        result = assertKnowledgeSearchResult(payload)
      } catch {
        throw new KnowledgeClientError(
          "KNOWLEDGE_INVALID_RESPONSE",
          response.status,
          "invalid_response"
        )
      }

      if (result.organization_id !== organizationId) {
        throw new KnowledgeClientError(
          "KNOWLEDGE_INVALID_RESPONSE",
          response.status,
          "invalid_response"
        )
      }

      return result
    } catch (error) {
      if (error instanceof KnowledgeClientError) {
        throw error
      }

      if (controller.signal.aborted) {
        throw new KnowledgeClientError("KNOWLEDGE_TIMEOUT", null, "timeout")
      }

      throw new KnowledgeClientError("KNOWLEDGE_UNAVAILABLE", null, "network")
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const createKnowledgeClient = (
  options: KnowledgeClientOptions = {}
): KnowledgeClient => new KnowledgeClient(options)
