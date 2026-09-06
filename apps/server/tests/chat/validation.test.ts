import { describe, expect, test } from "bun:test"
import {
  DEFAULT_HOSTED_MODEL,
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
