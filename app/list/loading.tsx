export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="h-8 w-72 animate-pulse rounded-lg bg-[#e8dfd3]" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-[#efe8dd]" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(20,42,32,.07)]">
            <div className="aspect-[1.25] w-full animate-pulse bg-[#e8dfd3]" />
            <div className="space-y-3 p-3 sm:p-5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#e8dfd3]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#efe8dd]" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-[#e8dfd3]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
