import Link from "next/link";

import { DashboardStatusBadge } from "@/components/dashboard";
import {
  podPublicStatusLabel,
  podPublicStatusTone,
  type PodPublicStatusLabel,
} from "@/lib/pod-operational-copy";
import { PodPublicPageActions } from "./PodPublicPageActions";

type PodStatusCardProps = {
  podId: string;
  podName: string;
  isActive: boolean;
  hasPublicProfile: boolean;
  orderableVendorCount: number;
  pickupInstructionsSet: boolean;
  announcementActive: boolean;
  publicPageHref: string;
};

function statusHeadline(podName: string, status: PodPublicStatusLabel): string {
  if (status === "Live") return `${podName} is live`;
  if (status === "Setup needed") return `${podName} needs setup`;
  return `${podName} is not active yet`;
}

function statusSubline(input: {
  status: PodPublicStatusLabel;
  orderableVendorCount: number;
  pickupInstructionsSet: boolean;
  announcementActive: boolean;
}): string {
  const parts: string[] = [];
  if (input.status === "Live") {
    parts.push(
      input.orderableVendorCount === 1
        ? "1 orderable vendor"
        : `${input.orderableVendorCount} orderable vendors`
    );
    parts.push("Public page active");
  } else if (input.status === "Setup needed") {
    parts.push("Finish pod setup before promoting to customers");
  } else {
    parts.push("Open Order will activate this pod for public ordering");
  }
  if (!input.pickupInstructionsSet) {
    parts.push("Pickup instructions needed");
  }
  if (input.announcementActive) {
    parts.push("Announcement active");
  }
  return parts.join(" · ");
}

export function PodStatusCard({
  podId,
  podName,
  isActive,
  hasPublicProfile,
  orderableVendorCount,
  pickupInstructionsSet,
  announcementActive,
  publicPageHref,
}: PodStatusCardProps) {
  const status = podPublicStatusLabel({ isActive, hasPublicProfile });
  const tone = podPublicStatusTone(status);

  return (
    <section className="rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Pod status</p>
          <h2 className="mt-1 text-2xl font-bold text-oo-charcoal">{statusHeadline(podName, status)}</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">{statusSubline({ status, orderableVendorCount, pickupInstructionsSet, announcementActive })}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DashboardStatusBadge tone={tone}>{status}</DashboardStatusBadge>
          </div>
        </div>
        <PodPublicPageActions
          publicPageHref={publicPageHref}
          promoteHref={`/pod/${podId}/promote`}
          settingsHref={`/pod/${podId}/settings`}
        />
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">Orderable vendors</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">{orderableVendorCount}</dd>
        </div>
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">Pickup instructions</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">
            {pickupInstructionsSet ? "Set" : "Not set"}
          </dd>
        </div>
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">QR & signage</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">
            <Link href={`/pod/${podId}/promote`} className="underline">
              Available
            </Link>
          </dd>
        </div>
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">Announcement</dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">
            {announcementActive ? "Active" : "None"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
