import type {
  CompanyEvent,
  CompanyEventActor,
  JsonArray,
  JsonObject,
} from "@cloudberry/contracts"

export type ComposioTriggerNormalizationInput = {
  provider: "github" | "slack" | "linear"
  triggerSlug: string
  triggerId: string
  connectedAccountId: string
  composioUserId: string | null
  messageId: string | null
  payload: unknown
  rawPayload: unknown
  version?: string
  now?: () => Date
  createId?: () => string
}

const MAX_CONTENT_LENGTH = 100_000
const MAX_VALUE_LENGTH = 512

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const stringValue = (value: unknown, maximum = MAX_VALUE_LENGTH) => {
  if (typeof value !== "string") return null
  const valueTrimmed = value.trim()
  return valueTrimmed ? valueTrimmed.slice(0, maximum) : null
}

const firstString = (
  record: Record<string, unknown> | null,
  keys: readonly string[],
  maximum = MAX_VALUE_LENGTH
) => {
  if (!record) return null
  for (const key of keys) {
    const value = stringValue(record[key], maximum)
    if (value) return value
  }
  return null
}

const findValue = (
  value: unknown,
  keys: readonly string[],
  depth = 0
): unknown => {
  if (depth > 3) return undefined
  const record = asRecord(value)
  if (!record) return undefined

  for (const key of keys) {
    if (key in record && record[key] !== null && record[key] !== undefined) {
      return record[key]
    }
  }

  for (const nested of Object.values(record)) {
    const found = findValue(nested, keys, depth + 1)
    if (found !== undefined) return found
  }

  return undefined
}

const findString = (
  value: unknown,
  keys: readonly string[],
  maximum = MAX_VALUE_LENGTH
) => stringValue(findValue(value, keys), maximum)

const jsonPayload = (value: unknown): JsonArray | JsonObject => {
  if (Array.isArray(value)) return value as JsonArray
  if (asRecord(value)) return value as JsonObject
  return { value: typeof value === "string" ? value : String(value ?? "") }
}

const normalizeEventType = (triggerSlug: string) => {
  const normalized = triggerSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)

  if (!normalized) return "event"
  return /^[a-z]/.test(normalized)
    ? normalized
    : `event_${normalized}`.slice(0, 64)
}

const validDate = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1_000 : value
    const date = new Date(milliseconds)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const candidate = stringValue(value, 128)
  if (!candidate) return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const externalUrl = (payload: unknown) => {
  const candidate = findString(
    payload,
    ["html_url", "htmlUrl", "web_url", "webUrl", "permalink", "url", "link"],
    2_048
  )
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

const actorFromPayload = (payload: unknown): CompanyEventActor | null => {
  const actorValue = findValue(payload, [
    "actor",
    "author",
    "sender",
    "user",
    "creator",
    "assignee",
  ])

  if (typeof actorValue === "string") {
    const name = stringValue(actorValue)
    return name ? { name } : null
  }

  const actor = asRecord(actorValue)
  if (!actor) return null

  const result: CompanyEventActor = {}
  const id = firstString(actor, ["id", "login", "username", "uid"])
  const name = firstString(actor, [
    "name",
    "display_name",
    "displayName",
    "login",
  ])
  const email = firstString(actor, ["email", "email_address", "emailAddress"])
  if (id) result.id = id
  if (name) result.name = name
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    result.email = email
  }

  return Object.keys(result).length ? result : null
}

const eventIdentifier = (input: ComposioTriggerNormalizationInput) => {
  const raw = asRecord(input.rawPayload)
  const payload = asRecord(input.payload)
  const identifier =
    input.messageId ||
    firstString(raw, ["id", "log_id", "logId"], 512) ||
    firstString(payload, [
      "event_id",
      "eventId",
      "delivery_id",
      "deliveryId",
      "message_id",
      "messageId",
      "sha",
      "commit_sha",
      "commitSha",
      "id",
    ]) ||
    `${input.triggerSlug}:${input.triggerId}`

  return `${input.connectedAccountId}:${identifier}`.slice(0, 512)
}

export const normalizeComposioTrigger = (
  input: ComposioTriggerNormalizationInput
): CompanyEvent => {
  const now = input.now?.() ?? new Date()
  const receivedAt = now.toISOString()
  const payloadRecord = asRecord(input.payload)
  const rawRecord = asRecord(input.rawPayload)
  const eventType = normalizeEventType(input.triggerSlug)
  const contentCandidate =
    findString(
      input.payload,
      [
        "content",
        "body",
        "text",
        "description",
        "message",
        "markdown",
        "summary",
        "title",
      ],
      MAX_CONTENT_LENGTH
    ) || JSON.stringify(jsonPayload(input.payload))
  const content = (contentCandidate || eventType).slice(0, MAX_CONTENT_LENGTH)
  const occurredAt =
    validDate(
      firstString(rawRecord, ["timestamp", "occurred_at", "occurredAt"], 128) ||
        findValue(input.payload, [
          "timestamp",
          "occurred_at",
          "occurredAt",
          "created_at",
          "createdAt",
          "updated_at",
          "updatedAt",
        ])
    ) || receivedAt
  const title = findString(input.payload, [
    "title",
    "subject",
    "name",
    "identifier",
    "summary",
  ])
  const rawPayload = jsonPayload(input.rawPayload)
  const metadata: JsonObject = {
    provider: input.provider,
    trigger_slug: input.triggerSlug,
    trigger_id: input.triggerId,
    connected_account_id: input.connectedAccountId,
    ...(input.composioUserId ? { composio_user_id: input.composioUserId } : {}),
    ...(input.messageId ? { composio_message_id: input.messageId } : {}),
    ...(input.version ? { composio_payload_version: input.version } : {}),
  }

  return {
    id: input.createId?.() ?? globalThis.crypto.randomUUID(),
    organization_id: "",
    source: input.provider,
    external_event_id: eventIdentifier(input),
    external_url: externalUrl(input.payload),
    event_type: eventType,
    occurred_at: occurredAt,
    received_at: receivedAt,
    actor: actorFromPayload(input.payload),
    title,
    content,
    metadata,
    raw_payload: rawPayload,
  }
}

export const withOrganizationScope = (
  event: CompanyEvent,
  organizationId: string
): CompanyEvent => ({
  ...event,
  organization_id: organizationId,
})
