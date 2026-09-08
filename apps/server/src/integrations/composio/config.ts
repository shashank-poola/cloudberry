import { z } from "zod"
import {
  INTEGRATION_PROVIDER_LABELS,
  SUPPORTED_INTEGRATION_PROVIDERS,
  type IntegrationProvider,
} from "../types"

export type TriggerDefinition = {
  slug: string
  config: Record<string, unknown>
}

export class IntegrationConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IntegrationConfigurationError"
  }
}

const triggerDefinitionSchema = z
  .object({
    slug: z.string().trim().min(1).max(256),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()

const triggerDefinitionsSchema = z.record(
  z.string(),
  z.array(triggerDefinitionSchema)
)

const providerSet = new Set<string>(SUPPORTED_INTEGRATION_PROVIDERS)

const requiredEnvironment = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new IntegrationConfigurationError(`${name} must be set`)
  }
  return value
}

const validHttpUrl = (value: string, name: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new IntegrationConfigurationError(`${name} must be a valid URL`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new IntegrationConfigurationError(`${name} must use http or https`)
  }

  return url
}

export const getComposioApiKey = () => requiredEnvironment("COMPOSIO_API_KEY")

export const getApplicationUrl = () => {
  const value = process.env.APP_URL?.trim() || "http://localhost:3000"
  return validHttpUrl(value, "APP_URL").toString().replace(/\/$/, "")
}

export const getComposioCallbackUrl = (state: string) => {
  const value = requiredEnvironment("COMPOSIO_CALLBACK_URL")
  const url = validHttpUrl(value, "COMPOSIO_CALLBACK_URL")
  url.searchParams.set("state", state)
  return url.toString()
}

export const getComposioWebhookUrl = () => {
  const configured = process.env.COMPOSIO_WEBHOOK_URL?.trim()
  if (configured) {
    return validHttpUrl(configured, "COMPOSIO_WEBHOOK_URL").toString()
  }

  const apiUrl = process.env.PUBLIC_API_URL?.trim() || "http://localhost:8000"
  const base = validHttpUrl(apiUrl, "PUBLIC_API_URL")
  return new URL("/api/v1/integrations/webhooks/composio", base).toString()
}

export const getComposioWebhookSecret = () =>
  requiredEnvironment("COMPOSIO_WEBHOOK_SECRET")

const emptyDefinitions = (): Record<
  IntegrationProvider,
  TriggerDefinition[]
> => ({
  codex: [],
  github: [],
  slack: [],
  linear: [],
})

export const getTriggerDefinitions = (): Record<
  IntegrationProvider,
  TriggerDefinition[]
> => {
  const raw = process.env.COMPOSIO_TRIGGER_DEFINITIONS?.trim()

  if (raw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new IntegrationConfigurationError(
        "COMPOSIO_TRIGGER_DEFINITIONS must be valid JSON"
      )
    }

    const result = triggerDefinitionsSchema.safeParse(parsed)
    if (!result.success) {
      throw new IntegrationConfigurationError(
        "COMPOSIO_TRIGGER_DEFINITIONS has an invalid shape"
      )
    }

    const definitions = emptyDefinitions()
    for (const [provider, providerDefinitions] of Object.entries(result.data)) {
      if (!providerSet.has(provider)) {
        throw new IntegrationConfigurationError(
          `Unsupported integration provider in COMPOSIO_TRIGGER_DEFINITIONS: ${provider}`
        )
      }

      definitions[provider as IntegrationProvider] = providerDefinitions
    }

    return definitions
  }

  const definitions = emptyDefinitions()

  // Receive human messages only. This avoids re-ingesting future Cloudberry
  // replies as new conversation turns.
  definitions.slack = [
    {
      slug:
        process.env.COMPOSIO_SLACK_TRIGGER_SLUG?.trim() ||
        "SLACK_CHANNEL_MESSAGE_RECEIVED",
      config: { is_bot_message: false },
    },
  ]

  // Linear triggers are scoped to a team. Keep them opt-in until the deployment
  // supplies a real team ID, while avoiding a large JSON blob for the common
  // single-team setup.
  const linearTeamId = process.env.COMPOSIO_LINEAR_TEAM_ID?.trim()
  if (linearTeamId) {
    definitions.linear = [
      {
        slug:
          process.env.COMPOSIO_LINEAR_COMMENT_TRIGGER_SLUG?.trim() ||
          "LINEAR_COMMENT_EVENT_TRIGGER",
        config: { team_id: linearTeamId },
      },
      {
        slug:
          process.env.COMPOSIO_LINEAR_ISSUE_CREATED_TRIGGER_SLUG?.trim() ||
          "LINEAR_ISSUE_CREATED_TRIGGER",
        config: { team_id: linearTeamId },
      },
      {
        slug:
          process.env.COMPOSIO_LINEAR_ISSUE_UPDATED_TRIGGER_SLUG?.trim() ||
          "LINEAR_ISSUE_UPDATED_TRIGGER",
        config: { team_id: linearTeamId },
      },
    ]
  }

  // GITHUB_COMMIT_EVENT is the documented Composio example. It remains
  // opt-in because repository scope is always deployment-specific.
  const owner = process.env.COMPOSIO_GITHUB_OWNER?.trim()
  const repo = process.env.COMPOSIO_GITHUB_REPO?.trim()
  if (owner && repo) {
    definitions.github = [
      {
        slug:
          process.env.COMPOSIO_GITHUB_TRIGGER_SLUG?.trim() ||
          "GITHUB_COMMIT_EVENT",
        config: { owner, repo },
      },
    ]
  }

  return definitions
}

export const getTriggerDefinitionsFor = (provider: IntegrationProvider) =>
  getTriggerDefinitions()[provider]

export const getComposioAuthConfigsFor = (
  provider: IntegrationProvider
): Record<string, string> | undefined => {
  if (provider !== "linear") return undefined

  const authConfigId = process.env.COMPOSIO_LINEAR_AUTH_CONFIG_ID?.trim()
  return authConfigId ? { linear: authConfigId } : undefined
}

export const providerName = (provider: IntegrationProvider) =>
  INTEGRATION_PROVIDER_LABELS[provider]
