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
  return (
    <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
        Recent pod requests
      </h2>
      {recentRequests.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">No recent pod requests.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recentRequests.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-200 bg-white px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-stone-800">{r.podName}</span>
                <span className="ml-2 text-stone-500">
                  {statusLabel(r.status)}
                  {r.respondedAt && (
                    <span className="ml-1">
                      · {new Date(r.respondedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  )}
                </span>
              </div>
              <span className="text-xs text-stone-400">
                Requested {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
