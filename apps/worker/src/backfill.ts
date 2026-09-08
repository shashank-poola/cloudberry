import { getDatabaseConfig } from "./config"
import { createWorkerDatabase } from "./database"
import { backfillProjections } from "./jobs/project-event"

const run = async () => {
  const database = createWorkerDatabase(getDatabaseConfig())
  const count = await backfillProjections(database)
  console.log(`Wrote ${count} Cloudpedia projections`)
}

if (import.meta.main) {
  void run().catch((error) => {
    console.error("Cloudpedia projection backfill failed", error)
    process.exitCode = 1
  })
}
