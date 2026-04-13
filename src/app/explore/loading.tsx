import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreLoading() {
  return (
    <div className="space-y-10 rounded-2xl border border-stone-300/50 bg-gradient-to-b from-stone-200/50 to-stone-100/90 px-4 py-8 sm:px-6 sm:py-10">
      <div className="overflow-hidden rounded-2xl border border-stone-300/60 bg-stone-800/90">
        <Skeleton className="h-[240px] w-full rounded-none bg-stone-700/80" />
      </div>
      <div>
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[min(17rem,72vw)] shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-md"
            >
              <Skeleton className="aspect-video w-full rounded-none bg-stone-200" />
              <div className="space-y-2 p-3.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-5 h-12 w-full max-w-lg rounded-xl" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-md"
            >
              <Skeleton className="aspect-video w-full rounded-none bg-stone-200" />
              <div className="space-y-2 p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="mt-4 h-8 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
