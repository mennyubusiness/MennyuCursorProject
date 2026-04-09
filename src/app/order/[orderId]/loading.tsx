import { Skeleton } from "@/components/ui/skeleton";

export default function OrderStatusLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="rounded-2xl border-2 border-stone-200 p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-12 w-56" />
      </div>
      <div className="rounded-2xl border border-stone-200 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-16 w-full" />
        <Skeleton className="mt-4 h-20 w-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
