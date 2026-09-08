"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getApiErrorMessage } from "@/api/client"
import {
  createChat,
  createChatMessage,
  getChat,
  notifyChatListChanged,
  type ChatMessage as PersistedChatMessage,
  type HostedModelId,
} from "@/api/chat/client"
import { getCodexModels, type CodexModel } from "@/api/codex/client"
import { CODEX_MODEL_PRESETS, type CodexModelId } from "@/api/codex/catalog"
import { getIntegrations } from "@/api/integrations/client"
import type { PromptModelSelection } from "./prompt-input"
import { useDashboardProfile } from "@/components/dashboard/dashboard-profile-context"
import { type ChatMessageData } from "./chat-message"
import { ChatTranscript } from "./chat-transcript"
import { PromptInput } from "./prompt-input"
import styles from "./chat-view.module.css"

type ChatViewProps = {
  chatId?: string
}

type RunPhase = "idle" | "loading" | "thinking" | "failed"

const DEFAULT_MODEL: HostedModelId = "gpt-oss-120b"
const DEFAULT_CODEX_MODEL: CodexModelId = CODEX_MODEL_PRESETS[0].id

function getInitialCodexModel(): CodexModelId {
  if (typeof window === "undefined") return DEFAULT_CODEX_MODEL

  try {
    const stored = window.localStorage.getItem("cloudberry.codex.model")
    return CODEX_MODEL_PRESETS.some((option) => option.id === stored)
      ? (stored as CodexModelId)
      : DEFAULT_CODEX_MODEL
  } catch {
    return DEFAULT_CODEX_MODEL
  }
}

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

function toChatMessage(message: PersistedChatMessage): ChatMessageData {
  return {
    id: message.id,
    role: message.role,
    text: message.content,
    status: message.status,
    error: message.error ? getApiErrorMessage(message.error) : null,
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
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [model, setModel] = useState<HostedModelId>(DEFAULT_MODEL)
  const [codexModel, setCodexModel] =
    useState<CodexModelId>(getInitialCodexModel)
  const [codexModels, setCodexModels] = useState<CodexModel[]>([])
  const [codexModelsLoading, setCodexModelsLoading] = useState(false)
  const [phase, setPhase] = useState<RunPhase>(chatId ? "loading" : "idle")
  const [error, setError] = useState<string | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(
    chatId ?? null
  )
  const [resolvedChatId, setResolvedChatId] = useState<string | null>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  )
  const [activeChatProvider, setActiveChatProvider] = useState<
    "hosted" | "codex" | null
  >(null)
  const [codexConnectionState, setCodexConnectionState] = useState<
    "loading" | "connected" | "disconnected"
  >("loading")

  const controllerRef = useRef<AbortController | null>(null)
  const pendingStreamingChatIdRef = useRef<string | null>(null)
  const pendingStreamingMessageIdRef = useRef<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const isBusy = phase === "loading" || phase === "thinking"
  const isChatLoading = Boolean(chatId && resolvedChatId !== chatId)
  const codexConnected = codexConnectionState === "connected"
  const codexChatEnabled = codexConnected
  const composerDisabled =
    isBusy ||
    isChatLoading ||
    (activeChatProvider === "codex" && !codexConnected)

  useEffect(() => {
    try {
      window.localStorage.setItem("cloudberry.codex.model", codexModel)
    } catch {
      // Private browsing and restricted storage should not block chat.
    }
  }, [codexModel])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setGreeting(getLocalGreeting())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!chatId) {
      const frame = window.requestAnimationFrame(() => {
        setActiveChatId(null)
        setResolvedChatId(null)
        setActiveChatProvider(null)
        setStreamingMessageId(null)
        setMessages([])
        setError(null)
        setPhase("idle")
      })
      return () => window.cancelAnimationFrame(frame)
    }

    const controller = new AbortController()
    if (pendingStreamingChatIdRef.current !== chatId) {
      pendingStreamingChatIdRef.current = null
      pendingStreamingMessageIdRef.current = null
    }

    const frame = window.requestAnimationFrame(() => {
      setActiveChatId(chatId)
      setResolvedChatId(null)
      setActiveChatProvider(null)
      setStreamingMessageId(null)
      setMessages([])
      setError(null)
      setPhase("loading")

      void getChat(chatId, controller.signal)
        .then((detail) => {
          if (controller.signal.aborted) return
          setActiveChatId(detail.chat.id)
          setActiveChatProvider(detail.chat.provider)
          if (detail.chat.provider === "hosted") {
            setModel(detail.chat.model as HostedModelId)
          } else {
            setCodexModel(detail.chat.model)
          }
          const loadedMessages = detail.messages.map(toChatMessage)
          const pendingMessageId =
            pendingStreamingChatIdRef.current === chatId
              ? pendingStreamingMessageIdRef.current
              : null
          setStreamingMessageId(
            pendingMessageId &&
              loadedMessages.some((message) => message.id === pendingMessageId)
              ? pendingMessageId
              : null
          )
          pendingStreamingChatIdRef.current = null
          pendingStreamingMessageIdRef.current = null
          setMessages(loadedMessages)
          const failedMessage = loadedMessages.find(
            (message) =>
              message.role === "assistant" && message.status === "failed"
          )
          setError(failedMessage?.error ?? null)
          setPhase(failedMessage ? "failed" : "idle")
          setResolvedChatId(chatId)
        })
        .catch((caughtError) => {
          if (controller.signal.aborted) return
          pendingStreamingChatIdRef.current = null
          pendingStreamingMessageIdRef.current = null
          setStreamingMessageId(null)
          setError(getApiErrorMessage(caughtError))
          setPhase("failed")
          setResolvedChatId(chatId)
        })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      controller.abort()
    }
  }, [chatId])

  useEffect(() => {
    const controller = new AbortController()
    void getIntegrations(controller.signal)
      .then((integrations) => {
        const connected = integrations.some(
          (integration) =>
            integration.provider === "codex" &&
            integration.connected &&
            integration.status === "active"
        )
        setCodexConnectionState(connected ? "connected" : "disconnected")
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setCodexConnectionState("disconnected")
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!codexConnected) return

    const controller = new AbortController()
    const loadingFrame = window.requestAnimationFrame(() =>
      setCodexModelsLoading(true)
    )
    void getCodexModels(controller.signal)
      .then((models) => {
        if (controller.signal.aborted) return
        setCodexModels(models)
        setCodexModel((current) =>
          models.some((entry) => entry.id === current)
            ? current
            : (models[0]?.id ?? DEFAULT_CODEX_MODEL)
        )
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setCodexModels([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setCodexModelsLoading(false)
      })

    return () => {
      window.cancelAnimationFrame(loadingFrame)
      controller.abort()
    }
  }, [codexConnected])

  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    []
  )

  async function submitPrompt(prompt: string, selection: PromptModelSelection) {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || isBusy) return

    setError(null)
    setStreamingMessageId(null)
    pendingStreamingChatIdRef.current = null
    pendingStreamingMessageIdRef.current = null

    const controller = new AbortController()
    controllerRef.current = controller
    const temporaryUserId = `user-${createClientMessageId()}`
    const temporaryAssistantId = `assistant-${createClientMessageId()}`
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

    let conversationId = chatId ?? activeChatId
    try {
      if (!conversationId || activeChatProvider !== selection.provider) {
        const chat = await createChat(selection, controller.signal)
        conversationId = chat.id
        setActiveChatId(chat.id)
        setActiveChatProvider(chat.provider)
        if (chat.provider === "hosted") {
          setModel(chat.model as HostedModelId)
        } else {
          setCodexModel(chat.model)
        }
        notifyChatListChanged()
      }

      if (!conversationId) throw new Error("Chat conversation was not created")
      const result = await createChatMessage(
        conversationId,
        cleanPrompt,
        createClientMessageId(),
        controller.signal
      )
      if (controller.signal.aborted) return

      setActiveChatProvider(result.chat.provider)
      if (result.chat.provider === "hosted") {
        setModel(result.chat.model as HostedModelId)
      } else {
        setCodexModel(result.chat.model)
      }
      setMessages((current) =>
        current.map((message) => {
          if (message.id === temporaryUserId)
            return toChatMessage(result.userMessage)
          if (message.id === temporaryAssistantId) {
            return toChatMessage(result.assistantMessage)
          }
          return message
        })
      )
      const shouldNavigate = !chatId || result.chat.id !== chatId
      if (shouldNavigate) {
        pendingStreamingChatIdRef.current = result.chat.id
        pendingStreamingMessageIdRef.current = result.assistantMessage.id
        setStreamingMessageId(null)
      } else {
        setStreamingMessageId(result.assistantMessage.id)
      }
      setPhase("idle")
      notifyChatListChanged()

      if (shouldNavigate) router.replace(`/c/${result.chat.id}`)
    } catch (caughtError) {
      if (controller.signal.aborted) return
      const message = getApiErrorMessage(caughtError)
      pendingStreamingChatIdRef.current = null
      pendingStreamingMessageIdRef.current = null
      setStreamingMessageId(null)
      setMessages((current) =>
        current.map((entry) =>
          entry.id === temporaryAssistantId
            ? { ...entry, status: "failed", error: message }
            : entry
        )
      )
      setError(message)
      setPhase("failed")
      notifyChatListChanged()
      if (conversationId && (!chatId || conversationId !== chatId)) {
        router.replace(`/c/${conversationId}`)
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }

  const showWelcome = !chatId && messages.length === 0

  useEffect(() => {
    if (showWelcome) return

    const transcript = transcriptRef.current
    if (!transcript) return

    const frame = window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      transcript.scrollTo({
        top: transcript.scrollHeight,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isChatLoading, messages, phase, showWelcome])

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={`relative flex h-full min-h-0 w-full flex-1 flex-col ${
          showWelcome
            ? "-translate-y-8 items-center justify-center py-16 sm:-translate-y-12"
            : ""
        }`}
      >
        {showWelcome ? (
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
          <ChatTranscript
            messages={messages}
            isLoading={isChatLoading}
            streamingMessageId={streamingMessageId}
            transcriptRef={transcriptRef}
          />
        )}

        {!showWelcome ? (
          <div aria-hidden="true" className={styles.composerBackdrop} />
        ) : null}

        <div
          className={
            showWelcome
              ? "w-full max-w-4xl shrink-0 px-5 sm:px-8"
              : "absolute inset-x-0 bottom-0 z-10"
          }
        >
          <div
            className={
              showWelcome ? "" : "mx-auto w-full max-w-4xl px-5 sm:px-8"
            }
          >
            <div
              className={`${styles.composer} ${
                messages.length ? styles.composerCompact : ""
              } w-full max-w-160 ${showWelcome ? "mx-auto" : ""} ${
                messages.length ? "pt-4 pb-8 sm:pt-6 sm:pb-10" : ""
              }`}
            >
              <PromptInput
                disabled={composerDisabled}
                selectedModel={model}
                onModelChangeAction={setModel}
                codexConnected={codexConnected}
                codexChatEnabled={codexChatEnabled}
                codexModels={codexModels}
                codexModelsLoading={codexModelsLoading}
                selectedCodexModel={codexModel}
                onCodexModelChangeAction={setCodexModel}
                onConnectCodexAction={() =>
                  router.push("/integrations?connect=codex")
                }
                onSubmitAction={submitPrompt}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
