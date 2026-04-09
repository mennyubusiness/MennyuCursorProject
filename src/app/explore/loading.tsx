import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreLoading() {
  return (
    <div>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-4 max-w-md" />
      <Skeleton className="mt-6 h-10 max-w-md rounded-lg" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
          >
            <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="mt-3 h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
