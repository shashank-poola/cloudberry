import type { CompanyEvent } from "@cloudberry/contracts"
import { slackChannelMessageAdapter } from "./slack"
import type { ChannelConversationResult } from "./types"

export class ConversationEngine {
  route(event: CompanyEvent, payload: unknown): ChannelConversationResult {
    if (event.source !== slackChannelMessageAdapter.provider) {
      return { kind: "ignored", reason: "unsupported_provider" }
    }

    if (!slackChannelMessageAdapter.supports(event)) {
      return { kind: "ignored", reason: "unsupported_event_type" }
    }

    return slackChannelMessageAdapter.normalize(event, payload)
  }

  normalize(event: CompanyEvent, payload: unknown): ChannelConversationResult {
    return this.route(event, payload)
  }
}
