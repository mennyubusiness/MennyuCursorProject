import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import {
  getPodAnalyticsExtended,
  type PodAnalyticsRange,
} from "@/services/pod-analytics.service";
import { arePodOwnerPayoutsConfigured } from "@/lib/pod-owner-payout-visibility";
import { loadPodPayoutRecipientContext } from "@/services/pod-payout-connect.service";
import { PodAnalyticsView } from "./PodAnalyticsView";

function parseRange(raw: string | undefined): PodAnalyticsRange {
  if (raw === "today" || raw === "30d") return raw;
  return "7d";
}

export default async function PodAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { podId } = await params;
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const [analytics, payoutContext] = await Promise.all([
    getPodAnalyticsExtended(podId, range),
    loadPodPayoutRecipientContext(podId),
  ]);
  if (!analytics) notFound();

  const showPodRevenueShare = arePodOwnerPayoutsConfigured({
    podPayoutsEnabled: payoutContext?.podPayoutsEnabled ?? false,
  });

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Analytics"
        description="Aggregated pod performance through Open Order — no individual order details."
      />
      <div className="mt-8">
        <PodAnalyticsView
          podId={podId}
          range={range}
          analytics={analytics}
          showPodRevenueShare={showPodRevenueShare}
        />
      </div>
    </DashboardShell>
  );
}
