import type { CompanyEvent } from "@cloudberry/contracts"
import type {
  ChannelConversationAdapter,
  ChannelConversationResult,
} from "../types"

const SLACK_CHANNEL_MESSAGE_EVENT_TYPE = "slack_channel_message_received"

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const nonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null

const normalizeEventType = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")

const isBotMessage = (payload: Record<string, unknown>): boolean =>
  ("bot_id" in payload &&
    payload.bot_id !== null &&
    payload.bot_id !== undefined) ||
  normalizeEventType(String(payload.subtype ?? "")) === "bot_message"

export const isSlackChannelMessageEvent = (event: CompanyEvent): boolean =>
  event.source === "slack" &&
  normalizeEventType(event.event_type) === SLACK_CHANNEL_MESSAGE_EVENT_TYPE

export const normalizeSlackChannelMessage = (
  event: CompanyEvent,
  payload: unknown
): ChannelConversationResult => {
  if (!isSlackChannelMessageEvent(event)) {
    return { kind: "ignored", reason: "unsupported_event_type" }
  }

  const message = asRecord(payload)
  if (!message) return { kind: "ignored", reason: "missing_channel" }
  if (isBotMessage(message)) return { kind: "ignored", reason: "bot_message" }

  const channel = nonEmptyString(message.channel)
  if (!channel) return { kind: "ignored", reason: "missing_channel" }

  const timestamp = nonEmptyString(message.ts)
  if (!timestamp) {
    return { kind: "ignored", reason: "missing_message_timestamp" }
  }

  const text = nonEmptyString(message.text)
  if (!text) return { kind: "ignored", reason: "missing_message_text" }

  const threadTimestamp = nonEmptyString(message.thread_ts)
  const senderId = nonEmptyString(message.user)

  return {
    kind: "accepted",
    turn: {
      organizationId: event.organization_id,
      provider: "slack",
      sourceEventId: event.id,
      externalMessageId: event.external_event_id,
      conversationId: channel,
      messageId: timestamp,
      threadId: threadTimestamp ?? timestamp,
      senderId,
      content: text,
      replyMode: "thread",
      receivedAt: event.received_at,
    },
  }
}

export const slackChannelMessageAdapter: ChannelConversationAdapter = {
  provider: "slack",
  supports: isSlackChannelMessageEvent,
  normalize: normalizeSlackChannelMessage,
}
