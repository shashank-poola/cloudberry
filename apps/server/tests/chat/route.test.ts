import { describe, expect, test } from "bun:test"
import express, { type RequestHandler } from "express"
import { GeneralComputeClientError } from "../../src/models/llm/client"
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

const searchResult = {
  chat_id: "11111111-1111-4111-8111-111111111111",
  title: "Hey there",
  status: "active" as const,
  message_id: null,
  match_type: "title" as const,
  snippet: "Hey there",
  last_message_at: null,
}

const chat = {
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: "organization-from-auth",
  created_by: "user-from-auth",
  title: "New chat",
  provider: "hosted" as const,
  model: "gpt-oss-120b" as const,
  reasoning_effort: null,
  status: "active" as const,
  last_message_at: null,
  created_at: null,
  updated_at: null,
}

describe("chat routes", () => {
  test("derives organization and user identity from middleware", async () => {
    let receivedOrganizationId: string | null = null
    let receivedUserId: string | null = null
    const receivedSearch: {
      current: { organizationId: string; query: string } | null
    } = { current: null }
    const service = {
      createChat: async (organizationId: string, userId: string) => {
        receivedOrganizationId = organizationId
        receivedUserId = userId
        return { chat }
      },
      listChats: async () => ({ chats: [chat] }),
      searchChats: async (organizationId: string, query: string) => {
        receivedSearch.current = { organizationId, query }
        return { results: [searchResult] }
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
      if (!address || typeof address === "string")
        throw new Error("No test port")

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

      const listResponse = await fetch(`http://127.0.0.1:${address.port}/chats`)
      expect(listResponse.status).toBe(200)
      expect(await listResponse.json()).toEqual({
        success: true,
        data: { chats: [chat] },
        error: null,
      })

      const searchResponse = await fetch(
        `http://127.0.0.1:${address.port}/chats/search?q=hey%20there`
      )
      expect(searchResponse.status).toBe(200)
      expect(await searchResponse.json()).toEqual({
        success: true,
        data: { results: [searchResult] },
        error: null,
      })
      expect(receivedSearch.current).toEqual({
        organizationId: "organization-from-auth",
        query: "hey there",
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })

  test("maps provider configuration failures to a useful chat error", async () => {
    const service = {
      createChat: async () => ({ chat }),
      listChats: async () => ({ chats: [chat] }),
      searchChats: async () => ({ results: [] }),
      getChat: async () => {
        throw new GeneralComputeClientError(
          "GENERALCOMPUTE_NOT_CONFIGURED",
          null,
          "configuration"
        )
      },
      createMessage: async () => ({
        chat,
        user_message: {} as never,
        assistant_message: {} as never,
      }),
    } as ChatServiceLike
    const app = express()
    app.use(express.json())
    app.use("/chats", createChatRouter({ service, auth, organizationContext }))
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === "string")
        throw new Error("No test port")
      const response = await fetch(
        `http://127.0.0.1:${address.port}/chats/${chat.id}`
      )

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        success: false,
        data: null,
        error: "HOSTED_CHAT_NOT_CONFIGURED",
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  })
})
