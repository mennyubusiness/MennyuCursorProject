"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestItem = {
  id: string;
  podId: string;
  podName: string;
  createdAt: string;
};

type CurrentPod = { id: string; name: string } | null;

export function VendorPodRequests({
  vendorId,
  requests,
  currentPod,
}: {
  vendorId: string;
  requests: RequestItem[];
  currentPod: CurrentPod;
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept(requestId: string) {
    setError(null);
    setActingId(requestId);
    try {
      const res = await fetch(
        `/api/vendor/${vendorId}/membership-requests/${requestId}/accept`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to accept");
        return;
      }
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(requestId: string) {
    setError(null);
    setActingId(requestId);
    try {
      const res = await fetch(
        `/api/vendor/${vendorId}/membership-requests/${requestId}/decline`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to decline");
        return;
      }
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
        Pending pod requests
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        A pod has requested your location to join. Accept to join that pod; your menu will appear there. Declining does not change your current pod.
      </p>
      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">No pending pod requests.</p>
      ) : (
        <>
      {error && (
        <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <ul className="mt-3 space-y-3">
        {requests.map((r) => {
          const isCurrentPod = currentPod && currentPod.id === r.podId;
          const isOtherPod = currentPod && currentPod.id !== r.podId;
          const movingCopy = isOtherPod
            ? "Accepting will move your location to this pod."
            : "Accepting will add your location to this pod.";

          return (
            <li
              key={r.id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-stone-900">{r.podName}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Requested {new Date(r.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {currentPod ? (
                    <p className="mt-1 text-xs text-stone-600">
                      {isCurrentPod
                        ? "You are already in this pod."
                        : `Currently in ${currentPod.name}. ${movingCopy}`}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-stone-600">
                      Currently unassigned. {movingCopy}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(r.id)}
                    disabled={actingId !== null}
                    className="rounded bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-50"
                  >
                    {actingId === r.id ? "…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(r.id)}
                    disabled={actingId !== null}
                    className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
        </>
      )}
    </section>
  );
}
