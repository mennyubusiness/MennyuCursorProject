import { notFound } from "next/navigation";

import { DashboardCard, DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadPodDashboardContext } from "@/lib/pod-dashboard-data.server";
import { PodDashboardPendingRequests } from "../dashboard/PodDashboardPendingRequests";
import { PodVendorAdoptionBoard } from "../dashboard/PodVendorAdoptionBoard";
import { PodVendorsPageActions } from "./PodVendorsPageActions";
import { PodVendorsFilterBar } from "./PodVendorsPageView";

export default async function PodVendorsPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const ctx = await loadPodDashboardContext(podId);
  if (!ctx) notFound();

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Vendors"
        description="Manage your pod roster, vendor readiness, featured placement, and invitations."
        actions={
          <PodVendorsPageActions podId={podId} pendingEmailInvites={ctx.pendingEmailInvites} />
        }
      />

      <div className="mt-8 space-y-8">
        <PodDashboardPendingRequests podId={podId} requests={ctx.pendingForUi} />

        {ctx.adoptionAttentionRows.length > 0 ? (
          <PodVendorAdoptionBoard
            podSlug={ctx.pod.slug}
            launchSummary={ctx.launchSummary}
            attentionRows={ctx.adoptionAttentionRows}
            pendingCount={ctx.pendingForUi.length}
          />
        ) : null}

        <DashboardCard
          title="Vendor roster"
          description="Reorder vendors, feature highlights, pause visibility in your pod, or remove vendors."
        >
          <PodVendorsFilterBar rows={ctx.rosterRows} podId={podId} podSlug={ctx.pod.slug} />
        </DashboardCard>
      </div>
    </DashboardShell>
  );
}
