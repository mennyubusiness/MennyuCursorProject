"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PendingRequestItem = {
  id: string;
  vendorName: string;
  createdAt: string;
};

export function PodDashboardPendingRequests({
  podId,
  requests,
}: {
  podId: string;
  requests: PendingRequestItem[];
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(requestId: string) {
    setError(null);
    setActingId(requestId);
    try {
      const res = await fetch(
        `/api/pod/${podId}/membership-requests/${requestId}/cancel`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to cancel");
        return;
      }
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  return (
    <section>
      <h2 className="mb-3 font-medium text-stone-800">Pending vendor requests</h2>
      <p className="mb-2 text-sm text-stone-600">Awaiting vendor approval.</p>
      {requests.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
          No pending vendor requests.
        </p>
      ) : (
        <>
          {error && (
            <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <ul className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div>
                  <span className="font-medium text-stone-800">{r.vendorName}</span>
                  <span className="ml-2 text-stone-500">
                    Requested{" "}
                    {new Date(r.createdAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  disabled={actingId !== null}
                  className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                >
                  {actingId === r.id ? "…" : "Cancel request"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
