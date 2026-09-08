export function PluginCardSkeleton() {
  return (
    <article className="flex min-h-44 flex-col rounded-2xl border border-white/10 bg-white/2.5 p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer size-9 rounded-xl" />
        <div className="min-w-0 space-y-2">
          <div className="skeleton-shimmer h-4 w-20 rounded-full" />
          <div className="skeleton-shimmer h-3 w-24 rounded-full" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="skeleton-shimmer h-3 w-full max-w-[16rem] rounded-full" />
        <div className="skeleton-shimmer h-3 w-4/5 max-w-52 rounded-full" />
      </div>
      <div className="mt-auto pt-5">
        <div className="skeleton-shimmer h-8 w-20 rounded-lg" />
      </div>
    </article>
  )
}

export function PluginsSkeleton() {
  return (
    <div
      className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3"
      role="status"
      aria-label="Loading plugins"
    >
      <div className="col-span-full">
        <div className="skeleton-shimmer h-4 w-16 rounded-full" />
      </div>
      <PluginCardSkeleton />
      <div className="col-span-full mt-6">
        <div className="skeleton-shimmer h-4 w-24 rounded-full" />
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <PluginCardSkeleton key={index} />
      ))}
    </div>
  )
}
