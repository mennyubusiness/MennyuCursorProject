"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardCard } from "@/components/dashboard";
import type { VendorPendingPodInviteView } from "@/lib/vendor-pending-pod-invites.server";

type CurrentPod = { id: string; name: string } | null;

export function VendorPodInvitesSidebar({
  vendorId,
  requests,
  currentPod,
  hasPodMembership,
}: {
  vendorId: string;
  requests: VendorPendingPodInviteView[];
  currentPod: CurrentPod;
  hasPodMembership: boolean;
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPending = requests.length > 0;
  const introCopy = hasPending
    ? hasPodMembership
      ? "These invites are optional. Your current pod connection is already active."
      : "Accept an invite to add this vendor to a pod."
    : "No pending pod invites.";

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
    <section id="pod-invites" className="scroll-mt-24">
      <DashboardCard
        className={
          hasPending && !hasPodMembership
            ? "border-amber-200/80 bg-amber-50/40"
            : undefined
        }
      >
      <h2 className="text-base font-semibold text-oo-charcoal">Pod invites</h2>
      <p className="mt-1 text-sm text-oo-stone-gray">{introCopy}</p>

      {error ? (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {hasPending ? (
        <ul className="mt-4 space-y-3">
          {requests.map((r) => {
            const isCurrentPod = currentPod && currentPod.id === r.podId;
            const detailCopy = currentPod
              ? isCurrentPod
                ? "You are already in this pod."
                : `Currently in ${currentPod.name}. Accepting will move your location to this pod.`
              : "Accepting will add your location to this pod.";

            return (
              <li
                key={r.id}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-3"
              >
                <p className="font-medium text-oo-charcoal">{r.podName}</p>
                <p className="mt-0.5 text-xs text-oo-stone-gray">
                  {r.status} · Invited{" "}
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                {r.invitedEmail ? (
                  <p className="mt-0.5 text-xs text-oo-stone-gray">{r.invitedEmail}</p>
                ) : null}
                <p className="mt-1 text-xs text-oo-stone-gray">{detailCopy}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(r.id)}
                    disabled={actingId !== null}
                    className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    {actingId === r.id ? "…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(r.id)}
                    disabled={actingId !== null}
                    className="rounded border border-oo-light-stone px-3 py-1.5 text-sm text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      </DashboardCard>
    </section>
  );
}
