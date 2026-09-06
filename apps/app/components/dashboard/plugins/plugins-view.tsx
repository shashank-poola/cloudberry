import Image from "next/image"
import Link from "next/link"

type Plugin = {
  name: string
  description: string
  logo: string
  available: boolean
}

const plugins: Plugin[] = [
  {
    name: "GitHub",
    description: "Give Cloudberry context from your repositories and issues.",
    logo: "/plugins/github.png",
    available: true,
  },
  {
    name: "Slack",
    description: "Bring team conversations and channels into your workspace.",
    logo: "/plugins/slack.webp",
    available: true,
  },
  {
    name: "Linear",
    description: "Keep project updates and engineering work in context.",
    logo: "/plugins/linear.png",
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

export function PluginsView() {
  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-235 px-6 py-8 sm:px-10 lg:px-12">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
            Plugins
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            Connect the tools Cloudberry can use to keep your work in context.
          </p>
        </div>

        <article className="mt-8 flex flex-col rounded-2xl border border-white/[0.14] bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.06] font-mono text-sm text-zinc-200">
              {"</>"}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Codex</h3>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-500">
                Set up your user-authenticated Codex CLI on Cloudberry&apos;s
                company computer. Codex stays separate from the hosted models.
              </p>
            </div>
          </div>
          <Link
            href="/computer"
            className="mt-4 inline-flex shrink-0 items-center justify-center rounded-lg border border-white/[0.14] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:mt-0"
          >
            Set up Codex
          </Link>
        </article>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plugins.map((plugin) => (
            <article
              key={plugin.name}
              className="relative flex min-h-40 flex-col rounded-2xl border border-white/[0.1] bg-white/[0.025] p-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
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
                  <Image
                    src={plugin.logo}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 rounded-lg object-contain"
                  />
                </span>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {plugin.name}
                </h3>
              </div>
              <p className="mt-4 max-w-[280px] text-sm leading-5 text-zinc-500">
                {plugin.description}
              </p>
              <button
                type="button"
                className="mt-5 self-start rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {plugin.available ? "Connect" : "Unavailable"}
              </button>
            </article>
          ))}
        </div>

        <p className="mt-7 text-xs text-zinc-600">
          Available plugins connect to one focused part of your work. More
          connections are on the way.
        </p>
      </div>
    </section>
  )
}
