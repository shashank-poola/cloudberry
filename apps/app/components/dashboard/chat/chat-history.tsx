import { ThreadIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  CHAT_LIST_CHANGED_EVENT,
  listChats,
  type ChatConversation,
} from "@/api/chat/client"

const MAX_VISIBLE_TITLE_LENGTH = 34

function getActiveChatId(pathname: string) {
  if (!pathname.startsWith("/c/")) return null

  const value = pathname.slice(3).split("/")[0]
  if (!value) return null

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function displayTitle(chat: ChatConversation) {
  if (chat.title.length <= MAX_VISIBLE_TITLE_LENGTH) return chat.title
  return `${chat.title.slice(0, MAX_VISIBLE_TITLE_LENGTH - 1).trimEnd()}…`
}

type ChatHistoryProps = {
  isCollapsed: boolean
  onCloseMobile: () => void
}

export function ChatHistory({ isCollapsed, onCloseMobile }: ChatHistoryProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [chats, setChats] = useState<ChatConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const activeChatId = getActiveChatId(pathname)

  const refresh = useCallback((signal?: AbortSignal) => {
    setIsLoading(true)
    setHasError(false)

    return listChats(signal)
      .then((result) => setChats(result.chats))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setHasError(true)
      })
      .finally(() => {
        if (!signal?.aborted) setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const frame = window.requestAnimationFrame(() => {
      void refresh(controller.signal)
    })

    const onChatListChanged = () => {
      void refresh()
    }
    window.addEventListener(CHAT_LIST_CHANGED_EVENT, onChatListChanged)

    return () => {
      window.cancelAnimationFrame(frame)
      controller.abort()
      window.removeEventListener(CHAT_LIST_CHANGED_EVENT, onChatListChanged)
    }
  }, [pathname, refresh])

  if (isCollapsed) return null

  return (
    <section className="mt-5 min-h-0 flex-1 overflow-y-auto">
      <div className="flex h-9 items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold tracking-[-0.02em] text-zinc-100">
        <HugeiconsIcon
          icon={ThreadIcon}
          size={17}
          color="currentColor"
          strokeWidth={1.5}
          className="shrink-0 text-zinc-500"
        />
        <h2>Recent</h2>
      </div>

      {isLoading && chats.length === 0 ? (
        <div className="space-y-1 px-1" aria-label="Loading chat history">
          <div className="h-8 animate-pulse rounded-lg bg-white/4" />
          <div className="h-8 animate-pulse rounded-lg bg-white/3" />
        </div>
      ) : hasError ? (
        <button
          type="button"
          className="w-full rounded-lg px-2 py-2 text-left text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          onClick={() => void refresh()}
        >
          Chat history unavailable. Retry
        </button>
      ) : chats.length === 0 ? null : (
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-4 bottom-4 left-[20.5px] z-10 w-px bg-zinc-700/80"
          />
          <div className="space-y-0.5">
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId
              return (
                <button
                  key={chat.id}
                  type="button"
                  title={chat.title}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative z-0 flex h-8 w-full items-center gap-3 rounded-lg px-3 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
                    isActive
                      ? "bg-white/9 text-zinc-100"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                  onClick={() => {
                    router.push(`/c/${encodeURIComponent(chat.id)}`)
                    onCloseMobile()
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="relative z-20 flex size-4.25 shrink-0 items-center justify-center"
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        isActive ? "bg-zinc-300" : "bg-zinc-600"
                      }`}
                    />
                  </span>
                  <span className="min-w-0 truncate">{displayTitle(chat)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
