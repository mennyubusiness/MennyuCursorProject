"use client";

import { useCallback, useEffect, useState } from "react";
import { vendorIssueStatusLabel } from "@/domain/vendor-order-issue";
import type { VendorOrderIssueRow } from "@/services/vendor-order-issue.service";

type Filter = "active" | "closed";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  );
}

function IssueCard({
  issue,
  vendorId,
  onUpdated,
}: {
  issue: VendorOrderIssueRow;
  vendorId: string;
  onUpdated: () => void;
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
    <li className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-oo-charcoal">{issue.issueTypeLabel}</span>
        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-800">
          {issue.status}
        </span>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-900">
          {vendorIssueStatusLabel(issue.vendorIssueStatus)}
        </span>
      </div>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Pickup {issue.pickupCode} · {formatWhen(issue.createdAt)}
        {issue.lineItemName && ` · ${issue.lineItemName}`}
      </p>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Vendor order: {issue.vendorOrderFulfillmentStatus} / {issue.vendorOrderRoutingStatus}
      </p>
      {issue.customerMessage && (
        <p className="mt-2 rounded border border-oo-light-stone bg-white/80 px-2 py-1.5">
          <span className="text-xs font-medium text-oo-stone-gray">Customer: </span>
          {issue.customerMessage}
        </p>
      )}
      {issue.customerRefundStatus && (
        <p className="mt-2 text-xs font-medium text-emerald-800">{issue.customerRefundStatus}</p>
      )}
      {issue.vendorResponse && (
        <p className="mt-2 rounded border border-blue-100 bg-blue-50/60 px-2 py-1.5 text-xs">
          <span className="font-medium text-blue-900">Your response: </span>
          {issue.vendorResponse}
          {issue.vendorRespondedAt && (
            <span className="mt-1 block text-blue-800/80">{formatWhen(issue.vendorRespondedAt)}</span>
          )}
        </p>
      )}

      {issue.isActive && (
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
          {error && (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
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
              className="rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium hover:bg-oo-cream/80 disabled:opacity-50"
            >
              Acknowledge
            </button>
            <button
              type="button"
              disabled={busy || !draftResponse.trim()}
              onClick={() => void patch({ action: "respond", vendorResponse: draftResponse.trim() })}
              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 disabled:opacity-50"
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
              className="rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
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
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Request resolution
            </button>
          </div>
          <p className="text-[11px] text-oo-stone-gray">
            You cannot issue refunds from here. Open Order admins handle refunds and final resolution.
          </p>
        </div>
      )}
    </li>
  );
}

export function VendorOrderIssuesPanel({ vendorId }: { vendorId: string }) {
  const [filter, setFilter] = useState<Filter>("active");
  const [issues, setIssues] = useState<VendorOrderIssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/vendor/${vendorId}/order-issues?filter=${filter}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error ?? `Failed to load (${res.status})`);
        setIssues([]);
        return;
      }
      setIssues(data.issues ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Order issues</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Customer reports tied to your orders. Respond here — refunds are handled by Open Order.
        </p>
      </div>

      <div className="flex gap-2">
        {(["active", "closed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-md bg-oo-charcoal px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium"
            }
          >
            {f === "active" ? "Active" : "Resolved / closed"}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-oo-stone-gray">Loading…</p>}
      {loadError && (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900" role="alert">
          {loadError}
        </p>
      )}
      {!loading && !loadError && issues.length === 0 && (
        <p className="text-sm text-oo-stone-gray">
          {filter === "active" ? "No active customer issues." : "No closed issues."}
        </p>
      )}
      {!loading && issues.length > 0 && (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} vendorId={vendorId} onUpdated={load} />
          ))}
        </ul>
      )}
    </section>
  );
}
