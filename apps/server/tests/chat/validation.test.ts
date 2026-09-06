import { describe, expect, test } from "bun:test"
import {
  DEFAULT_HOSTED_MODEL,
  parseChatSearchRequest,
  parseCreateChatMessageRequest,
  parseCreateChatRequest,
  RequestValidationError,
} from "../../src/chat/validation"

describe("hosted chat validation", () => {
  test("defaults to the supported open-source model catalog", () => {
    expect(parseCreateChatRequest({})).toEqual({
      model: DEFAULT_HOSTED_MODEL,
    })
    expect(parseCreateChatRequest({ model: "minimax-m2.7" }).model).toBe(
      "minimax-m2.7"
    )
  })

  test("requires high reasoning for Codex chat creation", () => {
    expect(
      parseCreateChatRequest({
        provider: "codex",
        model: "gpt-5.6-terra",
      })
    ).toEqual({
      provider: "codex",
      model: "gpt-5.6-terra",
      reasoning_effort: "high",
    })
    expect(() =>
      parseCreateChatRequest({
        provider: "codex",
        model: "gpt-5.6-terra",
        reasoning_effort: "low",
      })
    ).toThrow(RequestValidationError)
  })

  test("parses a bounded chat search query", () => {
    expect(parseChatSearchRequest({ q: "  hey there  " })).toEqual({
      q: "hey there",
    })
    expect(() => parseChatSearchRequest({ q: "" })).toThrow(
      RequestValidationError
    )
    expect(() => parseChatSearchRequest({ q: ["hey there"] })).toThrow(
      RequestValidationError
    )
    expect(() =>
      parseChatSearchRequest({ q: "hey there", organization_id: "attacker" })
    ).toThrow(RequestValidationError)
  })

  test("rejects provider, organization, and role fields from the browser", () => {
    expect(() =>
      parseCreateChatRequest({
        model: "codex",
        organization_id: "attacker-controlled",
      })
    ).toThrow(RequestValidationError)
    expect(() =>
      parseCreateChatMessageRequest({
        client_message_id: "not-a-uuid",
        content: "What changed?",
        role: "assistant",
      })
    ).toThrow(RequestValidationError)
  })
})
