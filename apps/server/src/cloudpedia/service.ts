import type { SupabaseClient } from "@supabase/supabase-js"

const PROJECTION_TABLE = "knowledge_projections"
const PROJECTION_TYPES = ["update", "project", "decision"] as const
const MAX_PROJECTIONS = 150

export type CloudpediaUpdate = {
  id: string
  source_event_id: string
  title: string
  detail: string
  source: string
  event_type: string
  external_url: string | null
  occurred_at: string
}

export type CloudpediaProject = {
  subject_key: string
  source_event_id: string
  name: string
  status: "In progress" | "Planning" | "Blocked"
  occurred_at: string
}

export type CloudpediaDecision = {
  subject_key: string
  source_event_id: string
  title: string
  detail: string
  project: string | null
  source: string
  external_url: string | null
  occurred_at: string
}

export type CloudpediaResult = {
  updates: CloudpediaUpdate[]
  projects: CloudpediaProject[]
  decisions: CloudpediaDecision[]
  generated_at: string
}

export class CloudpediaServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code)
    this.name = "CloudpediaServiceError"
  }
}

type DatabaseRow = Record<string, unknown>

type ProjectionRow = {
  id: string
  projection_type: (typeof PROJECTION_TYPES)[number]
  subject_key: string
  source_event_id: string
  payload: DatabaseRow
  updated_at: string
}

const asRecord = (value: unknown): DatabaseRow | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DatabaseRow)
    : null

const stringValue = (value: unknown, maximum = 2_048): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maximum) : null
}

const dateValue = (value: unknown) => {
  const candidate = stringValue(value, 128)
  if (!candidate) return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const projectStatus = (value: unknown): CloudpediaProject["status"] | null => {
  if (value === "In progress" || value === "Planning" || value === "Blocked") {
    return value
  }
  return null
}

const parseProjection = (value: unknown): ProjectionRow | null => {
  const row = asRecord(value)
  if (!row) return null

  const projectionType = stringValue(row.projection_type, 64)
  const id = stringValue(row.id, 128)
  const subjectKey = stringValue(row.subject_key, 512)
  const sourceEventId = stringValue(row.source_event_id, 128)
  const payload = asRecord(row.payload)
  const updatedAt = dateValue(row.updated_at)

  if (
    !id ||
    !projectionType ||
    !PROJECTION_TYPES.includes(
      projectionType as (typeof PROJECTION_TYPES)[number]
    ) ||
    !subjectKey ||
    !sourceEventId ||
    !payload ||
    !updatedAt
  ) {
    return null
  }

  return {
    id,
    projection_type: projectionType as ProjectionRow["projection_type"],
    subject_key: subjectKey,
    source_event_id: sourceEventId,
    payload,
    updated_at: updatedAt,
  }
}

const eventFields = (projection: ProjectionRow) => {
  const payload = asRecord(projection.payload) ?? {}
  const occurredAt = dateValue(payload.occurred_at)
  const source = stringValue(payload.source, 64)
  const title = stringValue(payload.title, 2_000)
  const detail = stringValue(payload.detail, 100_000)

  if (!occurredAt || !source || !title || !detail) return null

  return {
    payload,
    occurredAt,
    source,
    title,
    detail,
    externalUrl: stringValue(payload.external_url, 2_048),
    eventType: stringValue(payload.event_type, 64) ?? "event",
  }
}

export type CloudpediaServiceLike = {
  list(organizationId: string): Promise<CloudpediaResult>
}

export class CloudpediaService implements CloudpediaServiceLike {
  constructor(private readonly database: SupabaseClient) {}

  async list(organizationId: string): Promise<CloudpediaResult> {
    try {
      const { data, error } = await this.database
        .from(PROJECTION_TABLE)
        .select(
          "id, projection_type, subject_key, source_event_id, payload, updated_at"
        )
        .eq("organization_id", organizationId)
        .in("projection_type", [...PROJECTION_TYPES])
        .order("updated_at", { ascending: false })
        .limit(MAX_PROJECTIONS)

      if (error) {
        throw new CloudpediaServiceError("CLOUDPEDIA_STORAGE_FAILED", 503)
      }

      const updates: CloudpediaUpdate[] = []
      const projects: CloudpediaProject[] = []
      const decisions: CloudpediaDecision[] = []

      for (const value of (data ?? []) as unknown[]) {
        const projection = parseProjection(value)
        if (!projection) continue
        const fields = eventFields(projection)
        if (!fields) continue

        if (projection.projection_type === "update") {
          updates.push({
            id: projection.id,
            source_event_id: projection.source_event_id,
            title: fields.title,
            detail: fields.detail,
            source: fields.source,
            event_type: fields.eventType,
            external_url: fields.externalUrl,
            occurred_at: fields.occurredAt,
          })
          continue
        }

        if (projection.projection_type === "project") {
          const name = stringValue(fields.payload.name, 512)
          const status = projectStatus(fields.payload.status)
          if (!name || !status) continue
          projects.push({
            subject_key: projection.subject_key,
            source_event_id: projection.source_event_id,
            name,
            status,
            occurred_at: fields.occurredAt,
          })
          continue
        }

        decisions.push({
          subject_key: projection.subject_key,
          source_event_id: projection.source_event_id,
          title: fields.title,
          detail: fields.detail,
          project: stringValue(fields.payload.project, 512),
          source: fields.source,
          external_url: fields.externalUrl,
          occurred_at: fields.occurredAt,
        })
      }

      return {
        updates,
        projects,
        decisions,
        generated_at: new Date().toISOString(),
      }
    } catch (error) {
      if (error instanceof CloudpediaServiceError) throw error
      throw new CloudpediaServiceError("CLOUDPEDIA_STORAGE_FAILED", 503)
    }
  }
}
