import "dotenv/config"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { assertCompanyEvent, type CompanyEvent } from "@cloudberry/contracts"
import { getDatabaseConfig } from "./config"
import { createWorkerDatabase } from "./database"

const fixtureNames = [
  "slack-decision.json",
  "linear-task.json",
  "github-pull-request.json",
  "auth-provider-change.json",
]

const fixtureDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../services/knowledge/tests/fixtures"
)

const getSeedOrganizationId = () => {
  const value = process.env.SEED_ORGANIZATION_ID?.trim()
  return value || null
}

const readFixtures = async (): Promise<CompanyEvent[]> => {
  const values = await Promise.all(
    fixtureNames.map(async (fixtureName) => {
      const value = await Bun.file(
        resolve(fixtureDirectory, fixtureName)
      ).json()
      return assertCompanyEvent(value)
    })
  )

  return values
}

const seed = async () => {
  const database = createWorkerDatabase(getDatabaseConfig())
  const events = await readFixtures()
  const organizationId = getSeedOrganizationId()

  const rows = events.map((event) => ({
    id: event.id,
    organization_id: organizationId ?? event.organization_id,
    source: event.source,
    external_event_id: event.external_event_id,
    external_url: event.external_url,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    received_at: event.received_at,
    actor: event.actor,
    title: event.title,
    content: event.content,
    metadata: event.metadata,
    raw_payload: event.raw_payload,
    normalized_payload: event,
  }))

  const { data, error } = await database
    .from("company_events")
    .upsert(rows, {
      onConflict: "organization_id,source,external_event_id",
      ignoreDuplicates: true,
    })
    .select("id")

  if (error) {
    throw error
  }

  console.log(
    `Seeded ${data?.length ?? 0} new company events for ${
      organizationId ?? events[0]?.organization_id ?? "the fixture organization"
    }`
  )
}

if (import.meta.main) {
  void seed().catch((error) => {
    console.error("Knowledge seed failed", error)
    process.exitCode = 1
  })
}
