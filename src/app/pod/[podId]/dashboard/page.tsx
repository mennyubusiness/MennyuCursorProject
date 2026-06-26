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
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
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
        description="Public pod status, vendor readiness, and how your pod is performing."
      />

      <div className="mt-8 space-y-8">
        {!ctx.setupComplete ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-oo-charcoal">
            <Link href={`/pod/${podId}/setup`} className="font-semibold underline">
              Setup incomplete
            </Link>
            <span className="text-oo-stone-gray">
              {" "}
              — finish required steps so customers can order from your pod.
            </span>
          </div>
        ) : null}

        <PodStatusCard
          podId={podId}
          podName={ctx.pod.name}
          isActive={ctx.pod.isActive}
          hasPublicProfile={hasPublicProfile}
          orderableVendorCount={ctx.orderableVendorCount}
          announcementActive={ctx.announcementState.initialIsActive && Boolean(ctx.announcementState.initialText.trim())}
          publicPageHref={ctx.publicPageHref}
        />

        <PodVendorReadinessSection podId={podId} podSlug={ctx.pod.slug} rows={ctx.rosterRows} />

        <PodNeedsAttentionSection podId={podId} items={ctx.attentionItems} />

        <PodTodayActivitySection
          summary={ctx.analytics.summary}
          participation={ctx.analytics.participation}
          orderableVendorCount={ctx.orderableVendorCount}
        />

        <PodRecentActivitySection feed={ctx.activityFeed} />
      </div>
    </DashboardShell>
  );
}
