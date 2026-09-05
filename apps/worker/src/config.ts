import "dotenv/config"

export type DatabaseConfig = {
  supabaseUrl: string
  serviceRoleKey: string
}

export type WorkerConfig = DatabaseConfig & {
  knowledgeServiceUrl: string
  knowledgeServiceToken: string
  pollIntervalMs: number
  maxAttempts: number
}

const required = (name: string) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set`)
  }
  return value
}

const requiredOneOf = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]
    if (value) {
      return value
    }
  }

  throw new Error(`${names.join(" or ")} must be set`)
}

const positiveInteger = (name: string, fallback: number) => {
  const value = process.env[name]
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsed
}

export const getDatabaseConfig = (): DatabaseConfig => ({
  supabaseUrl: required("SUPABASE_URL"),
  serviceRoleKey: requiredOneOf(
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ),
})

export const getWorkerConfig = (): WorkerConfig => ({
  ...getDatabaseConfig(),
  knowledgeServiceUrl: required("KNOWLEDGE_SERVICE_URL").replace(/\/$/, ""),
  knowledgeServiceToken: required("KNOWLEDGE_SERVICE_TOKEN"),
  pollIntervalMs: positiveInteger("WORKER_POLL_INTERVAL_MS", 1000),
  maxAttempts: positiveInteger("WORKER_MAX_ATTEMPTS", 5),
})
