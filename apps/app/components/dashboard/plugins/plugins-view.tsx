"use client"

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
import { PluginCard } from "./plugin-card"
import { PluginsSkeleton } from "./plugin-card-skeleton"
import { plugins, providerNames } from "./plugin-catalog"

export function PluginsView() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
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


        {error ? (
          <p
            className="mt-4 flex items-center gap-2 text-xs leading-5 text-red-200"
            role="alert"
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-red-300"
            />
            <span>{error}</span>
          </p>
        ) : null}

        {loading && integrations.length === 0 ? (
          <PluginsSkeleton />
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3">
            {plugins.map((plugin, index) => {
              const integration = plugin.provider
                ? integrationByProvider.get(plugin.provider)
                : undefined

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
                  <PluginCard
                    plugin={plugin}
                    integration={integration}
                    busyProvider={busyProvider}
                    loading={loading}
                    startsIntegrationRow={index === 1}
                    onConnectAction={(provider, reconnect) => {
                      void handleConnect(provider, reconnect)
                    }}
                    onDisconnectAction={(provider) => {
                      void handleDisconnect(provider)
                    }}
                    onRetryAction={(provider) => {
                      void handleRetry(provider)
                    }}
                  />
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
      {codexConnection ? (
        <CodexConnectModal
          connection={codexConnection}
          onCloseAction={() => setCodexConnection(null)}
          onConnectedAction={(updated) => {
            replaceIntegration(updated)
            setCodexConnection(null)
          }}
        />
      ) : null}
    </section>
  )
}
