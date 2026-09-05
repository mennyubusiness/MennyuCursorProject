import { DashboardStatusBadge } from "@/components/dashboard";
import { podPublicStatusLabel, podPublicStatusTone } from "@/lib/pod-operational-copy";
import { MENU_ONLY_BADGE, POD_MENU_ONLY_DASHBOARD_BODY } from "@/lib/vendor-ordering-mode";
import { PodPublicPageActions } from "./PodPublicPageActions";

type PodStatusCardProps = {
  podId: string;
  podName: string;
  isActive: boolean;
  hasPublicProfile: boolean;
  orderableVendorCount: number;
  /** Vendors publicly listed and browsable. Used instead of orderable count when menu-only. */
  listedVendorCount?: number;
  /** Pod-wide ordering is off: commerce counts are replaced with listing counts. */
  podMenuOnly?: boolean;
  announcementActive: boolean;
  publicPageHref: string;
};

export function PodStatusCard({
  podId,
  podName,
  isActive,
  hasPublicProfile,
  orderableVendorCount,
  listedVendorCount = 0,
  podMenuOnly = false,
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
          <h2 className="mt-1 text-2xl font-bold text-oo-charcoal">{podName}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DashboardStatusBadge tone={tone}>{status}</DashboardStatusBadge>
            {podMenuOnly ? (
              <DashboardStatusBadge tone="neutral">{MENU_ONLY_BADGE}</DashboardStatusBadge>
            ) : null}
          </div>
          {podMenuOnly ? (
            <p className="mt-3 max-w-md text-sm text-oo-stone-gray">
              {POD_MENU_ONLY_DASHBOARD_BODY}
            </p>
          ) : null}
        </div>
        <PodPublicPageActions
          publicPageHref={publicPageHref}
          settingsHref={`/pod/${podId}/settings`}
        />
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-oo-cream/70 px-4 py-3">
          <dt className="text-xs font-medium text-oo-stone-gray">
            {podMenuOnly ? "Listed vendors" : "Orderable vendors"}
          </dt>
          <dd className="mt-1 text-sm font-medium text-oo-charcoal">
            {podMenuOnly ? listedVendorCount : orderableVendorCount}
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
