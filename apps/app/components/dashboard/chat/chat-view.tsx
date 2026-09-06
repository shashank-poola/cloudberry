"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getApiErrorMessage } from "@/api/client"
import {
  createChat,
  createChatMessage,
  getChat,
  type ChatCitation,
  type ChatMessage as PersistedChatMessage,
  type HostedModelId,
} from "@/api/chat/client"
import { getPrizedComputer } from "@/api/computer/client"
import { useDashboardProfile } from "@/components/dashboard/dashboard-profile-context"
import { PromptInput } from "./prompt-input"
import { ThinkingState } from "./thinking-state"
import styles from "./chat-view.module.css"

type ChatViewProps = {
  chatId?: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  status: PersistedChatMessage["status"]
  error: string | null
  citations: ChatCitation[]
}

type RunPhase = "idle" | "loading" | "thinking" | "failed"

const DEFAULT_MODEL: HostedModelId = "gpt-oss-120b"

function getFirstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "there"
}

function getLocalGreeting() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      ...(timeZone ? { timeZone } : {}),
    })
      .formatToParts(new Date())
      .find((part) => part.type === "hour")?.value
  )

  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function toChatMessage(message: PersistedChatMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.content,
    status: message.status,
    error: message.error,
    citations: message.citations,
  }
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return "00000000-0000-4000-8000-000000000000"
}

export function ChatView({ chatId }: ChatViewProps) {
  const router = useRouter()
  const { displayName } = useDashboardProfile()
  const [greeting, setGreeting] = useState("Hello")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [model, setModel] = useState<HostedModelId>(DEFAULT_MODEL)
  const [phase, setPhase] = useState<RunPhase>(chatId ? "loading" : "idle")
  const [error, setError] = useState<string | null>(null)
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(chatId ?? null)
  const [codexConnected, setCodexConnected] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  const isBusy = phase === "loading" || phase === "thinking"

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setGreeting(getLocalGreeting())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!chatId) return

    const controller = new AbortController()
    void getChat(chatId, controller.signal)
      .then((detail) => {
        setModel(detail.chat.model)
        setMessages(detail.messages.map(toChatMessage))
        const failedMessage = detail.messages.find(
          (message) => message.role === "assistant" && message.status === "failed"
        )
        setError(failedMessage?.error ?? null)
        setPhase(failedMessage ? "failed" : "idle")
      })
      .catch((caughtError) => {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(caughtError))
        setPhase("failed")
      })

    return () => controller.abort()
  }, [chatId])

  useEffect(() => {
    const controller = new AbortController()
    void getPrizedComputer(controller.signal)
      .then((computer) => setCodexConnected(computer?.codexConnected === true))
      .catch(() => setCodexConnected(false))

    return () => controller.abort()
  }, [])

  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    []
  )

  async function submitPrompt(prompt: string, requestedModel: HostedModelId) {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || isBusy) return

    const controller = new AbortController()
    controllerRef.current = controller
    const temporaryUserId = `user-${createClientMessageId()}`
    const temporaryAssistantId = `assistant-${createClientMessageId()}`
    setActivePrompt(cleanPrompt)
    setError(null)
    setPhase("thinking")
    setMessages((current) => [
      ...current,
      {
        id: temporaryUserId,
        role: "user",
        text: cleanPrompt,
        status: "succeeded",
        error: null,
        citations: [],
      },
      {
        id: temporaryAssistantId,
        role: "assistant",
        text: "",
        status: "running",
        error: null,
        citations: [],
      },
    ])

    try {
      let conversationId = activeChatId
      if (!conversationId) {
        const chat = await createChat(requestedModel, controller.signal)
        conversationId = chat.id
        setActiveChatId(chat.id)
        setModel(chat.model)
      }

      const result = await createChatMessage(
        conversationId,
        cleanPrompt,
        createClientMessageId(),
        controller.signal
      )
      if (controller.signal.aborted) return

      setModel(result.chat.model)
      setMessages((current) =>
        current.map((message) => {
          if (message.id === temporaryUserId) return toChatMessage(result.userMessage)
          if (message.id === temporaryAssistantId) {
            return toChatMessage(result.assistantMessage)
          }
          return message
        })
      )
      setPhase("idle")
      setActivePrompt(null)

      if (!chatId) router.replace(`/c/${result.chat.id}`)
    } catch (caughtError) {
      if (controller.signal.aborted) return
      const message = getApiErrorMessage(caughtError)
      setMessages((current) =>
        current.map((entry) =>
          entry.id === temporaryAssistantId
            ? { ...entry, status: "failed", error: message }
            : entry
        )
      )
      setError(message)
      setPhase("failed")
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  function retry() {
    if (activePrompt && !isBusy) void submitPrompt(activePrompt, model)
  }

  const showStatus = messages.length > 0 && (isBusy || error)

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col">
      <div
        className={`mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 sm:px-8 ${
          messages.length
            ? "min-h-0 py-8 sm:py-10"
            : "-translate-y-8 items-center justify-center py-16 sm:-translate-y-12"
        }`}
      >
        {messages.length === 0 ? (
          <div className="mb-7 flex flex-col items-center text-center sm:mb-8">
            <Image
              src="/white_cloudberry_logo.png"
              alt=""
              width={52}
              height={52}
              className="mb-5 size-12 object-contain opacity-90"
              priority
            />
            <h2 className="text-[clamp(2rem,4vw,3rem)] leading-none font-medium tracking-[-0.055em] text-zinc-100">
              {greeting}, {getFirstName(displayName)}!
            </h2>
            {error ? (
              <p className="mt-4 max-w-md text-sm leading-6 text-red-300/90">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="w-full max-w-160" aria-live="polite">
            <div className="space-y-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.1] px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-zinc-100"
                      : "max-w-[92%] text-sm leading-6 whitespace-pre-wrap text-zinc-300"
                  }
                >
                  {message.role === "assistant" ? (
                    <div className="flex gap-3">
                      <Image
                        src="/white_cloudberry_logo.png"
                        alt=""
                        width={22}
                        height={22}
                        className="mt-1 size-5 shrink-0 object-contain opacity-75"
                      />
                      <div className="min-w-0">
                        {message.text ? (
                          <p>{message.text}</p>
                        ) : message.status === "running" ? (
                          <ThinkingState />
                        ) : (
                          <p className="text-red-300/90">
                            {message.error ?? "Cloudberry could not complete the request."}
                          </p>
                        )}
                        {message.citations.length ? (
                          <p className="mt-2 text-xs text-zinc-500">
                            Grounded in {message.citations.length} company knowledge
                            {message.citations.length === 1 ? " source" : " sources"}.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    message.text
                  )}
                </div>
              ))}
            </div>

            {showStatus ? (
              <div
                className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3"
                role="status"
              >
                <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-400">
                  {isBusy ? <ThinkingState /> : <span>{error}</span>}
                </div>
                {phase === "failed" && activePrompt ? (
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div
          data-theme="dark"
          className={`${styles.composer} w-full max-w-160 ${
            messages.length ? "mt-auto pt-10 pb-2 sm:pt-14" : ""
          }`}
        >
          <PromptInput
            disabled={isBusy}
            selectedModel={model}
            onModelChange={setModel}
            showCodexInstall={!codexConnected}
            onInstallCodex={() => router.push("/computer")}
            onSubmitAction={submitPrompt}
          />
        </div>
      </div>
    </section>
  )
}
