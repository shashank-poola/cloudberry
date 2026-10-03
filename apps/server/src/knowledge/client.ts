import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertKnowledgeSearchResult,
  type KnowledgeSearchResult,
} from "@cloudberry/contracts"

export const KNOWLEDGE_QUERY_MAX_LENGTH = 2_000
export const DEFAULT_KNOWLEDGE_TIMEOUT_MS = 8_000
export const DEFAULT_KNOWLEDGE_RESULT_LIMIT = 8

export type KnowledgeClientOptions = {
  database: SupabaseClient
  timeoutMs?: number
}

export type KnowledgeClientLike = {
  search(
    organizationId: string,
    query: string,
    limit?: number
  ): Promise<KnowledgeSearchResult>
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

/**
 * Searches company events with the `search_company_knowledge` Postgres
 * full-text function. Results keep the KnowledgeSearchResult contract so chat
 * citations point back at the source company events.
 */
export class KnowledgeClient implements KnowledgeClientLike {
  private readonly database: SupabaseClient
  private readonly timeoutMs: number

  constructor(options: KnowledgeClientOptions) {
    this.database = options.database
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
      const { data, error } = await this.database
        .rpc("search_company_knowledge", {
          p_organization_id: organizationId,
          p_query: query,
          p_limit: limit,
        })
        .abortSignal(controller.signal)

      if (controller.signal.aborted) {
        throw new KnowledgeClientError("KNOWLEDGE_TIMEOUT", null, "timeout")
      }
      if (error) {
        throw new KnowledgeClientError("KNOWLEDGE_REQUEST_FAILED", null, "http")
      }

      try {
        return assertKnowledgeSearchResult({
          organization_id: organizationId,
          query,
          retrieved_at: new Date().toISOString(),
          results: Array.isArray(data) ? data : [],
        })
      } catch {
        throw new KnowledgeClientError(
          "KNOWLEDGE_INVALID_RESPONSE",
          null,
          "invalid_response"
        )
      }
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
  options: KnowledgeClientOptions
): KnowledgeClient => new KnowledgeClient(options)
