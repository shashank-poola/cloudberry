import { describe, expect, test } from "bun:test"
import { PrizedClient, type PrizedClientOptions } from "../../src/prized/client"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("PrizedClient", () => {
  test("parses control-plane computer responses", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []
    const fetchImpl = (async (
      input: Parameters<NonNullable<PrizedClientOptions["fetchImpl"]>>[0],
      init?: Parameters<NonNullable<PrizedClientOptions["fetchImpl"]>>[1]
    ) => {
      const url = String(input)
      calls.push({ url, init })

      if (url.endsWith("/me")) {
        return jsonResponse({ edge: { url: "https://edge.prized.test" } })
      }
      if (url.endsWith("/boxes")) {
        return jsonResponse(
          { box: { id: "box-1", observedState: "running" } },
          202
        )
      }
      if (url.endsWith("/boxes/box-1/wake")) {
        return jsonResponse({ box: { id: "box-1", observedState: "running" } })
      }
      if (url.endsWith("/boxes/box-1")) {
        return jsonResponse({ box: { id: "box-1", observedState: "paused" } })
      }

      throw new Error(`Unexpected URL: ${url}`)
    }) as unknown as NonNullable<PrizedClientOptions["fetchImpl"]>

    const client = new PrizedClient({
      baseUrl: "https://api.prized.test/api/v1",
      token: "server-token",
      fetchImpl,
    })
    const me = await client.getMe()
    const created = await client.createBox({ name: "cloudberry-test" })
    const fetched = await client.getBox(created.box.id)
    const woken = await client.wakeBox(fetched.box.id)

    expect(me.edge.url).toBe("https://edge.prized.test")
    expect(created.box.id).toBe("box-1")
    expect(fetched.box.observedState).toBe("paused")
    expect(woken.box.observedState).toBe("running")
    expect(
      calls.every(
        ({ init }) => init?.headers instanceof Headers || init?.headers
      )
    ).toBe(true)
    const firstHeaders = calls[0]?.init?.headers as Record<string, string>
    expect(firstHeaders.Authorization).toBe("Bearer server-token")
  })

  test("maps authentication failures without exposing the response body", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ secret: "must-not-leak" }, 401)) as unknown as NonNullable<
      PrizedClientOptions["fetchImpl"]
    >
    const client = new PrizedClient({
      baseUrl: "https://api.prized.test/api/v1",
      token: "bad-token",
      fetchImpl,
    })

    await expect(client.getMe()).rejects.toMatchObject({
      status: 401,
      kind: "configuration",
      code: "PRIZED_REQUEST_FAILED",
    })
    await expect(client.getMe()).rejects.not.toThrow("must-not-leak")
  })
})
