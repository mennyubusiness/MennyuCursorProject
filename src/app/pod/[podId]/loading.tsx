import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";

export default function PodPageLoading() {
  return (
    <div className="w-full">
      <div className="border-b border-zinc-200 bg-white">
        <PageShell className="flex flex-col gap-5 py-5 sm:flex-row sm:py-6">
          <Skeleton className="aspect-[16/9] w-full rounded-xl sm:aspect-[5/3] sm:w-56" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-2/3 max-w-sm" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-4/5 max-w-sm" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </PageShell>
      </div>
      <div className="border-b border-zinc-200 bg-white">
        <PageShell className="flex gap-2 py-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </PageShell>
      </div>
      <PageShell className="py-8">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="mt-8 h-6 w-32" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="oo-card overflow-hidden">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-7 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    </div>
  );
}
