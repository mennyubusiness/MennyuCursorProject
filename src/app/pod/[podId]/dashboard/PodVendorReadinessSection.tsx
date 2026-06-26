import Link from "next/link";

import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { podOwnerVendorDisplayStatus } from "@/lib/pod-vendor-adoption";
import { VendorLogo } from "@/components/images/VendorLogo";
import type { PodRosterVendorRow } from "./PodVendorRosterPanel";

function readinessDetail(row: PodRosterVendorRow): string {
  if (row.readiness.canAcceptOrders) return "Accepting orders";
  const blocker = row.readiness.primaryBlocker?.label;
  if (blocker) return blocker;
  return podOwnerVendorDisplayStatus(row.readiness.status, row.readiness.canAcceptOrders);
}

export function PodVendorReadinessSection({
  podId,
  podSlug,
  rows,
}: {
  podId: string;
  podSlug: string;
  rows: PodRosterVendorRow[];
}) {
  const previewRows = rows.slice(0, 6);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-oo-charcoal">Vendor readiness</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            See which vendors are live, blocked, or paused in your pod.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/pod/${podId}/vendors`}
            className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Manage vendors
          </Link>
        </div>
      </div>

      {previewRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/50 px-4 py-8 text-center text-sm text-oo-stone-gray">
          No vendors in your pod yet.{" "}
          <Link href={`/pod/${podId}/vendors`} className="font-medium text-oo-charcoal underline">
            Add vendors on the Vendors page
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-2">
          {previewRows.map((row) => {
            const displayStatus = podOwnerVendorDisplayStatus(
              row.readiness.status,
              row.readiness.canAcceptOrders
            );
            const isLive = row.readiness.canAcceptOrders;
            return (
              <li
                key={row.vendorId}
                className="flex flex-col gap-3 rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <VendorLogo
                    imageUrl={row.imageUrl}
                    vendorName={row.name}
                    className="h-10 w-10 shrink-0 rounded-lg"
                    sizes="40px"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-oo-charcoal">{row.name}</p>
                    <p className="mt-0.5 text-sm text-oo-stone-gray">
                      {displayStatus}
                      {!isLive ? ` · ${readinessDetail(row)}` : " · Accepting orders"}
                    </p>
                    <p className="mt-0.5 text-xs text-oo-stone-gray">
                      {row.isFeatured ? "Featured · " : ""}
                      {row.podVendorActive ? "Visible on pod page" : "Paused in pod"}
                    </p>
                  </div>
                </div>
                <Link
                  href={buildVendorMenuCustomerPath(podSlug, row.vendorSlug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium text-oo-charcoal underline"
                >
                  Public page
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > previewRows.length ? (
        <p className="text-sm text-oo-stone-gray">
          <Link href={`/pod/${podId}/vendors`} className="font-medium text-oo-charcoal underline">
            View all {rows.length} vendors
          </Link>
        </p>
      ) : null}
    </section>
  );
}
