import { describe, expect, test } from "bun:test"
import {
  GeneralComputeClient,
  type GeneralComputeClientOptions,
} from "../../src/models/llm/client"
import {
  HOSTED_MODEL_IDS,
  getHostedModel,
  parseHostedModelId,
} from "../../src/models/llm/catalog"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

describe("hosted model catalog", () => {
  test("exports and validates only the supported General Compute model IDs", () => {
    expect(HOSTED_MODEL_IDS).toEqual(["gpt-oss-120b", "minimax-m2.7"])
    expect(parseHostedModelId("gpt-oss-120b")).toBe("gpt-oss-120b")
    expect(getHostedModel("minimax-m2.7")).toEqual({ id: "minimax-m2.7" })
    expect(getHostedModel("gpt-4.1")).toBeNull()
    expect(() => parseHostedModelId("gpt-4.1")).toThrow(
      "UNSUPPORTED_HOSTED_MODEL"
    )
  })
})

describe("GeneralComputeClient", () => {
  test("posts a bounded OpenAI-compatible completion request", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []
    const fetchImpl = (async (
      input: Parameters<NonNullable<GeneralComputeClientOptions["fetchImpl"]>>[0],
      init?: Parameters<
        NonNullable<GeneralComputeClientOptions["fetchImpl"]>
      >[1]
    ) => {
      calls.push({ url: String(input), init })
      return jsonResponse({
        id: "chatcmpl-1",
        model: "gpt-oss-120b",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 3,
          completion_tokens: 1,
          total_tokens: 4,
        },
      })
    }) as unknown as NonNullable<GeneralComputeClientOptions["fetchImpl"]>
    const client = new GeneralComputeClient({
      baseUrl: "https://api.generalcompute.test/v1",
      apiKey: "server-secret",
      fetchImpl,
    })

    const completion = await client.createChatCompletion({
      model: "gpt-oss-120b",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0.2,
      maxTokens: 64,
    })

    expect(completion).toEqual({
      id: "chatcmpl-1",
      model: "gpt-oss-120b",
      content: "Hello",
      finishReason: "stop",
      usage: { promptTokens: 3, completionTokens: 1, totalTokens: 4 },
    })
    expect(calls[0]?.url).toBe(
      "https://api.generalcompute.test/v1/chat/completions"
    )
    expect(calls[0]?.init?.method).toBe("POST")
    expect(calls[0]?.init?.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer server-secret",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      model: "gpt-oss-120b",
      messages: [{ role: "user", content: "Hello" }],
      stream: false,
      temperature: 0.2,
      max_tokens: 64,
    })
  })

  test("does not expose provider response bodies in errors", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ error: { message: "api key server-secret is invalid" } }, 401)) as unknown as NonNullable<
      GeneralComputeClientOptions["fetchImpl"]
    >
    const client = new GeneralComputeClient({
      apiKey: "server-secret",
      fetchImpl,
    })

    const request = {
      model: "minimax-m2.7" as const,
      messages: [{ role: "user" as const, content: "Hello" }],
    }

    await expect(client.createChatCompletion(request)).rejects.toMatchObject({
      code: "GENERALCOMPUTE_REQUEST_FAILED",
      status: 401,
      kind: "configuration",
    })
    await expect(client.createChatCompletion(request)).rejects.not.toThrow(
      "server-secret"
    )
  })

  test("categorizes requests that exceed the configured timeout", async () => {
    const fetchImpl = (async () => new Promise<Response>(() => {})) as unknown as NonNullable<
      GeneralComputeClientOptions["fetchImpl"]
    >
    const client = new GeneralComputeClient({
      apiKey: "server-secret",
      fetchImpl,
      timeoutMs: 1,
    })

    await expect(
      client.createChatCompletion({
        model: "gpt-oss-120b",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toMatchObject({
      code: "GENERALCOMPUTE_TIMEOUT",
      status: null,
      kind: "timeout",
    })
  })

  test("rejects malformed provider output and unsupported request models", async () => {
    let fetchCalls = 0
    const fetchImpl = (async () => {
      fetchCalls += 1
      return jsonResponse({
        id: "chatcmpl-1",
        model: "gpt-oss-120b",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "\u0000" },
            finish_reason: "stop",
          },
        ],
      })
    }) as unknown as NonNullable<GeneralComputeClientOptions["fetchImpl"]>
    const client = new GeneralComputeClient({
      apiKey: "server-secret",
      fetchImpl,
    })

    await expect(
      client.createChatCompletion({
        model: "gpt-4.1" as never,
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toMatchObject({
      code: "GENERALCOMPUTE_INVALID_REQUEST",
      kind: "validation",
    })
    expect(fetchCalls).toBe(0)

    await expect(
      client.createChatCompletion({
        model: "gpt-oss-120b",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toMatchObject({
      code: "GENERALCOMPUTE_INVALID_RESPONSE",
      kind: "invalid_response",
    })
  })
})
