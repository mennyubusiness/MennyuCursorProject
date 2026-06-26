import Link from "next/link";

import { DashboardStatusBadge, type DashboardStatusTone } from "@/components/dashboard";
import {
  vendorIntakeStatusTone,
  VENDOR_POS_MANAGED_COPY,
  type VendorIntakeStatusLabel,
} from "@/lib/vendor-operational-copy";
import { VendorOrdersOperationsBar } from "./VendorOrdersOperationsBar";

type VendorStoreStatusCardProps = {
  vendorId: string;
  vendorName: string;
  intakeLabel: VendorIntakeStatusLabel;
  podName: string | null;
  posConnectionLabel: string;
  menuSyncLabel: string;
  paymentsLabel: string;
  posManaged: boolean;
  initialPaused: boolean;
  storefrontHref: string | null;
  todayHoursLabel: string;
  nextOpeningLabel: string | null;
  hoursSourceLabel: string;
};

export function VendorStoreStatusCard({
  vendorId,
  vendorName,
  intakeLabel,
  podName,
  posConnectionLabel,
  menuSyncLabel,
  paymentsLabel,
  posManaged,
  initialPaused,
  storefrontHref,
  todayHoursLabel,
  nextOpeningLabel,
  hoursSourceLabel,
}: VendorStoreStatusCardProps) {
  const tone: DashboardStatusTone = vendorIntakeStatusTone(intakeLabel);

  return (
    <section className="rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Store status</p>
          <h2 className="mt-1 text-2xl font-bold text-oo-charcoal">{vendorName}</h2>
          {podName ? (
            <p className="mt-1 text-sm text-oo-stone-gray">Serving in {podName}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DashboardStatusBadge tone={tone}>{intakeLabel}</DashboardStatusBadge>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {storefrontHref ? (
            <Link
              href={storefrontHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2.5 text-sm font-semibold text-oo-charcoal transition hover:bg-oo-warm-white"
            >
              View customer menu
            </Link>
          ) : null}
          <Link
            href={`/vendor/${vendorId}/hours`}
            className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2.5 text-sm font-semibold text-oo-charcoal transition hover:bg-oo-warm-white"
          >
            Edit hours
          </Link>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">Today</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">{todayHoursLabel}</dd>
          {nextOpeningLabel ? (
            <dd className="mt-1 text-xs text-oo-stone-gray">{nextOpeningLabel}</dd>
          ) : null}
          <dd className="mt-1 text-xs text-oo-stone-gray">{hoursSourceLabel}</dd>
        </div>
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">POS</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">{posConnectionLabel}</dd>
        </div>
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">Menu</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">{menuSyncLabel}</dd>
        </div>
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">Payments</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">{paymentsLabel}</dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-oo-light-stone pt-5">
        <VendorOrdersOperationsBar
          vendorId={vendorId}
          initialPaused={initialPaused}
          posOpen={undefined}
          layout="compact"
          posManaged={posManaged}
        />
      </div>
    </section>
  );
}
