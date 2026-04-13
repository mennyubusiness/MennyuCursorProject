import { Skeleton } from "@/components/ui/skeleton";

export default function PodPageLoading() {
  return (
    <div className="space-y-10 rounded-2xl border border-stone-200/60 bg-gradient-to-b from-stone-200/40 to-stone-50/90 px-4 py-8 sm:px-6 sm:py-10">
      <div className="overflow-hidden rounded-2xl border border-stone-300/50 shadow-lg">
        <Skeleton className="h-[220px] w-full rounded-none bg-stone-700/80 sm:h-[240px]" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 max-w-md" />
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-md"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-none bg-stone-200" />
              <div className="space-y-2 p-5">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="mt-4 h-9 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
