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

  async function postCancelInvitation(requestId: string) {
    setError(null);
    setActingId(requestId);
    try {
      const res = await fetch(`/api/pod/${podId}/membership-requests/${requestId}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not cancel invitation");
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
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/80 p-4">
      <h2 className="text-base font-semibold text-oo-charcoal">Awaiting vendor response</h2>
      <p className="mt-1 text-sm text-oo-stone-gray">
        These invitations are waiting for the vendor to accept or decline. Only they can complete or
        reject the request. You can cancel a pending invitation if you sent it by mistake or no longer
        want them to join.
      </p>
      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-4 space-y-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <VendorLogo
                imageUrl={r.vendorImageUrl}
                vendorName={r.vendorName}
                className="h-14 w-14 shrink-0 rounded-lg"
                sizes="56px"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-oo-charcoal">{r.vendorName}</p>
                <p className="mt-0.5 text-xs text-oo-stone-gray">
                  Invitation sent{" "}
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                {r.vendorDescription ? (
                  <p
                    className={`mt-2 text-sm text-oo-stone-gray ${
                      expandedId !== r.id && r.vendorDescription.length > 160 ? "line-clamp-3" : ""
                    }`}
                  >
                    {r.vendorDescription}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-oo-stone-gray">No description</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={actingId !== null}
                    onClick={() => void postCancelInvitation(r.id)}
                    className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
                  >
                    {actingId === r.id ? "…" : "Cancel invitation"}
                  </button>
                  {r.vendorDescription && r.vendorDescription.length > 160 && (
                    <button
                      type="button"
                      className="text-sm text-oo-stone-gray underline hover:text-oo-charcoal"
                      onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                    >
                      {expandedId === r.id ? "Show less" : "Read full description"}
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs text-oo-stone-gray">
                  After they join, customers can open their menu from your pod; use{" "}
                  <span className="text-oo-stone-gray">More → View vendor page</span> on the roster.
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
