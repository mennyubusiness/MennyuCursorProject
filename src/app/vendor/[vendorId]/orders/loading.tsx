import { Skeleton } from "@/components/ui/skeleton";

export default function VendorOrdersLoading() {
  return (
    <div className="space-y-8">
      <div className="border-b border-stone-200 pb-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-3 h-4 max-w-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-36" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
