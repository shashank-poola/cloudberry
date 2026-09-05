import { useEffect, useRef, useState } from "react"
import { AiSearch02Icon, FilterIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

type SearchCommandProps = {
  isOpen: boolean
  onClose: () => void
}

const filters = ["All", "Chat", "Cloudpedia", "Plugins", "Computer"]

export function SearchCommand({ isOpen, onClose }: SearchCommandProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFilter, setSelectedFilter] = useState("All")

  useEffect(() => {
    if (!isOpen) return

    inputRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm sm:px-6 sm:pt-20"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Search Cloudberry"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-white/[0.1] bg-[#181818] shadow-2xl shadow-black/40"
      >
        <div className="flex h-14 items-center gap-3 border-b border-white/[0.08] px-4">
          <HugeiconsIcon
            icon={AiSearch02Icon}
            size={20}
            color="currentColor"
            strokeWidth={1.7}
            className="shrink-0 text-zinc-400"
          />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search Cloudberry"
            aria-label="Search Cloudberry"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-zinc-400">
            ESC
          </kbd>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <HugeiconsIcon
              icon={FilterIcon}
              size={15}
              color="currentColor"
              strokeWidth={1.5}
            />
            Filter
          </span>
          {filters.map((filter) => {
            const isActive = filter === selectedFilter

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                aria-pressed={isActive}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
                  isActive
                    ? "border-white/[0.16] bg-white/[0.1] text-zinc-100"
                    : "border-transparent text-zinc-500 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-zinc-300"
                }`}
              >
                {filter}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
