"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { IconBook2, IconSearch } from "@tabler/icons-react"
import { getApiErrorMessage } from "@/api/client"
import {
  getCloudpedia,
  type CloudpediaData,
  type CloudpediaDecision,
  type CloudpediaUpdate,
} from "@/api/cloudpedia/client"
import { CloudpediaProjectsTable } from "./cloudpedia-projects-table"

const formatAge = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"

  const difference = Date.now() - date.getTime()
  const absoluteSeconds = Math.max(0, Math.floor(Math.abs(difference) / 1_000))
  const suffix = difference >= 0 ? "ago" : "from now"
  if (absoluteSeconds < 60) return "Just now"

  const minutes = Math.floor(absoluteSeconds / 60)
  if (minutes < 60) return `${minutes}m ${suffix}`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${suffix}`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ${suffix}`

  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

const sourceLabel = (source: string) =>
  source
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ") || "Company"

const matches = (value: string, query: string) =>
  value.toLowerCase().includes(query)

function UpdateRow({ update }: { update: CloudpediaUpdate }) {
  return (
    <article className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <h4 className="text-sm font-medium text-zinc-200">{update.title}</h4>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{update.detail}</p>
        <p className="mt-2 text-[11px] text-zinc-600">
          {sourceLabel(update.source)} · {sourceLabel(update.eventType)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <time
          dateTime={update.occurredAt}
          className="text-[11px] text-zinc-600"
        >
          {formatAge(update.occurredAt)}
        </time>
        {update.externalUrl ? (
          <a
            href={update.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-200"
          >
            Open source
          </a>
        ) : null}
      </div>
    </article>
  )
}

function DecisionRow({ decision }: { decision: CloudpediaDecision }) {
  return (
    <article className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <h4 className="text-sm font-medium text-zinc-200">{decision.title}</h4>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          {decision.detail}
        </p>
        <p className="mt-2 text-[11px] text-zinc-600">
          {decision.project ? `${decision.project} · ` : ""}
          {sourceLabel(decision.source)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <time
          dateTime={decision.occurredAt}
          className="text-[11px] text-zinc-600"
        >
          {formatAge(decision.occurredAt)}
        </time>
        {decision.externalUrl ? (
          <a
            href={decision.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-200"
          >
            Open source
          </a>
        ) : null}
      </div>
    </article>
  )
}

function LoadingRows() {
  return (
    <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
      {["w-44", "w-64", "w-52"].map((width) => (
        <div key={width} className="space-y-2 py-5">
          <div className={`skeleton-shimmer h-4 ${width} rounded bg-white/8`} />
          <div className="skeleton-shimmer h-3 w-3/4 rounded bg-white/6" />
        </div>
      ))}
    </div>
  )
}

export function CloudpediaView() {
  const [query, setQuery] = useState("")
  const [data, setData] = useState<CloudpediaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const normalizedQuery = query.trim().toLowerCase()

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      setData(await getCloudpedia(signal))
    } catch (caughtError) {
      if (signal?.aborted) return
      setError(getApiErrorMessage(caughtError))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const frame = window.requestAnimationFrame(() => {
      void load(controller.signal)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      controller.abort()
    }
  }, [load])

  const filteredUpdates = useMemo(() => {
    if (!data) return []
    return data.updates.filter((update) =>
      matches(
        `${update.title} ${update.detail} ${update.source} ${update.eventType}`,
        normalizedQuery
      )
    )
  }, [data, normalizedQuery])

  const filteredProjects = useMemo(() => {
    if (!data) return []
    return data.projects.filter((project) =>
      matches(`${project.name} ${project.status}`, normalizedQuery)
    )
  }, [data, normalizedQuery])

  const filteredDecisions = useMemo(() => {
    if (!data) return []
    return data.decisions.filter((decision) =>
      matches(
        `${decision.title} ${decision.detail} ${decision.project ?? ""} ${decision.source}`,
        normalizedQuery
      )
    )
  }, [data, normalizedQuery])

  const hasKnowledge = Boolean(
    data &&
    (data.updates.length > 0 ||
      data.projects.length > 0 ||
      data.decisions.length > 0)
  )

  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-235 px-6 py-8 sm:px-10 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-zinc-300">
            <IconBook2 size={21} stroke={2} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
              Cloudpedia
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Your company&apos;s living context.
              {data ? ` Updated ${formatAge(data.generatedAt)}.` : ""}
            </p>
          </div>
        </div>

        <label className="relative mt-8 block max-w-2xl">
          <span className="sr-only">Search Cloudpedia</span>
          <IconSearch
            size={18}
            stroke={2}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Cloudpedia..."
            className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.035] px-10 text-sm text-zinc-100 transition-colors outline-none placeholder:text-zinc-600 focus:border-white/[0.22]"
          />
        </label>

        {error ? (
          <div
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-red-300/20 px-3 py-1.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-300/10 disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? "Retrying…" : "Retry"}
            </button>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="mt-10" aria-label="Loading Cloudpedia">
            <LoadingRows />
          </div>
        ) : !hasKnowledge && !loading ? (
          <div className="mt-10 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.025] px-6 py-12 text-center">
            <h3 className="text-sm font-semibold text-zinc-200">
              No company knowledge yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Connect Slack, Linear, or GitHub in Plugins. New events will
              appear here after they are delivered and processed.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-x-12">
              <section>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Recently changed
                </h3>
                <div className="mt-3 divide-y divide-white/[0.08] border-y border-white/[0.08]">
                  {filteredUpdates.map((update) => (
                    <UpdateRow key={update.id} update={update} />
                  ))}
                  {filteredUpdates.length === 0 ? (
                    <p className="py-4 text-sm text-zinc-500">
                      No updates match your search.
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Projects
                </h3>
                <div className="mt-3">
                  <CloudpediaProjectsTable
                    projects={filteredProjects}
                    emptyMessage={
                      normalizedQuery
                        ? "No projects match your search."
                        : "No project context has been inferred yet."
                    }
                  />
                </div>
              </section>
            </div>

            <section className="mt-10 max-w-2xl">
              <h3 className="text-sm font-semibold text-zinc-200">
                Recent decisions
              </h3>
              <div className="mt-3 divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {filteredDecisions.map((decision) => (
                  <DecisionRow key={decision.subjectKey} decision={decision} />
                ))}
                {filteredDecisions.length === 0 ? (
                  <p className="py-4 text-sm text-zinc-500">
                    No decisions match your search.
                  </p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </section>
  )
}
