import { apiRequest, BrowserApiError } from "../client"
import type { CodexModelId } from "./catalog"

export type CodexModel = {
  id: CodexModelId
  name: string
  reasoningEffort: "high"
  inputModalities: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringValue = (value: unknown, maximum = 256) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maximum) : null
}

const normaliseModel = (value: unknown): CodexModel | null => {
  if (!isRecord(value)) return null
  const id = stringValue(value.id, 128)
  const name = stringValue(value.name, 160)
  if (!id || !name || value.reasoning_effort !== "high") return null

  const inputModalities = Array.isArray(value.input_modalities)
    ? value.input_modalities.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
      )
    : ["text", "image"]

  return {
    id,
    name,
    reasoningEffort: "high",
    inputModalities,
  }
}

const invalidResponse = (): never => {
  throw new BrowserApiError(
    "Cloudberry returned an invalid Codex model list.",
    502,
    "CODEX_RUNTIME_INVALID_RESPONSE"
  )
}

export async function getCodexModels(
  signal?: AbortSignal
): Promise<CodexModel[]> {
  const value = await apiRequest<unknown>("/chats/codex/models", { signal })
  if (!isRecord(value) || !Array.isArray(value.models)) {
    return invalidResponse()
  }

  const models = value.models
    .map(normaliseModel)
    .filter((model): model is CodexModel => Boolean(model))
  if (models.length !== value.models.length || models.length === 0) {
    return invalidResponse()
  }
  return models
}
