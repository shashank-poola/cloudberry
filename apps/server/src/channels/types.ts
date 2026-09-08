import type { CompanyEvent } from "@cloudberry/contracts"

export type ChannelProvider = "slack" | "linear" | "github"

export type ChannelReplyMode = "thread" | "comment"

export type ChannelConversationTurn = {
  organizationId: string
  provider: ChannelProvider
  sourceEventId: string
  externalMessageId: string
  conversationId: string
  messageId: string
  threadId: string
  senderId: string | null
  content: string
  replyMode: ChannelReplyMode
  receivedAt: string
}

export type ChannelConversationIgnoredReason =
  | "unsupported_provider"
  | "unsupported_event_type"
  | "bot_message"
  | "missing_channel"
  | "missing_message_timestamp"
  | "missing_message_text"

export type ChannelConversationResult =
  | { kind: "accepted"; turn: ChannelConversationTurn }
  | { kind: "ignored"; reason: ChannelConversationIgnoredReason }

export type ChannelConversationAdapter = {
  provider: ChannelProvider
  supports: (event: CompanyEvent) => boolean
  normalize: (
    event: CompanyEvent,
    payload: unknown
  ) => ChannelConversationResult
}

export type FutureChannelAdapter = {
  provider: Exclude<ChannelProvider, "slack">
  supported: false
}
