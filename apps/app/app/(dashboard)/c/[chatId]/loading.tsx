import { ChatSkeleton } from "@/components/dashboard/chat/chat-skeleton"

export default function ChatLoading() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col px-5 sm:px-8">
        <div className="min-h-0 w-full flex-1 overflow-hidden">
          <div
            className="w-full max-w-160 py-8 pb-48 sm:py-10 sm:pb-52"
          >
            <ChatSkeleton />
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-5 h-44 bg-[#0b0b0b]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        >
          <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
            <div className="mx-auto max-w-160 pb-8 sm:pb-10">
              <div className="skeleton-shimmer h-29.5 rounded-2xl border border-white/8 bg-white/3.5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
