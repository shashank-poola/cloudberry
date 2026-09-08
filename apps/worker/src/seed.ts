import "dotenv/config"
import { createHash } from "node:crypto"
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
  "../../../knowledge_base/tests/fixtures"
)

const getSeedOrganizationId = () => {
  const value = process.env.SEED_ORGANIZATION_ID?.trim()
  if (!value) {
    throw new Error(
      "SEED_ORGANIZATION_ID must be set to the signed-in workspace organization UUID"
    )
  }
  return value
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

const deterministicEventId = (organizationId: string, eventId: string) => {
  const digest = createHash("sha256")
    .update(`cloudberry:seed:${organizationId}:${eventId}`)
    .digest("hex")

  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

const replaceReferences = (
  value: unknown,
  eventIds: ReadonlyMap<string, string>
): unknown => {
  if (typeof value === "string") {
    return [...eventIds.entries()].reduce(
      (result, [sourceId, targetId]) => result.replaceAll(sourceId, targetId),
      value
    )
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceReferences(entry, eventIds))
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceReferences(entry, eventIds),
      ])
    )
  }
  return value
}

/**
 * Scope fixtures to one workspace before they are persisted or sent to the
 * knowledge service. IDs are target-specific so a fixture run cannot collide
 * with an earlier run for the fixture organization.
 */
export const scopeSeedEvents = (
  events: readonly CompanyEvent[],
  organizationId: string
): CompanyEvent[] => {
  const eventIds = new Map(
    events.map((event) => [
      event.id,
      organizationId === event.organization_id
        ? event.id
        : deterministicEventId(organizationId, event.id),
    ])
  )

  return events.map((event) => {
    const scoped = replaceReferences(
      {
        ...event,
        id: eventIds.get(event.id),
        organization_id: organizationId,
      },
      eventIds
    )

    return assertCompanyEvent(scoped)
  })
}

const seed = async () => {
  const database = createWorkerDatabase(getDatabaseConfig())
  const events = scopeSeedEvents(await readFixtures(), getSeedOrganizationId())

  const rows = events.map((event) => ({
    id: event.id,
    organization_id: event.organization_id,
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
    `Seeded ${data?.length ?? 0} new company events for ${events[0]?.organization_id}`
  )
}

if (import.meta.main) {
  void seed().catch((error) => {
    console.error("Knowledge seed failed", error)
    process.exitCode = 1
  })
}
