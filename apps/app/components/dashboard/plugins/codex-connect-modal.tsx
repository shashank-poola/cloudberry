"use client"

import { useEffect, useState } from "react"
import { getApiErrorMessage } from "@/api/client"
import {
  cancelCodexConnection,
  pollCodexConnection,
  type CodexConnectionStart,
  type Integration,
} from "@/api/integrations/client"

type CodexConnectModalProps = {
  connection: CodexConnectionStart
  onClose: () => void
  onConnected: (integration: Integration) => void
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
  onClose,
  onConnected,
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
            () => onConnected(result.integration!),
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
  }, [connection.attempt_id, onConnected, refreshNonce])

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
      onClose()
      return
    }

    setIsCancelling(true)
    setError(null)
    try {
      await cancelCodexConnection(connection.attempt_id)
      onClose()
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError))
      setIsCancelling(false)
    }
  }

  const waiting = flowState === "waiting"
  const terminal = !waiting && flowState !== "success"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-connect-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/4 sm:p-6"
      >
        <div className="flex items-start">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
              Codex integration
            </p>
            <h2
              id="codex-connect-title"
              className="mt-2 text-xl font-semibold tracking-[-0.03em] text-zinc-100"
            >
              {flowState === "success" ? "Codex connected" : "Connect Codex"}
            </h2>
          </div>
        </div>

        {flowState === "success" ? (
          <div className="mt-7 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-4 text-sm leading-6 text-emerald-100">
            Your OpenAI Codex account is now connected to this Cloudberry
            workspace.
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Open the OpenAI sign-in page, enter the one-time code below, and
              keep this window open while Cloudberry waits for approval.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="codex-device-url"
                  className="text-[11px] font-semibold tracking-[0.12em] text-zinc-500 uppercase"
                >
                  Sign-in link
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="codex-device-url"
                    value={connection.device_url}
                    readOnly
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2.5 font-mono text-xs text-zinc-300 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void copy("url", connection.device_url)}
                    className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {copyTarget === "url" ? "Copied" : "Copy"}
                  </button>
                </div>
                <a
                  href={connection.device_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-medium text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-200"
                >
                  Open sign-in page
                </a>
              </div>

              <div>
                <label
                  htmlFor="codex-device-code"
                  className="text-[11px] font-semibold tracking-[0.12em] text-zinc-500 uppercase"
                >
                  Device code
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="codex-device-code"
                    value={connection.user_code}
                    readOnly
                    className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-black/20 px-3 py-3 font-mono text-lg tracking-[0.14em] text-zinc-100 uppercase outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void copy("code", connection.user_code)}
                    className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {copyTarget === "code" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  {expirationLabel(connection.expires_at)}
                </p>
              </div>
            </div>

            {waiting ? (
              <div
                className="mt-5 flex items-center gap-2 text-xs text-zinc-500"
                role="status"
                aria-live="polite"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-amber-300" />
                Waiting for approval…
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setRefreshNonce((value) => value + 1)
                  }}
                  className="ml-auto text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-200"
                >
                  Refresh
                </button>
              </div>
            ) : null}

            {terminal && error ? (
              <div
                className="mt-5 rounded-lg border border-red-400/20 bg-red-400/[0.08] px-3 py-2.5 text-xs leading-5 text-red-200"
                role="alert"
              >
                {error}
              </div>
            ) : null}
          </>
        )}

        <div className="mt-7 flex items-center justify-end gap-2">
          {terminal || flowState === "success" ? null : (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={isCancelling}
              className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50"
            >
              {isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
          {terminal || flowState === "success" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.14] bg-white/[0.08] px-3.5 py-2 text-xs font-semibold text-zinc-100 transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
