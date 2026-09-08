import { describe, expect, test } from "bun:test"
import express, { type RequestHandler } from "express"
import {
  createCloudpediaRouter,
  type CloudpediaServiceLike,
} from "../../src/cloudpedia/route"

const auth: RequestHandler = (_req, _res, next) => next()
const organizationContext: RequestHandler = (req, _res, next) => {
  req.organization = {
    id: "organization-from-auth",
    name: "Cloudberry",
    role: "owner",
  }
  next()
}

describe("Cloudpedia routes", () => {
  test("uses the authenticated organization scope", async () => {
    let receivedOrganizationId: string | null = null
    const service: CloudpediaServiceLike = {
      list: async (organizationId) => {
        receivedOrganizationId = organizationId
        return {
          updates: [],
          projects: [],
          decisions: [],
          generated_at: "2026-09-08T12:00:00.000Z",
        }
      },
    }
    const app = express()
    app.use(
      "/cloudpedia",
      createCloudpediaRouter({ service, auth, organizationContext })
    )
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("No test port")
      }

      const response = await fetch(
        `http://127.0.0.1:${address.port}/cloudpedia?organization_id=attacker-controlled`
      )
      const payload = (await response.json()) as {
        success: boolean
        data: { generated_at: string }
      }

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.generated_at).toBe("2026-09-08T12:00:00.000Z")
      expect(String(receivedOrganizationId)).toBe("organization-from-auth")
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })
})
