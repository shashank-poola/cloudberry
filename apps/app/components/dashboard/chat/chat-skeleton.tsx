"use client"

export function ChatSkeleton() {
  return (
    <div
      className="space-y-8 py-1"
      role="status"
      aria-label="Loading conversation"
    >
      <div className="ml-auto flex w-[68%] max-w-xs flex-col gap-2 rounded-2xl rounded-br-sm border border-white/8 bg-white/4.5 px-4 py-3">
        <div className="skeleton-shimmer h-3 w-[92%] rounded-full" />
        <div className="skeleton-shimmer h-3 w-[64%] rounded-full" />
      </div>

      <div className="flex max-w-[92%] gap-3">
        <div className="skeleton-shimmer mt-1 size-5 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="skeleton-shimmer h-3 w-[94%] rounded-full" />
          <div className="skeleton-shimmer h-3 w-[82%] rounded-full" />
          <div className="skeleton-shimmer h-3 w-[58%] rounded-full" />
        </div>
      </div>

      <div className="ml-auto flex w-[48%] max-w-xs flex-col gap-2 rounded-2xl rounded-br-sm border border-white/8 bg-white/4.5 px-4 py-3">
        <div className="skeleton-shimmer h-3 w-[86%] rounded-full" />
      </div>
    </div>
  )
}
