"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { getApiErrorMessage } from "@/api/client"
import {
  ensurePrizedComputer,
  interruptCodexSession,
  startCodexSession,
  waitForCodexSession,
  type CodexSession,
} from "@/api/computer/client"
import { PromptInput } from "./prompt-input"
import styles from "./chat-view.module.css"

type ChatViewProps = {
  displayName: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

type RunPhase =
  | "idle"
  | "preparing"
  | "starting"
  | "running"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled"

type ActiveRun = {
  id: number
  controller: AbortController
  sessionId: string | null
  interruptRequested: boolean
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function sessionStatusLabel(session: CodexSession) {
  switch (session.status) {
    case "queued":
      return "Codex is queued…"
    case "running":
      return "Codex is working…"
    case "succeeded":
      return "Codex finished"
    case "failed":
      return "Codex could not complete the request"
    case "cancelled":
      return "Codex session interrupted"
  }
}

function mergeAssistantText(
  current: string,
  incoming: string,
  mode: "append" | "replace"
) {
  if (!incoming) return current
  if (mode === "append") return current + incoming
  if (!current) return incoming
  if (current === incoming) return current
  if (incoming.startsWith(current)) return incoming
  if (current.startsWith(incoming)) return current
  return `${current}\n\n${incoming}`
}

export function ChatView({ displayName }: ChatViewProps) {
  const [greeting, setGreeting] = useState("Hello")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [phase, setPhase] = useState<RunPhase>("idle")
  const [statusText, setStatusText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const runNumberRef = useRef(0)
  const activeRunRef = useRef<ActiveRun | null>(null)
  const assistantTextRef = useRef("")

  const isBusy =
    phase === "preparing" ||
    phase === "starting" ||
    phase === "running" ||
    phase === "cancelling"

  useEffect(() => {
    // Resolve after hydration so the greeting follows the viewer's timezone.
    const frame = window.requestAnimationFrame(() => {
      setGreeting(getLocalGreeting())
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(
    () => () => {
      activeRunRef.current?.controller.abort()
      activeRunRef.current = null
    },
    []
  )

  function isCurrentRun(runId: number) {
    return activeRunRef.current?.id === runId
  }

  function updateAssistantMessage(
    messageId: string,
    text: string,
    mode: "append" | "replace"
  ) {
    assistantTextRef.current = mergeAssistantText(
      assistantTextRef.current,
      text,
      mode
    )
    const nextText = assistantTextRef.current

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, text: nextText } : message
      )
    )
  }

  async function submitPrompt(prompt: string) {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || isBusy) return

    const runId = runNumberRef.current + 1
    runNumberRef.current = runId
    const assistantMessageId = `assistant-${runId}`
    const run: ActiveRun = {
      controller: new AbortController(),
      id: runId,
      interruptRequested: false,
      sessionId: null,
    }

    activeRunRef.current = run
    assistantTextRef.current = ""
    setActivePrompt(cleanPrompt)
    setError(null)
    setStatusText("Preparing Cloudberry's computer…")
    setPhase("preparing")
    setMessages((current) => [
      ...current,
      { id: `user-${runId}`, role: "user", text: cleanPrompt },
      { id: assistantMessageId, role: "assistant", text: "" },
    ])

    try {
      await ensurePrizedComputer(run.controller.signal)
      if (!isCurrentRun(runId)) return

      setPhase("starting")
      setStatusText("Starting Codex…")
      const session = await startCodexSession(
        cleanPrompt,
        run.controller.signal
      )
      run.sessionId = session.id
      if (!isCurrentRun(runId)) return

      setStatusText(sessionStatusLabel(session))
      setPhase(session.status === "running" ? "running" : "starting")

      const completedSession = await waitForCodexSession(session.id, {
        onAssistantText: (text, mode) => {
          if (!isCurrentRun(runId)) return
          updateAssistantMessage(assistantMessageId, text, mode)
        },
        onEvent: (label) => {
          if (isCurrentRun(runId)) setStatusText(label)
        },
        onStatus: (nextSession) => {
          if (!isCurrentRun(runId)) return
          setPhase(nextSession.status === "running" ? "running" : "starting")
          setStatusText(sessionStatusLabel(nextSession))
          if (nextSession.error) setError(nextSession.error)
        },
        signal: run.controller.signal,
      })

      if (!isCurrentRun(runId)) return

      if (completedSession.status === "succeeded") {
        setPhase("succeeded")
        setStatusText("Codex finished")
        if (!assistantTextRef.current) {
          updateAssistantMessage(
            assistantMessageId,
            "Codex completed without a text response.",
            "replace"
          )
        }
      } else if (completedSession.status === "cancelled") {
        setPhase("cancelled")
        setStatusText("Codex session interrupted")
      } else {
        setPhase("failed")
        setStatusText("Codex could not complete the request")
        setError(
          completedSession.error ??
            "Codex could not complete the request. You can retry the prompt."
        )
      }
    } catch (caughtError) {
      if (!isCurrentRun(runId)) return

      if (run.interruptRequested || isAbortError(caughtError)) {
        setPhase("cancelled")
        setStatusText("Codex session interrupted")
      } else {
        setPhase("failed")
        setStatusText("Something went wrong")
        setError(getApiErrorMessage(caughtError))
      }
    } finally {
      if (isCurrentRun(runId)) activeRunRef.current = null
    }
  }

  async function interrupt() {
    const run = activeRunRef.current
    if (!run) return

    run.interruptRequested = true
    setPhase("cancelling")
    setStatusText("Interrupting Codex…")
    setError(null)

    if (!run.sessionId) {
      run.controller.abort()
      activeRunRef.current = null
      setPhase("cancelled")
      setStatusText("Codex session interrupted")
      return
    }

    try {
      const sessionId = run.sessionId
      await interruptCodexSession(sessionId, run.controller.signal)
      if (!activeRunRef.current || activeRunRef.current.id !== run.id) return

      run.controller.abort()
      activeRunRef.current = null
      setPhase("cancelled")
      setStatusText("Codex session interrupted")
    } catch (caughtError) {
      if (!isCurrentRun(run.id)) return
      run.interruptRequested = false
      setPhase("running")
      setStatusText("Codex is still working…")
      setError(`Could not interrupt Codex: ${getApiErrorMessage(caughtError)}`)
    }
  }

  function retry() {
    if (activePrompt && !isBusy) void submitPrompt(activePrompt)
  }

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col">
      <div
        className={`mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-16 sm:px-8 ${
          messages.length
            ? "justify-start pt-10 sm:pt-12"
            : "-translate-y-14 items-center justify-center sm:-translate-y-16"
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
          </div>
        ) : (
          <div className="mb-8 w-full max-w-160">
            <div className="space-y-5" aria-live="polite">
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
                        alt="Codex"
                        width={22}
                        height={22}
                        className="mt-1 size-5 shrink-0 object-contain opacity-75"
                      />
                      <span>
                        {message.text ||
                          (isBusy ? "Codex is working…" : "No response yet.")}
                      </span>
                    </div>
                  ) : (
                    message.text
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3">
              <div
                className="flex flex-wrap items-center justify-between gap-3"
                role="status"
                aria-live="polite"
              >
                <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-400">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      isBusy
                        ? "animate-pulse bg-amber-300"
                        : phase === "failed"
                          ? "bg-red-400"
                          : phase === "cancelled"
                            ? "bg-zinc-500"
                            : "bg-emerald-400"
                    }`}
                  />
                  <span className="truncate">{statusText}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isBusy ? (
                    <button
                      type="button"
                      onClick={() => void interrupt()}
                      className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      Interrupt
                    </button>
                  ) : null}
                  {(phase === "failed" || phase === "cancelled") &&
                  activePrompt ? (
                    <button
                      type="button"
                      onClick={retry}
                      className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
              {error ? (
                <p className="mt-2 text-xs leading-5 text-red-300/90">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        )}

        <div
          data-theme="dark"
          className={`${styles.composer} w-full max-w-160`}
        >
          <PromptInput disabled={isBusy} onSubmitAction={submitPrompt} />
        </div>
      </div>
    </section>
  )
}
