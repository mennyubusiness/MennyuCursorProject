"use client";

import { useMemo, useState } from "react";

import { podOwnerVendorDisplayStatus } from "@/lib/pod-vendor-adoption";
import type { PodRosterVendorRow } from "@/app/pod/[podId]/dashboard/PodVendorRosterPanel";
import { PodVendorRosterPanel } from "@/app/pod/[podId]/dashboard/PodVendorRosterPanel";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "not_ready", label: "Not ready" },
  { id: "paused", label: "Paused" },
  { id: "missing_setup", label: "Missing setup" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matchesFilter(row: PodRosterVendorRow, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "live") return row.readiness.canAcceptOrders;
  if (filter === "paused") {
    return !row.podVendorActive || row.readiness.status === "paused_in_pod" || row.mennyuOrdersPaused;
  }
  if (filter === "not_ready") {
    return !row.readiness.canAcceptOrders && row.podVendorActive;
  }
  if (filter === "missing_setup") {
    return (
      !row.readiness.canAcceptOrders &&
      row.readiness.status.startsWith("needs_")
    );
  }
  return true;
}

export function PodVendorsFilterBar({
  rows,
  podId,
  podSlug,
}: {
  rows: PodRosterVendorRow[];
  podId: string;
  podSlug: string;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesFilter(row, filter)),
    [rows, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const count =
            item.id === "all"
              ? rows.length
              : rows.filter((row) => matchesFilter(row, item.id)).length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                filter === item.id
                  ? "bg-oo-charcoal text-oo-warm-white"
                  : "bg-oo-cream text-oo-charcoal hover:bg-oo-warm-white"
              }`}
            >
              {item.label} ({count})
            </button>
          );
        })}
      </div>

      <PodVendorRosterPanel podId={podId} podSlug={podSlug} initialRows={filteredRows} />
    </div>
  );
}

export function PodVendorReadinessLegend({ rows }: { rows: PodRosterVendorRow[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.vendorId} className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2 text-sm">
          <span className="font-medium text-oo-charcoal">{row.name}</span>
          <span className="text-oo-stone-gray">
            {" "}
            — {podOwnerVendorDisplayStatus(row.readiness.status, row.readiness.canAcceptOrders)}
          </span>
        </li>
      ))}
    </ul>
  );
}
