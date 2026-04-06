import { Skeleton } from "@/components/ui/skeleton"

/** 路由切换 / Suspense 共用占位，避免白屏 */
export function PageLoadingSkeleton() {
  return (
    <div
      className="flex min-h-[50vh] flex-col gap-4 p-6"
      aria-busy
      aria-label="loading"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 flex-1 min-w-[120px]" />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg sm:col-span-2 lg:col-span-1" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}
