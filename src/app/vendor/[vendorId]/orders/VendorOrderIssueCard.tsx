"use client";

import { useCallback, useEffect, useState } from "react";
import { vendorIssueStatusLabel } from "@/domain/vendor-order-issue";
import type { VendorOrderIssueRow } from "@/services/vendor-order-issue.service";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export function VendorOrderIssueCard({
  issue,
  vendorId,
  onUpdated,
  compact = false,
}: {
  issue: VendorOrderIssueRow;
  vendorId: string;
  onUpdated: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftResponse, setDraftResponse] = useState(issue.vendorResponse ?? "");

  useEffect(() => {
    setDraftResponse(issue.vendorResponse ?? "");
  }, [issue.vendorResponse]);

  const patch = useCallback(
    async (body: { action: string; vendorResponse?: string }) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/vendor/${vendorId}/order-issues/${issue.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          return;
        }
        onUpdated();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [vendorId, issue.id, onUpdated]
  );

  return (
    <div
      className={`rounded-lg border border-oo-light-stone bg-oo-warm-white text-sm shadow-sm ${
        compact ? "p-3" : "p-3"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-oo-charcoal">{issue.issueTypeLabel}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            issue.isActive ? "bg-amber-100 text-amber-950" : "bg-stone-100 text-stone-800"
          }`}
        >
          {issue.isActive ? "Open issue" : "Resolved issue"}
        </span>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-900">
          {vendorIssueStatusLabel(issue.vendorIssueStatus)}
        </span>
      </div>
      {!compact ? (
        <p className="mt-1 text-xs text-oo-stone-gray">
          Pickup {issue.pickupCode} · {formatWhen(issue.createdAt)}
          {issue.lineItemName ? ` · ${issue.lineItemName}` : ""}
        </p>
      ) : null}
      {issue.customerMessage ? (
        <p className="mt-2 rounded border border-oo-light-stone bg-white/80 px-2 py-1.5 text-sm">
          <span className="text-xs font-medium text-oo-stone-gray">Customer: </span>
          {issue.customerMessage}
        </p>
      ) : null}
      {issue.customerRefundStatus ? (
        <p className="mt-2 text-xs font-medium text-emerald-800">{issue.customerRefundStatus}</p>
      ) : null}
      {issue.vendorResponse ? (
        <p className="mt-2 rounded border border-blue-100 bg-blue-50/60 px-2 py-1.5 text-xs">
          <span className="font-medium text-blue-900">Your response: </span>
          {issue.vendorResponse}
          {issue.vendorRespondedAt ? (
            <span className="mt-1 block text-blue-800/80">{formatWhen(issue.vendorRespondedAt)}</span>
          ) : null}
        </p>
      ) : null}

      {issue.isActive ? (
        <div className="mt-3 space-y-2 border-t border-oo-light-stone pt-3">
          <label className="block text-xs font-medium text-oo-stone-gray">
            Response to Open Order (optional on acknowledge)
          </label>
          <textarea
            className="w-full min-h-[72px] rounded border border-oo-light-stone bg-white px-2 py-1.5 text-sm"
            value={draftResponse}
            onChange={(e) => setDraftResponse(e.target.value)}
            disabled={busy}
            placeholder="What did you find? Refund decisions are made by Open Order admins."
          />
          {error ? (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void patch({
                  action: "acknowledge",
                  vendorResponse: draftResponse.trim() || undefined,
                })
              }
              className="min-h-[40px] rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium hover:bg-oo-cream/80 disabled:opacity-50"
            >
              Acknowledge
            </button>
            <button
              type="button"
              disabled={busy || !draftResponse.trim()}
              onClick={() => void patch({ action: "respond", vendorResponse: draftResponse.trim() })}
              className="min-h-[40px] rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 disabled:opacity-50"
            >
              Save response
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void patch({
                  action: "mark_vendor_reviewed",
                  vendorResponse: draftResponse.trim() || undefined,
                })
              }
              className="min-h-[40px] rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Mark reviewed
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void patch({
                  action: "request_resolution",
                  vendorResponse: draftResponse.trim() || undefined,
                })
              }
              className="min-h-[40px] rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Request resolution
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
