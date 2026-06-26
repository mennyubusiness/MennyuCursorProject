import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadPodDashboardContext } from "@/lib/pod-dashboard-data.server";
import { derivePodReadinessPageSummary } from "@/lib/pod-readiness-page";
import { POD_SETUP_REQUIRED_CHECKLIST_KEYS } from "@/lib/vendor-pod-readiness";
import { PodReadinessPodSection } from "./PodReadinessPodSection";
import { PodReadinessPromotionSection } from "./PodReadinessPromotionSection";
import { PodReadinessSummarySection } from "./PodReadinessSummarySection";
import { PodReadinessVendorSection } from "./PodReadinessVendorSection";

const REQUIRED_KEYS = new Set<string>(POD_SETUP_REQUIRED_CHECKLIST_KEYS);

export default async function PodReadinessPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const ctx = await loadPodDashboardContext(podId);
  if (!ctx) notFound();

  const requiredPodItems = ctx.podSetupChecklist.filter((item) => REQUIRED_KEYS.has(item.key));
  const promotionItem =
    ctx.podSetupChecklist.find((item) => item.key === "qr_signage") ?? null;
  const summary = derivePodReadinessPageSummary({
    requiredPodItems,
    rosterRows: ctx.rosterRows,
  });

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Readiness"
        description="See what is ready for customers and what still needs attention."
      />

      <div className="mt-8 space-y-8">
        <PodReadinessSummarySection summary={summary} />
        <PodReadinessPodSection items={requiredPodItems} />
        <PodReadinessVendorSection podId={podId} podSlug={ctx.pod.slug} rows={ctx.rosterRows} />
        <PodReadinessPromotionSection podId={podId} promotionItem={promotionItem} />
      </div>
    </DashboardShell>
  );
}
