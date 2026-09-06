import { describe, expect, test } from "bun:test"
import {
  CodexAuthClient,
  CodexAuthClientError,
  type CodexAuthClientOptions,
  type FetchLike,
} from "../../src/integrations/codex"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const idToken = (claims: Record<string, unknown>) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`

type TestFetch = (
  input: Parameters<FetchLike>[0],
  init?: Parameters<FetchLike>[1]
) => Promise<Response>

const clientOptions = (
  fetchImpl: TestFetch,
  timeoutMs?: number
): CodexAuthClientOptions => ({
  baseUrl: "https://auth.openai.test",
  clientId: "client-test",
  fetchImpl: fetchImpl as unknown as FetchLike,
  ...(timeoutMs === undefined ? {} : { timeoutMs }),
})

describe("CodexAuthClient", () => {
  test("parses the device-code response and builds the OpenAI verification URL", async () => {
    const fetchImpl: TestFetch = async (input, init) => {
      expect(String(input)).toBe(
        "https://auth.openai.test/api/accounts/deviceauth/usercode"
      )
      expect(init?.method).toBe("POST")
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        "Content-Type": "application/json",
      })
      expect(JSON.parse(String(init?.body))).toEqual({
        client_id: "client-test",
      })
      return jsonResponse({
        device_auth_id: "device-1",
        user_code: "ABCD-EFGH",
        interval: 7,
      })
    }

    const client = new CodexAuthClient(clientOptions(fetchImpl))
    await expect(client.requestDeviceCode()).resolves.toEqual({
      device_auth_id: "device-1",
      user_code: "ABCD-EFGH",
      interval_seconds: 7,
      verification_url: "https://auth.openai.test/codex/device",
    })
  })

  test("treats pending 403 and 404 device polls as pending", async () => {
    const statuses = [403, 404]
    const fetchImpl: TestFetch = async () => {
      const status = statuses.shift()
      if (!status) throw new Error("Unexpected extra poll")
      return new Response(null, { status })
    }
    const client = new CodexAuthClient(clientOptions(fetchImpl))

    await expect(
      client.pollDeviceCode("device-1", "ABCD-EFGH")
    ).resolves.toEqual({ status: "pending" })
    await expect(
      client.pollDeviceCode("device-1", "ABCD-EFGH")
    ).resolves.toEqual({ status: "pending" })
  })

  test("exchanges an authorization response and extracts safe account identity", async () => {
    const calls: Array<{ input: string; init: RequestInit | undefined }> = []
    const fetchImpl: TestFetch = async (input, init) => {
      calls.push({ input: String(input), init })
      if (calls.length === 1) {
        return jsonResponse({
          authorization_code: "authorization-code",
          code_challenge: "challenge",
          code_verifier: "verifier",
        })
      }

      return jsonResponse({
        access_token: "access-token-must-not-be-returned",
        refresh_token: "refresh-token-must-not-be-returned",
        id_token: idToken({
          sub: "subject-1",
          email: "owner@example.com",
          "https://api.openai.com/auth": {
            chatgpt_account_id: "account-1",
            chatgpt_plan_type: "pro",
          },
        }),
      })
    }

    const client = new CodexAuthClient(clientOptions(fetchImpl))
    const polled = await client.pollDeviceCode("device-1", "ABCD-EFGH")
    if (polled.status !== "authorized")
      throw new Error("Expected authorization")

    await expect(
      client.completeDeviceCode(polled.authorization)
    ).resolves.toEqual({
      account_id: "account-1",
      email: "owner@example.com",
      plan_type: "pro",
    })
    expect(calls[1]?.input).toBe("https://auth.openai.test/oauth/token")

    const form = new URLSearchParams(String(calls[1]?.init?.body))
    expect(form.get("grant_type")).toBe("authorization_code")
    expect(form.get("code")).toBe("authorization-code")
    expect(form.get("code_verifier")).toBe("verifier")
    expect(form.get("client_id")).toBe("client-test")
    expect(form.get("redirect_uri")).toBe(
      "https://auth.openai.test/deviceauth/callback"
    )
  })

  test("rejects malformed device and token responses", async () => {
    const malformedDevice = new CodexAuthClient(
      clientOptions(async () => jsonResponse({ user_code: "ABCD-EFGH" }))
    )
    await expect(malformedDevice.requestDeviceCode()).rejects.toMatchObject({
      code: "CODEX_AUTH_INVALID_RESPONSE",
      kind: "invalid_response",
    })

    const malformedToken = new CodexAuthClient(
      clientOptions(async () =>
        jsonResponse({
          id_token: "not-a-jwt",
        })
      )
    )
    await expect(
      malformedToken.completeDeviceCode({
        authorization_code: "authorization-code",
        code_challenge: "challenge",
        code_verifier: "verifier",
      })
    ).rejects.toBeInstanceOf(CodexAuthClientError)
  })

  test("classifies an aborted request as a timeout", async () => {
    const fetchImpl: TestFetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true }
        )
      })
    const client = new CodexAuthClient(clientOptions(fetchImpl, 5))

    await expect(client.requestDeviceCode()).rejects.toMatchObject({
      code: "CODEX_AUTH_TIMEOUT",
      kind: "timeout",
    })
  })
})
