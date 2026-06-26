import { notFound } from "next/navigation";

import { getPublicSiteOrigin } from "@/lib/public-site-url";
import { loadPodDashboardContext } from "@/lib/pod-dashboard-data.server";
import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { PodOrderingQrSection } from "@/components/pod/PodOrderingQrSection";
import { PodPromotionCard } from "../dashboard/PodPromotionCard";

export default async function PodPromotePage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const ctx = await loadPodDashboardContext(podId);
  if (!ctx) notFound();

  const publicOrigin = await getPublicSiteOrigin();

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Promote"
        description="Share your public pod page and keep announcements fresh."
      />

      <div className="mt-8 space-y-8">
        <PodOrderingQrSection
          podId={podId}
          podSlug={ctx.pod.slug}
          podName={ctx.pod.name}
          publicOrigin={publicOrigin}
        />

        <PodPromotionCard
          podId={podId}
          initialText={ctx.announcementState.initialText}
          initialIsActive={ctx.announcementState.initialIsActive}
        />
      </div>
    </DashboardShell>
  );
}
