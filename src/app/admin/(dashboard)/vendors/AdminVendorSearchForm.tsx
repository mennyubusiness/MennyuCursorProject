"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { VENDOR_ORDER_ROUTING_MODES } from "@/lib/vendor-order-routing-mode";
import type { AdminVendorOrderingModeFilter } from "@/services/admin-vendor-detail.service";

const ROUTING_FILTER_OPTIONS: { value: "" | VendorOrderRoutingMode; label: string }[] = [
  { value: "", label: "All routing" },
  { value: "manual_dashboard", label: "Tablet" },
  { value: "deliverect", label: "Deliverect" },
  { value: "square", label: "Square" },
];

/** Kept separate from routing: this filters ordering intent, not order transport. */
const ORDERING_FILTER_OPTIONS: { value: "" | AdminVendorOrderingModeFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "orderable", label: "Orderable" },
  { value: "menu_only", label: "Menu only" },
];

function buildAdminVendorsHref(
  query: string,
  routing: "" | VendorOrderRoutingMode,
  orderingMode: "" | AdminVendorOrderingModeFilter
): string {
  const params = new URLSearchParams();
  const q = query.trim();
  if (q) params.set("q", q);
  if (routing && (VENDOR_ORDER_ROUTING_MODES as readonly string[]).includes(routing)) {
    params.set("routing", routing);
  }
  if (orderingMode) params.set("ordering", orderingMode);
  const qs = params.toString();
  return qs ? `/admin/vendors?${qs}` : "/admin/vendors";
}

export function AdminVendorSearchForm({
  initialQuery,
  initialRouting,
  initialOrderingMode,
}: {
  initialQuery: string;
  initialRouting: "" | VendorOrderRoutingMode;
  initialOrderingMode: "" | AdminVendorOrderingModeFilter;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [routing, setRouting] = useState<"" | VendorOrderRoutingMode>(initialRouting);
  const [orderingMode, setOrderingMode] = useState<"" | AdminVendorOrderingModeFilter>(
    initialOrderingMode
  );

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(buildAdminVendorsHref(query, routing, orderingMode));
      }}
    >
      <div className="min-w-[280px] flex-1">
        <label htmlFor="admin-vendor-search" className="sr-only">
          Search vendors
        </label>
        <input
          id="admin-vendor-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, slug, id, pod, owner email, Stripe or Deliverect id…"
          className="w-full rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="admin-vendor-ordering" className="mb-1 block text-xs font-medium text-oo-stone-gray">
          Ordering
        </label>
        <select
          id="admin-vendor-ordering"
          value={orderingMode}
          onChange={(e) => {
            const next = e.target.value as "" | AdminVendorOrderingModeFilter;
            setOrderingMode(next);
            router.push(buildAdminVendorsHref(query, routing, next));
          }}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-2 text-sm text-oo-charcoal"
        >
          {ORDERING_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="admin-vendor-routing" className="mb-1 block text-xs font-medium text-oo-stone-gray">
          Routing
        </label>
        <select
          id="admin-vendor-routing"
          value={routing}
          onChange={(e) => {
            const next = e.target.value as "" | VendorOrderRoutingMode;
            setRouting(next);
            router.push(buildAdminVendorsHref(query, next, orderingMode));
          }}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-2 text-sm text-oo-charcoal"
        >
          {ROUTING_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
        Search
      </button>
    </form>
  );
}
