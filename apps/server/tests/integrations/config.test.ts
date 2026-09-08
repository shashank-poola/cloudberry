import { describe, expect, test } from "bun:test"
import { getTriggerDefinitions } from "../../src/integrations/composio/config"

const environmentNames = [
  "COMPOSIO_TRIGGER_DEFINITIONS",
  "COMPOSIO_SLACK_TRIGGER_SLUG",
  "COMPOSIO_LINEAR_TEAM_ID",
  "COMPOSIO_LINEAR_COMMENT_TRIGGER_SLUG",
  "COMPOSIO_LINEAR_ISSUE_CREATED_TRIGGER_SLUG",
  "COMPOSIO_LINEAR_ISSUE_UPDATED_TRIGGER_SLUG",
  "COMPOSIO_GITHUB_OWNER",
  "COMPOSIO_GITHUB_REPO",
]

const withEnvironment = async (
  values: Record<string, string | undefined>,
  callback: () => Promise<void>
) => {
  const previous = new Map<string, string | undefined>()
  for (const name of environmentNames) {
    previous.set(name, process.env[name])
    if (name in values) {
      const value = values[name]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    } else {
      delete process.env[name]
    }
  }

  try {
    await callback()
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

describe("Composio trigger defaults", () => {
  test("configures the documented Slack trigger by default", async () => {
    await withEnvironment({}, async () => {
      const definitions = getTriggerDefinitions()
      expect(definitions.slack).toEqual([
        {
          slug: "SLACK_CHANNEL_MESSAGE_RECEIVED",
          config: { is_bot_message: false },
        },
      ])
      expect(definitions.linear).toEqual([])
    })
  })

  test("configures documented Linear triggers for a supplied team", async () => {
    await withEnvironment(
      { COMPOSIO_LINEAR_TEAM_ID: "team-cloudberry" },
      async () => {
        const definitions = getTriggerDefinitions()
        expect(definitions.linear).toEqual([
          {
            slug: "LINEAR_COMMENT_EVENT_TRIGGER",
            config: { team_id: "team-cloudberry" },
          },
          {
            slug: "LINEAR_ISSUE_CREATED_TRIGGER",
            config: { team_id: "team-cloudberry" },
          },
          {
            slug: "LINEAR_ISSUE_UPDATED_TRIGGER",
            config: { team_id: "team-cloudberry" },
          },
        ])
      }
    )
  })
})
