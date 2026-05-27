import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";

export default function VendorMenuLoading() {
  return (
    <div className="w-full">
      <div className="border-b border-zinc-200 bg-white">
        <PageShell className="flex gap-4 py-5">
          <Skeleton className="h-16 w-16 shrink-0 rounded-xl sm:h-20 sm:w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </PageShell>
      </div>
      <PageShell className="py-6">
        <div className="flex gap-8">
          <div className="hidden w-44 space-y-2 lg:block">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="oo-card overflow-hidden">
                <Skeleton className="aspect-[16/9] w-full rounded-none" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-7 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="hidden h-80 w-72 shrink-0 rounded-xl xl:block" />
        </div>
      </PageShell>
    </div>
  );
}
