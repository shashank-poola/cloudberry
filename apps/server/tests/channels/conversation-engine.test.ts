import { describe, expect, test } from "bun:test"
import type { CompanyEvent } from "@cloudberry/contracts"
import { ConversationEngine } from "../../src/channels"

const event = (overrides: Partial<CompanyEvent> = {}): CompanyEvent => ({
  id: "event-123",
  organization_id: "org-123",
  source: "slack",
  external_event_id: "external-event-123",
  external_url: null,
  event_type: "slack_channel_message_received",
  occurred_at: "2026-09-08T10:00:00.000Z",
  received_at: "2026-09-08T10:01:00.000Z",
  actor: null,
  title: null,
  content: "Hello from Slack",
  metadata: {},
  raw_payload: {},
  ...overrides,
})

describe("ConversationEngine", () => {
  const engine = new ConversationEngine()

  test("accepts a Slack channel message", () => {
    const result = engine.route(event(), {
      channel: "C123",
      ts: "1710000000.000100",
      user: "U123",
      text: "Hello from Slack",
    })

    expect(result).toEqual({
      kind: "accepted",
      turn: {
        organizationId: "org-123",
        provider: "slack",
        sourceEventId: "event-123",
        externalMessageId: "external-event-123",
        conversationId: "C123",
        messageId: "1710000000.000100",
        threadId: "1710000000.000100",
        senderId: "U123",
        content: "Hello from Slack",
        replyMode: "thread",
        receivedAt: "2026-09-08T10:01:00.000Z",
      },
    })
  })

  test("uses Slack thread_ts for the thread ID", () => {
    const result = engine.route(event(), {
      channel: "C123",
      ts: "1710000001.000200",
      thread_ts: "1710000000.000100",
      user: "U123",
      text: "A threaded reply",
    })

    expect(result).toMatchObject({
      kind: "accepted",
      turn: {
        messageId: "1710000001.000200",
        threadId: "1710000000.000100",
        replyMode: "thread",
      },
    })
  })

  test.each([
    { bot_id: "B123" },
    { subtype: "bot_message" },
  ])("ignores bot messages", (botFields) => {
    const result = engine.route(event(), {
      channel: "C123",
      ts: "1710000000.000100",
      text: "A bot response",
      ...botFields,
    })

    expect(result).toEqual({ kind: "ignored", reason: "bot_message" })
  })

  test("ignores unsupported providers", () => {
    const result = engine.route(
      event({ source: "linear", event_type: "linear_comment_created" }),
      {}
    )

    expect(result).toEqual({ kind: "ignored", reason: "unsupported_provider" })
  })
})
