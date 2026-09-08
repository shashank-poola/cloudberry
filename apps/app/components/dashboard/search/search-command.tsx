import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconAdjustmentsHorizontal,
  IconSearch,
} from "@tabler/icons-react"
import { getApiErrorMessage } from "@/api/client"
import { searchChats, type ChatSearchResult } from "@/api/chat/client"

const filters = ["All", "Chat", "Cloudpedia", "Plugins", "Computer"] as const
type SearchFilter = (typeof filters)[number]

type NavigationResult = {
  category: Exclude<SearchFilter, "All" | "Chat">
  title: string
  description: string
  href: string
  keywords: string
}

const navigationResults: NavigationResult[] = [
  {
    category: "Cloudpedia",
    title: "Cloudpedia",
    description: "Browse your workspace knowledge.",
    href: "/cloudpedia",
    keywords: "knowledge documents company wiki",
  },
  {
    category: "Plugins",
    title: "Plugins",
    description: "Manage connected tools and model access.",
    href: "/integrations",
    keywords: "integrations slack linear github codex",
  },
  {
    category: "Computer",
    title: "Cloud computer",
    description: "View and set up your managed workspace.",
    href: "/computer",
    keywords: "vm virtual machine sandbox workspace",
  },
]

type SearchCommandProps = {
  isOpen: boolean
  onClose: () => void
}

function matchesNavigation(
  result: NavigationResult,
  filter: SearchFilter,
  query: string
) {
  if (filter !== "All" && filter !== result.category) return false
  const term = query.toLowerCase()
  return [result.title, result.description, result.keywords]
    .join(" ")
    .toLowerCase()
    .includes(term)
}

export function SearchCommand({ isOpen, onClose }: SearchCommandProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<SearchFilter>("All")
  const [chatResults, setChatResults] = useState<ChatSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const trimmedQuery = query.trim()
  const searchesChats = selectedFilter === "All" || selectedFilter === "Chat"
  const matchingNavigation = trimmedQuery
    ? navigationResults.filter((result) =>
        matchesNavigation(result, selectedFilter, trimmedQuery)
      )
    : []

  useEffect(() => {
    if (!isOpen) return

    inputRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !trimmedQuery || !searchesChats) {
      const reset = window.setTimeout(() => {
        setChatResults([])
        setIsSearching(false)
        setSearchError(null)
      }, 0)
      return () => window.clearTimeout(reset)
    }

    const controller = new AbortController()
    const request = window.setTimeout(() => {
      setIsSearching(true)
      setSearchError(null)

      void searchChats(trimmedQuery, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setChatResults(result.results)
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          setChatResults([])
          setSearchError(getApiErrorMessage(error))
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false)
        })
    }, 250)

    return () => {
      window.clearTimeout(request)
      controller.abort()
    }
  }, [isOpen, searchesChats, trimmedQuery])

  function openChat(result: ChatSearchResult) {
    router.push(`/c/${encodeURIComponent(result.chatId)}`)
    onClose()
  }

  function openNavigation(result: NavigationResult) {
    router.push(result.href)
    onClose()
  }

  if (!isOpen) return null

  const hasResults = chatResults.length > 0 || matchingNavigation.length > 0

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
        className="w-full max-w-xl overflow-hidden rounded-lg border border-white/10 bg-[#181818] shadow-2xl shadow-black/40"
      >
        <div className="flex h-14 items-center gap-3 border-b border-white/8 px-4">
          <IconSearch
            size={20}
            stroke={2}
            aria-hidden="true"
            className="shrink-0 text-zinc-400"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations and workspace"
            aria-label="Search Cloudberry"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded-md border border-white/10 bg-white/4 px-2 py-1 text-[10px] font-medium text-zinc-400">
            ESC
          </kbd>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
          <span className="mr-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <IconAdjustmentsHorizontal
              size={15}
              stroke={2}
              aria-hidden="true"
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
                    ? "border-white/16 bg-white/10 text-zinc-100"
                    : "border-transparent text-zinc-500 hover:border-white/8 hover:bg-white/5 hover:text-zinc-300"
                }`}
              >
                {filter}
              </button>
            )
          })}
        </div>

        <div className="max-h-[min(52dvh,28rem)] overflow-y-auto p-2">
          {!trimmedQuery ? (
            <p className="px-3 py-7 text-center text-sm text-zinc-500">
              Search chat titles, messages, and workspace pages.
            </p>
          ) : (
            <>
              {searchesChats && chatResults.length > 0 ? (
                <div className="pb-2">
                  <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                    Conversations
                  </p>
                  {chatResults.map((result) => (
                    <button
                      key={`${result.chatId}:${result.messageId ?? "title"}`}
                      type="button"
                      onClick={() => openChat(result)}
                      className="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-zinc-200">
                          {result.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {result.matchType === "title" ? "Title" : "Message"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                        {result.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              {matchingNavigation.length > 0 ? (
                <div className="pb-2">
                  <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                    Workspace
                  </p>
                  {matchingNavigation.map((result) => (
                    <button
                      key={result.href}
                      type="button"
                      onClick={() => openNavigation(result)}
                      className="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                    >
                      <p className="text-sm font-medium text-zinc-200">
                        {result.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {result.description}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              {isSearching ? (
                <p className="px-3 py-7 text-center text-sm text-zinc-500">
                  Searching conversations…
                </p>
              ) : null}
              {searchError ? (
                <p className="px-3 py-7 text-center text-sm text-red-300/90">
                  {searchError}
                </p>
              ) : null}
              {!isSearching && !searchError && !hasResults ? (
                <p className="px-3 py-7 text-center text-sm text-zinc-500">
                  No results for “{trimmedQuery}”.
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
