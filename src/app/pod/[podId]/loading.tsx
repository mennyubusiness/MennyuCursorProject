import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";

export default function PodPageLoading() {
  return (
    <div className="w-full">
      <div className="relative overflow-hidden border-b border-oo-light-stone bg-oo-charcoal">
        <PageShell className="relative z-10 py-8 sm:py-10">
          <Skeleton className="h-3 w-20 bg-oo-warm-white/20" />
          <Skeleton className="mt-3 h-10 w-2/3 max-w-md bg-oo-warm-white/20" />
          <Skeleton className="mt-4 h-5 w-full max-w-lg bg-oo-warm-white/15" />
          <Skeleton className="mt-3 h-4 w-3/5 max-w-sm bg-oo-warm-white/15" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-7 w-28 rounded-full bg-oo-warm-white/15" />
            <Skeleton className="h-7 w-24 rounded-full bg-oo-warm-white/15" />
          </div>
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-11 w-32 rounded-lg bg-brand/40" />
            <Skeleton className="h-11 w-36 rounded-lg bg-oo-warm-white/15" />
          </div>
        </PageShell>
      </div>
      <div className="border-b border-oo-light-stone bg-oo-warm-white">
        <PageShell className="flex gap-2 py-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </PageShell>
      </div>
      <PageShell className="py-8">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="mt-8 h-6 w-32" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    </div>
  );
}
