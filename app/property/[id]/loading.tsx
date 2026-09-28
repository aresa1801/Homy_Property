export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="aspect-[16/9] w-full animate-pulse rounded-2xl bg-[#e8dfd3]" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-[#e8dfd3]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[#efe8dd]" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-[#efe8dd]" />
        </div>
        <div className="h-56 w-full animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    </div>
  )
}
