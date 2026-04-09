import { Skeleton } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="border-b border-stone-200 pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
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
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border-2 border-stone-200 p-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-10 w-full" />
      </div>
    </div>
  );
}
