import {
  assertCompanyEvent,
  type CompanyEvent,
  type JsonObject,
} from "@cloudberry/contracts"
import type { SupabaseClient } from "@supabase/supabase-js"

const PROJECTION_TABLE = "knowledge_projections"

export type ProjectionType = "update" | "project" | "decision"

export type EventProjection = {
  organization_id: string
  projection_type: ProjectionType
  subject_key: string
  source_event_id: string
  payload: Record<string, unknown>
  generated_at: string
}

type DatabaseRow = Record<string, unknown>

type StoredEventRow = {
  organization_id: unknown
  normalized_payload: unknown
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const stringValue = (value: unknown, maximum = 512): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maximum) : null
}

const stringMetadata = (metadata: JsonObject, key: string) =>
  stringValue(metadata[key])

const findStringByKeys = (
  value: unknown,
  keys: readonly string[],
  depth = 0
): string | null => {
  if (depth > 6) return null
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findStringByKeys(entry, keys, depth + 1)
      if (found) return found
    }
    return null
  }

  const record = asRecord(value)
  if (!record) return null

  for (const key of keys) {
    const found = stringValue(record[key])
    if (found) return found
  }

  for (const entry of Object.values(record)) {
    const found = findStringByKeys(entry, keys, depth + 1)
    if (found) return found
  }

  return null
}

const findNestedString = (
  value: unknown,
  parentKeys: readonly string[],
  childKeys: readonly string[],
  depth = 0
): string | null => {
  if (depth > 6) return null
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findNestedString(entry, parentKeys, childKeys, depth + 1)
      if (found) return found
    }
    return null
  }

  const record = asRecord(value)
  if (!record) return null

  for (const parentKey of parentKeys) {
    if (!(parentKey in record)) continue
    const candidate = record[parentKey]
    const direct = stringValue(candidate)
    if (direct) return direct
    const nested = findStringByKeys(candidate, childKeys)
    if (nested) return nested
  }

  for (const entry of Object.values(record)) {
    const found = findNestedString(entry, parentKeys, childKeys, depth + 1)
    if (found) return found
  }

  return null
}

const subjectKey = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ").slice(0, 512)

const displayEventType = (value: string) =>
  value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ") || "Company update"

const projectStatus = (
  value: string | null
): "In progress" | "Planning" | "Blocked" => {
  const normalized = value?.toLowerCase().replace(/[\s-]+/g, "_") ?? ""
  if (
    normalized.includes("block") ||
    normalized.includes("hold") ||
    normalized.includes("risk") ||
    normalized.includes("pause") ||
    normalized.includes("cancel")
  ) {
    return "Blocked"
  }
  if (
    normalized.includes("progress") ||
    normalized.includes("active") ||
    normalized.includes("started") ||
    normalized.includes("review") ||
    normalized.includes("done") ||
    normalized.includes("complete") ||
    normalized.includes("closed") ||
    normalized.includes("on_track")
  ) {
    return "In progress"
  }
  return "Planning"
}

const githubRepository = (event: CompanyEvent): string | null => {
  if (event.source !== "github") return null

  const payload = event.raw_payload
  const owner = findStringByKeys(payload, [
    "repository_owner",
    "repositoryOwner",
    "owner",
  ])
  const repository = findStringByKeys(payload, [
    "repository_name",
    "repositoryName",
    "repo",
  ])
  if (owner && repository) return `${owner}/${repository}`
  if (repository) return repository

  if (!event.external_url) return null
  try {
    const segments = new URL(event.external_url).pathname
      .split("/")
      .filter(Boolean)
    const repositoriesIndex = segments.indexOf("repos")
    const start = repositoriesIndex >= 0 ? repositoriesIndex + 1 : 0
    const [urlOwner, urlRepository] = segments.slice(start, start + 2)
    return urlOwner && urlRepository ? `${urlOwner}/${urlRepository}` : null
  } catch {
    return null
  }
}

const projectName = (event: CompanyEvent): string | null => {
  const metadataProject =
    stringMetadata(event.metadata, "project") ??
    stringMetadata(event.metadata, "repository")
  if (metadataProject) return metadataProject

  const payload = event.raw_payload
  const githubProject = githubRepository(event)
  if (githubProject) return githubProject

  return (
    findStringByKeys(payload, [
      "project_name",
      "projectName",
      "repository_name",
      "repositoryName",
    ]) ??
    findNestedString(
      payload,
      ["project", "repository"],
      ["full_name", "fullName", "name", "identifier"]
    )
  )
}

const projectStatusValue = (event: CompanyEvent): string | null =>
  stringMetadata(event.metadata, "status") ??
  stringMetadata(event.metadata, "project_status") ??
  findStringByKeys(event.raw_payload, ["project_status", "projectStatus"]) ??
  findNestedString(
    event.raw_payload,
    ["status", "state", "health"],
    ["name", "type", "label", "value"]
  )

const commonPayload = (event: CompanyEvent) => ({
  event_id: event.id,
  source: event.source,
  event_type: event.event_type,
  title: event.title ?? displayEventType(event.event_type),
  detail: event.content,
  external_url: event.external_url,
  occurred_at: event.occurred_at,
  received_at: event.received_at,
})

/**
 * Build the small, deterministic read model used by Cloudpedia. Graphiti is
 * optimized for retrieval; this projection keeps the dashboard queryable and
 * does not make the UI depend on Graphiti internals.
 */
export const buildEventProjections = (
  event: CompanyEvent,
  generatedAt = new Date().toISOString()
): EventProjection[] => {
  const metadata = event.metadata
  const payload = commonPayload(event)
  const projections: EventProjection[] = [
    {
      organization_id: event.organization_id,
      projection_type: "update",
      subject_key: event.id,
      source_event_id: event.id,
      payload,
      generated_at: generatedAt,
    },
  ]

  const project = projectName(event)
  if (project) {
    projections.push({
      organization_id: event.organization_id,
      projection_type: "project",
      subject_key: subjectKey(project),
      source_event_id: event.id,
      payload: {
        ...payload,
        name: project,
        status: projectStatus(projectStatusValue(event)),
      },
      generated_at: generatedAt,
    })
  }

  const decisionKey = stringMetadata(metadata, "decision_key")
  const decisionText = `${event.title ?? ""} ${event.content}`.toLowerCase()
  if (
    decisionKey ||
    /\b(decision|decided|supersedes|superseded)\b/.test(decisionText)
  ) {
    projections.push({
      organization_id: event.organization_id,
      projection_type: "decision",
      subject_key: subjectKey(decisionKey ?? event.id),
      source_event_id: event.id,
      payload: {
        ...payload,
        project,
        decision_key: decisionKey,
      },
      generated_at: generatedAt,
    })
  }

  return projections
}

export const projectEvent = async (
  database: SupabaseClient,
  event: CompanyEvent,
  generatedAt = new Date().toISOString()
): Promise<number> => {
  const projections = buildEventProjections(event, generatedAt)
  const rows: DatabaseRow[] = projections.map((projection) => projection)
  const { error } = await database.from(PROJECTION_TABLE).upsert(rows, {
    onConflict: "organization_id,projection_type,subject_key",
  })

  if (error) throw error
  return projections.length
}

/**
 * Backfill projections for events that were processed before the projection
 * stage existed. This is intentionally idempotent and safe to run on worker
 * startup or as a one-off command.
 */
export const backfillProjections = async (
  database: SupabaseClient
): Promise<number> => {
  const { data, error } = await database
    .from("company_events")
    .select("organization_id, normalized_payload")
    .eq("processing_status", "processed")
    .order("processed_at", { ascending: true })

  if (error) throw error

  let projectionCount = 0
  for (const value of (data ?? []) as StoredEventRow[]) {
    const event = assertCompanyEvent(value.normalized_payload)
    if (value.organization_id !== event.organization_id) {
      console.warn(
        `Skipping Cloudpedia projection for ${event.id}: organization scope mismatch`
      )
      continue
    }
    projectionCount += await projectEvent(database, event)
  }

  return projectionCount
}
