"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconRefresh,
  IconX,
} from "@tabler/icons-react"
import { getApiErrorMessage } from "@/api/client"
import {
  cancelCodexConnection,
  pollCodexConnection,
  type CodexConnectionStart,
  type Integration,
} from "@/api/integrations/client"

type CodexConnectModalProps = {
  connection: CodexConnectionStart
  onCloseAction: () => void
  onConnectedAction: (integration: Integration) => void
}

type FlowState = "waiting" | "success" | "expired" | "failed" | "cancelled"

type CopyTarget = "url" | "code"

function expirationLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "This code expires soon"
  return `Expires ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`
}

export function CodexConnectModal({
  connection,
  onCloseAction,
  onConnectedAction,
}: CodexConnectModalProps) {
  const [flowState, setFlowState] = useState<FlowState>("waiting")
  const [error, setError] = useState<string | null>(null)
  const [copyTarget, setCopyTarget] = useState<CopyTarget | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    let disposed = false
    let timer: number | null = null
    let completionTimer: number | null = null
    const controller = new AbortController()

    const schedule = (seconds: number) => {
      timer = window.setTimeout(() => void poll(), seconds * 1_000)
    }

    async function poll() {
      try {
        const result = await pollCodexConnection(
          connection.attempt_id,
          controller.signal
        )
        if (disposed) return

        if (result.status === "pending") {
          schedule(result.poll_after_seconds)
          return
        }
        if (result.status === "connected" && result.integration) {
          setFlowState("success")
          completionTimer = window.setTimeout(
            () => onConnectedAction(result.integration!),
            700
          )
          return
        }
        if (result.status === "expired") {
          setFlowState("expired")
          setError(
            "This device code has expired. Start a new connection to try again."
          )
          return
        }
        if (result.status === "cancelled") {
          setFlowState("cancelled")
          return
        }

        setFlowState("failed")
        setError("Codex could not complete the connection. Try again.")
      } catch (caughtError) {
        if (disposed || controller.signal.aborted) return
        setFlowState("failed")
        setError(getApiErrorMessage(caughtError))
      }
    }

    void poll()

    return () => {
      disposed = true
      controller.abort()
      if (timer !== null) window.clearTimeout(timer)
      if (completionTimer !== null) window.clearTimeout(completionTimer)
    }
  }, [connection.attempt_id, onConnectedAction, refreshNonce])

  async function copy(target: CopyTarget, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyTarget(target)
      window.setTimeout(() => setCopyTarget(null), 1_500)
    } catch {
      setError(
        "Cloudberry could not copy that value. Select it and copy it manually."
      )
    }
  }

  async function cancel() {
    if (flowState !== "waiting") {
      onCloseAction()
      return
    }

    setIsCancelling(true)
    setError(null)
    try {
      await cancelCodexConnection(connection.attempt_id)
      onCloseAction()
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError))
      setIsCancelling(false)
    }
  }

  const waiting = flowState === "waiting"
  const terminal = !waiting && flowState !== "success"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-connect-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#151515] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/4 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
              <Image
                src="/plugins/codex.png"
                alt=""
                width={30}
                height={30}
                className="size-7 object-contain"
              />
            </span>
            <h2
              id="codex-connect-title"
              className="truncate text-xl font-semibold tracking-[-0.03em] text-zinc-100"
            >
              {flowState === "success" ? "Codex connected" : "Connect Codex"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={isCancelling}
            aria-label="Close dialog"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.08] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-wait disabled:opacity-50"
          >
            <IconX size={18} stroke={2} aria-hidden="true" />
          </button>
        </div>

        {flowState === "success" ? (
          <div className="mt-7 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-4 text-sm leading-6 text-emerald-100">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-300">
              <IconCheck size={15} stroke={2} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">Connection complete</p>
              <p className="mt-0.5 text-emerald-100/75">
                Your OpenAI Codex account is now connected to this Cloudberry
                workspace.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-5 text-sm leading-6 text-zinc-400">
              Sign in with OpenAI to connect Codex.
            </p>

            <div className="mt-7 space-y-5">
              <section>
                <p className="text-xs font-semibold">
                  <span className="text-zinc-500">Step 1 - </span>
                  <span className="text-zinc-200">Open the sign-in page</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    href={connection.device_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open OpenAI sign-in page"
                    className="group flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-0 transition-colors hover:border-white/[0.16] hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center text-zinc-400 transition-colors group-hover:text-zinc-200">
                      <IconExternalLink
                        size={15}
                        stroke={2}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="min-w-0 truncate font-mono text-sm text-zinc-500 transition-colors group-hover:text-zinc-300">
                      {connection.device_url}
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void copy("url", connection.device_url)}
                    aria-label={
                      copyTarget === "url"
                        ? "Sign-in link copied"
                        : "Copy sign-in link"
                    }
                    title={
                      copyTarget === "url"
                        ? "Copied"
                        : "Copy sign-in link"
                    }
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                  >
                    {copyTarget === "url" ? (
                      <IconCheck
                        size={15}
                        stroke={2}
                        aria-hidden="true"
                        className="motion-safe:animate-pulse"
                      />
                    ) : (
                      <IconCopy size={15} stroke={2} aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">
                      {copyTarget === "url" ? "Copied" : "Copy"}
                    </span>
                  </button>
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold">
                  <span className="text-zinc-500">Step 2 - </span>
                  <span className="text-zinc-200">Enter the device code</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    id="codex-device-code"
                    aria-label="Codex device code"
                    value={connection.user_code}
                    readOnly
                    className="h-11 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-0 text-center font-mono text-lg font-semibold tracking-[0.16em] text-zinc-100 uppercase outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void copy("code", connection.user_code)}
                    aria-label={
                      copyTarget === "code"
                        ? "Device code copied"
                        : "Copy device code"
                    }
                    title={
                      copyTarget === "code" ? "Copied" : "Copy device code"
                    }
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                  >
                    {copyTarget === "code" ? (
                      <IconCheck
                        size={15}
                        stroke={2}
                        aria-hidden="true"
                        className="motion-safe:animate-pulse"
                      />
                    ) : (
                      <IconCopy size={15} stroke={2} aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">
                      {copyTarget === "code" ? "Copied" : "Copy"}
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {expirationLabel(connection.expires_at)}
                </p>
              </section>
            </div>

            {waiting ? (
              <div
                className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-3"
                role="status"
                aria-live="polite"
              >
                <span className="size-2 shrink-0 animate-pulse rounded-full bg-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-300">
                    Waiting for approval
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    Finish sign-in in the OpenAI tab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setRefreshNonce((value) => value + 1)
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400"
                >
                  <IconRefresh size={14} stroke={2} aria-hidden="true" />
                  Refresh
                </button>
              </div>
            ) : null}

            {terminal && error ? (
              <div
                className="codex-connect-error mt-5 flex items-start gap-2.5 text-xs leading-5"
                role="alert"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" />
                <span>{error}</span>
              </div>
            ) : null}
          </>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {terminal || flowState === "success" ? null : (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={isCancelling}
              className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-wait disabled:opacity-50"
            >
              {isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
          {terminal || flowState === "success" ? (
            <button
              type="button"
              onClick={onCloseAction}
              className="rounded-xl border border-white/[0.14] bg-white/[0.08] px-3.5 py-2 text-xs font-semibold text-zinc-100 transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
