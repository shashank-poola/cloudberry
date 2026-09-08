import Image from "next/image"
import type {
  ChatCitation,
  ChatMessage as PersistedChatMessage,
} from "@/api/chat/client"
import { InlineCitations } from "./inline-citations"
import { MessageMarkdown } from "./message-markdown"
import { ThinkingReasoning } from "./thinking-reasoning"

export type ChatMessageData = {
  id: string
  role: "user" | "assistant"
  text: string
  status: PersistedChatMessage["status"]
  error: string | null
  citations: ChatCitation[]
}

type ChatMessageProps = {
  message: ChatMessageData
  isStreaming?: boolean
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  return (
    <div
      className={
        message.role === "user"
          ? "ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-white/10 px-3.5 py-2 text-sm leading-5 wrap-break-word whitespace-pre-wrap text-zinc-100"
          : "max-w-[92%] text-sm leading-6 text-zinc-300"
      }
    >
      {message.role === "assistant" ? (
        <div className="flex items-start gap-3">
          <Image
            src="/white_cloudberry_logo.png"
            alt=""
            width={22}
            height={22}
            className="size-5 shrink-0 -translate-y-0.98 object-contain opacity-75"
          />
          <div className="min-w-0">
            {message.text ? (
              <MessageMarkdown isStreaming={isStreaming}>
                {message.text}
              </MessageMarkdown>
            ) : message.status === "running" ? (
              <ThinkingReasoning />
            ) : (
              <p className="text-red-300/90">
                {message.error ??
                  "Cloudberry could not complete the request."}
              </p>
            )}
            <InlineCitations citations={message.citations} />
          </div>
        </div>
      ) : (
        message.text
      )}
    </div>
  )
}
