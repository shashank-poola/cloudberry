import { describe, expect, test } from "bun:test"
import express, { type RequestHandler } from "express"
import { createChatRouter, type ChatServiceLike } from "../../src/chat/route"

const auth: RequestHandler = (req, _res, next) => {
  req.user = { id: "user-from-auth" } as never
  next()
}

const organizationContext: RequestHandler = (req, _res, next) => {
  req.organization = {
    id: "organization-from-auth",
    name: "Cloudberry",
    role: "owner",
  }
  next()
}

const chat = {
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: "organization-from-auth",
  created_by: "user-from-auth",
  title: "New chat",
  provider: "hosted" as const,
  model: "gpt-oss-120b" as const,
  status: "active" as const,
  last_message_at: null,
  created_at: null,
  updated_at: null,
}

describe("chat routes", () => {
  test("derives organization and user identity from middleware", async () => {
    let receivedOrganizationId: string | null = null
    let receivedUserId: string | null = null
    const service = {
      createChat: async (organizationId: string, userId: string) => {
        receivedOrganizationId = organizationId
        receivedUserId = userId
        return { chat }
      },
      getChat: async () => ({ chat, messages: [] }),
      createMessage: async () => {
        throw new Error("not used")
      },
    } as ChatServiceLike
    const app = express()
    app.use(express.json())
    app.use("/chats", createChatRouter({ service, auth, organizationContext }))
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("No test port")

      const response = await fetch(`http://127.0.0.1:${address.port}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-oss-120b",
          organization_id: "attacker-controlled",
          created_by: "attacker-controlled",
        }),
      })

      expect(response.status).toBe(400)
      expect(receivedOrganizationId).toBeNull()
      expect(receivedUserId).toBeNull()

      const validResponse = await fetch(
        `http://127.0.0.1:${address.port}/chats`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-oss-120b" }),
        }
      )
      expect(validResponse.status).toBe(201)
      expect(receivedOrganizationId as string | null).toBe(
        "organization-from-auth"
      )
      expect(receivedUserId as string | null).toBe("user-from-auth")
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })
})
