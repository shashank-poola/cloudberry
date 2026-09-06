"use client"

import { useCallback, useEffect, useState } from "react"
import { getApiErrorMessage } from "@/api/client"
import {
  ensurePrizedComputer,
  getPrizedComputer,
  isPrizedComputerReady,
  type PrizedComputer,
} from "@/api/computer/client"

type StatusState = "loading" | "ready" | "starting" | "missing" | "error"

function statusLabel(computer: PrizedComputer | null, state: StatusState) {
  if (state === "loading") return "Checking"
  if (state === "starting") return "Starting"
  if (state === "missing") return "Not set up"
  if (state === "error") return "Unavailable"
  if (!computer) return "Unavailable"
  return isPrizedComputerReady(computer) ? "Online" : computer.status
}

export function ComputerStatus() {
  const [computer, setComputer] = useState<PrizedComputer | null>(null)
  const [state, setState] = useState<StatusState>("loading")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      const nextComputer = await getPrizedComputer()
      setComputer(nextComputer)
      setState(
        nextComputer
          ? isPrizedComputerReady(nextComputer)
            ? "ready"
            : "starting"
          : "missing"
      )
    } catch (caughtError) {
      setState("error")
      setError(getApiErrorMessage(caughtError))
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const check = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(check)
  }, [refresh])

  async function provision() {
    setState("starting")
    setIsRefreshing(true)
    setError(null)

    try {
      const nextComputer = await ensurePrizedComputer()
      setComputer(nextComputer)
      setState("ready")
    } catch (caughtError) {
      setState("error")
      setError(getApiErrorMessage(caughtError))
    } finally {
      setIsRefreshing(false)
    }
  }

  const status = statusLabel(computer, state)
  const statusTone =
    state === "ready"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : state === "error"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : "border-amber-300/20 bg-amber-300/10 text-amber-200"

  return (
    <div className="flex max-w-full flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${statusTone}`}
          aria-live="polite"
        >
          <span
            className={`size-1.5 rounded-full ${
              state === "ready"
                ? "bg-emerald-400"
                : state === "error"
                  ? "bg-red-400"
                  : "animate-pulse bg-amber-300"
            }`}
          />
          <span>Computer · {status}</span>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/[0.1] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
        >
          {isRefreshing ? "Checking…" : "Refresh"}
        </button>
        {(state === "missing" || state === "error") && (
          <button
            type="button"
            onClick={() => void provision()}
            disabled={isRefreshing}
            className="rounded-lg border border-white/[0.12] bg-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
          >
            Set up
          </button>
        )}
      </div>
      {error ? (
        <p className="max-w-64 text-right text-[11px] leading-4 text-red-300/90">
          {error}
        </p>
      ) : null}
    </div>
  )
}
