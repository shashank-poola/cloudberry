import { useMemo, useState } from "react"
import { AiSearch02Icon, GitbookIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { CloudpediaProjectsTable } from "./cloudpedia-projects-table"
import { projects, recentDecisions, recentUpdates } from "./cloudpedia-data"

export function CloudpediaView() {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()

  const filteredUpdates = useMemo(
    () =>
      recentUpdates.filter((update) =>
        `${update.title} ${update.detail}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [normalizedQuery]
  )
  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        `${project.name} ${project.status}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [normalizedQuery]
  )
  const filteredDecisions = useMemo(
    () =>
      recentDecisions.filter((decision) =>
        `${decision.title} ${decision.project}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [normalizedQuery]
  )

  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-235 px-6 py-8 sm:px-10 lg:px-12">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-zinc-300">
            <HugeiconsIcon
              icon={GitbookIcon}
              size={21}
              color="currentColor"
              strokeWidth={1.4}
            />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
              Cloudpedia
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Your company&apos;s living context.
            </p>
          </div>
        </div>

        <label className="relative mt-8 block max-w-2xl">
          <span className="sr-only">Search Cloudpedia</span>
          <HugeiconsIcon
            icon={AiSearch02Icon}
            size={18}
            color="currentColor"
            strokeWidth={1.5}
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

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-x-12">
          <section>
            <h3 className="text-sm font-semibold text-zinc-200">
              Recently changed
            </h3>
            <div className="mt-3 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {filteredUpdates.map((update) => (
                <article
                  key={update.title}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-zinc-200">
                      {update.title}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {update.detail}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] text-zinc-600">
                    {update.age}
                  </time>
                </article>
              ))}
              {filteredUpdates.length === 0 ? (
                <p className="py-4 text-sm text-zinc-500">
                  No updates match your search.
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-zinc-200">Projects</h3>
            <div className="mt-3">
              <CloudpediaProjectsTable projects={filteredProjects} />
            </div>
          </section>
        </div>

        <section className="mt-10 max-w-2xl">
          <h3 className="text-sm font-semibold text-zinc-200">
            Recent decisions
          </h3>
          <div className="mt-3 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {filteredDecisions.map((decision) => (
              <article
                key={decision.title}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-zinc-200">
                    {decision.title}
                  </h4>
                  <p className="mt-1 text-xs text-zinc-500">
                    {decision.project}
                  </p>
                </div>
                <time className="shrink-0 text-[11px] text-zinc-600">
                  {decision.age}
                </time>
              </article>
            ))}
            {filteredDecisions.length === 0 ? (
              <p className="py-4 text-sm text-zinc-500">
                No decisions match your search.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  )
}
