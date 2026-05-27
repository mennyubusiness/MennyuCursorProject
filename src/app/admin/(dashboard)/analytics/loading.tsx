export default function AdminAnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-48 animate-pulse rounded bg-stone-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-oo-cream" />
      </div>
      <div className="h-10 w-64 animate-pulse rounded bg-oo-cream" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-oo-light-stone bg-oo-warm-white" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-oo-light-stone bg-oo-cream/50" />
    </div>
  );
}
