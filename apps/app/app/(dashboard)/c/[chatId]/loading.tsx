export default function ChatLoading() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col px-5 sm:px-8">
        <div className="min-h-0 w-full flex-1 overflow-hidden">
          <div
            className="w-full max-w-160 py-8 sm:py-10"
            aria-label="Loading conversation"
          >
            <div className="space-y-5 py-1">
              <div className="h-4 w-44 animate-pulse rounded bg-white/8" />
              <div className="h-4 w-[72%] animate-pulse rounded bg-white/6" />
              <div className="h-4 w-56 animate-pulse rounded bg-white/8" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
