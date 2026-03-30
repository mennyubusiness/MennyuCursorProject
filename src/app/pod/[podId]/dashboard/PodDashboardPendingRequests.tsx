"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VendorLogo } from "@/components/images/VendorLogo";

export type PendingRequestRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorDescription: string | null;
  vendorImageUrl: string | null;
  createdAt: string;
};

export function PodDashboardPendingRequests({
  podId,
  requests,
}: {
  podId: string;
  requests: PendingRequestRow[];
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function postAccept(requestId: string) {
    setError(null);
    setActingId(requestId);
    try {
      const res = await fetch(`/api/pod/${podId}/membership-requests/${requestId}/accept`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not accept");
        return;
      }
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  async function postDecline(requestId: string) {
    setError(null);
    setActingId(requestId);
    try {
      const res = await fetch(`/api/pod/${podId}/membership-requests/${requestId}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not decline");
        return;
      }
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border-2 border-amber-200/80 bg-amber-50/40 p-4">
      <h2 className="text-base font-semibold text-stone-900">Pending vendor requests</h2>
      <p className="mt-1 text-sm text-stone-600">
        Accept to add the vendor to this pod, or decline to withdraw the invitation.
      </p>
      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-4 space-y-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <VendorLogo
                imageUrl={r.vendorImageUrl}
                vendorName={r.vendorName}
                className="h-14 w-14 shrink-0 rounded-lg"
                sizes="56px"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-900">{r.vendorName}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Requested{" "}
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                {r.vendorDescription ? (
                  <p
                    className={`mt-2 text-sm text-stone-600 ${
                      expandedId !== r.id && r.vendorDescription.length > 160 ? "line-clamp-3" : ""
                    }`}
                  >
                    {r.vendorDescription}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-stone-400">No description</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={actingId !== null}
                    onClick={() => void postAccept(r.id)}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                  >
                    {actingId === r.id ? "…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    disabled={actingId !== null}
                    onClick={() => void postDecline(r.id)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  {r.vendorDescription && r.vendorDescription.length > 160 && (
                    <button
                      type="button"
                      className="text-sm text-stone-600 underline hover:text-stone-900"
                      onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                    >
                      {expandedId === r.id ? "Show less" : "Read full description"}
                    </button>
                  )}
                  <p className="w-full text-xs text-stone-400">
                    Customer menu preview is available after they join — use{" "}
                    <span className="text-stone-600">More → View vendor page</span> on the roster.
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
