"use client";

import { useState } from "react";
import {
  legacyClawbackReviewStatusLabel,
  type LegacyClawbackReviewStatus,
} from "@/lib/legacy-clawback-review";
import type { VendorFinancialReviewKind } from "@/lib/clawback-financial-review";

function shortenId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

export function VendorClawbackReviewActions({
  vendorPayoutTransferId,
  stripeTransferId,
  needsReview,
  review,
  reviewKind = "legacy",
  compact = false,
  onComplete,
}: {
  vendorPayoutTransferId: string;
  stripeTransferId: string | null;
  needsReview: boolean;
  review: {
    status: string | null;
    note: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
  };
  reviewKind?: VendorFinancialReviewKind;
  compact?: boolean;
  onComplete: () => void;
}) {
  const [note, setNote] = useState(review.note ?? "");
  const [pendingStatus, setPendingStatus] = useState<LegacyClawbackReviewStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading =
    reviewKind === "legacy"
      ? "Legacy clawback review required"
      : "Manual financial review required";

  async function submit(status: LegacyClawbackReviewStatus) {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("An admin note is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/vendor-payout-transfers/${vendorPayoutTransferId}/legacy-clawback-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, note: trimmed }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) {
        setError(data.error ?? "Could not save review.");
        return;
      }
      setPendingStatus(null);
      onComplete();
    } finally {
      setBusy(false);
    }
  }

  if (!needsReview && review.status) {
    const label =
      reviewKind === "legacy"
        ? `Legacy clawback ${legacyClawbackReviewStatusLabel(review.status).toLowerCase()}`
        : `Manual review ${legacyClawbackReviewStatusLabel(review.status).toLowerCase()}`;
    return (
      <div
        className={`rounded border border-violet-200 bg-violet-50/80 text-violet-950 ${
          compact ? "px-2 py-1.5 text-[10px]" : "px-2.5 py-2 text-xs"
        }`}
      >
        <p className="font-semibold">
          {label}
          {review.reviewedAt ? ` · ${new Date(review.reviewedAt).toLocaleString()}` : ""}
        </p>
        {review.note ? <p className="mt-0.5 leading-snug">{review.note}</p> : null}
      </div>
    );
  }

  if (!needsReview) return null;

  const textSize = compact ? "text-[10px]" : "text-xs";

  return (
    <div
      className={`space-y-1.5 rounded border border-violet-200 bg-violet-50/80 text-violet-950 ${
        compact ? "px-2 py-2" : "px-3 py-2.5"
      } ${textSize}`}
    >
      <p className="font-semibold">{heading}</p>
      <p className="leading-snug">
        {reviewKind === "legacy"
          ? "Refund evidence is incomplete, so Open Order cannot safely prepare an automatic vendor reversal."
          : "Automatic vendor reversal is not supported for this case. Record what you verified in Stripe."}
      </p>
      {stripeTransferId ? (
        <p className="font-mono text-[9px] text-violet-900">Stripe transfer {shortenId(stripeTransferId)}</p>
      ) : null}
      {pendingStatus ? (
        <>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Admin note (required) — what you verified in Stripe"
            className={`w-full rounded border border-violet-200 bg-white px-2 py-1 text-oo-charcoal ${textSize}`}
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(pendingStatus)}
              className="rounded border border-violet-400 bg-violet-200 px-2 py-0.5 font-semibold disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingStatus(null)}
              className="rounded border border-violet-200 px-2 py-0.5"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingStatus("reviewed")}
            className="rounded border border-violet-400 bg-violet-200 px-2 py-0.5 font-semibold disabled:opacity-50"
          >
            Mark reviewed
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingStatus("deferred")}
            className="rounded border border-violet-200 bg-violet-100 px-2 py-0.5 font-semibold disabled:opacity-50"
          >
            Defer
          </button>
        </div>
      )}
      {error ? <p className="text-red-800">{error}</p> : null}
    </div>
  );
}
