import { describe, expect, test } from "bun:test"
import express, { type RequestHandler } from "express"
import {
  createIntegrationRouter,
  type IntegrationRouterOptions,
} from "../../src/integrations/route"
import type { IntegrationServiceLike } from "../../src/integrations/service"
import type {
  IntegrationListResult,
  PublicIntegration,
  WebhookResult,
} from "../../src/integrations/types"

const ownerAuth: RequestHandler = (req, _res, next) => {
  req.user = { id: "owner-from-auth" } as never
  next()
}

const ownerOrganization: RequestHandler = (req, _res, next) => {
  req.organization = {
    id: "organization-from-auth",
    name: "Cloudberry",
    role: "owner",
  }
  next()
}

const memberOrganization: RequestHandler = (req, _res, next) => {
  req.organization = {
    id: "organization-from-auth",
    name: "Cloudberry",
    role: "member",
  }
  next()
}

const integration: PublicIntegration = {
  provider: "github",
  name: "GitHub",
  status: "not_connected",
  connected: false,
  trigger_status: "not_configured",
  account_label: null,
  last_event_at: null,
  last_error: null,
  updated_at: null,
}

const createService = (
  overrides: Partial<IntegrationServiceLike> = {}
): IntegrationServiceLike => {
  const list: IntegrationListResult = { integrations: [integration] }
  const webhook: WebhookResult = { kind: "ignored", inserted: false }
  return {
    list: async () => list,
    startConnection: async (organizationId, userId, provider) => {
      expect(organizationId).toBe("organization-from-auth")
      expect(userId).toBe("owner-from-auth")
      if (provider === "codex") {
        return {
          provider,
          auth_method: "device_code",
          attempt_id: "1234567890123456",
          device_url: "https://auth.openai.com/codex/device",
          user_code: "ABCD-EFGH",
          expires_at: "2026-09-06T12:15:00.000Z",
          poll_after_seconds: 5,
        }
      }
      return {
        provider,
        redirect_url: "https://connect.composio.dev/link/test",
      }
    },
    completeConnection: async () => ({
      provider: "github",
      success: true,
      reason: null,
    }),
    getCodexConnectionStatus: async () => ({
      provider: "codex",
      attempt_id: "1234567890123456",
      status: "pending",
      expires_at: "2026-09-06T12:15:00.000Z",
      poll_after_seconds: 5,
      reason: null,
      integration: null,
    }),
    cancelCodexConnection: async () => ({
      provider: "codex",
      attempt_id: "1234567890123456",
      status: "cancelled",
      expires_at: "2026-09-06T12:15:00.000Z",
      poll_after_seconds: 5,
      reason: "CODEX_AUTH_CANCELLED",
      integration: null,
    }),
    retry: async () => integration,
    reconnect: async (_organizationId, _userId, provider) => {
      if (provider === "codex") {
        return {
          provider,
          auth_method: "device_code",
          attempt_id: "1234567890123456",
          device_url: "https://auth.openai.com/codex/device",
          user_code: "ABCD-EFGH",
          expires_at: "2026-09-06T12:15:00.000Z",
          poll_after_seconds: 5,
        }
      }
      return {
        provider,
        redirect_url: "https://connect.composio.dev/link/reconnect",
      }
    },
    disconnect: async () => ({ ...integration, status: "disabled" }),
    handleWebhook: async (body) => {
      expect(Buffer.isBuffer(body)).toBe(true)
      return webhook
    },
    ...overrides,
  }
}

const runServer = async (
  options: IntegrationRouterOptions,
  configure: (port: number) => Promise<void>
) => {
  const app = express()
  app.use(
    "/integrations/webhooks/composio",
    express.raw({ type: "application/json" })
  )
  app.use(express.json())
  app.use("/integrations", createIntegrationRouter(options))
  const server = app.listen(0)

  try {
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("No test port")
    await configure(address.port)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

describe("integration routes", () => {
  test("uses authenticated organization and owner identity", async () => {
    await runServer(
      {
        service: createService(),
        auth: ownerAuth,
        organizationContext: ownerOrganization,
      },
      async (port) => {
        const response = await fetch(
          `http://127.0.0.1:${port}/integrations/github/connect`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-organization-id": "attacker-controlled",
            },
          }
        )
        const payload = (await response.json()) as {
          success: boolean
          data: { provider: string; redirect_url: string }
        }

        expect(response.status).toBe(200)
        expect(payload.success).toBe(true)
        expect(payload.data.provider).toBe("github")
        expect(payload.data.redirect_url).toStartWith(
          "https://connect.composio.dev/"
        )
      }
    )
  })

  test("rejects integration mutations from members", async () => {
    await runServer(
      {
        service: createService(),
        auth: ownerAuth,
        organizationContext: memberOrganization,
      },
      async (port) => {
        const response = await fetch(
          `http://127.0.0.1:${port}/integrations/github/connect`,
          { method: "POST" }
        )
        expect(response.status).toBe(403)
        expect(await response.json()).toMatchObject({
          success: false,
          error: "INTEGRATION_OWNER_REQUIRED",
        })
      }
    )
  })

  test("keeps the webhook body raw for the service", async () => {
    await runServer(
      {
        service: createService(),
      },
      async (port) => {
        const response = await fetch(
          `http://127.0.0.1:${port}/integrations/webhooks/composio`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hello: "world" }),
          }
        )
        expect(response.status).toBe(200)
      }
    )
  })
})
