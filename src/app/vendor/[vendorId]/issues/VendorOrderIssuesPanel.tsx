"use client";

import { useCallback, useEffect, useState } from "react";
import type { VendorOrderIssueRow } from "@/services/vendor-order-issue.service";
import { VendorOrderIssueCard } from "../orders/VendorOrderIssueCard";

type Filter = "active" | "closed";

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
          Customer reports tied to your orders. You can also review issues from the{" "}
          <a href={`/vendor/${vendorId}/orders?filter=issues`} className="font-medium underline">
            Orders ledger
          </a>
          .
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
            <li key={issue.id}>
              <VendorOrderIssueCard issue={issue} vendorId={vendorId} onUpdated={load} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
