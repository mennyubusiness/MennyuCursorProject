type RecentRequestItem = {
  id: string;
  podId: string;
  podName: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
};

function statusLabel(status: string): string {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function VendorRecentPodRequests({
  recentRequests,
}: {
  recentRequests: RecentRequestItem[];
}) {
  if (recentRequests.length === 0) {
    return null;
  }

  return (
    <details className="rounded-lg border border-oo-light-stone bg-oo-cream/40">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-oo-charcoal hover:bg-oo-cream/80">
        Recent pod activity ({recentRequests.length})
      </summary>
      <ul className="space-y-2 border-t border-oo-light-stone px-4 py-3">
        {recentRequests.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm text-oo-charcoal"
          >
            <span>
              <span className="font-medium">{r.podName}</span>
              <span className="ml-2 text-oo-stone-gray">
                {statusLabel(r.status)}
                {r.respondedAt && (
                  <span className="ml-1">
                    ·{" "}
                    {new Date(r.respondedAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </span>
            </span>
            <span className="text-xs text-oo-stone-gray">
              {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "short" })}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
