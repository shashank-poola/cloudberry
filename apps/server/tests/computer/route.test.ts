import { describe, expect, test } from "bun:test"
import express, { type RequestHandler } from "express"
import {
  createComputerRouter,
  type ComputerServiceLike,
} from "../../src/computer/route"

const auth: RequestHandler = (_req, _res, next) => next()
const organizationContext: RequestHandler = (req, _res, next) => {
  req.organization = {
    id: "organization-from-auth",
    name: "Cloudberry",
    role: "owner",
  }
  next()
}

describe("computer routes", () => {
  test("uses organization context instead of client-provided scope", async () => {
    let receivedOrganizationId: string | null = null
    const service: ComputerServiceLike = {
      getStatus: async (organizationId) => {
        receivedOrganizationId = organizationId
        return { computer: null, box: null }
      },
      provisionOrWake: async (organizationId) => {
        receivedOrganizationId = organizationId
        throw new Error("not used")
      },
    }
    const app = express()
    app.use(
      "/computer",
      createComputerRouter({ service, auth, organizationContext })
    )
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === "string")
        throw new Error("No test port")

      const response = await fetch(
        `http://127.0.0.1:${address.port}/computer`,
        {
          headers: { "x-organization-id": "attacker-controlled" },
        }
      )
      const payload = (await response.json()) as {
        success: boolean
        data: unknown
      }

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(String(receivedOrganizationId)).toBe("organization-from-auth")

      const codexResponse = await fetch(
        `http://127.0.0.1:${address.port}/computer/codex/sessions`,
        { method: "POST" }
      )
      expect(codexResponse.status).toBe(404)
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })
})
