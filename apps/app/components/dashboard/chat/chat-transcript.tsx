"use client"

import { useEffect, useRef, type RefObject } from "react"
import { ChatMessage, type ChatMessageData } from "./chat-message"
import { ChatSkeleton } from "./chat-skeleton"
import styles from "./chat-view.module.css"

type ChatTranscriptProps = {
  messages: ChatMessageData[]
  isLoading: boolean
  streamingMessageId?: string | null
  transcriptRef: RefObject<HTMLDivElement | null>
}

export function ChatTranscript({
  messages,
  isLoading,
  streamingMessageId = null,
  transcriptRef,
}: ChatTranscriptProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!streamingMessageId) return

    const transcript = transcriptRef.current
    const content = contentRef.current
    if (!transcript || !content || typeof ResizeObserver === "undefined") return

    let shouldStickToBottom = true
    const isNearBottom = () =>
      transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight <
      96
    const scrollToBottom = () => {
      if (shouldStickToBottom) transcript.scrollTop = transcript.scrollHeight
    }
    const handleScroll = () => {
      shouldStickToBottom = isNearBottom()
    }

    scrollToBottom()
    transcript.addEventListener("scroll", handleScroll, { passive: true })
    const observer = new ResizeObserver(scrollToBottom)
    observer.observe(content)

    return () => {
      observer.disconnect()
      transcript.removeEventListener("scroll", handleScroll)
    }
  }, [streamingMessageId, transcriptRef])

  return (
    <div
      ref={transcriptRef}
      className={`${styles.transcript} dashboard-scrollbar min-h-0 w-full flex-1 overflow-y-auto overscroll-contain`}
    >
      <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
        <div
          ref={contentRef}
          className="w-full max-w-160 py-8 pb-48 sm:py-10 sm:pb-52"
          aria-live="polite"
        >
          {isLoading ? (
            <ChatSkeleton />
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={message.id === streamingMessageId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
