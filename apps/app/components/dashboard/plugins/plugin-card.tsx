"use client"

import Image from "next/image"
import type {
  Integration,
  IntegrationProvider,
} from "@/api/integrations/client"
import {
  statusClass,
  statusLabel,
  type Plugin,
} from "./plugin-catalog"

type PluginCardProps = {
  plugin: Plugin
  integration: Integration | undefined
  busyProvider: IntegrationProvider | null
  loading: boolean
  startsIntegrationRow: boolean
  onConnectAction: (
    provider: IntegrationProvider,
    reconnect: boolean
  ) => void
  onDisconnectAction: (provider: IntegrationProvider) => void
  onRetryAction: (provider: IntegrationProvider) => void
}

export function PluginCard({
  plugin,
  integration,
  busyProvider,
  loading,
  startsIntegrationRow,
  onConnectAction,
  onDisconnectAction,
  onRetryAction,
}: PluginCardProps) {
  const busy = plugin.provider === busyProvider
  const connected = integration?.connected === true
  const needsReconnect =
    integration?.status === "error" ||
    integration?.status === "reauthorization_required"
  const canRetry =
    integration?.status === "active" && integration.trigger_status === "error"
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
    <article
      className={`relative flex min-h-44 flex-col rounded-2xl border border-white/[0.1] bg-white/[0.025] p-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04] ${startsIntegrationRow ? "md:col-start-1" : ""}`}
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
            <span className="font-mono text-xs text-zinc-300">{"</>"}</span>
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
              {loading ? "Checking status…" : statusLabel(integration)}
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
              onDisconnectAction(plugin.provider)
            } else {
              onConnectAction(plugin.provider, needsReconnect)
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
            onClick={() => onRetryAction(plugin.provider!)}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Retry events
          </button>
        ) : null}
      </div>
    </article>
  )
}
