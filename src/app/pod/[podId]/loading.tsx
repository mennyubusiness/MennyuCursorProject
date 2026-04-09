import { Skeleton } from "@/components/ui/skeleton";

export default function PodPageLoading() {
  return (
    <div className="space-y-10">
      <header className="border-b border-stone-200 pb-8">
        <Skeleton className="h-36 w-36 rounded-2xl sm:h-40 sm:w-40" />
        <Skeleton className="mt-6 h-4 w-32" />
        <Skeleton className="mt-3 h-10 max-w-lg" />
        <Skeleton className="mt-3 h-5 max-w-2xl" />
      </header>
      <div>
        <Skeleton className="h-7 w-40" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
