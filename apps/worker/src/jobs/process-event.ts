import {
  assertCompanyEvent,
  type CompanyEvent,
} from "@cloudberry/contracts"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkerConfig } from "../config"
import { ingestEvent } from "../knowledge-client"

type ClaimedJob = {
  id: string
  company_event_id: string
  attempts: number
}

type NormalizedEventRow = {
  normalized_payload: unknown
}

const asClaimedJob = (value: unknown): ClaimedJob | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const candidate = value[0]
  if (!candidate || typeof candidate !== "object") {
    throw new Error("claim_next_knowledge_job returned an invalid row")
  }

  const row = candidate as Record<string, unknown>
  if (
    typeof row.id !== "string" ||
    typeof row.company_event_id !== "string" ||
    typeof row.attempts !== "number"
  ) {
    throw new Error("claim_next_knowledge_job returned an incomplete row")
  }

  return {
    id: row.id,
    company_event_id: row.company_event_id,
    attempts: row.attempts,
  }
}

export const retryDelayMs = (attempts: number): number =>
  Math.min(15 * 60 * 1000, 5 * 1000 * 2 ** Math.max(attempts - 1, 0))

export const processNextJob = async (
  database: SupabaseClient,
  config: WorkerConfig
): Promise<boolean> => {
  const { data, error } = await database.rpc("claim_next_knowledge_job")
  if (error) {
    throw error
  }

  const job = asClaimedJob(data)
  if (!job) {
    return false
  }

  try {
    const event = await getEvent(database, job.company_event_id)
    await ingestEvent(config, event)
    await markSucceeded(database, job, event)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await markFailedOrRetry(database, job, message, config.maxAttempts)
    console.error(`Knowledge job ${job.id} failed: ${message}`)
  }

  return true
}

const getEvent = async (
  database: SupabaseClient,
  companyEventId: string
): Promise<CompanyEvent> => {
  const { data, error } = await database
    .from("company_events")
    .select("normalized_payload")
    .eq("id", companyEventId)
    .maybeSingle<NormalizedEventRow>()

  if (error) {
    throw error
  }
  if (!data) {
    throw new Error(`Company event ${companyEventId} was not found`)
  }

  return assertCompanyEvent(data.normalized_payload)
}

const markSucceeded = async (
  database: SupabaseClient,
  job: ClaimedJob,
  event: CompanyEvent
) => {
  const processedAt = new Date().toISOString()
  const { error: eventError } = await database
    .from("company_events")
    .update({
      processing_status: "processed",
      processing_attempts: job.attempts,
      last_error: null,
      processed_at: processedAt,
    })
    .eq("id", event.id)

  if (eventError) {
    throw eventError
  }

  const { error: jobError } = await database
    .from("knowledge_jobs")
    .update({
      status: "succeeded",
      locked_at: null,
      last_error: null,
    })
    .eq("id", job.id)

  if (jobError) {
    throw jobError
  }
}

const markFailedOrRetry = async (
  database: SupabaseClient,
  job: ClaimedJob,
  message: string,
  maxAttempts: number
) => {
  const terminal = job.attempts >= maxAttempts
  const nextAttemptAt = new Date(Date.now() + retryDelayMs(job.attempts)).toISOString()
  const status = terminal ? "failed" : "queued"

  const { error: jobError } = await database
    .from("knowledge_jobs")
    .update({
      status,
      locked_at: null,
      next_attempt_at: terminal ? new Date().toISOString() : nextAttemptAt,
      last_error: message.slice(0, 2000),
    })
    .eq("id", job.id)

  if (jobError) {
    throw jobError
  }

  const { error: eventError } = await database
    .from("company_events")
    .update({
      processing_status: terminal ? "failed" : "queued",
      processing_attempts: job.attempts,
      last_error: message.slice(0, 2000),
    })
    .eq("id", job.company_event_id)

  if (eventError) {
    throw eventError
  }
}
