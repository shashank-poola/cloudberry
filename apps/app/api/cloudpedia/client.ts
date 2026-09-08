import { apiRequest, BrowserApiError } from "../client"

export type CloudpediaUpdate = {
  id: string
  sourceEventId: string
  title: string
  detail: string
  source: string
  eventType: string
  externalUrl: string | null
  occurredAt: string
}

export type CloudpediaProject = {
  subjectKey: string
  sourceEventId: string
  name: string
  status: "In progress" | "Planning" | "Blocked"
  occurredAt: string
}

export type CloudpediaDecision = {
  subjectKey: string
  sourceEventId: string
  title: string
  detail: string
  project: string | null
  source: string
  externalUrl: string | null
  occurredAt: string
}

export type CloudpediaData = {
  updates: CloudpediaUpdate[]
  projects: CloudpediaProject[]
  decisions: CloudpediaDecision[]
  generatedAt: string
}

const cloudpediaPath = "/cloudpedia"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringValue = (value: unknown, maximum = 2_048): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maximum) : null
}

const dateValue = (value: unknown): string | null => {
  const candidate = stringValue(value, 128)
  if (!candidate) return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const urlValue = (value: unknown): string | null => {
  const candidate = stringValue(value, 2_048)
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

const normaliseUpdate = (value: unknown): CloudpediaUpdate | null => {
  if (!isRecord(value)) return null
  const id = stringValue(value.id, 128)
  const sourceEventId = stringValue(value.source_event_id, 128)
  const title = stringValue(value.title, 2_000)
  const detail = stringValue(value.detail, 100_000)
  const source = stringValue(value.source, 64)
  const eventType = stringValue(value.event_type, 64)
  const occurredAt = dateValue(value.occurred_at)

  if (
    !id ||
    !sourceEventId ||
    !title ||
    !detail ||
    !source ||
    !eventType ||
    !occurredAt ||
    (value.external_url !== null &&
      value.external_url !== undefined &&
      !urlValue(value.external_url))
  ) {
    return null
  }

  return {
    id,
    sourceEventId,
    title,
    detail,
    source,
    eventType,
    externalUrl: urlValue(value.external_url),
    occurredAt,
  }
}

const normaliseProject = (value: unknown): CloudpediaProject | null => {
  if (!isRecord(value)) return null
  const subjectKey = stringValue(value.subject_key, 512)
  const sourceEventId = stringValue(value.source_event_id, 128)
  const name = stringValue(value.name, 512)
  const occurredAt = dateValue(value.occurred_at)
  const status = value.status

  if (
    !subjectKey ||
    !sourceEventId ||
    !name ||
    !occurredAt ||
    (status !== "In progress" && status !== "Planning" && status !== "Blocked")
  ) {
    return null
  }

  return { subjectKey, sourceEventId, name, status, occurredAt }
}

const normaliseDecision = (value: unknown): CloudpediaDecision | null => {
  if (!isRecord(value)) return null
  const subjectKey = stringValue(value.subject_key, 512)
  const sourceEventId = stringValue(value.source_event_id, 128)
  const title = stringValue(value.title, 2_000)
  const detail = stringValue(value.detail, 100_000)
  const project =
    value.project === null || value.project === undefined
      ? null
      : stringValue(value.project, 512)
  const source = stringValue(value.source, 64)
  const occurredAt = dateValue(value.occurred_at)

  if (
    !subjectKey ||
    !sourceEventId ||
    !title ||
    !detail ||
    !source ||
    !occurredAt ||
    (value.project !== null && value.project !== undefined && !project)
  ) {
    return null
  }

  return {
    subjectKey,
    sourceEventId,
    title,
    detail,
    project,
    source,
    externalUrl: urlValue(value.external_url),
    occurredAt,
  }
}

const invalidResponse = (resource: string): never => {
  throw new BrowserApiError(
    `Cloudberry returned an invalid ${resource}.`,
    502,
    "CLOUDPEDIA_INVALID_RESPONSE"
  )
}

export async function getCloudpedia(
  signal?: AbortSignal
): Promise<CloudpediaData> {
  const value = await apiRequest<unknown>(cloudpediaPath, { signal })
  if (!isRecord(value)) return invalidResponse("Cloudpedia response")

  if (
    !Array.isArray(value.updates) ||
    !Array.isArray(value.projects) ||
    !Array.isArray(value.decisions)
  ) {
    return invalidResponse("Cloudpedia response")
  }

  const updates = value.updates
    .map(normaliseUpdate)
    .filter((entry): entry is CloudpediaUpdate => Boolean(entry))
  const projects = value.projects
    .map(normaliseProject)
    .filter((entry): entry is CloudpediaProject => Boolean(entry))
  const decisions = value.decisions
    .map(normaliseDecision)
    .filter((entry): entry is CloudpediaDecision => Boolean(entry))
  const generatedAt = dateValue(value.generated_at)

  if (
    updates.length !== value.updates.length ||
    projects.length !== value.projects.length ||
    decisions.length !== value.decisions.length ||
    !generatedAt
  ) {
    return invalidResponse("Cloudpedia response")
  }

  return { updates, projects, decisions, generatedAt }
}
