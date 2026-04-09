import { Skeleton } from "@/components/ui/skeleton";

export default function VendorMenuLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4 sm:flex-row sm:items-center"
        >
          <Skeleton className="h-16 w-16 shrink-0 rounded-lg sm:h-20 sm:w-20" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-full max-w-md" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-10 w-28 self-end sm:self-center" />
        </div>
      ))}
    </div>
  );
}
