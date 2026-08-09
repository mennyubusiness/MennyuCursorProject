import Link from "next/link";
import { searchAdminVendors } from "@/services/admin-vendor-detail.service";
import { AdminVendorSearchForm } from "./AdminVendorSearchForm";
import { vendorDashboardPresenceLabel } from "@/lib/vendor-dashboard-presence";
import {
  parseAdminVendorRoutingQuery,
  vendorOrderRoutingModeCompactLabel,
} from "@/lib/vendor-order-routing-mode";

function RoutingBadge({ mode }: { mode: string }) {
  const label = vendorOrderRoutingModeCompactLabel(mode);
  return (
    <span className="inline-flex rounded-md border border-oo-light-stone bg-oo-cream/80 px-1.5 py-0.5 text-[11px] font-medium text-oo-stone-gray">
      {label}
    </span>
  );
}

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; routing?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const routing = parseAdminVendorRoutingQuery(sp.routing);
  const hasFilter = Boolean(query || routing);
  const results = hasFilter
    ? await searchAdminVendors(query, { orderRoutingMode: routing })
    : [];

  const emptyMessage = query
    ? `No vendors matched “${query}”${routing ? ` with ${vendorOrderRoutingModeCompactLabel(routing)} routing` : ""}.`
    : routing
      ? `No vendors currently use ${vendorOrderRoutingModeCompactLabel(routing)} routing.`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Vendors</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Search vendors for launch support. Filter by order routing to find vendors still on Deliverect or Square
          before tablet-only beta. Open a row for rescue tools: pause/hide, profile repair, pod membership, menu/POS
          status, and audit history.
        </p>
      </div>

      <AdminVendorSearchForm
        key={`${query}|${routing ?? "all"}`}
        initialQuery={query}
        initialRouting={routing ?? ""}
      />

      {hasFilter ? (
        <div className="overflow-x-auto rounded-xl border border-oo-light-stone bg-oo-warm-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-oo-light-stone text-oo-stone-gray">
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Routing</th>
                <th className="px-4 py-3 font-medium">Dashboard</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Pods</th>
                <th className="px-4 py-3 font-medium">Owners</th>
                <th className="px-4 py-3 font-medium">POS / Stripe</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-oo-stone-gray">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                results.map((row) => (
                  <tr key={row.id} className="border-b border-oo-light-stone/70 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/vendors/${row.id}`} className="font-medium underline">
                        {row.name}
                      </Link>
                      <p className="font-mono text-xs text-oo-stone-gray">{row.slug}</p>
                      <p className="text-xs text-oo-stone-gray">{row.publicPathPreview}</p>
                    </td>
                    <td className="px-4 py-3">
                      <RoutingBadge mode={row.orderRoutingMode} />
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {vendorDashboardPresenceLabel(row.vendorDashboardLastSeenAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {!row.isActive ? "Hidden" : row.mennyuOrdersPaused ? "Ordering paused" : "Public"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.podNames.length > 0 ? row.podNames.join(", ") : "None"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.ownerEmails.length > 0 ? row.ownerEmails.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-oo-stone-gray">
                      {row.menuSyncLabel}
                      <br />
                      {row.stripeSummary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {results.length > 0 ? (
            <p className="border-t border-oo-light-stone px-4 py-2 text-xs text-oo-stone-gray">
              Showing {results.length} vendor{results.length === 1 ? "" : "s"}
              {routing ? ` · ${vendorOrderRoutingModeCompactLabel(routing)} routing` : ""}
              {query ? ` · matching “${query}”` : ""}.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-oo-stone-gray">
          Enter a search term, or choose a routing filter (e.g. Deliverect / Square) to list vendors that still need
          tablet migration.
        </p>
      )}
    </div>
  );
}
