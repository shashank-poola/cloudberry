import { describe, expect, test } from "bun:test"
import { PrizedClient, type PrizedClientOptions } from "../../src/prized/client"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("PrizedClient", () => {
  test("parses the control-plane and edge prompt responses", async () => {
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
      if (url.includes("/prompts") && url.includes("/events")) {
        return jsonResponse({
          events: [
            {
              seq: 1,
              at: "2026-09-06T00:00:00Z",
              type: "assistant_message",
              text: "Ready",
            },
          ],
          next: 2,
          finished: true,
          run: { id: "run-1", status: "succeeded" },
        })
      }
      if (url.endsWith("/prompts")) {
        return jsonResponse({ run: { id: "run-1", status: "running" } }, 202)
      }

      throw new Error(`Unexpected URL: ${url}`)
    }) as unknown as NonNullable<PrizedClientOptions["fetchImpl"]>

    const client = new PrizedClient({
      baseUrl: "https://api.prized.test/api/v1",
      token: "server-token",
      fetchImpl,
    })
    const me = await client.getMe()
    const box = await client.createBox({ name: "cloudberry-test" })
    const started = await client.postCodexPrompt(me.edge.url, box.box.id, {
      prompt: "Use the company context.",
      queue: true,
    })
    const events = await client.getPromptEvents(
      me.edge.url,
      box.box.id,
      started.run?.id ?? "run-1",
      0
    )

    expect(box.box.id).toBe("box-1")
    expect(started.run?.id).toBe("run-1")
    expect(events.finished).toBe(true)
    expect(events.events[0]?.seq).toBe(1)
    expect(
      calls.every(
        ({ init }) => init?.headers instanceof Headers || init?.headers
      )
    ).toBe(true)
    const firstHeaders = calls[0]?.init?.headers as Record<string, string>
    expect(firstHeaders.Authorization).toBe("Bearer server-token")
  })

  test("maps provider authentication failures without exposing the response body", async () => {
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
