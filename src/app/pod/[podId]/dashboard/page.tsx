import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadPodDashboardContext } from "@/lib/pod-dashboard-data.server";
import { PodNeedsAttentionSection } from "./PodNeedsAttentionSection";
import { PodRecentActivitySection } from "./PodRecentActivitySection";
import { PodStatusCard } from "./PodStatusCard";
import { PodTodayActivitySection } from "./PodTodayActivitySection";
import { PodVendorReadinessSection } from "./PodVendorReadinessSection";

export default async function PodDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<{ claimed?: string }>;
}) {
  const { podId } = await params;
  const query = await searchParams;
  const ctx = await loadPodDashboardContext(podId);
  if (!ctx) notFound();

  const hasPublicProfile = Boolean(
    ctx.pod.name?.trim() &&
      (ctx.pod.description?.trim() || ctx.pod.address?.trim()) &&
      ctx.pod.imageUrl?.trim()
  );

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Dashboard"
        description={
          ctx.podMenuOnly
            ? "Public pod status, vendor menus, and how your pod page looks to customers."
            : "Public pod status, vendor readiness, and how your pod is performing."
        }
      />

      <div className="mt-8 space-y-8">
        {query.claimed === "1" ? (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            role="status"
          >
            <span className="font-semibold">Pod claimed.</span> You can now manage your pod,
            vendors, and sharing tools.
          </div>
        ) : null}
        {!ctx.setupComplete ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-oo-charcoal">
            <Link href={`/pod/${podId}/setup`} className="font-semibold underline">
              Readiness needs attention
            </Link>
            <span className="text-oo-stone-gray">
              {" "}
              {ctx.podMenuOnly
                ? "— finish required checks so your pod and vendor menus appear publicly."
                : "— finish required checks so customers can order from your pod."}
            </span>
          </div>
        ) : null}

        <PodStatusCard
          podId={podId}
          podName={ctx.pod.name}
          isActive={ctx.pod.isActive}
          hasPublicProfile={hasPublicProfile}
          orderableVendorCount={ctx.orderableVendorCount}
          listedVendorCount={ctx.listedVendorCount}
          podMenuOnly={ctx.podMenuOnly}
          announcementActive={ctx.announcementState.initialIsActive && Boolean(ctx.announcementState.initialText.trim())}
          publicPageHref={ctx.publicPageHref}
        />

        <PodVendorReadinessSection
          podId={podId}
          podSlug={ctx.pod.slug}
          rows={ctx.rosterRows}
          podMenuOnly={ctx.podMenuOnly}
        />

        <PodNeedsAttentionSection podId={podId} items={ctx.attentionItems} />

        <PodTodayActivitySection
          summary={ctx.analytics.summary}
          participation={ctx.analytics.participation}
          orderableVendorCount={ctx.orderableVendorCount}
          podMenuOnly={ctx.podMenuOnly}
          listedVendorCount={ctx.listedVendorCount}
          activeVendorCount={ctx.rosterRows.length}
          promoteHref={`/pod/${podId}/promote`}
        />

        <PodRecentActivitySection feed={ctx.activityFeed} />
      </div>
    </DashboardShell>
  );
}
