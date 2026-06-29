import Link from "next/link";

import { DashboardCard } from "@/components/dashboard";
import { VendorLogo } from "@/components/images/VendorLogo";
import type { PodRosterVendorRow } from "@/app/pod/[podId]/dashboard/PodVendorRosterPanel";
import {
  deriveVendorMissingLines,
  vendorReadinessBadge,
  vendorReadinessPrimaryAction,
} from "@/lib/pod-readiness-page";
import { getVendorPodOwnerDisplayStateFromSetup } from "@/lib/vendor-readiness-states";

function rowDisplayState(row: PodRosterVendorRow) {
  return getVendorPodOwnerDisplayStateFromSetup({
    podVendorActive: row.podVendorActive,
    canAcceptOrders: row.readiness.canAcceptOrders,
    setupSummary: row.readiness.setupSummary,
  });
}

export function PodReadinessVendorSection({
  podId,
  podSlug,
  rows,
}: {
  podId: string;
  podSlug: string;
  rows: PodRosterVendorRow[];
}) {
  const allReady = rows.length > 0 && rows.every((row) => row.readiness.canAcceptOrders);

  return (
    <DashboardCard
      title="Vendor readiness"
      description="See which vendors are ready for customers and which vendors still need attention."
      as="section"
    >
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-oo-charcoal">No vendors are assigned to this pod yet.</p>
          <Link
            href={`/pod/${podId}/vendors#invite`}
            className="mt-3 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Invite vendors
          </Link>
        </div>
      ) : allReady ? (
        <p className="text-sm text-oo-stone-gray">All vendors are ready for customers.</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className={`space-y-3 ${allReady ? "mt-4" : ""}`}>
          {rows.map((row) => {
            const badge = vendorReadinessBadge(row);
            const missingLines = deriveVendorMissingLines(row);
            const action = vendorReadinessPrimaryAction({ podId, podSlug, row });
            const visibilityLabel =
              rowDisplayState(row) === "live"
                ? "Live — accepting orders"
                : rowDisplayState(row) === "hidden"
                  ? "Hidden — public profile incomplete"
                  : "Visible — not accepting orders";
            const orderabilityLabel = row.readiness.canAcceptOrders
              ? "Orderable"
              : "Not orderable";

            return (
              <li
                key={row.vendorId}
                className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <VendorLogo
                      imageUrl={row.imageUrl}
                      vendorName={row.name}
                      className="h-10 w-10 shrink-0 rounded-lg"
                      sizes="40px"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-oo-charcoal">{row.name}</p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-oo-stone-gray">
                        {visibilityLabel} · {orderabilityLabel}
                      </p>
                      {missingLines.length > 0 ? (
                        <ul className="mt-2 space-y-0.5 text-sm text-oo-stone-gray">
                          {missingLines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                  <Link
                    href={action.href}
                    target={action.external ? "_blank" : undefined}
                    rel={action.external ? "noopener noreferrer" : undefined}
                    className="shrink-0 text-sm font-medium text-oo-charcoal underline"
                  >
                    {action.label}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {rows.length > 0 ? (
        <p className="mt-4 text-sm text-oo-stone-gray">
          <Link href={`/pod/${podId}/vendors`} className="font-medium text-oo-charcoal underline">
            Manage vendor roster
          </Link>
        </p>
      ) : null}
    </DashboardCard>
  );
}
