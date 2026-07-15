import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8" aria-busy="true" aria-label="Loading cart">
      <div className="border-b border-stone-200 pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-400 border-r-transparent"
            aria-hidden
          />
          <span>Opening your cart…</span>
        </div>
      </div>

      <div className="space-y-6">
        {[1, 2].map((s) => (
          <div key={s} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 bg-stone-50 px-4 py-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-5 w-48" />
            </div>
            <div className="divide-y divide-stone-100 px-4 py-4">
              <div className="flex gap-3 py-3">
                <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
              </div>
              <div className="flex gap-3 py-3">
                <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border-2 border-stone-200 p-6 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
