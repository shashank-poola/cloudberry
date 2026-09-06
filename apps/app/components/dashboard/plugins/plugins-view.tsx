"use client"

import Image from "next/image"
import { Fragment, useEffect, useMemo, useState } from "react"
import { getApiErrorMessage } from "@/api/client"
import {
  disconnectIntegration,
  getIntegrations,
  reconnectIntegration,
  retryIntegration,
  startIntegration,
  type CodexConnectionStart,
  type Integration,
  type IntegrationProvider,
} from "@/api/integrations/client"
import { CodexConnectModal } from "./codex-connect-modal"

type Plugin = {
  provider?: IntegrationProvider
  name: string
  description: string
  logo?: string
  available: boolean
}

const plugins: Plugin[] = [
  {
    provider: "codex",
    name: "Codex",
    description: "Connect your OpenAI Codex account to this workspace.",
    logo: "/plugins/codex.png",
    available: true,
  },
  {
    provider: "github",
    name: "GitHub",
    description: "Give Cloudberry context from your repositories and issues.",
    logo: "/plugins/github.png",
    available: true,
  },
  {
    provider: "slack",
    name: "Slack",
    description: "Bring team conversations and channels into your workspace.",
    logo: "/plugins/slack.webp",
    available: true,
  },
  {
    provider: "linear",
    name: "Linear",
    description: "Keep project updates and engineering work in context.",
    logo: "/plugins/linear.webp",
    available: true,
  },
  {
    name: "Granola",
    description: "Make meeting notes available to your company brain.",
    logo: "/plugins/granola.webp",
    available: false,
  },
  {
    name: "Notion",
    description: "Connect your docs and workspace knowledge.",
    logo: "/plugins/notion.png",
    available: false,
  },
  {
    name: "Gmail",
    description: "Find and act on the inbox context you care about.",
    logo: "/plugins/gmail.webp",
    available: false,
  },
]

const providerNames: Record<IntegrationProvider, string> = {
  codex: "Codex",
  github: "GitHub",
  slack: "Slack",
  linear: "Linear",
}

function statusLabel(integration: Integration | undefined) {
  if (!integration || integration.status === "not_connected") {
    return "Not connected"
  }

  if (integration.status === "disabled") return "Disconnected"
  if (integration.status === "reauthorization_required") {
    return "Authorization required"
  }
  if (integration.status === "error") return "Needs attention"
  if (integration.provider === "codex") return "Connected"
  if (integration.trigger_status === "active") return "Connected"
  if (integration.trigger_status === "error") {
    return "Connected · events paused"
  }
  if (integration.trigger_status === "not_configured") {
    return "Connected · events not configured"
  }
  return "Connected · events pending"
}

function statusClass(integration: Integration | undefined) {
  if (!integration || integration.status === "not_connected") {
    return "bg-zinc-600"
  }
  if (
    integration.status === "active" &&
    (integration.provider === "codex" ||
      integration.trigger_status === "active")
  ) {
    return "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]"
  }
  if (integration.status === "disabled") return "bg-zinc-500"
  return "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]"
}

export function PluginsView() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [codexConnection, setCodexConnection] =
    useState<CodexConnectionStart | null>(null)

  const integrationByProvider = useMemo(
    () =>
      new Map(
        integrations.map((integration) => [integration.provider, integration])
      ),
    [integrations]
  )

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search)
      const provider = params.get("integration") as IntegrationProvider | null
      const status = params.get("status")

      if (
        provider &&
        provider in providerNames &&
        (status === "success" || status === "error")
      ) {
        const name = providerNames[provider]
        setNotice(
          status === "success"
            ? `${name} is now connected to Cloudberry.`
            : `${name} could not be connected. Try again from this page.`
        )
        window.history.replaceState({}, "", "/integrations")
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void getIntegrations(controller.signal)
      .then(setIntegrations)
      .catch((caughtError) => {
        if (controller.signal.aborted) return
        setError(getApiErrorMessage(caughtError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  function replaceIntegration(updated: Integration) {
    setIntegrations((current) => {
      const found = current.some((entry) => entry.provider === updated.provider)
      return found
        ? current.map((entry) =>
            entry.provider === updated.provider ? updated : entry
          )
        : [...current, updated]
    })
  }

  async function handleConnect(
    provider: IntegrationProvider,
    reconnect = false
  ) {
    setBusyProvider(provider)
    setError(null)
    setNotice(null)

    try {
      const result = reconnect
        ? await reconnectIntegration(provider)
        : await startIntegration(provider)
      if (result.provider === "codex") {
        setCodexConnection(result)
        setBusyProvider(null)
      } else {
        window.location.assign(result.redirect_url)
      }
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError))
      setBusyProvider(null)
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get("connect") !== "codex") return
      window.history.replaceState({}, "", "/integrations")
      void handleConnect("codex")
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  async function handleRetry(provider: IntegrationProvider) {
    setBusyProvider(provider)
    setError(null)
    setNotice(null)

    try {
      replaceIntegration(await retryIntegration(provider))
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError))
    } finally {
      setBusyProvider(null)
    }
  }

  async function handleDisconnect(provider: IntegrationProvider) {
    if (
      !window.confirm(
        `Disconnect ${providerNames[provider]} from this Cloudberry workspace?`
      )
    ) {
      return
    }

    setBusyProvider(provider)
    setError(null)
    setNotice(null)

    try {
      replaceIntegration(await disconnectIntegration(provider))
    } catch (caughtError) {
      setError(getApiErrorMessage(caughtError))
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-235 px-6 py-8 sm:px-10 lg:px-12">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
            Plugins
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-6 text-zinc-500">
            Bring your work tools together so Cloudberry can use the right
            context.
          </p>
        </div>

        {notice ? (
          <div
            className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-3 text-sm text-emerald-200"
            role="status"
          >
            {notice}
          </div>
        ) : null}
        {error ? (
          <div
            className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3">
          {plugins.map((plugin, index) => {
            const integration = plugin.provider
              ? integrationByProvider.get(plugin.provider)
              : undefined
            const busy = plugin.provider === busyProvider
            const connected = integration?.connected === true
            const needsReconnect =
              integration?.status === "error" ||
              integration?.status === "reauthorization_required"
            const canRetry =
              integration?.status === "active" &&
              integration.trigger_status === "error"
            const actionLabel = !plugin.available
              ? "Unavailable"
              : busy
                ? "Working…"
                : connected && !needsReconnect
                  ? "Disconnect"
                  : needsReconnect
                    ? "Reconnect"
                    : "Connect"

            return (
              <Fragment key={plugin.name}>
                {index === 0 ? (
                  <h3 className="col-span-full text-[15px] font-semibold tracking-[-0.02em] text-zinc-100">
                    Models
                  </h3>
                ) : null}
                {index === 1 ? (
                  <h3 className="col-span-full mt-6 text-[15px] font-semibold tracking-[-0.02em] text-zinc-100">
                    Integrations
                  </h3>
                ) : null}
                <article
                  className={`relative flex min-h-44 flex-col rounded-2xl border border-white/[0.1] bg-white/[0.025] p-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04] ${index === 1 ? "md:col-start-1" : ""}`}
                >
                  {!plugin.available ? (
                    <span
                      aria-label={`${plugin.name} is not available yet`}
                      title="Not available yet"
                      className="absolute top-3 right-3 size-2 rounded-full bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]"
                    />
                  ) : null}
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05]">
                      {plugin.logo ? (
                        <Image
                          src={plugin.logo}
                          alt=""
                          width={28}
                          height={28}
                          className="size-7 rounded-lg object-contain"
                        />
                      ) : (
                        <span className="font-mono text-xs text-zinc-300">
                          {"</>"}
                        </span>
                      )}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {plugin.name}
                      </h3>
                      {plugin.available ? (
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <span
                            aria-hidden="true"
                            className={`size-1.5 rounded-full ${statusClass(integration)}`}
                          />
                          {loading
                            ? "Checking status…"
                            : statusLabel(integration)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-4 max-w-[280px] text-sm leading-5 text-zinc-500">
                    {plugin.description}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                    <button
                      type="button"
                      disabled={!plugin.available || busy || loading}
                      onClick={() => {
                        if (!plugin.provider) return
                        if (connected && !needsReconnect) {
                          void handleDisconnect(plugin.provider)
                        } else {
                          void handleConnect(plugin.provider, needsReconnect)
                        }
                      }}
                      className="rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {actionLabel}
                    </button>
                    {canRetry && plugin.provider ? (
                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => void handleRetry(plugin.provider!)}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Retry events
                      </button>
                    ) : null}
                  </div>
                </article>
              </Fragment>
            )
          })}
        </div>
      </div>
      {codexConnection ? (
        <CodexConnectModal
          connection={codexConnection}
          onClose={() => setCodexConnection(null)}
          onConnected={(updated) => {
            replaceIntegration(updated)
            setNotice("Codex is now connected to Cloudberry.")
            setCodexConnection(null)
          }}
        />
      ) : null}
    </section>
  )
}
