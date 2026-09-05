import type { CompanyEvent } from "@cloudberry/contracts"
import type { WorkerConfig } from "./config"

export const ingestEvent = async (
  config: WorkerConfig,
  event: CompanyEvent
): Promise<void> => {
  const response = await fetch(`${config.knowledgeServiceUrl}/internal/v1/episodes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.knowledgeServiceToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(60_000),
  })

  if (response.ok) {
    return
  }

  const message = (await response.text()).slice(0, 1000)
  throw new Error(
    `Knowledge service returned ${response.status}: ${message || response.statusText}`
  )
}
