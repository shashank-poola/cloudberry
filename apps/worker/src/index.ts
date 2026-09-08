import { getWorkerConfig } from "./config"
import { createWorkerDatabase } from "./database"
import { backfillProjections } from "./jobs/project-event"
import { processNextJob } from "./jobs/process-event"

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

const run = async () => {
  const config = getWorkerConfig()
  const database = createWorkerDatabase(config)
  let running = true

  const stop = () => {
    running = false
  }

  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)

  console.log("Knowledge worker started")

  try {
    const projectionCount = await backfillProjections(database)
    if (projectionCount > 0) {
      console.log(`Backfilled ${projectionCount} Cloudpedia projections`)
    }
  } catch (error) {
    console.error("Cloudpedia projection backfill failed", error)
  }

  while (running) {
    try {
      const processed = await processNextJob(database, config)
      if (!processed) {
        await sleep(config.pollIntervalMs)
      }
    } catch (error) {
      console.error("Knowledge worker loop failed", error)
      await sleep(config.pollIntervalMs)
    }
  }

  console.log("Knowledge worker stopped")
}

if (import.meta.main) {
  void run().catch((error) => {
    console.error("Knowledge worker failed to start", error)
    process.exitCode = 1
  })
}
