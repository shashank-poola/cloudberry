import { TerminalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerStatus } from "./computer-status"

export function ComputerView() {
  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-10 lg:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
              Cloud computer
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              A managed workspace for Cloudberry workflows.
            </p>
          </div>
          <ComputerStatus />
        </div>

        <div className="mt-8 flex min-h-100 flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/2 px-6 py-10 text-center sm:min-h-112">
          <span className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-[#141414] text-zinc-400">
            <HugeiconsIcon
              icon={TerminalIcon}
              size={24}
              color="currentColor"
              strokeWidth={1.4}
            />
          </span>
          <h3 className="mt-5 text-base font-semibold text-zinc-100">
            Managed workspace
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Run Cloudberry workflows in a persistent Linux environment. Your
            connected tools and computer access are managed separately.
          </p>

          <div className="mt-6 w-full max-w-md rounded-lg border border-white/10 bg-[#101010] px-5 py-4 text-left font-mono text-xs leading-6">
            <p className="text-zinc-600"># your workspace, your workflows</p>
            <p className="text-zinc-300">
              <span className="text-emerald-400">$</span> cloudberry
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
