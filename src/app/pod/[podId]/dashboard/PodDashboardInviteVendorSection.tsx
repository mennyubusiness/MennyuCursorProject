"use client";

import { PodDashboardAddVendor } from "./PodDashboardAddVendor";

type EligibleVendor = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  mennyuOrdersPaused: boolean;
};

export function PodDashboardInviteVendorSection({
  podId,
  prominent = false,
  collapsedByDefault = false,
  eligibleVendors,
}: {
  podId: string;
  prominent?: boolean;
  collapsedByDefault?: boolean;
  eligibleVendors: EligibleVendor[];
}) {
  const hasEligibleVendors = eligibleVendors.length > 0;
  const body = (
    <>
      <p className="text-sm text-oo-stone-gray">
        We&apos;ll notify the vendor. They choose whether to accept or decline. If they&apos;re already in
        another pod, accepting your invitation moves them here.
      </p>
      {!hasEligibleVendors ? (
        <p className="mt-2 text-sm text-oo-stone-gray">
          All vendors are already in your pod or have pending requests.
        </p>
      ) : (
        <div className="mt-3">
          <PodDashboardAddVendor podId={podId} eligibleVendors={eligibleVendors} />
        </div>
      )}
    </>
  );

  if (prominent) {
    return (
      <section className="rounded-xl border border-oo-charcoal/15 bg-oo-cream/80 p-6">
        <h2 className="text-lg font-semibold text-oo-charcoal">Invite vendors to your pod</h2>
        <p className="mt-2 text-sm text-oo-stone-gray">
          Add your first restaurant to start building your pod page and taking customer orders.
        </p>
        <div className="mt-4">{body}</div>
      </section>
    );
  }

  if (collapsedByDefault && !hasEligibleVendors) {
    return (
      <details className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-oo-stone-gray [&::-webkit-details-marker]:hidden">
          Invite another vendor
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
        Invite a vendor
      </h2>
      <div className="mt-3">{body}</div>
    </section>
  );
}
